/* ============================================================
   码典 · 练习场（VRP 命令行模拟器）
   ------------------------------------------------------------
   为什么要这个面板：
   码典原来是「查」的工具 —— 忘了命令长什么样，搜一下。但网工真正卡住的地方
   不是查不到，是「看懂了但自己敲不出来」。所以这里补一层「练」：
   一个不会连任何设备的 VRP 终端，敲错了当场告诉你错在第几个字符、
   为什么错（跟真机一样报 Wrong parameter，下面再补一句人话）；
   敲对了，配置就真的记在这台「模拟设备」里，display current-configuration
   能看到你自己配出来的东西。

   解析内核是 assets/vrp/core.js（朋友做的 HCIP 训练场里那个，原样搬来）。
   这一层只做四件事：
   1. 终端：提示符跟着视图走、回显着色、Ctrl+L / ↑↓ 历史、Tab 补全、? 帮助
   2. 配置记忆：敲过的配置按视图路径存下来，能拼成 current-configuration
      和 display this；undo 会真的删掉那条（不是当没发生）
   3. 命令库：官方 4569 条命令（assets/vrp/dict.js，懒加载）搜得到、
      看得懂参数、能一键填进终端
   4. 演练队列：把一套剧本/预设的命令排成队列，一条条跟着敲，
      敲对一条勾一条 —— 这就把「下一步」从提示变成了练习

   一条底线：模拟器只模拟「格式和配置」，协议表项（OSPF 邻居、BGP 路由）
   一律不编。回显里编出来的假邻居比没有更害人，所以遇到这类 display
   就直说「这条要看真机」，不糊弄。
   ============================================================ */
