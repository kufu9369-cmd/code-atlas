/* 内容完整性自检：在 Node 里模拟浏览器加载顺序，跑一遍和知识包一样的校验规则。 */
'use strict';

global.window = {};
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

require('../assets/data.js');
[
  '00-base', '10-basic', '20-adv', '30-pro',
  '40-labs', '50-presets-flows', '60-cmd', '70-cmd-query', '99-merge'
].forEach(function (f) { require('../assets/ensp/' + f + '.js'); });

const D = window.CODEATLAS;
const errors = [];
const warns = [];

/* ---------- 1. id 唯一性 ---------- */
const seen = {};
function uniq(kind, id, where) {
  if (!id) { errors.push(where + ' 缺少 id'); return; }
  const k = kind + ':' + id;
  if (seen[k]) errors.push('重复 ' + k + '（' + where + '）');
  seen[k] = 1;
}

D.categories.forEach(function (c) {
  uniq('cat', c.id, 'category');
  (c.items || []).forEach(function (it, i) { uniq('snip', it.id, c.id + '.items[' + i + ']'); });
});
(D.labs || []).forEach(function (l, i) { uniq('lab', l.id, 'labs[' + i + ']'); });
(D.presets || []).forEach(function (p, i) { uniq('preset', p.id, 'presets[' + i + ']'); });
(D.flows || []).forEach(function (f, i) { uniq('flow', f.id, 'flows[' + i + ']'); });

/* ---------- 2. 变量闭合 ---------- */
function checkVars(code, vars, where) {
  const refs = String(code || '').match(/\{\{[A-Za-z0-9_]+\}\}/g) || [];
  vars = vars || {};
  refs.forEach(function (r) {
    const n = r.slice(2, -2);
    if (!(n in vars)) errors.push(where + ' 用了 {{' + n + '}} 但 vars 里没定义');
  });
  Object.keys(vars).forEach(function (n) {
    if (!vars[n] || typeof vars[n] !== 'object') { errors.push(where + ' 变量 ' + n + ' 不是对象'); return; }
    if (vars[n].value === undefined || vars[n].value === null || vars[n].value === '') {
      warns.push(where + ' 变量 ' + n + ' 没有默认值');
    }
    if (!vars[n].desc) warns.push(where + ' 变量 ' + n + ' 没有 desc');
    if (!vars[n].label) warns.push(where + ' 变量 ' + n + ' 没有 label');
  });
  return refs.length;
}

