/* ============================================================
   端到端自检：按 **一次** Ctrl+Alt+Z 能不能拿到结果（v1.1.2）
   ------------------------------------------------------------
   为什么要有这个脚本：
   copysel 自己的单测只证明「注入 Ctrl+C 能把选中的文字送进剪贴板」，
   用户真正要的是「我在别的程序里按一次热键，面板就出结果」。
   中间还隔着：全局热键能不能收到模拟按键、注入的 Ctrl+C 会不会被
   热键残留的修饰键污染、面板会不会抢焦点把前台弄丢。
   这些只有把整个应用跑起来才看得见。

   做法：
   1) 启动开发目录的应用（独立 user-data-dir，不碰用户数据）
   2) 开一个 WinForms 靶子窗口，里面放一段 eNSP 风格的命令并全选
   3) 用 SendKeys 发 Ctrl+Alt+F9（走 CODEATLAS_NEXT_KEY 换键，
      因为机器上可能正跑着用户装的那份，占着 Ctrl+Alt+Z）
   4) 查日志里那行 [next] 抓取：…，再查剪贴板

   **为什么换键**：全局热键全系统唯一，用户那份 CodeAtlas 开着的时候
   我们这份注册 Ctrl+Alt+Z 必然失败。换键顺带验证了这个逃生口。

   **为什么剪贴板那条会 SKIP**：Windows 有前台锁定，靶子窗口不一定抢得到
   前台（微信、IDE 之类占着的时候抢不到）。这不是代码问题，
   但会让「注入到谁身上」变得不确定，所以只在确认靶子是前台时才断言内容。
   ============================================================ */

const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFileSync } = require('node:child_process');
const { spawnTarget } = require(path.join(__dirname, 'target-window.js'));

const ROOT = path.join(__dirname, '..');
/* CODEATLAS_EXE 指向打包成品时，测的就是用户手里那个 exe */
const PKG = !!process.env.CODEATLAS_EXE;
const EXE = process.env.CODEATLAS_EXE || path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const ARGS = PKG ? [] : ['.'];
const OUT = path.join(__dirname, '_shots');
const UD = path.join(OUT, PKG ? '_ud_grab_pkg' : '_ud_grab');
const LOG = path.join(UD, 'logs', 'main.log');

/* 测试用的热键，避开用户装的那份已经占住的 Ctrl+Alt+Z */
const TEST_KEY = 'Control+Alt+F9';
const TEST_SEND = '^%{F9}';

const TARGET_TEXT = [
  'CODEATLAS-GRAB-MARKER',
  '[SW1]interface GigabitEthernet0/0/24',
  '[SW1-GigabitEthernet0/0/24]port link-type trunk'
].join('\r\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0, skip = 0;
const ok = (n) => { pass++; console.log('  PASS  ' + n); };
const bad = (n, e) => { fail++; console.log('  FAIL  ' + n + (e ? '  → ' + e : '')); };
const sk = (n, why) => { skip++; console.log('  SKIP  ' + n + '  → ' + why); };

function ps(cmd) {
  try {
    return execFileSync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' + cmd],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 }).replace(/\r\n/g, '\n').trim();
  } catch (e) { return ''; }
}

function setClip(text) {
  const b64 = Buffer.from(text, 'utf16le').toString('base64');
  ps('Set-Clipboard -Value ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String(\'' + b64 + '\')))');
}

const readLog = () => { try { return fs.readFileSync(LOG, 'utf8'); } catch (e) { return ''; } };
const readFile = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const grabLines = () => readLog().split('\n').filter((l) => l.indexOf('[next] 抓取：') >= 0);

async function waitFor(test, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return true;
    await sleep(150);
  }
  return test();
}

