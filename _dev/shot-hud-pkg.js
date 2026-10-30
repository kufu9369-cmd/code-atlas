/* 对打包成品做悬浮窗/窄窗口回归：node _dev/shot-hud-pkg.js
   跟 shot-hud.js 的区别只有一个：跑的是 dist/win-unpacked 里的 exe，
   用来验证 asar 里的 preload.js、hud.js、build/icon.png 都真的进了包。 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'dist', 'win-unpacked', 'CodeAtlas.exe');
const OUT = path.join(__dirname, '_shots');
const UD = path.join(OUT, '_ud_pkg');

/* 探针：把「桥是否可用 / 握把是否可见 / 版本号」原样报回来 */
const PROBE = `(function () {
  var D = window.DESKTOP;
  var g = document.querySelector('.hud-grip[data-grip="se"]');
  var shell = document.getElementById('hudShell');
  var ver = document.querySelector('.rail-ver');
  return {
    bridge: !!D,
    shellKind: D ? D.shell : null,
    grip: g ? getComputedStyle(g).display + '/' + getComputedStyle(g).cursor : 'missing',
    shellDisplay: getComputedStyle(shell).display,
    alpha: getComputedStyle(document.documentElement).getPropertyValue('--hud-a').trim(),
    ver: ver ? ver.textContent.trim() : ''
  };
})()`;

/* 尺寸探针：改到 400×520，再把主进程真实 bounds 要回来 */
const RESIZE = `new Promise(function (res) {
  if (!window.DESKTOP) { res('no-bridge'); return; }
  CodeAtlas.hud.setSize(400, 520);
  setTimeout(function () { CodeAtlas.hud.state().then(res); }, 500);
})`;

const CASES = [
  { name: 'pkg_hud', size: '520x700', target: 'hud', js: '' },
  { name: 'pkg_hud_jw', size: '520x700', target: 'hud', js: 'CodeAtlas.gotoTopic("javaweb");1' },
  { name: 'pkg_narrow', size: '430x700', target: '', js: '' },
  { name: 'pkg_wide', size: '1280x800', target: '', js: '' },
  { name: 'pkg_probe', size: '520x700', target: 'hud', js: PROBE },
  { name: 'pkg_resize', size: '520x700', target: 'hud', js: RESIZE }
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

    const p = spawn(EXE, ['--user-data-dir=' + UD], { env, stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 30000);
    p.on('exit', () => {
      clearTimeout(t);
      const f = env.CODEATLAS_SHOT;
      const ok = fs.existsSync(f) && fs.statSync(f).size > 5000;
      console.log((ok ? 'OK   ' : 'FAIL ') + c.name);
      resolve();
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const c of CASES) await run(c);
})();
