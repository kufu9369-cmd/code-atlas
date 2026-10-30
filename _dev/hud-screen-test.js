/* 真屏验证：悬浮窗在桌面上的透明度是不是真的（不是黑底）。
   ------------------------------------------------------------
   为什么需要这一步：
   capturePage() 拍到的是渲染层自己的画面，四角 alpha=0 只能说明
   「页面把透明像素画出来了」，不能说明 Windows 合成器真的让桌面透了过来。
   关掉硬件加速时，透明窗口在某些机器上会变成一块黑底。

   做法（A/B 对照）：
   1. 全屏截一张当基线；
   2. 起一个干净的临时配置，按 Ctrl+Alt+X 把悬浮窗叫到固定位置；
   3. 再截一张，比较同一个**物理像素点**：
      - 窗口圆角顶点（本该透明）：和基线一样 → 桌面透出来了
      - 卡片内部（本该实心）：应该明显变深
   注意 DIP 与物理像素差 1.5 倍（本机 150% 缩放），算错位置会采样到窗口外面，
   第一次就踩了这个坑——两个点都在窗外，前后完全一致，看起来像"没显示"。
   ------------------------------------------------------------ */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '_shots');
const UD = path.join(OUT, '_ud_screen');
const EXE = 'D:/CodeAtlas/CodeAtlas.exe';
const POS = { x: 140, y: 140 };        // DIP
const SIZE = { w: 520, h: 700 };
const DPI = 1.5;                        // 本机 150%

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function py(code) {
  const pyExe = 'C:/Users/10137/.workbuddy/binaries/python/envs/default/Scripts/python.exe';
  const f = path.join(OUT, '_probe.py');
  fs.writeFileSync(f, code, 'utf8');
  return execSync(`"${pyExe}" "${f}"`).toString().trim();
}

function shot(tag) {
  const file = path.join(OUT, 'screen_' + tag + '.png');
  py([
    'from PIL import ImageGrab',
    `ImageGrab.grab().save(r'${file}')`,
    'print("saved")'
  ].join('\n'));
  return file;
}

/* 读两个点：圆角顶点（应透明）+ 卡片内部（应实心） */
function sample(file) {
  const code = [
    'from PIL import Image',
    `im = Image.open(r'${file}').convert('RGB')`,
    'px = im.load()',
    `ox, oy = ${POS.x} * ${DPI}, ${POS.y} * ${DPI}`,
    'pts = {',
    '  "corner_1": (int(ox)+1, int(oy)+1),',
    '  "corner_4": (int(ox)+4, int(oy)+4),',
    '  "corner_8": (int(ox)+8, int(oy)+8),',
    '  "inside_40": (int(ox)+40, int(oy)+40),',
    '  "inside_200": (int(ox)+200, int(oy)+200),',
    '}',
    'print({k: px[v] for k, v in pts.items()})'
  ].join('\n');
  const out = py(code);
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(UD, { recursive: true, force: true });
  fs.mkdirSync(UD, { recursive: true });
  fs.writeFileSync(path.join(UD, 'hud-state.json'), JSON.stringify({
    x: POS.x, y: POS.y, width: SIZE.w, height: SIZE.h, alpha: 1
  }));

  const before = sample(shot('before'));

  /* 必须过滤 ELECTRON* —— 本会话里带着 ELECTRON_RUN_AS_NODE=1，
     不过滤的话 CodeAtlas.exe 会退化成纯 Node，秒退且什么日志都不写。 */
  const env = {};
  Object.keys(process.env).forEach(k => { if (!/^(ELECTRON|WORKBUDDY)/i.test(k)) env[k] = process.env[k]; });

  spawn(EXE, ['--user-data-dir=' + UD], { stdio: 'ignore', env });
  await sleep(5000);

  /* 发一次 Ctrl+Alt+X：既是透明度测试的前置，也把「热键能不能唤出」一起验了 */
  try {
    execSync('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; '
      + '[System.Windows.Forms.SendKeys]::SendWait(\'^%x\')"', { stdio: 'ignore' });
  } catch (e) { /* SendKeys 不可用就退化成「只测透明度」，下面日志会显示 */ }
  await sleep(1800);

  const after = sample(shot('after'));

  const log = path.join(UD, 'logs', 'main.log');
  const logTxt = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';

  try { execSync('taskkill /IM CodeAtlas.exe /F', { stdio: 'ignore' }); } catch (e) {}

  console.log('基线:', before);
  console.log('显示后:', after);
  console.log('热键:', /\[hud\] 热键已注册/.test(logTxt) ? '已注册' : '未注册',
    '|', /\[hud\] show/.test(logTxt) ? '悬浮窗被唤出 ✓' : '悬浮窗没被唤出 ✗');
})();
