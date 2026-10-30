/* ============================================================
   码典 · Web 前端（旧版）合并器（最后加载，且在 packs.js 之前）
   ============================================================ */
(function () {
  'use strict';

  var W = window.__WEB;
  if (!W) { console.error('[web] 缺少 00-base.js，检查 script 顺序'); return; }
  if (!window.TOPICS) { console.error('[web] 缺少 topics.js，检查 script 顺序'); return; }

  var st = window.TOPICS.apply({
    topic: W.topic,
    cats: W.cats,
    items: W.items,
    labs: W.labs,
    presets: W.presets,
    flows: W.flows,
    cmd: W.cmd,
    cmdSrc: W.cmdSrc,
    kw: W.kw
  });

  window.__WEB_STATS = st;
  if (st.snip || st.lab || st.pre || st.flow) {
    console.log('[web] 合并完成：+' + st.snip + ' 片段 / +' + st.lab + ' 实训 / +'
      + st.pre + ' 预设 / +' + st.flow + ' 工作流 / +' + st.cmd + ' 命令'
      + '（分类 +' + st.cat + '，跳过重复 ' + st.dupSnip + ' 条）');
  }
})();
