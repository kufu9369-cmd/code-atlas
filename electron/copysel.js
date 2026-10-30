/* ============================================================
   CodeAtlas · 「帮我按一下 Ctrl+C」
   ------------------------------------------------------------
   为什么要这层东西：
   eNSP 的控制台是自绘控件，网络设备模拟器里敲的命令只存在于它自己的
   画布上，Electron 读不到。剪贴板是唯一干净的通道，但每次都要用户
   先 Ctrl+C 再按热键，等于按两次 —— 用户嫌烦是对的。

   这里做的事就是替用户按那一下 Ctrl+C：
   全局热键触发时 eNSP 还在前台，主进程往前台窗口注入 Ctrl+C，
   命令就进了剪贴板，于是「一按就出结果」。

   为什么不用别的办法：
   - 不装原生模块（robotio / ffi 之类）：三端一套代码的项目不想为
     一个按键引入编译产物，换台机器就可能装不上。
   - PowerShell 常驻一个进程干这件事：SendInput/keybd_event 加上
     GetAsyncKeyState 只有 Win32 能问，PowerShell 用 Add-Type 就能调，
     而且进程常驻之后每次只有几十毫秒。

   两个必须处理的坑（不处理就会静默失败）：
   1. 热键是 Ctrl+Alt+Z，回调触发的那一刻 Ctrl 和 Alt 还按着。
      这时直接注入 Ctrl+C，前台看到的是 Ctrl+Alt+C，等于没复制。
      所以注入前必须先等修饰键松开（GetAsyncKeyState 轮询，最多等 1.5s）。
   2. 前台如果本来就是我们自己（用户点了悬浮窗），再注入 Ctrl+C
      会把自己面板里的文字复制走，把用户剪贴板里真正想用的东西冲掉。
      所以前台进程名对得上就直接跳过，退回「只读剪贴板」。

   失败一律降级成「不复制」，由主进程退回原来的行为（直接读剪贴板），
   绝不抛错、绝不挡住面板弹出。
   ============================================================ */

const { spawn } = require('node:child_process');

/* PowerShell 脚本：只做三件事 —— 报前台窗口、等修饰键松开、注入 Ctrl+C。
   全部用 ASCII 写，避免任何编码问题（输出统一转 UTF-8）。 */
const PS_LINES = [
  "$ErrorActionPreference = 'Stop'",
  "try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}",
  "Add-Type -Namespace CaW -Name U -MemberDefinition @'",
  '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, System.UIntPtr dwExtraInfo);',
  '[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);',
  '[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();',
  '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr hWnd, out uint lpdwProcessId);',
  '[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(System.IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);',
  "'@",
  "[Console]::Out.WriteLine('READY')",
  "[Console]::Out.Flush()",
  '$sb = New-Object System.Text.StringBuilder 512',
  'while ($true) {',
  '  $line = [Console]::ReadLine()',
  '  if ($null -eq $line) { break }',
  '  $cmd = $line.Trim()',
  "  if ($cmd -eq '') { continue }",
  "  $status = 'OK'",
  "  $flag = 'd'",
  "  $proc = ''",
  "  $title = ''",
  '  try {',
  '    $h = [CaW.U]::GetForegroundWindow()',
  '    $fpid = 0',
  '    [void][CaW.U]::GetWindowThreadProcessId($h, [ref]$fpid)',
  '    if ($fpid -gt 0) {',
  '      try { $proc = (Get-Process -Id $fpid -ErrorAction Stop).ProcessName } catch {}',
  '    } else { $flag = \'n\' }',
  '    [void]$sb.Clear()',
  '    [void][CaW.U]::GetWindowTextW($h, $sb, 512)',
  '    $title = $sb.ToString()',
  '  } catch {}',
  "  if ($cmd -like 'copy*') {",
  "    $self = ''",
  "    if ($cmd.Length -gt 4) { $self = $cmd.Substring(4) }",
  '    if ($self -ne \'\') {',
  '      foreach ($one in $self.Split(\',\')) {',
  '        if ($one -ne \'\' -and $proc -ne \'\' -and $one.ToLower() -eq $proc.ToLower()) { $flag = \'s\' }',
  '      }',
  '    }',
  "    if ($flag -eq 'd') {",
  '      try {',
  '        $deadline = [Environment]::TickCount + 1500',
  '        $waiting = $true',
  '        while ($waiting -and ([Environment]::TickCount -lt $deadline)) {',
  '          $down = $false',
  '          foreach ($vk in 0x11, 0x12, 0x10, 0x5B, 0x5C) {',
  '            if (([CaW.U]::GetAsyncKeyState($vk) -band 0x8000) -ne 0) { $down = $true }',
  '          }',
  '          if ($down) { Start-Sleep -Milliseconds 12 } else { $waiting = $false }',
  '        }',
  '        Start-Sleep -Milliseconds 20',
  '        [CaW.U]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)',
  '        [CaW.U]::keybd_event(0x43, 0, 0, [UIntPtr]::Zero)',
  '        Start-Sleep -Milliseconds 16',
  '        [CaW.U]::keybd_event(0x43, 0, 2, [UIntPtr]::Zero)',
  '        [CaW.U]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)',
  '        Start-Sleep -Milliseconds 30',
  "      } catch { $status = 'ERR' }",
  '    }',
  '  }',
  "  $clean = ($title -replace '[\\r\\n\\t]', ' ')",
  '  [Console]::Out.WriteLine($status + \'|\' + $flag + \'|\' + $proc + \'|\' + $clean)',
  '  [Console]::Out.Flush()',
  '}'
];

