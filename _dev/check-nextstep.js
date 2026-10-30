/* ============================================================
   「下一步」引擎回归
   ------------------------------------------------------------
   测的不是「能不能跑」，而是「给真实回显时，推的下一步对不对」。

   四组用例：
   1. 视图识别：从提示符认出在哪个视图（单臂路由/OSPF/接口/BGP 各有样子）
   2. 回显清洗：日志、报错、display 输出不能当成命令
   3. 缩写：int / g0/0/24 / dis 这些 VRP 缩写要认
   4. 批量主线：拿每个剧本自己的前几步当输入，推的下一步必须和剧本一致
      —— 这条最容易暴露「匹配到别的剧本去了」

   用法：node _dev/check-nextstep.js
   ============================================================ */
'use strict';

global.window = {};
require('../assets/data.js');
require('../assets/topics.js');
['00-base', '10-basic', '20-adv', '30-pro', '40-labs', '50-presets-flows',
  '60-cmd', '70-cmd-query', '80-recipes', '82-recipes-route', '84-recipes-sec', '99-merge'
].forEach(function (f) { require('../assets/ensp/' + f + '.js'); });
require('../assets/nextstep.js');

const NEXT = window.NEXT;
const D = window.CODEATLAS;
const NAV = /^(quit|return|exit)$/i;

let pass = 0, fail = 0;
const fails = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++;
    fails.push(name + (extra ? '  → ' + extra : ''));
    console.log('  FAIL  ' + name + (extra ? '  → ' + extra : ''));
  }
}

/* 从 from 开始，跳过 quit 这类导航命令后的第一条真命令 */
function nextReal(steps, from) {
  for (let i = from; i < steps.length; i++) if (!NAV.test(steps[i].c)) return steps[i].c;
  return null;
}

/* ---------- 1. 视图识别 ---------- */
console.log('\n=== 1. 视图识别 ===');
[
  ['<Huawei>', 'user'],
  ['[Huawei]', 'system'],
  ['[SW1]', 'system'],
  ['[SW1-GigabitEthernet0/0/1]', 'interface'],
  ['[AR1-GigabitEthernet0/0/0.10]', 'interface'],
  ['[SW1-Vlanif10]', 'interface'],
  ['[SW1-Eth-Trunk1]', 'interface'],
  ['[R1-LoopBack0]', 'interface'],
  ['[AR1-ospf-1]', 'ospf'],
  ['[AR1-ospf-1-area-0.0.0.0]', 'ospf-area'],
  ['[AR1-bgp-65001]', 'bgp'],
  ['[AR1-aaa]', 'aaa'],
  ['[SW1-acl-adv-3000]', 'acl'],
  ['[SW1-vlan10]', 'vlan']
].forEach(function (c) {
  ok('提示符 ' + c[0] + ' → ' + c[1], NEXT.viewOfPrompt(c[0]) === c[1],
    '得到 ' + NEXT.viewOfPrompt(c[0]));
});

/* ---------- 2. 回显清洗 ---------- */
console.log('\n=== 2. 回显清洗 ===');
{
  const raw = [
    '<Huawei>system-view',
    'Enter system view, return user view with Ctrl+Z.',
    '[Huawei]sysname SW1',
    'Sep 15 2026 10:12:33-08:00 SW1 %%01CLI/4/UNAUTH(a)[12]:User entered.',
    '[SW1]vlan batch 10 20',
    '[SW1]interface GigabitEthernet0/0/1',
    '[SW1-GigabitEthernet0/0/1]port link-type access',
    '[SW1-GigabitEthernet0/0/1]port default vlan 10',
    '                         ^',
    'Error: Unrecognized command found at ^ position.',
    '[SW1-GigabitEthernet0/0/1]',
    '[SW1-GigabitEthernet0/0/1]quit',
    '#',
    '----------------'
  ].join('\n');
  const p = NEXT.parse(raw);
  ok('日志行 / Enter 提示被丢掉', p.cmds.indexOf('Enter system view, return user view with Ctrl+Z.') < 0);
  ok('时间戳日志不被当命令',
    !p.cmds.some(function (c) { return /^Sep\s/.test(c); }));
  ok('报错行不被当命令', !p.cmds.some(function (c) { return /Unrecognized/.test(c); }));
  ok('只剩下 7 条真命令', p.cmds.length === 7, '实际 ' + p.cmds.length + ' 条：' + JSON.stringify(p.cmds));
  ok('识别到接口视图（最后一条提示符）', p.view === 'interface', '得到 ' + p.view);
}

