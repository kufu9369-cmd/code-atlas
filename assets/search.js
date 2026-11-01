/* ============================================================
   码典 · 搜索内核
   ------------------------------------------------------------
   为什么要单独一个文件：
   搜索是最容易被说「搜不出来」的地方，必须能在命令行里直接
   跑一批查询看命中和排序，而不是靠截图肉眼比对。
   浏览器里挂在 window.SEARCH，Node 里 require 就能测。

   匹配规则（解决 "dis isis" 搜不到 "display isis peer"）：
   1) 输入按空格、中英文逗号、顿号分词；
   2) 每个词都必须在同一个字段里命中（AND），缺一个就不算；
   3) 打分：词首命中 > 句中命中；保持输入顺序加分；
      原样连续出现额外加分；
   4) 多字段加权取最高分，标题 / 命令名权重最高；
   5) 组内按分数降序，同分保持原顺序（内容本身的编排不被算法打乱）。
   ============================================================ */
(function (root) {
  'use strict';

  /* 词首判定：这些字符后面算「新的一段」，命中它等于命中词首 */
  var SEG = /[\s\-_.:\/(（\[【·]/;

  function qTokens(q) {
    return String(q == null ? '' : q).toLowerCase()
      .split(/[\s\u3000,，、;；|]+/)
      .filter(Boolean);
  }

  /* 单个字段打分：所有词都命中才计分，缺一个返回 -1 */
  function scoreText(text, toks) {
    var s = String(text == null ? '' : text).toLowerCase();
    if (!s || !toks.length) return -1;
    var total = 0, last = -1;
    for (var i = 0; i < toks.length; i++) {
      var p = s.indexOf(toks[i]);
      if (p < 0) return -1;
      total += (p === 0 || SEG.test(s.charAt(p - 1))) ? 7 : 2;
      if (p === 0) total += 5;
      if (p >= last) total += 1;
      last = p;
    }
    if (toks.length > 1 && s.indexOf(toks.join(' ')) > -1) total += 10;
    return total;
  }

  /* 多字段加权取最高：避免正文里凑巧命中把标题命中压到后面 */
  function scoreOf(pairs, toks) {
    var best = -1;
    for (var i = 0; i < pairs.length; i++) {
      var s = scoreText(pairs[i][0], toks);
      if (s < 0) continue;
      var v = s * pairs[i][1];
      if (v > best) best = v;
    }
    return best;
  }

  function snippetScore(it, toks) {
    var vs = it.vars || {};
    var secs = (it.docs && it.docs.secs) || [];
    return scoreOf([
      [it.title, 3.2],
      [(it.tags || []).join(' '), 1.8],
      [it.desc, 1.3],
      [it.device, 1.1],
      [it.code, 0.95],
      [Object.keys(vs).map(function (k) {
        return k + ' ' + (vs[k].label || '') + ' ' + (vs[k].hint || '');
      }).join(' '), 0.85],
      [(it.variants || []).map(function (v) {
        return (v.label || '') + ' ' + (v.code || '');
      }).join(' '), 0.85],
      [secs.map(function (s) { return (s.h || '') + ' ' + (s.p || ''); }).join(' '), 0.8]
    ], toks);
  }

  function labScore(it, toks) {
    return scoreOf([
      [it.title, 3.2],
      [it.goal, 1.3],
      [it.level, 1.2],
      [(it.pitfalls || []).join(' '), 1.0],
      [it.scene, 1.0],
      [(it.steps || []).map(function (s) {
        return (s.title || '') + ' \n ' + (s.code || '');
      }).join(' \n '), 0.9],
      [Object.keys(it.vars || {}).join(' '), 0.8]
    ], toks);
  }

  function genericScore(it, toks) {
    if (it.task) {
      /* 任务要按“我当前要做什么”来搜：参数名、每步标题/命令、
         验证命令都要进索引，否则搜「DHCP 地址池」找不到已经有的任务。 */
      return scoreOf([
        [it.title, 3.2],
        [(it.features || []).join(' '), 1.6],
        [it.summary, 1.3],
        [Object.keys(it.task.env || {}).join(' '), 1.4],
        [(it.task.steps || []).map(function (s) { return (s.title || '') + ' \n ' + (s.code || ''); }).join(' \n '), 1.2],
        [(it.task.verify || []).map(function (v) { return (v.cmd || '') + ' ' + (v.hope || ''); }).join(' \n '), 1.0]
      ], toks);
    }
    return scoreOf([
      [it.title, 3.2],
      [(it.features || []).join(' '), 1.6],
      [it.summary, 1.3]
    ], toks);
  }

  function recipeScore(it, toks) {
    return scoreOf([
      [it.title, 3.4],
      [(it.tags || []).join(' '), 1.8],
      [it.scene, 1.5],
      [(it.steps || []).map(function (s) {
        return (s.c || '') + ' \n ' + (s.note || '');
      }).join(' \n '), 1.2],
      [(it.verify || []).map(function (v) { return (v.cmd || '') + ' ' + (v.hope || ''); }).join(' \n '), 1.0]
    ], toks);
  }

  /* ---------- 高频命令加权 ----------
     纯按匹配分排序会出现「display isis brief 排在 display isis peer 前面」，
     而真正想查邻居的人要的是 peer。所以给日常排障最常敲的那批加一点分，
     让它们在同分时自然浮上来。只放真正高频的，不要滥加。 */
  var HOT = {};
  [
    'display version', 'display current-configuration', 'display this',
    'display interface brief', 'display ip interface brief', 'display interface',
    'display vlan', 'display mac-address', 'display arp', 'display ip routing-table',
    'display eth-trunk', 'display stp brief', 'display logbuffer',
    'display cpu-usage', 'display memory-usage',
    'display ospf peer', 'display isis peer', 'display bgp peer', 'display rip routing',
    'display vrrp', 'display vrrp brief', 'display bfd session all',
    'display mpls ldp session', 'display ip vpn-instance',
    'display acl all', 'display nat session all', 'display nat server',
    'display firewall session table', 'display ip pool', 'display dhcp snooping user-bind',
    'display ap all', 'display stack',
    'reset counters interface', 'reset saved-configuration',
    'interface range', 'sysname', 'user-interface vty', 'local-user',
    'ping', 'tracert', 'telnet', 'shutdown', 'undo shutdown', 'save', 'reboot'
  ].forEach(function (w) { HOT[w] = 1; });

  function cmdScore(word, toks, CMD) {
    var c = (CMD && CMD[word]) || {};
    var base = scoreOf([[word, 3.6], [c.eg, 1.2], [c.p, 1.0]], toks);
    if (base < 0) return -1;
    /* 短命令更通用（display interface 优先于 display interface xxx 的长尾），
       但这个差距要小于「高频」的权重，别把精确长命令压下去。 */
    return base + (HOT[word] ? 14 : 0) + Math.max(0, 36 - word.length) * 0.25;
  }

  function ranked(list, scoreFn, toks) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var s = scoreFn(list[i], toks);
      if (s >= 0) out.push({ it: list[i], s: s, i: i });
    }
    out.sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); });
    return out.map(function (x) { return x.it; });
  }

  /* ---------- 主入口 ----------
     D    : window.CODEATLAS（分类/实验/预设/工作流）
     CMD  : 命令词条表 { 命令: {p, eg} }
     q    : 原始输入
     limit: 命令组最多列多少条（其余在组标题里显示「共 N 条」）
     返回 : [{ kind, name, items, total? }] */
  function groups(D, CMD, q, limit) {
    var toks = qTokens(q);
    var gs = [];
    if (!toks.length) return gs;
    CMD = CMD || {};
    limit = limit || 60;

    /* 1. 命令词典 —— 排最前，因为搜命令的人就是想看命令 */
    var cs = [];
    Object.keys(CMD).forEach(function (w) {
      var s = cmdScore(w, toks, CMD);
      if (s >= 0) cs.push({ w: w, s: s });
    });
    if (cs.length) {
      cs.sort(function (a, b) { return (b.s - a.s) || (a.w < b.w ? -1 : 1); });
      gs.push({
        kind: 'cmd', name: '命令词典', total: cs.length,
        items: cs.slice(0, limit).map(function (x) {
          var c = CMD[x.w] || {};
          return { id: x.w, title: x.w, desc: c.p || '', eg: c.eg || '' };
        })
      });
    }

    /* 2. 各个片段分类 —— 按组内最高分排序，不按分类顺序。
       专题一多，弱命中排在前面就很容易让人误以为"搜不到"：
       搜「跨域」时 CORS 那条在 JavaWeb 分类里、只是命中更强，
       必须浮到 Nginx 反代那条前面。 */
    var catGroups = [];
    (D.categories || []).forEach(function (c, ci) {
      var items = ranked(c.items || [], snippetScore, toks);
      if (!items.length) return;
      catGroups.push({
        kind: 'snippet', name: c.name, items: items,
        top: snippetScore(items[0], toks), ord: ci
      });
    });
    catGroups.sort(function (a, b) { return (b.top - a.top) || (a.ord - b.ord); });
    catGroups.forEach(function (g) {
      delete g.top; delete g.ord;
      gs.push(g);
    });

    /* 3. 实验 / 预设 / 工作流 */
    var ls = ranked(D.labs || [], labScore, toks);
    if (ls.length) gs.push({ kind: 'lab', name: '实验', items: ls });
    var ps = ranked(D.presets || [], genericScore, toks);
    if (ps.length) gs.push({ kind: 'preset', name: '预设库', items: ps });
    var fs = ranked(D.flows || [], genericScore, toks);
    if (fs.length) gs.push({ kind: 'flow', name: '工作流', items: fs });
    var rs = ranked(D.recipes || [], recipeScore, toks);
    if (rs.length) gs.push({ kind: 'recipe', name: '配置剧本', items: rs.slice(0, 20), total: rs.length });

    return gs;
  }

  var API = {
    qTokens: qTokens,
    scoreText: scoreText,
    scoreOf: scoreOf,
    snippetScore: snippetScore,
    genericScore: genericScore,
    recipeScore: recipeScore,
    labScore: labScore,
    genericScore: genericScore,
    cmdScore: cmdScore,
    groups: groups
  };

  root.SEARCH = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof globalThis !== 'undefined' ? globalThis : this).SEARCH;
}
