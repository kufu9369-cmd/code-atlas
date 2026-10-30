/* ============================================================
   CodeAtlas · Electron 主进程
   作用：把一个纯静态的 Web 应用，装进一个不依赖浏览器的桌面窗口。
   - 用自定义 app:// 协议加载页面（而不是 file://）
     好处：有稳定的 origin，localStorage / sessionStorage 在升级、换路径后都不会丢
   - 默认隐藏菜单栏（按 Alt 唤出），单实例，记住窗口位置
   - 页面里的外部链接（华为官方文档等）一律交给系统默认浏览器
   ============================================================ */

const { app, BrowserWindow, Menu, shell, dialog, protocol,
        ipcMain, globalShortcut, Tray, nativeImage, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const copySel = require('./copysel');

const APP_NAME = 'CodeAtlas';
const ROOT = path.join(__dirname, '..');          // index.html / assets 所在目录
const SCHEME = 'app';
const PRELOAD = path.join(__dirname, 'preload.js');

/* ---------- 自动化截图模式（只在设了 CODEATLAS_SHOT 时生效） ----------
   用途：给打包后的成品做回归验证，不需要人盯着窗口。
   做法：把窗口挪到屏幕外再显示（渲染照常，用户看不见），
         页面加载完后可选执行一段脚本切到指定视图，截图，然后退出。
   CODEATLAS_SHOT_TARGET=hud 时拍的是悬浮窗而不是主窗口。 */
const SHOT = process.env.CODEATLAS_SHOT || '';
const SHOT_JS = process.env.CODEATLAS_SHOT_JS || '';

/* ---------------- 主进程日志 ----------------
   桌面应用没有控制台，出问题时用户拿不到任何线索。
   这里把关键节点写进 userData/logs/main.log，超过 512KB 自动轮换。 */
let logFile = null;

function log() {
  const line = new Date().toISOString().replace('T', ' ').slice(0, 19)
    + '  ' + Array.prototype.join.call(arguments, ' ');
  if (process.env.CODEATLAS_DEBUG) console.log(line);
  try {
    if (!logFile) {
      const dir = path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(dir, { recursive: true });
      logFile = path.join(dir, 'main.log');
      try { if (fs.statSync(logFile).size > 512 * 1024) fs.renameSync(logFile, logFile + '.1'); } catch {}
    }
    fs.appendFileSync(logFile, line + '\n');
  } catch { /* 日志失败不能影响主流程 */ }
}

app.setAppUserModelId('com.codeatlas.app');

/* 渲染进程沙箱默认关闭。
   在部分机器上（安全软件策略、Windows 漏洞防护的特定项、某些虚拟机），
   Chromium 的渲染沙箱初始化会失败，表现就是「窗口一闪就没了」或者
   渲染进程反复崩塌，日志里能看到 STATUS_BREAKPOINT。
   这个应用完全离线、只加载自己打包的静态文件，不加载任何远程内容，
   contextIsolation 开着、nodeIntegration 关着，
   关掉沙箱换来的是「哪台机器都能打开」，代价很小。
   安全策略严格的环境可以设 CODEATLAS_SANDBOX=1 把沙箱打开。 */
if (process.env.CODEATLAS_SANDBOX !== '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

/* 硬件加速默认关闭。
   这个应用以文字和 SVG 为主，关掉加速肉眼几乎看不出差别，
   却能避开虚拟机、远程桌面、老旧显卡驱动上的 GPU 进程反复崩溃。
   机器性能好又想试加速，设环境变量 CODEATLAS_GPU=1 即可。 */
if (process.env.CODEATLAS_GPU !== '1') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

/* 需要远程调试（自动化测试 / 排查界面问题）时，启动前设置环境变量
   CODEATLAS_DEBUG_PORT=9333，即可用 Chrome DevTools 协议连上来。
   命令行直接传 --remote-debugging-port 会被 Electron 的参数校验拦掉。 */
const DBG_PORT = process.env.CODEATLAS_DEBUG_PORT;
if (DBG_PORT && /^\d+$/.test(DBG_PORT)) {
  app.commandLine.appendSwitch('remote-debugging-port', DBG_PORT);
}

/* 自定义协议必须在 ready 之前登记权限 */
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);

/* ---------------- 窗口状态记忆 ----------------
   这里踩过一个很隐蔽的坑：自动截图回归时会把窗口挪到屏幕外（-4000,-400），
   退出时 saveState 原样把 -4000 存了下来，下次启动 loadState 又照着恢复，
   结果窗口确实创建了、进程也活着，但落在屏幕外——用户看到的就是「双击没反应」。
   所以：① 屏幕外的坐标一律不存；② 读回来的坐标必须落在当前显示器上才认；
   ③ 截图模式完全不碰状态文件。 */
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

/* 窗口至少有这么大一块落在某块显示器上，才算「看得见」 */
function isOnScreen(x, y, w, h) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  try {
    const { screen } = require('electron');
    return screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      const ix = Math.min(x + w, a.x + a.width) - Math.max(x, a.x);
      const iy = Math.min(y + h, a.y + a.height) - Math.max(y, a.y);
      return ix >= 160 && iy >= 80;   // 够得着标题栏就行
    });
  } catch { return false; }
}

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (!s || typeof s !== 'object') return {};
    // 只接受合理的值，避免上次异常写入把窗口拖到看不见的地方。
    // 下限放到 320×240：窗口可以缩到很小（见 createWindow 的 minWidth），
    // 这里要是还按 600×400 拦，用户拖出来的小窗口下次启动就记不住了。
    const w = Number(s.width), h = Number(s.height);
    if (!(w >= 320 && w <= 8000) || !(h >= 240 && h <= 8000)) return {};
    const out = { width: w, height: h, maximized: !!s.maximized };
    // 坐标单独校验：显示器换过、拔过副屏、或者被写成屏幕外，就干脆不传坐标，
    // 让 Electron 自己居中，而不是把窗口摆到看不见的地方。
    if (isOnScreen(Number(s.x), Number(s.y), w, h)) {
      out.x = Number(s.x);
      out.y = Number(s.y);
    }
    return out;
  } catch { return {}; }
}