{
  /* 用户复制了 display current-configuration 的输出：
     里面每一行都像配置，但没有提示符，首词大多是 sysname/interface/ip 之类 */
  const raw = [
    '[SW1]display current-configuration',
    '#',
    'sysname SW1',
    '#',
    'vlan batch 10 20',
    '#',
    'interface GigabitEthernet0/0/1',
    ' port link-type access',
    ' port default vlan 10',
    '#',
    'return'
  ].join('\n');
  const p = NEXT.parse(raw);
  ok('整份配置输出里能捞出带提示符的那条',
    p.cmds.indexOf('display current-configuration') >= 0);
  ok('缩进的配置行也被收进来（首词是已知命令）',
    p.cmds.indexOf('port link-type access') >= 0, JSON.stringify(p.cmds));
}

/* ---------- 3. 缩写 ---------- */
console.log('\n=== 3. VRP 缩写 ===');
ok('sys 能对上 system-view', NEXT.cmdSim('sys', 'system-view') >= 0.72,
  NEXT.cmdSim('sys', 'system-view').toFixed(2));
ok('int g0/0/24 能对上 interface GigabitEthernet0/0/24',
  NEXT.cmdSim('int g0/0/24', 'interface GigabitEthernet0/0/24') >= 0.72,
  NEXT.cmdSim('int g0/0/24', 'interface GigabitEthernet0/0/24').toFixed(2));
ok('g0/0/1 和 g0/0/2 不算同一条接口',
  NEXT.cmdSim('interface g0/0/1', 'interface g0/0/2') === 0);
ok('port link-type trunk 和 port default vlan 10 不会互相当成同一条',
  NEXT.cmdSim('port link-type trunk', 'port default vlan 10') < 0.72,
  NEXT.cmdSim('port link-type trunk', 'port default vlan 10').toFixed(2));
ok('sysname SW1 和 sysname SW2 仍然算同一条',
  NEXT.cmdSim('sysname SW1', 'sysname SW2') >= 0.72,
  NEXT.cmdSim('sysname SW1', 'sysname SW2').toFixed(2));
ok('quit 不参与相似度（太通用）', NEXT.cmdSim('quit', 'quit') === 0);
ok('ospf 1 和 ospf 2 算同一条（进程号本地有效）',
  NEXT.cmdSim('ospf 1', 'ospf 2') >= 0.72, NEXT.cmdSim('ospf 1', 'ospf 2').toFixed(2));

/* ---------- 4. 批量主线 ---------- */
console.log('\n=== 4. 批量主线（每个剧本拿自己的前几步回推）===');
const list = D.recipes || [];
let mainPass = 0;
const mainFails = [];

list.forEach(function (r) {
  const steps = r.steps || [];
  if (steps.length < 5) return;

  /* 取前 k 步当输入，k 最多 6。太少（2 步）时所有剧本的起点都差不多，
     分不出是哪个场景，那不是引擎的错。 */
  const k = Math.min(6, steps.length - 1);
  const input = steps.slice(0, k).map(function (s) { return s.c; }).join('\n');
  const r2 = NEXT.match(input);

  const want = nextReal(steps, k);
  if (!want) return;

  const got = r2.ok && r2.next.length ? r2.next[0].c : '(没匹配上)';
  /* 判定标准不是「剧本 id 必须一样」，而是「推的下一步必须一样」。
     system-view / sysname 这种开头几步在几十个剧本里都长得一样，
     指到别的剧本但下一步相同，对用户就是对的。 */
  const same = r2.ok && got === want;

  if (same) {
    mainPass++;
    if (r2.recipe.id !== r.id) {
      console.log('  PASS  ' + r.id + ' → 命中 ' + r2.recipe.id + '，但下一步相同：' + got);
    }
  } else {
    mainFails.push({ id: r.id, want: want, got: got, hit: r2.ok ? r2.recipe.id : '-', idx: r2.idx });
  }
});

ok('每条主线都能推出正确的下一步（' + mainPass + '/' + (mainPass + mainFails.length) + '）',
  mainFails.length === 0, '');
