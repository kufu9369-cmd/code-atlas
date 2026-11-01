/* ============================================================
   码典 CodeAtlas — 逻辑层
   纯原生 JS，无依赖、无构建。file:// 直接打开就能跑。
   ============================================================ */
(function () {
  'use strict';

  const D = window.CODEATLAS;
  const KW = new Set(D.keywords.map(k => String(k).toLowerCase()));
  const CMD = D.cmd || {};

  /* ---------- 命令词条的官方文档来源 ----------
     每条命令都属于某个生态，必须指向它自己的官方文档。
     以前统一拼华为搜索页，导致 git reset / mysqldump 也被指向华为文档。 */
  const CMD_SRC = {
    huawei: { n: '华为官方 · S 系列交换机命令参考（V200R011C10）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178145' },
    linux:  { n: 'Linux man-pages 官方手册', u: 'https://man7.org/linux/man-pages/' },
    git:    { n: 'Git 官方命令文档', u: 'https://git-scm.com/docs' },
    mysql:  { n: 'MySQL 8.0 官方参考手册', u: 'https://dev.mysql.com/doc/refman/8.0/en/' },
    docker: { n: 'Docker 官方 CLI 参考', u: 'https://docs.docker.com/reference/' },
    java:   { n: 'Jakarta EE 官方规范（Servlet / JSP / JDBC）', u: 'https://jakarta.ee/specifications/servlet/6.0/' },
    web:    { n: 'MDN Web Docs（含旧版浏览器兼容说明）', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API' }
  };
  const CMD_GROUP = (() => {
    const m = {};
    const g = D.cmdSrc || {};
    Object.keys(g).forEach(k => (g[k] || []).forEach(w => { m[w] = k; }));
    return m;
  })();
  function cmdSrcOf(word) {
    return CMD_SRC[CMD_GROUP[word]] || CMD_SRC.huawei;
  }
  const LS = 'codeatlas.vals.v1';
  const LS_FAV = 'codeatlas.fav.v1';
  const LS_TASK = 'codeatlas.task.v1';

  /* ---------- 变量存储（localStorage 持久化） ---------- */
  let VAL = {};
  try { VAL = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { VAL = {}; }
  function persist() { try { localStorage.setItem(LS, JSON.stringify(VAL)); } catch (e) {} }
  function gv(scope, name, def) { const k = scope + '|' + name; return (k in VAL) ? VAL[k] : def; }
  function sv(scope, name, v) { VAL[scope + '|' + name] = v; persist(); }

  /* ---------- 收藏（key 形如 snippet:vlan-create） ---------- */
  let FAV = new Set();
  try { FAV = new Set(JSON.parse(localStorage.getItem(LS_FAV)) || []); } catch (e) { FAV = new Set(); }
  function persistFav() {
    try { localStorage.setItem(LS_FAV, JSON.stringify([...FAV])); } catch (e) {}
  }
  const favKey = (kind, id) => kind + ':' + id;
  const isFav = (kind, id) => FAV.has(favKey(kind, id));

  /* ---------- 任务进度（按任务 id 存，刷新/重启后接着做） ---------- */
  let TASK = {};
  try { TASK = JSON.parse(localStorage.getItem(LS_TASK)) || {}; } catch (e) { TASK = {}; }
  function taskState(id) {
    if (!TASK[id] || typeof TASK[id] !== 'object') TASK[id] = { done: {}, verify: {} };
    TASK[id].done = TASK[id].done || {};
    TASK[id].verify = TASK[id].verify || {};
    return TASK[id];
  }
  function persistTask() {
    try { localStorage.setItem(LS_TASK, JSON.stringify(TASK)); return true; }
    catch (e) { return false; }
  }

  /* 全量备份导入时恢复用户数据。导入流程结束会刷新页面，
     这里先把值写回 localStorage，保证刷新后能接着用。 */
  function applyUserdata(u) {
    if (!u || typeof u !== 'object') return;
    if (u.values && typeof u.values === 'object') {
      VAL = u.values;
      persist();
    }
    if (Array.isArray(u.favorites)) {
      FAV = new Set(u.favorites.map(String));
      persistFav();
    }
    if (u.task && typeof u.task === 'object') {
      TASK = u.task;
      persistTask();
    }
    try { renderRail(); renderList(); renderMain(); } catch (e) { /* 启动早期还没有 DOM */ }
  }

  /* ---------- 皮肤 ----------
     皮肤表和切换逻辑在 assets/skins.js（单独成文件是为了命令行能验）。
     这里只包一层，顺手把左轨按钮上的名字刷一下。 */
  const SK = window.SKINS;
  function curSkin() {
    return (SK && SK.MAP[SK.current()]) || { id: 'midnight', name: '深空' };
  }
  /* save=false 只给首次启动用：启动时按「存的 > 系统的」推出来一套，
     但不写回 localStorage —— 一旦写回，用户系统切深色时就不跟随了。 */
  function applySkin(id, rerender, save) {
    if (!SK) return null;
    const s = SK.apply(id, save !== false);
    if (rerender) renderRail();
    return s;
  }

  /* ---------- 状态 ---------- */
  const S = {
    view: 'cat',              // cat | labs | presets | flows | fav
    topic: '',                // 当前专题（左轨上的大图标）
    cat: D.categories[0].id,
    q: '',
    sel: { cat: null, labs: null, presets: null, flows: null },
    favKind: 'snippet',       // 收藏视图里当前选中项的类型
    open: new Set(),          // 工作流展开的节点
    variant: {},              // 片段选中的代码分支
    docs: null
  };
  const VMAP = { snippet: 'cat', lab: 'labs', preset: 'presets', flow: 'flows' };

  const REG = {};   // scope|name -> 变量定义
  const ITEMS = {}; // 片段 id -> 片段
  D.categories.forEach(c => c.items.forEach(i => { i.cat = c.id; i.catName = c.name; ITEMS[i.id] = i; }));

  const SHORT = { ensp: 'eNSP', linux: 'Linux', mysql: 'MySQL', python: 'Python', git: 'Git' };
  const EXT = { ensp: 'cfg', linux: 'sh', mysql: 'sql', python: 'py', git: 'sh' };
  /* 知识包带来的新分类可以自己声明短名和扩展名 */
  D.categories.forEach(c => { if (c.short) SHORT[c.id] = c.short; if (c.ext) EXT[c.id] = c.ext; });

  /* ============================================================
     专题（左轨上的大图标）
     ------------------------------------------------------------
     一层专题、一层分类：
       专题（网络工程 / JavaWeb / Web 前端旧版 / 系统与脚本）
         └─ 分类（ensp / javaweb-servlet / web-js / linux …）
     点某个专题，列表里只出现这个专题的内容；分类用小胶囊切换。
     专题定义在 assets/topics.js，这里只做接线和兜底。
     ============================================================ */
  const TP = window.TOPICS;
  /* 专题列表不是常量：知识包可以在运行期往 D.categories 里加分类，
     新增的分类应当立刻成为一个专题。只在启动时算一次的话，
     会出现「导入成功、数据也在，但左轨没有入口、内容还归错了专题」。
     所以每次渲染前 refreshTopics() 重算一遍。 */
  let TOPICS = TP
    ? TP.all()
    : D.categories.map(c => ({
      id: c.id, name: c.name, short: SHORT[c.id] || c.name,
      icon: c.icon, accent: '', desc: '', cats: [c.id]
    }));

  function refreshTopics() {
    if (TP) TOPICS = TP.all();
    return TOPICS;
  }

  function topicDef(id) {
    const t = TOPICS.find(x => x.id === id);
    if (t) return t;
    /* 兜底：还没被 all() 收进来的新分类，或者根本查不到的分类。
       返回一个临时专题，别退回 TOPICS[0] —— 那会把内容算到别的专题头上。 */
    const cid = String(id || '').replace(/^cat:/, '');
    const c = D.categories.find(x => x.id === cid);
    return {
      id: id, name: (c && c.name) || '未归类', short: (c && c.short) || '未归类',
      icon: (c && c.icon) || 'code', accent: '', desc: '', cats: c ? [c.id] : []
    };
  }
  function topicOfCat(cid) {
    const t = TOPICS.find(x => x.cats.indexOf(cid) >= 0);
    /* 与 topics.js 的约定保持一致：未归类的分类单独成一个专题 */
    return t ? t.id : 'cat:' + cid;
  }
  function topicCats(tid) {
    return topicDef(tid).cats.filter(cid => D.categories.some(c => c.id === cid));
  }
  /* 实验 / 预设 / 工作流归属于哪个专题：自带 topic 就用，没写的算网络工程 */
  function topicOfItem(x) { return (x && x.topic) || 'net'; }
  /* 按当前专题过滤（实验、预设、工作流是跨分类的，必须过这一层） */
  function scoped(list) { return (list || []).filter(x => topicOfItem(x) === S.topic); }

  S.topic = topicOfCat(S.cat);

  /* ---------- 小工具 ---------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function uniqueVars(code) {
    const out = [], seen = new Set();
    const re = /\{\{([A-Za-z0-9_]+)\}\}/g;
    let m;
    while ((m = re.exec(code))) { if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); } }
    return out;
  }

  /* ============================================================
     语法高亮
     ============================================================ */
  function hl(text, kwClick) {
    text = String(text);
    let html = '', last = 0;
    /* 顺序很关键：
       1. 字符串放最前 —— 否则 '#box'、'https://x' 里的 # 和 // 会被当成注释，
          jQuery 选择器整行变灰就是这个问题；
       2. # 注释只认行首，CSS 的 #5a94ff 才不会被染成注释；
       3. // 注释不限位置，行内注释要能认出来。 */
    const re = /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(^[ \t]*#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\b\d{1,3}(?:\.\d{1,3}){3}\b)|(\b\d+\b)|([A-Za-z_][\w\-.]*)/gm;
    let m;
    while ((m = re.exec(text))) {
      html += esc(text.slice(last, m.index));
      const tk = m[0];
      let cls = '';
      if (m[1]) cls = 'c-st';
      else if (m[2]) cls = 'c-cm';
      else if (m[3]) cls = 'c-ip';
      else if (m[4]) cls = 'c-nu';
      else if (m[5]) cls = KW.has(tk.toLowerCase()) ? 'c-kw' : '';
      if (!cls) { html += esc(tk); }
      else if (cls === 'c-kw' && kwClick && CMD[tk.toLowerCase()]) {
        html += '<span class="c-kw kw-click" data-kw="' + esc(tk.toLowerCase()) + '">' + esc(tk) + '</span>';
      } else {
        html += '<span class="' + cls + '">' + esc(tk) + '</span>';
      }
      last = m.index + tk.length;
    }
    html += esc(text.slice(last));
    return html;
  }

  /* ============================================================
     代码渲染：{{var}} → 琥珀色「自主」块
     ============================================================ */
  function renderCode(scope, code, vars, kwClick) {
    const parts = String(code).split(/(\{\{[A-Za-z0-9_]+\}\})/);
    let h = '';
    for (const p of parts) {
      const m = /^\{\{([A-Za-z0-9_]+)\}\}$/.exec(p);
      if (!m) { h += hl(p, kwClick); continue; }
      const name = m[1];
      const def = vars[name] || { label: name, value: name, hint: '', desc: '' };
      REG[scope + '|' + name] = def;
      const val = gv(scope, name, def.value);
      h += '<span class="var" data-s="' + esc(scope) + '" data-v="' + esc(name) + '"'
        + ' tabindex="0" role="button" title="' + esc((def.label || name) + ' · 点击修改') + '">'
        + '<span class="own">自主</span>'
        + '<span class="vv">' + (val === '' ? '…' : hl(val, false)) + '</span>'
        + '</span>';
    }
    return h;
  }

  function plain(scope, code, vars) {
    return String(code).replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, n) => {
      const def = vars[n] || { value: '' };
      return gv(scope, n, def.value);
    });
  }

  /* ---------- 当前片段/预设的代码定义 ---------- */
  function curVariant(item) {
    if (!item.variants) return null;
    return item.variants.find(v => v.id === S.variant[item.id]) || item.variants[0];
  }
  function codeDef(item) {
    const v = curVariant(item);
    if (!v) return { code: item.code, vars: item.vars || {} };
    return { code: v.code, vars: Object.assign({}, item.vars || {}, v.vars || {}) };
  }

  function presetVars(snip, over) {
    const out = {};
    Object.keys(snip.vars || {}).forEach(k => { out[k] = Object.assign({}, snip.vars[k]); });
    Object.keys(over || {}).forEach(k => {
      if (out[k]) out[k] = Object.assign({}, out[k], { value: over[k] });
      else out[k] = { label: k, value: over[k], hint: '', desc: '' };
    });
    return out;
  }

  /* ============================================================
     图标
     ============================================================ */
  const svg = p => '<svg viewBox="0 0 24 24">' + p + '</svg>';
  const ICON = {
    switch: svg('<rect x="2.8" y="8.5" width="18.4" height="7" rx="1.8"/><path d="M6 19h5M8.5 15.5V19M15 15.5V19M15.5 12h3.5"/>'),
    term: svg('<rect x="2.8" y="4.4" width="18.4" height="15.2" rx="2.2"/><path d="M6.6 9.4l2.4 2.4-2.4 2.4M11.8 14.4h4.2"/>'),
    db: svg('<ellipse cx="12" cy="6" rx="7.2" ry="2.8"/><path d="M4.8 6v6c0 1.55 3.22 2.8 7.2 2.8s7.2-1.25 7.2-2.8V6"/><path d="M4.8 12v6c0 1.55 3.22 2.8 7.2 2.8s7.2-1.25 7.2-2.8v-6"/>'),
    code: svg('<path d="M8.6 5.4L3.4 12l5.2 6.6M15.4 5.4L20.6 12l-5.2 6.6"/>'),
    layers: svg('<path d="M12 3.2l8.4 4.4-8.4 4.4L3.6 7.6 12 3.2z"/><path d="M3.6 12.2l8.4 4.4 8.4-4.4"/><path d="M3.6 16.4l8.4 4.4 8.4-4.4"/>'),
    branch: svg('<circle cx="6.4" cy="5.6" r="2.2"/><circle cx="6.4" cy="18.4" r="2.2"/><circle cx="17.6" cy="12" r="2.2"/><path d="M6.4 7.8v8.4M8.6 12h6.8"/>'),
    /* 专题图标：咖啡杯 = JavaWeb，浏览器窗口 = Web 前端 */
    coffee: svg('<path d="M4.6 8.6h11.2v5.6a4.2 4.2 0 0 1-4.2 4.2H8.8a4.2 4.2 0 0 1-4.2-4.2V8.6z"/><path d="M15.8 9.9h1.5a2.5 2.5 0 0 1 0 5h-1.5"/><path d="M7.8 3.4v2.4M11.2 3.4v2.4"/>'),
    browser: svg('<rect x="2.8" y="4.6" width="18.4" height="14.8" rx="2.4"/><path d="M2.8 9.2h18.4"/><circle cx="5.9" cy="6.9" r=".8" fill="currentColor" stroke="none"/><circle cx="8.5" cy="6.9" r=".8" fill="currentColor" stroke="none"/><circle cx="11.1" cy="6.9" r=".8" fill="currentColor" stroke="none"/>'),
    git: svg('<rect x="2.8" y="4.2" width="18.4" height="15.6" rx="2.6"/><circle cx="8" cy="12" r="1.7"/><circle cx="16.4" cy="8.4" r="1.5"/><circle cx="16.4" cy="15.6" r="1.5"/><path d="M9.7 12h1.9a2 2 0 0 0 2-2v-.4a1 1 0 0 1 1-1h.3M9.7 12h1.9a2 2 0 0 1 2 2v.4a1 1 0 0 0 1 1h.3"/>'),
    search: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.6"/><path d="M16 16l4 4"/></svg>',
    copy: svg('<rect x="8.6" y="8.6" width="11" height="11" rx="2"/><path d="M15.4 5.4H6.6a2 2 0 0 0-2 2v8.8"/>'),
    paste: svg('<rect x="8.2" y="3.2" width="7.6" height="3.8" rx="1.2"/><path d="M6.4 5.2H5a1.9 1.9 0 0 0-1.9 1.9v12a1.9 1.9 0 0 0 1.9 1.9h14a1.9 1.9 0 0 0 1.9-1.9v-12A1.9 1.9 0 0 0 19 5.2h-1.4"/>'),
    trash: svg('<path d="M4.6 6.6h14.8"/><path d="M9.6 6.6V4.9a1.3 1.3 0 0 1 1.3-1.3h2.2a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.6 6.6l.85 12a1.8 1.8 0 0 0 1.8 1.7h5.5a1.8 1.8 0 0 0 1.8-1.7l.85-12"/>'),
    book: svg('<path d="M4 5.4A2 2 0 0 1 6 3.4h4.6A2.4 2.4 0 0 1 13 5.8v14a2 2 0 0 0-2-2H6a2 2 0 0 1-2-2V5.4z"/><path d="M20 5.4a2 2 0 0 0-2-2h-2.6A2.4 2.4 0 0 0 13 5.8v14a2 2 0 0 1 2-2h3a2 2 0 0 0 2-2V5.4z"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    star: svg('<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.85z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6"/>'),
    moon: svg('<path d="M20.2 14.2A8.5 8.5 0 0 1 9.8 3.8a8.5 8.5 0 1 0 10.4 10.4z"/>'),
    palette: svg('<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.35 0 1.9-.95 1.45-1.95-.5-1.15.32-2.35 1.75-2.35h1.25a3.55 3.55 0 0 0 3.55-3.55c0-5.05-3.55-9.35-8-9.35z"/><circle cx="8.5" cy="9.3" r="1.05" fill="currentColor" stroke="none"/><circle cx="12.3" cy="7.7" r="1.05" fill="currentColor" stroke="none"/><circle cx="15.7" cy="10.2" r="1.05" fill="currentColor" stroke="none"/>'),
    flask: svg('<path d="M9.4 3.4v6.2L4.9 17a2.1 2.1 0 0 0 1.85 3.15h10.5A2.1 2.1 0 0 0 19.1 17l-4.5-7.4V3.4"/><path d="M8.2 3.4h7.6"/><path d="M7.3 13.8h9.4"/>'),
    pack: svg('<path d="M12 3.6v9.4M8.3 9.2l3.7 3.8 3.7-3.8"/><path d="M4.5 15.2v2.6a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.6"/>'),
    pointer: svg('<path d="M6.4 3.6l11.4 9.8-5.2.8-1.5 5.1z"/><path d="M14.2 15.5l2.8 4.2"/>'),
    arrow: '<span class="ar">›</span>'
  };

  /* ============================================================
     左轨
     ------------------------------------------------------------
     上层是大图标（专题），下层是原有的小图标（实验 / 预设 / 流程 / 收藏）。
     这样侧栏不会随分类数量一路变长：加专题只是多一个大图标，
     加分类只在专题内部多一个小胶囊。
     ============================================================ */
  function renderRail() {
    refreshTopics();
    let h = '<div class="rail-logo">码</div>';

    /* ---------- 专题大图标 ---------- */
    TOPICS.forEach(t => {
      const on = S.topic === t.id && S.view !== 'fav';
      const label = t.short || t.name;
      h += '<button class="rail-topic' + (on ? ' on' : '') + '"'
        + ' data-nav="topic" data-topic="' + esc(t.id) + '"'
        + ' data-label="' + esc(label) + '"'
        + ' style="--acc:' + esc(t.accent || 'var(--iris)') + '"'
        + ' aria-label="' + esc(t.name) + '"'
        + ' aria-pressed="' + (on ? 'true' : 'false') + '">'
        + '<span class="rt-ico">' + (ICON[t.icon] || ICON.code) + '</span>'
        + '<span class="rt-tx">' + esc(label) + '</span>'
        + '<span class="tip">' + esc(t.name) + (t.desc ? ' · ' + esc(t.desc) : '') + '</span>'
        + '</button>';
    });

    h += '<div class="rail-sep"></div>';

    /* ---------- 工具视图（跟随当前专题） ---------- */
    const labN = scoped(D.labs).length;
    const preN = scoped(D.presets).length;
    const flowN = scoped(D.flows).length;
    h += '<button class="rail-btn' + (S.view === 'labs' ? ' on' : '') + '" data-nav="labs" data-label="实验">'
      + ICON.flask + '<span class="tip">实验 · ' + labN + ' 个（当前专题）</span></button>';
    h += '<button class="rail-btn' + (S.view === 'presets' ? ' on' : '') + '" data-nav="presets" data-label="预设">'
      + ICON.layers + '<span class="tip">预设库 · ' + preN + ' 套（当前专题）</span></button>';
    h += '<button class="rail-btn' + (S.view === 'flows' ? ' on' : '') + '" data-nav="flows" data-label="流程">'
      + ICON.branch + '<span class="tip">工作流 · ' + flowN + ' 条（当前专题）</span></button>';
    if (window.DESKTOP && window.DESKTOP.hud) {
      h += '<button class="rail-btn rail-next" data-act="hudnext" data-label="下一步"'
        + ' aria-label="打开下一步悬浮窗" title="下一步 · 悬浮窗（Ctrl+Alt+Z）">'
        + ICON.pointer + '<span class="tip">下一步 · 在 eNSP 里卡住时点这里</span></button>';
    }
    h += '<button class="rail-btn' + (S.view === 'fav' ? ' on' : '') + '" data-nav="fav" data-label="收藏">'
      + ICON.star + (FAV.size ? '<span class="dot-fav"></span>' : '')
      + '<span class="tip">收藏 · ' + FAV.size + ' 项（全站）</span></button>';
    h += '<div class="rail-grow"></div>';
    h += '<button class="skin-btn" data-skin-open aria-label="皮肤" title="皮肤 · '
      + esc(curSkin().name) + '（点一下换）">' + ICON.palette + '</button>';
    h += '<div class="rail-ver">v' + esc(D.meta.version) + '</div>';
    $('#rail').innerHTML = h;
  }

  /* ---------- 皮肤面板 ----------
     每张卡的迷你预览是现画的（吃 --p-* 变量），不是截图：
     以后加皮肤只改 skins.js 的 LIST，这里不用动一行。 */
  function renderSkins() {
    const g = $('#skGrid');
    if (!g || !SK) return;
    const cur = SK.current();
    g.innerHTML = SK.LIST.map(s =>
      '<button class="sk-card" data-skin="' + s.id + '" data-active="' + (s.id === cur ? 1 : 0) + '"'
      + ' style="' + SK.previewStyle(s) + '" title="' + esc(s.name + ' — ' + s.desc) + '">'
      + '<span class="sk-prev">'
      +   '<span class="sk-rail"><i></i><i></i><i></i></span>'
      +   '<span class="sk-rows"><i></i><i></i><i></i></span>'
      + '</span>'
      + '<span class="sk-name">' + esc(s.name) + '</span>'
      + '<span class="sk-desc">' + esc(s.desc) + '</span>'
      + '</button>').join('');
  }
  function openSkins() {
    const d = $('#skinDlg');
    if (!d) return;
    renderSkins();
    d.classList.add('on');
    d.setAttribute('aria-hidden', 'false');
  }
  function closeSkins() {
    const d = $('#skinDlg');
    if (!d) return;
    d.classList.remove('on');
    d.setAttribute('aria-hidden', 'true');
  }

  /* 换肤后统一在这里刷新：左轨按钮上的皮肤名、面板里的对勾。
     放在事件里而不是 applySkin 里，是因为悬浮窗换了皮肤
     （另一个窗口，走 storage 事件）时本窗也要跟着对上。 */
  window.addEventListener('skin:change', () => {
    renderRail();
    if ($('#skinDlg') && $('#skinDlg').classList.contains('on')) renderSkins();
  });

  /* ---------- 专题内部的分类胶囊 ---------- */
  function renderCatTabs() {
    const el = $('#catTabs');
    if (!el) return;
    refreshTopics();
    const cats = topicCats(S.topic);
    if (S.view === 'fav' || cats.length < 2) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = '<span class="ct-lead">' + esc(topicDef(S.topic).name) + '</span>'
      + cats.map(cid => {
        const c = D.categories.find(x => x.id === cid);
        const on = S.view === 'cat' && S.cat === cid;
        return '<button class="cat-tab' + (on ? ' on' : '') + '" data-cat-tab="' + esc(cid) + '">'
          + '<span>' + esc(c.short || c.name) + '</span><b>' + (c.items || []).length + '</b></button>';
      }).join('');
  }

  /* ============================================================
     列表
     ============================================================ */
  /* ---------- 模糊搜索 ----------
     算法本身在 assets/search.js 里（单独成文件是为了能在命令行直接跑
     一批查询验证命中，不用靠截图猜）。这里只做接线。

     规则回顾：输入按空格分词，每个词都要命中同一个字段（AND），
     词首命中 > 句中命中，保持输入顺序和原样连续出现会加分，
     组内按分数排，命令名权重最高所以命令排在片段前面。 */
  const SEARCH = window.SEARCH || {
    /* 兜底：万一 search.js 没加载上（文件缺失、被拦截），
       搜索会退化成「搜不到」，但整个应用不能因此白屏。 */
    qTokens: q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean),
    groups: () => []
  };
  const qTokens = SEARCH.qTokens;

  function searchGroups(q) {
    return SEARCH.groups(D, CMD, q, 60);
  }

  function favGroups() {
    const sn = [], ls = [], ps = [], fs = [];
    const ord = {};
    D.categories.forEach((c, i) => { ord[c.id] = i; });
    FAV.forEach(k => {
      const i = k.indexOf(':');
      const kind = k.slice(0, i), id = k.slice(i + 1);
      if (kind === 'snippet' && ITEMS[id]) sn.push(ITEMS[id]);
      else if (kind === 'lab') { const l = (D.labs || []).find(x => x.id === id); if (l) ls.push(l); }
      else if (kind === 'preset') { const p = D.presets.find(x => x.id === id); if (p) ps.push(p); }
      else if (kind === 'flow') { const f = D.flows.find(x => x.id === id); if (f) fs.push(f); }
    });
    sn.sort((a, b) => ord[a.cat] - ord[b.cat]);
    const gs = [];
    if (sn.length) gs.push({ kind: 'snippet', name: '代码片段', items: sn });
    if (ls.length) gs.push({ kind: 'lab', name: '实验', items: ls });
    if (ps.length) gs.push({ kind: 'preset', name: '预设库', items: ps });
    if (fs.length) gs.push({ kind: 'flow', name: '工作流', items: fs });
    return gs;
  }

  const LAB_LEVELS = ['入门', '进阶', '综合'];

  function groupsForView() {
    if (S.view === 'fav') return favGroups();
    if (S.view === 'cat') {
      const c = D.categories.find(x => x.id === S.cat);
      const items = c ? (c.items || []) : [];
      /* 同一个分类里再按难度分组：70 条一长串不好扫，分组后能直接跳到「进阶」 */
      const levels = LAB_LEVELS.filter(lv => items.some(x => x.level === lv));
      if (levels.length > 1) {
        return levels.map(lv => ({
          kind: 'snippet', name: lv, items: items.filter(x => x.level === lv)
        }));
      }
      return [{ kind: 'snippet', name: c ? c.name : '代码片段', items }];
    }
    if (S.view === 'labs') {
      const all = scoped(D.labs);
      return LAB_LEVELS
        .map(lv => ({ kind: 'lab', name: lv, items: all.filter(x => x.level === lv) }))
        .filter(g => g.items.length);
    }
    if (S.view === 'presets') return [{ kind: 'preset', name: '预设库', items: scoped(D.presets) }];
    return [{ kind: 'flow', name: '工作流', items: scoped(D.flows) }];
  }

  /* 搜索命中高亮：先转义再包 mark，避免注入 */
  function hlHit(s) {
    const raw = esc(String(s == null ? '' : s));
    const toks = qTokens(S.q);
    if (!toks.length) return raw;
    /* 分词高亮，且把命中扩展到整个词：
       输入 "dis"，命令里 display 只标 dis 会显示成「dis play」像断成两半，
       所以前后各允许吃一串单词字符，让整个 display 一起亮。
       （中文不在 \w 里，中文词不会被误扩展，正好） */
    const pat = toks.slice()
      .sort((a, b) => b.length - a.length)
      .map(t => '[\\w\\-./]*' + esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\w\\-./]*')
      .join('|');
    if (!pat) return raw;
    try { return raw.replace(new RegExp('(' + pat + ')', 'gi'), '<mark class="hit">$1</mark>'); }
    catch (e) { return raw; }
  }

  /* ---------- 卡片 ---------- */
  function cardHTML(kind, it, on, showKind) {
    let sub = '', tags = [], badge = '';
    if (kind === 'snippet') {
      const n = uniqueVars(it.code).length;
      sub = it.desc; tags = it.tags || [];
      if (n) badge = n + ' 自主';
      if (showKind) tags = [SHORT[it.cat] || it.catName].concat(tags);
    } else if (kind === 'preset') {
      sub = it.summary; tags = it.features || [];
      badge = (it.task ? it.task.steps.length + ' 步 · 任务' : it.steps.length + ' 步');
    } else if (kind === 'lab') {
      sub = it.goal; tags = [it.level].concat((it.topo && it.topo.nodes) ? [it.topo.nodes.length + ' 节点'] : []);
      badge = it.steps.length + ' 步 · ' + it.minutes + '′';
    } else if (kind === 'cmd') {
      /* 命令卡片：标题是命令本身，正文是解释，示例放标签行——
         搜 dis isis 时一眼就能分出哪几条是真的 display isis xxx。 */
      sub = it.desc;
      tags = it.eg ? [it.eg] : [];
      badge = it.eg ? '' : '命令';
    } else if (kind === 'recipe') {
      sub = it.scene || '';
      tags = it.tags || [];
      badge = (it.steps || []).length + ' 步 · 剧本';
    } else {
      sub = it.summary;
      badge = Object.keys(it.nodes).filter(k => it.nodes[k].kind === 'end').length + ' 结论';
    }
    const fav = kind !== 'cmd' && kind !== 'recipe' && isFav(kind, it.id);
    return '<button class="card' + (on ? ' on' : '') + '" data-id="' + esc(it.id) + '" data-kind="' + kind + '">'
      + '<span class="card-t">' + hlHit(it.title)
      + (badge ? '<span class="vcount">' + esc(badge) + '</span>' : '') + '</span>'
      + '<span class="card-d">' + hlHit(sub) + '</span>'
      + '<span class="card-tags">' + tags.slice(0, 4)
        .map(t => '<span' + (kind === 'cmd' ? ' class="eg"' : '') + '>' + esc(t) + '</span>').join('')
      + '</span>'
      + (kind === 'cmd' || kind === 'recipe' ? ''
        : '<span class="fav-btn' + (fav ? ' on' : '') + '" data-fav="' + esc(favKey(kind, it.id)) + '"'
          + ' role="button" aria-label="收藏">' + ICON.star + '</span>')
      + '</button>';
  }

  function renderList() {
    const searching = !!S.q;
    const groups = searching ? searchGroups(S.q) : groupsForView();
    renderCatTabs();

    const flat = [];
    groups.forEach(g => g.items.forEach(it => flat.push({ kind: g.kind, id: it.id })));

    let curKind = S.view === 'fav' ? S.favKind
      : (S.view === 'cat' ? 'snippet'
        : S.view === 'labs' ? 'lab'
          : S.view === 'presets' ? 'preset' : 'flow');
    let curId = S.sel[VMAP[curKind]];

    if (!flat.some(x => x.kind === curKind && x.id === curId)) {
      if (searching) {
        curId = null;   // 搜索态不自动改选中，避免主面板跟着乱跳
      } else {
        const f = flat[0];
        if (f) {
          curKind = f.kind;
          curId = f.id;
          S.favKind = f.kind;
          S.sel[VMAP[f.kind]] = f.id;
          if (f.kind === 'flow') {
            const fl = D.flows.find(x => x.id === f.id);
            if (fl) S.open = new Set([fl.root]);
          }
        } else {
          curId = null;
        }
      }
    }

    let h = '';
    if (searching) {
      const toks = qTokens(S.q);
      h += '<div class="lp-hint">全站搜索 <b>' + esc(S.q) + '</b> · 命中 <b>' + flat.length + '</b> 条'
        + (toks.length > 1 ? '（按「' + toks.map(t => esc(t)).join('」+「') + '」同时匹配）' : '')
        + '</div>';
    }
    if (!flat.length) {
      const tn = topicDef(S.topic).name;
      let empty;
      if (searching) {
        empty = '没有匹配「' + esc(S.q) + '」的内容。<br><span class="dim">可以试试：dis isis · ospf 邻居 · getParameter · 清除浮动 · jQuery ajax</span>';
      } else if (S.view === 'fav') {
        empty = '还没有收藏。卡片右上角的星号就是收藏按钮。';
      } else if (S.view === 'labs') {
        empty = '「' + esc(tn) + '」还没有实训内容。<br><span class="dim">eNSP 的实验在「网络工程」里，JavaWeb / Web 的动手内容在「预设库」。</span>';
      } else if (S.view === 'presets') {
        empty = '「' + esc(tn) + '」还没有预设。';
      } else if (S.view === 'flows') {
        empty = '「' + esc(tn) + '」还没有工作流。';
      } else {
        empty = '「' + esc(tn) + '」这个分类还没有内容。';
      }
      h += '<div class="lp-empty">' + empty + '</div>';
    }

    groups.forEach(g => {
      if (!g.items.length) return;
      h += '<div class="lp-group grp"><span class="cnt">'
        + (g.total && g.total > g.items.length ? '前 ' + g.items.length + ' / 共 ' + g.total : g.items.length)
        + ' 项</span>' + esc(g.name) + '</div>';
      g.items.forEach(it => {
        h += cardHTML(g.kind, it, g.kind === curKind && it.id === curId, searching);
      });
    });

    $('#listScroll').innerHTML = h;
    const packN = (window.PACKS && window.PACKS.count) || 0;
    $('#lpFoot').innerHTML = '<span>'
      + (searching ? '全站 ' + flat.length : (S.view === 'fav' ? '收藏 ' + flat.length : '共 ' + flat.length)) + ' 项</span>'
      + '<button class="foot-btn" data-act="packs" title="导入 / 导出知识包">' + ICON.pack + '知识包'
      + (packN ? '<b>' + packN + '</b>' : '') + '</button>';
  }

  /* ============================================================
     主面板
     ============================================================ */
  function renderMain() {
    syncHash();
    const view = S.view === 'fav' ? VMAP[S.favKind] : S.view;
    /* 收藏是跨专题的，收藏视图里不做专题过滤；其余视图只看当前专题 */
    const pool = list => (S.view === 'fav' ? (list || []) : scoped(list));
    if (view === 'cat') {
      const it = ITEMS[S.sel.cat];
      $('#mainScroll').innerHTML = it ? snippetHTML(it) : emptyHTML('选择左侧任意片段开始');
    } else if (view === 'labs') {
      const l = pool(D.labs).find(x => x.id === S.sel.labs);
      $('#mainScroll').innerHTML = l ? labHTML(l) : emptyHTML('选择左侧任意实验开始');
    } else if (view === 'presets') {
      const p = pool(D.presets).find(x => x.id === S.sel.presets);
      $('#mainScroll').innerHTML = p ? presetHTML(p) : emptyHTML('选择一套预设开始');
    } else {
      const f = pool(D.flows).find(x => x.id === S.sel.flows);
      $('#mainScroll').innerHTML = f ? flowHTML(f) : emptyHTML('选择一条工作流开始');
    }
  }

  function emptyHTML(t) {
    return '<div class="detail"><p class="lede">' + esc(t) + '</p></div>';
  }

  function backBtn() {
    return '<button class="mob-back" data-act="back">' + ICON.back + '返回列表</button>';
  }

  /* ---------------- 片段详情 ---------------- */
  function snippetHTML(item) {
    const cd = codeDef(item);
    const names = uniqueVars(cd.code);
    const scope = item.id;
    const cv = curVariant(item);

    const seg = item.variants
      ? '<div class="seg">' + item.variants.map(v =>
        '<button class="seg-b' + (v.id === cv.id ? ' on' : '') + '" data-variant="' + esc(v.id) + '">' + esc(v.label) + '</button>'
      ).join('') + '</div>'
      : '';

    const envLabel = item.cat === 'ensp' ? '设备' : '环境';
    const chips = []
      .concat(item.device ? ['<span class="chip k"><b>' + envLabel + '</b> ' + esc(item.device) + '</span>'] : [])
      .concat(item.level ? ['<span class="chip">' + esc(item.level) + '</span>'] : [])
      .concat(names.length ? ['<span class="chip iris">' + names.length + ' 处可配置</span>'] : [])
      .join('');

    const fname = item.id + '.' + (EXT[item.cat] || 'txt');

    const ownChips = names.map(n => {
      const def = cd.vars[n] || { label: n, hint: '' };
      const val = gv(scope, n, def.value);
      return '<button class="own-chip" data-s="' + esc(scope) + '" data-v="' + esc(n) + '">'
        + '<span class="k">' + esc(def.label || n) + '</span>'
        + '<span class="val">' + esc(val) + '</span>'
        + (def.hint ? '<span class="hint">' + esc(def.hint) + '</span>' : '')
        + '</button>';
    }).join('');

    const rel = [];
    if (item.flow) {
      const f = D.flows.find(x => x.id === item.flow);
      if (f) rel.push('<button class="rel" data-goto-flow="' + esc(f.id) + '">流程 · ' + esc(f.title) + ICON.arrow + '</button>');
    }
    D.presets.forEach(p => {
      if (!p.task && (p.steps || []).some(s => s.ref === item.id)) {
        rel.push('<button class="rel" data-goto-preset="' + esc(p.id) + '">整套 · ' + esc(p.title) + ICON.arrow + '</button>');
      }
    });

    return '<div class="detail">'
      + backBtn()
      + '<div class="crumb"><span>' + esc(item.catName) + '</span><span class="sep">/</span>'
      + '<span class="cur">' + esc((item.tags || [])[0] || 'snippet') + '</span></div>'
      + '<h1 class="title">' + esc(item.title) + '</h1>'
      + '<p class="lede">' + esc(item.desc) + '</p>'
      + '<div class="chiprow">' + chips + '</div>'

      + '<div class="toolbar">' + seg + '<div class="acts">'
      + '<button class="btn ghost" data-act="docs">' + ICON.book + '官方解答</button>'
      + '<button class="btn primary" data-act="copy">' + ICON.copy + '复制代码</button>'
      + '</div></div>'

      + '<div class="codewrap"><div class="code-h">'
      + '<span class="dots"><i></i><i></i><i></i></span>'
      + '<span class="fname">' + esc(fname) + '</span>'
      + '<span class="legend"><span class="own-sm">自主</span> 可点改</span>'
      + '<button class="mini" data-act="copy" style="margin-left:8px">复制</button>'
      + '</div>'
      + '<pre class="code"><code>' + renderCode(scope, cd.code, cd.vars, item.cat === 'ensp') + '</code></pre>'
      + '</div>'
      + '<div class="legendbar"><span class="swatch"></span>琥珀色块是自主配置区，点一下就能改，代码会实时更新</div>'

      + (names.length ? '<div class="section-h"><span class="n">' + names.length + ' 处</span>自主配置区</div>'
        + '<div class="owns-grid">' + ownChips + '</div>' : '')

      + (rel.length ? '<div class="section-h">相关</div><div class="rel-row">' + rel.join('') + '</div>' : '')
      + '</div>';
  }

  /* ---------------- 可执行任务（预设升级形态） ----------------
     任务与普通预设的区别：环境参数全任务共享、步骤有明确设备归属、
     可以勾选进度、带可勾选的验证清单。内容只存在 task.steps 一处，
     主界面和「下一步」都从这里派生，避免两套配置走岔。 */
  function taskEnvHTML(scope, env) {
    return Object.keys(env).map(k => {
      const def = env[k] || { label: k, value: '' };
      REG[scope + '|' + k] = def;
      const val = gv(scope, k, def.value);
      return '<button class="own-chip" data-s="' + esc(scope) + '" data-v="' + esc(k) + '" title="点击修改">'
        + '<span class="k">' + esc(def.label || k) + '</span>'
        + '<span class="val">' + esc(val) + '</span>'
        + '<span class="hint">' + esc(def.hint || '') + '</span>'
        + '</button>';
    }).join('');
  }

  function taskText(p, who) {
    const t = p.task;
    const scope = 'task:' + p.id;
    return (t.steps || []).filter(s => !who || s.who === who)
      .map(s => plain(scope, s.code, t.env || {})).filter(Boolean).join('\n\n');
  }

  function taskProgressHTML(p) {
    const t = p.task, st = taskState(p.id);
    const stepDone = Object.keys(st.done).filter(k => st.done[k]).length;
    const verDone = Object.keys(st.verify).filter(k => st.verify[k]).length;
    const pct = t.steps.length ? Math.round(stepDone / t.steps.length * 100) : 0;
    return '<div class="task-prog" aria-label="任务进度">'
      + '<div class="task-prog-top"><b>' + stepDone + ' / ' + t.steps.length + ' 步</b>'
      + '<span>' + verDone + ' / ' + (t.verify || []).length + ' 项验证通过</span></div>'
      + '<div class="task-bar"><i style="width:' + pct + '%"></i></div></div>';
  }

  function taskHTML(p) {
    const t = p.task;
    const scope = 'task:' + p.id;
    const st = taskState(p.id);
    const devs = t.devices || [];
    const known = new Set(devs.map(d => d.id));

    const groups = devs.map(d => ({
      id: d.id, role: d.role || '', note: d.note || '',
      steps: t.steps.map((s, i) => ({ s, i })).filter(x => x.s.who === d.id)
    }));
    t.steps.forEach((s, i) => {
      if (!known.has(s.who)) groups.push({ id: s.who || '通用', role: '', note: '', steps: [{ s, i }] });
    });

    const stepHTML = groups.filter(g => g.steps.length).map(g =>
      '<section class="task-dev" data-task-dev="' + esc(g.id) + '">'
      + '<div class="task-dev-h"><div><b>' + esc(g.id) + '</b>'
      + (g.role ? '<span class="task-role">' + esc(g.role) + '</span>' : '')
      + (g.note ? '<span class="task-wire">' + esc(g.note) + '</span>' : '') + '</div>'
      + '<button class="btn ghost task-dev-copy" data-act="taskcopy" data-who="' + esc(g.id) + '">'
      + ICON.copy + '复制 ' + esc(g.id) + ' 全部</button></div>'
      + g.steps.map(({ s, i }) => {
        const done = !!st.done[i];
        return '<div class="task-step' + (done ? ' done' : '') + '">'
          + '<div class="pstep-h">'
          + '<button class="task-check' + (done ? ' on' : '') + '" data-task-step="' + i + '"'
          + ' aria-pressed="' + (done ? 'true' : 'false') + '" aria-label="标记第 ' + (i + 1) + ' 步完成">✓</button>'
          + '<span class="idx">' + (i + 1) + '</span>'
          + '<span class="t">' + esc(s.title) + '</span>'
          + '<span class="task-who">' + esc(s.who || '通用') + '</span>'
          + '<button class="go" data-act="taskcopy" data-step="' + i + '">复制本步 ›</button>'
          + '</div>'
          + (s.note ? '<div class="step-note">' + esc(s.note) + '</div>' : '')
          + '<div class="codewrap"><div class="code-h">'
          + '<span class="dots"><i></i><i></i><i></i></span>'
          + '<span class="fname">' + esc(String(s.who || 'task').toLowerCase()) + '_' + (i + 1) + '.cfg</span>'
          + '<span class="legend"><span class="own-sm">自主</span> 改一次，全任务同步</span>'
          + '</div><pre class="code"><code>' + renderCode(scope, s.code, t.env || {}, true) + '</code></pre></div>'
          + '</div>';
      }).join('')
      + '</section>').join('');

    const plan = Array.isArray(t.plan) && t.plan.length
      ? '<div class="section-h">设备与连接</div><div class="plan-wrap"><table class="plan-t"><thead><tr>'
        + (t.planHead || ['设备', '角色', '接口', '说明']).map(x => '<th>' + esc(x) + '</th>').join('')
        + '</tr></thead><tbody>'
        + t.plan.map(r => '<tr><td class="d">' + esc(r.dev) + '</td><td class="i">' + esc(r.intf || '') + '</td>'
          + '<td class="a">' + esc(r.ip || '') + '</td><td class="n">' + esc(r.note || '') + '</td></tr>').join('')
        + '</tbody></table></div>'
      : '';

    const verify = (t.verify || []).length
      ? '<div class="section-h">验证：逐项确认</div><div class="vlist task-verify">'
      + t.verify.map((v, i) => {
        const done = !!st.verify[i];
        return '<div class="vitem task-v' + (done ? ' done' : '') + '">'
          + '<div class="task-v-h">'
          + '<button class="task-check' + (done ? ' on' : '') + '" data-task-verify="' + i + '"'
          + ' aria-pressed="' + (done ? 'true' : 'false') + '" aria-label="标记验证 ' + (i + 1) + ' 通过">✓</button>'
          + (v.who ? '<span class="task-who">' + esc(v.who) + '</span>' : '')
          + '<code class="vcmd">' + renderCode(scope, v.cmd, t.env || {}, true) + '</code></div>'
          + '<span class="vhope">' + esc(v.hope) + '</span></div>';
      }).join('') + '</div>'
      : '';

    return '<div class="detail task">'
      + backBtn()
      + '<div class="crumb"><span>任务</span><span class="sep">/</span><span class="cur">可执行方案</span></div>'
      + '<h1 class="title">' + esc(p.title) + '</h1>'
      + '<p class="lede">' + esc(p.summary) + '</p>'
      + '<div class="chiprow"><span class="chip mint">' + t.steps.length + ' 步</span>'
      + '<span class="chip">' + devs.length + ' 台设备</span>'
      + '<span class="chip">' + (t.verify || []).length + ' 项验证</span>'
      + (p.features || []).map(f => '<span class="chip">' + esc(f) + '</span>').join('') + '</div>'
      + '<div class="toolbar task-toolbar"><div class="acts" style="margin-left:0;width:100%">'
      + '<button class="btn ghost" data-act="docs">' + ICON.book + '官方解答</button>'
      + '<button class="btn ghost" data-act="taskreset">恢复未开始</button>'
      + '<span class="task-saved">进度自动保存在本机</span>'
      + '</div></div>'
      + taskProgressHTML(p)
      + '<div class="section-h">任务参数<span class="n">改一次，所有设备同步</span></div>'
      + '<div class="owns-grid task-env">' + taskEnvHTML(scope, t.env || {}) + '</div>'
      + plan
      + '<div class="section-h">按设备执行</div>'
      + '<div class="task-steps">' + stepHTML + '</div>'
      + verify
      + (p.docs && p.docs.secs ? '<div class="section-h">为什么这样配</div>'
        + p.docs.secs.map(s => '<div class="task-doc"><b>' + esc(s.h) + '</b><p>' + esc(s.p) + '</p></div>').join('') : '')
      + '</div>';
  }

  /* ---------------- 预设详情 ---------------- */
  function presetHTML(p) {
    if (p.task) return taskHTML(p);
    const body = p.steps.map((st, i) => {
      const snip = ITEMS[st.ref];
      if (!snip) return '';
      const scope = 'p:' + p.id + ':' + i;
      const vars = presetVars(snip, st.vars);
      return '<div class="pstep">'
        + '<div class="pstep-h"><span class="idx">' + (i + 1) + '</span>'
        + '<span class="t">' + esc(snip.title) + '</span>'
        + (st.note ? '<span class="note">· ' + esc(st.note) + '</span>' : '')
        + '<button class="go" data-act="presetstepcopy" data-i="' + i + '">复制本步 ›</button>'
        + '<button class="go" data-goto-snippet="' + esc(snip.id) + '">单条查看 ›</button></div>'
        + '<div class="codewrap"><div class="code-h">'
        + '<span class="dots"><i></i><i></i><i></i></span>'
        + '<span class="fname">step' + (i + 1) + '_' + snip.id + '.' + (EXT[snip.cat] || 'cfg') + '</span>'
        + '<span class="legend"><span class="own-sm">自主</span></span>'
        + '</div><pre class="code"><code>'
        + renderCode(scope, snip.code, vars, snip.cat === 'ensp')
        + '</code></pre></div></div>';
    }).join('');

    return '<div class="detail">'
      + backBtn()
      + '<div class="crumb"><span>预设库</span><span class="sep">/</span><span class="cur">整套配置</span></div>'
      + '<h1 class="title">' + esc(p.title) + '</h1>'
      + '<p class="lede">' + esc(p.summary) + '</p>'
      + '<div class="chiprow">'
      + '<span class="chip mint">' + p.steps.length + ' 步</span>'
      + (p.features || []).map(f => '<span class="chip">' + esc(f) + '</span>').join('')
      + '</div>'
      + (p.scene ? '<p class="lede" style="margin-top:12px;font-size:12.5px;color:var(--tx-3)">适用场景：' + esc(p.scene) + '</p>' : '')
      + '<div class="toolbar"><div class="acts" style="margin-left:0;width:100%">'
      + '<button class="btn ghost" data-act="docs">' + ICON.book + '官方解答</button>'
      + '<button class="btn primary" data-act="copy">' + ICON.copy + '复制全部步骤</button>'
      + '</div></div>'
      + '<div class="legendbar"><span class="swatch"></span>每一块琥珀色都是独立的自主配置区；多设备任务请按步骤复制</div>'
      + '<div style="margin-top:18px">' + body + '</div>'
      + '</div>';
  }

  /* ---------------- 实验详情 ---------------- */
  /* 拓扑图：纯 SVG，坐标来自 data.js 的 topo.nodes（760×h 画布） */
  function topoSVG(t) {
    if (!t || !t.nodes || !t.nodes.length) return '';
    const byId = {};
    t.nodes.forEach(n => { byId[n.id] = n; });

    /* 按节点实际边界裁 viewBox，避免上下大片空白 */
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    t.nodes.forEach(n => {
      const small = n.t === 'pc' || n.t === 'server';
      const w = small ? 58 : 64, h = 40;
      minX = Math.min(minX, n.x - w / 2);
      maxX = Math.max(maxX, n.x + w / 2);
      minY = Math.min(minY, n.y - h / 2);
      maxY = Math.max(maxY, n.y + h / 2 + (n.sub ? 18 : 0));
    });
    const pad = 26;
    const vx = Math.max(0, minX - pad);
    const vy = Math.max(0, minY - pad);
    const vw = Math.min(760, maxX + pad) - vx;
    const vh = maxY + pad - vy;

    let s = '<svg class="topo" viewBox="' + Math.round(vx) + ' ' + Math.round(vy) + ' ' + Math.round(vw) + ' ' + Math.round(vh)
      + '" role="img" aria-label="实验拓扑图">';

    (t.links || []).forEach(l => {
      const a = byId[l[0]], b = byId[l[1]];
      if (!a || !b) return;
      s += '<line class="tp-line" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
      if (l[2]) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const vert = Math.abs(a.x - b.x) < 24;
        s += '<text class="tp-link-tx" x="' + (vert ? mx + 9 : mx) + '" y="' + (vert ? my + 4 : my - 8) + '"'
          + ' text-anchor="' + (vert ? 'start' : 'middle') + '">' + esc(l[2]) + '</text>';
      }
    });

    t.nodes.forEach(n => {
      const small = n.t === 'pc' || n.t === 'server';
      const w = small ? 58 : 64, h = 40;
      s += '<g class="tp-node t-' + esc(n.t || 'switch') + '">'
        + '<rect x="' + (n.x - w / 2) + '" y="' + (n.y - h / 2) + '" width="' + w + '" height="' + h + '" rx="'
        + (n.t === 'router' ? 18 : 9) + '"/>'
        + '<text class="tp-label" x="' + n.x + '" y="' + (n.y + 4.5) + '" text-anchor="middle">' + esc(n.label) + '</text>'
        + '</g>';
      if (n.sub) {
        s += '<text class="tp-sub" x="' + n.x + '" y="' + (n.y + h / 2 + 15) + '" text-anchor="middle">' + esc(n.sub) + '</text>';
      }
    });

    return s + '</svg>';
  }

  function labHTML(l) {
    const scope = 'lab:' + l.id;
    const vars = l.vars || {};
    const V = (code) => renderCode(scope, code, vars, true);

    const steps = (l.steps || []).map((st, i) => {
      const refSnip = st.ref ? ITEMS[st.ref] : null;
      return '<div class="pstep">'
        + '<div class="pstep-h"><span class="idx">' + (i + 1) + '</span>'
        + '<span class="t">' + esc(st.title) + '</span>'
        + '<button class="go" data-act="labstepcopy" data-i="' + i + '">复制本步 ›</button>'
        + (refSnip ? '<button class="go" data-goto-snippet="' + esc(refSnip.id) + '">单条查看 ›</button>' : '')
        + '</div>'
        + (st.note ? '<div class="step-note">' + esc(st.note) + '</div>' : '')
        + '<div class="codewrap"><div class="code-h">'
        + '<span class="dots"><i></i><i></i><i></i></span>'
        + '<span class="fname">' + (i + 1) + '_' + esc(l.id.replace(/^lab-/, ''))
        + '.' + esc(l.fileExt || (l.topo ? 'cfg' : 'txt')) + '</span>'
        + '<span class="legend"><span class="own-sm">自主</span> 可点改</span>'
        + '</div><pre class="code"><code>' + V(st.code) + '</code></pre></div></div>';
    }).join('');

    const planHead = l.planHead || ['设备', '接口', '地址 / 配置', '说明'];
    const plan = Array.isArray(l.plan) && l.plan.length
      ? '<div class="section-h">' + (l.planTitle || (l.topo ? '地址与接口规划' : '环境与文件')) + '</div>'
      + '<div class="plan-wrap"><table class="plan-t"><thead><tr>'
      + planHead.map(h => '<th>' + esc(h) + '</th>').join('')
      + '</tr></thead><tbody>'
      + l.plan.map(r => '<tr><td class="d">' + esc(r.dev) + '</td><td class="i">' + esc(r.intf) + '</td>'
        + '<td class="a">' + esc(r.ip) + '</td><td class="n">' + esc(r.note || '') + '</td></tr>').join('')
      + '</tbody></table></div>'
      : '';

    const verify = (l.verify || []).length
      ? '<div class="section-h">验证：做完怎么确认</div><div class="vlist">'
      + l.verify.map(v => '<div class="vitem">'
        + '<code class="vcmd">' + V(v.cmd) + '</code>'
        + '<span class="vhope">' + esc(v.hope) + '</span></div>').join('')
      + '</div>'
      : '';

    const pits = (l.pitfalls || []).length
      ? '<div class="section-h">常见错误（照着抄最容易踩的）</div><ul class="pit-list">'
      + l.pitfalls.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>'
      : '';

    return '<div class="detail lab">'
      + backBtn()
      + '<div class="crumb"><span>实验</span><span class="sep">/</span><span class="cur">' + esc(l.level) + '</span></div>'
      + '<h1 class="title">' + esc(l.title) + '</h1>'
      + '<p class="lede">' + esc(l.goal) + '</p>'
      + (l.scene ? '<p class="lab-scene"><span>适用场景</span>' + esc(l.scene) + '</p>' : '')
      + '<div class="chiprow">'
      + '<span class="chip ' + (l.level === '综合' ? 'iris' : l.level === '入门' ? 'mint' : '') + '">' + esc(l.level) + '</span>'
      + '<span class="chip">' + (l.steps || []).length + ' 步</span>'
      + '<span class="chip">约 ' + l.minutes + ' 分钟</span>'
      + (l.topo && l.topo.nodes ? '<span class="chip k"><b>' + l.topo.nodes.length + '</b> 台设备</span>' : '')
      + '<span class="chip k"><b>' + Object.keys(vars).length + '</b> 处可配置</span>'
      + '</div>'
      + '<div class="toolbar"><div class="acts" style="margin-left:0;width:100%">'
      + '<button class="btn ghost" data-act="docs">' + ICON.book + '官方解答</button>'
      + '<button class="btn primary" data-act="copy">' + ICON.copy + '复制全部步骤</button>'
      + '</div></div>'
      + (l.topo && l.topo.nodes && l.topo.nodes.length
        ? '<figure class="topo-wrap" data-act="topozoom"><div class="topo-scroll">' + topoSVG(l.topo) + '</div>'
          + '<figcaption><span class="topo-hint">点拓扑可放大</span>拓扑示意 · 端口号按你的实际连线改，命令里的变量点一下就能改</figcaption></figure>'
        : '')
      + plan
      + '<div class="section-h">' + (l.stepsTitle || (l.topo ? '配置步骤' : '实现步骤')) + '</div>'
      + '<div class="stepbody">' + steps + '</div>'
      + verify
      + pits
      + '</div>';
  }

  /* ---------------- 工作流 ---------------- */
  const KIND_LABEL = { q: '提问', o: '选项', end: '结论', warn: '注意' };

  function nodeHTML(flow, id, seen) {
    const n = flow.nodes[id];
    if (!n || seen.has(id)) return '';
    seen.add(id);
    const kids = (n.children || []).filter(k => flow.nodes[k]);
    const open = S.open.has(id);

    let card = '<button class="tcard" data-flow="' + esc(flow.id) + '" data-node="' + esc(id) + '">'
      + '<span class="kindtag">' + (KIND_LABEL[n.kind] || '节点') + '</span>'
      + '<span class="lab">' + esc(n.label) + '</span>'
      + (n.note ? '<span class="sub">' + esc(n.note) + '</span>' : '')
      + (kids.length ? '<span class="fold">' + (open ? '收起 ▲' : '展开 ' + kids.length + ' 个分支 ▼') + '</span>'
        : (n.body ? '<span class="fold">查看说明 ›</span>' : ''))
      + '</button>';

    let children = '';
    if (kids.length && open) {
      children = '<div class="tchildren">'
        + kids.map(k => nodeHTML(flow, k, new Set(seen))).join('')
        + '</div>';
    }
    return '<div class="tnode k-' + (n.kind || 'o') + '">' + card + children + '</div>';
  }

  function flowHTML(f) {
    if (!S.open.has(f.root)) S.open.add(f.root);
    const ends = Object.keys(f.nodes).filter(k => f.nodes[k].kind === 'end').length;
    return '<div class="detail"><div style="max-width:none">'
      + backBtn()
      + '<div class="crumb"><span>工作流</span><span class="sep">/</span><span class="cur">' + ends + ' 条结论</span></div>'
      + '<h1 class="title">' + esc(f.title) + '</h1>'
      + '<p class="lede">' + esc(f.summary) + '</p>'
      + '<div class="chiprow"><span class="chip iris">点节点展开分支</span>'
      + '<span class="chip">绿色 = 结论，点开有配置</span></div>'
      + '<div class="tree-scroll"><div class="tree">' + nodeHTML(f, f.root, new Set()) + '</div></div>'
      + '</div></div>';
  }

  /* ============================================================
     官方解答面板
     ============================================================ */
  function openDocs(payload) {
    S.docs = payload;
    renderDocs();
    document.body.classList.add('docs-open');
  }
  function closeDocs() {
    document.body.classList.remove('docs-open');
  }
  function openCmdDoc(word) {
    if (!word) return;
    openDocs({ kind: 'cmd', word: word });
  }
  function openCurrentDocs() {
    const view = S.view === 'fav' ? VMAP[S.favKind] : S.view;
    if (view === 'cat') {
      const it = ITEMS[S.sel.cat];
      if (it) openDocs({ kind: 'item', item: it, name: it.catName });
    } else if (view === 'labs') {
      const l = (D.labs || []).find(x => x.id === S.sel.labs);
      if (l) openDocs({ kind: 'item', item: l, name: '实验 · ' + l.title });
    } else if (view === 'presets') {
      const p = D.presets.find(x => x.id === S.sel.presets);
      if (p) openDocs({ kind: 'item', item: p, name: (p.task ? '任务 · ' : '预设库 · ') + p.title });
    }
  }

  function renderDocs() {
    const box = $('#docsPanel');
    const d = S.docs;
    if (!d) { box.innerHTML = ''; return; }

    let kicker = '官方解答', title = '', secs = [], src = null, extra = '';

    if (d.kind === 'item') {
      const it = d.item;
      const doc = it.docs || {};
      kicker = it.name || '官方解答';
      title = doc.title || it.title;
      secs = doc.secs || [{ h: '这条还没整理成中文要点', p: '先用官方文档入口自查。命令本身的行为是确定的，参数含义可以在官方手册里对照。' }];
      src = doc.src;
      extra = '<div class="docs-note">要点是人工整理的，用于快速对齐理解；正式依据以官方文档为准。</div>';
    } else if (d.kind === 'cmd') {
      const c = CMD[d.word] || {};
      kicker = '命令词典';
      title = d.word;
      secs = [{ h: '官方口径', p: c.p || '暂无解释。' }];
      if (c.eg) secs.push({ h: '示例', code: c.eg });
      src = cmdSrcOf(d.word);
      extra = '<div class="docs-note">也可以直接在左上角搜索框里查，支持缩写：'
        + '输入 <b>dis isis</b> 就能翻出所有 display isis 开头的命令。</div>';
    } else if (d.kind === 'node') {
      kicker = '流程结论';
      title = d.node.label;
      secs = [{ h: '说明', p: d.node.body || '' }];
      if (d.node.snippet) {
        const sn = ITEMS[d.node.snippet];
        extra = '<button class="go-snippet" data-goto-snippet="' + esc(d.node.snippet) + '">打开配置片段 · '
          + esc(sn ? sn.title : d.node.snippet) + ' ' + ICON.arrow + '</button>';
      }
    } else if (d.kind === 'recipe') {
      const r = d.recipe;
      kicker = '配置剧本';
      title = r.title;
      secs = [];
      if (r.scene) secs.push({ h: '适用场景', p: r.scene });
      secs.push({
        h: '完整步骤',
        code: (r.steps || []).map((s, i) => (s.who ? '[' + s.who + '] ' : '')
          + (i + 1) + '. ' + s.c + (s.note ? '    # ' + s.note : '')).join('\n')
      });
      if ((r.verify || []).length) {
        secs.push({
          h: '配完怎么验',
          ul: r.verify.map(v => v.cmd + (v.hope ? ' → ' + v.hope : ''))
        });
      }
      extra = '<div class="docs-note">这是“下一步”悬浮窗使用的同一份剧本。'
        + '在桌面端选中 eNSP 里的命令后按快捷键，就能接着往下配。</div>';
    }

    const body = secs.map(s => '<div class="dsec"><h3>' + esc(s.h) + '</h3>'
      + (s.p ? '<p>' + esc(s.p) + '</p>' : '')
      + (s.ul ? '<ul>' + s.ul.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')
      + (s.code ? '<pre>' + esc(s.code) + '</pre>' : '')
      + '</div>').join('');

    box.innerHTML = '<div class="docs-h"><div>'
      + '<span class="kk">' + esc(kicker) + '</span><h2>' + esc(title) + '</h2></div>'
      + '<button class="docs-x" data-act="closedocs" aria-label="关闭">' + ICON.x + '</button></div>'
      + '<div class="docs-body">' + body + extra
      + (src ? '<div class="docs-src"><span class="sl">Source</span>' + esc(src.n)
        + '<br><a href="' + esc(src.u) + '" target="_blank" rel="noopener">查看官方文档 ↗</a></div>' : '')
      + '</div>';
  }

  /* ============================================================
     知识包（导入 / 导出 / 管理）
     ============================================================ */
  let packTab = 'import';
  let packDraft = '';        // 切换页签时保留已粘内容
  let packChecked = null;    // 校验通过、等待确认的包

  const PACK_EMPTY = '<div class="pd-empty">还没有导入过知识包。<br>内置内容在 <code>data.js</code> 里，导入的内容单独存在本机浏览器。</div>';

  function packStatLine(st) {
    if (!st) return '';
    const bits = [];
    if (st.snippets) bits.push(st.snippets + ' 片段');
    if (st.labs) bits.push(st.labs + ' 实验');
    if (st.presets) bits.push(st.presets + ' 预设');
    if (st.flows) bits.push(st.flows + ' 工作流');
    if (st.recipes) bits.push(st.recipes + ' 剧本');
    if (st.cmd) bits.push(st.cmd + ' 命令词');
    return bits.join(' · ') || '空包';
  }

  /* 输入框右上角的「N 字 · N 行」—— 粘完一眼确认进没进来 */
  function packCountUpd() {
    const ta = $('#packText'), c = $('#packCount');
    if (!ta || !c) return;
    const n = ta.value.length;
    c.textContent = n ? (n.toLocaleString('en-US') + ' 字 · ' + ta.value.split('\n').length + ' 行') : '';
  }

  /* 读剪贴板：桌面版走主进程（最可靠），网页版走 Clipboard API；
     安卓 WebView 两者都可能没有 —— 那就把光标放回框里让人自己 Ctrl+V，不报错。 */
  async function packPaste() {
    const ta = $('#packText');
    if (!ta) return;
    let txt = '';
    try {
      if (window.DESKTOP && window.DESKTOP.clip && window.DESKTOP.clip.read) {
        txt = await window.DESKTOP.clip.read();
      } else if (navigator.clipboard && navigator.clipboard.readText) {
        txt = await navigator.clipboard.readText();
      }
    } catch (e) { txt = ''; }
    txt = String(txt || '');
    if (!txt.trim()) {
      ta.focus();
      toast('读不到剪贴板，直接按 Ctrl+V 粘进来');
      return;
    }
    /* 粘贴 = 换掉而不是追加：一次导入就是一个包，追加多半是误操作 */
    const had = ta.value.trim().length > 0;
    ta.value = txt;
    packDraft = txt;
    packChecked = null;
    const r = $('#packReport');
    if (r) r.innerHTML = '';
    packCountUpd();
    ta.scrollTop = 0;
    toast((had ? '已用剪贴板内容替换 · ' : '已粘贴 ') + txt.split('\n').length + ' 行');
  }

  function packClear() {
    const ta = $('#packText');
    if (!ta) return;
    if (!ta.value) { ta.focus(); return; }
    ta.value = '';
    packDraft = '';
    packChecked = null;
    const r = $('#packReport');
    if (r) r.innerHTML = '';
    packCountUpd();
    ta.focus();
    toast('已清空');
  }

  function packBody() {
    const P = window.PACKS;
    if (packTab === 'import') {
      return '<p class="pd-hint">把 JSON 粘进下面 —— 直接粘 AI 的整段回答也行，带不带 Markdown 代码块都能识别；也可以选一个 <code>.json</code> 文件。'
        + '不确定格式，就先点「复制给 AI 的格式说明」，丢给任意 AI 让它按格式产出。</p>'
        + '<div class="pd-tools">'
        + '<button class="pd-mini" data-act="packpaste" title="从剪贴板读入（会替换框里现有内容）">' + ICON.paste + '粘贴</button>'
        + '<button class="pd-mini" data-act="packclear" title="清空输入框">' + ICON.trash + '清空</button>'
        + '<span class="grow"></span>'
        + '<span class="pd-count" id="packCount"></span>'
        + '</div>'
        + '<textarea id="packText" spellcheck="false" placeholder=\'{ "id": "ospf-adv", "name": "OSPF 进阶", "categories": [ ... ], "labs": [ ... ] }\'>'
        + esc(packDraft) + '</textarea>'
        + '<div class="pd-row">'
        + '<label class="pd-file">选择文件<input type="file" id="packFile" accept=".json,application/json" hidden></label>'
        + '<button class="btn ghost" data-act="packfmt">复制给 AI 的格式说明</button>'
        + '<span class="grow"></span>'
        + '<button class="btn primary" data-act="packcheck">校验</button>'
        + '</div>'
        + '<div id="packReport" class="pd-report"></div>';
    }
    if (packTab === 'installed') {
      const list = P ? P.installed() : [];
      let h = '<p class="pd-hint">导入的内容都存在本机浏览器（localStorage），换设备要重新导入；删掉包后刷新即恢复内置内容。</p>';
      if (!list.length) return h + PACK_EMPTY;
      h += '<div class="pd-list">';
      list.forEach(p => {
        h += '<div class="pd-item"><div class="pd-it-main">'
          + '<b>' + esc(p.name) + '</b>'
          + '<span class="pd-tag">v' + esc(p.version) + '</span>'
          + '<div class="pd-it-sub">' + esc(packStatLine(p.stats)) + ' · '
          + esc((p.importedAt || '').slice(0, 10)) + ' 导入</div>'
          + '</div><button class="pd-del" data-act="packdel" data-pack="' + esc(p.id) + '">删除</button></div>';
      });
      return h + '</div>';
    }
    /* export */
    return '<p class="pd-hint">导出的 JSON 可以直接粘到另一台设备的「导入」里，也是交给 AI 让它续写/改写的底稿。</p>'
      + '<div class="pd-cards">'
      + '<button class="pd-card" data-act="packcopyall"><b>复制全量 JSON</b><span>当前全部内容打包，粘贴即备份</span></button>'
      + '<button class="pd-card" data-act="packdlall"><b>下载 .json</b><span>存成文件，方便传给别人</span></button>'
      + '<button class="pd-card" data-act="packfmt"><b>给 AI 的格式说明</b><span>复制这段丢给任意 AI，让它按格式产出</span></button>'
      + '</div>'
      + '<p class="pd-hint">导入是「增量合并」：同 id 的包会覆盖，其他内容不动。'
      + '导入的内容只存在这台设备的浏览器里 —— 换设备或清缓存前，先用上面两个按钮存一份。</p>';
  }

  function renderPacks() {
    const d = $('#packDlg');
    if (!d) return;
    const n = window.PACKS ? window.PACKS.count : 0;
    d.innerHTML = '<div class="pd-box" role="dialog" aria-modal="true" aria-label="知识包">'
      + '<div class="pd-head"><div><span class="kk">Knowledge Pack</span><h2>知识包</h2></div>'
      + '<button class="pd-x" data-act="packclose" aria-label="关闭">' + ICON.x + '</button></div>'
      + '<div class="pd-tabs">'
      + '<button class="' + (packTab === 'import' ? 'on' : '') + '" data-pdtab="import">导入</button>'
      + '<button class="' + (packTab === 'installed' ? 'on' : '') + '" data-pdtab="installed">已装' + (n ? ' ' + n : '') + '</button>'
      + '<button class="' + (packTab === 'export' ? 'on' : '') + '" data-pdtab="export">导出</button>'
      + '</div>'
      + '<div class="pd-body">' + packBody() + '</div>'
      + '</div>';

    const ta = $('#packText');
    if (ta) {
      ta.addEventListener('input', () => {
        packDraft = ta.value;
        packChecked = null;
        const r = $('#packReport');
        if (r) r.innerHTML = '';
        packCountUpd();
      });
      packCountUpd();
    }
    const fi = $('#packFile');
    if (fi) {
      fi.addEventListener('change', () => {
        const f = fi.files && fi.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          packDraft = String(rd.result || '');
          if (ta) ta.value = packDraft;
          runPackCheck();
        };
        rd.readAsText(f, 'utf-8');
      });
    }
  }

  function openPacks(tab) {
    packTab = tab || 'import';
    renderPacks();
    const d = $('#packDlg');
    d.classList.add('on');
    d.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pack-open');
    if (packTab === 'import') setTimeout(() => { const t = $('#packText'); if (t) t.focus(); }, 80);
  }

  function closePacks() {
    const d = $('#packDlg');
    if (!d) return;
    d.classList.remove('on');
    d.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('pack-open');
  }

  /* noOk：有 id 冲突时不显示绿色「校验通过」——
     上面写「通过」下面写「已被占用」会让人以为导入成功了，实际并没有。 */
  function packReportHTML(r, extra, noOk) {
    let h = '';
    if (r.errors.length) {
      h += '<div class="pd-block bad"><b>有 ' + r.errors.length + ' 处要改，改完再校验：</b><ul>'
        + r.errors.slice(0, 24).map(e => '<li>' + esc(e) + '</li>').join('')
        + (r.errors.length > 24 ? '<li>… 还有 ' + (r.errors.length - 24) + ' 条</li>' : '')
        + '</ul></div>';
    }
    if (r.warnings.length) {
      h += '<div class="pd-block warn"><b>建议修一下（不挡导入）：</b><ul>'
        + r.warnings.slice(0, 12).map(e => '<li>' + esc(e) + '</li>').join('')
        + (r.warnings.length > 12 ? '<li>… 还有 ' + (r.warnings.length - 12) + ' 条</li>' : '')
        + '</ul></div>';
    }
    if (!noOk && !r.errors.length && r.pack) {
      h = '<div class="pd-block ok"><b>校验通过</b> · 《' + esc(r.pack.name) + '》 ' + esc(packStatLine(r.stats)) + '</div>' + h;
    }
    return h + (extra || '');
  }

  function runPackCheck() {
    const rep = $('#packReport');
    const raw = $('#packText') ? $('#packText').value : packDraft;
    if (!window.PACKS) { if (rep) rep.innerHTML = '<div class="pd-block bad"><b>导入模块没加载</b><ul><li>检查 index.html 里 packs.js 是否在 app.js 之前引入。</li></ul></div>'; return; }
    const r = window.PACKS.normalize(raw);
    packChecked = null;
    if (r.errors.length || !r.pack) { if (rep) rep.innerHTML = packReportHTML(r); return; }

    const bad = window.PACKS.conflicts(r.pack);
    if (bad.length) {
      if (rep) rep.innerHTML = packReportHTML(r,
        '<div class="pd-block bad"><b>这些 id 已经被占用了：</b><ul>'
        + bad.slice(0, 12).map(x => '<li>' + esc(x) + '</li>').join('')
        + (bad.length > 12 ? '<li>… 还有 ' + (bad.length - 12) + ' 个</li>' : '')
        + '</ul><span class="pd-fix">把它们改个名字再导入；如果是更新自己之前导入的包，请用同一个包 id。'
        + '要覆盖内置内容，得在包顶层写 <code>"overwrite": true</code>。</span></div>', true);
      return;
    }
    packChecked = r.pack;
    if (rep) {
      rep.innerHTML = packReportHTML(r,
        '<div class="pd-block go"><button class="btn primary" data-act="packinstall">确认导入 '
        + esc(packStatLine(r.stats)) + '</button>'
        + '<span class="pd-fix">导入后会自动刷新页面。</span></div>');
      rep.scrollIntoView({ block: 'nearest' });
    }
  }

  function doPackInstall() {
    if (!packChecked || !window.PACKS) return;
    const res = window.PACKS.install(packChecked);
    if (!res.ok) { toast('保存失败：浏览器存储满了或被禁用'); return; }
    /* 跳到导入内容的第一项，刷新后直接能看到 */
    let hash = '';
    const p = packChecked;
    if ((p.labs || []).length) hash = '#/labs/' + p.labs[0].id;
    else if (p.cats && p.cats.length) hash = '#/' + p.cats[0].def.id + '/' + (p.cats[0].items[0] ? p.cats[0].items[0].id : '');
    else if ((p.presets || []).length) hash = '#/presets/' + p.presets[0].id;
    else if ((p.flows || []).length) hash = '#/flows/' + p.flows[0].id;
    try {
      sessionStorage.setItem('codeatlas.pack.msg',
        '已导入《' + p.name + '》' + (res.replaced ? '（覆盖旧版本）' : '') + '：' + packStatLine({
          snippets: (p.cats || []).reduce((a, c) => a + c.items.length, 0),
          labs: (p.labs || []).length, presets: (p.presets || []).length,
          flows: (p.flows || []).length, recipes: (p.recipes || []).length,
          cmd: Object.keys(p.cmd || {}).length
        }));
    } catch (e) { /* 忽略 */ }
    if (hash) { try { history.replaceState(null, '', hash); } catch (e) { location.hash = hash; } }
    location.reload();
  }

  function packDownload() {
    if (!window.PACKS) return;
    const data = JSON.stringify(window.PACKS.exportAll(), null, 2);
    const name = 'codeatlas-all-' + new Date().toISOString().slice(0, 10) + '.json';

    /* 手机原生容器里 <a download> 不生效，交给 native.js 写文件 + 系统分享 */
    if (window.NATIVE_SAVE) {
      window.NATIVE_SAVE(name, data).then(ok => {
        if (ok) toast('已导出，可存到文件 / 分享给别人');
      }).catch(() => toast('导出失败，可改用「复制全量 JSON」'));
      return;
    }

    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('已下载 ' + Math.round(data.length / 1024) + ' KB');
  }

  /* ============================================================
     变量编辑器
     ============================================================ */
  let popCtx = null;

  function validate(def, v) {
    if (!def) return '';
    if (def.multiline) return '';
    if (def.type === 'int') {
      if (!/^\d+$/.test(String(v).trim())) return '需要填整数';
      const n = Number(v);
      if (def.min != null && n < def.min) return '不能小于 ' + def.min;
      if (def.max != null && n > def.max) return '不能大于 ' + def.max;
    }
    if (!String(v).trim()) return '不能为空';
    return '';
  }

  function openVarEditor(el) {
    const scope = el.dataset.s, name = el.dataset.v;
    const def = REG[scope + '|' + name];
    if (!def) return;
    popCtx = { scope, name, def };

    const val = gv(scope, name, def.value);
    const multiline = def.multiline || String(val).includes('\n');
    const field = multiline
      ? '<textarea class="pop-area" spellcheck="false">' + esc(val) + '</textarea>'
      : '<input class="pop-input" spellcheck="false" value="' + esc(val) + '">';

    const pop = $('#popover');
    pop.innerHTML = '<div class="pop-in">'
      + '<div class="pop-h"><span class="own-sm">自主</span><b>' + esc(def.label || name) + '</b>'
      + '<button class="x" data-act="closepop" aria-label="关闭">' + ICON.x + '</button></div>'
      + field
      + '<div class="pop-hint">' + esc(def.hint || '自由填写') + '</div>'
      + (def.desc ? '<div class="pop-desc">' + esc(def.desc) + '</div>' : '')
      + '<div class="pop-f"><button class="btn ghost" data-act="resetvar">恢复默认</button>'
      + '<span class="grow"></span><button class="btn primary" data-act="closepop">完成</button></div>'
      + '</div>';

    pop.classList.add('on');

    const field0 = pop.querySelector('.pop-input, .pop-area');

    if (window.innerWidth > 860) {
      const r = el.getBoundingClientRect();
      const w = 306;
      let left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
      pop.style.left = left + 'px';
      pop.style.top = (r.bottom + 12) + 'px';
      const ph = pop.offsetHeight;
      if (r.bottom + 12 + ph > window.innerHeight - 12) {
        pop.style.top = Math.max(12, r.top - ph - 10) + 'px';
      }
    } else {
      pop.style.left = pop.style.top = '';
    }

    field0.focus();
    if (field0.select) field0.select();

    field0.addEventListener('input', () => {
      const v = field0.value;
      const err = validate(def, v);
      field0.classList.toggle('bad', !!err);
      const hint = pop.querySelector('.pop-hint');
      if (err) { hint.textContent = err; hint.classList.add('err'); }
      else {
        hint.textContent = def.hint || '自由填写';
        hint.classList.remove('err');
        sv(scope, name, v);
        updateVarSpans(scope, name, v);
      }
    });
    field0.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !multiline) { e.preventDefault(); closePop(); }
    });
  }

  function closePop() {
    $('#popover').classList.remove('on');
    popCtx = null;
  }

  function updateVarSpans(scope, name, val) {
    document.querySelectorAll('.var').forEach(el => {
      if (el.dataset.s !== scope || el.dataset.v !== name) return;
      const vv = el.querySelector('.vv');
      if (vv) vv.innerHTML = (val === '' ? '…' : hl(val, false));
    });
    document.querySelectorAll('.own-chip').forEach(el => {
      if (el.dataset.s !== scope || el.dataset.v !== name) return;
      const v = el.querySelector('.val');
      if (v) v.textContent = val;
    });
  }

  /* ============================================================
     复制
     ============================================================ */
  function currentText() {
    const view = S.view === 'fav' ? VMAP[S.favKind] : S.view;
    if (view === 'cat') {
      const it = ITEMS[S.sel.cat];
      if (!it) return '';
      const cd = codeDef(it);
      return plain(it.id, cd.code, cd.vars);
    }
    if (view === 'labs') {
      const l = (D.labs || []).find(x => x.id === S.sel.labs);
      if (!l) return '';
      return (l.steps || []).map(st => plain('lab:' + l.id, st.code, l.vars || {}))
        .filter(Boolean).join('\n\n');
    }
    if (view === 'presets') {
      const p = D.presets.find(x => x.id === S.sel.presets);
      if (!p) return '';
      if (p.task) return taskText(p, p.task.devices[0] && p.task.devices[0].id);
      return p.steps.map((st, i) => {
        const snip = ITEMS[st.ref];
        if (!snip) return '';
        const vars = presetVars(snip, st.vars);
        return plain('p:' + p.id + ':' + i, snip.code, vars);
      }).filter(Boolean).join('\n\n');
    }
    return '';
  }

  async function copyText(txt) {
    if (!txt) { toast('当前没有可复制的内容'); return; }
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(txt);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
    }
    toast(ok ? '已复制 ' + txt.split('\n').length + ' 行配置' : '复制失败，请手动选中');
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  }

  /* ---------- 收藏 ---------- */
  function toggleFav(key) {
    if (FAV.has(key)) FAV.delete(key); else FAV.add(key);
    persistFav();
    renderRail(); renderList(); renderMain();
    toast(FAV.has(key) ? '已收藏' : '已取消收藏');
  }

  /* ============================================================
     导航
     ============================================================ */
  /* 切换专题：只显示这个专题的内容 */
  function gotoTopic(id) {
    const cats = topicCats(id);
    if (!cats.length) return;
    S.topic = id;
    S.view = 'cat';
    if (cats.indexOf(S.cat) < 0) S.cat = cats[0];
    S.q = ''; $('#q').value = '';
    document.body.classList.remove('detail');
    closeDocs(); closePop();
    renderRail(); renderList(); renderMain();
    $('#listScroll').scrollTop = 0;
    $('#mainScroll').scrollTop = 0;
  }

  function gotoView(view, cat) {
    S.view = view;
    if (cat) { S.cat = cat; S.topic = topicOfCat(cat); }
    S.q = ''; $('#q').value = '';
    document.body.classList.remove('detail');
    closeDocs(); closePop();
    renderRail(); renderList(); renderMain();
    $('#listScroll').scrollTop = 0;
    $('#mainScroll').scrollTop = 0;
  }

  function gotoSnippet(id) {
    const it = ITEMS[id];
    if (!it) return;
    S.view = 'cat'; S.cat = it.cat; S.topic = topicOfCat(it.cat); S.q = ''; $('#q').value = '';
    S.sel.cat = id;
    closeDocs(); closePop();
    renderRail(); renderList(); renderMain();
    $('#mainScroll').scrollTop = 0;
    if (window.innerWidth <= 860) document.body.classList.add('detail');
  }

  function gotoFlow(id) {
    const f = D.flows.find(x => x.id === id);
    if (!f) return;
    S.view = 'flows'; S.sel.flows = id; S.q = ''; $('#q').value = '';
    S.topic = topicOfItem(f);
    S.open = new Set([f.root]);
    closeDocs(); closePop();
    renderRail(); renderList(); renderMain();
    $('#mainScroll').scrollTop = 0;
    if (window.innerWidth <= 860) document.body.classList.add('detail');
  }

  function gotoPreset(id) {
    const p = D.presets.find(x => x.id === id);
    if (!p) return;
    S.view = 'presets'; S.sel.presets = id; S.q = ''; $('#q').value = '';
    S.topic = topicOfItem(p);
    closeDocs(); closePop();
    renderRail(); renderList(); renderMain();
    $('#mainScroll').scrollTop = 0;
    if (window.innerWidth <= 860) document.body.classList.add('detail');
  }

  function gotoLab(id) {
    const l = (D.labs || []).find(x => x.id === id);
    if (!l) return;
    S.view = 'labs'; S.sel.labs = id; S.q = ''; $('#q').value = '';
    S.topic = topicOfItem(l);
    closeDocs(); closePop();
    renderRail(); renderList(); renderMain();
    $('#mainScroll').scrollTop = 0;
    if (window.innerWidth <= 860) document.body.classList.add('detail');
  }

  /* ============================================================
     事件
     ============================================================ */
  document.addEventListener('click', e => {
    const t = e.target;

    /* 知识包：点遮罩关闭 */
    if (t.id === 'packDlg' && t.classList.contains('on')) { closePacks(); return; }

    /* 皮肤：开面板 / 选一套 / 关掉 */
    if (t.closest('[data-skin-open]')) { openSkins(); return; }
    const skCard = t.closest('[data-skin]');
    if (skCard && skCard.classList.contains('sk-card')) {
      applySkin(skCard.dataset.skin, false);
      return;
    }
    if (t.closest('[data-skin-close]')) { closeSkins(); return; }

    /* 左轨：大图标切专题，小图标切视图 */
    const nav = t.closest('[data-nav]');
    if (nav) {
      if (nav.dataset.nav === 'topic') { gotoTopic(nav.dataset.topic); return; }
      gotoView(nav.dataset.nav, nav.dataset.cat);
      return;
    }

    /* 专题内部的分类胶囊 */
    const catTab = t.closest('[data-cat-tab]');
    if (catTab) { gotoView('cat', catTab.dataset.catTab); return; }

    /* 收藏星标：必须拦在卡片之前 */
    const fv = t.closest('[data-fav]');
    if (fv) { toggleFav(fv.dataset.fav); return; }

    /* 列表卡片 */
    const card = t.closest('.card');
    if (card) {
      const kind = card.dataset.kind || 'snippet';
      const id = card.dataset.id;
      /* 命令卡片不是「内容条目」，没有可切换的主面板，
         点开就直接给命令词典弹层，别把当前片段顶掉。 */
      if (kind === 'cmd') { openDocs({ kind: 'cmd', word: id }); return; }
      if (kind === 'recipe') {
        const r = (D.recipes || []).find(x => x.id === id);
        if (r) openDocs({ kind: 'recipe', recipe: r });
        return;
      }
      if (S.view !== 'fav') {
        if (kind === 'snippet') {
          S.view = 'cat';
          if (ITEMS[id]) { S.cat = ITEMS[id].cat; S.topic = topicOfCat(S.cat); }
        } else if (kind === 'lab') {
          S.view = 'labs';
          S.topic = topicOfItem((D.labs || []).find(x => x.id === id));
        } else if (kind === 'preset') {
          S.view = 'presets';
          S.topic = topicOfItem(D.presets.find(x => x.id === id));
        } else if (kind === 'flow') {
          S.view = 'flows';
          S.topic = topicOfItem(D.flows.find(x => x.id === id));
        }
      }
      S.favKind = kind;
      S.sel[VMAP[kind]] = id;
      if (kind === 'flow') {
        const f = D.flows.find(x => x.id === id);
        if (f) S.open = new Set([f.root]);
      }
      renderRail(); renderList(); renderMain();
      $('#mainScroll').scrollTop = 0;
      if (window.innerWidth <= 860) document.body.classList.add('detail');
      return;
    }

    /* 任务步骤 / 验证勾选 */
    const tstep = t.closest('[data-task-step]');
    if (tstep) {
      const p = D.presets.find(x => x.id === S.sel.presets);
      if (p && p.task) {
        const i = Number(tstep.dataset.taskStep);
        const st = taskState(p.id);
        st.done[i] = !st.done[i];
        if (!persistTask()) toast('进度保存失败：浏览器存储不可用');
        const sc = $('#mainScroll').scrollTop;
        renderMain();
        $('#mainScroll').scrollTop = sc;
      }
      return;
    }
    const tver = t.closest('[data-task-verify]');
    if (tver) {
      const p = D.presets.find(x => x.id === S.sel.presets);
      if (p && p.task) {
        const i = Number(tver.dataset.taskVerify);
        const st = taskState(p.id);
        st.verify[i] = !st.verify[i];
        if (!persistTask()) toast('进度保存失败：浏览器存储不可用');
        const sc = $('#mainScroll').scrollTop;
        renderMain();
        $('#mainScroll').scrollTop = sc;
      }
      return;
    }

    /* 自主配置区 */
    const vr = t.closest('.var, .own-chip');
    if (vr) { openVarEditor(vr); return; }

    /* 命令关键字 */
    const kw = t.closest('.kw-click');
    if (kw) { openCmdDoc(kw.dataset.kw); return; }

    /* 代码分支 */
    const variant = t.closest('[data-variant]');
    if (variant && S.view === 'cat') {
      S.variant[S.sel.cat] = variant.dataset.variant;
      renderMain();
      return;
    }

    /* 工作流节点 */
    const tn = t.closest('.tcard');
    if (tn) {
      const f = D.flows.find(x => x.id === tn.dataset.flow);
      const n = f && f.nodes[tn.dataset.node];
      if (n) {
        if ((n.children || []).length) {
          if (S.open.has(tn.dataset.node)) S.open.delete(tn.dataset.node);
          else S.open.add(tn.dataset.node);
          renderMain();
        } else if (n.body) {
          openDocs({ kind: 'node', node: n });
        }
      }
      return;
    }

    /* 动作 */
    const pdt = t.closest('[data-pdtab]');
    if (pdt) {
      const ta = $('#packText');
      if (ta) packDraft = ta.value;
      packTab = pdt.dataset.pdtab;
      packChecked = null;
      renderPacks();
      return;
    }

    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'hudnext') {
        if (window.DESKTOP && window.DESKTOP.hud) {
          const r = window.DESKTOP.hud.grab ? window.DESKTOP.hud.grab() : window.DESKTOP.hud.show();
          Promise.resolve(r).then(() => toast('下一步已打开 · 下次在 eNSP 选中命令后按 Ctrl+Alt+Z')).catch(() => toast('悬浮窗打不开'));
        }
        return;
      }
      if (a === 'packs') { openPacks(); return; }
      if (a === 'packclose') { closePacks(); return; }
      if (a === 'packcheck') { runPackCheck(); return; }
      if (a === 'packpaste') { packPaste(); return; }
      if (a === 'packclear') { packClear(); return; }
      if (a === 'packinstall') { doPackInstall(); return; }
      if (a === 'packdlall') { packDownload(); return; }
      if (a === 'packcopyall') {
        copyText(JSON.stringify(window.PACKS.exportAll(), null, 2));
        return;
      }
      if (a === 'packfmt') { copyText(window.PACKS.template()); return; }
      if (a === 'packdel') {
        const id = act.dataset.pack;
        const p = (window.PACKS.installed() || []).find(x => x.id === id);
        if (!window.confirm('删除知识包《' + (p ? p.name : id) + '》？\n里面的内容会从应用里移除，页面随后刷新。')) return;
        window.PACKS.remove(id);
        location.reload();
        return;
      }
      if (a === 'taskcopy') {
        const p = D.presets.find(x => x.id === S.sel.presets);
        if (!p || !p.task) return;
        const scope = 'task:' + p.id;
        if (act.dataset.who) copyText(taskText(p, act.dataset.who));
        else {
          const i = Number(act.dataset.step);
          const step = p.task.steps[i];
          if (step) copyText(plain(scope, step.code, p.task.env || {}));
        }
        return;
      }
      if (a === 'labstepcopy') {
        const l = (D.labs || []).find(x => x.id === S.sel.labs);
        const i = Number(act.dataset.i);
        const st = l && l.steps && l.steps[i];
        if (st) copyText(plain('lab:' + l.id, st.code, l.vars || {}));
        return;
      }
      if (a === 'presetstepcopy') {
        const p = D.presets.find(x => x.id === S.sel.presets);
        const i = Number(act.dataset.i);
        const st = p && p.steps && p.steps[i];
        const snip = st && ITEMS[st.ref];
        if (snip) copyText(plain('p:' + p.id + ':' + i, snip.code, presetVars(snip, st.vars)));
        return;
      }
      if (a === 'taskreset') {
        const p = D.presets.find(x => x.id === S.sel.presets);
        if (!p || !p.task) return;
        if (!window.confirm('清空《' + p.title + '》的勾选进度？\n参数值会保留，只重置步骤和验证状态。')) return;
        TASK[p.id] = { done: {}, verify: {} };
        persistTask();
        const sc = $('#mainScroll').scrollTop;
        renderMain();
        $('#mainScroll').scrollTop = sc;
        toast('任务进度已重置');
        return;
      }
      if (a === 'copy') { copyText(currentText()); return; }
      if (a === 'docs') { openCurrentDocs(); return; }
      if (a === 'back') { document.body.classList.remove('detail'); return; }
      if (a === 'topozoom') {
        const fig = act.closest('.topo-wrap') || act;
        const on = fig.classList.toggle('zoomed');
        const hint = fig.querySelector('.topo-hint');
        if (hint) hint.textContent = on ? '点拓扑恢复全貌' : '点拓扑可放大';
        const sc = fig.querySelector('.topo-scroll');
        if (sc && !on) sc.scrollLeft = 0;
        return;
      }
      if (a === 'closedocs') { closeDocs(); return; }
      if (a === 'closepop') { closePop(); return; }
      if (a === 'resetvar' && popCtx) {
        const { scope, name, def } = popCtx;
        delete VAL[scope + '|' + name]; persist();
        const f0 = $('#popover .pop-input, #popover .pop-area');
        if (f0) f0.value = def.value;
        updateVarSpans(scope, name, def.value);
        const hint = $('#popover .pop-hint');
        if (hint) { hint.textContent = def.hint || '自由填写'; hint.classList.remove('err'); }
        if (f0) f0.classList.remove('bad');
        return;
      }
    }

    /* 跳转 */
    const gs = t.closest('[data-goto-snippet]');
    if (gs) { gotoSnippet(gs.dataset.gotoSnippet); return; }
    const gf = t.closest('[data-goto-flow]');
    if (gf) { gotoFlow(gf.dataset.gotoFlow); return; }
    const gp = t.closest('[data-goto-preset]');
    if (gp) { gotoPreset(gp.dataset.gotoPreset); return; }

    /* 点空白收起浮层 */
    if (!t.closest('#popover')) closePop();
    if (t.classList.contains('scrim')) closeDocs();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('#skinDlg') && $('#skinDlg').classList.contains('on')) { closeSkins(); return; }
      if (document.body.classList.contains('pack-open')) { closePacks(); return; }
      if (document.body.classList.contains('docs-open')) { closeDocs(); return; }
      if ($('#popover').classList.contains('on')) { closePop(); return; }
      if (S.q) {
        S.q = ''; $('#q').value = '';
        renderList();
        return;
      }
      document.body.classList.remove('detail');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (window.innerWidth <= 860) document.body.classList.remove('detail');
      $('#q').focus();
      $('#q').select();
    }
  });

  $('#q').addEventListener('input', e => {
    S.q = e.target.value.trim();
    renderList();
  });

  /* 回车直接打开第一条结果 */
  $('#q').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const first = document.querySelector('#listScroll .card');
    if (first) { e.preventDefault(); first.click(); }
  });

  /* ============================================================
     启动 + 深链（#/ensp/vlan-create）
     ============================================================ */
  function syncHash() {
    const seg = S.view === 'cat' ? S.cat : S.view;
    const key = S.view === 'fav' ? VMAP[S.favKind] : S.view;
    const id = S.sel[key] || '';
    const h = '#/' + seg + (id ? '/' + id : '');
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { /* file:// 下个别浏览器会拦，忽略即可 */ }
  }

  function applyHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return;
    const p = raw.split('/');
    const a = p[0], b = p[1];
    if (D.categories.some(c => c.id === a)) {
      S.view = 'cat'; S.cat = a; S.topic = topicOfCat(a);
      if (b && ITEMS[b]) S.sel.cat = b;
    } else if (a === 'labs' && (D.labs || []).some(x => x.id === b)) {
      S.view = 'labs'; S.sel.labs = b;
      S.topic = topicOfItem(D.labs.find(x => x.id === b));
    } else if (a === 'labs') {
      S.view = 'labs';
    } else if (a === 'presets' && D.presets.some(x => x.id === b)) {
      S.view = 'presets'; S.sel.presets = b;
      S.topic = topicOfItem(D.presets.find(x => x.id === b));
    } else if (a === 'flows' && D.flows.some(x => x.id === b)) {
      S.view = 'flows'; S.sel.flows = b;
      S.topic = topicOfItem(D.flows.find(x => x.id === b));
      S.open = new Set([D.flows.find(x => x.id === b).root]);
    } else if (a === 'fav') {
      S.view = 'fav';
      if (b) {
        if (ITEMS[b]) { S.favKind = 'snippet'; S.sel.cat = b; }
        else if (D.presets.some(x => x.id === b)) { S.favKind = 'preset'; S.sel.presets = b; }
        else if (D.flows.some(x => x.id === b)) { S.favKind = 'flow'; S.sel.flows = b; }
      }
    }
    if (b) {
      if (window.innerWidth <= 860) document.body.classList.add('detail');
      if (p[2] === 'docs') setTimeout(openCurrentDocs, 30);
    }
  }

  applySkin(SK ? SK.detect() : 'midnight', false, false);
  const kbd = $('#kbd');
  if (kbd && !/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) kbd.textContent = 'Ctrl K';
  applyHash();
  renderRail();
  renderList();
  renderMain();

  /* 导入完刷新回来，把结果告诉用户 */
  try {
    const pm = sessionStorage.getItem('codeatlas.pack.msg');
    if (pm) { sessionStorage.removeItem('codeatlas.pack.msg'); setTimeout(() => toast(pm), 400); }
  } catch (e) { /* 忽略 */ }

  window.CodeAtlas = {
    S, D, gotoView, gotoTopic, gotoSnippet, gotoFlow, gotoPreset, gotoLab,
    currentText,
    toggleFav, applySkin, openSkins, closeSkins, searchGroups, favGroups,
    taskState, taskText, applyUserdata,
    openPacks, closePacks, runPackCheck, doPackInstall,
    closeDocs, closePop,
    get FAV() { return FAV; },
    get favorites() { return [...FAV]; },
    get values() { return Object.assign({}, VAL); },
    get taskProgress() { return JSON.parse(JSON.stringify(TASK)); },
    get PACKS() { return window.PACKS; }
  };

  console.log('%c码典 CodeAtlas ' + D.meta.version,
    'background:#FFB454;color:#141414;padding:2px 6px;border-radius:3px;font-weight:700',
    '\n' + D.categories.reduce((a, c) => a + c.items.length, 0) + ' 个片段 · '
    + D.presets.length + ' 套预设 · ' + D.flows.length + ' 条工作流');
})();