function saveState(win) {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
  if (process.env.CODEATLAS_SHOT) return;   // 截图模式的窗口在屏幕外，绝不能写进状态
  try {
    const b = win.getNormalBounds();
    if (!isOnScreen(b.x, b.y, b.width, b.height)) return;
    fs.writeFileSync(stateFile(), JSON.stringify({
      ...b,
      maximized: win.isMaximized()
    }));
  } catch { /* 写不进去就算了，不影响使用 */ }
}

/* ---------------- 单实例 ---------------- */
let win = null;

/* 注意：app.quit() 是异步的，拿到锁失败之后再走 whenReady 仍然会跑一遍，
   结果是第二个实例也建了窗口再退出（日志里会多一条「启动」却没下文）。
   所以这里存下结果，whenReady 里再挡一次。 */
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    // 窗口可能在屏幕外或被隐藏，先摆回主屏再聚焦
    if (!win.isVisible()) win.show();
    win.focus();
  });
}

/* ---------------- 协议处理：app://bundle/xxx -> 磁盘文件 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

function registerProtocol() {
  protocol.handle(SCHEME, (req) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url).pathname); }
    catch { return new Response('Bad request', { status: 400 }); }

    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const target = path.join(ROOT, pathname);
    // 目录穿越防护：解析后的相对路径必须仍落在应用根目录内
    const rel = path.relative(ROOT, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return new Response('Forbidden', { status: 403 });
    }

    let buf;
    try { buf = fs.readFileSync(target); }
    catch { return new Response('Not found: ' + pathname, { status: 404 }); }

    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    return new Response(buf, {
      status: 200,
      headers: { 'content-type': type, 'cache-control': 'no-cache' }
    });
  });
}

/* ---------------- 菜单 ---------------- */
function runInPage(js) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(js, true).catch(() => {});
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入 / 导出知识包…',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            // 打开列表页脚的知识包入口；按钮常驻，任何视图下都在
            runInPage(`
              (function () {
                var b = document.querySelector('.foot-btn');
                if (b) { b.click(); return 'ok'; }
                return 'no-button';
              })()
            `);
          }
        },
        { type: 'separator' },
        {
          label: '打开数据目录（备份用）',
          click: () => shell.openPath(app.getPath('userData'))
        },
        {
          label: '查看运行日志',
          click: () => {
            try {
              if (!logFile) log('手动打开日志');
              shell.openPath(logFile);
            } catch {
              dialog.showMessageBox(win, {
                type: 'info', title: '日志', message: '还没有产生日志。',
                buttons: ['好'], noLink: true
              });
            }
          }
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { label: '强制刷新', role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: '缩小', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: '实际大小', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { type: 'separator' },
        /* 这里不写 accelerator：热键已经由 globalShortcut 全局注册，
           菜单再挂一次同样的加速键，窗口有焦点时两边都会触发，
           结果就是「按一下显示又立刻消失」。键名直接写在文字里。 */
        { label: '悬浮窗（透明置顶）　' + HUD_KEY, click: () => toggleHud() },
        { label: '抓下一步：自动复制并匹配　' + NEXT_KEY, click: () => grabNext() },
        {
          label: '悬浮窗尺寸',
          submenu: [
            { label: '小　420 × 560', click: () => { showHud(); setHudSize(420, 560); } },
            { label: '中　520 × 700', click: () => { showHud(); setHudSize(520, 700); } },
            { label: '大　680 × 900', click: () => { showHud(); setHudSize(680, 900); } },
            { type: 'separator' },
            { label: '拖右下角可任意缩放', enabled: false }
          ]
        },
        {
          label: '悬浮窗不透明度',
          submenu: [
            { label: '100%　完全不透明', click: () => { showHud(); setHudAlpha(1); } },
            { label: '92%　默认', click: () => { showHud(); setHudAlpha(0.92); } },
            { label: '82%', click: () => { showHud(); setHudAlpha(0.82); } },
            { label: '72%　更透', click: () => { showHud(); setHudAlpha(0.72); } }
          ]
        },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen', accelerator: 'F11' },
        { label: '开发者工具', role: 'toggleDevTools', accelerator: 'F12' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '快捷键速查',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '快捷键',
              message: 'CodeAtlas 快捷键',
              detail: [
                'Ctrl + Alt + X  显示 / 隐藏悬浮窗',
                'Ctrl + K        聚焦全站搜索',
                'Ctrl + I        导入 / 导出知识包',
                'Ctrl + Alt + X  悬浮窗显示 / 隐藏',
                'Ctrl + Alt + Z  抓下一步（自动复制选中的行并匹配，按一次就行）',
                'Ctrl + R        刷新',
                'Ctrl + = / -    放大 / 缩小',
                'F11             全屏',
                'F12             开发者工具',
                'Alt             唤出菜单栏',
                '',
                '悬浮窗可以拖右下角任意缩放，最小 320 × 240；',
                '窗口大小、位置、透明度都会记住。',
                '',
                '数据保存在本机「用户数据目录」里，升级版本不会丢；',
                '文件 → 打开数据目录，可以手动备份。'
              ].join('\n'),
              buttons: ['知道了'],
              noLink: true
            });
          }
        },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: '关于',
              message: APP_NAME + '  ' + app.getVersion(),
              detail: [
                '可以改的代码大全：片段 / 预设 / 实验 / 排查工作流。',
                '',
                '内容与外壳分离 —— 通过「知识包」随时导入新内容，',
                '无需重新安装程序。',
                '',
                '本程序完全离线运行，不联网、不上传任何数据。'
              ].join('\n'),
              buttons: ['好'],
              noLink: true
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------------- 截图工具（主窗口 / 悬浮窗共用） ---------------- */
function attachShot(target) {
  if (!SHOT || !target) return;
  target.setPosition(-4000, -400);
  /* 手机版回归：CODEATLAS_SHOT_SIZE=390x844 可以临时把窗口缩到手机尺寸。
     只在截图模式下生效。 */
  const shotSize = String(process.env.CODEATLAS_SHOT_SIZE || '').split('x').map(Number);
  if (shotSize.length === 2 && shotSize[0] > 0 && shotSize[1] > 0) {
    target.setMinimumSize(320, 240);
    target.setBounds({ x: -4000, y: -400, width: shotSize[0], height: shotSize[1] });
  }
  target.once('ready-to-show', () => target.showInactive());
  target.webContents.once('did-finish-load', async () => {
    try {
      await new Promise(r => setTimeout(r, 1000));
      if (SHOT_JS) {
        /* 把注入脚本的返回值也写进日志：
           界面回归时除了看图，还能直接断言「元素在不在、尺寸对不对」 */
        const ret = await target.webContents.executeJavaScript(SHOT_JS, true);
        log('[shot] js => ' + JSON.stringify(ret === undefined ? null : ret));
      }
      await new Promise(r => setTimeout(r, 800));
      const img = await target.webContents.capturePage();
      fs.writeFileSync(SHOT, img.toPNG());
      log('[shot] 已保存 ' + SHOT);
    } catch (err) {
      log('[shot] 失败 ' + (err && err.message));
    }
    app.quit();
  });
}