mainFails.forEach(function (f) {
  console.log('         ' + f.id + ' 期望「' + f.want + '」得到「' + f.got + '」（命中 ' + f.hit + ' idx=' + f.idx + '）');
});

/* ---------- 5. 真实场景 ---------- */
console.log('\n=== 5. 真实场景 ===');
{
  /* 最常见的一幕：卡在互联口，不知道该配 trunk 还是 access */
  const r = NEXT.match('[SW1-GigabitEthernet0/0/24]port link-type trunk');
  ok('敲了 port link-type trunk，下一步是放行 VLAN',
    r.ok && /allow-pass/.test(r.next[0].c), r.ok ? r.next[0].c : '未匹配');
  ok('这时能认出在接口视图', r.view === 'interface');
}
{
  /* 单臂路由：卡在 arp broadcast enable 这一条（第一大坑） */
  const r = NEXT.match([
    'system-view',
    'sysname AR1',
    'interface GigabitEthernet0/0/0.10',
    'dot1q termination vid 10',
    'ip address 192.168.10.1 24'
  ].join('\n'));
  ok('单臂路由配到 ip address，下一步是 arp broadcast enable',
    r.ok && /arp broadcast/.test(r.next[0].c), r.ok ? r.next[0].c : '未匹配');
  ok('命中单臂路由剧本', r.ok && r.recipe.id === 'rec-single-arm', r.ok ? r.recipe.id : '-');
}
{
  /* OSPF：反掩码坑 */
  const r = NEXT.match([
    'system-view',
    'ospf 1 router-id 1.1.1.1',
    'area 0'
  ].join('\n'));
  ok('进了 area 0，下一步是宣告网段', r.ok && /^network/.test(r.next[0].c),
    r.ok ? r.next[0].c : '未匹配');
}
{
  /* 只敲了一行，也要有结果 */
  const r = NEXT.match('vlan batch 10 20');
  ok('单条命令也能匹配', r.ok, r.ok ? r.recipe.title : '未匹配');
}
{
  /* 空输入 / 乱输入 */
  ok('空输入不崩、返回 empty', NEXT.match('').ok === false && NEXT.match('').reason === 'empty');
  const junk = NEXT.match('hello world\n随便什么中文\n12345678');
  ok('乱输入返回 nomatch 而不是瞎指', junk.ok === false, 'reason=' + junk.reason);
}
{
  /* 用户敲了自己环境里的网段，跟剧本不同也要认得出 */
  const r = NEXT.match([
    'interface GigabitEthernet0/0/1',
    'ip address 172.16.88.1 255.255.255.0',
    'undo shutdown'
  ].join('\n'));
  ok('换成自己的网段也能认出「配接口地址」这条主线', r.ok,
    r.ok ? r.recipe.id + ' → ' + r.next[0].c : '未匹配');
}
{
  /* 最后一条是 quit：不应该再提示 quit */
  const r = NEXT.match([
    'vlan batch 10 20',
    'interface GigabitEthernet0/0/1',
    'port link-type access',
    'port default vlan 10',
    'quit'
  ].join('\n'));
  ok('敲完 quit 后不提示 quit', r.ok && r.next.length > 0 && !/^quit$/.test(r.next[0].c),
    r.ok ? r.next[0].c : '未匹配');
}
{
  /* parts 生成的代码块要能直接粘 */
  const r = NEXT.match('interface Eth-Trunk1');
  ok('代码块按设备分组，非空', r.ok && r.parts.length > 0 && r.parts.every(function (p) { return p.code.length > 0; }),
    r.ok ? r.parts.map(function (p) { return p.who + ':' + p.code.split('\n').length + '行'; }).join(' ') : '-');
  const multi = NEXT.match('vrrp vrid 10 priority 120');
  ok('跨设备的剧本分成两块（CORE1 / CORE2）', multi.ok && multi.parts.length === 2,
    multi.ok ? multi.parts.map(function (p) { return p.who; }).join('/') : '-');
}

/* ---------- 汇总 ---------- */
console.log('\n=== 汇总 ===');
console.log('通过 ' + pass + ' / 失败 ' + fail);
if (fails.length) {
  console.log('\n失败列表：');
  fails.forEach(function (f) { console.log('  - ' + f); });
}
console.log('\n剧本 ' + list.length + ' 个，命令相似度阈值 0.72');
process.exitCode = fail ? 1 : 0;
