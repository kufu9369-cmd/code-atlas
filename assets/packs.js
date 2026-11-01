/* ============================================================
   码典 · 知识包（packs.js）
   ------------------------------------------------------------
   作用：把「内容」从「应用」里拆出来。
   - 内置内容在 data.js，随时可以不动；
   - 外部内容以「知识包」的 JSON 形式导入，存在 localStorage，
     每次启动自动合并进 D，看起来和内置内容一模一样。

   加载顺序必须是：data.js → packs.js → app.js
   （packs.js 在 app.js 之前把包合进 window.CODEATLAS）
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'codeatlas.packs.v1';
  var D = window.CODEATLAS;
  if (!D) { console.error('[packs] 缺少 CODEATLAS 数据，检查 script 顺序'); return; }

  /* ---------- 存储 ---------- */
  function read() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }

  /* ---------- 工具 ---------- */
  function slug(s) {
    return String(s || '').trim().toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  var CAT_ICONS = ['switch', 'term', 'db', 'code', 'layers', 'branch', 'git'];

  function collectIds(d) {
    var out = {};
    (d.categories || []).forEach(function (c) {
      out['cat:' + c.id] = 1;
      (c.items || []).forEach(function (i) { out['snip:' + i.id] = 1; });
    });
    (d.labs || []).forEach(function (l) { out['lab:' + l.id] = 1; });
    (d.presets || []).forEach(function (p) { out['preset:' + p.id] = 1; });
    (d.flows || []).forEach(function (f) { out['flow:' + f.id] = 1; });
    (d.recipes || []).forEach(function (r) { out['recipe:' + r.id] = 1; });
    return out;
  }

  /* 启动时先记一份「内置内容」的 id 快照，用于导入时判断冲突 */
  var BASE_IDS = collectIds(D);

  /* ============================================================
     解析：把用户粘贴的文本变成一个规范化的 pack 对象
     ============================================================ */
  /* V8 的 JSON 报错是英文的，翻成能直接照着改的话 */
  function zhJsonErr(m, src) {
    var s = String(m || '');
    var pos = (s.match(/position (\d+)/) || [])[1];
    /* 看错误位置前一个非空白字符，用来区分「多余逗号」和「该用双引号」 */
    var near = '';
    if (pos && src) {
      var k = Math.min(+pos, String(src).length) - 1;
      while (k >= 0 && /\s/.test(src[k])) k--;
      near = src[k] || '';
    }
    var t;
    if (src && /[\u201c\u201d\u2018\u2019]/.test(src)) t = '用了中文引号，换成英文的 " ';
    else if (/Unterminated string/.test(s)) t = '有字符串的引号没闭合';
    else if (/Unexpected end of|after property value/.test(s)) t = 'JSON 没写完（括号或引号没闭合）';
    else if (/Expected (double-quoted )?property name/.test(s)) {
      t = near === ',' ? '有多余的逗号：最后一项后面不能留逗号' : '属性名要用双引号（AI 常写成单引号或不加引号）';
    }
    else if (/Unexpected non-whitespace/.test(s)) t = '对象后面还有别的内容，只保留一个 JSON 对象';
    else if (/Unexpected token/.test(s)) t = near === ',' ? '有多余的逗号' : '这里有多余或不认识的字符';
    else t = '格式不对';
    return t + (pos ? '（第 ' + pos + ' 个字符附近）' : '') + '｜' + s.replace(/\s*\(line \d+ column \d+\)/, '');
  }

  function textToJson(text) {
    var s = String(text || '').trim();
    if (!s) return { ok: false, error: '内容是空的' };

    /* 允许直接粘 Markdown 代码块 */
    var fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();

    try { return { ok: true, data: JSON.parse(s) }; } catch (e1) {
      /* 允许前后带解释文字：截取最外层 { ... } 再试一次 */
      var i = s.indexOf('{'), j = s.lastIndexOf('}');
      if (i >= 0 && j > i) {
        try { return { ok: true, data: JSON.parse(s.slice(i, j + 1)) }; } catch (e2) {
          return { ok: false, error: zhJsonErr(e2.message, s.slice(i, j + 1)) };
        }
      }
      return { ok: false, error: zhJsonErr(e1.message, s) };
    }
  }

  /* 校验并规范化。返回 { pack, errors[], warnings[], stats } */
  function normalize(text) {
    var res = { pack: null, errors: [], warnings: [], stats: null };
    var got = textToJson(text);
    if (!got.ok) { res.errors.push('不是合法 JSON：' + got.error); return res; }

    var raw = got.data;
    /* 兼容 {pack:{...}, data:{...}} 这种套一层写法 */
    if (raw && raw.pack && raw.data && typeof raw.data === 'object') {
      raw = Object.assign({ id: raw.pack.id, name: raw.pack.name, version: raw.pack.version }, raw.data);
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      res.errors.push('顶层必须是一个对象 { ... }'); return res;
    }

    var pack = {
      id: slug(raw.id || raw.name || ''),
      name: String(raw.name || raw.title || '').trim(),
      version: String(raw.version || '1'),
      desc: String(raw.desc || raw.description || '').trim(),
      cats: [], labs: [], presets: [], flows: [], recipes: [],
      cmd: (raw.cmd && typeof raw.cmd === 'object') ? raw.cmd : {},
      cmdSrc: (raw.cmdSrc && typeof raw.cmdSrc === 'object') ? raw.cmdSrc : {},
      keywords: Array.isArray(raw.keywords) ? raw.keywords.slice() : [],
      userdata: (raw.userdata && typeof raw.userdata === 'object') ? raw.userdata : null,
      /* 只有明确声明 true 才允许按 id 覆盖内置内容 */
      overwrite: raw.overwrite === true
    };
    if (!pack.id) res.errors.push('缺少 id（英文短名，如 "ospf-adv"）');
    if (!pack.name) res.errors.push('缺少 name（中文名，如 "OSPF 进阶"）');

    /* ---- 片段：支持 categories[] 或 category + snippets[] 两种写法 ---- */
    if (Array.isArray(raw.categories) && raw.categories.length) {
      raw.categories.forEach(function (c, ci) {
        if (!c || typeof c !== 'object') { res.errors.push('categories[' + ci + '] 不是对象'); return; }
        var cid = slug(c.id || c.name || ('cat-' + ci));
        if (!cid) res.errors.push('categories[' + ci + '] 缺少 id');
        var def = {
          id: cid,
          name: String(c.name || c.title || cid),
          icon: CAT_ICONS.indexOf(c.icon) >= 0 ? c.icon : 'code',
          short: String(c.short || c.name || cid).slice(0, 6),
          ext: String(c.ext || 'txt')
        };
        pack.cats.push({ def: def, items: (c.items || c.snippets || []).map(normSnippet) });
      });
    } else if (Array.isArray(raw.snippets) && raw.snippets.length) {
      var cd = raw.category;
      var def2 = (cd && typeof cd === 'object')
        ? {
            id: slug(cd.id || cd.name || pack.id),
            name: String(cd.name || pack.name),
            icon: CAT_ICONS.indexOf(cd.icon) >= 0 ? cd.icon : 'code',
            short: String(cd.short || cd.name || pack.name).slice(0, 6),
            ext: String(cd.ext || 'txt')
          }
        : { id: pack.id, name: pack.name, icon: 'code', short: pack.name.slice(0, 6), ext: 'txt' };
      pack.cats.push({ def: def2, items: raw.snippets.map(normSnippet) });
    }

    pack.labs = (raw.labs || []).map(normLab);
    pack.presets = (raw.presets || []).map(normPreset);
    pack.flows = (raw.flows || []).map(normFlow);
    pack.recipes = (raw.recipes || []).map(normRecipe);

    /* ---- 逐项校验 ---- */
    var snipIds = {};
    (D.categories || []).forEach(function (c) { (c.items || []).forEach(function (i) { snipIds[i.id] = 1; }); });
    pack.cats.forEach(function (c) { c.items.forEach(function (i) { if (i && i.id) snipIds[i.id] = 1; }); });

    var seen = {};
    function uniq(kind, id, path) {
      if (!id) return;
      var k = kind + ':' + id;
      if (seen[k]) { res.errors.push(path + ' 的 id "' + id + '" 在本包内重复'); return; }
      seen[k] = 1;
    }

    pack.cats.forEach(function (c, ci) {
      uniq('cat', c.def.id, 'categories[' + ci + ']');
      c.items.forEach(function (it, ii) { checkSnippet(it, 'categories[' + ci + '].items[' + ii + ']', res); uniq('snip', it.id, 'categories[' + ci + '].items[' + ii + ']'); });
    });
    pack.labs.forEach(function (l, i) { checkLab(l, 'labs[' + i + ']', res); uniq('lab', l.id, 'labs[' + i + ']'); });
    pack.presets.forEach(function (p, i) { checkPreset(p, 'presets[' + i + ']', res, snipIds); uniq('preset', p.id, 'presets[' + i + ']'); });
    pack.flows.forEach(function (f, i) { checkFlow(f, 'flows[' + i + ']', res); uniq('flow', f.id, 'flows[' + i + ']'); });
    pack.recipes.forEach(function (r, i) { checkRecipe(r, 'recipes[' + i + ']', res); uniq('recipe', r.id, 'recipes[' + i + ']'); });

    var n = pack.cats.reduce(function (a, c) { return a + c.items.length; }, 0)
      + pack.labs.length + pack.presets.length + pack.flows.length + pack.recipes.length + Object.keys(pack.cmd).length;
    if (!n) res.errors.push('包里没有任何内容（snippets / labs / presets / flows / cmd 至少要有一项）');

    res.stats = {
      categories: pack.cats.length,
      snippets: pack.cats.reduce(function (a, c) { return a + c.items.length; }, 0),
      labs: pack.labs.length, presets: pack.presets.length,
      flows: pack.flows.length, recipes: pack.recipes.length, cmd: Object.keys(pack.cmd).length
    };
    res.pack = pack;
    return res;
  }

  function normSnippet(s) {
    s = s || {};
    var code = String(s.code || '');
    var out = {
      id: slug(s.id || s.title || ''),
      title: String(s.title || s.name || '').trim(),
      desc: String(s.desc || s.summary || '').trim(),
      tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
      code: code,
      vars: (s.vars && typeof s.vars === 'object') ? s.vars : {},
      variants: Array.isArray(s.variants) ? s.variants : undefined,
      docs: (s.docs && typeof s.docs === 'object') ? s.docs : undefined,
      flow: s.flow
    };
    if (s.device) out.device = String(s.device);
    /* level 决定列表里「入门 / 进阶 / 综合」分组，丢了条目会掉到「综合」。
       topic 一般由分类推断，但允许包里显式指定。 */
    if (['入门', '进阶', '综合'].indexOf(s.level) >= 0) out.level = s.level;
    if (s.topic) out.topic = String(s.topic);
    return out;
  }

  function normStep(st) {
    st = st || {};
    return {
      title: String(st.title || '').trim(), note: st.note ? String(st.note) : '',
      ref: st.ref, code: String(st.code || ''),
      scene: st.scene ? String(st.scene) : undefined
    };
  }

  /* 可执行任务：环境参数 + 设备 + 带设备归属的步骤 + 验证。
     导出/导入必须保留完整字段，不然任务导回去会退化成普通预设。 */
  function normTask(t) {
    t = t || {};
    var env = {};
    Object.keys(t.env || {}).forEach(function (k) {
      var d = t.env[k];
      if (d && typeof d === 'object') env[k] = Object.assign({}, d);
    });
    return {
      env: env,
      devices: (t.devices || []).map(function (d) {
        return { id: String(d.id || ''), role: String(d.role || ''), note: String(d.note || '') };
      }).filter(function (d) { return d.id; }),
      planHead: Array.isArray(t.planHead) ? t.planHead.map(String).slice(0, 4) : undefined,
      plan: (t.plan || []).map(function (r) {
        return { dev: String(r.dev || ''), intf: String(r.intf || ''), ip: String(r.ip || ''), note: String(r.note || '') };
      }),
      steps: (t.steps || []).map(function (s) {
        return {
          who: String(s.who || ''), title: String(s.title || '').trim(),
          note: s.note ? String(s.note) : '', code: String(s.code || '')
        };
      }),
      verify: (t.verify || []).map(function (v) {
        return { who: String(v.who || ''), cmd: String(v.cmd || ''), hope: String(v.hope || '') };
      })
    };
  }

  function normLab(l) {
    l = l || {};
    var t = l.topo || {};
    var out = {
      id: slug(l.id || l.title || ''),
      title: String(l.title || '').trim(),
      level: ['入门', '进阶', '综合'].indexOf(l.level) >= 0 ? l.level : '进阶',
      minutes: Number(l.minutes) > 0 ? Number(l.minutes) : 20,
      goal: String(l.goal || l.desc || '').trim(),
      scene: String(l.scene || '').trim(),
      topo: (t.nodes && t.nodes.length) ? {
        h: Number(t.h) > 80 ? Number(t.h) : 260,
        nodes: t.nodes.map(function (n) {
          return { id: String(n.id || ''), label: String(n.label || n.id || ''), sub: n.sub ? String(n.sub) : '',
                   t: ['switch', 'router', 'pc', 'server'].indexOf(n.t) >= 0 ? n.t : 'switch',
                   x: Number(n.x), y: Number(n.y) };
        }),
        links: (t.links || []).map(function (k) { return Array.isArray(k) ? k.slice(0, 3) : k; })
      } : undefined,
      planHead: Array.isArray(l.planHead) ? l.planHead.map(String).slice(0, 4) : undefined,
      plan: Array.isArray(l.plan) ? l.plan.map(function (r) {
        return { dev: String(r.dev || ''), intf: String(r.intf || ''), ip: String(r.ip || ''), note: String(r.note || '') };
      }) : [],
      vars: (l.vars && typeof l.vars === 'object') ? l.vars : {},
      steps: (l.steps || []).map(normStep),
      verify: Array.isArray(l.verify) ? l.verify.map(function (v) {
        return { cmd: String(v.cmd || ''), hope: String(v.hope || '') };
      }) : [],
      pitfalls: Array.isArray(l.pitfalls) ? l.pitfalls.map(String) : [],
      docs: (l.docs && typeof l.docs === 'object') ? l.docs : undefined
    };
    if (l.topic) out.topic = String(l.topic);
    if (l.cat) out.cat = String(l.cat);
    if (l.fileExt) out.fileExt = String(l.fileExt);
    if (l.stepsTitle) out.stepsTitle = String(l.stepsTitle);
    if (l.planTitle) out.planTitle = String(l.planTitle);
    return out;
  }

  function normPreset(p) {
    p = p || {};
    var out = {
      id: slug(p.id || p.title || ''),
      title: String(p.title || '').trim(),
      summary: String(p.summary || p.desc || '').trim(),
      features: Array.isArray(p.features) ? p.features.map(String) : [],
      scene: p.scene ? String(p.scene) : '',
      steps: p.task ? [] : (p.steps || []).map(function (s) {
        /* ref 指向片段 id，而片段 id 已经过一遍 slug（小写、下划线转横线），
           ref 不跟着规范化就会「指向一个不存在的片段」。 */
        return {
          ref: slug(s.ref || ''), label: s.label ? String(s.label) : '',
          note: s.note ? String(s.note) : '', vars: s.vars || {},
          scene: s.scene ? String(s.scene) : undefined
        };
      }),
      docs: (p.docs && typeof p.docs === 'object') ? p.docs : undefined
    };
    if (p.task) out.task = normTask(p.task);
    if (p.topic) out.topic = String(p.topic);
    return out;
  }

  function normRecipe(r) {
    r = r || {};
    return {
      id: slug(r.id || r.title || ''),
      title: String(r.title || '').trim(),
      scene: String(r.scene || '').trim(),
      level: ['入门', '进阶', '高级', '综合'].indexOf(r.level) >= 0 ? r.level : '进阶',
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      steps: (r.steps || []).map(function (s) {
        return { c: String(s.c || ''), note: s.note ? String(s.note) : '', who: s.who ? String(s.who) : '' };
      }),
      verify: Array.isArray(r.verify) ? r.verify.map(function (v) {
        return { cmd: String(v.cmd || ''), hope: String(v.hope || '') };
      }) : [],
      pitfalls: Array.isArray(r.pitfalls) ? r.pitfalls.map(String) : [],
      scope: r.scope ? String(r.scope) : undefined
    };
  }

  function normFlow(f) {
    f = f || {};
    var nodes = {}, src = f.nodes || {};
    Object.keys(src).forEach(function (k) {
      var n = src[k] || {};
      nodes[k] = {
        kind: ['q', 'o', 'end', 'warn'].indexOf(n.kind) >= 0 ? n.kind : 'o',
        label: String(n.label || '').trim(),
        note: n.note ? String(n.note) : '',
        body: n.body ? String(n.body) : '',
        snippet: n.snippet, children: Array.isArray(n.children) ? n.children : []
      };
    });
    var out = { id: slug(f.id || f.title || ''), title: String(f.title || '').trim(), summary: String(f.summary || '').trim(), root: String(f.root || ''), nodes: nodes };
    if (f.topic) out.topic = String(f.topic);
    return out;
  }

  /* ---------- 单条校验 ---------- */

  /* 报错里截一段实际值：只写「第 0 条的某个字段不对」，用户还得自己去数第 0 条是谁 */
  function brief(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ');
    n = n || 48;
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ---------- docs.src.u 的容错 ----------
     从 AI 那边复制来的链接，脏数据基本就这几种，都修掉而不是拦住：
       前导 / 尾随空格、全角冒号（https：//）、反斜杠、大写协议（HTTPS://）
     漏写协议的能唯一推断出 https:// 吗？分三种：
       //host/x   → 补 https:
       host/x     → 补 https://
       http://... → **不补**，故意保留原样：有的站只有 http，瞎升级会变死链，只提醒
     最后只剩「完全不像链接」才算错误。 */
  function fixUrl(u) {
    var s = String(u == null ? '' : u).trim();
    if (!s) return '';
    s = s.replace(/：/g, ':').replace(/／/g, '/').replace(/\\/g, '/');
    s = s.replace(/^(https?)\s*:\s*\/*/i, function (_, p) { return p.toLowerCase() + '://'; });
    if (/^\/\//.test(s)) return 'https:' + s;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(s)) return 'https://' + s;
    return s;
  }

  function checkDocsUrl(it, at, res) {
    var src = it.docs && it.docs.src;
    if (src == null) return;
    /* docs 写成 { src: "https://..." } 也很常见，先掰成规范结构再判断 */
    if (typeof src !== 'object') { it.docs.src = { u: String(src) }; src = it.docs.src; }
    var raw = src.u;
    if (raw == null) return;
    var s = String(raw).trim();
    if (!s) { delete src.u; return; }             // 写了但是空的：当没写，不拦
    var fixed = fixUrl(s);
    if (fixed !== String(raw)) {
      src.u = fixed;
      res.warnings.push(at + ' 的 docs.src.u 已自动修正：「' + brief(raw) + '」→「' + brief(fixed) + '」');
    }
    if (/^https:\/\//i.test(fixed)) return;
    if (/^http:\/\//i.test(fixed)) {
      res.warnings.push(at + ' 的 docs.src.u 是 http 不是 https（「' + brief(fixed) + '」），点开会有安全提示，建议换 https');
      return;
    }
    res.errors.push(at + ' 的 docs.src.u 不是可用链接（现在是「' + brief(fixed) + '」），'
      + '要写成 https:// 开头的完整地址');
  }

  function checkSnippet(it, path, res) {
    /* 带上标题：path 只有 categories[0].items[0]，用户没法知道那是哪一条 */
    var at = path + (it.title ? '（' + brief(it.title, 18) + '）' : '');
    if (!it.id) res.errors.push(path + ' 缺少 id');
    if (!it.title) res.errors.push(path + ' 缺少 title');
    if (!it.code) res.errors.push(at + ' 缺少 code');
    if (!it.desc) res.warnings.push(at + ' 没有 desc（列表里会显得空）');
    var refs = String(it.code).match(/\{\{[A-Za-z0-9_]+\}\}/g) || [];
    refs.forEach(function (r) {
      var n = r.slice(2, -2);
      if (!(n in it.vars)) res.errors.push(at + ' 代码用了 {{' + n + '}} 但 vars 里没定义');
    });
    Object.keys(it.vars).forEach(function (k) {
      if (!it.vars[k] || typeof it.vars[k] !== 'object') it.vars[k] = {};
      var v = it.vars[k];
      if (v.value === undefined || v.value === null || v.value === '') res.warnings.push(at + ' 变量 ' + k + ' 没有默认值');
      if (!v.desc) res.warnings.push(at + ' 变量 ' + k + ' 没有 desc');
      if (!v.label) it.vars[k].label = k;
    });
    checkDocsUrl(it, at, res);
  }

  function checkLab(l, path, res) {
    var at = path + (l.title ? '（' + brief(l.title, 18) + '）' : '');
    if (!l.id) res.errors.push(path + ' 缺少 id');
    if (!l.title) res.errors.push(path + ' 缺少 title');
    if (!l.goal) res.warnings.push(at + ' 没有 goal（列表副标题会空）');
    if (!l.steps.length) res.errors.push(path + ' 没有任何步骤');
    l.steps.forEach(function (s, i) {
      if (!s.title) res.warnings.push(path + '.steps[' + i + '] 没有 title');
      if (!s.code) res.errors.push(path + '.steps[' + i + '] 没有 code');
      (String(s.code).match(/\{\{[A-Za-z0-9_]+\}\}/g) || []).forEach(function (r) {
        var n = r.slice(2, -2);
        if (!(n in l.vars)) res.errors.push(path + '.steps[' + i + '] 用了 {{' + n + '}} 但 vars 里没定义');
      });
    });
    if (!l.verify.length) res.warnings.push(path + ' 没有 verify（做完没法确认对错）');
    if (!l.pitfalls.length) res.warnings.push(path + ' 没有 pitfalls（缺常见错误）');

    if (l.topo) {
      var ids = {};
      l.topo.nodes.forEach(function (n, i) {
        if (!n.id) res.errors.push(path + '.topo.nodes[' + i + '] 缺少 id');
        ids[n.id] = 1;
        if (!isFinite(n.x) || n.x < 10 || n.x > 750) res.errors.push(path + '.topo.nodes[' + i + '] x 必须在 10–750 之间');
        if (!isFinite(n.y) || n.y < 10 || n.y > l.topo.h - 10) res.errors.push(path + '.topo.nodes[' + i + '] y 必须在 10–' + (l.topo.h - 10) + ' 之间');
        if (!n.label) res.warnings.push(path + '.topo.nodes[' + i + '] 没有 label');
      });
      l.topo.links.forEach(function (k, i) {
        if (!Array.isArray(k) || !ids[k[0]] || !ids[k[1]]) res.errors.push(path + '.topo.links[' + i + '] 指向了不存在的节点');
      });
    }
    checkDocsUrl(l, at, res);
  }

  function checkPreset(p, path, res, snipIds) {
    var at = path + (p.title ? '（' + brief(p.title, 18) + '）' : '');
    if (!p.id) res.errors.push(path + ' 缺少 id');
    if (!p.title) res.errors.push(path + ' 缺少 title');
    if (p.task) {
      var t = p.task, devIds = {};
      (t.devices || []).forEach(function (d, i) {
        if (!d.id) res.errors.push(at + '.task.devices[' + i + '] 缺少 id');
        else devIds[d.id] = 1;
      });
      if (!t.steps.length) res.errors.push(at + '.task 没有任何步骤');
      t.steps.forEach(function (s, i) {
        if (!s.code) res.errors.push(at + '.task.steps[' + i + '] 缺少 code');
        if (!s.who) res.errors.push(at + '.task.steps[' + i + '] 缺少 who（在哪台设备执行）');
        else if (!devIds[s.who]) res.errors.push(at + '.task.steps[' + i + '] 的设备 "' + s.who + '" 未在 devices 里声明');
        (String(s.code).match(/\{\{[A-Za-z0-9_]+\}\}/g) || []).forEach(function (r) {
          var n = r.slice(2, -2);
          if (!(n in t.env)) res.errors.push(at + '.task.steps[' + i + '] 用了 {{' + n + '}} 但 task.env 里没定义');
        });
      });
      t.verify.forEach(function (v, i) {
        if (!v.cmd) res.errors.push(at + '.task.verify[' + i + '] 缺少 cmd');
        if (!v.hope) res.errors.push(at + '.task.verify[' + i + '] 缺少 hope');
      });
    } else {
      if (!p.steps.length) res.errors.push(at + ' 没有任何步骤');
      p.steps.forEach(function (s, i) {
        if (!s.ref) res.errors.push(at + '.steps[' + i + '] 缺少 ref（指向哪个片段）');
        else if (!snipIds[s.ref]) res.errors.push(at + '.steps[' + i + '] 的 ref "' + s.ref + '" 找不到对应片段');
      });
    }
    checkDocsUrl(p, at, res);
  }

  function checkFlow(f, path, res) {
    if (!f.id) res.errors.push(path + ' 缺少 id');
    if (!f.title) res.errors.push(path + ' 缺少 title');
    var ks = Object.keys(f.nodes);
    if (!ks.length) { res.errors.push(path + ' 没有任何节点'); return; }
    if (!f.nodes[f.root]) res.errors.push(path + ' 的 root "' + f.root + '" 不存在');
    var ends = 0;
    ks.forEach(function (k) {
      var n = f.nodes[k];
      if (n.kind === 'end') ends++;
      if (!n.label) res.warnings.push(path + '.nodes.' + k + ' 没有 label');
      n.children.forEach(function (c) {
        if (!f.nodes[c]) res.errors.push(path + '.nodes.' + k + ' 的子节点 "' + c + '" 不存在');
      });
    });
    if (!ends) res.errors.push(path + ' 至少要有一个 kind:"end" 的结论节点');
  }

  function checkRecipe(r, path, res) {
    var at = path + (r.title ? '（' + brief(r.title, 18) + '）' : '');
    if (!r.id) res.errors.push(path + ' 缺少 id');
    if (!r.title) res.errors.push(path + ' 缺少 title');
    if (!r.steps.length) res.errors.push(at + ' 没有任何步骤');
    r.steps.forEach(function (s, i) {
      if (!s.c) res.errors.push(at + '.steps[' + i + '] 缺少命令 c');
    });
    if (!r.verify.length) res.warnings.push(at + ' 没有 verify（配完没法确认）');
  }

  /* ============================================================
     合并：把包塞进 D
     ============================================================ */
  function addItems(D, def, items, packId, overwrite, st) {
    var cat = null;
    for (var i = 0; i < D.categories.length; i++) {
      if (D.categories[i].id === def.id) { cat = D.categories[i]; break; }
    }
    if (!cat) {
      cat = { id: def.id, name: def.name, icon: def.icon, short: def.short, ext: def.ext, items: [], pack: packId };
      D.categories.push(cat);
    }
    items.forEach(function (it) {
      /* 同 id 的条目分两种情况：
         - 普通包：直接跳过（绝不重复显示，也不许悄悄改掉内置内容）
         - 声明了 overwrite 的包（自己导出的备份）：就地替换，否则「导出改完再导回」等于没改 */
      for (var k = 0; k < cat.items.length; k++) {
        if (cat.items[k].id === it.id) {
          if (!overwrite) return;
          it.cat = cat.id; it.catName = cat.name; it.pack = packId;
          cat.items[k] = it;
          st.snippets++;
          return;
        }
      }
      it.cat = cat.id; it.catName = cat.name; it.pack = packId;
      cat.items.push(it);
    });
  }

  /* 包里的实验/预设/工作流没写 topic 时，按包的第一个分类推断它属于哪个专题。
     不做这一步，导入的 JavaWeb 实验会一律落到「网络工程」专题下 ——
     用户在自己专题里怎么翻都找不到，看起来像「导入失败」。 */
  function packTopic(pack) {
    var T = window.TOPICS;
    var first = (pack.cats || [])[0];
    if (first && T && T.ofCat) {
      var t = T.ofCat(first.def.id);
      if (t) return t;
    }
    return null;
  }
  function tagTopic(list, tid) {
    if (!tid) return;
    list.forEach(function (x) { if (x && !x.topic) x.topic = tid; });
  }

  function apply(D, pack) {
    var st = { categories: 0, snippets: 0, labs: 0, presets: 0, flows: 0, recipes: 0, cmd: 0 };
    if (!pack) return st;
    var overwrite = !!pack.overwrite;
    var tid = packTopic(pack);

    (pack.cats || []).forEach(function (c) {
      var existed = D.categories.some(function (x) { return x.id === c.def.id; });
      addItems(D, c.def, c.items || [], pack.id, overwrite, st);
      if (!existed) st.categories++;
    });

    /* 实验 / 预设 / 工作流同样按 id 去重：
       包里的内容和内置内容、别的包里的内容都可能重名，
       普通包重名时以先存在的为准；overwrite 包就地替换。 */
    function addOnce(arr, item, kind, st) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].id === item.id) {
          if (!overwrite) return;
          arr[i] = item;
          st[kind]++;
          return;
        }
      }
      arr.push(item);
      st[kind]++;
    }

    D.labs = D.labs || [];
    D.presets = D.presets || [];
    D.flows = D.flows || [];
    D.recipes = D.recipes || [];
    tagTopic(pack.labs || [], tid);
    tagTopic(pack.presets || [], tid);
    tagTopic(pack.flows || [], tid);
    (pack.labs || []).forEach(function (l) { addOnce(D.labs, l, 'labs', st); });
    (pack.presets || []).forEach(function (p) { addOnce(D.presets, p, 'presets', st); });
    (pack.flows || []).forEach(function (f) { addOnce(D.flows, f, 'flows', st); });
    (pack.recipes || []).forEach(function (r) { addOnce(D.recipes, r, 'recipes', st); });

    Object.keys(pack.cmd || {}).forEach(function (w) {
      if (!D.cmd[w]) { D.cmd[w] = pack.cmd[w]; st.cmd++; }
    });
    /* cmdSrc 是命令词条到官方文档来源的映射，丢了会把 git/mysql 命令
       指回华为文档。导出备份要能原样恢复。 */
    D.cmdSrc = D.cmdSrc || {};
    Object.keys(pack.cmdSrc || {}).forEach(function (k) {
      var cur = D.cmdSrc[k] || [];
      D.cmdSrc[k] = cur.concat(pack.cmdSrc[k] || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
    });
    (pack.keywords || []).forEach(function (k) {
      if (D.keywords.indexOf(k) < 0) D.keywords.push(k);
    });
    /* 全量备份里的本机数据要在 app.js 启动前就写回 localStorage。
       导入流程会 location.reload()，如果只在 CodeAtlas 存在时恢复，
       刷新后的启动早期还没这个对象，收藏和变量就丢了。 */
    if (pack.userdata && typeof pack.userdata === 'object') {
      try {
        if (pack.userdata.values && typeof pack.userdata.values === 'object') {
          localStorage.setItem('codeatlas.vals.v1', JSON.stringify(pack.userdata.values));
        }
        if (Array.isArray(pack.userdata.favorites)) {
          localStorage.setItem('codeatlas.fav.v1', JSON.stringify(pack.userdata.favorites));
        }
        if (pack.userdata.task && typeof pack.userdata.task === 'object') {
          localStorage.setItem('codeatlas.task.v1', JSON.stringify(pack.userdata.task));
        }
      } catch (e) { /* 存储不可用时保留其余内容导入 */ }
    }
    if (pack.userdata && window.CodeAtlas && window.CodeAtlas.applyUserdata) {
      window.CodeAtlas.applyUserdata(pack.userdata);
    }
    return st;
  }

  /* ============================================================
     对外 API
     ============================================================ */
  function installed() {
    return read().map(function (p) {
      return { id: p.id, name: p.name, version: p.version, importedAt: p.importedAt, stats: p.stats };
    });
  }

  function conflicts(pack) {
    /* 声明了 overwrite 的包（自己导出的全量备份）是来「覆盖」的，
       id 相同属于预期，不算冲突 —— 否则 README 说的「导出改完再导回」
       一个 id 都过不去。普通包仍然严格查重，防止误改内置内容。 */
    if (pack.overwrite) return [];
    var base = Object.assign({}, BASE_IDS);
    read().forEach(function (p) {
      if (p.id === pack.id) return;              // 同 id 视为「更新」，不算冲突
      var ids = collectIds(p.data || {});
      Object.keys(ids).forEach(function (k) { base[k] = 1; });
    });
    var bad = [];
    (pack.cats || []).forEach(function (c) {
      /* 分类 id 撞车不算错：说明这个包是往现有分类里「续内容」的，
         合并时会直接追加进去，侧栏不会多出一条重复分类。
         真正不能重的是里面的片段 id。 */
      c.items.forEach(function (i) { if (base['snip:' + i.id]) bad.push('片段 ' + i.id); });
    });
    (pack.labs || []).forEach(function (l) { if (base['lab:' + l.id]) bad.push('实验 ' + l.id); });
    (pack.presets || []).forEach(function (p) { if (base['preset:' + p.id]) bad.push('预设 ' + p.id); });
    (pack.flows || []).forEach(function (f) { if (base['flow:' + f.id]) bad.push('工作流 ' + f.id); });
    (pack.recipes || []).forEach(function (r) { if (base['recipe:' + r.id]) bad.push('剧本 ' + r.id); });
    return bad;
  }

  /* 安装（同 id 覆盖），返回 { ok, replaced } */
  function install(pack) {
    var list = read();
    var replaced = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === pack.id) { list[i] = null; replaced = true; }
    }
    list = list.filter(Boolean);
    var rec = {
      id: pack.id, name: pack.name, version: pack.version, desc: pack.desc,
      importedAt: new Date().toISOString(),
      stats: {
        snippets: (pack.cats || []).reduce(function (a, c) { return a + c.items.length; }, 0),
        labs: (pack.labs || []).length, presets: (pack.presets || []).length,
        flows: (pack.flows || []).length, recipes: (pack.recipes || []).length,
        cmd: Object.keys(pack.cmd || {}).length
      },
      data: pack
    };
    list.push(rec);
    var ok = write(list);
    return { ok: ok, replaced: replaced };
  }

  function remove(id) {
    write(read().filter(function (p) { return p.id !== id; }));
  }

  /* 全量导出：把当前 D 和用户自己的积累一起打包。
     之前只导出部分字段，导致「全量备份」导回去后收藏、变量值、
     剧本和任务字段都丢了。这里统一深拷贝，不做手工字段白名单。 */
  function exportAll() {
    function clone(x) { return JSON.parse(JSON.stringify(x == null ? null : x)); }
    var C = window.CodeAtlas || {};
    var userdata = {
      values: C.values || {},
      favorites: C.favorites || [],
      task: C.taskProgress || {}
    };
    var pack = {
      id: 'export-all', name: D.meta.name + ' 全量导出', version: '1',
      desc: '由码典导出的完整内容：知识、任务、剧本和本机进度，可原样导入到另一台设备。',
      /* 自己导出的包带 overwrite：导回来时按 id 就地替换，
         不这么做的话「导出 → 改 → 导回」会被大量重名 id 全挡掉。 */
      overwrite: true,
      categories: clone(D.categories || []).map(function (c) {
        return {
          id: c.id, name: c.name, icon: c.icon || 'code', short: c.short || c.name,
          ext: c.ext || 'txt', items: c.items || []
        };
      }),
      labs: clone(D.labs || []), presets: clone(D.presets || []),
      flows: clone(D.flows || []), recipes: clone(D.recipes || []),
      cmd: clone(D.cmd || {}), cmdSrc: clone(D.cmdSrc || {}),
      keywords: clone(D.keywords || []), userdata: userdata
    };
    return pack;
  }

  /* 给任意 AI 的格式说明（纯文本，复制就能用） */
  function template() {
    var L = [];
    L.push('你是「码典 CodeAtlas」的内容作者。请把下面这个主题写成**一个知识包 JSON**：');
    L.push('主题：{{在这里写你要补的内容，例如 OSPF 进阶实验：多区域 + 路由汇总 + 虚连接}}');
    L.push('');
    L.push('【硬性要求】');
    L.push('1. 只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释文字。');
    L.push('2. 所有 id 用小写英文/数字/短横线，全局唯一；不要和下面示例里的 id 重复。');
    L.push('3. 代码里的可配置部分用 {{变量名}} 占位，且每个变量必须在 vars 里有同名条目。');
    L.push('4. 中文内容，语气像同事间讲清楚，不要客套话。');
    L.push('');
    L.push('【结构】');
    L.push('{');
    L.push('  "id": "包唯一短名，如 ospf-adv",');
    L.push('  "name": "包的中文名",');
    L.push('  "version": "1.0",');
    L.push('  "desc": "一句话说明这个包补了什么",');
    L.push('  "categories": [{');
    L.push('    "id": "分类id", "name": "分类名", "icon": "switch|term|db|code|layers|branch|git", "short": "侧栏短名(≤6字)", "ext": "cfg",');
    L.push('    "items": [{ "id","title","desc","tags":[],"code","vars":{...},"docs":{...} }]');
    L.push('  }],');
    L.push('  "labs": [{ "id","title","level":"入门|进阶|综合","minutes":25,"goal","scene",');
    L.push('            "topo":{"h":260,"nodes":[{"id","label","sub","t":"switch|router|pc","x":120,"y":130}],"links":[["SW1","SW2","Trunk V10/20"]]},');
    L.push('            "plan":[{"dev","intf","ip","note"}],');
    L.push('            "vars":{"变量名":{"label","value","hint","desc"}},');
    L.push('            "steps":[{"title","note","code"}],');
    L.push('            "verify":[{"cmd","hope"}],');
    L.push('            "pitfalls":["一句话一个坑"],');
    L.push('            "docs":{"secs":[{"h","p"}],"src":{"n":"文档名","u":"https://..."}} }],');
    L.push('  "presets": [{ "id","title","summary","features":[],"steps":[{"ref":"片段id","vars":{}}] }],');
    L.push('  "flows": [{ "id","title","summary","root":"n1","nodes":{"n1":{"kind":"q|o|end|warn","label","note","children":["n2"]}} }],');
    L.push('  "cmd": { "命令词": {"p":"官方口径解释","eg":"示例"} },');
    L.push('  "keywords": ["要高亮的命令词"]');
    L.push('}');
    L.push('');
    L.push('【质量要求】');
    L.push('- 片段（items）：code 是能直接粘进设备/终端执行的完整配置，不要用省略号；desc 说清解决什么问题；');
    L.push('- 变量（vars）：value 给一个能直接跑通的默认值，desc 说清为什么这么填、填错会怎样；');
    L.push('- 实验（labs）：拓扑坐标 x 在 10–750、y 在 10–250 之间，节点之间留出间距；steps 按设备/顺序拆，每步 5–20 行；');
    L.push('- 验证（verify）：cmd 写具体命令，hope 写"看到什么输出算成功"；');
    L.push('- 坑（pitfalls）：写"照抄会翻车"的具体现象，不要写"注意配置正确"这种废话；');
    L.push('- 如果引用了官方文档，u 必须是能打开的 https 链接，不要放搜索结果页。');
    L.push('');
    L.push('【输出示例（照这个颗粒度写）】');
    L.push('{"id":"grep-pack","name":"grep 速查","version":"1.0","desc":"grep 常用组合","categories":[{"id":"shell-adv","name":"Shell 进阶","icon":"term","short":"Shell","ext":"sh","items":[{"id":"grep-recursive","title":"递归搜索并高亮","desc":"在目录树里找关键字，跳过二进制和 .git","tags":["搜索","日志"],"code":"grep -rn --color=auto {{pattern}} {{dir}} \\\\\\n  --exclude-dir={{exclude}}","vars":{"pattern":{"label":"关键字","value":"timeout","hint":"支持正则","desc":"要搜的内容，含空格时用引号包起来。"},"dir":{"label":"搜索目录","value":".","hint":"相对或绝对路径","desc":"从哪个目录开始找。"},"exclude":{"label":"排除目录","value":".git","hint":"目录名","desc":"版本库目录通常不用搜。"}},"docs":{"secs":[{"h":"-r 与 -n","p":"-r 递归、-n 显示行号，两个一起用才知道命中在哪一行。"}],"src":{"n":"GNU grep 手册","u":"https://www.gnu.org/software/grep/manual/grep.html"}}}]}],"labs":[],"presets":[],"flows":[],"cmd":{},"keywords":[]}');
    L.push('');
    L.push('现在开始，直接输出 JSON。');
    return L.join('\n');
  }

  /* ---------- 启动：把已装的包合进 D ---------- */
  var booted = read();
  booted.forEach(function (p) { if (p && p.data) apply(D, p.data); });
  if (booted.length) {
    console.log('[packs] 已加载 ' + booted.length + ' 个知识包：' + booted.map(function (p) { return p.name; }).join('、'));
  }

  window.PACKS = {
    KEY: KEY,
    baseIds: function () { return Object.assign({}, BASE_IDS); },
    normalize: normalize,
    apply: apply,
    conflicts: conflicts,
    install: install,
    remove: remove,
    installed: installed,
    exportAll: exportAll,
    template: template,
    get count() { return read().length; }
  };
})();
