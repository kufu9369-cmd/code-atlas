/* ============================================================
   码典 · eNSP 合并器（必须最后加载，且在 packs.js 之前）
   ------------------------------------------------------------
   做三件事：
   1. 把三个难度分片里的内容并进现有 ensp 分类，不新建侧栏项；
   2. 按 id 去重 —— 已存在的一条都不重复插入（用户明确要求「不重复显示」）；
   3. 片段按 入门 → 进阶 → 综合 排序，同类内保持原有先后（稳定排序）。
   ============================================================ */
(function () {
  'use strict';

  var D = window.CODEATLAS;
  var E = window.__ENSP;
  if (!D) { console.error('[ensp] 缺少 CODEATLAS 数据，检查 script 顺序'); return; }
  if (!E) { console.error('[ensp] 缺少 00-base.js，检查 script 顺序'); return; }

  var RANK = { '入门': 0, '进阶': 1, '综合': 2 };

  /* ---------- 找到（或补建）eNSP 分类 ---------- */
  var cat = null;
  for (var i = 0; i < D.categories.length; i++) {
    if (D.categories[i].id === 'ensp') { cat = D.categories[i]; break; }
  }
  if (!cat) {
    cat = { id: 'ensp', name: '华为 eNSP', icon: 'switch', short: 'eNSP', ext: 'cfg', items: [] };
    D.categories.unshift(cat);
  }

  /* ---------- 现有 id 快照（跨分类，片段 id 全局唯一） ---------- */
  var snipIds = {}, labIds = {}, preIds = {}, flowIds = {};
  D.categories.forEach(function (c) {
    (c.items || []).forEach(function (it) { snipIds[it.id] = 1; });
  });
  (D.labs || []).forEach(function (l) { labIds[l.id] = 1; });
  (D.presets || []).forEach(function (p) { preIds[p.id] = 1; });
  (D.flows || []).forEach(function (f) { flowIds[f.id] = 1; });

  var st = { snip: 0, dupSnip: 0, lab: 0, dupLab: 0, pre: 0, dupPre: 0, flow: 0, dupFlow: 0, rec: 0, dupRec: 0, cmd: 0, kw: 0 };

  /* ---------- 片段 ---------- */
  (E.items || []).forEach(function (it) {
    if (!it || !it.id) return;
    if (snipIds[it.id]) { st.dupSnip++; return; }
    snipIds[it.id] = 1;
    cat.items.push(it);
    st.snip++;
  });

  /* 按难度排序：低 → 高，同难度保持原顺序（sort 在 ES2019 起保证稳定，这里再带下标兜底） */
  cat.items = cat.items
    .map(function (it, idx) { return { it: it, idx: idx }; })
    .sort(function (a, b) {
      var ra = RANK[a.it.level], rb = RANK[b.it.level];
      ra = (ra === undefined) ? 3 : ra;
      rb = (rb === undefined) ? 3 : rb;
      return ra === rb ? a.idx - b.idx : ra - rb;
    })
    .map(function (x) { return x.it; });

  /* ---------- 实验 / 预设 / 工作流 ---------- */
  D.labs = D.labs || [];
  D.presets = D.presets || [];
  D.flows = D.flows || [];

  (E.labs || []).forEach(function (l) {
    if (!l || !l.id) return;
    if (labIds[l.id]) { st.dupLab++; return; }
    labIds[l.id] = 1;
    D.labs.push(l);
    st.lab++;
  });

  (E.presets || []).forEach(function (p) {
    if (!p || !p.id) return;
    if (preIds[p.id]) { st.dupPre++; return; }
    preIds[p.id] = 1;
    D.presets.push(p);
    st.pre++;
  });

  (E.flows || []).forEach(function (f) {
    if (!f || !f.id) return;
    if (flowIds[f.id]) { st.dupFlow++; return; }
    flowIds[f.id] = 1;
    D.flows.push(f);
    st.flow++;
  });

  /* ---------- 配置剧本：按 id 去重 ----------
     剧本是「下一步」引擎的数据源（assets/nextstep.js）。
     和片段一样走只增不改：同 id 以先出现的为准，绝不重复。 */
  D.recipes = D.recipes || [];
  var recIds = {};
  D.recipes.forEach(function (r) { if (r && r.id) recIds[r.id] = 1; });
  (E.recipes || []).forEach(function (r) {
    if (!r || !r.id || !(r.steps || []).length) return;
    if (recIds[r.id]) { st.dupRec = (st.dupRec || 0) + 1; return; }
    recIds[r.id] = 1;
    D.recipes.push(r);
    st.rec = (st.rec || 0) + 1;
  });

  /* ---------- 命令词条：已有的不覆盖 ---------- */
  D.cmd = D.cmd || {};
  Object.keys(E.cmd || {}).forEach(function (w) {
    if (D.cmd[w]) return;
    D.cmd[w] = E.cmd[w];
    st.cmd++;
  });

  /* ---------- 高亮关键字 ---------- */
  D.keywords = D.keywords || [];
  (E.kw || []).forEach(function (k) {
    if (D.keywords.indexOf(k) < 0) { D.keywords.push(k); st.kw++; }
  });

  window.__ENSP_STATS = st;

  if (st.snip || st.lab || st.pre || st.flow || st.rec) {
    console.log('[ensp] 合并完成：+' + st.snip + ' 片段 / +' + st.lab + ' 实验 / +'
      + st.pre + ' 预设 / +' + st.flow + ' 工作流 / +' + st.rec + ' 剧本 / +' + st.cmd + ' 命令'
      + (st.dupSnip + st.dupLab + st.dupPre + st.dupFlow + st.dupRec
        ? '（跳过重复 ' + (st.dupSnip + st.dupLab + st.dupPre + st.dupFlow + st.dupRec) + ' 条）' : ''));
  }
})();