(async () => {
  console.log('--- 一按到底 端到端自检 ---');
  fs.mkdirSync(OUT, { recursive: true });
  try { fs.rmSync(UD, { recursive: true, force: true }); } catch (e) {}

  /* 剪贴板先放个哨兵：自动复制要是没生效，它会被读进来，一眼就能发现 */
  setClip('SENTINEL-NOT-REPLACED');
  await sleep(300);

  const env = {};
  Object.keys(process.env).forEach((k) => {
    if (/^(ELECTRON|WORKBUDDY|CODEATLAS_)/i.test(k)) return;
    env[k] = process.env[k];
  });
  env.CODEATLAS_NEXT_KEY = TEST_KEY;
  env.CODEATLAS_HUD_KEY = 'Control+Alt+F8';

  const app = spawn(EXE, ARGS.concat(['--user-data-dir=' + UD]), { cwd: ROOT, env, stdio: 'ignore' });
  let exited = false;
  app.on('exit', () => { exited = true; });

  /* 等应用起来 + 助手预热完成（warmup 在 2.5s，编译约 0.7s） */
  if (!await waitFor(() => readLog().indexOf('=== 启动') >= 0, 12000)) {
    bad('应用没起来，日志里没有启动行');
    try { app.kill(); } catch (e) {}
    process.exit(1);
  }
  ok('应用已启动 v' + (readLog().match(/=== 启动 v([\d.]+)/) || [, '?'])[1]);
  if (await waitFor(() => readLog().indexOf('[next] 抓取热键已注册 ' + TEST_KEY) >= 0, 5000)) {
    ok('测试热键注册成功（' + TEST_KEY + '，走 CODEATLAS_NEXT_KEY）');
  } else {
    bad('测试热键 ' + TEST_KEY + ' 也注册不上，这台机器上没法验证');
  }
  await sleep(4200);

  /* 靶子窗口抢前台。给它一个诊断文件，好确认「真的拿到前台+焦点+选区」了，
     否则注入落在别人身上，测出来是假的失败。 */
  const DIAG = path.join(OUT, 'target-grab.txt');
  try { fs.unlinkSync(DIAG); } catch (e) {}
  const form = spawnTarget(TARGET_TEXT, 25000, DIAG);
  await waitFor(() => /fg=True/.test(readFile(DIAG)) && /sel=\d+/.test(readFile(DIAG)), 6000);
  if (!/fg=True/.test(readFile(DIAG))) {
    sk('靶子抢前台', '拿不到前台（' + (readFile(DIAG) || '无状态') + '），剪贴板内容断言会跳过');
  }

  /* 模拟人手按一次热键 —— 注意这里**没有**先 Ctrl+C */
  ps('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'' + TEST_SEND + '\')');

  if (!await waitFor(() => grabLines().length > 0, 9000)) {
    bad('热键没触发（日志里没有 [next] 抓取）');
  } else {
    const last = grabLines()[grabLines().length - 1];
    const brief = last.slice(last.indexOf('[next]'));
    ok('一次按键就触发了：' + brief);

    if (/复制=copied/.test(last)) ok('自动复制执行了（复制=copied），用户没按过 Ctrl+C');
    else bad('自动复制没执行', brief);

    if (/前台=self|前台=electron|前台=CodeAtlas/i.test(last)) bad('前台被识别成自己了，自动复制会被跳过', brief);
    else ok('前台识别成外部程序，不会被「自己」保护误拦');

    /* 面板必须不抢焦点，否则下一次热键的前台就变了 */
    const showed = await waitFor(() => /\[hud\] show \(不抢焦点\)/.test(readLog()), 6000);
    if (showed) ok('悬浮窗弹出时没抢焦点');
    else bad('悬浮窗抢了焦点，下一次热键会被自己挡住');

    /* 面板开着之后才允许开始轮询剪贴板（省电，也不做无谓的常驻监听） */
    if (await waitFor(() => /\[clip\] 开始监听剪贴板/.test(readLog()), 4000)) {
      ok('面板打开后启动了剪贴板轮询');
    } else {
      bad('没启动剪贴板轮询');
    }

    /* 内容断言：只有确认靶子拿到前台时才有意义 */
    const clip = ps('Get-Clipboard -Raw');
    if (/CodeAtlasGrabTarget/.test(last)) {
      if (clip.indexOf('CODEATLAS-GRAB-MARKER') >= 0) ok('剪贴板里正是靶子选中的那 3 行');
      else bad('靶子是前台但没复制到内容', JSON.stringify(clip.slice(0, 50)));
      if (/行数=3/.test(last)) ok('面板拿到 3 行');
      else bad('面板拿到的行数不对（期望 3）', brief);
    } else if (clip.indexOf('CODEATLAS-GRAB-MARKER') >= 0) {
      ok('剪贴板里正是靶子选中的那 3 行');
    } else {
      const at = brief.split('前台=')[1] || '';
      sk('剪贴板内容断言', '靶子没抢到前台（这一行是 ' + at.split(' 复制')[0] + '），注入落到别的窗口上了');
    }
  }

  try { form.kill(); } catch (e) {}
  try { app.kill(); } catch (e) {}
  await sleep(800);
  if (exited) ok('应用已退出，没留下孤儿进程');

  console.log('');
  console.log('  结果：' + pass + ' PASS / ' + fail + ' FAIL / ' + skip + ' SKIP');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('自检本身出错：' + (e && e.stack || e));
  process.exit(2);
});
