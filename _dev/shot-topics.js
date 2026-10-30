/* 专题改造的定向截图：用开发目录直接跑 Electron，不必先打包。
   环境变量必须过滤掉 ELECTRON* / WORKBUDDY*，否则 Electron 会被当成纯 Node 跑。 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(ROOT, '_dev', '_shots');

const CASES = [
  ['t_net', 'CodeAtlas.gotoView("cat", "ensp"); 1'],
  ['t_javaweb', 'CodeAtlas.gotoSnippet("jw-servlet-anno"); 1'],
  ['t_session', 'CodeAtlas.gotoSnippet("jw-session-login"); 1'],
  ['t_web', 'CodeAtlas.gotoSnippet("web-float"); 1'],
  ['t_js', 'CodeAtlas.gotoSnippet("web-regex-form"); 1'],
  ['t_lab_web', 'CodeAtlas.gotoLab("lab-web-tab"); 1'],
  ['t_preset_jw', 'CodeAtlas.gotoPreset("pre-jw-login"); 1'],
  ['t_tool', 'CodeAtlas.gotoView("cat", "git"); 1'],
  ['t_light', 'CodeAtlas.applyTheme("light", true); CodeAtlas.gotoSnippet("jw-jdbc-six"); 1'],
  ['t_search', 'var q=document.getElementById("q"); q.value="getParameter"; q.dispatchEvent(new Event("input",{bubbles:true})); 1'],
  ['t_search2', 'var q=document.getElementById("q"); q.value="清除浮动"; q.dispatchEvent(new Event("input",{bubbles:true})); 1']
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
    /* 已安装的 CodeAtlas 可能正开着，它持有单实例锁，会让开发目录的实例立刻退出。
       换一个 userData 目录就互不干扰（反正截图也不需要读用户的配置）。 */
    const p = spawn(EXE, ['.', '--user-data-dir=' + path.join(OUT, '_ud')], { cwd: ROOT, env, stdio: 'ignore' });
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
