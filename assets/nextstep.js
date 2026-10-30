/* ============================================================
   码典 · 「下一步」匹配引擎
   ------------------------------------------------------------
   解决的问题：在 eNSP 里配到一半卡住了 —— 下一句该敲什么？

   输入：一段文本（从 eNSP 控制台复制出来的回显，或者手敲的命令）
   输出：最匹配的配置剧本 + 当前走到第几步 + 下一步 + 整段代码

   为什么单独成一个文件：
   和 search.js 一样，逻辑要能在命令行里验证（node _dev/check-nextstep.js）。
   塞回 app.js 就只能靠点界面试，改一个正则要开三次窗口。

   三段处理：
   1. parse()  —— 剥掉提示符、认出当前在哪个视图、丢掉回显输出
   2. cmdSim() —— 比两条命令像不像（支持 VRP 的缩写：int / g0/0/1 / sys）
   3. match()  —— 在剧本库里找「包含你已敲序列的最长区间」，取它后面的步骤
   ============================================================ */
(function () {
  'use strict';

  var D = window.CODEATLAS;
  if (!D) { console.error('[next] 缺少 CODEATLAS 数据，检查 script 顺序'); return; }

  /* ---------- 视图 ---------- */

  var VIEW_LABEL = {
    user: '用户视图',
    system: '系统视图',
    interface: '接口视图',
    ospf: 'OSPF 视图',
    'ospf-area': 'OSPF 区域视图',
    isis: 'IS-IS 视图',
    bgp: 'BGP 视图',
    'bgp-af': 'BGP 地址族视图',
    aaa: 'AAA 视图',
    acl: 'ACL 视图',
    vlan: 'VLAN 视图',
    mpls: 'MPLS 视图',
    'vpn-instance': 'VPN 实例视图',
    aclv: 'ACL 视图',
    other: '子视图'
  };

  var IFACE_RE = /^(GigabitEthernet|XGigabitEthernet|Ethernet|FastEthernet|Eth-Trunk|LoopBack|Vlanif|Serial|Tunnel|NULL|MEth|Vlan)\d/i;

  /* 从提示符里认出视图。
     <Huawei>                         -> user
     [Huawei]                         -> system
     [Huawei-GigabitEthernet0/0/1]    -> interface
     [Huawei-ospf-1]                  -> ospf
     [Huawei-ospf-1-area-0.0.0.0]     -> ospf-area
     [Huawei-bgp-65001]               -> bgp
     [Huawei-acl-adv-3000]            -> acl
     [Huawei-vlan10]                  -> vlan */
  function viewOfPrompt(p) {
    if (!p) return '';
    if (p.charAt(0) === '<') return 'user';
    if (p.charAt(0) !== '[') return '';

    var inner = p.slice(1, -1);
    var dash = inner.indexOf('-');
    if (dash < 0) return 'system';

    var tail = inner.slice(dash + 1);
    if (/^ospf-\d+-area-/i.test(tail)) return 'ospf-area';
    if (/^ospf/i.test(tail)) return 'ospf';
    if (/^isis/i.test(tail)) return 'isis';
    if (/^bgp-.*-(ipv4|ipv6)-/i.test(tail)) return 'bgp-af';
    if (/^bgp/i.test(tail)) return 'bgp';
    if (/^aaa/i.test(tail)) return 'aaa';
    if (/^acl/i.test(tail)) return 'acl';
    /* [SW1-vlan10] 是 VLAN 视图；Vlanif10 是接口，别被 vlan 前缀抢走 */
    if (/^vlan\d+$/i.test(tail)) return 'vlan';
    if (/^mpls/i.test(tail)) return 'mpls';
    if (/^vpn-instance/i.test(tail)) return 'vpn-instance';
    if (IFACE_RE.test(tail)) return 'interface';
    return 'other';
  }

  /* 从提示符里抠出「上下文」：接口名 / 进程号 / VLAN 号。
     用户看到「接口 GigabitEthernet0/0/2」会比只说「接口视图」更有底。 */
  function ctxOfPrompt(p) {
    if (!p || p.charAt(0) !== '[') return '';
    var inner = p.slice(1, -1);
    var dash = inner.indexOf('-');
    if (dash < 0) return '';
    return inner.slice(dash + 1);
  }

  /* ---------- 解析 ---------- */

  /* 命令首词白名单：用来把 `display current-configuration` 的回显输出
     （那些行以接口名、IP、空格缩进开头）和真正的命令区分开。
     不建这个表的话，粘一大段配置进来自动匹配会全是噪音。 */
  var BASE_VERBS = ('system-view sysname quit return undo interface vlan port stp rstp msti '
    + 'ip ipv6 ospf ospfv3 rip ripng isis bgp acl traffic nat dhcp nat-pool aaa local-user '
    + 'user-interface telnet ssh http server stelnet ftp snmp ntp clock display save reset '
    + 'shutdown description mtu qos mirror observe lldp lacp eth-trunk vrrp vrrp6 bfd nqa '
    + 'mpls ldp vpn-instance bgp-evpn route-policy ip-prefix filter-policy import-route '
    + 'apply if-match community as-path peer group reflector reflect-client network '
    + 'silent-interface timer authentication area import authentication-mode '
    + 'link-type trunk access hybrid dot1q gvrp bpdu mac-address port-security '
    + 'port-isolate dhcp-snooping igmp pim multicast routing-table static default-route '
    + 'preference cost priority interval track admin ppp pap chap pppoe frame-relay '
    + 'wlan ap security dot11 ssid vap wids ac capwap gre tunnel ipsec ike proposal policy '
    + 'ikev2 template firewall zone service-set sec-policy session nat-server '
    + 'egress inbound acl-based traffic-filter user-bind attack-defense cpu-defend '
    + 'snmp-agent syslog info-center header login banner header '
    + 'ip-subnet ip-address ip-route ip-routing vlanif bridge bridge-group '
    + 'stack port-group monitor-port source-port sudo su enable disable').split(/\s+/);

  var VOCAB = null;
  var VOCAB_LIST = null;

  function recipes() {
    var r = D.recipes;
    return Array.isArray(r) ? r : [];
  }

  /* 词汇表只在第一次用时建一次：剧本步骤首词 + 命令词典 key 首词 + 基础动词表 */
  function buildVocab() {
    if (VOCAB) return VOCAB;
    VOCAB = Object.create(null);
    VOCAB_LIST = [];
    function add(w) {
      w = String(w || '').toLowerCase();
      if (!w || w.length < 2) return;
      if (VOCAB[w]) return;
      VOCAB[w] = 1;
      VOCAB_LIST.push(w);
    }
    BASE_VERBS.forEach(add);
    recipes().forEach(function (r) {
      (r.steps || []).forEach(function (s) { add(String(s.c || '').split(/\s+/)[0]); });
    });
    Object.keys(D.cmd || {}).forEach(function (k) { add(String(k).split(/\s+/)[0]); });
    return VOCAB;
  }

  /* 首词是不是条命令：命中白名单，或者它是白名单里某个词的前缀（≥2 字符）。
     VRP 允许唯一前缀缩写，`sys` / `int` / `dis` 都是真命令。 */
  function isVerb(w) {
    buildVocab();
    w = String(w || '').toLowerCase();
    if (!w || w.length < 2) return false;
    if (VOCAB[w]) return true;
    for (var i = 0; i < VOCAB_LIST.length; i++) {
      if (VOCAB_LIST[i].indexOf(w) === 0) return true;
    }
    return false;
  }

  var PROMPT_RE = /^\s*(?:<([^<>\s]{1,40})>|\[([^\[\]\s]{1,80})\])\s*(.*)$/;

  /* 一行 -> {cmd, view, ctx}；不像命令就返回 null */
  function parseLine(raw) {
    var line = String(raw == null ? '' : raw).replace(/\r/g, '');
    if (!line.trim()) return null;

    var view = '', ctx = '', cmd = line;

    var m = line.match(PROMPT_RE);
    if (m) {
      var prompt = m[1] ? '<' + m[1] + '>' : '[' + m[2] + ']';
      view = viewOfPrompt(prompt);
      ctx = ctxOfPrompt(prompt);
      cmd = m[3] || '';
      /* 提示符后面什么都没有：用户只是回车了一下，跳过 */
      if (!cmd.trim()) return { cmd: '', view: view, ctx: ctx, bare: true };
    }

    cmd = cmd.trim();

    /* 回显噪音：Info/Warning/Error、分隔线、纯符号、注释 */
    if (/^(#|----|\*\*\*|\.\.\.)/.test(cmd)) return null;
    if (/^(Info|Warning|Error|Note|Tips?)\s*[:：]/i.test(cmd)) return null;
    if (/^[-=\s]+$/.test(cmd)) return null;
    /* 带 ! 或 ^ 的是报错回显（eNSP 用 ^ 指位置） */
    if (/^\s*\^/.test(cmd)) return null;

    /* 去掉行尾的 <CR> 之类 */
    cmd = cmd.replace(/[\u0000-\u001f]+$/g, '').trim();
    if (!cmd) return null;

    var first = cmd.split(/\s+/)[0].toLowerCase();

    /* `undo xxx` 是有效命令 */
    var probe = first === 'undo' ? cmd.split(/\s+/)[1] : first;
    if (!isVerb(probe)) {
      /* 首词不认，但如果这一行本身是纯参数（IP、数字），也丢掉 */
      return null;
    }

    return { cmd: cmd.replace(/\s+/g, ' '), view: view, ctx: ctx };
  }

  /* 整段文本 -> { cmds, view, ctx, dropped } */
  function parse(text) {
    var lines = String(text || '').split('\n');
    var cmds = [], view = '', ctx = '', dropped = 0;
    for (var i = 0; i < lines.length; i++) {
      var r = parseLine(lines[i]);
      if (!r) { if (lines[i].trim()) dropped++; continue; }
      if (r.view) { view = r.view; ctx = r.ctx; }
      if (r.bare) continue;
      cmds.push(r.cmd);
    }
    /* 只留最近 24 条：剧本最长也就二十来步，再多说明粘的是整份配置，
       前面的老命令对「下一步」没有帮助，反而会把匹配带偏。 */
    if (cmds.length > 24) cmds = cmds.slice(-24);
    return { cmds: cmds, view: view, ctx: ctx, dropped: dropped, label: VIEW_LABEL[view] || '' };
  }

  /* ---------- 命令相似度 ---------- */

  function words(s) {
    return String(s || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  /* 单个词的相似度。
     VRP 的缩写规则以「唯一前缀」为准，所以前缀匹配给高分。 */
  function wordSim(a, b) {
    a = String(a || '').toLowerCase();
    b = String(b || '').toLowerCase();
    if (!a || !b) return 0;
    if (a === b) return 1;

    var numA = /[0-9\/.:]/.test(a);
    var numB = /[0-9\/.:]/.test(b);

    /* 两边都是纯字母：只有前缀缩写算命中（int -> interface / sys -> system-view） */
    if (!numA && !numB) {
      if (a.length >= 2 && b.indexOf(a) === 0) return 0.88;
      if (b.length >= 2 && a.indexOf(b) === 0) return 0.88;
      return 0;
    }

    /* 至少一边带数字：比「字母部分 + 数字部分」
       g0/0/1 vs GigabitEthernet0/0/1 -> 0.85
       192.168.1.1 vs 192.168.1.254   -> 0.5（同形状不同值，不当错） */
    var ta = a.match(/([0-9\/.:]+)$/);
    var tb = b.match(/([0-9\/.:]+)$/);
    if (ta && tb && ta[1] === tb[1]) {
      var pa = a.slice(0, a.length - ta[1].length);
      var pb = b.slice(0, b.length - tb[1].length);
      if (!pa && !pb) return 1;
      if (!pa || !pb) return 0.8;
      if (pa === pb) return 0.95;
      if (pb.indexOf(pa) === 0) return 0.85;
      if (pa.indexOf(pb) === 0) return 0.85;
      return 0.45;
    }
    return 0.5;
  }

  /* 纯导航命令：本身不含任何场景信息，`quit` 出现在几十个剧本里。
     让它们参与相似度计算会被误判成「命中了这个剧本」，所以直接排除。
     代价是输入里夹着 quit 时匹配不上 —— 无害，跳过继续往后找就是了。 */
  var NAV_ONLY = /^(quit|return|exit)$/i;

  /* 两条命令像不像。只比前三个词 —— VRP 命令的区分度全在开头，
     后面的参数（网段、接口号、VLAN 列表）几乎总是因环境而异。 */
  function cmdSim(x, y) {
    var a = words(x), b = words(y);
    if (!a.length || !b.length) return 0;
    if (NAV_ONLY.test(a[0]) || NAV_ONLY.test(b[0])) return 0;

    /* interface 是例外：它算一条命令，但「进哪个接口」的区分度很大。
       不单独处理的话，配 VLAN 时敲 interface G0/0/1 会把所有含接口
       配置的剧本统统命中，下一步就指到别的场景去了。 */
    if (a[0] === 'interface' && b[0] === 'interface') {
      if (a[1] === undefined || b[1] === undefined) return 0.8;
      return wordSim(a[1], b[1]) >= 0.85 ? 1 : 0;
    }

    var s0 = wordSim(a[0], b[0]);
    if (s0 < 0.6) return 0;                       /* 首词不同 = 两条命令 */

    var s1 = (a[1] !== undefined && b[1] !== undefined) ? wordSim(a[1], b[1]) : 1;
    var s2 = (a[2] !== undefined && b[2] !== undefined) ? wordSim(a[2], b[2]) : 1;

    return (s0 * 2.2 + s1 * 1.5 + s2 * 0.8) / 4.5;
  }

  /* ---------- 把一个剧本切成「可直接粘的代码块」 ----------
     steps 里每步带 who（哪台设备），按 who 分组就是完整的配置脚本。
     不单独存一份 template 的原因：两处内容一定会走岔，
     改了一处忘了另一处，用户复制到的是过时的那份。 */
  function parts(recipe) {
    if (!recipe) return [];
    var out = [], map = Object.create(null);
    (recipe.steps || []).forEach(function (s) {
      var who = s.who || '通用';
      if (!map[who]) { map[who] = { who: who, code: [] }; out.push(map[who]); }
      map[who].code.push(s.c);
    });
    return out.map(function (p) { return { who: p.who, code: p.code.join('\n') }; });
  }

  /* ---------- 匹配 ---------- */

  var TH = 0.72;     /* 一条命令算「命中」的门槛 */
  var SKIP_PENALTY = 7;  /* 每跳过一个前置步骤扣多少分 */

  /* 单条文本在一个剧本里的最佳位置。
     从任意起点出发做顺序匹配 —— 因为用户粘进来的可能只是中间几行，
     不一定从剧本第一步开始。 */
  function scoreIn(recipe, cmds) {
    var steps = recipe.steps || [];
    if (!steps.length || !cmds.length) return null;

    var best = null;
    for (var start = 0; start < steps.length; start++) {
      var si = start, matched = 0, quality = 0, last = start - 1, hit = [];
      for (var i = 0; i < cmds.length; i++) {
        for (var j = si; j < steps.length; j++) {
          var s = cmdSim(cmds[i], steps[j].c);
          if (s >= TH) {
            matched++; quality += s; last = j; si = j + 1; hit.push(j);
            break;
          }
        }
      }
      if (!matched) continue;

      /* 按「匹配得多准」计分，不是「命中几条」。
         只用条数的话，一条勉强够到 0.72 的模糊匹配和一条精确命中同分，
         就会出现「用户明明在配 VLAN，却被指到别的剧本」这种错。 */
      var score = quality * 100 - start * SKIP_PENALTY;
      /* 命中率也要看：粘了 12 行只认出 1 行，说明只是碰巧撞上一条命令 */
      score += Math.round((matched / cmds.length) * 30);

      if (!best || score > best.score
        || (score === best.score && start < best.start)) {
        best = { score: score, matched: matched, last: last, start: start, hit: hit };
      }
    }
    return best;
  }

  /* 兜底：没匹配上剧本时，用命令词典解释「你刚敲的这条」 */
  function cmdHelp(cmd) {
    if (!cmd) return null;
    var w = words(cmd);
    var keys = Object.keys(D.cmd || {});
    var best = null, bestS = 0;
    for (var i = 0; i < keys.length; i++) {
      var s = cmdSim(cmd, keys[i]);
      if (s > bestS) { bestS = s; best = keys[i]; }
    }
    if (!best || bestS < TH) return null;
    var e = D.cmd[best] || {};
    return { key: best, p: e.p || '', eg: e.eg || '', sim: bestS };
  }

  /* 找和这些命令相关的片段（点了能跳过去看完整解释） */
  function related(cmds, limit) {
    limit = limit || 4;
    var out = [], seen = Object.create(null);
    (D.categories || []).forEach(function (c) {
      (c.items || []).forEach(function (it) {
        var code = String(it.code || '');
        var score = 0;
        cmds.forEach(function (cmd) {
          var ws = words(cmd);
          if (!ws.length) return;
          /* 命令出现在片段里就给分，首词越长越可能是真的同一条 */
          var re = new RegExp('(^|\\n)\\s*' + ws[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            + (ws[1] ? '\\s+' + ws[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''), 'i');
          if (re.test(code)) score += ws[1] ? 3 : 1;
        });
        if (score > 0 && !seen[it.id]) {
          seen[it.id] = 1;
          out.push({ id: it.id, title: it.title, cat: c.id, catName: c.name, score: score });
        }
      });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit);
  }

  /* 去掉 quit / return 之类的导航命令。
     「下一步」面板是给人照着敲的，冒一句「下一步 quit」纯属浪费眼神。
     整段模板（parts）里当然还要有，不然代码块就断了。 */
  function stripNav(arr) {
    return arr.filter(function (s) { return !NAV_ONLY.test(words(s.c)[0] || ''); });
  }

  /* 主入口。
     onlyId 给定时只在这个剧本里找 —— 面板上「不是这个场景？」切换候选、
     以及直接翻阅某个剧本时用。 */
  function match(text, onlyId) {
    var p = parse(text);
    var res = {
      ok: false, view: p.view, viewLabel: p.label, ctx: p.ctx,
      cmds: p.cmds, dropped: p.dropped,
      recipe: null, idx: -1, total: 0, next: [], rest: [],
      parts: [], alt: [], cmdHelp: null, related: []
    };

    if (!p.cmds.length) {
      res.reason = text && String(text).trim() ? 'unparsed' : 'empty';
      return res;
    }

    var list = [];
    recipes().forEach(function (r) {
      if (onlyId && r.id !== onlyId) return;
      var s = scoreIn(r, p.cmds);
      if (s) list.push({ r: r, s: s });
    });
    list.sort(function (a, b) {
      if (b.s.score !== a.s.score) return b.s.score - a.s.score;
      return a.s.start - b.s.start;
    });

    if (!list.length) {
      res.reason = 'nomatch';
      res.cmdHelp = cmdHelp(p.cmds[p.cmds.length - 1]);
      res.related = related(p.cmds);
      return res;
    }

    var top = list[0];
    var steps = top.r.steps || [];

    res.ok = true;
    res.recipe = {
      id: top.r.id, title: top.r.title, scene: top.r.scene || '',
      level: top.r.level || '', tags: top.r.tags || [], scope: top.r.scope || ''
    };
    res.idx = top.s.last;
    res.total = steps.length;
    res.matched = top.s.matched;
    res.hit = top.s.hit;

    /* 输入的最后一条是 quit：nav 命令不参与匹配，idx 会停在 quit 的前一步。
       用户已经退出了接口视图，再提示「下一步 quit」就是废话 —— 往后挪一格。 */
    var lastIn = p.cmds[p.cmds.length - 1];
    if (lastIn && NAV_ONLY.test(words(lastIn)[0] || '')) {
      while (res.idx + 1 < steps.length && NAV_ONLY.test(words(steps[res.idx + 1].c)[0] || '')) {
        res.idx++;
      }
    }
    var ahead = stripNav(steps.slice(res.idx + 1));
    res.next = ahead.slice(0, 3).map(function (s, k) {
      return { c: s.c, note: s.note || '', who: s.who || '', lead: k === 0 };
    });
    res.rest = ahead.map(function (s) {
      return { c: s.c, note: s.note || '', who: s.who || '' };
    });
    res.parts = parts(top.r);
    res.pitfalls = top.r.pitfalls || [];
    res.verify = top.r.verify || [];
    res.done = ahead.length === 0;

    res.alt = list.slice(1, 4).map(function (x) {
      return {
        id: x.r.id, title: x.r.title, idx: x.s.last,
        total: (x.r.steps || []).length, score: x.s.score
      };
    });

    if (!res.done && !res.next.length) res.done = true;
    return res;
  }

  /* 直接打开一个剧本看全貌（点「全部剧本」里的某条，或从候选切过来）。
     idx = -1 表示「还没开始」，下一步就是第一条。 */
  function openRecipe(id) {
    var r = null;
    recipes().forEach(function (x) { if (x.id === id) r = x; });
    if (!r) return null;
    var steps = r.steps || [];
    var nav = stripNav(steps);
    return {
      ok: true, whole: true, view: '', viewLabel: '', ctx: '', cmds: [], dropped: 0,
      recipe: {
        id: r.id, title: r.title, scene: r.scene || '', level: r.level || '',
        tags: r.tags || [], scope: r.scope || ''
      },
      idx: -1, total: steps.length, matched: 0, hit: [],
      next: nav.slice(0, 3).map(function (s, k) {
        return { c: s.c, note: s.note || '', who: s.who || '', lead: k === 0 };
      }),
      rest: nav.map(function (s) { return { c: s.c, note: s.note || '', who: s.who || '' }; }),
      parts: parts(r), pitfalls: r.pitfalls || [], verify: r.verify || [],
      done: false, alt: []
    };
  }

  /* ---------- 暴露 ---------- */
  window.NEXT = {
    parse: parse,
    match: match,
    openRecipe: openRecipe,
    parts: parts,
    cmdSim: cmdSim,
    wordSim: wordSim,
    viewOfPrompt: viewOfPrompt,
    recipes: recipes,
    list: function () {
      return recipes().map(function (r) {
        return {
          id: r.id, title: r.title, scene: r.scene || '', level: r.level || '',
          steps: (r.steps || []).length, tags: r.tags || []
        };
      });
    }
  };
})();
