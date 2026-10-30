/* ============================================================
   码典 · JavaWeb 合并器（必须最后加载，且在 packs.js 之前）
   ------------------------------------------------------------
   把前面各分片的内容并进 CODEATLAS：
   - 五个分类不存在就建，已存在（比如用户先导过同名分类）就复用；
   - 片段 / 实训 / 预设 / 工作流按 id 去重，跑三遍结果不变；
   - 命令词条只补不改，不覆盖已有解释。
   ============================================================ */
(function () {
  'use strict';

  var J = window.__JW;
  if (!J) { console.error('[javaweb] 缺少 00-base.js，检查 script 顺序'); return; }
  if (!window.TOPICS) { console.error('[javaweb] 缺少 topics.js，检查 script 顺序'); return; }

  var st = window.TOPICS.apply({
    topic: J.topic,
    cats: J.cats,
    items: J.items,
    labs: J.labs,
    presets: J.presets,
    flows: J.flows,
    cmd: J.cmd,
    cmdSrc: J.cmdSrc,
    kw: J.kw
  });

  window.__JW_STATS = st;
  if (st.snip || st.lab || st.pre || st.flow) {
    console.log('[javaweb] 合并完成：+' + st.snip + ' 片段 / +' + st.lab + ' 实训 / +'
      + st.pre + ' 预设 / +' + st.flow + ' 工作流 / +' + st.cmd + ' 命令'
      + '（分类 +' + st.cat + '，跳过重复 ' + st.dupSnip + ' 条）');
  }
})();
