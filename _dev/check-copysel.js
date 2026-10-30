/* ============================================================
   自检：electron/copysel.js —— 「替你按一下 Ctrl+C」那层
   ------------------------------------------------------------
   四条断言，都不需要人去点：
   1) 助手进程能起来，能报出前台窗口
   2) 前台就是我们自己时，绝不动剪贴板（跳过）
   3) 真注入：开一个靶子窗口，选中文字，我们的 Ctrl+C 应该
      把文字送进剪贴板 —— 这是这个功能唯一的核心证据
   4) 连续调用不串行卡死

   第 3 条依赖「靶子能拿到前台 + 拿到焦点 + 真的选中了」。
   Windows 有前台锁定，别的程序（微信之类）可能一直抢着，
   拿不到就标 SKIP 并说明原因 —— 那是环境问题，不是代码问题。
   靶子自己会把状态写到 _shots/target.txt，断言前先看那份状态，
   免得把「靶子没配好」误判成「注入失败」。
   ============================================================ */

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { spawnTarget } = require(path.join(__dirname, 'target-window.js'));

const ROOT = path.join(__dirname, '..');
const copysel = require(path.join(ROOT, 'electron', 'copysel.js'));
const OUT = path.join(__dirname, '_shots');
const DIAG = path.join(OUT, 'target-copysel.txt');
const SELF = [path.basename(process.execPath, '.exe')];

const TARGET_TEXT = [
  'CODEATLAS-TARGET-MARKER',
  '[SW1]interface GigabitEthernet0/0/1',
  '[SW1-GigabitEthernet0/0/1]port link-type trunk'
].join('\r\n');

let pass = 0, fail = 0, skip = 0;
const ok = (n) => { pass++; console.log('  PASS  ' + n); };
const bad = (n, e) => { fail++; console.log('  FAIL  ' + n + (e ? '  → ' + e : '')); };
const sk = (n, why) => { skip++; console.log('  SKIP  ' + n + '  → ' + why); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const readDiag = () => { try { return fs.readFileSync(DIAG, 'utf8'); } catch (e) { return ''; } };

/* 靶子没拿到前台/焦点/选区时，注入落在别人身上是必然的，断言内容没意义 */
function targetReady() {
  const d = readDiag();
  return /fg=True/.test(d) && /focused=True/.test(d) && /sel=(\d+)/.test(d) && Number((d.match(/sel=(\d+)/) || [0, 0])[1]) > 0;
}

(async () => {
  console.log('--- copysel 自检 ---');
  fs.mkdirSync(OUT, { recursive: true });
  console.log('  自己的进程名：' + SELF.join(', '));

  /* 1. 助手能起来，能报前台窗口 */
  const t0 = Date.now();
  const fg = await copysel.foreground();
  if (fg.ok && fg.proc) ok('助手就绪，前台窗口 = ' + fg.proc + '（' + (Date.now() - t0) + 'ms，含冷启动编译）');
  else bad('助手没能报出前台窗口', JSON.stringify(fg));

  /* 2. 前台 == 自己 → 必须跳过，剪贴板一个字都不许动 */
  if (fg.proc) {
    setClip('SENTINEL-DO-NOT-TOUCH');
    await sleep(200);
    const before = ps('Get-Clipboard -Raw');
    const r = await copysel.copySelection([fg.proc]);
    await sleep(200);
    const after = ps('Get-Clipboard -Raw');
    if (r.reason === 'self') ok('前台是自己时正确跳过（reason=self）');
    else bad('前台是自己时没跳过', JSON.stringify(r));
    if (before === after) ok('跳过时剪贴板没被动过');
    else bad('跳过时剪贴板被改了', JSON.stringify(after.slice(0, 40)));
  }

  /* 3. 真注入 */
  setClip('SENTINEL-BEFORE-INJECT');
  try { fs.unlinkSync(DIAG); } catch (e) {}
  const form = spawnTarget(TARGET_TEXT, 25000, DIAG);
  await sleep(3000);

  if (!targetReady()) {
    sk('真实注入 Ctrl+C', '靶子没拿到前台/焦点/选区（' + (readDiag() || '无状态') + '），注入必然落到别的窗口上');
  } else {
    const now = await copysel.foreground();
    if (now.title !== 'CodeAtlasGrabTarget') {
      sk('真实注入 Ctrl+C', '靶子状态正常但当下前台是 ' + (now.proc || '?') + '(' + (now.title || '') + ')，被抢走了');
    } else {
      const r = await copysel.copySelection([]);
      await sleep(350);
      const after = ps('Get-Clipboard -Raw');
      if (r.ok && after.indexOf('CODEATLAS-TARGET-MARKER') >= 0) {
        ok('真实注入成功：靶子里选中的文字进了剪贴板');
        if (after.indexOf('port link-type trunk') >= 0) ok('多行内容完整（含换行）');
        else bad('复制到了但内容不完整', JSON.stringify(after.slice(0, 60)));
      } else {
        bad('注入后剪贴板没拿到靶子的文字', 'reason=' + r.reason + ' proc=' + r.proc + ' clip=' + JSON.stringify(after.slice(0, 40)));
      }
    }
  }
  try { form.kill(); } catch (e) {}

  /* 4. 连续调用 */
  const a = await copysel.foreground();
  const b = await copysel.foreground();
  if (a.ok && b.ok) ok('连续两次调用都正常返回');
  else bad('连续调用失败', JSON.stringify([a.ok, b.ok]));

  copysel.dispose();

  console.log('');
  console.log('  结果：' + pass + ' PASS / ' + fail + ' FAIL / ' + skip + ' SKIP');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('自检本身出错：' + (e && e.stack || e));
  process.exit(2);
});