/* ============================================================
   悬浮窗（透明窗模式）
   ------------------------------------------------------------
   按 Ctrl+Alt+X 出现，再按一次消失。窗口本身保持「无边框 + 透明」，
   卡片之外的地方是真正的透明像素。

   关于「不按时碰它没有影响」：这里用 hide() 实现，而不是把窗口留着、
   把点击穿透打开。隐藏的窗口既看不见也点不到 —— 鼠标会直接落到下面的
   eNSP / IDEA 上，压根不需要额外做点击穿透，也就不会出现
   「以为穿透了其实还在挡」这类问题。

   为什么是「按一下切换」而不是「按住才显示」：
   Electron 的全局快捷键（globalShortcut）只能拿到别的程序里的按下事件，
   拿不到松开事件 —— 松开那一刻主进程收不到任何通知。要做真正的
   「按住显示 / 松开消失」，得挂一层系统级键盘钩子（原生插件），
   为这点收益引入原生依赖不划算。按一下切换反而更好用：
   看代码、滚页面、复制都不用一直按着键。
   ============================================================ */
const HUD_KEY = process.env.CODEATLAS_HUD_KEY || 'Control+Alt+X';
/* 「抓下一步」：在 eNSP 里卡住时按这个，悬浮窗弹出来直接告诉你下一句敲什么。
   和 HUD_KEY 分工明确：X 是「打开/收起面板」，Z 是「我要下一步」。
   可以用 CODEATLAS_NEXT_KEY 环境变量换掉 —— 万一 Ctrl+Alt+Z 被别的程序
   占了（注册失败会写日志、也会在面板上提示），换一个键就能继续用。 */
