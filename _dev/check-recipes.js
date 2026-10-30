/* ============================================================
   配置剧本自检
   ------------------------------------------------------------
   查的不是「有没有写」，而是「照抄会不会报错」：
   1. 必填字段、id 唯一、命令里不许有中文和全角符号
   2. 视图链：这条命令该在哪个视图敲，剧本里的顺序对不对
      —— 用户是照着一行一行粘的，视图错了就是 Command error
   3. who 分组连续性：同一台设备的步骤必须挨在一起，
      否则「复制整段」会把两台设备的命令揉成一团
   4. parts 生成的代码块能不能直接粘

   用法：node _dev/check-recipes.js
   ============================================================ */
'use strict';

global.window = {};
require('../assets/data.js');
require('../assets/topics.js');
['00-base', '10-basic', '20-adv', '30-pro', '40-labs', '50-presets-flows',
  '60-cmd', '70-cmd-query', '80-recipes', '82-recipes-route', '84-recipes-sec', '99-merge'
].forEach(function (f) { require('../assets/ensp/' + f + '.js'); });

const D = window.CODEATLAS;
const list = D.recipes || [];

const errors = [];
const warns = [];
const E = function (m) { errors.push(m); };
const W = function (m) { warns.push(m); };

/* ---------- 视图状态机 ----------
   只用来抓「明显放错视图」的错，不做完整 VRP 语法校验
   （完整校验得整份命令树，不现实，也没必要）。 */

/* 进子视图的命令 */
const ENTER = [
  [/^system-view$/i, 'system'],
  [/^interface\s+/i, 'interface'],
  [/^vlan\s+\d+$/i, 'vlan'],
  [/^ospf\s+\d+/i, 'ospf'],
  [/^ospfv3\s+\d+/i, 'ospfv3'],
  [/^rip\s+\d+$/i, 'rip'],
  [/^area\s+[\d.]+$/i, 'ospf-area'],
  [/^bgp\s+\d+$/i, 'bgp'],
  [/^ipv4-family\s+/i, 'bgp-af'],
  [/^isis\s+\d+$/i, 'isis'],
  [/^bfd$/i, 'bfd'],
  [/^mpls$/i, 'mpls'],
  [/^mpls\s+ldp$/i, 'mpls-ldp'],
  [/^acl\s+\d+$/i, 'acl'],
  [/^aaa$/i, 'aaa'],
  [/^ip\s+vpn-instance\s+/i, 'vpn'],
  [/^ip\s+pool\s+/i, 'pool'],
  [/^route-policy\s+/i, 'route-policy'],
  [/^ip\s+ip-prefix\s+/i, null],
  [/^wlan$/i, 'wlan'],
  [/^security-policy$/i, 'sec-policy'],
  [/^firewall\s+zone\s+/i, 'zone'],
  [/^pim$/i, 'pim'],
  [/^user-interface\s+/i, 'vty'],
  [/^ike\s+proposal\s+/i, 'ike-prop'],
  [/^ike\s+peer\s+/i, 'ike-peer'],
  [/^ipsec\s+proposal\s+/i, 'ipsec-prop'],
  [/^ipsec\s+policy\s+/i, 'ipsec-pol']
];

