/* ============================================================
   check-skins.js —— 皮肤包自检（纯 Node，不需要 Electron / 依赖）

   查的是「肉眼看不出、但在透明窗口里会露馅」的那几件事：
   1. skins.js 的 LIST 里每套皮肤，styles.css 里都有对应选择器
   2. 每套皮肤把 :root 里定义的颜色变量写全了（漏一个就露出上一套的颜色）
   3. **--hud-rgb 必须与 --bg 完全一致** —— 悬浮窗卡片底色是
      rgba(var(--hud-rgb), --hud-a)，不一致的话换肤后卡片会带一层旧色
   4. index.html 首屏内联的 MODE / BG 表与 skins.js 同步
   5. 旧的主题开关（.theme-btn / data-theme-toggle）已清干净

   用法：node _dev/check-skins.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'assets/styles.css'), 'utf8');
const skinsSrc = fs.readFileSync(path.join(ROOT, 'assets/skins.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const fails = [];
function ok(msg) { pass++; console.log('  \u2713 ' + msg); }
function bad(msg) { fails.push(msg); console.log('  \u00d7 ' + msg); }
function eq(a, b, msg) { a === b ? ok(msg) : bad(msg + '（实际 ' + JSON.stringify(a) + '，应为 ' + JSON.stringify(b) + '）'); }

/* ---------- 取 CSS 块（按大括号配对，不做嵌套假设） ---------- */
function blockOf(selector) {
  const at = css.indexOf(selector);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

function varsOf(body) {
  const out = {};
  const re = /(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(body || ''))) out[m[1]] = m[2].trim();
  return out;
}

/* 结构性变量（尺寸 / 字体 / 缓动），不需要每套皮肤重写 */
const STRUCT = /^--(r|r-sm|r-lg|r-xl|mono|sans|rail-w|list-w|docs-w|ease|hud-a)$/;

/* ---------- 从 skins.js 里取 LIST ---------- */
const listMatch = skinsSrc.match(/var LIST = \[([\s\S]*?)\n  \];/);
if (!listMatch) {
  console.error('ERR 解析不到 assets/skins.js 里的 LIST');
  process.exit(1);
}
const entries = [];
const objRe = /\{ id: '([^']+)', name: '([^']+)', desc: '([^']+)', mode: '(dark|light)',[\s\S]*?p: \{([^}]+)\} \}/g;
let mm;
while ((mm = objRe.exec(listMatch[1]))) {
  const p = {};
  mm[5].replace(/(\w+): '([^']*)'/g, (_, k, v) => { p[k] = v; });
  entries.push({ id: mm[1], name: mm[2], desc: mm[3], mode: mm[4], p });
}

console.log('\n皮肤包自检 —— ' + entries.length + ' 套\n');

if (entries.length < 2) bad('LIST 解析结果异常，至少应有两套皮肤');

/* ---------- 1. id / 字段唯一性 ---------- */
const ids = entries.map(e => e.id);
new Set(ids).size === ids.length ? ok('id 无重复：' + ids.join(' / ')) : bad('id 有重复：' + ids.join(' / '));
entries.forEach(e => {
  e.name && e.desc && e.p.bg && e.p.iris ? null : bad('皮肤 ' + e.id + ' 的 name/desc/预览色不全');
});
ok('每套皮肤都有 name / desc / 预览色');

/* ---------- 2. 变量基准表取自 :root ---------- */
const rootVars = varsOf(blockOf(':root {'));
const baseKeys = Object.keys(rootVars).filter(k => !STRUCT.test(k));
console.log('\n  变量基准：' + baseKeys.length + ' 个（取自 :root，即默认皮肤「深空」）');