const NEXT_KEY = process.env.CODEATLAS_NEXT_KEY || 'Control+Alt+Z';
let hud = null;
let hudAlpha = 0.92;
let hudKeyOk = false;
let nextKeyOk = false;
let tray = null;
let gripStart = null;
let pendingShow = false;
let pendingKeep = false;

const hudStateFile = () => path.join(app.getPath('userData'), 'hud-state.json');

function loadHudState() {
  const def = { width: 520, height: 700, alpha: 0.92 };
  try {
    const s = JSON.parse(fs.readFileSync(hudStateFile(), 'utf8')) || {};
    const w = Number(s.width), h = Number(s.height), a = Number(s.alpha);
    const out = {
      width: (w >= 320 && w <= 4000) ? w : def.width,
      height: (h >= 240 && h <= 4000) ? h : def.height,
      alpha: (a >= 0.5 && a <= 1) ? a : def.alpha
    };
    if (isOnScreen(Number(s.x), Number(s.y), out.width, out.height)) {
      out.x = Number(s.x); out.y = Number(s.y);
    }
    return out;
  } catch { return def; }
}

function saveHudState() {
  if (!hud || hud.isDestroyed() || SHOT) return;
  try {
    const b = hud.getBounds();
    if (!isOnScreen(b.x, b.y, b.width, b.height)) return;
    fs.writeFileSync(hudStateFile(), JSON.stringify({
      x: b.x, y: b.y, width: b.width, height: b.height, alpha: hudAlpha
    }));
  } catch { /* 写不进去不影响使用 */ }
}

function pushHudState() {
  if (!hud || hud.isDestroyed()) return;
  try { hud.webContents.send('hud:state', { visible: hud.isVisible(), alpha: hudAlpha }); } catch {}
}

function createHud() {
  const st = loadHudState();
  hudAlpha = st.alpha;

  hud = new BrowserWindow({
    width: st.width,
    height: st.height,
    x: st.x,
    y: st.y,
    minWidth: 320,
    minHeight: 240,
    frame: false,                 // 无边框：标题栏由页面自己画（那条能拖的横条）
    transparent: true,            // 关键：卡片外面是真正的透明像素
    backgroundColor: '#00000000',
    hasShadow: false,             // 透明窗口描边阴影会发灰，交给 CSS 画
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,            // 不占任务栏，符合「贴在别的程序上」的用法
    alwaysOnTop: true,
    show: false,
    title: 'CodeAtlas 悬浮窗',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: process.env.CODEATLAS_SANDBOX === '1',
      spellcheck: false,
      devTools: true
    }
  });

  /* screen-saver 级别：普通置顶会被某些全屏工具压下去，这一级基本压得住 */
  hud.setAlwaysOnTop(true, 'screen-saver');

  hud.once('ready-to-show', () => { log('[hud] ready-to-show'); });
  hud.webContents.once('did-finish-load', () => {
    log('[hud] did-finish-load');
    pushHudState();
    /* 第一次是按热键叫出来的：窗口先别显示，等页面画好再亮，
       否则会先闪一下「空的透明框」 */
    if (pendingShow) {
      const keep = pendingKeep;
      pendingShow = false;
      pendingKeep = false;
      showHud(keep ? { keepsFocus: true } : null);
    }
  });

  hud.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  /* 悬浮窗上的滚动条/外部链接同样处理 */
  hud.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(SCHEME + '://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  let t = null;
  const bump = () => { clearTimeout(t); t = setTimeout(saveHudState, 400); };
  hud.on('resize', bump);
  hud.on('move', bump);

  /* 用户如果从别处（比如 Alt+F4）关了悬浮窗，只当隐藏，不退出程序 */
  hud.on('close', (e) => {
    saveHudState();
    if (app.__quitting) return;
    e.preventDefault();
    hud.hide();
  });

  hud.loadURL(SCHEME + '://bundle/index.html?hud=1');
  attachShot(hud);
  return hud;
}