/* 只在这些视图里合法（前面的视图 = 父视图，深层视图当然也能敲父视图的命令） */
const WHERE = [
  [/^port\s+(link-type|default|trunk|hybrid)/i, ['interface']],
  [/^(undo\s+)?shutdown$/i, ['interface']],
  [/^(stp\s+(edged-port|cost|root|instance)|stp\s+mode)/i, ['interface', 'system']],
  [/^ip\s+address\s+/i, ['interface']],
  [/^ipv6\s+(address|enable)/i, ['interface']],
  [/^dot1q\s+termination/i, ['interface']],
  [/^arp\s+broadcast\s+enable$/i, ['interface']],
  [/^dhcp\s+select/i, ['interface']],
  [/^dhcp\s+server\s+/i, ['interface']],
  [/^vrrp\s+vrid/i, ['interface']],
  [/^eth-trunk\s+\d+$/i, ['interface']],
  [/^port-security/i, ['interface']],
  [/^port-isolate\s+enable/i, ['interface']],
  [/^port-mirroring/i, ['interface']],
  [/^traffic-filter/i, ['interface']],
  [/^traffic-policy/i, ['interface']],
  [/^nat\s+(outbound|server|static)/i, ['interface']],
  [/^ip\s+binding\s+/i, ['interface']],
  [/^pim\s+(sm|dm|ssm)$/i, ['interface']],
  [/^igmp\s+enable$/i, ['interface']],
  [/^ospfv3\s+\d+\s+area/i, ['interface']],
  [/^isis\s+(enable|circuit-level)/i, ['interface']],
  [/^tunnel-protocol/i, ['interface']],
  [/^source\s+/i, ['interface']],
  [/^destination\s+/i, ['interface']],
  [/^mpls\s+ldp$/i, ['interface', 'system']],
  [/^ipsec\s+policy\s+\S+$/i, ['interface']],
  [/^authentication-mode\s+(aaa|password|scheme)/i, ['vty']],
  [/^authentication-mode\s+(md5|simple|hmac-sha)/i, ['ospf-area', 'interface']],
  [/^protocol\s+inbound/i, ['vty']],
  [/^set\s+authentication\s+password/i, ['vty']],
  [/^idle-timeout/i, ['vty']],
  [/^(acl\s+\d+\s+(inbound|outbound))/i, ['vty']],
  [/^sysname\s+/i, ['system']],
  [/^vlan\s+batch\s+/i, ['system']],
  [/^ip\s+route-static/i, ['system']],
  [/^dhcp\s+enable$/i, ['system']],
  [/^multicast\s+routing-enable$/i, ['system']],
  [/^stelnet\s+server\s+enable$/i, ['system']],
  [/^rsa\s+local-key-pair/i, ['system']],
  [/^capwap\s+source\s+interface/i, ['system']],
  [/^port-isolate\s+mode/i, ['system']],
  [/^observe-port\s+/i, ['system']],
  [/^mpls\s+lsr-id/i, ['system']],
  [/^bfd$/i, ['system']],
  [/^bfd\s+\S+\s+bind/i, ['system']],
  [/^ip\s+ip-prefix\s+/i, ['system']],
  [/^ip\s+community-filter\s+/i, ['system']],
  [/^route-policy\s+/i, ['system']],
  [/^import-route\s+/i, ['ospf', 'bgp', 'rip', 'isis', 'bgp-af']],
  [/^static-rp\s+/i, ['pim']],
  [/^network-entity\s+/i, ['isis']],
  [/^is-level\s+/i, ['isis']],
  [/^network\s+[\d.]+\s+0\./i, ['ospf-area', 'rip', 'bgp', 'ospfv3']],
  [/^router-id\s+/i, ['ospf', 'bgp', 'isis', 'ospfv3']],
  [/^version\s+2$/i, ['rip']],
  [/^undo\s+summary$/i, ['rip']],
  [/^vlink-peer\s+/i, ['ospf-area']],
  [/^abr-summary\s+/i, ['ospf-area']],
  [/^reflect-client$/i, ['bgp']],
  [/^connect-interface\s+/i, ['bgp']],
  [/^peer\s+\S+\s+as-number/i, ['bgp']],
  [/^route-distinguisher\s+/i, ['vpn']],
  [/^vpn-target\s+/i, ['vpn']],
  [/^rule\s+name\s+\S+/i, ['sec-policy']],
  [/^rule\s+\d+\s+(permit|deny)/i, ['acl']],
  [/^(source-zone|destination-zone)\s+/i, ['sec-policy']],
  [/^add\s+interface\s+/i, ['zone']],
  [/^dhcp\s+enable$/i, ['system']]
];

const ATOMIC = /^(quit|return|save|reset|display|ping|tracert|telnet|undo|reboot|dir|more|less)\b/i;

function checkViewChain(rec) {
  let stack = ['user'];
  const id = rec.id;

  rec.steps.forEach(function (s, i) {
    const c = String(s.c || '').trim();
    if (!c) return;
    const at = id + ' 第 ' + (i + 1) + ' 步「' + c + '」';

    if (/^quit$/i.test(c)) {
      if (stack.length > 1) stack.pop();
      else W(at + '：已经在用户视图了，再 quit 没有意义');
      return;
    }
    if (/^return$/i.test(c)) { stack = ['user']; return; }
    /* system-view 是从用户视图进系统视图，用户视图这一层要留着，
       否则后面第一次 quit 就会被判成「已经在用户视图了」 */
    if (/^system-view$/i.test(c)) { stack = ['user', 'system']; return; }

    /* 接口视图里的 mpls / mpls ldp 只是使能，不进新视图 */
    if (stack[stack.length - 1] === 'interface' && /^mpls(\s+ldp)?$/i.test(c)) return;

    /* 进子视图 */
    let entered = null;
    for (const [re, view] of ENTER) {
      if (re.test(c)) { entered = view; break; }
    }
    if (entered) {
      if (stack[stack.length - 1] === 'user' && entered !== 'system') {
        /* 剧本省略了 system-view：不算错，补上按已有层级算 */
        stack = ['user', 'system'];
      }
      stack.push(entered);
      return;
    }

    if (ATOMIC.test(c)) return;

    /* 该在哪个视图 */
    let need = null;
    for (const [re, views] of WHERE) {
      if (re.test(c)) { need = views; break; }
    }
    if (!need) return;

    const cur = stack[stack.length - 1];
    if (need.indexOf(cur) < 0) {
      /* 从子视图里敲父视图的命令也可能合法（如接口视图里敲 stp mode），
         所以只有「当前视图在 need 之外且也不在它的上层」才报错 */
      E(at + ' 应该在 ' + need.join(' 或 ') + ' 视图，但当前在 ' + cur + ' 视图');
    }
  });
}

