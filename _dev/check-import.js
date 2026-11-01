/* ============================================================
   知识包导入链路自检
   ------------------------------------------------------------
   在 Node 里按 index.html 的顺序把应用装起来，然后像用户那样
   走一遍：粘文本 → normalize（校验）→ conflicts（冲突）→
   install（写 localStorage）→ apply（模拟刷新后合并）。

   用法：node _dev/check-import.js
   ============================================================ */
'use strict';

/* ---------- 假浏览器 ---------- */
const STORE = {};
global.window = {};
global.localStorage = {
  getItem: k => (k in STORE ? STORE[k] : null),
  setItem: (k, v) => { STORE[k] = String(v); },
  removeItem: k => { delete STORE[k]; },
  clear: () => { Object.keys(STORE).forEach(k => delete STORE[k]); }
};

require('../assets/data.js');
require('../assets/topics.js');
require('../assets/search.js');
['00-base', '10-basic', '20-adv', '30-pro', '40-labs', '50-presets-flows',
  '60-cmd', '70-cmd-query', '80-recipes', '82-recipes-route', '84-recipes-sec',
  '99-merge'].forEach(f => require('../assets/ensp/' + f + '.js'));
['00-base', '10-servlet', '20-jsp', '30-jdbc', '40-mvc', '50-deploy',
  '60-labs', '70-presets-flows', '80-cmd', '99-merge'].forEach(f => require('../assets/javaweb/' + f + '.js'));
['00-base', '10-htmlcss', '20-js', '30-jquery', '40-compat',
  '50-labs', '60-presets-flows', '70-cmd', '99-merge'].forEach(f => require('../assets/weblegacy/' + f + '.js'));
require('../assets/packs.js');

const D = window.CODEATLAS;
const T = window.TOPICS;
const P = window.PACKS;
const fs = require('fs');
const path = require('path');

/* ---------- 断言 ---------- */
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name + (detail ? '｜' + detail : '')); console.log('  ✗ ' + name + (detail ? '｜' + detail : '')); }
}

/* 走一遍真实链路，返回各阶段结果 */
function trial(text, opts) {
  opts = opts || {};
  const n = P.normalize(text);
  const out = { step: 'normalize', norm: n, conflict: null, install: null };
  if (n.errors.length || !n.pack) { out.step = 'blocked-at-normalize'; return out; }
  const bad = P.conflicts(n.pack);
  out.conflict = bad;
  if (bad.length && !opts.ignoreConflict) { out.step = 'blocked-at-conflict'; return out; }
  out.install = P.install(n.pack);
  out.step = out.install.ok ? 'installed' : 'blocked-at-storage';
  return out;
}
function store() { try { return JSON.parse(localStorage.getItem('codeatlas.packs.v1') || '[]'); } catch (e) { return []; } }
function reset() { localStorage.clear(); }
/* 模拟刷新：boot 就是把每个已装包 apply 一遍 */
function boot() {
  const d = window.CODEATLAS;
  store().forEach(p => { if (p && p.data) P.apply(d, p.data); });
}
function findSnippet(id) {
  for (const c of D.categories) for (const it of (c.items || [])) if (it.id === id) return { cat: c, item: it };
  return null;
}
function findLab(id) { return (D.labs || []).find(l => l.id === id) || null; }
function findFlow(id) { return (D.flows || []).find(f => f.id === id) || null; }

function base() {
  const before = {
    snip: D.categories.reduce((a, c) => a + (c.items || []).length, 0),
    labs: (D.labs || []).length, presets: (D.presets || []).length, flows: (D.flows || []).length,
    cats: D.categories.length
  };
  return before;
}

/* ============================================================
   用例 0：仓库自带的示例包（README 让用户第一个试的就是它）
   ============================================================ */