/* ---------- 3. 逐套核对 CSS ---------- */
console.log('');
for (const e of entries) {
  const sel = 'html[data-skin="' + e.id + '"] {';
  /* 默认皮肤就是 :root 本身，不需要自己的选择器 */
  const body = e.id === 'midnight' ? blockOf(':root {') : blockOf(sel);
  if (!body) { bad(e.id + '（' + e.name + '）在 styles.css 里找不到选择器 ' + sel); continue; }

  const v = varsOf(body);
  const miss = baseKeys.filter(k => !(k in v));
  if (miss.length) bad(e.id + '（' + e.name + '）漏了 ' + miss.length + ' 个变量：' + miss.join(', '));
  else ok(e.id + '（' + e.name + '）' + baseKeys.length + ' 个变量写全');

  /* --hud-rgb 与 --bg 一致 —— 这条最要紧，透明窗口里一眼就能看出色偏 */
  const bg = v['--bg'];
  const hud = v['--hud-rgb'];
  if (!bg) { bad(e.id + ' 没有 --bg'); continue; }
  if (!hud) { bad(e.id + ' 没有 --hud-rgb'); continue; }
  const rgb = hexToRgb(bg);
  const got = hud.split(',').map(s => Number(s.trim()));
  if (!rgb) { bad(e.id + ' 的 --bg 不是 6 位 hex：' + bg); continue; }
  if (rgb.join(',') === got.join(',')) ok('  ↳ --hud-rgb 与 --bg 一致（' + bg + '）');
  else bad(e.id + ' 的 --hud-rgb 与 --bg 不一致：--bg=' + bg + '（' + rgb.join(', ') + '）但 --hud-rgb=' + hud +
    ' → 悬浮窗卡片会带上不属于这套皮肤的底色');

  /* mode 与这套皮肤自己写的 color-scheme 对得上 */
  const cs = (body.match(/color-scheme\s*:\s*(light|dark)/) || [])[1];
  if (cs !== e.mode) bad(e.id + ' 声明 mode=' + e.mode + '，但块里的 color-scheme 是 ' + (cs || '（没写）'));
  else ok('  \u21b3 color-scheme: ' + cs);
}

function hexToRgb(h) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(h || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ---------- 4. index.html 首屏内联表与 skins.js 同步 ---------- */
console.log('');
const modeInline = {};
const bgInline = {};
const modeSeg = html.match(/var MODE = \{([\s\S]*?)\};/);
const bgSeg = html.match(/var BG   = \{([\s\S]*?)\};/);
if (modeSeg) modeSeg[1].replace(/(\w+):\s*'([^']+)'/g, (_, k, v) => { modeInline[k] = v; });
if (bgSeg) bgSeg[1].replace(/(\w+):\s*'([^']+)'/g, (_, k, v) => { bgInline[k] = v; });

entries.forEach(e => {
  if (modeInline[e.id] !== e.mode) bad('index.html 内联 MODE.' + e.id + ' = ' + modeInline[e.id] + '，应为 ' + e.mode);
  if (bgInline[e.id] !== e.p.bg) bad('index.html 内联 BG.' + e.id + ' = ' + bgInline[e.id] + '，应为 ' + e.p.bg);
});
if (entries.every(e => modeInline[e.id] === e.mode && bgInline[e.id] === e.p.bg)) {
  ok('首屏内联 MODE / BG 与 skins.js 完全同步（防换肤闪一下默认色）');
}

/* ---------- 5. 旧主题开关清理干净 ---------- */
const leftovers = [];
if (/data-theme-toggle/.test(html)) leftovers.push('index.html 还有 data-theme-toggle');
if (/data-theme-toggle/.test(fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8'))) leftovers.push('app.js 还有 data-theme-toggle');
if (/\.theme-btn/.test(css)) leftovers.push('styles.css 还有 .theme-btn');
leftovers.length ? bad(leftovers.join('；')) : ok('旧主题开关已清干净（不会点出两套逻辑）');

/* ---------- 6. 透明窗那两层兜底还在 ---------- */
console.log('');
const hudBlock = blockOf('html[data-hud="1"] #hudShell {');
if (!hudBlock) bad('找不到 html[data-hud="1"] #hudShell 的样式块');
else {
  const hasRgba = /background:\s*rgba\(var\(--hud-rgb/.test(hudBlock);
  const hasMix = /color-mix\(in srgb, var\(--bg\)/.test(hudBlock);
  hasRgba ? ok('卡片底色第一层兜底 rgba(var(--hud-rgb), --hud-a) 在') : bad('卡片背景的 rgba(--hud-rgb) 兜底被删了');
  hasMix ? ok('卡片底色第二层 color-mix（直接吃 --bg）在') : bad('卡片背景的 color-mix(--bg) 被删了');
}
const zeroBg = blockOf('html[data-hud="1"],');
zeroBg && /background:\s*transparent\s*!important/.test(zeroBg)
  ? ok('悬浮窗根节点强制 transparent（四角是真透明像素）')
  : bad('悬浮窗根节点的 background: transparent !important 不见了');

/* ---------- 结果 ---------- */
console.log('\n' + (fails.length ? '\u2717 ' + fails.length + ' 项待修' : '\u2713 全部通过') +
  '　（' + pass + ' 项通过）\n');
if (fails.length) {
  fails.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  console.log('');
  process.exit(1);
}