function showHud(opt) {
  if (!hud || hud.isDestroyed()) {
    /* 第一次：建窗口，等 did-finish-load 里再真正显示 */
    pendingShow = true;
    pendingKeep = !!(opt && opt.keepsFocus);
    createHud();
    return true;
  }
  if (hud.isMinimized()) hud.restore();
  hud.setAlwaysOnTop(true, 'screen-saver');
  /* keepsFocus：按热键抓下一步时**不抢焦点**。
     两个理由：用户接着要在 eNSP 里继续敲，抢走焦点等于每按一次都要点回去；
     更要紧的是，抢了焦点之后下一次热键的前台就变成我们自己，
     自动复制会被「前台是自己」这条保护直接跳过，等于又退回按两次。 */
  if (opt && opt.keepsFocus) {
    hud.showInactive();
  } else {
    hud.show();
    hud.focus();
  }
  pushHudState();
  log('[hud] show' + (opt && opt.keepsFocus ? ' (不抢焦点)' : ''));
  return true;
}

function hideHud() {
  if (!hud || hud.isDestroyed()) return false;
  saveHudState();
  hud.hide();
  pushHudState();
  log('[hud] hide');
  return false;
}

function toggleHud() {
  if (hud && !hud.isDestroyed() && hud.isVisible()) return hideHud();
  return showHud();
}

/* ---------------- 剪贴板：拿 eNSP 控制台里刚敲的东西 ----------------
   eNSP 的 CLI 窗口是它自己画的控件，Electron 读不到里面的文字。
   唯一可靠的办法是通过剪贴板 —— 而按 Ctrl+C 这一步现在由 copysel 代劳。
   Electron 没有「剪贴板变化」事件，只能轮询；所以只在「下一步」面板
   真的开着的时候才轮（watch(true)），关掉面板就停，不做无谓的常驻监听。 */
let clipTimer = null;
let clipLast = '';

function readClip() {
  try { return String(clipboard.readText() || ''); } catch { return ''; }
}

function startClipWatch() {
  if (clipTimer) return;
  clipLast = readClip();
  clipTimer = setInterval(() => {
    if (!hud || hud.isDestroyed() || !hud.isVisible()) return;
    const t = readClip();
    if (t === clipLast) return;
    clipLast = t;
    if (!t || t.length > 20000) return;
    try { hud.webContents.send('clip:changed', t); } catch {}
  }, 420);
  log('[clip] 开始监听剪贴板');
}

function stopClipWatch() {
  if (!clipTimer) return;
  clearInterval(clipTimer);
  clipTimer = null;
  log('[clip] 停止监听剪贴板');
}

/* 把悬浮窗叫出来，切到「下一步」面板，顺手带上剪贴板内容。
   热键和菜单里的「抓下一步」都走这里。

   v1.1.2 起：不再要求用户自己先 Ctrl+C —— 这里替他按。
   顺序很关键：**先复制，再把窗口叫出来**。反过来窗口会抢焦点，
   Ctrl+C 就落到我们自己身上，eNSP 里的选中内容反而拿不到。 */
const SELF_NAMES = [path.basename(process.execPath, '.exe')];
let grabbing = false;

function grabHint(copy, text) {
  const n = text ? text.split('\n').length : 0;
  if (copy.ok && n) {
    return '已替你按 Ctrl+C（' + (copy.proc || '前台窗口') + '，' + n + ' 行）';
  }
  if (copy.ok && !n) {
    return '按了 Ctrl+C 但一个字都没读到 —— 先在 eNSP 里把几行拖黑选中';
  }
  if (copy.reason === 'self') {
    return n ? '悬浮窗在前台，直接读了剪贴板（' + n + ' 行）' : '悬浮窗在前台，剪贴板是空的';
  }
  if (copy.reason === 'nowindow') {
    return n ? '没有前台窗口，直接读了剪贴板（' + n + ' 行）' : '没有前台窗口，剪贴板是空的';
  }
  if (copy.reason === 'copied') {
    return n ? '读到 ' + n + ' 行' : '';
  }
  /* 助手起不来 / 超时 / 被策略拦：退回老行为，说清楚就行，不弹错 */
  return n ? '自动复制不可用，直接读了剪贴板（' + n + ' 行）' : '自动复制不可用，剪贴板也是空的';
}