console.log('\n=== 0. examples/ospf-adv.pack.json（README 首推） ===');
{
  const p = path.join(__dirname, '..', 'examples', 'ospf-adv.pack.json');
  const raw = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
  ok('示例文件存在', !!raw, p);
  if (raw) {
    reset();
    const r = trial(raw);
    console.log('    阶段：' + r.step);
    if (r.conflict && r.conflict.length) console.log('    冲突：' + r.conflict.join('、'));
    if (r.norm.errors.length) console.log('    错误：' + r.norm.errors.slice(0, 5).join(' / '));
    ok('示例包能导入（README 承诺"粘进去就能看到效果"）', r.step === 'installed',
      r.step === 'installed' ? '' : '实际被挡在 ' + r.step);
  }
}

/* ============================================================
   用例 1：全新 id 的最小包 —— 确认基本链路是通的
   ============================================================ */
console.log('\n=== 1. 全新 id 的最小包（链路 baseline） ===');
{
  reset();
  const txt = JSON.stringify({
    id: 'test-min', name: '最小测试包', version: '1.0',
    categories: [{ id: 'test-min-cat', name: '测试分类', icon: 'code', short: '测试', ext: 'txt',
      items: [{ id: 'test-min-1', title: '测试片段', desc: '说明', tags: ['测试'],
        code: 'echo {{word}}', vars: { word: { label: '词', value: 'hi', desc: '随便一个词' } } }] }]
  });
  const r = trial(txt);
  ok('能通过校验并写入存储', r.step === 'installed', r.step);
  ok('存储里有一条包记录', store().length === 1);
  /* 刷新 */
  const b = base();
  boot();
  const hit = findSnippet('test-min-1');
  ok('刷新后片段出现在数据层', !!hit, hit ? hit.cat.id : '找不到');
  ok('落在包里声明的分类里', hit && hit.cat.id === 'test-min-cat');
  ok('片段数 +1', base().snip === b.snip + 1, b.snip + ' → ' + base().snip);
  ok('新分类能被专题认领（不会"导进来却看不见"）', T.ofCat('test-min-cat') === 'cat:test-min-cat',
    '实际：' + T.ofCat('test-min-cat'));
  ok('专题层能列出来', T.all().some(t => t.id === 'cat:test-min-cat'));
}

/* ============================================================
   用例 2：AI 回答的常见形态（markdown 围栏 + 客套话）
   ============================================================ */
console.log('\n=== 2. AI 回答：围栏 + 前后客套话 ===');
{
  reset();
  const body = '{"id":"test-ai","name":"AI 包","categories":[{"id":"test-ai-cat","name":"AI 分类","items":[{"id":"test-ai-1","title":"T","desc":"D","code":"ls -l","vars":{}}]}]}';
  const txt = '好的，下面是我为你整理的知识包：\n\n```json\n' + body + '\n```\n\n需要我再补充别的命令吗？';
  const r = trial(txt);
  ok('带围栏 + 客套话能解析', r.step === 'installed', r.step + (r.norm.errors.length ? '｜' + r.norm.errors[0] : ''));
}

/* ============================================================
   用例 3：snippets + category 老写法（README 之外的兼容路径）
   ============================================================ */
console.log('\n=== 3. snippets/category 扁平写法 ===');
{
  reset();
  const txt = JSON.stringify({
    id: 'test-flat', name: '扁平包',
    category: { id: 'test-flat-cat', name: '扁平分类', icon: 'term', short: '扁平', ext: 'sh' },
    snippets: [{ id: 'test-flat-1', title: 'T', desc: 'D', code: 'echo 1', vars: {} }]
  });
  const r = trial(txt);
  ok('扁平写法能导入', r.step === 'installed', r.step + (r.norm.errors.length ? '｜' + r.norm.errors[0] : ''));
}

/* ============================================================
   用例 4：全量导出 → 原样导入（README 说"可以全量导出，改完再导回来"）
   ============================================================ */
