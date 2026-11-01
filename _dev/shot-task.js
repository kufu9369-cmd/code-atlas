/* 任务闭环回归：渲染、参数同步、进度、按设备复制、收藏详情、剧本搜索。
   用法：node _dev/shot-task.js
   结果既看截图，也读取主进程日志里的 [shot] js 返回值做断言。 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXE = process.env.CODEATLAS_EXE
  ? path.resolve(ROOT, process.env.CODEATLAS_EXE)
  : path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(__dirname, '_shots');
const UD = path.join(OUT, '_ud_task_' + Date.now());

const CASES = [
  {
    name: 'task_render', size: '1440x1100',
    js: `(function(){
      CodeAtlas.gotoPreset('preset-l3-office');
      return {
        title: (document.querySelector('.detail.task .title') || {}).textContent || '',
        env: document.querySelectorAll('.task-env .own-chip').length,
        devices: document.querySelectorAll('.task-dev').length,
        steps: document.querySelectorAll('.task-step').length,
        verify: document.querySelectorAll('.task-verify .vitem').length,
        progress: (document.querySelector('.task-prog-top') || {}).textContent || '',
        hasCode: !!document.querySelector('.task-step .code'),
        /* 角标必须 user-select:none，否则鼠标拖选代码会把「自主」复制进剪贴板 */
        ownSelect: (function(){
          var o = document.querySelector('.task-step .code .own');
          return o ? (getComputedStyle(o).userSelect || getComputedStyle(o).webkitUserSelect || '') : 'none';
        })()
      };
    })()`,
    expect: r => [
      ['标题对上', /小型办公网/.test(r.title)],
      ['10 个参数', r.env === 10],
      ['3 台设备', r.devices === 3],
      ['12 个步骤', r.steps === 12],
      ['5 项验证', r.verify === 5],
      ['代码块渲染出来', r.hasCode === true],
      ['初始进度 0 / 12', /^0 \/ 12/.test(r.progress)],
      ['「自主」角标不进选区', r.ownSelect === 'none']
    ]
  },
  {
    name: 'task_env_progress', size: '1440x1100',
    js: `(function(){
      CodeAtlas.gotoPreset('preset-l3-office');
      return new Promise(function(res){
        setTimeout(function(){
          var chip = document.querySelector('.task-env .own-chip[data-v="vlanId"]');
          if (chip) chip.click();
          var input = document.querySelector('#popover .pop-input');
          if (input) {
            input.value = '30';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          var close = document.querySelector('#popover [data-act="closepop"]');
          if (close) close.click();
          var check = document.querySelector('[data-task-step="0"]');
          if (check) check.click();
            setTimeout(function(){
            var first = document.querySelector('.task-step .code');
            res({
              env: (document.querySelector('.task-env .own-chip[data-v="vlanId"] .val') || {}).textContent || '',
              /* 角标「自主」是装饰 span，textContent 会带上它，比对前先剥掉 */
              codeHasVlan30: !!first && /vlan batch 30|vlan 30/.test(
                first.textContent.replace(/自主/g, '')),
              firstCode: first ? first.textContent.trim().slice(0, 80) : '',
              done: !!(CodeAtlas.taskState('preset-l3-office').done || {})[0],
              progress: (document.querySelector('.task-prog-top') || {}).textContent || '',
              saved: localStorage.getItem('codeatlas.task.v1') || ''
            });
          }, 350);
        }, 250);
      });
    })()`,
    expect: r => [
      ['参数改成 30 生效', r.env === '30'],
      ['代码里的 VLAN 跟着变 30', r.codeHasVlan30 === true],
      ['第 1 步勾上了', r.done === true],
      ['进度 1 / 12', /^1 \/ 12/.test(r.progress)],
      ['进度写进了 localStorage', /"0":true/.test(r.saved)]
    ]
  },
  {
    name: 'task_copy_device', size: '1440x900',
    js: `(function(){
      CodeAtlas.gotoPreset('preset-l3-office');
      return new Promise(function(res){
        setTimeout(function(){
          var btn = document.querySelector('[data-act="taskcopy"][data-who="SW1"]');
          if (btn) btn.click();
          setTimeout(function(){
            Promise.resolve(window.DESKTOP.clip.read()).then(function(t){
              t = String(t || '');
              res({
                hasHash: t.indexOf('#') >= 0,
                hasOwn: /自主/.test(t),
                hasSw1: /sysname SW1/.test(t),
                hasAr1: /sysname AR1/.test(t),
                lines: t.split('\\n').length
              });
            }).catch(function(e){ res({ error: String(e) }); });
          }, 350);
        }, 250);
      });
    })()`,
    expect: r => [
      ['没报错', !r.error],
      ['没混进 # 注释行', r.hasHash === false],
      ['没混进「自主」角标', r.hasOwn === false],
      ['只有 SW1 的命令', r.hasSw1 === true && r.hasAr1 === false],
      ['内容不是空的', r.lines >= 10]
    ]
  },
  {
    name: 'task_export', size: '1440x900',
    js: `(function(){
      CodeAtlas.gotoPreset('preset-l3-office');
      return new Promise(function(res){
        setTimeout(function(){
          var pv = CodeAtlas.cfgPreview('SW1');
          var all = CodeAtlas.cfgPreview('');
          res({
            name: pv ? pv.name : '',
            hasSysview: pv ? pv.text.indexOf('system-view') >= 0 : true,
            hasAr1: pv ? /sysname AR1/.test(pv.text) : true,
            hasSw1: pv ? /sysname SW1/.test(pv.text) : false,
            hasVar: pv ? pv.text.indexOf('{{') >= 0 : true,
            hasOwn: pv ? pv.text.indexOf('自主') >= 0 : true,
            lines: pv ? pv.text.trim().split('\\n').length : 0,
            allName: all ? all.name : '',
            allHasAr1: all ? /sysname AR1/.test(all.text) : false,
            btnDev: document.querySelectorAll('[data-act="cfgexport"][data-who]').length
          });
        }, 220);
      });
    })()`,
    expect: r => [
      ['文件名带设备', /-SW1\.cfg$/.test(r.name)],
      ['导出不含 system-view（加载时会自己进）', r.hasSysview === false],
      ['只含 SW1 的命令', r.hasSw1 === true && r.hasAr1 === false],
      ['没有漏替换的变量', r.hasVar === false],
      ['不带「自主」角标文字', r.hasOwn === false],
      ['内容不是空的', r.lines >= 10],
      ['3 台设备各有导出按钮', r.btnDev === 3],
      ['整份预览含所有设备', r.allHasAr1 === true && /\.cfg$/.test(r.allName)]
    ]
  },
  {
    name: 'recent_view', size: '1440x900',
    js: `(function(){
      CodeAtlas.gotoSnippet('vlan-create');
      CodeAtlas.gotoPreset('preset-l3-office');
      CodeAtlas.gotoLab('lab-port-isolate');
      var list = CodeAtlas.recent.slice();
      CodeAtlas.gotoView('recent');
      return new Promise(function(res){
        setTimeout(function(){
          var cards = document.querySelectorAll('#listScroll .card');
          var rail = document.querySelector('[data-nav="recent"]');
          var foot = document.getElementById('lpFoot');
          res({
            count: list.length,
            first: list[0] || '',
            order: list.join(','),
            cards: cards.length,
            railOn: !!rail && rail.classList.contains('on'),
            foot: foot ? foot.textContent.trim().slice(0, 12) : '',
            /* 最近视图里点开一条，应该留在这个视图里，不跳回分类 */
            stayAfterOpen: (function(){
              if (!cards.length) return false;
              cards[0].click();
              return CodeAtlas.S.view === 'recent';
            })()
          });
        }, 200);
      });
    })()`,
    expect: r => [
      ['记下 3 条', r.count === 3],
      ['最近打开排在最前', r.first === 'lab:lab-port-isolate'],
      ['顺序是后进先出', r.order === 'lab:lab-port-isolate,preset:preset-l3-office,snippet:vlan-create'],
      ['列表渲染出 3 张卡', r.cards === 3],
      ['左轨「最近」高亮', r.railOn === true],
      ['页脚显示最近条数', /最近 3/.test(r.foot)],
      ['点开后仍留在最近视图', r.stayAfterOpen === true]
    ]
  },
  {
    name: 'pack_source', size: '1440x900',
    js: `(function(){
      var pack = {
        id: 'probe-src', name: '探针来源包', version: '9.1',
        categories: [{ id: 'ensp', name: '华为 eNSP', items: [
          { id: 'probe-src-snip', title: '探针片段（导入的）', desc: '只用来验证来源标记',
            tags: ['探针'], code: 'display clock', vars: {} }
        ] }]
      };
      var n = window.PACKS.normalize(JSON.stringify(pack));
      if (!n || n.errors.length) return { error: (n && n.errors || []).join(' / ') || 'normalize 失败' };
      window.PACKS.install(n.pack);
      window.PACKS.apply(window.CODEATLAS, n.pack);
      /* 搜出来看：列表一屏几十条，截图里定位不到，搜索能把它顶到第一条 */
      var q = document.getElementById('q');
      q.value = '探针片段';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      return new Promise(function(res){
        setTimeout(function(){
          var imported = document.querySelector('.card[data-id="probe-src-snip"]');
          var builtin = document.querySelector('.card[data-id="vlan-create"]');
          var src = window.PACKS.sources();
          res({
            card: !!imported,
            badge: imported ? !!imported.querySelector('.card-src') : false,
            badgeText: imported && imported.querySelector('.card-src')
              ? imported.querySelector('.card-src').textContent : '',
            badgeTitle: imported && imported.querySelector('.card-src')
              ? imported.querySelector('.card-src').title : '',
            builtinBadge: builtin ? !!builtin.querySelector('.card-src') : null,
            mapHas: !!src['snippet:probe-src-snip'],
            mapPack: (src['snippet:probe-src-snip'] || {}).pack || '',
            mapBuiltin: !!src['snippet:vlan-create'],
            builtinCard: !!builtin
          });
        }, 220);
      });
    })()`,
    expect: r => [
      ['导入的片段出现在列表里', r.card === true && !r.error],
      ['卡片上有「导入」标记', r.badge === true && r.badgeText === '导入'],
      ['悬停能看到包名与版本', /探针来源包/.test(r.badgeTitle) && /9\.1/.test(r.badgeTitle)],
      ['搜索到导入的条目', r.card === true],
      ['内置内容不标记', r.builtinBadge === false || r.builtinCard === false],
      ['来源映射里有这条', r.mapHas === true && r.mapPack === '探针来源包'],
      ['内置内容不在来源映射里', r.mapBuiltin === false]
    ]
  },
  {
    name: 'task_fav_search', size: '1440x900',
    js: `(function(){
      CodeAtlas.gotoSnippet('vlan-create');
      CodeAtlas.toggleFav('snippet:vlan-create');
      CodeAtlas.S.view = 'fav';
      CodeAtlas.S.favKind = 'snippet';
      CodeAtlas.S.sel.cat = 'vlan-create';
      var favText = CodeAtlas.currentText();
      CodeAtlas.gotoView('cat', 'ensp');
      var q = document.getElementById('q');
      q.value = 'OSPF 单区域';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      var recipeCard = document.querySelector('.card[data-kind="recipe"]');
      if (recipeCard) recipeCard.click();
      return {
        favCopy: favText.length > 20,
        recipeCard: !!recipeCard,
        docsOpen: document.body.classList.contains('docs-open'),
        docsTitle: (document.querySelector('#docsPanel h2') || {}).textContent || ''
      };
    })()`,
    expect: r => [
      ['收藏里能取到可复制正文', r.favCopy === true],
      ['搜得到剧本卡片', r.recipeCard === true],
      ['点开剧本有文档面板', r.docsOpen === true],
      ['文档标题是那个剧本', /OSPF/.test(r.docsTitle)]
    ]
  },
  {
    /* 无标题栏 + 去品牌这一版最容易悄悄坏的三件事：
       ① data-desk 没挂上 → 窗口再也拖不动（系统标题栏没了，只剩页面上的拖动区）；
       ② 品牌块/左轨 logo 又被谁加回来 → 界面上又重复写三遍程序名；
       ③ 拖动区盖住搜索框 → 点不进输入框。
       都不是崩溃，肉眼也不一定发现，所以在这里钉死。 */
    name: 'ui_clean', size: '1240x820',
    js: `(function(){
      var cmp = function(el){
        if (!el) return '';
        var s = getComputedStyle(el);
        return s.webkitAppRegion || s.getPropertyValue('-webkit-app-region') || 'none';
      };
      var head = document.querySelector('.lp-head');
      var first = head ? head.children[0] : null;
      var rail = document.getElementById('rail');
      var top = document.getElementById('dragTop');
      return {
        desk: document.documentElement.getAttribute('data-desk'),
        dragTop: top ? getComputedStyle(top).display : 'missing',
        brandNodes: document.querySelectorAll('.brand, .rail-logo').length,
        headFirst: first ? String(first.className) : '',
        headText: head ? head.textContent.trim() : 'x',
        headDrag: cmp(head),
        searchDrag: cmp(document.querySelector('.search')),
        railDrag: cmp(rail),
        railFirst: rail && rail.firstElementChild ? rail.firstElementChild.className : '',
        menuBtn: !!document.querySelector('[data-act="menu"]'),
        menuApi: typeof (window.DESKTOP || {}).menu,
        title: document.title
      };
    })()`,
    expect: r => [
      ['桌面壳挂了 data-desk', r.desk === '1'],
      ['顶部拖动条显示出来', r.dragTop === 'block'],
      ['品牌块和左轨 logo 都已删除', r.brandNodes === 0],
      ['顶栏第一个元素是搜索框', /search/.test(r.headFirst)],
      ['顶栏里只剩搜索框', r.headText.length < 20],
      ['顶栏能拖窗口', r.headDrag === 'drag'],
      ['搜索框自己不会被拖走', r.searchDrag === 'no-drag'],
      ['左轨能拖窗口', r.railDrag === 'drag'],
      ['左轨第一个是专题图标', /rail-topic/.test(r.railFirst)],
      ['底部有「⋯」菜单按钮', r.menuBtn === true && r.menuApi === 'function']
    ]
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
    env.CODEATLAS_SHOT_JS = c.js;

    const p = spawn(EXE, ['.', '--user-data-dir=' + UD], { cwd: ROOT, env, stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 30000);
    p.on('exit', () => {
      clearTimeout(t);
      const f = env.CODEATLAS_SHOT;
      const img = fs.existsSync(f) && fs.statSync(f).size > 5000;
      const log = path.join(UD, 'logs', 'main.log');
      let ret = '';
      try {
        const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(x => /\[shot\] js =>/.test(x));
        ret = lines.length ? lines[lines.length - 1].replace(/^.*\[shot\] js => /, '') : '';
      } catch (e) { /* 日志还没落盘 */ }

      /* 截图存在只说明进程没崩，界面对不对得看探针返回值 —— 所以在这里真断言，
         断言挂了就是 FAIL，不再靠人肉读那串 JSON。 */
      let probe = null;
      try { probe = ret ? JSON.parse(ret) : null; } catch (e) { probe = null; }
      const fails = [];
      if (!img) fails.push('截图没生成');
      if (!probe) fails.push('探针没返回值');
      else if (typeof c.expect === 'function') {
        c.expect(probe).forEach(([name, ok]) => { if (!ok) fails.push(name); });
      }
      const ok = fails.length === 0;
      console.log((ok ? 'OK   ' : 'FAIL ') + c.name
        + (ok ? '' : '  ✗ ' + fails.join(' / '))
        + (ret ? '  ' + ret : '  (no probe)'));
      if (!ok) console.log('      ^ 探针原值：' + ret);
      resolve(ok);
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let good = 0;
  for (const c of CASES) if (await run(c)) good++;
  console.log('\n完成 ' + good + ' / ' + CASES.length + ' 项（截图 + 探针断言都过才算过）');
  process.exitCode = good === CASES.length ? 0 : 1;
})();
