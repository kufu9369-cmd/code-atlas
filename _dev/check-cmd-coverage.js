/* ============================================================
   码典 · 命令覆盖度体检
   ------------------------------------------------------------
   思路：把内置片段 / 实验步骤里**真实出现过的命令词**抽出来，
   统计词频，再和命令词典 + 高亮词比对，列出「代码里在用、词典里没有」
   的高频命令。这样补词条有据可依，不靠拍脑袋。
   用法：node _dev/check-cmd-coverage.js [显示条数]
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
['00-base', '10-basic', '20-adv', '30-pro', '40-labs', '50-presets-flows', '60-cmd', '70-cmd-query', '99-merge']
  .forEach(f => require(path.join(__dirname, '..', 'assets', 'ensp', f + '.js')));

const D = global.CODEATLAS;
const CMD = D.cmd;
const KW = new Set(D.keywords.map(k => String(k).toLowerCase()));

/* 字典里出现过的单词（把 "display isis peer" 拆成 display/isis/peer） */
const CMD_WORDS = new Set();
Object.keys(CMD).forEach(k => k.split(/\s+/).forEach(w => CMD_WORDS.add(w.toLowerCase())));

/* 这些是参数/关键字，不是命令本体，统计时忽略 */
const SKIP = new Set(('undo quit exit return save y n yes no all both enable disable '
  + 'permit deny inbound outbound import export protocol ip ipv4 ipv6 mac vlan interface '
  + 'to from with use in on for by as at of is and or not start end').split(/\s+/));

function collectLines(text, out) {
  String(text || '').split('\n').forEach(line => {
    const s = line.trim();
    if (!s || s.startsWith('#') || s.startsWith('!') || s.startsWith('//')) return;
    const w = s.split(/[\s;]+/)[0].replace(/[:<>\[\]]/g, '');
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(w)) return;
    out.push(w.toLowerCase());
  });
}

const freq = new Map();
const bump = w => freq.set(w, (freq.get(w) || 0) + 1);
const lines = [];

D.categories.forEach(c => (c.items || []).forEach(it => {
  lines.length = 0;
  collectLines(it.code, lines);
  (it.variants || []).forEach(v => collectLines(v.code, lines));
  lines.forEach(bump);
}));
(D.labs || []).forEach(l => (l.steps || []).forEach(st => {
  lines.length = 0;
  collectLines(st.code, lines);
  lines.forEach(bump);
}));
(D.presets || []).forEach(p => (p.steps || []).forEach(st => {
  lines.length = 0;
  collectLines(st.code, lines);
  lines.forEach(bump);
}));

const rows = [];
freq.forEach((n, w) => {
  if (SKIP.has(w) || w.length < 3) return;
  const inDict = CMD_WORDS.has(w) || CMD[w] !== undefined;
  const inKw = KW.has(w);
  if (!inDict) rows.push({ w, n, inKw });
});
rows.sort((a, b) => b.n - a.n || (a.w < b.w ? -1 : 1));

const LIMIT = Number(process.argv[2] || 40);
console.log('代码里出现过的不同命令词：' + freq.size);
console.log('命令词典词条：' + Object.keys(CMD).length + '（拆词后 ' + CMD_WORDS.size + ' 个词）');
console.log('高亮词：' + KW.size);
console.log('\n—— 代码里在用、词典里没有的（按出现次数）——');
if (!rows.length) console.log('（无缺口）');
rows.slice(0, LIMIT).forEach((r, i) => {
  console.log(String(i + 1).padStart(2) + '. ' + r.w.padEnd(26)
    + ' 出现 ' + String(r.n).padStart(3) + ' 次'
    + (r.inKw ? '  [高亮词里有]' : ''));
});
console.log('\n合计缺口 ' + rows.length + ' 个词');
