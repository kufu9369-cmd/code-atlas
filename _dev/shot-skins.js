/* ============================================================
   shot-skins.js —— 皮肤包截图回归

   用法：node _dev/shot-skins.js
   产出：_dev/_shots/skin_*.png

   跑完这个还不足以说明「透明没问题」，接着跑
   `node _dev/check-hud-alpha.py 的等价物`（见 _dev/check-hud-alpha.py）
   去读 PNG 的 alpha 通道 —— 肉眼看一张深色卡片是看不出它到底透明没透明的。

   两个老坑照旧：
   1. 必须过滤 ELECTRON* / WORKBUDDY*，否则 electron 退化成纯 Node；
   2. 必须带 --user-data-dir，否则和已安装的那份抢单实例锁，进程秒退。
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(__dirname, '_shots');
const UD = path.join(OUT, '_ud_skin');

/* 皮肤名单直接从 skins.js 里抠，别在这里再抄一份 ——
   加一套皮肤忘了改这个数组，截图回归就会静默漏掉那一套。 */
const SKIN_IDS = (fs.readFileSync(path.join(ROOT, 'assets/skins.js'), 'utf8')
  .match(/id: '([a-z]+)', name:/g) || []).map(s => s.replace(/^id: '|', name:$/g, ''));

/* 注入脚本：先按用例切皮肤，再等一小会儿让样式落定 */
function setSkin(id) {
  return `new Promise(function (res) {
    window.SKINS.apply(${JSON.stringify(id)}, true);
    setTimeout(function () {
      var cs = getComputedStyle(document.documentElement);
      res({
        skin: document.documentElement.getAttribute('data-skin'),
        theme: document.documentElement.getAttribute('data-theme'),
        bg: cs.getPropertyValue('--bg').trim(),
        hud: cs.getPropertyValue('--hud-rgb').trim(),
        cards: document.querySelectorAll('.rail-btn').length
      });
    }, 500);
  })`;
}

const CASES = [
  ...SKIN_IDS.map(id => ({
    name: 'skin_' + id, size: '1440x900', target: '', js: setSkin(id)
  })),
  /* 皮肤面板本身长什么样 */
  {
    name: 'skin_panel', size: '1440x900', target: '',
    js: `new Promise(function (res) {
      window.SKINS.apply('midnight', true);
      document.querySelector('[data-skin-open]').click();
      setTimeout(function () {
        res({
          open: document.getElementById('skinDlg').classList.contains('on'),
          cards: document.querySelectorAll('.sk-card').length,
          active: (document.querySelector('.sk-card[data-active="1"]') || {}).dataset
        });
      }, 500);
    })`
  },
  /* 点面板里的第 6 张卡（墨玉）：验证「点一下真的换了」而不是只有样式表里写了。
     不符合就把注入脚本抛错 —— executeJavaScript 抛错会让截图不生成，
     外面那个 run() 自然报 FAIL，不用再单独传断言结果回来。 */
  {
    name: 'skin_switch', size: '1440x900', target: '',
    js: `new Promise(function (res) {
      window.SKINS.apply('midnight', true);
      CodeAtlas.openSkins();
      setTimeout(function () {
        document.querySelectorAll('.sk-card')[5].click();
        setTimeout(function () {
          var after = document.documentElement.getAttribute('data-skin');
          var act = document.querySelector('.sk-card[data-active="1"]');
          var ls = localStorage.getItem('codeatlas.skin.v1');
          var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
          if (after !== 'jade') throw new Error('点第 6 张卡后 data-skin=' + after + '，应为 jade');
          if (!act || act.dataset.skin !== 'jade') throw new Error('面板里的选中态没跟着走');
          if (ls !== 'jade') throw new Error('localStorage 没写入，重开就丢：' + ls);
          if (bg.toLowerCase() !== '#0e1512') throw new Error('--bg 没变：' + bg);
          res({ after: after, active: act.dataset.skin, ls: ls, bg: bg });
        }, 400);
      }, 400);
    })`
  },
  /* 上个用例把皮肤存成了 jade，这是个全新进程：应该直接是 jade（而不是闪回默认） */
  {
    name: 'skin_persist', size: '1000x700', target: '',
    js: `new Promise(function (res) {
      var got = document.documentElement.getAttribute('data-skin');
      if (got !== 'jade') throw new Error('重开后皮肤是 ' + got + '，说明没持久化');
      res({ skin: got });
    })`
  },
  /* 悬浮窗：深色皮肤 + 浅色皮肤各一张，验「卡片换色但四角仍透明」 */
  { name: 'skin_hud_nord', size: '520x700', target: 'hud', js: setSkin('nord') },
  { name: 'skin_hud_jade', size: '520x700', target: 'hud', js: setSkin('jade') },
  { name: 'skin_hud_sepia', size: '520x700', target: 'hud', js: setSkin('sepia') },
  {
    name: 'skin_hud_min', size: '340x300', target: 'hud', js: setSkin('terminal')
  }
];

function run(c) {
  return new Promise(resolve => {
    const env = {};
    Object.keys(process.env).forEach(k => {
      if (/^(ELECTRON|WORKBUDDY)/i.test(k)) return;
      env[k] = process.env[k];
    });
    const file = path.join(OUT, c.name + '.png');
    try { fs.unlinkSync(file); } catch (e) {}
    env.CODEATLAS_SHOT = file;
    env.CODEATLAS_SHOT_SIZE = c.size;
    if (c.target) env.CODEATLAS_SHOT_TARGET = c.target; else delete env.CODEATLAS_SHOT_TARGET;
    if (c.js) env.CODEATLAS_SHOT_JS = c.js; else delete env.CODEATLAS_SHOT_JS;

    const p = spawn(EXE, ['.', '--user-data-dir=' + UD], { cwd: ROOT, env, stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 30000);
    p.on('exit', () => {
      clearTimeout(t);
      const ok = fs.existsSync(file) && fs.statSync(file).size > 5000;
      console.log((ok ? 'OK   ' : 'FAIL ') + c.name
        + (ok ? '  ' + Math.round(fs.statSync(file).size / 1024) + ' KB' : '  （没生成）'));
      resolve(ok);
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let bad = 0;
  for (const c of CASES) { if (!await run(c)) bad++; }
  console.log('\n' + (bad ? '✗ ' + bad + ' 张失败' : '✓ ' + CASES.length + ' 张全部生成'));
  process.exit(bad ? 1 : 0);
})();
