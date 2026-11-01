/* ============================================================
   全站内容自检：按 index.html 的加载顺序在 Node 里跑一遍，
   查 id 冲突、变量闭合、ref 失效、专题归属、工作流可达性。
   用法：node _dev/check-all.js
   ============================================================ */
'use strict';

global.window = {};
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };

require('../assets/data.js');
require('../assets/topics.js');
require('../assets/search.js');

['00-base', '10-basic', '20-adv', '30-pro', '40-labs', '50-presets-flows',
  '60-cmd', '70-cmd-query', '80-recipes', '82-recipes-route', '84-recipes-sec', '99-merge'
].forEach(function (f) { require('../assets/ensp/' + f + '.js'); });

['00-base', '10-servlet', '20-jsp', '30-jdbc', '40-mvc', '50-deploy',
  '60-labs', '70-presets-flows', '80-cmd', '99-merge'
].forEach(function (f) { require('../assets/javaweb/' + f + '.js'); });

['00-base', '10-htmlcss', '20-js', '30-jquery', '40-compat',
  '50-labs', '60-presets-flows', '70-cmd', '99-merge'
].forEach(function (f) { require('../assets/weblegacy/' + f + '.js'); });

const D = window.CODEATLAS;
const T = window.TOPICS;
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
function checkTask(p) {
  const t = p.task;
  const where = 'task ' + p.id;
  const env = t.env || {};
  const devIds = {};
  (t.devices || []).forEach(function (d, i) {
    if (!d.id) errors.push(where + ' devices[' + i + '] 缺少 id');
    else devIds[d.id] = 1;
  });
  if (!(t.steps || []).length) errors.push(where + ' 没有步骤');
  (t.steps || []).forEach(function (s, i) {
    if (!s.title) errors.push(where + ' steps[' + i + '] 缺少 title');
    if (!s.code) errors.push(where + ' steps[' + i + '] 缺少 code');
    if (!s.who) errors.push(where + ' steps[' + i + '] 缺少 who');
    else if (!devIds[s.who]) errors.push(where + ' steps[' + i + '] 指向未声明设备：' + s.who);
    varCount += checkVars(s.code, env, where + '/step' + i);
  });
  (t.verify || []).forEach(function (v, i) {
    if (!v.cmd) errors.push(where + ' verify[' + i + '] 缺少 cmd');
    if (!v.hope) errors.push(where + ' verify[' + i + '] 缺少 hope');
    if (v.who && !devIds[v.who]) errors.push(where + ' verify[' + i + '] 指向未声明设备：' + v.who);
    if (v.cmd) varCount += checkVars(v.cmd, env, where + '/verify' + i);
  });
  if (!(t.verify || []).length) warns.push(where + ' 没有验证清单');
}

(D.presets || []).forEach(function (p) {
  if (p.task) checkTask(p);
  else {
    if (!(p.steps || []).length) errors.push('preset ' + p.id + ' 没有步骤');
    (p.steps || []).forEach(function (s, i) {
      if (!s.ref) errors.push('preset ' + p.id + ' steps[' + i + '] 缺少 ref');
      else if (!snipIds[s.ref]) errors.push('preset ' + p.id + ' steps[' + i + '] 引用不存在的片段：' + s.ref);
    });
  }
  if (!p.summary) warns.push('preset ' + p.id + ' 没有 summary');
});

/* ---------- 5. 工作流（含可达性） ---------- */
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
    /* 结论节点引用的片段必须存在 */
    if (n.snippet && !snipIds[n.snippet]) {
      errors.push('flow ' + f.id + '.' + k + ' 引用了不存在的片段：' + n.snippet);
    }
  });
  if (!ends) errors.push('flow ' + f.id + ' 没有 end 结论节点');

  /* 从 root 走一遍，看有没有永远走不到的节点 */
  const reach = {};
  (function walk(id) {
    if (!id || reach[id] || !f.nodes[id]) return;
    reach[id] = 1;
    (f.nodes[id].children || []).forEach(walk);
  })(f.root);
  ks.forEach(function (k) {
    if (!reach[k]) errors.push('flow ' + f.id + '.' + k + ' 从 root 走不到（孤立节点）');
  });
});