let varCount = 0;
const snipIds = {};
D.categories.forEach(function (c) {
  (c.items || []).forEach(function (it) {
    snipIds[it.id] = 1;
    varCount += checkVars(it.code, it.vars, c.id + '/' + it.id);
    (it.variants || []).forEach(function (v) {
      const merged = Object.assign({}, it.vars, v.vars || {});
      varCount += checkVars(v.code, merged, c.id + '/' + it.id + '[' + v.id + ']');
    });
    if (!it.title) errors.push(it.id + ' 缺少 title');
    if (!it.code) errors.push(it.id + ' 缺少 code');
    if (!it.desc) warns.push(it.id + ' 没有 desc');
    if (it.level && ['入门', '进阶', '综合'].indexOf(it.level) < 0) {
      errors.push(it.id + ' 的 level 非法：' + it.level);
    }
    const u = it.docs && it.docs.src && it.docs.src.u;
    if (u && !/^https:\/\//.test(u)) errors.push(it.id + ' docs.src.u 不是 https');
  });
});

/* ---------- 3. 实验 ---------- */
let topoNodeCount = 0;
(D.labs || []).forEach(function (l) {
  if (!l.title) errors.push('lab ' + l.id + ' 缺少 title');
  if (['入门', '进阶', '综合'].indexOf(l.level) < 0) errors.push('lab ' + l.id + ' level 非法：' + l.level);
  if (!(Number(l.minutes) > 0)) errors.push('lab ' + l.id + ' minutes 非法');
  if (!l.steps || !l.steps.length) errors.push('lab ' + l.id + ' 没有步骤');
  (l.steps || []).forEach(function (s, i) {
    if (!s.code) errors.push('lab ' + l.id + ' steps[' + i + '] 没有 code');
    varCount += checkVars(s.code, l.vars, 'lab ' + l.id + '/step' + i);
  });
  if (!(l.verify || []).length) warns.push('lab ' + l.id + ' 没有 verify');
  if (!(l.pitfalls || []).length) warns.push('lab ' + l.id + ' 没有 pitfalls');

  if (l.topo) {
    const h = l.topo.h || 260;
    const ids = {};
    (l.topo.nodes || []).forEach(function (n, i) {
      topoNodeCount++;
      if (!n.id) errors.push('lab ' + l.id + ' topo.nodes[' + i + '] 缺少 id');
      ids[n.id] = 1;
      if (!(n.x >= 10 && n.x <= 750)) errors.push('lab ' + l.id + ' 节点 ' + n.id + ' x 越界：' + n.x);
      if (!(n.y >= 10 && n.y <= h - 10)) errors.push('lab ' + l.id + ' 节点 ' + n.id + ' y 越界：' + n.y + '（h=' + h + '）');
      if (['switch', 'router', 'pc', 'server'].indexOf(n.t) < 0) errors.push('lab ' + l.id + ' 节点 ' + n.id + ' 类型非法：' + n.t);
      if (!n.label) warns.push('lab ' + l.id + ' 节点 ' + n.id + ' 没有 label');
    });
    (l.topo.links || []).forEach(function (k, i) {
      if (!Array.isArray(k) || !ids[k[0]] || !ids[k[1]]) {
        errors.push('lab ' + l.id + ' links[' + i + '] 指向不存在的节点：' + JSON.stringify(k));
      }
    });
  }
  (l.plan || []).forEach(function (r) { if (!r.dev) warns.push('lab ' + l.id + ' plan 有行没写 dev'); });
});

/* ---------- 4. 预设 / 可执行任务 ---------- */
(D.presets || []).forEach(function (p) {
  if (p.task) {
    const t = p.task, where = 'task ' + p.id, env = t.env || {}, devIds = {};
    (t.devices || []).forEach(function (d) { if (d.id) devIds[d.id] = 1; else errors.push(where + ' 设备缺少 id'); });
    if (!(t.steps || []).length) errors.push(where + ' 没有步骤');
    (t.steps || []).forEach(function (s, i) {
      if (!s.code) errors.push(where + ' steps[' + i + '] 缺少 code');
      if (!s.who || !devIds[s.who]) errors.push(where + ' steps[' + i + '] 设备未声明：' + s.who);
      varCount += checkVars(s.code, env, where + '/step' + i);
    });
    (t.verify || []).forEach(function (v, i) {
      if (!v.cmd || !v.hope) errors.push(where + ' verify[' + i + '] 缺少 cmd / hope');
      if (v.cmd) varCount += checkVars(v.cmd, env, where + '/verify' + i);
    });
  } else {
    if (!(p.steps || []).length) errors.push('preset ' + p.id + ' 没有步骤');
    (p.steps || []).forEach(function (s, i) {
      if (!s.ref) errors.push('preset ' + p.id + ' steps[' + i + '] 缺少 ref');
      else if (!snipIds[s.ref]) errors.push('preset ' + p.id + ' steps[' + i + '] 引用不存在的片段：' + s.ref);
    });
  }
  if (!p.summary) warns.push('preset ' + p.id + ' 没有 summary');
});

/* ---------- 5. 工作流 ---------- */
(D.flows || []).forEach(function (f) {
  const ks = Object.keys(f.nodes || {});
  if (!ks.length) { errors.push('flow ' + f.id + ' 没有节点'); return; }
  if (!f.nodes[f.root]) errors.push('flow ' + f.id + ' root 不存在：' + f.root);
  let ends = 0;
  ks.forEach(function (k) {
    const n = f.nodes[k];
    if (n.kind === 'end') ends++;
    if (!n.label) warns.push('flow ' + f.id + '.' + k + ' 没有 label');
    (n.children || []).forEach(function (c) {
      if (!f.nodes[c]) errors.push('flow ' + f.id + '.' + k + ' 指向不存在的子节点：' + c);
    });
  });
  if (!ends) errors.push('flow ' + f.id + ' 没有 end 结论节点');
});

/* ---------- 汇总 ---------- */
const ensp = D.categories.find(function (c) { return c.id === 'ensp'; });
const snipTotal = D.categories.reduce(function (a, c) { return a + (c.items || []).length; }, 0);

console.log('=== 合并统计 ===');
console.log(JSON.stringify(window.__ENSP_STATS));
console.log('=== 规模 ===');
console.log('eNSP 片段：' + ensp.items.length + '（全站 ' + snipTotal + '）');
console.log('实验：' + D.labs.length + ' / 预设：' + D.presets.length + ' / 工作流：' + D.flows.length);
console.log('命令词条：' + Object.keys(D.cmd).length + ' / 高亮词：' + D.keywords.length);
console.log('拓扑节点：' + topoNodeCount + ' / 变量引用：' + varCount);
console.log('=== 校验 ===');
console.log('错误：' + errors.length);
errors.slice(0, 40).forEach(function (e) { console.log('  ✗ ' + e); });
console.log('提醒：' + warns.length);
warns.slice(0, 20).forEach(function (w) { console.log('  · ' + w); });
if (errors.length) process.exitCode = 1;