console.log('\n=== 4. 全量导出后原样导回（round-trip） ===');
{
  reset();
  window.CodeAtlas = {
    values: { 'task:preset-l3-office|vlanId': '30' },
    favorites: ['snippet:test-x'],
    taskProgress: { 'preset-l3-office': { done: { 0: true }, verify: {} } }
  };
  const all = P.exportAll();
  const task = all.presets.find(p => p.id === 'preset-l3-office');
  ok('全量导出包含配置剧本', all.recipes.length === (D.recipes || []).length,
    all.recipes.length + ' / ' + (D.recipes || []).length);
  ok('全量导出保留任务的设备/步骤/验证', !!(task && task.task && task.task.steps.length === 12 && task.task.devices.length >= 3),
    task && task.task ? task.task.steps.length + ' 步 / ' + task.task.devices.length + ' 设备' : '任务丢失');
  ok('全量导出保留收藏、变量和任务进度', all.userdata && all.userdata.values['task:preset-l3-office|vlanId'] === '30'
    && all.userdata.favorites.indexOf('snippet:test-x') >= 0
    && all.userdata.task['preset-l3-office'].done[0] === true);

  const r = trial(JSON.stringify(all));
  console.log('    阶段：' + r.step);
  if (r.conflict) console.log('    冲突条数：' + r.conflict.length + '，前 3 条：' + r.conflict.slice(0, 3).join('、'));
  ok('全量导出能原样导回（README 承诺"改完再导回来"）', r.step === 'installed',
    r.step === 'blocked-at-conflict' ? r.conflict.length + ' 个 id 全部判为冲突' : r.step);

  const back = r.norm && r.norm.pack;
  const backTask = back && back.presets.find(p => p.id === 'preset-l3-office');
  ok('导入后的任务字段没有降级', !!(backTask && backTask.task && backTask.task.steps.length === 12
    && backTask.task.env.vlanId && backTask.task.verify.length === 5),
    backTask && backTask.task ? JSON.stringify({ steps: backTask.task.steps.length, verify: backTask.task.verify.length, env: Object.keys(backTask.task.env).length }) : '任务丢失');
  ok('导入后剧本和用户数据仍在', !!(back && back.recipes.length === (D.recipes || []).length
    && back.userdata && back.userdata.favorites.length === 1));
  delete window.CodeAtlas;
}
{
  /* 用户真会这么干：导出 → 改个 id 想导回 */
  reset();
  const all = P.exportAll();
  all.id = 'my-backup';
  const r = trial(JSON.stringify(all));
  ok('只改包 id 也能导回（不要求同时改片段 id）', r.step === 'installed',
    r.step === 'blocked-at-conflict' ? r.conflict.length + ' 个片段 id 判冲突' : r.step);
}
{
  /* 关键：导回之后，改的内容到底有没有生效（否则「改完再导回来」是句空话） */
  reset();
  const all = P.exportAll();
  const target = all.categories[0].items[0];
  const oldId = target.id, newTitle = '【改过的标题】';
  target.title = newTitle;
  const r = trial(JSON.stringify(all));
  if (r.step === 'installed') {
    boot();
    const hit = findSnippet(oldId);
    ok('导回的改动真的替换了原条目', hit && hit.item.title === newTitle,
      hit ? '实际标题 = ' + hit.item.title : '片段不见了');
    ok('替换不会让条目重复', D.categories.reduce((a, c) =>
      a + (c.items || []).filter(i => i.id === oldId).length, 0) === 1);
  } else ok('改名后的导出包能导回', false, r.step);
}

/* ============================================================
   用例 5：重复导入同一个包（幂等）
   ============================================================ */
console.log('\n=== 5. 同一个包连导两次 ===');
{
  reset();
  const txt = JSON.stringify({
    id: 'test-twice', name: '双导包',
    categories: [{ id: 'test-twice-cat', name: '双导分类',
      items: [{ id: 'test-twice-1', title: 'T', desc: 'D', code: 'echo 1', vars: {} }] }]
  });
  const r1 = trial(txt);
  const r2 = trial(txt);
  ok('第一次导入成功', r1.step === 'installed', r1.step);
  ok('第二次判为覆盖（不是冲突）', r2.step === 'installed' && r2.install && r2.install.replaced === true,
    r2.step);
  ok('存储里仍然只有一条', store().length === 1, '实际 ' + store().length + ' 条');
  const b = base();
  boot(); boot();
  ok('刷新两次片段不重复', findSnippet('test-twice-1') && base().snip === b.snip + 1, b.snip + ' → ' + base().snip);
}