/* ---------- 6. 专题 ---------- */
const topics = T.all();
const catOwner = {};
D.categories.forEach(function (c) {
  const tid = T.ofCat(c.id);
  catOwner[c.id] = tid;
});
topics.forEach(function (t) {
  if (!t.cats.length) errors.push('topic ' + t.id + ' 没有任何分类');
  t.cats.forEach(function (cid) {
    if (!D.categories.some(function (c) { return c.id === cid; })) {
      errors.push('topic ' + t.id + ' 指向不存在的分类：' + cid);
    }
  });
});
/* 每个分类必须恰好被一个专题认领 */
const claimed = {};
topics.forEach(function (t) {
  t.cats.forEach(function (cid) {
    if (claimed[cid]) errors.push('分类 ' + cid + ' 同时属于 ' + claimed[cid] + ' 和 ' + t.id);
    claimed[cid] = t.id;
  });
});
D.categories.forEach(function (c) {
  if (!claimed[c.id]) errors.push('分类 ' + c.id + ' 没有归属专题（侧栏会看不到）');
});

/* 内容条目的专题必须能对上 */
(D.labs || []).concat(D.presets || [], D.flows || []).forEach(function (x) {
  const tid = T.ofItem(x);
  if (!topics.some(function (t) { return t.id === tid; })) {
    errors.push(x.id + ' 的 topic 指向不存在的专题：' + tid);
  }
});

/* ---------- 汇总 ---------- */
const snipTotal = D.categories.reduce(function (a, c) { return a + (c.items || []).length; }, 0);

console.log('=== 专题 ===');
topics.forEach(function (t) {
  const n = t.cats.reduce(function (a, cid) {
    const c = D.categories.find(function (x) { return x.id === cid; });
    return a + (c ? (c.items || []).length : 0);
  }, 0);
  console.log('  ' + t.id + ' → ' + t.name + '：' + t.cats.length + ' 分类 / ' + n + ' 片段');
});

console.log('=== 规模 ===');
console.log('片段合计：' + snipTotal + ' / 实验：' + D.labs.length
  + ' / 预设：' + D.presets.length + ' / 工作流：' + D.flows.length);
console.log('命令词条：' + Object.keys(D.cmd).length + ' / 高亮词：' + D.keywords.length);
console.log('拓扑节点：' + topoNodeCount + ' / 变量引用：' + varCount);
console.log('合并统计：', JSON.stringify(window.__ENSP_STATS), JSON.stringify(window.__JW_STATS), JSON.stringify(window.__WEB_STATS));

/* 幂等性：再合并一遍，条数必须不变 */
const before = D.categories.reduce(function (a, c) { return a + (c.items || []).length; }, 0);
window.TOPICS.apply({
  topic: window.__JW.topic, cats: window.__JW.cats, items: window.__JW.items,
  labs: window.__JW.labs, presets: window.__JW.presets, flows: window.__JW.flows,
  cmd: window.__JW.cmd, cmdSrc: window.__JW.cmdSrc, kw: window.__JW.kw
});
const after = D.categories.reduce(function (a, c) { return a + (c.items || []).length; }, 0);
console.log('幂等检查：' + before + ' → ' + after + (before === after ? ' ✓' : ' ✗ 重复插入了'));
if (before !== after) errors.push('合并不幂等：重跑一次片段数从 ' + before + ' 变成 ' + after);

console.log('=== 校验 ===');
console.log('错误：' + errors.length);
errors.slice(0, 40).forEach(function (e) { console.log('  ✗ ' + e); });
console.log('提醒：' + warns.length);
warns.slice(0, 20).forEach(function (w) { console.log('  · ' + w); });
if (errors.length) process.exitCode = 1;
