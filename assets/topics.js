/* ============================================================
   码典 · 专题层（Topic）
   ------------------------------------------------------------
   解决什么问题：
   分类一多（eNSP、JavaWeb 五个子类、Web 前端四个子类、Linux、MySQL…），
   左轨就会排成一长条小图标，找东西全靠记忆，页面也变得又挤又冗余。

   所以加一层「专题」：一个大图标 = 一个专题，点进去只显示这个专题的内容，
   专题内部的细分放在列表顶部的胶囊里切换。

   两层结构：
     专题（net / javaweb / web / tool）
       └─ 分类（ensp / javaweb-servlet / web-js / linux …）
            └─ 片段

   专题定义写死在下面这张表里，加分类只要把分类 id 填进对应专题的 cats。
   没被任何专题认领的分类（比如知识包新导入的），会自动单独成为一个专题，
   不会出现「导进来了但侧栏看不到」的情况。

   合并器（apply）负责把新专题的内容并进 CODEATLAS：
   - 分类不存在就建，已存在就复用（不会多出一模一样的侧栏项）；
   - 片段 / 实验 / 预设 / 工作流一律按 id 去重，重复执行结果不变；
   - 命令词条只补不改，已有解释绝不覆盖。
   ============================================================ */
(function (root) {
  'use strict';

  var D = root.CODEATLAS;
  if (!D) { console.error('[topics] 缺少 CODEATLAS 数据，检查 script 顺序'); return; }

  /* ---------- 专题定义 ----------
     icon 用 app.js 里的 ICON 名字：switch / term / db / code / layers /
     branch / git / flask / coffee / browser / shield          */
  var LIST = [
    {
      id: 'net', name: '网络工程', short: '网络', icon: 'switch', accent: '#7C8CFF',
      desc: 'eNSP 交换 / 路由 / 安全', cats: ['ensp'], ext: 'cfg'
    },
    {
      id: 'javaweb', name: 'JavaWeb', short: 'JavaWeb', icon: 'coffee', accent: '#FFB454',
      desc: 'Servlet / JSP / JDBC / 部署',
      cats: ['javaweb-servlet', 'javaweb-jsp', 'javaweb-jdbc', 'javaweb-mvc', 'javaweb-deploy'],
      ext: 'java'
    },
    {
      id: 'web', name: 'Web 前端（旧版）', short: 'Web', icon: 'browser', accent: '#4FD6B0',
      desc: 'HTML / CSS / JS / jQuery 与 IE 兼容',
      cats: ['web-htmlcss', 'web-js', 'web-jquery', 'web-compat'],
      ext: 'html'
    },
    {
      id: 'tool', name: '系统与脚本', short: '运维', icon: 'term', accent: '#FF7A93',
      desc: 'Linux / MySQL / Python / Git', cats: ['linux', 'mysql', 'python', 'git'], ext: 'sh'
    }
  ];

  var DEFAULT_TOPIC = 'net';

  function byId(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return null;
  }

  /* 分类 → 专题 id */
  function ofCat(catId) {
    for (var i = 0; i < LIST.length; i++) {
      if (LIST[i].cats.indexOf(catId) > -1) return LIST[i].id;
    }
    return 'cat:' + catId;   // 未归类：单独成一个专题
  }

  /* 条目 → 专题 id（实验 / 预设 / 工作流可能自带 topic，没写的算网络工程） */
  function ofItem(x) {
    if (!x) return DEFAULT_TOPIC;
    if (x.topic) return x.topic;
    if (x.cat) return ofCat(x.cat);
    return DEFAULT_TOPIC;
  }

  /* 当前真正可用的专题：静态定义 + 未归类分类的兜底专题 */
  function all() {
    var out = [];
    var claimed = {};

    LIST.forEach(function (t) {
      var cats = t.cats.filter(function (cid) {
        var hit = D.categories.some(function (c) { return c.id === cid; });
        if (hit) claimed[cid] = 1;
        return hit;
      });
      /* 一个分类都没有的专题不显示，避免空壳入口 */
      if (!cats.length) return;
      out.push({
        id: t.id, name: t.name, short: t.short, icon: t.icon,
        accent: t.accent, desc: t.desc, cats: cats, ext: t.ext
      });
    });

    D.categories.forEach(function (c) {
      if (claimed[c.id]) return;
      var hit = out.some(function (t) { return t.id === 'cat:' + c.id; });
      if (hit) return;
      out.push({
        id: 'cat:' + c.id, name: c.name, short: c.short || c.name,
        icon: c.icon || 'code', accent: '#63B6FF',
        desc: c.sub || '知识包导入', cats: [c.id], ext: c.ext || 'txt'
      });
    });

    return out;
  }

  function catsOf(topicId) {
    var t = null;
    all().forEach(function (x) { if (x.id === topicId) t = x; });
    return t ? t.cats.slice() : [];
  }

  /* ============================================================
     合并器
     ------------------------------------------------------------
     bundle = {
       cats:    [{ id, name, sub, icon, short, ext }],   // 分类定义
       topic:   'javaweb',                               // 这些内容属于哪个专题
       items:   [{ ..., cat: 'javaweb-servlet' }],
       labs:    [], presets: [], flows: [],
       cmd:     { 命令: { p, eg } },
       cmdSrc:  { java: ['@WebServlet', ...] },           // 命令归属的文档生态
       kw:      ['servlet', ...]
     }
     ============================================================ */
  var RANK = { '入门': 0, '进阶': 1, '综合': 2 };

  function apply(bundle) {
    bundle = bundle || {};
    var topicId = bundle.topic || DEFAULT_TOPIC;
    var st = { cat: 0, snip: 0, dupSnip: 0, lab: 0, pre: 0, flow: 0, cmd: 0, kw: 0 };

    /* ---------- 1. 分类：不存在就建 ---------- */
    var catMap = {};
    (bundle.cats || []).forEach(function (def) {
      if (!def || !def.id) return;
      var cat = null;
      for (var i = 0; i < D.categories.length; i++) {
        if (D.categories[i].id === def.id) { cat = D.categories[i]; break; }
      }
      if (!cat) {
        cat = {
          id: def.id, name: def.name, sub: def.sub || '',
          icon: def.icon || 'code', short: def.short || def.name,
          ext: def.ext || 'txt', items: []
        };
        D.categories.push(cat);
        st.cat++;
      }
      cat.items = cat.items || [];
      catMap[def.id] = cat;
    });

    /* ---------- 2. 片段：按 id 去重（跨分类全局唯一） ---------- */
    var snipIds = {};
    D.categories.forEach(function (c) {
      (c.items || []).forEach(function (it) { snipIds[it.id] = 1; });
    });

    (bundle.items || []).forEach(function (it) {
      if (!it || !it.id) return;
      if (snipIds[it.id]) { st.dupSnip++; return; }
      var cat = catMap[it.cat] || catMap[(bundle.cats || [])[0] && bundle.cats[0].id];
      if (!cat) return;
      snipIds[it.id] = 1;
      if (!it.topic) it.topic = topicId;
      cat.items.push(it);
      st.snip++;
    });

    /* 片段按难度排序：入门 → 进阶 → 综合，同难度保持编排顺序（稳定） */
    Object.keys(catMap).forEach(function (cid) {
      var cat = catMap[cid];
      cat.items = cat.items
        .map(function (it, idx) { return { it: it, idx: idx }; })
        .sort(function (a, b) {
          var ra = RANK[a.it.level], rb = RANK[b.it.level];
          ra = (ra === undefined) ? 3 : ra;
          rb = (rb === undefined) ? 3 : rb;
          return ra === rb ? a.idx - b.idx : ra - rb;
        })
        .map(function (x) { return x.it; });
    });

    /* ---------- 3. 实验 / 预设 / 工作流 ---------- */
    D.labs = D.labs || [];
    D.presets = D.presets || [];
    D.flows = D.flows || [];

    function mergeList(key, arr, counter) {
      var ids = {};
      (D[key] || []).forEach(function (x) { ids[x.id] = 1; });
      (arr || []).forEach(function (x) {
        if (!x || !x.id || ids[x.id]) return;
        ids[x.id] = 1;
        if (!x.topic) x.topic = topicId;
        D[key].push(x);
        st[counter]++;
      });
    }
    mergeList('labs', bundle.labs, 'lab');
    mergeList('presets', bundle.presets, 'pre');
    mergeList('flows', bundle.flows, 'flow');

    /* ---------- 4. 命令词条：只补不改 ---------- */
    D.cmd = D.cmd || {};
    Object.keys(bundle.cmd || {}).forEach(function (w) {
      if (D.cmd[w]) return;
      D.cmd[w] = bundle.cmd[w];
      st.cmd++;
    });

    /* 命令属于哪个生态（决定「官方解答」跳哪个官网） */
    if (bundle.cmdSrc) {
      D.cmdSrc = D.cmdSrc || {};
      Object.keys(bundle.cmdSrc).forEach(function (g) {
        D.cmdSrc[g] = D.cmdSrc[g] || [];
        (bundle.cmdSrc[g] || []).forEach(function (w) {
          if (D.cmdSrc[g].indexOf(w) < 0) D.cmdSrc[g].push(w);
        });
      });
    }

    /* ---------- 5. 高亮关键字 ---------- */
    D.keywords = D.keywords || [];
    (bundle.kw || []).forEach(function (k) {
      if (D.keywords.indexOf(k) < 0) { D.keywords.push(k); st.kw++; }
    });

    return st;
  }

  root.TOPICS = {
    list: LIST,
    DEFAULT: DEFAULT_TOPIC,
    all: all,
    byId: byId,
    ofCat: ofCat,
    ofItem: ofItem,
    catsOf: catsOf,
    apply: apply
  };
})(typeof window !== 'undefined' ? window : globalThis);
