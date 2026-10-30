/* 「下一步」面板的截图回归
   用法：node _dev/shot-next.js
   产出：_dev/_shots/next_*.png

   老坑照旧：
   1. 过滤 ELECTRON* / WORKBUDDY*（否则 electron 退化成纯 Node，秒退）；
   2. 带 --user-data-dir（否则和已安装的 CodeAtlas 抢单实例锁）。

   注入方式：CodeAtlas.next.set(文本) 直接走 openPane → 渲染，
   不经过剪贴板（截图不该依赖用户剪贴板里的内容）。 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* 默认用开发目录的 electron 跑源码；设了 CODEATLAS_EXE 就跑打包成品，
   用来验证 asar 里 nextstep.js / hudnext.js / 剧本分片都在。 */
const PKG = process.env.CODEATLAS_EXE
  ? path.resolve(ROOT, process.env.CODEATLAS_EXE)
  : '';
const EXE = PKG || path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(__dirname, '_shots');
const UD = path.join(OUT, PKG ? '_ud_next_pkg' : '_ud_next');

/* 真实场景一：配到互联口，不知道该配 trunk 还是 access */
const SCENE_TRUNK = [
  '[SW1-GigabitEthernet0/0/1]port link-type access',
  '[SW1-GigabitEthernet0/0/1]port default vlan 10',
  '[SW1-GigabitEthernet0/0/1]quit',
  '[SW1]interface GigabitEthernet0/0/2',
  '[SW1-GigabitEthernet0/0/2]port link-type access',
  '[SW1-GigabitEthernet0/0/2]port default vlan 20',
  '[SW1-GigabitEthernet0/0/2]quit',
  '[SW1]interface GigabitEthernet0/0/24'
].join('\n');

/* 真实场景二：单臂路由，卡在 arp broadcast enable（第一大坑） */
const SCENE_ARM = [
  '<Huawei>system-view',
  'Enter system view, return user view with Ctrl+Z.',
  '[Huawei]sysname AR1',
  '[AR1]interface GigabitEthernet0/0/0.10',
  '[AR1-GigabitEthernet0/0/0.10]dot1q termination vid 10',
  '[AR1-GigabitEthernet0/0/0.10]ip address 192.168.10.1 24'
].join('\n');

/* 真实场景三：一股脑粘了带时间戳日志和报错的回显 */
const SCENE_NOISY = [
  '<Huawei>system-view',
  'Enter system view, return user view with Ctrl+Z.',
  '[Huawei]ospf 1 router-id 1.1.1.1',
  'Oct 30 2026 20:15:02-08:00 AR1 %%01OSPF/4/CONFLICT(a)[7]: Router ID conflict.',
  '[AR1-ospf-1]area 0',
  '[AR1-ospf-1-area-0.0.0.0]network 10.0.0.0 0.0.0.255',
  '[AR1-ospf-1-area-0.0.0.0]network 192.168.10.0 255.255.255.0',
  '                                    ^',
  'Error: Wrong parameter found at ^ position.'
].join('\n');

/* 注入脚本。
   必须返回 Promise 并在 resolve 前等一会儿：
   全新 user-data-dir 的第一次启动里，页面有可能在 did-finish-load 之后
   又被重载一次，同步注入的状态会被冲掉，截图就拍到没开面板的首页。
   等一下再 resolve，等于让「稳定下来」成为截图的前提。 */
function setJs(text) {
  return 'CodeAtlas.next.set(' + JSON.stringify(text) + ');'
    + 'new Promise(function (res) { setTimeout(function () { res(1); }, 900); })';
}

const CASES = [
  /* 主场景：VLAN 配到互联口 */
  { name: 'next_trunk', size: '520x700', js: setJs(SCENE_TRUNK) },
  /* 单臂路由 */
  { name: 'next_arm', size: '520x700', js: setJs(SCENE_ARM) },
  /* 带噪音的回显：日志、报错、^ 都应该被滤掉 */
  { name: 'next_noisy', size: '520x700', js: setJs(SCENE_NOISY) },
  /* 极窄：320 宽还能不能看 */
  { name: 'next_min', size: '330x300', js: setJs(SCENE_TRUNK) },
  /* 空状态：给第一次用的人看的引导 */
  {
    name: 'next_empty', size: '520x700',
    js: 'CodeAtlas.next.open("");'
      + 'new Promise(function (res) { setTimeout(function () { res(1); }, 900); })'
  },
  /* 没匹配上：命令词典兜底 */
  { name: 'next_none', size: '520x700', js: setJs('hello world\n随便一些中文\n998877') },
  /* 展开整段配置 */
  {
    name: 'next_all', size: '520x700',
    js: 'CodeAtlas.next.set(' + JSON.stringify(SCENE_TRUNK) + ');'
      + 'setTimeout(function(){var d=document.querySelector(".nx-all");if(d)d.open=true;},120);'
      + 'new Promise(function (res) { setTimeout(function () { res(1); }, 900); })'
  },
  /* 探针：把渲染结果读回来做断言，不只看图 */
  {
    name: 'next_probe', size: '520x700',
    js: `(function () {
      CodeAtlas.next.set(${JSON.stringify(SCENE_TRUNK)});
      var r = CodeAtlas.next.result();
      var el = document.querySelector('.nx-cmd');
      var body = document.getElementById('nxBody');
      return {
        open: CodeAtlas.next.isOpen(),
        ok: r && r.ok,
        recipe: r && r.recipe ? r.recipe.id : '',
        cmd: el ? el.textContent.trim() : '',
        next3: r && r.next ? r.next.map(function (s) { return s.c; }) : [],
        parts: r && r.parts ? r.parts.length : 0,
        steps: r ? r.total : 0,
        idx: r ? r.idx : -1,
        lib: CodeAtlas.next.lib().length,
        canScroll: body.scrollHeight > body.clientHeight,
        appHidden: getComputedStyle(document.getElementById('app')).display === 'none'
      };
    })()`
  },
  /* 探针二：噪音回显到底认出了几条命令 */
  {
    name: 'next_probe2', size: '520x700',
    js: `(function () {
      CodeAtlas.next.set(${JSON.stringify(SCENE_NOISY)});
      var r = CodeAtlas.next.result();
      return {
        cmds: r.cmds,
        dropped: r.dropped,
        recipe: r.recipe ? r.recipe.id : '',
        cmd: r.next.length ? r.next[0].c : ''
      };
    })()`
  },
  /* 探针三：候选剧本切换 */
  {
    name: 'next_probe3', size: '520x700',
    js: `(function () {
      CodeAtlas.next.set('port link-type trunk');
      var a = CodeAtlas.next.result();
      var alts = a.alt.map(function (x) { return x.id; });
      var picked = CodeAtlas.next.pick('rec-single-arm');
      return {
        first: a.recipe ? a.recipe.id : '',
        alts: alts,
        picked: picked ? picked.recipe.id : '',
        pickedNext: picked && picked.next.length ? picked.next[0].c : '',
        whole: picked ? !!picked.whole : false
      };
    })()`
  }
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
    env.CODEATLAS_SHOT_TARGET = 'hud';
    env.CODEATLAS_SHOT_JS = c.js;

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
  try { fs.rmSync(UD, { recursive: true, force: true }); } catch (e) {}
  for (const c of CASES) await run(c);
})();