/* ============================================================
   用例 6：往现有分类续内容（分类 id 撞车）
   ============================================================ */
console.log('\n=== 6. 往现有分类续内容 ===');
{
  reset();
  const txt = JSON.stringify({
    id: 'test-append', name: '续写包',
    categories: [{ id: 'ensp', name: '华为 eNSP', items: [
      { id: 'test-append-1', title: 'T', desc: 'D', code: 'display clock', vars: {} }] }]
  });
  const r = trial(txt);
  ok('分类 id 撞车不算冲突', r.step === 'installed',
    r.step === 'blocked-at-conflict' ? r.conflict.join('、') : r.step);
  const b = base();
  boot();
  const hit = findSnippet('test-append-1');
  ok('片段并进 ensp 分类', hit && hit.cat.id === 'ensp');
  ok('没有多出重复分类', base().cats === b.cats, b.cats + ' → ' + base().cats);
}

/* ============================================================
   用例 7：id 写成大写 / 下划线（AI 很常见的写法）
   ============================================================ */
console.log('\n=== 7. id 含大写/下划线，预设 ref 是否还连得上 ===');
{
  reset();
  const txt = JSON.stringify({
    id: 'TestUnder', name: '大小写测试',
    categories: [{ id: 'Test_Under_Cat', name: 'C', items: [
      { id: 'Test_Snippet_1', title: 'T', desc: 'D', code: 'ls', vars: {} }] }],
    presets: [{ id: 'Test_Preset_1', title: 'P', summary: 'S', steps: [{ ref: 'Test_Snippet_1' }] }]
  });
  const r = trial(txt);
  ok('大写/下划线 id 能导入', r.step === 'installed',
    r.step + (r.norm.errors.length ? '｜' + r.norm.errors.slice(0, 3).join(' / ') : ''));
  if (r.step === 'installed') {
    boot();
    const pre = (D.presets || []).find(x => x.id === 'test-preset-1');
    ok('预设的 ref 仍然指向存在的片段', pre && !!findSnippet(pre.steps[0].ref),
      pre ? 'ref = ' + pre.steps[0].ref : '预设没落进数据层');
  }
}

/* ============================================================
   用例 8：片段带的 level / topic 字段是否保留
   ============================================================ */
console.log('\n=== 8. 片段 level 字段（决定"入门/进阶/综合"分组） ===');
{
  reset();
  const txt = JSON.stringify({
    id: 'test-level', name: '难度包',
    categories: [{ id: 'test-level-cat', name: 'C', items: [
      { id: 'test-level-1', title: 'T', desc: 'D', code: 'ls', level: '入门', vars: {} }] }]
  });
  const r = trial(txt);
  if (r.step === 'installed') {
    boot();
    const hit = findSnippet('test-level-1');
    ok('level 保留下来了', hit && hit.item.level === '入门',
      '实际 level = ' + (hit ? JSON.stringify(hit.item.level) : 'N/A'));
  } else ok('level 用例本身能导入', false, r.step);
}

/* ============================================================
   用例 9：内容为空 / 缺 code 的边界
   ============================================================ */