const PS_SCRIPT = PS_LINES.join('\r\n');
const PS_ARGS = [
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
  '-EncodedCommand', Buffer.from(PS_SCRIPT, 'utf16le').toString('base64')
];

const CALL_TIMEOUT = 5000;
const MAX_TRIES = 3;

let child = null;
let starting = null;      // Promise，避免并发 spawn
let warm = false;         // 收到过 READY
let tries = 0;
let buf = '';
let pending = null;       // { resolve, timer }
let disposed = false;

function finish(res) {
  const p = pending;
  pending = null;
  if (!p) return;
  clearTimeout(p.timer);
  p.resolve(res);
}

function kill() {
  warm = false;
  if (child) {
    try { child.stdin.end(); } catch {}
    try { child.kill(); } catch {}
  }
  child = null;
  finish({ ok: false, reason: 'dead', proc: '', title: '' });
}

function onLine(line) {
  if (line === 'READY') { warm = true; return; }
  const i1 = line.indexOf('|');
  const i2 = line.indexOf('|', i1 + 1);
  const i3 = line.indexOf('|', i2 + 1);
  if (i1 < 0 || i2 < 0) return;
  const status = line.slice(0, i1);
  const flag = line.slice(i1 + 1, i2);
  const proc = line.slice(i2 + 1, i3 < 0 ? undefined : i3);
  const title = i3 < 0 ? '' : line.slice(i3 + 1);
  finish({
    ok: status === 'OK',
    skipped: flag === 's',
    noWindow: flag === 'n',
    proc: proc,
    title: title
  });
}

function ensure() {
  if (disposed) return Promise.reject(new Error('disposed'));
  if (warm && child) return Promise.resolve(true);
  if (starting) return starting;
  if (tries >= MAX_TRIES) return Promise.reject(new Error('no helper'));

  tries++;
  starting = new Promise((resolve, reject) => {
    let c;
    try {
      c = spawn('powershell.exe', PS_ARGS, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      starting = null;
      reject(e);
      return;
    }
    child = c;
    buf = '';
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      starting = null;
      if (ok) resolve(true); else reject(new Error('helper failed'));
    };

    c.stdout.setEncoding('utf8');
    c.stdout.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        onLine(line);
      }
      if (warm) done(true);
    });
    /* 助手自己的报错不能变成未捕获异常，只记在内存里 */
    c.stderr.on('data', () => {});
    c.on('error', () => { if (!warm) done(false); kill(); });
    c.on('exit', () => { if (!warm) done(false); kill(); });

    /* Add-Type 要现场编译 P/Invoke 声明，冷启动可能要几百毫秒 */
    setTimeout(() => { if (!warm) done(false); }, 8000);
  });
  return starting;
}

/* 调一次：把命令写进助手 stdin，等一行回应 */
function call(cmd) {
  return ensure().then(() => new Promise((resolve) => {
    if (pending) finish({ ok: false, reason: 'busy', proc: '', title: '' });
    pending = { resolve: resolve, timer: null };
    pending.timer = setTimeout(() => {
      finish({ ok: false, reason: 'timeout', proc: '', title: '' });
      kill();
    }, CALL_TIMEOUT);
    try {
      child.stdin.write(cmd + '\n');
    } catch (e) {
      finish({ ok: false, reason: 'io', proc: '', title: '' });
      kill();
    }
  }));
}

/* 让人在后面先把进程热起来，第一次按热键才不会等 */
function warmup() {
  ensure().catch(() => {});
}

/* 复制前台窗口里选中的内容。
   selfNames：我们自己进程的名字（打包是 CodeAtlas，开发目录是 electron），
   前台是它们时直接跳过，不去动用户的剪贴板。 */
function copySelection(selfNames) {
  const self = (selfNames || []).filter(Boolean).join(',');
  return call(self ? 'copy' + self : 'copy').then((r) => {
    if (!r.ok) return { ok: false, reason: r.reason || 'fail', proc: r.proc || '', title: r.title || '' };
    if (r.skipped) return { ok: false, reason: 'self', proc: r.proc, title: r.title };
    if (r.noWindow) return { ok: false, reason: 'nowindow', proc: r.proc, title: r.title };
    return { ok: true, reason: 'copied', proc: r.proc, title: r.title };
  }).catch(() => ({ ok: false, reason: 'nohelper', proc: '', title: '' }));
}

function foreground() {
  return call('fg').then((r) => {
    if (!r.ok) return { ok: false, proc: '', title: '' };
    return { ok: true, proc: r.proc, title: r.title };
  }).catch(() => ({ ok: false, proc: '', title: '' }));
}

function dispose() {
  disposed = true;
  kill();
}

module.exports = {
  copySelection: copySelection,
  foreground: foreground,
  warmup: warmup,
  dispose: dispose,
  script: PS_SCRIPT
};