async function grabNext(opt) {
  if (grabbing) return false;          // 手抖连按两下不要打架
  grabbing = true;
  try {
    const before = readClip();
    const copy = await copySel.copySelection(SELF_NAMES);
    const after = readClip();
    const text = after || before;
    const changed = after !== before;

    /* 日志里带上前台窗口标题：出了「没复制到」的问题时，
       光看进程名不够 —— 同一个 powershell 可能是靶子也可能是别的东西。 */
    const ttl = String(copy.title || '').replace(/\s+/g, ' ').slice(0, 40);
    log('[next] 抓取：前台=' + (copy.proc || '-') + (ttl ? '(' + ttl + ')' : '')
      + ' 复制=' + copy.reason
      + ' 剪贴板' + (changed ? '有变化' : '没变化')
      + ' 行数=' + (text ? text.split('\n').length : 0));

    showHud({ keepsFocus: true });
    if (!hud || hud.isDestroyed()) return false;

    const payload = {
      text: text,
      auto: !!copy.ok,
      changed: changed,
      from: copy.proc || '',
      reason: copy.reason,
      hint: grabHint(copy, text)
    };
    const send = () => {
      try { hud.webContents.send('next:grab', payload); } catch {}
      startClipWatch();
    };
    /* 窗口是刚建的：did-finish-load 里 showHud 之后才谈得上发消息 */
    if (hud.webContents.isLoading()) {
      hud.webContents.once('did-finish-load', () => setTimeout(send, 120));
    } else {
      setTimeout(send, 60);
    }
    return true;
  } catch (err) {
    log('[next] 抓取出错 ' + (err && err.message));
    return false;
  } finally {
    grabbing = false;
  }
}

function setHudAlpha(v) {
  const a = Math.max(0.5, Math.min(1, Number(v) || 0.92));
  hudAlpha = a;
  saveHudState();
  pushHudState();
  return a;
}

function setHudSize(w, h) {
  if (!hud || hud.isDestroyed()) createHud();
  const b = hud.getBounds();
  const nw = Math.max(320, Math.round(w));
  const nh = Math.max(240, Math.round(h));
  hud.setBounds({ x: b.x, y: b.y, width: nw, height: nh });
  saveHudState();
  return { width: nw, height: nh };
}

/* ---------------- 主进程 <-> 页面 的悬浮窗通道 ---------------- */
function bindIpc() {
  ipcMain.handle('hud:toggle', () => toggleHud());
  ipcMain.handle('hud:show', () => showHud());
  ipcMain.handle('hud:hide', () => hideHud());
  ipcMain.handle('hud:state', () => {
    const alive = !!(hud && !hud.isDestroyed());
    return {
      visible: alive && hud.isVisible(),
      alpha: hudAlpha,
      hotkey: HUD_KEY,
      nextKey: NEXT_KEY,
      hotkeyOk: hudKeyOk,
      nextKeyOk: nextKeyOk,
      autoCopy: true,
      bounds: alive ? hud.getBounds() : null
    };
  });

  /* 「抓下一步」：热键、面板按钮、菜单都走同一条路 */
  ipcMain.handle('hud:grab', () => grabNext());

  /* 剪贴板 */
  ipcMain.handle('clip:read', () => readClip());
  ipcMain.handle('clip:write', (_e, t) => {
    try { clipboard.writeText(String(t || '')); return true; } catch { return false; }
  });
  ipcMain.on('clip:watch', (_e, on) => { if (on) startClipWatch(); else stopClipWatch(); });

  /* 「回主窗口」：关掉悬浮态，把主窗口显示出来 */
  ipcMain.handle('hud:back-to-main', () => {
    hideHud();
    if (!win || win.isDestroyed()) createWindow();
    else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
    return true;
  });

  ipcMain.handle('app:show-main', () => {
    if (!win || win.isDestroyed()) createWindow();
    else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
    return true;
  });

  ipcMain.on('app:quit', () => { app.__quitting = true; app.quit(); });
  ipcMain.on('hud:alpha', (_e, v) => setHudAlpha(v));
  ipcMain.on('hud:size', (_e, w, h) => setHudSize(w, h));

  /* 拖动缩放：页面那边只报「往哪个方向拖了多少」，
     真正算尺寸和夹边界放在主进程，避免页面拿到过期坐标算出负数。 */
  ipcMain.on('hud:grip', (_e, msg) => {
    if (!hud || hud.isDestroyed() || !msg) return;
    if (msg.phase === 'start') {
      gripStart = { grip: msg.grip, b: hud.getBounds() };
      return;
    }
    if (msg.phase === 'end') { gripStart = null; saveHudState(); return; }
    if (msg.phase !== 'move' || !gripStart) return;

    const b = gripStart.b;
    const g = gripStart.grip;
    let w = b.width, h = b.height, x = b.x, y = b.y;

    if (g.indexOf('e') >= 0) w = Math.max(320, b.width + msg.dx);
    if (g.indexOf('w') >= 0) { w = Math.max(320, b.width - msg.dx); x = b.x + (b.width - w); }
    if (g.indexOf('s') >= 0) h = Math.max(240, b.height + msg.dy);
    if (g.indexOf('n') >= 0) { h = Math.max(240, b.height - msg.dy); y = b.y + (b.height - h); }

    hud.setBounds({ x, y, width: Math.round(w), height: Math.round(h) });
  });
}

