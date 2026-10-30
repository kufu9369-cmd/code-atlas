/* 搜索功能的定向截图：用开发目录直接跑 Electron，不必先打包。
   环境变量必须过滤掉 ELECTRON* / WORKBUDDY*，否则 Electron 会被当成纯 Node 跑。 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(ROOT, '_dev', '_shots');

const type = code => `(function(){var q=document.getElementById('q');q.value=${JSON.stringify(code)};`
  + `q.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelectorAll('#listScroll .card').length;})()`;

const CASES = [
  ['q_isis', type('dis isis') + ";CodeAtlas.applyTheme('dark');1"],
  ['q_nbr', type('邻居') + ";CodeAtlas.applyTheme('dark');1"],
  ['q_doc', type('dis isis') + ';setTimeout(function(){var c=document.querySelector("#listScroll .card[data-kind=\\"cmd\\"]");if(c)c.click();},120);1'],
  ['q_empty', type('zzz') + ";CodeAtlas.applyTheme('dark');1"],
  ['q_mac', type('dis mac') + ";CodeAtlas.applyTheme('dark');1"],
  ['q_light', type('dis ospf') + ";CodeAtlas.applyTheme('light');1"]
];

function run(name, js) {
  return new Promise(resolve => {
    const env = {};
    Object.keys(process.env).forEach(k => {
      if (/^(ELECTRON|WORKBUDDY)/i.test(k)) return;
      env[k] = process.env[k];
    });
    env.CODEATLAS_SHOT = path.join(OUT, name + '.png');
    env.CODEATLAS_SHOT_JS = js;
    const p = spawn(EXE, ['.'], { cwd: ROOT, env, stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 30000);
    p.on('exit', () => {
      clearTimeout(t);
      const f = env.CODEATLAS_SHOT;
      const ok = fs.existsSync(f);
      console.log((ok ? 'OK  ' : 'FAIL') + ' ' + name + '  '
        + (ok ? Math.round(fs.statSync(f).size / 1024) + ' KB' : ''));
      resolve(ok);
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [n, js] of CASES) await run(n, js);
})();
