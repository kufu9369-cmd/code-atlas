/* ============================================================
   码典 · 生成 assets/vrp/dict.js（官方命令大全）
   ------------------------------------------------------------
   数据来源：朋友做的 Hinstruction（华为 VRP V600R024C00 官方帮助文档离线包，
   7496 条命令）。原包是 7 MB 的 commands.json，字段名是单字母缩写，
   直接塞进前端又大又难读，所以这一步做三件事：

   1. 筛：留下「学网络运维真会查」的模块。WLAN 模板、Telemetry、PKI
      这类现场配不到的东西不要；`其他` 这个兜底模块只在它落在
      VRP 内核认识的视图里时才留（ip address / router id / ping 都在里面）。
   2. 标：每条命令试敲一次 —— 把命令模板里的占位符填上样例值，
      丢给 assets/vrp/core.js 的 analyze()。能解析出来就标 `sim:1`，
      练习场里可以直接「试一句」；解析不了的只当文档查。
      这一步是「能查」和「能练」的分界线，别为了数字好看全部标 1。
   3. 压：输出成紧凑数组 + 短字段名，体积能压到原来的三分之一左右。

   用法：
     node scripts/build-vrp-dict.js
     node scripts/build-vrp-dict.js "D:/别的路径/Hinstruction/resources/app/data"
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'vrp', 'dict.js');
const SRC = process.argv[2] || 'C:/Users/10137/Desktop/Hinstruction/resources/app/data';

/* ---------- 1. 读源 ---------- */
function readJson(f) {
  return JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
}
let raw, meta;
try {
  raw = readJson('commands.json');
  meta = readJson('meta.json');
} catch (e) {
  console.error('读不到源数据：' + SRC);
  console.error(e.message);
  console.error('（这台机器上没有那份离线包就跳过，dict.js 保持原样）');
  process.exit(0);
}

const VRP = require(path.join(ROOT, 'assets', 'vrp', 'core.js'));

/* ---------- 2. 模块白名单 ----------
   是按「这个模块的命令你在 eNSP 里用不用得上」筛的，不是按数量。
   WLAN 那 70 条留着也没用：没有 AP 就没有那个视图。 */
const MODULE_OK = new Set([
  'BGP', 'OSPF', 'OSPFv3', 'IS-IS', 'RIP', 'MPLS', '组播', 'IPv6', '安全',
  'VLAN', 'DHCP', 'QoS', 'STP', '接口', 'VRRP', '可靠性', 'ACL', 'BFD',
  '链路聚合', 'VXLAN', 'EVPN', '堆叠', 'NAT', '网管'
]);

/* VRP 内核认识的视图名（dict 里视图名是中文，要先对得上才能试敲） */
const VMAP = {};
Object.keys(VRP.VIEWMETA).forEach((id) => { VMAP[VRP.VIEWMETA[id].name] = id; });

/* 中文视图名 → 内核视图 id。
   官方文档里视图名很长（"子接口视图、接口视图、Eth-Trunk接口视图…"），
   取第一个能对上的就行：试敲本来就是「能不能在那个视图敲」的粗筛。 */
function viewIdOf(v) {
  if (!v) return null;
  const parts = String(v).split('、').map((s) => s.trim());
  for (const p of parts) {
    if (VMAP[p]) return VMAP[p];
    const hit = Object.keys(VMAP).find((k) => k.replace(/\s+/g, '') === p.replace(/\s+/g, ''));
    if (hit) return VMAP[hit];
  }
  /* "所有视图" / "所有接口视图" 这类，用系统视图和接口视图各试一次 */
  if (/^所有/.test(v)) return 'system';
  return null;
}

/* ---------- 3. 把命令模板填成一句能敲的话 ----------
   [ ] { } < > 的剥法在 scripts/lib/fill-vrp.js 里，
   剧本转换脚本也要用同一套规则，所以抽出去了。 */
const { fillSyntax } = require('./lib/fill-vrp');

/* 试敲：在几个候选视图里解析，全部成功才算可演练 */
function trySim(item) {
  const demo = fillSyntax(item.s);
  if (!demo) return null;
  const views = [];
  const v = viewIdOf(item.v);
  if (v) views.push(v);
  ['system', 'user', 'if'].forEach((x) => { if (views.indexOf(x) < 0) views.push(x); });
  for (const vid of views) {
    const r = VRP.analyze(vid, demo);
    if (r && !r.err && r.path && r.path.length && r.action) {
      return { view: vid, demo: VRP.canonical(r) || demo };
    }
  }
  return null;
}

/* ---------- 4. 字段瘦身 ----------
   原始包 7 MB，参数说明和「undo xxx 命令用来…」这类套话占了一大半。
   学习时要的是「这句什么意思、每个参数填什么」，不是官方文档全文，
   所以：说明只留 undo 之前的部分，参数范围截断，命令格式只留前两种写法。 */