(function () {
  'use strict';

  const VRP = window.VRP;
  const D = window.CODEATLAS;
  if (!VRP || !D) { console.warn('[practice] 缺少 VRP 内核或数据，跳过'); return; }

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = VRP.esc;

  /* ============================================================
     状态
     ============================================================ */
  const LS_SIM = 'codeatlas.sim.v1';

  const BIND_DEF = {
    ifName: 'GigabitEthernet0/0/0', trunkId: '1', vlanId: '10', ospfPid: '1',
    areaId: '0.0.0.0', isisPid: '1', aclNum: '3000', poolName: '1', rpName: 'RP1',
    ospfv3Pid: '1', ripPid: '1', pbrName: 'PBR1', clsName: 'c1', behName: 'b1',
    polName: 'p1', slGroup: '1', rrppId: '1', radiusName: 'rd1', vrfName: 'VPN1',
    pool6Name: 'p6'
  };

  /* 进子视图时，提示符里的绑定变量从哪个参数类型取
     （route-policy 那条最后一个是 node 10，直接取最后一个参数会把名字取错） */
  const BIND_SRC = {
    ifName: ['ifname'], trunkId: ['num'], vlanId: ['vlanid'], ospfPid: ['num'],
    areaId: ['areaid'], isisPid: ['num'], aclNum: ['aclnum'], poolName: ['name'],
    rpName: ['name'], ospfv3Pid: ['num'], ripPid: ['num'], pbrName: ['name'],
    clsName: ['name'], behName: ['name'], polName: ['name'], slGroup: ['num'],
    rrppId: ['num'], radiusName: ['name'], vrfName: ['name'], pool6Name: ['name']
  };

  const ST = {
    view: 'user',
    stack: [{ id: 'user', header: '' }],
    sysname: 'Huawei',
    bind: Object.assign({}, BIND_DEF),
    cfg: [],                 // [{ path:['interface GigabitEthernet0/0/0'], line:'ip address …' }]
    saved: null,             // 保存过的配置快照（null = 还没 save 过）
    hist: [], hi: -1,
    cands: [], ci: 0,
    queue: null,             // { title, steps:[{c,note,done}] }
    qi: 0,
    libLoaded: false,
    libQ: '',
    libOnlySim: false,
    libSel: -1,
    demo: null               // 自动演示用的定时器
  };

  const viewMeta = id => VRP.VIEWMETA[id] || VRP.VIEWMETA.user;

  /* 「已记入配置」那句提示打过几次了 */
  let recHint = 0;

  /* ============================================================
     持久化：设备名 + 配置记忆（关掉再打开接着练）
     ============================================================ */
  function saveSim() {
    /* 自动敲之前要干跑一遍做预检（preflight），那一路会把配置状态改得面目全非。
       干跑期间不落盘，否则用户关掉软件再打开，看到的是「预检跑完的」那台设备。 */
    if (ST.dry) return;
    try {
      localStorage.setItem(LS_SIM, JSON.stringify({
        sysname: ST.sysname, bind: ST.bind, cfg: ST.cfg, saved: ST.saved
      }));
    } catch (e) { /* 存不下就只影响「下次接着练」，不影响当前这一轮 */ }
  }
  function loadSim() {
    try {
      const o = JSON.parse(localStorage.getItem(LS_SIM) || 'null');
      if (!o) return;
      if (o.sysname) ST.sysname = o.sysname;
      if (o.bind) Object.assign(ST.bind, o.bind);
      if (Array.isArray(o.cfg)) ST.cfg = o.cfg;
      if (o.saved) ST.saved = o.saved;
    } catch (e) {}
  }

  /* ============================================================
     提示符
     ============================================================ */
  function fillTpl(tpl) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => {
      if (k === 'h') return ST.sysname;
      if (k === 'aclType') return (+ST.bind.aclNum < 3000 ? 'basic' : 'adv');
      return ST.bind[k] != null ? ST.bind[k] : '';
    });
  }
  const promptText = () => fillTpl(viewMeta(ST.view).tpl);

  /* 当前视图的配置路径（system 和 user 不算一层） */
  function curPath() {
    return ST.stack.filter(s => s.id !== 'user' && s.id !== 'system').map(s => s.header);
  }

  /* ============================================================
     DOM
     ============================================================ */
  let UI = null;

  const HTML = `
  <div class="pr-head">
    <div class="pr-title"><b>练习场</b><small>VRP simulator</small></div>
    <button class="pr-dev" id="prDev" title="点一下改设备名（等于敲 sysname）">Huawei</button>
    <div class="pr-sp"></div>
    <button class="pr-btn" id="prLibBtn" title="命令库（Ctrl+Alt+L）">命令库</button>
    <button class="pr-btn" id="prQueueBtn" title="演练队列">演练</button>
    <button class="pr-btn" id="prSaveBtn" title="保存配置（等于敲 save）">保存</button>
    <button class="pr-btn" id="prResetBtn" title="清空这台模拟设备，回到出厂状态">重置</button>
    <button class="pr-x" id="prClose" title="关闭（Esc）">×</button>
  </div>
  <div class="pr-body">
    <aside class="pr-queue" id="prQueue">
      <div class="pr-qh"><span>演练队列</span><span class="n" id="prQState"></span>
        <span style="flex:1"></span>
        <button class="pr-btn" id="prDemo" style="padding:2px 8px;font-size:11px" title="按队列顺序自动敲一遍（只是演示，学会了自己敲）">自动敲</button>
      </div>
      <div class="pr-qlist" id="prQList"></div>
    </aside>

    <section class="pr-term">
      <div class="pr-screen" id="prScreen"></div>
      <div class="pr-inline"><span class="ps" id="prPrompt">&lt;Huawei&gt;</span>
        <input id="prCmd" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="命令行输入">
      </div>
      <div class="pr-cands" id="prCands"></div>
      <div class="pr-tips">Tab 补全 · ? 看当前视图能敲什么 · ↑↓ 历史 · Ctrl+L 清屏 · Esc 关闭</div>
    </section>

    <aside class="pr-lib" id="prLib">
      <div class="pr-search">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" style="width:14px;height:14px;stroke:currentColor;opacity:.6"><circle cx="11" cy="11" r="6.6"/><path d="M16 16l4 4"/></svg>
        <input id="prLibQ" placeholder="搜命令 / 作用 / 模块（ospf cost）" autocomplete="off" spellcheck="false">
      </div>
      <div class="pr-libf">
        <label><input type="checkbox" id="prOnlySim"> 只看能敲的</label>
        <span class="cnt" id="prLibCnt"></span>
      </div>
      <div class="pr-liblist" id="prLibList"></div>
      <div class="pr-detail" id="prDetail"></div>
    </aside>
  </div>`;

  function build() {
    if (UI) return UI;
    const root = document.createElement('div');
    root.id = 'practice';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = HTML;
    document.body.appendChild(root);
    UI = {
      root,
      screen: $('#prScreen', root),
      input: $('#prCmd', root),
      prompt: $('#prPrompt', root),
      cands: $('#prCands', root),
      dev: $('#prDev', root),
      qlist: $('#prQList', root),
      qstate: $('#prQState', root),
      libList: $('#prLibList', root),
      libQ: $('#prLibQ', root),
      libCnt: $('#prLibCnt', root),
      detail: $('#prDetail', root)
    };
    bind();
    return UI;
  }

  /* ============================================================
     终端输出
     ============================================================ */
  function line(text, cls) {
    const d = document.createElement('div');
    d.className = 'l ' + (cls || '');
    d.textContent = text;
    UI.screen.appendChild(d);
    UI.screen.scrollTop = UI.screen.scrollHeight;
    return d;
  }
  function raw(html, cls) {
    const d = document.createElement('div');
    d.className = 'l ' + (cls || '');
    d.innerHTML = html;
    UI.screen.appendChild(d);
    UI.screen.scrollTop = UI.screen.scrollHeight;
    return d;
  }
  const blank = () => line('', '');

  /* 参数类型 → 着色 class，跟主窗口代码块同一套色 */
  const TCLS = {
    keyword: 'tk', ifname: 'tif', ipv4: 'tip', mask: 'tm', wildcard: 'tw',
    num: 'tn', enum: 'tn', aclnum: 'tn', vlanid: 'tn', vlanlist: 'tn',
    asnum: 'tn', areaid: 'tn', ipv6addr: 'tn', name: 'ts', str: 'ts', mac: 'ts'
  };

  function echoOk(rawText, res) {
    let html = '<span class="ps">' + esc(promptText()) + '</span> ';
    if (res && res.path && res.path.length && !res.err) {
      html += res.path.map(p => {
        const cls = p.kind === 'keyword' ? 'tk' : (TCLS[p.node.param] || 'ts');
        return '<span class="' + cls + '">' + esc(p.value) + '</span>';
      }).join(' ');
    } else html += esc(rawText);
    return raw(html);
  }

  function echoErr(rawText, res) {
    echoOk(rawText, null);
    const e = res.err;
    let pad = promptText().length + 1;
    const toks = rawText.trim().split(/\s+/);
    for (let i = 0; i < e.index; i++) pad += toks[i].length + 1;
    raw(' '.repeat(pad) + '<span class="caret">^</span>');
    line('Error: ' + e.msg, 'err');

    /* 报错位置能区分两件事，别混成一句「检查拼写」：
       - 第一个词就不认（index 0）：这个视图下真没有这条命令，多半是拼写或视图不对；
       - 认到一半才失手（index > 0）：命令开头是对的，是内核还没收录后半段。
         把后者说成「检查拼写」会把人带偏 —— 他拿到真机上敲是对的，
         然后就会觉得「这软件不准」（v1.2.0 的 mpls ldp 就是这么被抱怨的）。 */
    if (/^Unrecognized/i.test(e.msg)) {
      if (e.index > 0) {
        line('  ↳ 开头「' + String(rawText).trim().split(/\s+/)[0]
          + '」是对的，模拟器只收录到这一层；后半段的写法请到真机上确认', 'dim');
      } else {
        line('  ↳ 这个视图下没有这条命令，检查拼写，或按 ? 看这里能敲什么', 'dim');
      }
    } else if (e.detail) {
      line('  ↳ ' + e.detail, 'dim');
    }
    if (e.fix) line('  ↳ ' + e.fix, 'dim');
    if (e.expect && e.expect.length) {
      line('  ↳ 这里能敲：' + e.expect.slice(0, 8).join(' / '), 'dim');
    }
  }

  /* ============================================================
     视图栈
     ============================================================ */
  function enterView(target, res, header) {
    /* 同层切换（interface A → interface B）是替换栈顶，不是压栈：
       后面一个 quit 应该回到系统视图，跟真机一致 */
    const top = ST.stack[ST.stack.length - 1];
    if (top.id === target && ST.stack.length > 1) {
      top.header = header || top.header;
    } else {
      ST.stack.push({ id: target, header: header || '' });
    }
    ST.view = target;

    /* 提示符里的变量：从刚才那条命令的 path 里取 */
    const meta = VRP.VIEWMETA[target];
    if (meta && meta.bind && res) {
      const want = BIND_SRC[meta.bind] || [];
      let pick = null;
      res.path.forEach(p => {
        if (p.kind === 'param' && want.indexOf(p.node.param) > -1 && !pick) pick = p;
      });
      if (pick) ST.bind[meta.bind] = pick.display || pick.value;
    }
  }
  function popView() {
    if (ST.stack.length <= 1) return;
    ST.stack.pop();
    ST.view = ST.stack[ST.stack.length - 1].id;
  }
  function resetView() {
    ST.stack = [{ id: 'user', header: '' }];
    ST.view = 'user';
  }

  /* 恢复出厂：配置、设备名、提示符变量一起清（「重置」按钮和自检脚本共用） */
  function resetSim() {
    ST.cfg = [];
    ST.saved = null;
    ST.sysname = 'Huawei';
    Object.assign(ST.bind, BIND_DEF);
    resetView();
    saveSim();
    updatePrompt();
  }

  /* ============================================================
     配置记忆
     ============================================================ */
  function recLine(rawText) {
    /* 记一条配置：同路径下同样的行不重复记（真机也是这样，改了就覆盖） */
    const path = curPath();
    const key = path.join('\u0001');
    const exist = ST.cfg.find(x => x.path.join('\u0001') === key && x.line === rawText);
    if (!exist) ST.cfg.push({ path: path.slice(), line: rawText });
    saveSim();
  }
  function unrecLine(rawText) {
    const path = curPath();
    const key = path.join('\u0001');
    const i = ST.cfg.findIndex(x => x.path.join('\u0001') === key && x.line === rawText);
    if (i > -1) { ST.cfg.splice(i, 1); saveSim(); }
    else return false;
    return true;
  }

  /* 配置树 → 文本（真机 current-configuration 的样子） */
  function cfgTree(entries) {
    const root = { order: [], kids: {}, lines: [] };
    entries.forEach(e => {
      let n = root;
      (e.path || []).forEach(h => {
        if (!n.kids[h]) { n.kids[h] = { order: [], kids: {}, lines: [] }; n.order.push(h); }
        n = n.kids[h];
      });
      n.lines.push(e.line);
    });
    return root;
  }

  function renderTree(node, depth, out) {
    node.lines.forEach(l => out.push(' '.repeat(depth + 1) + l));
    node.order.forEach(h => {
      out.push(' '.repeat(depth) + h);
      renderTree(node.kids[h], depth + 1, out);
    });
  }

  function configText() {
    const out = [];
    /* 整棵树一起建，root.lines 就是系统视图下那些（sysname / vlan batch / ip route-static）；
       子视图的块靠 tree.order 逐层铺开。只把无路径的条目喂进 cfgTree 会让
       interface 块整块消失 —— 踩过一次，别再拆开写。 */
    const tree = cfgTree(ST.cfg);
    const sys = tree.lines.map(l => ' ' + l);
    const body = [];
    tree.order.forEach(h => {
      body.push(h);
      renderTree(tree.kids[h], 1, body);
    });
    if (!sys.length && !body.length) return '!\n! 还没配任何东西 —— 敲两句就有了，比如\n!   system-view\n!   sysname SW1\n#\nreturn';
    out.push('!Software Version V200R019C10SPC500');
    if (sys.length) { out.push('#'); out.push.apply(out, sys); }
    body.forEach(l => {
      /* 每个块头（不缩进的那行）前面都来一条 #，跟真机一致。
         原来的判断是「上一条不是缩进行才加」，于是在「上一个块刚结束、下一个块开始」时
         漏掉了分隔线 —— interface 那块会跟上面的 mpls 块挤在一起，
         看着像 interface 长在 mpls 里面。 */
      if (l && l[0] !== ' ') out.push('#');
      out.push(l);
    });
    out.push('#');
    out.push('return');
    return out.join('\n');
  }

  function thisText() {
    const path = curPath();
    const key = path.join('\u0001');
    const lines = ST.cfg.filter(x => x.path.join('\u0001') === key).map(x => ' ' + x.line);
    const out = ['#'];
    if (path.length) out.push(path[path.length - 1]);
    if (lines.length) out.push.apply(out, lines);
    else out.push(' ! 这个视图下还没配东西');
    out.push('#');
    out.push('return');
    return out.join('\n');
  }

  /* ---------- 从配置里推出来的表 ----------
     只推「配置决定的部分」：直连路由来自 ip address，静态路由来自
     ip route-static。协议路由（OSPF/BGP 学来的）不编 —— 那要靠真机。 */
  function ipToNum(ip) { return ip.split('.').reduce((a, x) => a * 256 + (+x), 0); }
  /* 按「位」拆，不是按 256 的幂拆 —— 写成 Math.pow(256, s) 会一路算成 0.0.0.0 */
  function numToIp(n) { return [24, 16, 8, 0].map(s => Math.floor(n / Math.pow(2, s)) % 256).join('.'); }
  function prefixOfMask(m) {
    if (/^\d+$/.test(m)) return +m;
    const b = m.split('.').map(x => (+x).toString(2).padStart(8, '0')).join('');
    const i = b.indexOf('0');
    return i < 0 ? 32 : i;
  }
  function netOf(ip, m) {
    let mask = m;
    if (/^\d+$/.test(m)) {
      const p = +m;
      mask = numToIp(p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
    }
    const n = (ipToNum(ip) & ipToNum(mask)) >>> 0;
    return { net: numToIp(n), mask, prefix: prefixOfMask(m), netNum: n };
  }

  function routes() {
    const out = [];
    const ifIp = {};
    ST.cfg.forEach(e => {
      const m = /^ip address (\S+) (\S+)/.exec(e.line);
      if (!m || !e.path.length) return;
      const ifName = (/^interface (.+)$/.exec(e.path[0]) || [])[1];
      if (!ifName) return;
      const n = netOf(m[1], m[2]);
      ifIp[ifName] = { ip: m[1], mask: m[2], prefix: n.prefix };
      out.push({ dest: n.net + '/' + n.prefix, proto: 'Direct', pre: 0, cost: 0,
                 flag: 'D', next: m[1], iface: ifName });
      out.push({ dest: m[1] + '/32', proto: 'Direct', pre: 0, cost: 0,
                 flag: 'D', next: '127.0.0.1', iface: 'InLoopBack0' });
    });
    ST.cfg.filter(e => !e.path.length).forEach(e => {
      const m = /^ip route-static (\S+) (\S+) (\S+)/.exec(e.line);
      if (!m) return;
      const n = netOf(m[1], m[2]);
      out.push({ dest: n.net + '/' + n.prefix, proto: 'Static', pre: 60, cost: 0,
                 flag: 'RD', next: m[3], iface: ifIp[m[3]] ? '' : 'GigabitEthernet0/0/0' });
    });
    return { list: out, ifIp };
  }

  function pad(s, n, right) {
    s = String(s);
    if (s.length >= n) return s;
    return right ? ' '.repeat(n - s.length) + s : s + ' '.repeat(n - s.length);
  }

  function routeTable() {
    const { list } = routes();
    const rows = list.map(r =>
      pad(r.dest, 20, true) + ' ' + pad(r.proto, 7) + pad(String(r.pre), 4) +
      ' ' + pad(String(r.cost), 4) + '     ' + pad(r.flag, 3, true) + ' ' +
      pad(r.next, 16) + pad(r.iface, 1));
    const out = [
      'Route Flags: R - relay, D - download to fib',
      '------------------------------------------------------------------------------',
      'Routing Tables: Public',
      '         Destinations : ' + list.length + '        Routes : ' + list.length,
      '',
      'Destination/Mask    Proto   Pre  Cost        Flags NextHop         Interface',
      ''
    ];
    if (!rows.length) out.push('  路由表是空的：先给接口配 ip address，或者加一条 ip route-static');
    else out.push.apply(out, rows);
    return out.join('\n');
  }

  function ifBrief() {
    const { ifIp } = routes();
    const names = Object.keys(ifIp);
    const out = [
      'Interface                   IP Address/Mask    Physical   Protocol',
    ];
    if (!names.length) {
      out.push('（还没有接口配地址）');
    } else names.forEach(n => {
      const a = ifIp[n];
      out.push(pad(n, 28) + pad(a.ip + '/' + a.prefix, 19) + pad('up', 11) + 'up');
    });
    out.push('');
    out.push('· 练习场的接口状态恒为 up —— 真实设备还要看物理链路和协议状态');
    return out.join('\n');
  }

  function vlanTable() {
    const ids = new Set();
    ST.cfg.forEach(e => {
      const m = /^vlan batch (.+)$/.exec(e.line);
      if (m) m[1].split(/\s+/).forEach(t => {
        if (/^\d+$/.test(t)) ids.add(+t);
        else if (/^(\d+)to(\d+)$/.test(t)) {
          const [, a, b] = /^(\d+)to(\d+)$/.exec(t);
          for (let i = +a; i <= +b && i - a < 200; i++) ids.add(i);
        }
      });
      const v = /^vlan (\d+)$/.exec(e.path[0] || '');
      if (v) ids.add(+v[1]);
    });
    const out = ['The total number of vlans is : ' + ids.size, '',
      '------------------------------------------------------------------------------',
      'U: Up;         D: Down;         TG: Tagged;         UT: Untagged;',
      'MP: Vlan-mapping;               ST: Vlan-stacking;',
      '#: ProtocolTransparent-vlan;    *: Management-vlan;',
      '------------------------------------------------------------------------------', '',
      'VID  Type    Ports', ''];
    if (!ids.size) out.push('（还没有 VLAN，敲一句 vlan batch 10 20）');
    else [...ids].sort((a, b) => a - b).forEach(id =>
      out.push(String(id).padEnd(5) + 'common  '));
    return out.join('\n');
  }

  /* 这些 display 的表项是协议算出来的，模拟器不编 */
  const NO_FAKE = {
    ospfpeer: 'OSPF 邻居', ospfroute: 'OSPF 路由', ospflsdb: 'OSPF LSDB',
    ospfif: 'OSPF 接口', isispeer: 'IS-IS 邻居', isisroute: 'IS-IS 路由',
    bgppeer: 'BGP 邻居', bgproute: 'BGP 路由表', vrrp: 'VRRP 状态',
    arp: 'ARP 表', mac: 'MAC 地址表', stp: '生成树状态', trunk: 'Eth-Trunk 成员',
    lldp: 'LLDP 邻居', ippool: '地址池已分配', ospf6peer: 'OSPFv3 邻居',
    msdppeer: 'MSDP 对等体', pim: 'PIM 邻居', igmp: 'IGMP 组'
  };

  function print(kind, rawText, res) {
    if (/^display\s+this$/.test(rawText)) { line(thisText()); return; }
    if (/^display\s+current-configuration/.test(rawText)) { line(configText()); return; }
    if (/^display\s+saved-configuration/.test(rawText)) {
      if (!ST.saved) line('Error: The saved configuration file is not exist.', 'err');
      else line(ST.saved);
      return;
    }
    switch (kind) {
      case 'version':
        line('Huawei Versatile Routing Platform Software', 'hdr');
        line('VRP (R) software, Version 8.180 (CodeAtlas 练习场)');
        line('Copyright (C) 2026 CodeAtlas. 仅供练习，不连接任何设备。', 'dim');
        line('HUAWEI S5700-28C-EI uptime is 0 day, 0 hour, 12 minutes');
        return;
      case 'clock': {
        const d = new Date();
        line(d.toISOString().replace('T', ' ').slice(0, 19) + ' Sunday');
        return;
      }
      case 'route':
        line(routeTable());
        return;
      case 'ifbrief':
        line(ifBrief());
        return;
      case 'vlan':
      case 'portvlan':
        line(vlanTable());
        return;
      case 'save':
        ST.saved = configText();
        saveSim();
        line('The current configuration is saved to the device successfully.', 'ok');
        return;
      case 'reset':
        ST.saved = null;
        saveSim();
        line('Warning: All configuration will be reset. Reboot to take effect.', 'warn');
        return;
      case 'ok':
        return;
      default: {
        const name = NO_FAKE[kind];
        if (name) {
          line('· 练习场不模拟' + name + '：那是协议算出来的状态，编出来的假表项比没有更害人。', 'dim');
          line('· 命令格式和参数在右边命令库里查；这类回显请在 eNSP / 真机上看。', 'dim');
        } else {
          line('· 练习场没做这条的回显。命令本身是对的（没报错），细节请在真机上看。', 'dim');
        }
      }
    }
  }

  /* ============================================================
     执行一行
     ============================================================ */
  function pushHist(s) {
    if (ST.hist[ST.hist.length - 1] !== s) ST.hist.push(s);
    if (ST.hist.length > 200) ST.hist.shift();
    ST.hi = ST.hist.length;
  }

  function exec(rawText) {
    const s = String(rawText || '').trim();
    if (!s) return null;
    let res = VRP.analyze(ST.view, s);
    let echoRes = res;

    /* undo 的兜底：内核的 SPEC 表里不是每条命令都写了 undo 形式，
       但「去掉 undo 之后这条能敲」在 VRP 里就等于「取消这条配置」。
       所以解析失败时退一步，用去掉 undo 的命令再解析一次 ——
       这样 undo vlan batch 10 20 也能真的把那条配置删掉，
       而不是甩一句 Unrecognized command 让用户以为写错了。 */
    if (res.err && /^undo\s+/i.test(s)) {
      const r2 = VRP.analyze(ST.view, s.replace(/^undo\s+/i, '').trim());
      if (!r2.err && r2.path.length) { res = r2; echoRes = null; }
    }

    if (res.err) { echoErr(s, res); return res; }
    const echoEl = echoOk(s, echoRes);

    /* 内核里 ip route-static 被标成了「顺手打一张路由表」（那是训练场为了
       演示加的）。在真机 / 这里它是配置命令：记下来就行，别刷表。 */
    if (/^ip route-static\b/i.test(VRP.canonical(res) || s)) res.action = { print: 'ok' };

    const act = res.action;
    const bare = VRP.canonical(res) || s;
    const isUndo = /^undo\s+/i.test(s);
    const canon = isUndo ? 'undo ' + bare : bare;

    /* 1. 配置类：先记（记的是当前视图，必须在切视图之前）
       `act.save` 是「既进视图又记配置」的命令（mpls / mpls ldp），
       真机的 current-configuration 里能看到它们，不能只当导航处理。 */
    const isQuery = /^(display|ping|tracert|reset\s+(?!saved))/i.test(s);

    if (act && (act.print === 'ok' || act.save) && !isQuery) {
      if (isUndo) {
        const had = unrecLine(bare);
        line(had ? '· 已从配置里删掉这一条' : '· 这条本来就没配过', 'dim');
      } else {
        recLine(bare);
        /* 头三次把「去哪看」说清楚，之后就只留一个小点 ——
           每敲一行都刷一整句提示，滚起来比真机还吵。 */
        recHint++;
        if (recHint <= 3) {
          line('· 已记入配置（display current-configuration 能看到）', 'dim');
        } else if (echoEl) {
          /* 之后不再单独占一行：在回显行尾点一个小点就够，
             否则每敲一行都多出一行空行，滚起来比真机还稀。 */
          const dot = document.createElement('span');
          dot.className = 'mk';
          dot.textContent = '·';
          echoEl.appendChild(dot);
        }
      }
      /* sysname 的副作用：改提示符 */
      const m = /^sysname (\S+)/.exec(bare);
      if (m) { ST.sysname = m[1]; saveSim(); }
    }

    /* 2. 切视图 / 回去 */
    if (act && act.view) {
      enterView(act.view, res, bare);
    } else if (act && act.pop) {
      popView();
    } else if (act && act.reset) {
      resetView();
      line('· 已回到用户视图', 'dim');
    } else if (act && act.print) {
      print(act.print, s, res);
    }

    updatePrompt();
    markQueue(bare, s);
    return res;
  }

  /* ============================================================
     补全 / 帮助
     ============================================================ */
  function candHTML(items, head) {
    let h = head ? '<div class="ch">' + esc(head) + '</div>' : '';
    items.forEach((it, i) => {
      h += '<div class="cg' + (i === ST.ci ? ' act' : '') + '" data-ci="' + i + '">'
        + '<b>' + esc(it.label) + '</b>'
        + '<span>' + esc((it.help || '').slice(0, 90)) + '</span></div>';
    });
    return h;
  }

  function showCands(items, head) {
    ST.cands = items;
    ST.ci = 0;
    if (!UI.cands) return;
    if (!items.length) { UI.cands.classList.remove('on'); UI.cands.innerHTML = ''; return; }
    UI.cands.innerHTML = candHTML(items, head);
    UI.cands.classList.add('on');
  }
  function hideCands() {
    ST.cands = [];
    if (UI.cands) { UI.cands.classList.remove('on'); UI.cands.innerHTML = ''; }
  }

  function complete() {
    const val = UI.input.value;
    const s = VRP.suggest(ST.view, val);
    if (!s.items.length) {
      showCands([], '');
      line('· 这里没有以「' + (s.prefix || '') + '」开头的命令。敲 ? 看当前视图能敲什么。', 'dim');
      return;
    }
    if (s.items.length === 1) {
      const it = s.items[0];
      const fill = it.kind === 'kw' ? it.text : (it.sample || '');
      const post = (it.kind === 'kw' && it.node && (it.node.children || []).length) ? ' ' : '';
      UI.input.value = (s.base ? s.base + ' ' : '') + fill + post;
      hideCands();
      return;
    }
    /* 多个候选：先补公共前缀（Tab 的老规矩），再把候选列出来 */
    const cp = VRP.commonPrefix(s.items.map(x => x.kind === 'kw' ? x.text : (x.sample || '')));
    if (cp && cp.length > (s.prefix || '').length) {
      UI.input.value = (s.base ? s.base + ' ' : '') + cp;
    }
    showCands(s.items, 'Tab 补全 · 再按 Tab 往下选 · Esc 收起');
  }

  function help() {
    const val = UI.input.value;
    const s = VRP.suggest(ST.view, val);
    const head = '当前视图能敲（' + viewMeta(ST.view).name + '）· 共 ' + s.items.length + ' 条';
    showCands(s.items.slice(0, 40), head);
    if (!s.items.length) line('· 这里没有以「' + (s.prefix || '') + '」开头的命令', 'dim');
  }

  function acceptCand(i) {
    const it = ST.cands[i];
    if (!it) return;
    const val = UI.input.value;
    const s = VRP.suggest(ST.view, val);
    const fill = it.kind === 'kw' ? it.text : (it.sample || '');
    const post = (it.kind === 'kw' && it.node && (it.node.children || []).length) ? ' ' : '';
    UI.input.value = (s.base ? s.base + ' ' : '') + fill + post;
    hideCands();
    UI.input.focus();
  }

  /* ============================================================
     演练队列
     ============================================================ */
  function loadQueue(steps, title) {
    ST.queue = { title: title || '演练', steps: (steps || []).map(x => ({
      c: String(x.c || '').trim(), note: x.note || '', done: false
    })).filter(x => x.c) };
    ST.qi = 0;
    renderQueue();
  }

  function renderQueue() {
    const st = ST.queue;
    if (!UI) return;
    if (!st) {
      UI.qlist.innerHTML = '<div class="pr-qempty"><b>还没有演练的剧本</b>'
        + '点顶栏「演练」，挑一套剧本 / 预设，命令会排在这里，'
        + '你在中间敲，敲对一条勾一条。</div>';
      UI.qstate.textContent = '';
      return;
    }
    const done = st.steps.filter(x => x.done).length;
    UI.qstate.textContent = done + '/' + st.steps.length;
    UI.qlist.innerHTML = '<div class="pr-qempty" style="padding:8px 12px 6px">'
      + '<b style="margin:0;font-size:11.5px;color:var(--tx)">' + esc(st.title) + '</b></div>'
      + st.steps.map((x, i) =>
        '<div class="pr-step' + (x.done ? ' done' : '') + (i === ST.qi ? ' cur' : '') + '" data-qi="' + i + '">'
        + '<span class="mk">' + (x.done ? '✓' : '') + '</span>'
        + '<span class="bd"><code>' + esc(x.c) + '</code>'
        + (x.note ? '<span class="nt">' + esc(x.note) + '</span>' : '') + '</span></div>'
      ).join('');
  }

  function markQueue(canon, rawText) {
    const st = ST.queue;
    if (!st) return;
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ');
    const target = norm(canon);
    const direct = norm(rawText);
    for (let i = 0; i < st.steps.length; i++) {
      if (st.steps[i].done) continue;
      const c = st.steps[i].c;
      if (norm(c) === target || norm(c) === direct) {
        st.steps[i].done = true;
        if (i === ST.qi) ST.qi = Math.min(i + 1, st.steps.length - 1);
        renderQueue();
        if (st.steps.every(x => x.done)) line('· 这套剧本敲完了。可以 display current-configuration 整体看一眼。', 'ok');
        return;
      }
    }
  }

  /* 演练选择器：把当前专题下的剧本 / 预设都列出来 */
  function pickQueue() {
    const recipes = (D.recipes || []);
    const items = recipes.map(r => ({ id: r.id, kind: 'rec', title: r.title, n: (r.steps || []).length, scene: r.scene || '' }));
    if (!items.length) { toast('没有可演练的剧本 —— 先导入内容'); return; }
    /* 用候选条复用渲染：点一条就装进队列 */
    ST.pickMode = true;
    const list = items.slice(0, 40);
    ST.cands = list.map(x => ({ kind: 'rec', label: x.title, help: x.scene + ' · ' + x.n + ' 步', rec: x }));
    UI.cands.innerHTML = '<div class="ch">挑一套剧本装进左边的演练队列（共 ' + items.length + ' 套）</div>'
      + ST.cands.map((x, i) => '<div class="cg' + (i === 0 ? ' act' : '') + '" data-ci="' + i + '">'
        + '<b>' + esc(x.label) + '</b><span>' + esc(x.help) + '</span></div>').join('');
    UI.cands.classList.add('on');
  }

  function useCand(i) {
    const it = ST.cands[i];
    if (!it) return;
    if (it.kind === 'rec') {
      const r = (D.recipes || []).find(x => x.id === it.rec.id);
      if (r) {
        loadQueue((r.steps || []).map(s => ({ c: s.c, note: s.note })), r.title);
        line('· 已装入剧本《' + r.title + '》 ' + (r.steps || []).length + ' 步，左边跟着敲。', 'ok');
        if (ST.pickMode) { ST.pickMode = false; hideCands(); }
      }
      return;
    }
    acceptCand(i);
  }

  /* ============================================================
     命令库
     ============================================================ */
  function loadDict(done) {
    if (window.VRP_DICT) { ST.libLoaded = true; done && done(); return; }
    const s = document.createElement('script');
    s.src = 'assets/vrp/dict.js';
    s.onload = () => { ST.libLoaded = true; done && done(); };
    s.onerror = () => { ST.libLoaded = false; done && done(); };
    document.head.appendChild(s);
  }

  function dictList() {
    const all = (window.VRP_DICT && window.VRP_DICT.cmd) || [];
    return all.map(x => ({
      name: x[0], view: x[1], syntax: x[2], brief: x[3], mod: x[4],
      fn: x[5], params: x[6], level: x[7], group: x[8], sim: x[9]
    }));
  }

  function matchDict(q) {
    const list = dictList();
    const k = String(q || '').trim().toLowerCase();
    let out = list;
    if (ST.libOnlySim) out = out.filter(x => x.sim);
    if (k) {
      const parts = k.split(/\s+/).filter(Boolean);
      out = out.filter(x => {
        const hay = (x.name + ' ' + x.syntax + ' ' + x.brief + ' ' + x.mod + ' ' + x.view + ' ' + (x.group || '')).toLowerCase();
        return parts.every(p => hay.indexOf(p) > -1);
      });
      /* 名字开头命中的排前面 */
      out = out.slice().sort((a, b) => {
        const an = a.name.toLowerCase().indexOf(k) === 0 ? 0 : (a.syntax.toLowerCase().indexOf(k) > -1 ? 1 : 2);
        const bn = b.name.toLowerCase().indexOf(k) === 0 ? 0 : (b.syntax.toLowerCase().indexOf(k) > -1 ? 1 : 2);
        return an - bn;
      });
    }
    return out;
  }

  function renderLib() {
    if (!UI) return;
    if (!window.VRP_DICT) {
      UI.libList.innerHTML = '<div class="pr-libempty">正在加载官方命令库…</div>';
      UI.libCnt.textContent = '';
      return;
    }
    const list = matchDict(ST.libQ);
    UI.libCnt.textContent = list.length + ' 条';
    if (!list.length) {
      UI.libList.innerHTML = '<div class="pr-libempty">没有匹配的命令。试试只搜命令名，比如 <b>ospf</b>、<b>vlan</b>。</div>';
      return;
    }
    const CAP = 120;
    const show = list.slice(0, CAP);
    let h = '', last = '';
    show.forEach((x, i) => {
      if (x.mod !== last) { h += '<div class="pr-grp">' + esc(x.mod) + '</div>'; last = x.mod; }
      h += '<div class="pr-item' + (i === ST.libSel ? ' on' : '') + '" data-li="' + i + '">'
        + '<div class="s">' + esc(x.syntax.split('\n')[0]) + '</div>'
        + '<div class="m"><span class="vw">' + esc(x.view.split('、')[0]) + '</span>'
        + (x.sim ? '<span class="sim">能敲</span>' : '')
        + '</div></div>';
    });
    if (list.length > CAP) {
      h += '<div class="pr-libempty">还有 ' + (list.length - CAP) + ' 条，再输几个字缩小范围。</div>';
    }
    UI.libList.innerHTML = h;
    UI.libList._list = show;
  }

  function showDetail(i) {
    const list = UI.libList._list || [];
    const x = list[i];
    if (!x) return;
    ST.libSel = i;
    [...UI.libList.querySelectorAll('.pr-item')].forEach((el, k) => el.classList.toggle('on', k === i));
    const params = (x.params || []);
    UI.detail.innerHTML =
      '<h3>' + esc(x.syntax.split('\n')[0]) + '</h3>'
      + '<div class="dmeta"><em>' + esc(x.view.split('、')[0]) + '</em>'
      + (x.level ? ' · ' + esc(x.level) : '')
      + (x.group ? ' · ' + esc(x.group) : '')
      + (x.sim ? ' · <span style="color:var(--mint)">可演练</span>' : '') + '</div>'
      + (x.brief || x.fn ? '<div class="dsec"><b>作用</b><p>' + esc(x.fn || x.brief) + '</p></div>' : '')
      + (x.syntax.split('\n').length > 1 || x.syntax.length > 60
        ? '<div class="dsec"><b>命令格式</b><div class="syn">' + esc(x.syntax) + '</div></div>' : '')
      + (params.length ? '<div class="dsec"><b>参数</b><table>'
        + params.map(p => '<tr><td>' + esc(p[0]) + '</td><td>' + esc(p[1])
          + (p[2] ? '<i>' + esc(p[2]) + '</i>' : '') + '</td></tr>').join('')
        + '</table></div>' : '')
      + '<div class="pr-dact">'
      + (x.sim ? '<button class="pr-btn" data-liact="try" title="把这条填进终端，自己按回车"><b>试一句</b></button>' : '')
      + '<button class="pr-btn" data-liact="copy">复制格式</button>'
      + '</div>';
    UI.detail._x = x;
  }

  /* ============================================================
     事件
     ============================================================ */
  function updatePrompt() {
    if (!UI) return;
    UI.prompt.textContent = promptText();
    UI.dev.textContent = ST.sysname;
  }

  /* 侧栏开关：宽屏是「收起这一列」，窄屏是「抽屉拉出来」——
     同一个按钮两种行为，用户不用记两套。 */
  function togglePanel(which) {
    const body = UI.root.querySelector('.pr-body');
    const el = UI.root.querySelector(which === 'lib' ? '.pr-lib' : '.pr-queue');
    if (window.innerWidth <= 1080) { el.classList.toggle('on'); return; }
    body.classList.toggle(which === 'lib' ? 'no-lib' : 'no-queue');
  }
  function closeDrawers() {
    let closed = false;
    if (window.innerWidth <= 1080) {
      ['pr-lib', 'pr-queue'].forEach(c => {
        const el = UI.root.querySelector('.' + c);
        if (el.classList.contains('on')) { el.classList.remove('on'); closed = true; }
      });
    }
    return closed;
  }

  function focusInput() {
    if (UI && UI.input) UI.input.focus();
  }

  function bind() {
    const root = UI.root;

    $('#prClose', root).onclick = () => close();

    UI.dev.onclick = () => {
      const name = window.prompt('设备名（等于敲 sysname）', ST.sysname);
      if (!name) return;
      exec('sysname ' + name.trim());
      focusInput();
    };

    $('#prLibBtn', root).onclick = () => { togglePanel('lib'); ensureLib(); };
    $('#prQueueBtn', root).onclick = () => {
      togglePanel('queue');
      pickQueue();
      focusInput();
    };
    $('#prSaveBtn', root).onclick = () => { exec('save'); focusInput(); };
    $('#prResetBtn', root).onclick = () => {
      if (!window.confirm('清空这台模拟设备的全部配置和设备名？\n（只影响练习场，不动主窗口的内容）')) return;
      resetSim();
      line('· 已恢复出厂状态', 'warn');
      focusInput();
    };
    $('#prDemo', root).onclick = () => demoRun();

    /* 输入框 */
    UI.input.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); complete(); return; }
      if (e.key === '?') { e.preventDefault(); help(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (ST.cands.length && document.activeElement === UI.input) { /* 回车只执行命令 */ }
        const v = UI.input.value;
        if (v.trim()) { pushHist(v); exec(v); }
        UI.input.value = '';
        hideCands();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (ST.hi > 0) { ST.hi--; UI.input.value = ST.hist[ST.hi] || ''; }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (ST.hi < ST.hist.length - 1) { ST.hi++; UI.input.value = ST.hist[ST.hi] || ''; }
        else { ST.hi = ST.hist.length; UI.input.value = ''; }
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (ST.cands.length) { hideCands(); } else if (ST.pickMode) { ST.pickMode = false; hideCands(); }
        return;
      }
      if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); UI.screen.innerHTML = ''; return; }
      if (e.key === 'Backspace' || e.key.length === 1) hideCands();
    });

    /* 候选条点击 */
    UI.cands.addEventListener('mousedown', e => {
      const c = e.target.closest('[data-ci]');
      if (!c) return;
      e.preventDefault();
      useCand(+c.dataset.ci);
    });

    /* 命令库 */
    UI.libQ.addEventListener('input', () => { ST.libQ = UI.libQ.value; ST.libSel = -1; renderLib(); });
    $('#prOnlySim', root).addEventListener('change', e => {
      ST.libOnlySim = e.target.checked; ST.libSel = -1; renderLib();
    });
    UI.libList.addEventListener('click', e => {
      const it = e.target.closest('[data-li]');
      if (it) { showDetail(+it.dataset.li); return; }
    });
    UI.detail.addEventListener('click', e => {
      const b = e.target.closest('[data-liact]');
      if (!b) return;
      const x = UI.detail._x;
      if (!x) return;
      if (b.dataset.liact === 'copy') {
        copy(x.syntax);
        toast('命令格式已复制');
      } else if (b.dataset.liact === 'try' && x.sim) {
        /* 如果这条要在别的视图敲，先帮用户切过去 —— 但只是切视图，不代敲命令 */
        if (x.sim[0] && x.sim[0] !== ST.view) {
          const meta = VRP.VIEWMETA[x.sim[0]];
          const enter = meta && meta.enter && meta.enter.sample;
          if (enter) exec(enter);
        }
        UI.input.value = x.sim[1];
        focusInput();
        toast('已填好，按回车执行');
      }
    });

    /* 演练队列点击 = 填进输入框（不替你执行） */
    UI.qlist.addEventListener('click', e => {
      const st = e.target.closest('[data-qi]');
      if (!st) return;
      const i = +st.dataset.qi;
      const x = ST.queue && ST.queue.steps[i];
      if (!x) return;
      ST.qi = i;
      renderQueue();
      UI.input.value = x.c;
      focusInput();
    });

    /* 点终端区域聚焦输入框（框选时不抢） */
    UI.screen.addEventListener('click', () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      focusInput();
    });
  }

  /* ============================================================
     自动敲
     ------------------------------------------------------------
     两个坑都在这一个函数里踩过：
     1. 演到一半弹出红色报错。用户第一反应是「我敲错了」，其实是剧本
        或模拟器的问题（内核曾把 `mpls ldp` 挂在 system 视图，整条剧本
        演出来全是错位命令）。所以先干跑一遍预检，敲不通就不开始演。
     2. 260ms 一条，看不清在敲什么。现在先把命令写进输入框停一下，
        再「回车」，跟人敲的节奏接近。
     ============================================================ */

  /* 干跑：拿当前状态真跑一遍，跑完把状态和终端一字不差地还原。
     返回第一个敲不通的位置（{ i, c, err }），全通返回 null。 */
  function preflight(list) {
    const snap = JSON.stringify({
      cfg: ST.cfg, stack: ST.stack, view: ST.view, sysname: ST.sysname,
      bind: ST.bind, saved: ST.saved, hist: ST.hist, hi: ST.hi,
      hint: recHint, done: ST.queue ? ST.queue.steps.map(x => !!x.done) : null
    });
    const html = UI.screen.innerHTML;
    const cand = { list: ST.cands, ci: ST.ci };
    let bad = null;
    ST.dry = true;
    try {
      for (let i = 0; i < list.length; i++) {
        const r = exec(list[i]);
        if (r && r.err) { bad = { i: i, c: list[i], err: r.err }; break; }
      }
    } finally {
      /* 无论中间抛没抛都得还原 —— 半截状态比不预检更糟 */
      ST.dry = false;
      const s = JSON.parse(snap);
      ST.cfg = s.cfg; ST.stack = s.stack; ST.view = s.view; ST.sysname = s.sysname;
      ST.bind = s.bind; ST.saved = s.saved; ST.hist = s.hist; ST.hi = s.hi;
      recHint = s.hint;
      if (s.done && ST.queue) ST.queue.steps.forEach((x, i) => { x.done = s.done[i]; });
      ST.cands = cand.list; ST.ci = cand.ci;
      UI.screen.innerHTML = html;
      updatePrompt();
      renderQueue();
    }
    return bad;
  }

  /* 自动敲：只是演示。随时可以点停（还是这个按钮） */
  function demoRun() {
    const st = ST.queue;
    if (!st) { toast('先挑一套剧本'); return; }
    if (ST.demo) { clearTimeout(ST.demo); ST.demo = null; toast('已停'); return; }

    let i = st.steps.findIndex(x => !x.done);
    if (i < 0) i = 0;
    if (i >= st.steps.length) { toast('这套已经敲完了'); return; }

    /* 从当前这一步起把剩下的全验一遍 */
    const bad = preflight(st.steps.slice(i).map(x => x.c));
    if (bad) {
      const n = i + bad.i + 1;
      line('· 自动敲没开始：第 ' + n + ' 步「' + bad.c + '」敲不通', 'err');
      line('  报错原文：' + (bad.err.msg || '')
        + (bad.err.at ? '（第 ' + bad.err.at + ' 个字符）' : ''), 'dim');
      line('  这是模拟器缺这条命令，不是剧本写错了 —— 这一步请到真机上练。', 'dim');
      return;
    }

    line('· 自动敲开始（演示用；学会了自己敲一遍才算会）', 'warn');

    const step = () => {
      while (i < st.steps.length && st.steps[i].done) i++;
      if (i >= st.steps.length) { ST.demo = null; return; }
      const x = st.steps[i];
      /* 先把命令写进输入框，让人看清敲的是什么，停一下再「回车」 */
      UI.input.value = x.c;
      UI.input.scrollLeft = UI.input.scrollWidth;
      ST.demo = setTimeout(() => {
        const r = exec(x.c);
        UI.input.value = '';
        if (r && r.err) {
          /* 预检拦过一遍，理论上到不了这里；真到了就老实停下 */
          ST.demo = null;
          line('· 停在这一步：模拟器敲不通这条命令（不是你的操作问题）', 'err');
          return;
        }
        i++;
        ST.demo = setTimeout(step, 300);
      }, 450);
    };
    ST.demo = setTimeout(step, 80);
  }

  function ensureLib() {
    if (window.VRP_DICT) { renderLib(); return; }
    renderLib();
    loadDict(() => { renderLib(); if (!window.VRP_DICT) UI.libList.innerHTML = '<div class="pr-libempty">命令库没加载出来（assets/vrp/dict.js 缺失）。<br>可以跑 <b>node scripts/build-vrp-dict.js</b> 重新生成。</div>'; });
  }

  /* ============================================================
     复制（跟 app.js 一样的降级路径：navigator.clipboard 不可用就 execCommand）
     ============================================================ */
  function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch (e) { return false; }
  }
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 1900);
  }

  /* ============================================================
     开场
     ============================================================ */
  function boot() {
    line('Huawei Versatile Routing Platform Software', 'hdr');
    line('VRP (R) software, Version 8.180 —— 码典练习场', 'hdr');
    line('纯前端模拟 · 不连接任何设备 · 回显只用来对照格式', 'dim');
    blank();
    line('  Tab    补全关键字（唯一时直接补齐，多个时列候选）');
    line('  ?      看当前视图能敲什么');
    line('  ↑ ↓    翻历史命令       Ctrl+L  清屏');
    blank();
    line('  敲对了不会刷屏回显 —— 真机也不回显。想看自己配了什么：', 'dim');
    line('    display this                       （只看当前视图）', 'dim');
    line('    display current-configuration      （看整套配置）', 'dim');
    blank();
    line('  试试：sys  然后按 Tab，或者直接敲 system-view 回车。', 'ok');
    blank();
  }

  /* ============================================================
     对外接口
     ============================================================ */
  function open(opts) {
    build();
    if (UI.root.classList.contains('on')) { focusInput(); return; }
    UI.root.classList.add('on');
    UI.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('practice-open');
    updatePrompt();
    renderQueue();
    ensureLib();
    if (!UI.screen.childElementCount) boot();
    if (opts && opts.steps) loadQueue(opts.steps, opts.title);
    hideCands();
    setTimeout(focusInput, 40);
  }

  function close() {
    if (!UI) return;
    if (ST.demo) { clearInterval(ST.demo); ST.demo = null; }
    UI.root.classList.remove('on');
    UI.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('practice-open');
  }

  const isOpen = () => !!(UI && UI.root.classList.contains('on'));

  /* 复位到用户视图（每次打开都从提示符状态继续，但视图退回用户视图，
     跟重新连上设备一样） */
  function openFresh() {
    resetView();
    open();
    updatePrompt();
  }

  loadSim();
  build();
  updatePrompt();
  renderQueue();

  window.PRACTICE = {
    open, close, isOpen, openFresh,
    load: (steps, title) => { loadQueue(steps, title); },
    exec: (c) => exec(c),
    reset: () => resetSim(),
    /* 给自检脚本用：不开界面也能验证解析/配置记忆 */
    _st: ST,
    _config: configText
  };

  /* ---------- 全局入口 ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="practice"]');
    if (!b) return;
    e.preventDefault();
    if (isOpen()) close(); else openFresh();
  }, true);

  /* 从剧本 / 预设 / 实验页点「演练」：那套步骤直接排进队列。
     步骤翻译在 app.js 的 practiceSteps 里（变量替换、过滤带占位符的行），
     这里拿不到就直接说拿不到，不做兜底。 */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act="practice-run"]');
    if (!b) return;
    const pack = window.CodeAtlas && window.CodeAtlas.practiceSteps
      ? window.CodeAtlas.practiceSteps(b.dataset.pre) : null;
    if (!pack) { toast('这套内容没法逐条演练（步骤里有占位符或不是具体命令）'); return; }
    if (isOpen()) { loadQueue(pack.steps, pack.title); }
    else open({ steps: pack.steps, title: pack.title });
    line('· 已装入《' + pack.title + '》 ' + pack.steps.length + ' 步，左边跟着敲。', 'ok');
  }, true);

  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      /* 先收候选，再收抽屉，最后才关面板 —— 一层层退 */
      if (ST.cands.length) { hideCands(); e.stopPropagation(); e.preventDefault(); return; }
      if (closeDrawers()) { e.stopPropagation(); e.preventDefault(); return; }
      close();
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    /* 面板开着的时候，别让主窗口的快捷键（Ctrl+K 等）插进来 */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() !== 'l') {
      if (e.target.closest && e.target.closest('#practice')) e.stopPropagation();
    }
  }, true);

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      if (isOpen()) close(); else openFresh();
    }
  });
})();
