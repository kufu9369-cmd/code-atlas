/* ============================================================
   码典 · 搜索自检
   ------------------------------------------------------------
   用法： node _dev/check-search.js            跑内置用例
          node _dev/check-search.js dis isis   跑指定查询
   目的：不用开界面就能看「搜什么出什么、排序对不对」。
   ============================================================ */
'use strict';

const path = require('path');
const A = f => path.join(__dirname, '..', 'assets', f);

global.window = global;
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = v; },
  removeItem: k => { delete store[k]; }
};

require(A('data.js'));
require(A('topics.js'));

function loadDir(dir, files) {
  files.forEach(f => {
    const p = path.join(__dirname, '..', 'assets', dir, f + '.js');
    try { require(p); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  });
}

loadDir('ensp', ['00-base', '10-basic', '20-adv', '30-pro', '40-labs',
  '50-presets-flows', '60-cmd', '70-cmd-query', '99-merge']);
loadDir('javaweb', ['00-base', '10-servlet', '20-jsp', '30-jdbc', '40-mvc',
  '50-deploy', '60-labs', '70-presets-flows', '80-cmd', '99-merge']);
loadDir('weblegacy', ['00-base', '10-htmlcss', '20-js', '30-jquery', '40-compat',
  '50-labs', '60-presets-flows', '70-cmd', '99-merge']);

const SEARCH = require(A('search.js'));
const D = global.CODEATLAS;
const CMD = D.cmd;

const CASES = [
  'dis isis',
  'dis bgp',
  'getParameter',
  '清除浮动',
  '事件委托',
  'dis ospf',
  'DIS IS-IS',
  'display interface',
  'sh run',
  'isis peer',
  'ospf 邻居',
  '邻居',
  'bgp 邻居',
  'vlan 10',
  'stp 保护',
  'mpls ldp',
  'vrrp 主备',
  'nat server',
  'dhcp snooping',
  'wlan ap',
  'acl 不生效',
  'dis cur',
  'reset',
  '链路聚合',
  '光模块',
  '地址池',
  '环路',
  'ping',
  'undo shutdown'
];

const argQuery = process.argv.slice(2).join(' ').trim();
const queries = argQuery ? [argQuery] : CASES;

console.log('命令词条 ' + Object.keys(CMD).length + ' 条 / 片段 '
  + D.categories.reduce((a, c) => a + c.items.length, 0) + ' 条');

let bad = 0;
queries.forEach(q => {
  const gs = SEARCH.groups(D, CMD, q, 60);
  console.log('\n=== ' + q + ' ===');
  if (!gs.length) { console.log('  (无命中)'); bad++; return; }
  gs.forEach(g => {
    const names = g.items.slice(0, 6).map(i => i.title || i.id);
    console.log('  [' + g.name + '] ' + (g.total || g.items.length) + ' 条：'
      + names.join('  |  ') + (g.items.length > 6 ? '  …' : ''));
  });
});

/* 硬性断言：这几条是用户明确提到的场景，必须命中 */
const MUST = [
  ['dis isis', 'cmd', w => /^display isis/i.test(w)],
  ['dis bgp', 'cmd', w => /^display bgp/i.test(w)],
  ['dis ospf', 'cmd', w => /^display ospf/i.test(w)],
  ['dis cur', 'cmd', w => w === 'display current-configuration'],
  ['dis int brief', 'cmd', w => /^display interface brief/.test(w)],
  ['dis vlan', 'cmd', w => /^display vlan/.test(w)],
  ['dis mac', 'cmd', w => /^display mac-address/.test(w)],
  ['邻居', 'cmd', w => /peer/.test(w)],
  ['光模块', 'cmd', w => w === 'display transceiver interface'],
  ['地址池', 'cmd', w => /^display ip pool/.test(w)],
  /* JavaWeb / Web 专题：命令词典和片段都要能搜到 */
  ['getParameter', 'cmd', w => w === 'request.getParameter'],
  ['request session', 'cmd', w => /request|session/.test(w)],
  ['c:forEach', 'cmd', w => w === 'c:forEach'],
  ['preparedstatement', 'snippet', id => id === 'jw-prepared'],
  ['清除浮动', 'snippet', id => id === 'web-float'],
  ['box-sizing', 'snippet', id => id === 'web-box-model'],
  ['事件委托', 'snippet', id => /bubble|tab|delegate/.test(id)],
  ['跨域', 'snippet', id => id === 'jw-cors']
];

console.log('\n--- 断言 ---');
MUST.forEach(([q, kind, ok]) => {
  const gs = SEARCH.groups(D, CMD, q, 60);
  const g = gs.find(x => x.kind === kind);
  const first = g && g.items[0];
  const pass = !!(first && ok(first.id));
  if (!pass) bad++;
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + q + ' → 首条 '
    + (first ? first.id : '（无）'));
});

console.log('\n' + (bad ? bad + ' 处不符合预期' : '全部符合预期'));
process.exit(bad ? 1 : 0);