console.log('\n=== 9. 边界 ===');
{
  reset();
  const r = trial('{"id":"empty","name":"空包"}');
  ok('空包被挡（提示"包里没有任何内容"）',
    r.step === 'blocked-at-normalize' && r.norm.errors.some(e => /没有任何内容/.test(e)),
    r.norm.errors.join(' / '));
}
{
  reset();
  const r = trial('{"id":"a","name":"A","categories":[{"id":"a1","name":"A1","items":[{"id":"x1","title":"T","vars":{}}]}]}');
  ok('缺 code 被挡且提示到具体条目',
    r.step === 'blocked-at-normalize' && r.norm.errors.some(e => /没有 code|缺少 code/.test(e)),
    r.norm.errors.join(' / '));
}
{
  reset();
  const r = trial('{ "id": "x", "name": "X", }');
  ok('多余逗号提示能看懂（中文）',
    r.step === 'blocked-at-normalize' && r.norm.errors.some(e => /逗号/.test(e)),
    r.norm.errors.join(' / '));
}
{
  reset();
  const r = trial('{“id”: “x”, “name”: “X”}');
  ok('中文引号提示能看懂（中文）',
    r.step === 'blocked-at-normalize' && r.norm.errors.some(e => /中文引号/.test(e)),
    r.norm.errors.join(' / '));
}

/* ============================================================
   用例 10：导入的实验/预设/工作流归到哪个专题
   ------------------------------------------------------------
   专题过滤靠 topic 字段；包里的实验如果丢了这个字段，
   就会一律落到默认专题 —— 表现为「导入成功但哪儿都找不到」。
   ============================================================ */
console.log('\n=== 10. 导入的实验归到哪个专题 ===');
{
  reset();
  const txt = JSON.stringify({
    id: 'test-topic', name: '专题归属包',
    categories: [{ id: 'test-topic-cat', name: 'C', items: [
      { id: 'test-topic-s1', title: 'T', desc: 'D', code: 'ls', vars: {} }] }],
    labs: [{ id: 'test-topic-lab', title: 'JavaWeb 实验', level: '入门',
      topic: 'javaweb',
      vars: {}, steps: [{ title: 'S', code: 'ls' }],
      verify: [{ cmd: 'ls', hope: 'ok' }], pitfalls: ['x'] }]
  });
  const r = trial(txt);
  ok('带 topic 的包能导入', r.step === 'installed', r.step);
  if (r.step === 'installed') {
    boot();
    const lab = findLab('test-topic-lab');
    ok('实验落进数据层', !!lab);
    ok('包里显式写的 topic 被保留', lab && lab.topic === 'javaweb',
      '实际 topic = ' + (lab ? JSON.stringify(lab.topic) : 'N/A'));
    if (lab) {
      ok('专题层把它算在 javaweb', T.ofItem(lab) === 'javaweb', '实际归到 ' + T.ofItem(lab));
    }
  }
}
{
  /* 没写 topic，但分类是 javaweb 下真实存在的 javaweb-servlet —— 应该跟着分类走 */
  reset();
  const txt = JSON.stringify({
    id: 'test-topic2', name: '跟随分类包',
    categories: [{ id: 'javaweb-servlet', name: 'Servlet', items: [
      { id: 'test-topic2-s1', title: 'T', desc: 'D', code: 'ls', vars: {} }] }],
    labs: [{ id: 'test-topic2-lab', title: 'Servlet 实验', level: '入门',
      vars: {}, steps: [{ title: 'S', code: 'ls' }],
      verify: [{ cmd: 'ls', hope: 'ok' }], pitfalls: ['x'] }]
  });
  const r = trial(txt);
  if (r.step === 'installed') {
    boot();
    const lab = findLab('test-topic2-lab');
    ok('往 javaweb-servlet 分类续内容时，实验跟着分类归 javaweb',
      lab && T.ofItem(lab) === 'javaweb',
      lab ? '实际归到 ' + T.ofItem(lab) + '（会出现在错误的专题里）' : '实验没落进数据层');
  } else ok('跟随分类包能导入', false, r.step);
}

/* ---------- docs.src.u 的容错 ----------
   用户报过：导入一直停在「有 1 处要改 · docs.src.u 必须是 https 链接」，
   改完还是过不去。根因是前导空格、大写协议、中文冒号这些都被当成错，
   而提示既不显示实际值、也不说是哪一条。 */
console.log('\n=== docs.src.u 容错 ===');