/* ---------------- 全局快捷键 ---------------- */
function registerHudKey() {
  try {
    hudKeyOk = globalShortcut.register(HUD_KEY, () => toggleHud());
  } catch { hudKeyOk = false; }
  if (hudKeyOk) log('[hud] 热键已注册 ' + HUD_KEY);
  else log('[hud] 热键注册失败，可能被别的程序占用：' + HUD_KEY);

  /* 单独一个键：按一下就告诉你在 eNSP 里下一句该敲什么 */
  try {
    nextKeyOk = globalShortcut.register(NEXT_KEY, () => grabNext());
  } catch { nextKeyOk = false; }
  if (nextKeyOk) log('[next] 抓取热键已注册 ' + NEXT_KEY);
  else log('[next] 热键注册失败，可能被别的程序占用：' + NEXT_KEY);

  return hudKeyOk;
}

/* ---------------- 托盘（悬浮窗藏起来时的找回入口） ----------------
   悬浮窗可以是「完全看不见」的状态，万一热键被占用，用户就没有任何
   入口能把它叫回来了。托盘是最后一道兜底：右键能看到「显示悬浮窗」和「退出」。 */
function buildTray() {
  try {
    let img = null;
    try {
      const p = path.join(ROOT, 'build', 'icon.png');
      img = nativeImage.createFromBuffer(fs.readFileSync(p));
    } catch {
      try { img = nativeImage.createFromPath(path.join(process.resourcesPath || ROOT, 'icon.png')); } catch {}
    }
    if (!img || img.isEmpty()) { log('[tray] 没有可用图标，跳过托盘'); return; }

    tray = new Tray(img.resize({ width: 20, height: 20 }));
    tray.setToolTip(APP_NAME + ' · ' + HUD_KEY + ' 悬浮窗 / ' + NEXT_KEY + ' 抓下一步');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示 / 隐藏悬浮窗  ' + HUD_KEY, click: () => toggleHud() },
      { label: '抓下一步（自动复制）　' + NEXT_KEY, click: () => grabNext() },
      { label: '打开主窗口', click: () => { if (win) { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: '退出', click: () => { app.__quitting = true; app.quit(); } }
    ]));
    tray.on('click', () => toggleHud());
    log('[tray] 已创建');
  } catch (err) {
    log('[tray] 创建失败 ' + (err && err.message));
  }
}