function clip(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function trimFn(f) {
  let s = String(f || '').replace(/\s+/g, ' ').trim();
  /* "bgp命令用来…. undo bgp命令用来…" —— 后半句是 undo 的套话，砍掉 */
  const u = s.indexOf(' undo ');
  if (u > 20) s = s.slice(0, u);
  return clip(s, 260);
}
function trimSyntax(s) {
  const lines = String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  return lines.slice(0, 2).map((x) => clip(x, 220)).join('\n');
}

/* ---------- 5. 筛 + 转 ---------- */
const out = [];
const seen = new Set();
let skipped = { module: 0, view: 0, dup: 0, other: 0 };

raw.forEach((x) => {
  const mod = x.m || '其他';
  if (!MODULE_OK.has(mod)) {
    /* `其他` 是兜底模块，泥沙俱下。只留内核真的认识的命令
       （ip address / router id / ping 这些核心命令恰好都在里面），
       其余 2900 多条杂项不进来，不然查的时候全是噪音。 */
    if (mod !== '其他') { skipped.module++; return; }
    if (!trySim(x)) { skipped.other++; return; }
  }
  const name = String(x.n || '').trim();
  const syntax = trimSyntax(x.s);
  const view = String(x.v || '').trim();
  if (!name || !syntax) return;
  const key = name + '|' + view;
  if (seen.has(key)) { skipped.dup++; return; }
  seen.add(key);

  const params = (x.p || [])
    .filter((p) => p && p.n)
    .map((p) => [clip(p.n, 40), clip(p.d, 90), clip(p.v, 90)]);

  /* [名字, 视图, 格式, 作用(短), 模块, 详细说明, 参数, 级别, 分组, 试敲] */
  const sim = trySim(x);
  out.push([
    name,
    view,
    syntax,
    clip(x.bi, 120),
    mod,
    trimFn(x.f),
    params,
    String(x.l || '').replace(/^\d+:\s*/, '').trim(),
    clip(x.g, 24),
    sim ? [sim.view, sim.demo] : 0
  ]);
});

/* 排序：模块顺序按「学习顺序」，同模块内按视图再按名字，稳定可读 */
const MOD_ORDER = ['VLAN', 'STP', '接口', '链路聚合', 'ACL', 'DHCP', 'VRRP', '可靠性',
  'OSPF', 'OSPFv3', 'IS-IS', 'RIP', 'BGP', 'IPv6', '组播', 'MPLS', 'VXLAN', 'EVPN',
  'QoS', '安全', 'BFD', 'NAT', '堆叠', '网管', '其他'];
const mo = (m) => { const i = MOD_ORDER.indexOf(m); return i < 0 ? 99 : i; };
out.sort((a, b) => (mo(a[4]) - mo(b[4])) || a[1].localeCompare(b[1], 'zh') || a[0].localeCompare(b[0]));

const simN = out.filter((x) => x[9]).length;
const body = out.map((x) => JSON.stringify(x)).join(',\n');

const head = `/* ============================================================
   码典 · 官方命令大全（自动生成，别手改）
   ------------------------------------------------------------
   来源：${'华为 VRP ' + (meta.version || '') + ' 官方帮助文档离线包'} · 共 ${raw.length} 条原始条目
   生成：node scripts/build-vrp-dict.js
   收录：${out.length} 条（筛掉了 WLAN / Telemetry / PKI 这些现场用不上的模块，
        以及视图对不上 VRP 内核的杂项）；其中 ${simN} 条可以在练习场里直接敲。
   字段：[名字, 视图, 格式, 作用, 模块, 详细说明, 参数表, 级别, 分组, 试敲]
   试敲 = [视图id, 填充好的一行命令]，0 表示内核里没有这条命令，只能查不能练。
   ============================================================ */
window.VRP_DICT = {
  v: ${JSON.stringify(meta.version || '')},
  built: ${JSON.stringify(new Date().toISOString().slice(0, 10))},
  total: ${raw.length},
  n: ${out.length},
  sim: ${simN},
  cmd: [
${body}
  ]
};
`;

fs.writeFileSync(OUT, head, 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log('原始 ' + raw.length + ' 条 → 收录 ' + out.length + ' 条（可演练 ' + simN + '）');
console.log('筛掉：模块 ' + skipped.module + '，重复 ' + skipped.dup);
console.log('写出 ' + path.relative(ROOT, OUT) + ' · ' + kb + ' KB');

/* 抽查几条，确认「可演练」不是瞎标的 */
const byName = (n) => out.filter((x) => x[0] === n);
['bgp', 'ip address', 'ospf', 'router id', 'acl', 'ip route-static'].forEach((n) => {
  byName(n).slice(0, 2).forEach((x) => {
    console.log('  ' + (x[9] ? '✓' : '·') + ' ' + x[0] + ' [' + x[1] + '] ' +
      (x[9] ? '→ ' + x[9][1] : ''));
  });
});