function urlPack(u) {
  return JSON.stringify({
    id: 'test-url', name: '链接容错包',
    categories: [{ id: 'urltest', name: 'URL 测试', items: [
      { id: 'test-url-s1', title: '链接测试片段', desc: 'D', code: 'display version',
        docs: { src: { t: 'Huawei', u: u } } }] }]
  });
}

[
  ['https://support.huawei.com/x', 'https://support.huawei.com/x', false, '规范写法原样保留'],
  ['HTTPS://support.huawei.com/x', 'https://support.huawei.com/x', false, '大写协议转小写'],
  [' https://support.huawei.com/x', 'https://support.huawei.com/x', false, '前导空格去掉'],
  ['https://support.huawei.com/x ', 'https://support.huawei.com/x', false, '尾随空格去掉'],
  ['https：//support.huawei.com/x', 'https://support.huawei.com/x', false, '中文冒号修正'],
  ['//support.huawei.com/x', 'https://support.huawei.com/x', false, '协议相对补 https:'],
  ['support.huawei.com/x', 'https://support.huawei.com/x', false, '漏写协议自动补'],
  ['https:\\support.huawei.com\\x', 'https://support.huawei.com/x', false, '反斜杠修正'],
  ['http://support.huawei.com/x', 'http://support.huawei.com/x', false, 'http 保留原值，不瞎升级'],
  ['   ', undefined, false, '纯空格当作没写'],
  ['', undefined, false, '空字符串当作没写'],
  ['docs/README.md', 'docs/README.md', true, '确实不像链接才拦']
].forEach(([input, expect, block, label]) => {
  const r = P.normalize(urlPack(input));
  const err = r.errors.filter(e => e.indexOf('docs.src.u') >= 0);
  const item = r.pack && r.pack.cats[0] && r.pack.cats[0].items[0];
  const got = item && item.docs && item.docs.src ? item.docs.src.u : undefined;
  ok(label + (block ? '（拦下）' : '（放行）'),
    (block ? err.length > 0 : err.length === 0) && got === expect,
    '拦=' + (err.length > 0) + ' 值=' + JSON.stringify(got) + ' 期望=' + JSON.stringify(expect));
});

{
  const r = P.normalize(urlPack(' docs/README.md'));
  const all = r.errors.join('\n');
  ok('拦下时报错带片段标题', all.indexOf('链接测试片段') >= 0, all.slice(0, 120));
  ok('拦下时报错带实际值', all.indexOf('docs/README.md') >= 0, all.slice(0, 120));
}

{
  const r = P.normalize(urlPack('HTTPS://x.com/a'));
  const all = r.warnings.join('\n');
  ok('自动修正时留一条警告说明改了什么',
    all.indexOf('已自动修正') >= 0 && all.indexOf('https://x.com/a') >= 0, all.slice(0, 140));
}

{
  const r = P.normalize(urlPack('http://x.com/a'));
  const all = r.warnings.join('\n');
  ok('http 明确提示「不是 https」而不是闷掉',
    all.indexOf('http 不是 https') >= 0, all.slice(0, 140));
}

{
  /* docs 写成 { src: "https://..." } 这种 AI 常见写法也要能用 */
  const raw = JSON.stringify({
    id: 'test-url2', name: '怪写法包',
    categories: [{ id: 'urltest2', name: 'URL2', items: [
      { id: 'test-url2-s1', title: '怪写法', desc: 'D', code: 'ls',
        docs: { src: 'https://x.com/a' } }] }]
  });
  const r = P.normalize(raw);
  const item = r.pack && r.pack.cats[0] && r.pack.cats[0].items[0];
  ok('docs.src 写成字符串也能认出链接',
    !r.errors.length && item && item.docs.src.u === 'https://x.com/a',
    r.errors.join(' / ') || JSON.stringify(item && item.docs));
}

/* ---------- 汇总 ---------- */
console.log('\n=== 汇总 ===');
console.log('通过 ' + pass + ' / 失败 ' + fail);
if (fails.length) {
  console.log('失败项：');
  fails.forEach(f => console.log('  ✗ ' + f));
  process.exitCode = 1;
}
