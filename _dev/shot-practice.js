/* ============================================================
   练习场回归：真跑一次 Electron，注入 _dev/probe-practice.js，
   把里面的断言结果从日志里捞出来打印。
   ------------------------------------------------------------
   为什么不用浏览器/Playwright：
   练习场要靠 app:// 协议和 localStorage 才能跑起来，
   而且这个项目一贯的做法就是「开发目录直接跑 Electron 自截」。
   用法：node _dev/shot-practice.js
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(ROOT, '_dev', '_shots');
const PROBE = fs.readFileSync(path.join(__dirname, 'probe-practice.js'), 'utf8');

/* 给测试进程一个自己的 userData。
   不这么做的话，用户正开着 CodeAtlas 时单实例锁会让新进程直接退出 ——
   表现是「注入脚本没返回结果」，日志一个字都不写，极难查。
   日志路径也跟着 userData 走，所以两边一起换。 */
const DATA = 'D:////WorkBuddy-tmp////codeatlas-check-practice';

function logPath() {
  return path.join(DATA, 'logs', 'main.log');
}

function run(name, js, size) {
  return new Promise(resolve => {
    const env = {};
    Object.keys(process.env).forEach(k => {
      if (/^(ELECTRON|WORKBUDDY)/i.test(k)) return;
      env[k] = process.env[k];
    });
    env.CODEATLAS_SHOT = path.join(OUT, name + '.png');
    env.CODEATLAS_SHOT_JS = js;
    if (size) env.CODEATLAS_SHOT_SIZE = size;

    const before = fs.existsSync(logPath()) ? fs.statSync(logPath()).size : 0;
    const p = spawn(EXE, ['--user-data-dir=' + DATA, '.'], { cwd: ROOT, env, stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 60000);
    p.on('exit', () => {
      clearTimeout(t);
      /* 只看这次新写进去的那段日志 */
      let tail = '';
      try {
        const buf = fs.readFileSync(logPath());
        tail = buf.slice(Math.min(before, buf.length)).toString('utf8');
      } catch (e) {}
      const m = /\[shot\] js => (.*)/.exec(tail);
      let ret = null;
      try { ret = m ? JSON.parse(m[1]) : null; } catch (e) {}
      const shot = fs.existsSync(env.CODEATLAS_SHOT);
      console.log('\n=== ' + name + ' ===');
      if (!ret) {
        const fail = /\[shot\] 失败 (.*)/.exec(tail);
        console.log('注入脚本没返回结果' + (fail ? '：' + fail[1] : '') + '（看日志 ' + logPath() + '）');
        if (!shot) console.log('连截图都没有');
        return resolve(false);
      }
      (ret.ok || []).forEach(x => console.log('  ✓ ' + x));
      (ret.bad || []).forEach(x => console.log('  ✗ ' + x));
      console.log('  —— ' + (ret.pass || 0) + '/' + (ret.total || 0) + ' 通过'
        + (shot ? '，截图 ' + Math.round(fs.statSync(env.CODEATLAS_SHOT).size / 1024) + ' KB' : '，没截图'));
      resolve(!(ret.bad && ret.bad.length));
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const a = await run('practice', PROBE, '1280x820');
  const b = await run('practice-mobile', PROBE, '390x844');
  console.log('\n' + (a && b ? '全部通过' : '有失败项，见上'));
  process.exit(a && b ? 0 : 1);
})();