/* ---------------- 窗口 ---------------- */
function createWindow() {
  const st = loadState();

  win = new BrowserWindow({
    width: st.width || 1360,
    height: st.height || 880,
    x: st.x,
    y: st.y,
    /* 最小尺寸不再是 900×560。
       900 是当初按「左轨 + 列表 + 正文」三栏并排算出来的，
       但窗口窄到 860 以下时页面会自动切成单栏（手机上那套布局），
       再卡在 900 就等于白白浪费了这套布局。
       现在允许缩到 360×280，需要贴在一边看代码时很方便。 */
    minWidth: 360,
    minHeight: 280,
    title: APP_NAME,
    show: false,                    // 等页面画好再显示，避免白底闪一下
    autoHideMenuBar: true,          // 菜单栏默认收起，按 Alt 唤出
    backgroundColor: '#0c0f15',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: process.env.CODEATLAS_SANDBOX === '1',
      spellcheck: false,
      devTools: true
    }
  });

  if (st.maximized) win.maximize();

  attachShot(win);

  /* 显示兜底：正常情况下 ready-to-show 就显示；
     万一页面加载出问题，也不能留一个「进程活着但看不见窗口」的黑洞——
     用 did-finish-load 和超时各兜一层。 */
  let shown = false;
  const showOnce = () => {
    if (shown || !win || win.isDestroyed()) return;
    shown = true;
    if (SHOT) { win.showInactive(); return; }   // 截图模式：不抢焦点
    log('[win] show');
    win.show();
  };
  win.once('ready-to-show', () => { log('[win] ready-to-show'); showOnce(); });
  win.webContents.once('did-finish-load', () => { log('[win] did-finish-load'); showOnce(); });
  setTimeout(showOnce, 4000);

  /* 主框架加载失败时，把真实原因显示在窗口里，而不是白屏 */
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    if (code === -3) return; // 用户主动中止，不算错
    log('[load-fail] code=' + code + ' desc=' + desc + ' url=' + url);
    const html = '<!doctype html><meta charset="utf-8">'
      + '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;'
      + 'background:#0c0f15;color:#e6e9f2;font-family:\'Microsoft YaHei\',system-ui,sans-serif">'
      + '<div style="max-width:620px;padding:28px 32px;border:1px solid #262c3a;border-radius:14px;background:#11151e">'
      + '<h2 style="margin:0 0 12px;font-size:17px">界面没能加载出来</h2>'
      + '<p style="margin:0 0 14px;color:#9aa3b5;font-size:13px;line-height:1.7">'
      + '这通常是文件被移动、被杀毒软件拦截，或者安装不完整导致的。</p>'
      + '<pre style="margin:0;padding:10px 12px;background:#0a0d13;border-radius:8px;color:#f0b246;'
      + 'font-size:12px;white-space:pre-wrap;word-break:break-all">'
      + '错误码 ' + code + '：' + String(desc) + '\n' + String(url) + '</pre>'
      + '<p style="margin:14px 0 0;color:#9aa3b5;font-size:12px">'
      + '卸载后重新安装一次一般即可解决；你的数据存在用户目录里，不会因此丢失。</p>'
      + '</div></body>';
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    showOnce();
  });

  /* 外部链接一律走系统浏览器；窗口内不允许被导航到站外 */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(SCHEME + '://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  /* 渲染进程崩溃：前两次静默自愈，连续崩才打扰用户 */
  let crashCount = 0;
  win.webContents.on('render-process-gone', (e, details) => {
    crashCount++;
    log('[crash] renderer gone reason=' + details.reason
      + ' exitCode=' + details.exitCode + ' 第' + crashCount + '次');

    if (details.reason === 'clean-exit') return;

    if (crashCount <= 2) {
      setTimeout(() => {
        if (win && !win.isDestroyed()) {
          log('[crash] 自动重新加载');
          win.reload();
        }
      }, 600);
      return;
    }

    dialog.showMessageBox(win, {
      type: 'error',
      title: '页面异常',
      message: '界面进程反复退出，多半是显卡驱动或安全软件拦截导致的。',
      detail: '可以试着重新加载一次；如果反复出现，'
        + '把 logs/main.log 反馈给开发者（菜单：文件 → 打开数据目录）。\n'
        + '你的配置、收藏和已导入的知识包都存在本机，不会丢。',
      buttons: ['重新加载', '退出'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    }).then(({ response }) => {
      if (response === 0) { crashCount = 0; win.reload(); }
      else app.quit();
    }).catch(() => { /* 对话框都弹不出来就不阻塞退出 */ });
  });

  /* 窗口尺寸/位置变化时记录（防抖） */
  let t = null;
  const bump = () => { clearTimeout(t); t = setTimeout(() => saveState(win), 400); };
  win.on('resize', bump);
  win.on('move', bump);
  win.on('maximize', bump);
  win.on('unmaximize', bump);
  /* 关主窗口 = 退出程序（沿用原来的行为）。
     只有一种例外：悬浮窗正显示着，说明用户正在「悬浮模式」里，
     那就把主窗口收掉、留悬浮窗继续干活。 */
  win.on('close', () => {
    saveState(win);
    if (!(hud && !hud.isDestroyed() && hud.isVisible())) app.__quitting = true;
  });

  win.loadURL(SCHEME + '://bundle/index.html');
  return win;
}

/* ---------------- 生命周期 ---------------- */
app.whenReady().then(() => {
  if (!gotLock) return;   // 第二个实例：已经 quit 过了，不再建窗口
  log('=== 启动 v' + app.getVersion()
    + ' | electron ' + process.versions.electron
    + ' | chrome ' + process.versions.chrome
    + ' | gpu ' + (process.env.CODEATLAS_GPU === '1' ? 'on' : 'off'));
  registerProtocol();
  log('[proto] 已注册 ' + SCHEME + ':// -> ' + ROOT);
  buildMenu();
  bindIpc();
  registerHudKey();
  buildTray();

  if (process.env.CODEATLAS_SHOT_TARGET === 'hud') createHud();
  else createWindow();

  /* 把「替用户按 Ctrl+C」的助手进程先热起来。
     Add-Type 要现场编译 P/Invoke 声明（实测冷启动约 700ms），
     放到启动 2.5 秒后再做，别跟首屏渲染抢 CPU。
     预热失败无所谓，第一次按热键时还会再试。 */
  if (!SHOT) setTimeout(() => copySel.warmup(), 2500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (win) win.show();
  });
});

app.on('before-quit', () => {
  app.__quitting = true;
  stopClipWatch();
  copySel.dispose();
  try { globalShortcut.unregisterAll(); } catch {}
  log('=== 退出');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
