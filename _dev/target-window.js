/* ============================================================
   测试用「靶子窗口」：一个置顶、已全选的文本框，用来冒充 eNSP 控制台
   ------------------------------------------------------------
   踩过的四个坑，都写在这儿免得下次重踩：

   1. Windows 有前台锁定，后台进程不许 SetForegroundWindow。
      先按 ALT 释放锁定的土办法会把窗口带进「菜单模式」，
      随后的 Ctrl+C 被吞掉，看起来像注入失败。改用
      AttachThreadInput → SetForegroundWindow → SwitchToThisWindow 三级。

   2. **Timer 必须在脚本作用域创建**。写在 $f.Add_Shown({...}) 里的
      Timer 出了 scriptblock 就被回收，tick 永远不执行 ——
      表现是窗口在那儿、但什么都没配好（无前台、无选区）。

   3. SelectAll 要挂到 GotFocus 上。只在计时器里调一次，
      会被随后到达的 WM_SETFOCUS 冲掉（WinForms 拿焦点时会重置选区）。

   4. 这里是 PowerShell 脚本正文，注释只能用 # ——
      写 JS 的块注释会让整个脚本解析失败，窗口根本不出来，
      而外部看起来只是「抢不到前台」。

   真实使用场景不需要这些 —— 用户按热键时 eNSP 本来就在前台。
   ============================================================ */

const { spawn } = require('node:child_process');

function buildScript(text, lifeMs, diagPath) {
  const diag = String(diagPath || '').replace(/'/g, "''");
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -Namespace Fg -Name W -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr hWnd, out uint lpdwProcessId);
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);
[DllImport("user32.dll")] public static extern bool BringWindowToTop(System.IntPtr hWnd);
[DllImport("user32.dll")] public static extern System.IntPtr SetActiveWindow(System.IntPtr hWnd);
[DllImport("user32.dll")] public static extern System.IntPtr SetFocus(System.IntPtr hWnd);
[DllImport("user32.dll")] public static extern void SwitchToThisWindow(System.IntPtr hWnd, bool fAltTab);
'@

# 抢前台三级保险，最后一招是 Alt+Tab 用的同一个 API
function Take-Foreground($form, $ctl) {
  for ($i = 0; $i -lt 16; $i++) {
    try {
      $fg = [Fg.W]::GetForegroundWindow()
      $tp = 0; $fp = 0
      $tid = [Fg.W]::GetWindowThreadProcessId($form.Handle, [ref]$tp)
      $tidFg = 0
      if ($fg -ne [System.IntPtr]::Zero) { $tidFg = [Fg.W]::GetWindowThreadProcessId($fg, [ref]$fp) }
      try {
        if ($tidFg -ne 0) { [void][Fg.W]::AttachThreadInput($tidFg, $tid, $true) }
        [void][Fg.W]::BringWindowToTop($form.Handle)
        [void][Fg.W]::SetForegroundWindow($form.Handle)
        [void][Fg.W]::SetActiveWindow($form.Handle)
        [void][Fg.W]::SetFocus($ctl.Handle)
      } finally {
        if ($tidFg -ne 0) { [void][Fg.W]::AttachThreadInput($tidFg, $tid, $false) }
      }
      if ([Fg.W]::GetForegroundWindow() -eq $form.Handle) { return $true }
    } catch { }
    try { [Fg.W]::SwitchToThisWindow($form.Handle, $false) } catch { }
    Start-Sleep -Milliseconds 140
    try { if ([Fg.W]::GetForegroundWindow() -eq $form.Handle) { return $true } } catch { }
  }
  return $false
}

$f = New-Object System.Windows.Forms.Form
$f.Text = 'CodeAtlasGrabTarget'
$f.Width = 640; $f.Height = 250
$f.StartPosition = 'CenterScreen'
$f.TopMost = $true
$f.ShowInTaskbar = $false

$t = New-Object System.Windows.Forms.TextBox
$t.Multiline = $true
$t.Dock = 'Fill'
$t.Font = New-Object System.Drawing.Font('Consolas', 12)
$t.Text = @'
${text}
'@
$f.Controls.Add($t)
$f.ActiveControl = $t
$t.Add_GotFocus({ $t.SelectAll() })

# Timer 一律在脚本作用域建，别放进 scriptblock。
# 而且是「反复抢」而不是抢一次：机器上前台可能被微信之类抢回去，
# 抢一次的话注入落在别人身上，测出来就是莫名其妙的「没复制到」。
# 抢 8 次（约 5 秒）就停，别长时间霸占用户的前台。
$script:ticks = 0
$grab = New-Object System.Windows.Forms.Timer
$grab.Interval = 600
$grab.Add_Tick({
  $script:ticks++
  if ($script:ticks -ge 8) { $grab.Stop() }
  try { [void](Take-Foreground $f $t) } catch { }
  try { $f.Activate(); $f.ActiveControl = $t } catch { }
  try { $t.SelectAll() } catch { }
  if ('${diag}' -ne '') {
    try {
      $d = 'tick=' + $script:ticks + ' fg=' + ([Fg.W]::GetForegroundWindow() -eq $f.Handle) + ' focused=' + $t.Focused + ' sel=' + $t.SelectionLength + ' len=' + $t.TextLength
      [IO.File]::WriteAllText('${diag}', $d)
    } catch { }
  }
})

$life = New-Object System.Windows.Forms.Timer
$life.Interval = ${Number(lifeMs) || 25000}
$life.Add_Tick({ $life.Stop(); $f.Close() })

$f.Add_Shown({ $grab.Start(); $life.Start() })
[void]$f.ShowDialog()
`;
}

function spawnTarget(text, lifeMs, diagPath) {
  const script = buildScript(text, lifeMs || 25000, diagPath);
  return spawn('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64')],
    { windowsHide: false, stdio: 'ignore' });
}

module.exports = { spawnTarget: spawnTarget, buildScript: buildScript };
