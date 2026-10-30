/* ============================================================
   验证「已安装的那份」CodeAtlas（D:\CodeAtlas）
   ------------------------------------------------------------
   为什么要单独验：我们平时在开发目录跑源码，装好的那份跑的是 asar。
   覆盖 asar 之后如果 preload / 新分片没进包、或者用户数据里有冲突，
   开发目录一切正常但用户双击打开是坏的 —— 这个脚本就是查这个的。

   它跑在用户真实的 %APPDATA%\CodeAtlas 上（不加 --user-data-dir），
   所以能验出「和旧数据一起用」时的真实表现。

   用法：node _dev/verify-installed.js
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXE = process.env.CODEATLAS_INSTALLED || 'D:/CodeAtlas/CodeAtlas.exe';
const OUT = path.join(__dirname, '_shots');
const PNG = path.join(OUT, 'installed_verify.png');

/* 用模板字符串写注入脚本，别在 shell 里拼引号 —— 上一版就是
   因为 bash/node 双层转义把 \" 原样灌进去，报「Script failed to execute」，
   看起来像功能坏了，其实是探针自己语法错。 */
const PROBE = `
new Promise(function (res) {
  setTimeout(function () {
    var CA = window.CodeAtlas;
    var out = {};
    try {
      out = {
        ca: typeof CA,
        next: CA ? typeof CA.next : 'n/a',
        hud: CA ? typeof CA.hud : 'n/a',
        NEXT: typeof window.NEXT,
        bridge: !!window.DESKTOP,
        clip: !!(window.DESKTOP && window.DESKTOP.clip),
        dataHud: document.documentElement.getAttribute('data-hud'),
        hasPane: !!document.getElementById('nextPane'),
        scripts: Array.prototype.map.call(document.scripts, function (s) {
          return String(s.src || '').split('/').pop();
        }).join('|'),
        cats: (CA && CA.D && CA.D.categories) ? CA.D.categories.length : -1,
        recipes: (CA && CA.D && CA.D.recipes) ? CA.D.recipes.length : -1,
        ver: (function () {
          var v = document.querySelector('.rail-ver');
          return v ? v.textContent.trim() : '';
        })()
      };
      if (CA && CA.next) {
        CA.next.set('[SW1-GigabitEthernet0/0/1]port link-type access\\n'
          + '[SW1-GigabitEthernet0/0/1]port default vlan 10\\n'
          + '[SW1]interface GigabitEthernet0/0/24');
        var r = CA.next.result();
        out.matchOk = !!r.ok;
        out.recipe = r.recipe ? r.recipe.id : '';
        out.cmd = r.next.length ? r.next[0].c : '';
        out.lib = CA.next.lib().length;
      }
    } catch (e) { out.err = String(e && e.message || e); }
    res(out);
  }, 1500);
})`;

const env = {};
Object.keys(process.env).forEach(k => {
  if (/^(ELECTRON|WORKBUDDY)/i.test(k)) return;   // 不滤掉会退化成纯 Node，秒退
  env[k] = process.env[k];
});
env.CODEATLAS_SHOT = PNG;
env.CODEATLAS_SHOT_SIZE = '520x700';
env.CODEATLAS_SHOT_TARGET = 'hud';
env.CODEATLAS_SHOT_JS = PROBE;

fs.mkdirSync(OUT, { recursive: true });
try { fs.unlinkSync(PNG); } catch (e) {}

const p = spawn(EXE, [], { env, stdio: 'ignore' });
const timer = setTimeout(() => { try { p.kill(); } catch (e) {} }, 35000);

p.on('exit', () => {
  clearTimeout(timer);
  const log = path.join(process.env.APPDATA || '', 'CodeAtlas', 'logs', 'main.log');
  let line = '', boot = '';
  try {
    const txt = fs.readFileSync(log, 'utf8').split('\n').reverse();
    for (const l of txt) {
      if (!line && l.indexOf('[shot] js =>') >= 0) line = l;
      if (!boot && l.indexOf('=== 启动 v') >= 0) boot = l;
      if (line && boot) break;
    }
  } catch (e) { /* 日志读不到就只看截图 */ }

  console.log('--- 已安装副本 ---');
  console.log(boot.trim() || '(没读到启动日志)');
  console.log(line.trim() || '(没读到探针输出)');
  console.log('截图：' + (fs.existsSync(PNG)
    ? Math.round(fs.statSync(PNG).size / 1024) + ' KB'
    : '无（注入失败，见上面日志）'));

  if (!line) process.exitCode = 1;
});