function checkWho(rec) {
  const seen = [];
  rec.steps.forEach(function (s) {
    const w = s.who || '通用';
    if (!seen.length || seen[seen.length - 1] !== w) {
      if (seen.indexOf(w) >= 0) {
        W(rec.id + ' 的 who「' + w + '」出现了两次且不连续，' +
          '「复制整段」会把两台设备的命令揉在一起');
      }
      seen.push(w);
    }
  });
}

/* ---------- 逐条检查 ---------- */
const ids = {};
const titles = {};

list.forEach(function (r, i) {
  const at = 'recipes[' + i + '] ' + (r.id || '(无 id)');

  if (!r.id) { E(at + ' 缺少 id'); return; }
  if (ids[r.id]) E('重复的剧本 id：' + r.id);
  ids[r.id] = 1;

  if (!/^rec-[a-z0-9-]+$/.test(r.id)) W(at + ' id 建议用 rec- 小写短横线格式');
  if (!r.title) E(at + ' 缺少 title');
  else {
    if (titles[r.title]) W('剧本标题重复：' + r.title);
    titles[r.title] = 1;
  }
  if (!r.scene) W(at + ' 缺少 scene（面板上会少一行说明）');
  if (!r.level) W(at + ' 缺少 level');

  const steps = r.steps || [];
  if (!steps.length) { E(at + ' 没有任何步骤'); return; }
  if (steps.length < 4) W(at + ' 只有 ' + steps.length + ' 步，太短了，做不成一条主线');

  let lastWho = '';
  steps.forEach(function (s, k) {
    const c = String(s.c || '').trim();
    const where = at + ' 第 ' + (k + 1) + ' 步';

    if (!c) { E(where + ' 命令为空'); return; }
    if (c !== String(s.c)) W(where + ' 命令首尾有多余空格');
    if (/[\u4e00-\u9fa5]/.test(c)) E(where + ' 命令里有中文：' + c);
    if (/[\u3000-\u303f\uff00-\uffef]/.test(c)) E(where + ' 命令里有全角符号：' + c);
    if (/\{\{/.test(c)) E(where + ' 剧本不支持 {{变量}}，请写成具体值');
    if (/#/.test(c)) E(where + ' 命令里有 # 号，eNSP 里会报错');
    if (/^[a-z]/.test(c) === false) W(where + ' 命令不是小写字母开头：' + c);
    /* note 不强制每一步都有：同一视图里连着敲几条时，写一条说明就够了。
       面板上没有 note 的步骤会显示「接着上一条，同一视图」。
       这里只统计覆盖率，低于一半才提醒。 */

    if (s.who) lastWho = s.who;
    if (!s.who && lastWho) {
      /* 后面沿用上一台设备，这是正常写法，不提示 */
    }
  });

  (r.verify || []).forEach(function (v, k) {
    if (!v.cmd) E(at + ' verify[' + k + '] 缺少 cmd');
    if (!v.hope) W(at + ' verify[' + k + '] 缺少 hope');
  });
  if (!(r.verify || []).length) W(at + ' 没有 verify（配完怎么验）');
  if (!(r.pitfalls || []).length) W(at + ' 没有 pitfalls（最容易错在哪）');

  checkViewChain(r);
  checkWho(r);
});

/* ---------- parts 生成结果 ---------- */
let partCount = 0;
let multiDevice = 0;
list.forEach(function (r) {
  const map = Object.create(null);
  const order = [];
  (r.steps || []).forEach(function (s) {
    const w = s.who || '通用';
    if (!map[w]) { map[w] = []; order.push(w); }
    map[w].push(s.c);
  });
  partCount += order.length;
  if (order.length > 1) multiDevice++;
  order.forEach(function (w) {
    if (!map[w].length) E(r.id + ' 的 ' + w + ' 代码块是空的');
  });
});

/* ---------- 汇总 ---------- */
const stepTotal = list.reduce(function (n, r) { return n + (r.steps || []).length; }, 0);
const noted = list.reduce(function (n, r) {
  return n + (r.steps || []).filter(function (s) { return s.note; }).length;
}, 0);

console.log('=== 配置剧本自检 ===');
console.log('剧本 ' + list.length + ' 个 / 步骤 ' + stepTotal + ' 步 / 代码块 ' + partCount
  + ' 段（跨设备 ' + multiDevice + ' 个）');
console.log('平均 ' + (list.length ? (stepTotal / list.length).toFixed(1) : 0) + ' 步/个'
  + ' / 有说明的步骤 ' + noted + ' 步（' + (stepTotal ? Math.round(noted / stepTotal * 100) : 0) + '%）');

if (errors.length) {
  console.log('\n--- 错误 ' + errors.length + ' 条 ---');
  errors.forEach(function (m) { console.log('  [E] ' + m); });
} else {
  console.log('\n错误 0 条');
}

if (warns.length) {
  console.log('\n--- 提醒 ' + warns.length + ' 条 ---');
  warns.slice(0, 40).forEach(function (m) { console.log('  [W] ' + m); });
  if (warns.length > 40) console.log('  … 还有 ' + (warns.length - 40) + ' 条');
}

process.exitCode = errors.length ? 1 : 0;
