/* 悬浮窗 / 窄窗口的截图回归
   用法：node _dev/shot-hud.js
   产出：_dev/_shots/hud_*.png

   注意两个老坑：
   1. 必须过滤 ELECTRON* / WORKBUDDY* 环境变量，否则 electron 会退化成纯 Node；
   2. 必须带 --user-data-dir，否则会和「已安装的那份 CodeAtlas」抢单实例锁，
      表现是进程秒退、截图一张都没有。 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(__dirname, '_shots');
const UD = path.join(OUT, '_ud_hud');

const CASES = [
  /* 普通窗口 1280 宽：确认新加的 #hudShell（display:contents）没有破坏三栏布局 */
  { name: 'hud_wide', size: '1280x800', target: '', js: '' },
  /* 普通窗口缩到很窄：验证窄窗口走移动端单栏布局 */
  { name: 'hud_narrow', size: '430x720', target: '', js: '' },
  /* 悬浮窗：透明卡片 + 顶部拖动条 + 右下角握把 */
  { name: 'hud_card', size: '520x700', target: 'hud', js: '' },
  /* 悬浮窗切到 JavaWeb 专题，确认内容照常渲染 */
  { name: 'hud_javaweb', size: '520x700', target: 'hud', js: 'CodeAtlas.gotoTopic("javaweb");1' },
  /* 最小尺寸：320×240 还能不能用 */
  { name: 'hud_min', size: '330x260', target: 'hud', js: '' },
  /* 探针：把握把/透明度的真实计算值报回来，写进日志里断言 */
  {
    name: 'hud_probe', size: '520x700', target: 'hud',
    js: `(function () {
      var g = document.querySelector('.hud-grip[data-grip="se"]');
      var cs = getComputedStyle(g);
      var shell = document.getElementById('hudShell');
      var bar = document.getElementById('hudBar');
      var r = shell.getBoundingClientRect();
      return {
        win: [innerWidth, innerHeight],
        gripDisplay: cs.display,
        gripCursor: cs.cursor,
        gripZ: cs.zIndex,
        shell: [Math.round(r.width), Math.round(r.height)],
        shellDisplay: getComputedStyle(shell).display,
        barH: Math.round(bar.getBoundingClientRect().height),
        alpha: getComputedStyle(document.documentElement).getPropertyValue('--hud-a').trim()
      };
    })()`
  },
  /* 通过桥把窗口改成 400×520：截图尺寸应该跟着变（证明 setSize 真的到主进程了） */
  {
    name: 'hud_resize', size: '520x700', target: 'hud',
    js: `new Promise(function (res) {
      CodeAtlas.hud.setSize(400, 520);
      setTimeout(function () {
        CodeAtlas.hud.state().then(function (s) { res(s); });
      }, 500);
    })`
  },
  /* 切换两次：可见 → 隐藏 → 可见。返回四次可见状态，应该正好反过来两遍。
     这条是热键真正走的函数，等价于「按一下 Ctrl+Alt+X」。 */
  {
    name: 'hud_toggle', size: '520x700', target: 'hud',
    js: `new Promise(function (res) {
      var out = [];
      window.DESKTOP.hud.state()
        .then(function (s) { out.push(s.visible); return window.DESKTOP.hud.toggle(); })
        .then(function (v) { out.push(v); return window.DESKTOP.hud.toggle(); })
        .then(function (v) { out.push(v); return window.DESKTOP.hud.state(); })
        .then(function (s) { out.push(s.visible); res(out); });
    })`
  },
  /* 72% 不透明度：验证内部面板不再叠不透明底 */
  { name: "hud_72", size: "520x700", target: "hud", js: "CodeAtlas.hud.setAlpha(0.72);1" },
  /* 普通窗口能缩到多小：380×500，还应当是可用的 */
  { name: 'hud_380', size: '380x500', target: '', js: '' }
];

function run(c) {
  return new Promise(resolve => {
    const env = {};
    Object.keys(process.env).forEach(k => {
      if (/^(ELECTRON|WORKBUDDY)/i.test(k)) return;
      env[k] = process.env[k];
    });
    env.CODEATLAS_SHOT = path.join(OUT, c.name + '.png');
    env.CODEATLAS_SHOT_SIZE = c.size;
    if (c.target) env.CODEATLAS_SHOT_TARGET = c.target; else delete env.CODEATLAS_SHOT_TARGET;
    if (c.js) env.CODEATLAS_SHOT_JS = c.js; else delete env.CODEATLAS_SHOT_JS;

    const p = spawn(EXE, ['.', '--user-data-dir=' + UD], { cwd: ROOT, env, stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 30000);
    p.on('exit', () => {
      clearTimeout(t);
      const f = env.CODEATLAS_SHOT;
      const ok = fs.existsSync(f) && fs.statSync(f).size > 5000;
      console.log((ok ? 'OK   ' : 'FAIL ') + c.name
        + (ok ? '  ' + Math.round(fs.statSync(f).size / 1024) + ' KB' : ''));
      resolve();
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const c of CASES) await run(c);
})();
