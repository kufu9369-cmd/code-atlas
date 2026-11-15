/* ============================================================
   码典 · VRP 命令解析内核（VPK）
   ------------------------------------------------------------
   来源：朋友做的 HCIP 命令行训练场（hcip-lab）里的 vrp-core，
   原样搬过来，只加了一个 module.exports（让 Node 自检脚本能直接 require）。

   它解决的是「只查不练」的问题：光看命令格式记不住，得自己敲一遍。
   这一层负责三件事，全是纯函数、不碰 DOM：
   1. analyze(视图, 一行命令)
      → 逐 token 走命令树，认关键字（支持 VRP 的缩写规则 int g 0/0/1）
        → 认参数（每种参数有自己的校验器，报错带中文原因）
        → 返回 path / 当前候选 / 错在第几个 token / 该不该切视图
      报错文案刻意做成 VRP 原样：Wrong parameter found at '^' position.
      真正的教学信息（比如「这里要子网掩码，你填的是反掩码」）放在 hint 里。
   2. suggest(视图, 半行命令)
      → Tab 补全和 ? 提示的候选，唯一前缀直接补齐。
   3. enumerate() / viewChain() / paramValues()
      → 命令库枚举、视图祖先链、参数候选值。

   数据是 SPEC 那张表（视图 + 命令模板 + 输出类型 + 教学注释），
   加命令只往 SPEC 里加一行，不动引擎。
   ============================================================ */
var VRP = (function () {
'use strict';

/* ============ 0. 基础工具 ============ */
var IPRE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
function isIp(s){ var m = IPRE.exec(s); return !!m && m.slice(1).every(function(x){ return +x <= 255; }); }
function toBits(s){ return s.split('.').map(function(n){ return (+n).toString(2).padStart(8,'0'); }).join(''); }
function fromBits(b){ return [0,8,16,24].map(function(i){ return parseInt(b.substr(i,8),2); }).join('.'); }
function invBits(b){ return b.split('').map(function(c){ return c === '1' ? '0' : '1'; }).join(''); }
function isMask(s){ return isIp(s) && /^1*0*$/.test(toBits(s)); }
function prefixOf(s){ var b = toBits(s), i = b.indexOf('0'); return i < 0 ? 32 : i; }
function wildcardOf(m){ return fromBits(invBits(toBits(m))); }
function maskOfWild(w){ return fromBits(invBits(toBits(w))); }
function eq(a,b){ return a.toLowerCase() === b.toLowerCase(); }
function starts(a,b){ return a.toLowerCase().indexOf(b.toLowerCase()) === 0; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ============ 1. 参数类型注册表 ============ */
var IF_TYPES = [
  { re:/^(gigabitethernet|ge|gi|g)(\d+\/\d+\/\d+)$/i, canon:'GigabitEthernet', need:3 },
  { re:/^(xgigabitethernet|xge|10ge)(\d+\/\d+\/\d+)$/i, canon:'XGigabitEthernet', need:3 },
  { re:/^(eth-trunk|eth|etrunk)(\d+)$/i, canon:'Eth-Trunk', need:1 },
  { re:/^(nve)(\d*)$/i, canon:'Nve', need:0 },
  { re:/^(loopback|lo)(\d+)$/i, canon:'LoopBack', need:1 },
  { re:/^(vlanif|vlan)(\d+)$/i, canon:'Vlanif', need:1 },
  { re:/^(serial|s)(\d+\/\d+\/\d+)$/i, canon:'Serial', need:3 },
  { re:/^(tunnel)(\d+(\/\d+)*)$/i, canon:'Tunnel', need:0 },
  { re:/^(null)(\d*)$/i, canon:'NULL', need:0 }
];

var PARAMS = {
  ifname: {
    label: '接口名', sample: 'GigabitEthernet0/0/0', color: 'if',
    samples: ['GigabitEthernet0/0/0','GigabitEthernet0/0/1','GigabitEthernet0/0/2','Eth-Trunk1','Vlanif10','LoopBack0','NULL0'],
    hint: '全称或简写：GigabitEthernet0/0/1、g0/0/1、g 0/0/1',
    check: function(v){
      var raw = v.replace(/\s+/g,'');
      for (var i=0;i<IF_TYPES.length;i++){
        var t = IF_TYPES[i], m = t.re.exec(raw);
        if (m){
          var num = m[2];
          if (num == null) return { ok:false, msg:'“' + v + '” 接口名缺少编号', hint:'如 LoopBack0、Eth-Trunk1' };
          if (t.need === 0) return { ok:true, canon: t.canon + num };
          var parts = num.split('/');
          if (parts.length !== t.need){
            return { ok:false, msg:'“' + v + '” 接口编号位数不对',
                     hint: t.canon + ' 需要 ' + t.need + ' 段编号，如 ' + t.canon + '0/0/0' };
          }
          return { ok:true, canon: t.canon + num,
                   note: (t.canon + num) !== v ? '规范写法 ' + t.canon + num : '' };
        }
      }
      return { ok:false, msg:'“' + v + '” 不是合法的接口名',
               hint:'形如 GigabitEthernet0/0/0、Eth-Trunk1、Vlanif10、LoopBack0' };
    }
  },
  ipv4: {
    label: 'IP地址', sample: '192.168.1.1', color: 'ip',
    hint: '点分十进制 IPv4 地址，每段 0-255',
    check: function(v, node){
      if (!isIp(v)) return { ok:false, msg:'“' + v + '” 不是合法的 IPv4 地址', hint:'格式 a.b.c.d，每段 0-255' };
      var note = '';
      if (v === '0.0.0.0') note = '0.0.0.0 表示任意 / 默认';
      else if (node && node.warnHost){
        var last = +v.split('.')[3];
        if (last === 0) note = '末位为 0，通常是网段地址，一般不配在接口上';
        else if (last === 255) note = '末位为 255，通常是广播地址，一般不配在接口上';
      }
      return { ok:true, note: note };
    }
  },
  mask: {
    label: '子网掩码', sample: '255.255.255.0', color: 'mask',
    samples: ['255.255.255.0','255.255.255.128','255.255.255.252'],
    hint: '点分十进制子网掩码（也可写前缀长度 24）',
    check: function(v){
      if (/^\d{1,2}$/.test(v)){
        if (+v <= 32) return { ok:true, canon: fromBits('1'.repeat(+v) + '0'.repeat(32-+v)),
                               note:'前缀长度写法 /' + v + ' ≡ ' + fromBits('1'.repeat(+v)+'0'.repeat(32-+v)) };
        return { ok:false, msg:'前缀长度必须在 0-32 之间' };
      }
      if (!isIp(v)) return { ok:false, msg:'“' + v + '” 不是合法掩码', hint:'如 255.255.255.0，或直接写 24' };
      if (!isMask(v)){
        var inv = fromBits(invBits(toBits(v)));
        // 典型误用：把反掩码填进了掩码位
        if (isMask(inv)){
          return { ok:false, maskConfused:true,
                   msg:'此处需要子网掩码，' + v + ' 是反掩码',
                   hint:'把每一位取反：' + v + ' → ' + inv + '（/' + prefixOf(inv) + '）' };
        }
        return { ok:false, msg:'“' + v + '” 不是连续的子网掩码（二进制 1 必须连续）',
                 hint:'常见合法值：255.255.255.0 / 255.255.255.252；若你要写的是反掩码，应使用 0.0.0.255 形式' };
      }
      return { ok:true, note:'/' + prefixOf(v) + '，反掩码为 ' + wildcardOf(v) };
    }
  },
  wildcard: {
    label: '反掩码', sample: '0.0.0.255', color: 'wc',
    samples: ['0.0.0.255','0.0.0.63','0.0.0.0'],
    hint: '通配符掩码：0 表示必须匹配，1 表示忽略。是子网掩码取反',
    check: function(v){
      if (!isIp(v)) return { ok:false, msg:'“' + v + '” 不是合法的反掩码', hint:'形如 0.0.0.255' };
      var inv = maskOfWild(v);
      // 典型误用：把子网掩码填进来
      if (isMask(v) && v !== '0.0.0.0' && v !== '255.255.255.255'){
        return { ok:false, maskConfused:true,
                 msg:'此处需要反掩码，' + v + ' 是子网掩码',
                 hint:'把每一位取反：' + v + ' → ' + inv };
      }
      if (!isMask(inv)){
        return { ok:false, msg:'“' + v + '” 不是合法反掩码（取反后不是连续掩码）',
                 hint:'合法反掩码形如 0.0.0.255、0.0.0.3、0.0.0.0' };
      }
      return { ok:true, note:'等价子网掩码 ' + inv + '（/' + prefixOf(inv) + '）' };
    }
  },
  num: {
    label: '整数', sample: '1', color: 'num',
    hint: '整数',
    check: function(v, node){
      if (!/^\d+$/.test(v)) return { ok:false, msg:'“' + v + '” 不是整数' };
      var n = +v, r = node && node.range;
      if (r && (n < r[0] || n > r[1])) return { ok:false, msg:'取值范围 ' + r[0] + '-' + r[1] + '，' + v + ' 超出范围' };
      return { ok:true };
    }
  },
  enum: {
    label: '枚举', sample: '', color: 'num',
    hint: '从固定取值中选择',
    check: function(v, node){
      var os = (node && node.options) || [];
      for (var i=0;i<os.length;i++) if (eq(os[i], v)) return { ok:true, canon: os[i] };
      return { ok:false, msg:'“' + v + '” 不是可选值', hint:'可选：' + os.join(' / ') };
    }
  },
  name: {
    label: '名称', sample: 'HCIP-LAB', color: 'str',
    hint: '字母、数字、下划线、连字符、点',
    check: function(v){
      if (!/^[A-Za-z0-9_.\-]+$/.test(v)) return { ok:false, msg:'名称只能包含字母、数字、_ - .' };
      if (v.length > 246) return { ok:false, msg:'名称过长（≤246 字符）' };
      return { ok:true };
    }
  },
  aclnum: {
    label: 'ACL编号', sample: '3000', color: 'num',
    samples: ['2000','3000'],
    hint: '基本 ACL 2000-2999，高级 ACL 3000-3999',
    check: function(v){
      if (!/^\d{4}$/.test(v)) return { ok:false, msg:'ACL 编号为 4 位数字' };
      var n = +v;
      if (n < 2000 || n > 3999) return { ok:false, msg:'ACL 编号范围 2000-3999' };
      return { ok:true, note: n < 3000 ? '基本 ACL' : '高级 ACL' };
    }
  },
  vlanid: {
    label: 'VLAN ID', sample: '10', color: 'num',
    hint: '1-4094',
    check: function(v){
      if (!/^\d+$/.test(v)) return { ok:false, msg:'VLAN ID 必须是整数' };
      if (+v < 1 || +v > 4094) return { ok:false, msg:'VLAN ID 范围 1-4094' };
      return { ok:true };
    }
  },
  vlanlist: {
    label: 'VLAN列表', sample: '10', color: 'num',
    hint: '单个或多个 VLAN：10 20 30、10 to 20',
    check: function(v){
      var s = v.replace(/\s+/g, '');
      if (!/^\d+(,\d+)*$/.test(s) && !/^\d+to\d+$/i.test(s))
        return { ok:false, msg:'“' + v + '” 不是合法 VLAN 列表', hint:'如 10、10 20 30、10 to 20' };
      var nums = s.replace(/to/gi, ',').split(',').map(Number);
      for (var i=0;i<nums.length;i++)
        if (nums[i] < 1 || nums[i] > 4094) return { ok:false, msg:'VLAN ID 范围 1-4094' };
      return { ok:true };
    }
  },
  asnum: {
    label: 'AS号', sample: '100', color: 'num',
    hint: '1-4294967295，也可写点分格式 0.1',
    check: function(v){
      if (/^\d+$/.test(v)) return (+v >= 1 && +v <= 4294967295) ? { ok:true } : { ok:false, msg:'AS 号范围 1-4294967295' };
      if (/^\d+\.\d+$/.test(v)) return { ok:true };
      return { ok:false, msg:'AS 号写成 100 或 0.1' };
    }
  },
  ipv6addr: {
    label: 'IPv6地址', sample: '2001:db8::1', color: 'ip',
    hint: '形如 2001:db8::1，支持 :: 压缩，每段 1-4 位十六进制',
    check: function(v){
      if (!/^[0-9a-f:]+$/i.test(v) || v.indexOf(':') < 0)
        return { ok:false, msg:'“' + v + '” 不是合法的 IPv6 地址', hint:'形如 2001:db8::1' };
      var dbl = v.split('::').length - 1;
      if (dbl > 1) return { ok:false, msg:':: 只能出现一次' };
      var segs = v.split(':').filter(function(x){ return x !== ''; });
      for (var i=0;i<segs.length;i++)
        if (!/^[0-9a-f]{1,4}$/i.test(segs[i])) return { ok:false, msg:'每段应为 1-4 位十六进制' };
      if (dbl === 0 && segs.length !== 8) return { ok:false, msg:'未压缩的 IPv6 应有 8 段，当前 ' + segs.length + ' 段' };
      if (dbl === 1 && segs.length > 7) return { ok:false, msg:'使用 :: 压缩时段数不能超过 7' };
      return { ok:true };
    }
  },
  mac: {
    label: 'MAC地址', sample: '5489-98a1-0001', color: 'str',
    hint: '格式 XXXX-XXXX-XXXX',
    check: function(v){
      var t = v.replace(/[:.]/g, '-');
      if (/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/i.test(t))
        return { ok:true, canon:t.toLowerCase() };
      return { ok:false, msg:'MAC 格式应为 5489-98a1-0001' };
    }
  },
  areaid: {
    label: '区域ID', sample: '0', color: 'num',
    hint: '十进制 0-4294967295，或点分格式 0.0.0.0',
    check: function(v){
      if (/^\d+$/.test(v)) return (+v <= 4294967295) ? { ok:true } : { ok:false, msg:'区域 ID 超出范围' };
      if (isIp(v)) return { ok:true };
      return { ok:false, msg:'区域 ID 写成 0 或 0.0.0.0' };
    }
  },
  str: {
    label: '字符串', sample: 'to-core', color: 'str',
    hint: '任意文本，可含空格（到行尾）',
    check: function(){ return { ok:true }; }
  }
};

/* ============ 2. 视图定义 ============ */
var VIEWMETA = {
  user:     { name:'用户视图',        tpl:'<{h}>',                          enter:null },
  system:   { name:'系统视图',        tpl:'[{h}]',                          enter:{from:'user', sample:'system-view', syntax:'system-view'} },
  if:       { name:'接口视图',        tpl:'[{h}-{ifName}]', bind:'ifName',
              enter:{from:'system', sample:'interface GigabitEthernet0/0/0', syntax:'interface ⟨接口名⟩'} },
  ethTrunk: { name:'Eth-Trunk 视图',  tpl:'[{h}-Eth-Trunk{trunkId}]', bind:'trunkId',
              enter:{from:'system', sample:'interface Eth-Trunk 1', syntax:'interface Eth-Trunk ⟨编号⟩'} },
  vlan:     { name:'VLAN 视图',       tpl:'[{h}-vlan{vlanId}]', bind:'vlanId',
              enter:{from:'system', sample:'vlan 10', syntax:'vlan ⟨VLAN ID⟩'} },
  ospf:     { name:'OSPF 视图',       tpl:'[{h}-ospf-{ospfPid}]', bind:'ospfPid',
              enter:{from:'system', sample:'ospf 1', syntax:'ospf ⟨进程号⟩'} },
  ospfArea: { name:'OSPF 区域视图',   tpl:'[{h}-ospf-{ospfPid}-area-{areaId}]', bind:'areaId',
              enter:{from:'ospf', sample:'area 0', syntax:'area ⟨区域ID⟩'} },
  isis:     { name:'IS-IS 视图',      tpl:'[{h}-isis-{isisPid}]', bind:'isisPid',
              enter:{from:'system', sample:'isis 1', syntax:'isis ⟨进程号⟩'} },
  bgp:      { name:'BGP 视图',        tpl:'[{h}-bgp]',
              enter:{from:'system', sample:'bgp 100', syntax:'bgp ⟨AS号⟩'} },
  bgpAf:    { name:'BGP IPv4 地址族', tpl:'[{h}-bgp-af-ipv4]',
              enter:{from:'bgp', sample:'ipv4-family unicast', syntax:'ipv4-family unicast'} },
  acl:      { name:'ACL 视图',        tpl:'[{h}-acl-{aclType}-{aclNum}]', bind:'aclNum',
              enter:{from:'system', sample:'acl 3000', syntax:'acl ⟨ACL编号⟩'} },
  pool:     { name:'地址池视图',      tpl:'[{h}-ip-pool-{poolName}]', bind:'poolName',
              enter:{from:'system', sample:'ip pool 1', syntax:'ip pool ⟨地址池名称⟩'} },
  aaa:      { name:'AAA 视图',        tpl:'[{h}-aaa]',
              enter:{from:'system', sample:'aaa', syntax:'aaa'} },
  ui:       { name:'VTY 视图',        tpl:'[{h}-ui-vty0-4]',
              enter:{from:'system', sample:'user-interface vty 0 4', syntax:'user-interface vty ⟨起始⟩ ⟨结束⟩'} },
  mpls:     { name:'MPLS 视图',       tpl:'[{h}-mpls]',
              enter:{from:'system', sample:'mpls', syntax:'mpls'} },
  pim:      { name:'PIM 视图',        tpl:'[{h}-pim]',
              enter:{from:'system', sample:'pim', syntax:'pim'} },
  rp:       { name:'Route-Policy 视图', tpl:'[{h}-route-policy-{rpName}]', bind:'rpName', bindType:'name',
              enter:{from:'system', sample:'route-policy RP1 permit node 10', syntax:'route-policy ⟨名称⟩ permit node ⟨节点号⟩'} },
  stpRegion:{ name:'MST 域视图',     tpl:'[{h}-mst-region]',
              enter:{from:'system', sample:'stp region-configuration', syntax:'stp region-configuration'} },
  ospfv3:   { name:'OSPFv3 视图',    tpl:'[{h}-ospfv3-{ospfv3Pid}]', bind:'ospfv3Pid',
              enter:{from:'system', sample:'ospfv3 1', syntax:'ospfv3 ⟨进程号⟩'} },
  bgp6:     { name:'BGP IPv6 地址族', tpl:'[{h}-bgp-af-ipv6]',
              enter:{from:'bgp', sample:'ipv6-family unicast', syntax:'ipv6-family unicast'} },
  rip:      { name:'RIP 视图',       tpl:'[{h}-rip-{ripPid}]', bind:'ripPid',
              enter:{from:'system', sample:'rip 1', syntax:'rip ⟨进程号⟩'} },
  pbr:      { name:'策略路由视图',   tpl:'[{h}-policy-based-route-{pbrName}]', bind:'pbrName', bindType:'name',
              enter:{from:'system', sample:'policy-based-route PBR1 permit node 10', syntax:'policy-based-route ⟨名称⟩ permit node ⟨节点号⟩'} },
  qosCls:   { name:'流分类视图',     tpl:'[{h}-classifier-{clsName}]', bind:'clsName', bindType:'name',
              enter:{from:'system', sample:'traffic classifier c1 operator or', syntax:'traffic classifier ⟨名称⟩ operator ⟨or|and⟩'} },
  qosBeh:   { name:'流行为视图',     tpl:'[{h}-behavior-{behName}]', bind:'behName',
              enter:{from:'system', sample:'traffic behavior b1', syntax:'traffic behavior ⟨名称⟩'} },
  qosPol:   { name:'流策略视图',     tpl:'[{h}-trafficpolicy-{polName}]', bind:'polName',
              enter:{from:'system', sample:'traffic policy p1', syntax:'traffic policy ⟨名称⟩'} },
  smartLink:{ name:'Smart Link 视图', tpl:'[{h}-smlk-group{slGroup}]', bind:'slGroup',
              enter:{from:'system', sample:'smart-link group 1', syntax:'smart-link group ⟨组号⟩'} },
  rrpp:     { name:'RRPP 域视图',    tpl:'[{h}-rrpp-domain{rrppId}]', bind:'rrppId',
              enter:{from:'system', sample:'rrpp domain 1', syntax:'rrpp domain ⟨域ID⟩'} },
  radius:   { name:'RADIUS 模板视图', tpl:'[{h}-radius-{radiusName}]', bind:'radiusName',
              enter:{from:'system', sample:'radius-server template rd1', syntax:'radius-server template ⟨模板名⟩'} },
  vrf:      { name:'VPN 实例视图',   tpl:'[{h}-vpn-instance-{vrfName}]', bind:'vrfName',
              enter:{from:'system', sample:'ip vpn-instance VPN1', syntax:'ip vpn-instance ⟨名称⟩'} },
  bgpVpn:   { name:'BGP VPNv4 地址族', tpl:'[{h}-bgp-vpnv4]',
              enter:{from:'bgp', sample:'ipv4-family vpnv4', syntax:'ipv4-family vpnv4'} },
  mplsLdp:  { name:'MPLS LDP 视图',  tpl:'[{h}-mpls-ldp]',
              enter:{from:'mpls', sample:'mpls ldp', syntax:'mpls ldp'} },
  msdp:     { name:'MSDP 视图',      tpl:'[{h}-msdp]',
              enter:{from:'system', sample:'msdp', syntax:'msdp'} },
  dhcpv6:   { name:'DHCPv6 地址池视图', tpl:'[{h}-dhcpv6-pool-{pool6Name}]', bind:'pool6Name',
              enter:{from:'system', sample:'dhcpv6 pool p6', syntax:'dhcpv6 pool ⟨名称⟩'} }
};

/* 关键字提示（同一前缀被多条命令复用时，避免提示串味） */
var KEYHELP = {
  display:'查看状态与配置（所有视图可用）', undo:'取消某项配置', ip:'IP 相关', network:'网段 / 宣告',
  peer:'BGP 对等体', source:'匹配源地址', destination:'匹配目的地址', apply:'执行动作', 'if-match':'匹配条件',
  port:'端口相关', vlan:'VLAN 相关', 'route-static':'静态路由', pool:'地址池', 'ipv4-family':'IPv4 地址族',
  'link-type':'链路类型', 'allow-pass':'允许通过的 VLAN', pvid:'端口 PVID', hybrid:'Hybrid 端口',
  ospf:'OSPF 相关', isis:'IS-IS 相关', mpls:'MPLS 相关', vrrp:'VRRP 相关', rule:'ACL 规则',
  protocol:'协议', 'default-port':'端口', stp:'生成树', 'local-user':'本地用户', lease:'租期',
  'traffic-filter':'流量过滤', nat:'地址转换', 'lsp-trigger':'LSP 触发策略', 'static-rp':'静态 RP'
};

/* 全局别名（VRP 本身支持唯一前缀补全，这里只补非前缀式的常用简写） */
var ALIAS = { display:['dis'], interface:['int'], 'system-view':['sys'],
              'current-configuration':['cur'], 'routing-table':['rt'], 'ipv4-family':['af'] };

/* ============ 3. 标准命令库：一行一条，编译成树 ============ */
/* 语法：<类型[范围]{枚举}:语义>   v=所属视图  to=进入视图  out=回显  pop/reset=返回 */
var SPEC = [
  /* ---------------- 用户视图 ---------------- */
  { v:'user', c:'system-view', to:'system', d:'进入系统视图' },
  { v:'user', c:'display version', out:'version', d:'查看设备版本' },
  { v:'user', c:'display current-configuration', out:'config', d:'查看当前配置' },
  { v:'user', c:'display saved-configuration', out:'saved', d:'查看下次启动配置' },
  { v:'user', c:'display clock', out:'clock', d:'查看系统时间' },
  { v:'user', c:'display ip routing-table', out:'route', d:'查看路由表' },
  { v:'user', c:'display ip routing-table protocol <enum{static,ospf,isis,bgp,direct}:路由协议>', out:'route', d:'按协议查看路由' },
  { v:'user', c:'display ip interface brief', out:'ifbrief', d:'查看接口 IP 与状态' },
  { v:'user', c:'display interface <ifname:接口名>', out:'ifdetail', d:'查看接口详细状态' },
  { v:'user', c:'display vlan', out:'vlan', d:'查看 VLAN 信息' },
  { v:'user', c:'display vlan <vlanid:VLAN ID>', out:'vlan', d:'查看指定 VLAN' },
  { v:'user', c:'display port vlan', out:'portvlan', d:'查看端口 VLAN' },
  { v:'user', c:'display mac-address', out:'mac', d:'查看 MAC 地址表' },
  { v:'user', c:'display arp all', out:'arp', d:'查看 ARP 表' },
  { v:'user', c:'display stp brief', out:'stp', d:'查看生成树端口状态' },
  { v:'user', c:'display eth-trunk <num[0-127]:Eth-Trunk编号>', out:'trunk', d:'查看链路聚合组' },
  { v:'user', c:'display ospf peer', out:'ospfpeer', d:'查看 OSPF 邻居' },
  { v:'user', c:'display ospf routing', out:'ospfroute', d:'查看 OSPF 路由' },
  { v:'user', c:'display ospf lsdb', out:'ospflsdb', d:'查看 OSPF 链路状态库' },
  { v:'user', c:'display ospf interface', out:'ospfif', d:'查看 OSPF 接口' },
  { v:'user', c:'display isis peer', out:'isispeer', d:'查看 IS-IS 邻居' },
  { v:'user', c:'display isis route', out:'isisroute', d:'查看 IS-IS 路由' },
  { v:'user', c:'display bgp peer', out:'bgppeer', d:'查看 BGP 邻居' },
  { v:'user', c:'display bgp routing-table', out:'bgproute', d:'查看 BGP 路由' },
  { v:'user', c:'display vrrp', out:'vrrp', d:'查看 VRRP 状态' },
  { v:'user', c:'display ip pool', out:'ippool', d:'查看地址池' },
  { v:'user', c:'display lldp neighbor brief', out:'lldp', d:'查看 LLDP 邻居' },
  { v:'user', c:'display cpu-usage', out:'cpu', d:'查看 CPU 占用' },
  { v:'user', c:'display memory-usage', out:'mem', d:'查看内存占用' },
  { v:'user', c:'display users', out:'users', d:'查看在线用户' },
  { v:'user', c:'display logbuffer', out:'log', d:'查看日志缓冲区' },
  { v:'user', c:'ping <ipv4:目的IP>', out:'ping', d:'连通性测试' },
  { v:'user', c:'ping <ipv4:目的IP> -c <num[1-65535]:报文个数>', out:'ping', d:'指定报文个数' },
  { v:'user', c:'tracert <ipv4:目的IP>', out:'tracert', d:'逐跳路径跟踪' },
  { v:'user', c:'save', out:'save', d:'保存配置' },
  { v:'user', c:'reboot', out:'reboot', d:'重启设备' },
  { v:'user', c:'reset saved-configuration', out:'reset', d:'清除配置文件' },
  { v:'user', c:'screen-length 0 temporary', out:'ok', d:'关闭分屏显示' },

  /* ---------------- 系统视图 ---------------- */
  { v:'system', c:'sysname <name:设备名>', out:'ok', d:'修改设备名',
    info:{ brief:'修改设备名，提示符同步变化。', example:['sysname HCIP-AR1'],
           pitfall:['名字只影响本机显示，不参与任何协议协商'] } },
  { v:'system', c:'clock timezone <name:时区名> add <num[0-12]:偏移小时>', out:'ok', d:'设置时区' },
  { v:'system', c:'header login information <str:登录标语>', out:'ok', d:'配置登录提示信息' },
  { v:'system', c:'interface <ifname:接口名>', to:'if', d:'进入接口视图',
    info:{ brief:'进入指定接口的配置视图。提示符变为 [设备名-接口名]，IP、VLAN、开销都在这里配。',
           example:['interface GigabitEthernet0/0/0','int g 0/0/0','interface Eth-Trunk 1','interface Vlanif 10'],
           pitfall:['必须写槽位编号 GigabitEthernet0/0/0，只写 GigabitEthernet 进不去',
                    '简写 g 0/0/0（中间有空格）和 g0/0/0 都合法',
                    'Eth-Trunk 接口会进入独立的 Eth-Trunk 视图'] } },
  { v:'system', c:'vlan <vlanid:VLAN ID>', to:'vlan', d:'创建并进入 VLAN 视图' },
  { v:'system', c:'vlan batch <vlanlist:VLAN列表>', out:'ok', d:'批量创建 VLAN', rep:true,
    info:{ brief:'一次创建多个 VLAN，可空格分隔或写范围。', example:['vlan batch 10 20 30','vlan batch 10 to 20'],
           pitfall:['已存在的 VLAN 不会报错，直接跳过'] } },
  { v:'system', c:'stp mode <enum{stp,rstp,mstp}:生成树模式>', out:'ok', d:'设置生成树模式',
    info:{ brief:'华为交换机默认 MSTP。RSTP 收敛快，STP 兼容老设备。',
           pitfall:['两端模式不一致会导致端口震荡','改模式会触发一次拓扑收敛'] } },
  { v:'system', c:'stp priority <num[0-61440]:桥优先级>', out:'ok', d:'设置桥优先级' },
  { v:'system', c:'stp root primary', out:'ok', d:'指定本机为根桥' },
  { v:'system', c:'stp bpdu-protection', out:'ok', d:'开启 BPDU 保护' },
  { v:'system', c:'stp edged-port default', out:'ok', d:'端口默认设为边缘端口' },
  { v:'system', c:'lldp enable', out:'ok', d:'开启 LLDP' },
  { v:'system', c:'ip route-static <ipv4:目的网段> <mask:子网掩码> <ipv4:下一跳IP>', out:'route', d:'配置静态路由',
    info:{ brief:'目的网段 + 子网掩码 + 下一跳。默认路由写 0.0.0.0 0.0.0.0，此时下一跳就是网关地址。',
           example:['ip route-static 192.168.2.0 255.255.255.0 10.0.0.2',
                    'ip route-static 0.0.0.0 0.0.0.0 192.168.1.1'],
           pitfall:['第二个参数是子网掩码 255.255.255.0，不是反掩码 0.0.0.255 —— 与 OSPF network、ACL source 相反',
                    '掩码也可写前缀长度 24',
                    '下一跳必须直连可达，否则路由不优'] } },
  { v:'system', c:'ip route-static <ipv4:目的网段> <mask:子网掩码> <ipv4:下一跳IP> preference <num[1-255]:优先级>', out:'route', d:'静态路由指定优先级' },
  { v:'system', c:'undo ip route-static <ipv4:目的网段> <mask:子网掩码> <ipv4:下一跳IP>', out:'ok', d:'删除静态路由' },
  { v:'system', c:'ospf <num[1-65535]:进程号>', to:'ospf', d:'启动 OSPF 进程',
    info:{ brief:'进入 OSPF 视图。进程号本地有效，两端不要求一致。',
           pitfall:['进程号不同不影响建邻接，Router ID 和区域号才影响'] } },
  { v:'system', c:'isis <num[1-65535]:进程号>', to:'isis', d:'启动 IS-IS 进程' },
  { v:'system', c:'bgp <asnum:AS号>', to:'bgp', d:'启动 BGP 进程' },
  { v:'system', c:'acl <aclnum:ACL编号>', to:'acl', d:'创建/进入 ACL 视图',
    info:{ brief:'2000-2999 基本 ACL 只看源地址，3000-3999 高级 ACL 可匹配源/目的/协议/端口。',
           example:['acl 3000','acl 2000'] } },
  { v:'system', c:'ip ip-prefix <name:前缀列表名> permit <ipv4:目的网段> <num[0-32]:掩码长度>', out:'ok', d:'配置前缀列表' },
  { v:'system', c:'route-policy <name:路由策略名> permit node <num[0-65535]:节点号>', to:'rp', d:'创建路由策略节点' },
  { v:'system', c:'dhcp enable', out:'ok', d:'全局开启 DHCP' },
  { v:'system', c:'ip pool <name:地址池名称>', to:'pool', d:'创建全局地址池' },
  { v:'system', c:'aaa', to:'aaa', d:'进入 AAA 视图' },
  { v:'system', c:'user-interface vty 0 4', to:'ui', d:'进入 VTY 用户界面视图' },
  { v:'system', c:'telnet server enable', out:'ok', d:'开启 Telnet 服务' },
  { v:'system', c:'stelnet server enable', out:'ok', d:'开启 STelnet（SSH）服务' },
  { v:'system', c:'ssh user <name:用户名> authentication-type password', out:'ok', d:'配置 SSH 用户认证方式' },
  { v:'system', c:'ntp-service unicast-server <ipv4:NTP服务器地址>', out:'ok', d:'指定 NTP 服务器' },
  { v:'system', c:'snmp-agent', out:'ok', d:'开启 SNMP 代理' },
  { v:'system', c:'info-center enable', out:'ok', d:'开启信息中心' },
  { v:'system', c:'multicast routing-enable', out:'ok', d:'开启组播路由' },
  { v:'system', c:'pim', to:'pim', d:'进入 PIM 视图' },
  { v:'system', c:'mpls lsr-id <ipv4:LSR ID>', out:'ok', d:'配置 MPLS LSR ID' },
  /* `mpls` 本身不记配置：它是「mpls」这个配置块的块头，由块里的内容带出来。
     真机的 current-configuration 里也只有一条 mpls（块头），不会在 sys 那一段再写一遍。 */
  { v:'system', c:'mpls', to:'mpls', d:'全局使能 MPLS（进 MPLS 视图）' },
  { v:'system', c:'quit', pop:true, d:'返回上一级视图' },
  { v:'system', c:'return', reset:true, d:'直接回到用户视图' },

  /* ---------------- 接口视图 ---------------- */
  { v:'if', c:'ip address <ipv4:接口IP地址> <mask:子网掩码>', out:'ok', d:'配置接口 IP 地址',
    info:{ brief:'给接口配 IPv4 地址。命令必须在接口视图下执行，所以是两层结构：先 interface 进视图，再 ip address 配地址。',
           example:['ip address 192.168.1.254 255.255.255.0','ip add 192.168.1.254 24'],
           pitfall:['掩码必须连续：255.255.255.0 ✔，255.0.255.0 ✘',
                    '第二个地址要加 sub：ip address 10.1.1.1 24 sub',
                    '配完地址接口 Protocol 才会 up'] } },
  { v:'if', c:'ip address <ipv4:接口IP地址> <mask:子网掩码> sub', out:'ok', d:'配置从 IP 地址' },
  { v:'if', c:'undo ip address', out:'ok', d:'删除接口 IP 地址' },
  { v:'if', c:'shutdown', out:'ok', d:'关闭接口' },
  { v:'if', c:'undo shutdown', out:'ok', d:'开启接口' },
  { v:'if', c:'description <str:描述文本>', out:'ok', d:'接口描述' },
  { v:'if', c:'mtu <num[46-9600]:MTU值>', out:'ok', d:'设置接口 MTU' },
  { v:'if', c:'speed <enum{10,100,1000,auto}:速率>', out:'ok', d:'设置接口速率' },
  { v:'if', c:'duplex <enum{full,half,auto}:双工模式>', out:'ok', d:'设置双工模式' },
  { v:'if', c:'negotiation auto', out:'ok', d:'配置自协商' },
  { v:'if', c:'port link-type <enum{access,trunk,hybrid}:链路类型>', out:'ok', d:'设置端口链路类型',
    info:{ brief:'access 接终端只属于一个 VLAN；trunk 接交换机可透传多个 VLAN；hybrid 最灵活，可配置标签。',
           pitfall:['改 link-type 会清掉该端口原有的 VLAN 配置',
                    'trunk 口默认 PVID 是 VLAN 1'] } },
  { v:'if', c:'port default vlan <vlanid:VLAN ID>', out:'ok', d:'设置 access 端口缺省 VLAN' },
  { v:'if', c:'port trunk allow-pass vlan <vlanlist:VLAN列表>', out:'ok', d:'trunk 放行指定 VLAN', rep:true },
  { v:'if', c:'port trunk allow-pass vlan all', out:'ok', d:'trunk 放行所有 VLAN' },
  { v:'if', c:'port trunk pvid vlan <vlanid:VLAN ID>', out:'ok', d:'设置 trunk 口 PVID' },
  { v:'if', c:'port hybrid pvid vlan <vlanid:VLAN ID>', out:'ok', d:'设置 hybrid 口 PVID' },
  { v:'if', c:'port hybrid untagged vlan <vlanlist:VLAN列表>', out:'ok', d:'hybrid 去标签放行', rep:true },
  { v:'if', c:'port hybrid tagged vlan <vlanlist:VLAN列表>', out:'ok', d:'hybrid 带标签放行', rep:true },
  { v:'if', c:'port-isolate enable', out:'ok', d:'开启端口隔离' },
  { v:'if', c:'eth-trunk <num[0-127]:Eth-Trunk编号>', out:'ok', d:'加入链路聚合组' },
  { v:'if', c:'stp edged-port enable', out:'ok', d:'配置边缘端口' },
  { v:'if', c:'stp cost <num[1-200000000]:路径开销>', out:'ok', d:'配置端口路径开销' },
  { v:'if', c:'stp root-protection', out:'ok', d:'配置根保护' },
  { v:'if', c:'stp loop-protection', out:'ok', d:'配置环路保护' },
  { v:'if', c:'ospf cost <num[1-65535]:接口开销>', out:'ok', d:'配置 OSPF 接口开销' },
  { v:'if', c:'ospf dr-priority <num[0-255]:DR优先级>', out:'ok', d:'配置 DR 优先级' },
  { v:'if', c:'ospf network-type <enum{broadcast,nbma,p2p,p2mp}:网络类型>', out:'ok', d:'配置 OSPF 网络类型' },
  { v:'if', c:'ospf timer hello <num[1-65535]:Hello间隔>', out:'ok', d:'配置 Hello 间隔' },
  { v:'if', c:'ospf authentication-mode md5 <num[1-255]:密钥ID> cipher <str:密钥>', out:'ok', d:'配置 OSPF 接口认证' },
  { v:'if', c:'isis enable <num[1-65535]:进程号>', out:'ok', d:'接口启用 IS-IS' },
  { v:'if', c:'isis circuit-type <enum{p2p,broadcast}:电路类型>', out:'ok', d:'配置 IS-IS 电路类型' },
  { v:'if', c:'isis cost <num[1-16777215]:接口开销>', out:'ok', d:'配置 IS-IS 接口开销' },
  { v:'if', c:'pim sm', out:'ok', d:'接口启用 PIM-SM' },
  { v:'if', c:'igmp version <num[1-3]:IGMP版本>', out:'ok', d:'配置 IGMP 版本' },
  { v:'if', c:'mpls', out:'ok', d:'接口启用 MPLS' },
  { v:'if', c:'mpls ldp', out:'ok', d:'接口启用 MPLS LDP' },
  { v:'if', c:'dhcp select global', out:'ok', d:'接口使用全局地址池' },
  { v:'if', c:'traffic-filter inbound acl <aclnum:ACL编号>', out:'ok', d:'入方向流量过滤' },
  { v:'if', c:'nat outbound <aclnum:ACL编号>', out:'ok', d:'NAT 出方向地址转换',
    info:{ brief:'把匹配 ACL 的内网流量做源地址转换（Easy IP）。',
           example:['nat outbound 2000'],
           pitfall:['ACL 里写的是内网网段，不是公网地址','出口接口必须配了公网 IP'] } },
  { v:'if', c:'nat server protocol tcp global <ipv4:公网地址> <num[1-65535]:公网端口> inside <ipv4:私网地址> <num[1-65535]:私网端口>', out:'ok', d:'NAT 服务器映射' },
  { v:'if', c:'vrrp vrid <num[1-255]:备份组号> virtual-ip <ipv4:虚拟IP地址>', out:'ok', d:'配置 VRRP 虚拟 IP',
    info:{ brief:'两台设备用同一个虚拟 IP 做网关，主备切换由 VRRP 完成。',
           pitfall:['虚拟 IP 必须与接口真实 IP 同网段','同一备份组的两台设备 vrid 必须一致'] } },
  { v:'if', c:'vrrp vrid <num[1-255]:备份组号> priority <num[1-254]:优先级>', out:'ok', d:'配置 VRRP 优先级' },
  { v:'if', c:'vrrp vrid <num[1-255]:备份组号> preempt-mode', out:'ok', d:'配置 VRRP 抢占' },
  { v:'if', c:'vrrp vrid <num[1-255]:备份组号> track interface <ifname:被监视接口> reduced <num[1-255]:优先级降低值>', out:'ok', d:'VRRP 监视上行接口' },
  { v:'if', c:'quit', pop:true, d:'返回系统视图' },
  { v:'if', c:'return', reset:true, d:'直接回到用户视图' },

  /* ---------------- Eth-Trunk 视图 ---------------- */
  { v:'ethTrunk', c:'mode <enum{lacp-static,manual,normal}:工作模式>', out:'ok', d:'设置聚合模式',
    info:{ brief:'LACP 模式会协商，链路故障感知快；手工模式不协商，两端必须都配。',
           pitfall:['两端模式必须一致（LACP ↔ LACP，手工 ↔ 手工）'] } },
  { v:'ethTrunk', c:'trunkport <ifname:成员接口>', out:'ok', d:'加入成员接口' },
  { v:'ethTrunk', c:'lacp priority <num[0-65535]:系统优先级>', out:'ok', d:'设置 LACP 系统优先级' },
  { v:'ethTrunk', c:'lacp max active-linknumber <num[1-16]:最大活动链路数>', out:'ok', d:'设置最大活动链路数' },
  { v:'ethTrunk', c:'load-balance <enum{src-dst-ip,src-dst-mac,dst-ip,src-ip}:负载分担方式>', out:'ok', d:'设置负载分担方式' },
  { v:'ethTrunk', c:'quit', pop:true, d:'返回系统视图' },

  /* ---------------- VLAN 视图 ---------------- */
  { v:'vlan', c:'description <str:描述文本>', out:'ok', d:'VLAN 描述' },
  { v:'vlan', c:'port <ifname:接口名>', out:'ok', d:'把接口加入本 VLAN' },
  { v:'vlan', c:'quit', pop:true, d:'返回系统视图' },

  /* ---------------- OSPF 视图 ---------------- */
  { v:'ospf', c:'router-id <ipv4:Router ID>', out:'ok', d:'配置 Router ID',
    info:{ brief:'OSPF 的标识，格式是 IP 地址但可以随便写。',
           pitfall:['不配则自动选最大的 Loopback 地址，再选最大的物理接口地址','改动后需 reset ospf process 才生效'] } },
  { v:'ospf', c:'area <areaid:区域ID>', to:'ospfArea', d:'进入 OSPF 区域视图' },
  { v:'ospf', c:'silent-interface <ifname:接口名>', out:'ok', d:'配置静默接口' },
  { v:'ospf', c:'import-route <enum{direct,static,isis,bgp}:引入路由类型>', out:'ok', d:'引入外部路由' },
  { v:'ospf', c:'default-route-advertise', out:'ok', d:'下发默认路由' },
  { v:'ospf', c:'bandwidth-reference <num[1-10000]:带宽参考值>', out:'ok', d:'配置带宽参考值' },
  { v:'ospf', c:'quit', pop:true, d:'返回系统视图' },
  { v:'ospf', c:'return', reset:true, d:'直接回到用户视图' },

  /* ---------------- OSPF 区域视图 ---------------- */
  { v:'ospfArea', c:'network <ipv4:目的网段> <wildcard:反掩码>', out:'ok', d:'宣告网段',
    info:{ brief:'把网段宣告进 OSPF。这里用反掩码（wildcard），不是子网掩码。',
           example:['network 192.168.1.0 0.0.0.255','network 10.0.0.0 0.0.0.255'],
           pitfall:['写成 network 192.168.1.0 255.255.255.0 是最常见的错误 —— 那是子网掩码',
                    '0.0.0.255 等价于子网掩码 255.255.255.0',
                    '反掩码必须与连续掩码互补，0.0.255.0 这种交叉位非法'] } },
  { v:'ospfArea', c:'authentication-mode <enum{simple,md5,hmac-sha256}:认证模式>', out:'ok', d:'区域认证' },
  { v:'ospfArea', c:'stub', out:'ok', d:'配置为 Stub 区域' },
  { v:'ospfArea', c:'nssa', out:'ok', d:'配置为 NSSA 区域' },
  { v:'ospfArea', c:'abr-summary <ipv4:汇总网段> <mask:子网掩码>', out:'ok', d:'区域间路由汇总' },
  { v:'ospfArea', c:'vlink-peer <ipv4:虚连接邻居>', out:'ok', d:'配置虚连接' },
  { v:'ospfArea', c:'quit', pop:true, d:'返回 OSPF 视图' },

  /* ---------------- IS-IS 视图 ---------------- */
  { v:'isis', c:'network-entity <str:NET地址>', out:'ok', d:'配置 NET 地址',
    info:{ brief:'NET 由区域号 + System ID + SEL 组成，例如 49.0001.0000.0000.0001.00。',
           pitfall:['同一区域内的区域号必须一致','System ID 必须唯一，通常用 Loopback 地址补齐'] } },
  { v:'isis', c:'is-level <enum{level-1,level-2,level-1-2}:路由器级别>', out:'ok', d:'配置路由器级别' },
  { v:'isis', c:'cost-style <enum{narrow,wide,compatible}:开销类型>', out:'ok', d:'配置开销类型' },
  { v:'isis', c:'quit', pop:true, d:'返回系统视图' },
  { v:'isis', c:'return', reset:true, d:'直接回到用户视图' },

  /* ---------------- BGP 视图 ---------------- */
  { v:'bgp', c:'router-id <ipv4:Router ID>', out:'ok', d:'配置 BGP Router ID' },
  { v:'bgp', c:'peer <ipv4:邻居IP> as-number <asnum:对端AS号>', out:'ok', d:'指定对等体及 AS 号',
    info:{ brief:'建立 BGP 邻居的第一步：指定对端地址和它所在的 AS。',
           pitfall:['本端写的对端 AS 必须与对端真实 AS 一致，否则 Idle','iBGP 邻居两端 AS 号相同'] } },
  { v:'bgp', c:'peer <ipv4:邻居IP> connect-interface <ifname:源接口>', out:'ok', d:'指定建立邻居的源接口' },
  { v:'bgp', c:'peer <ipv4:邻居IP> next-hop-local', out:'ok', d:'下一跳指向本机' },
  { v:'bgp', c:'peer <ipv4:邻居IP> ebgp-max-hop <num[1-255]:最大跳数>', out:'ok', d:'配置 EBGP 最大跳数' },
  { v:'bgp', c:'peer <ipv4:邻居IP> password cipher <str:密码>', out:'ok', d:'配置 BGP 认证' },
  { v:'bgp', c:'group <name:对等体组名> external', out:'ok', d:'创建 EBGP 对等体组' },
  { v:'bgp', c:'preference <num[1-255]:优先级>', out:'ok', d:'修改 BGP 路由优先级' },
  { v:'bgp', c:'ipv4-family unicast', to:'bgpAf', d:'进入 IPv4 单播地址族' },
  { v:'bgp', c:'quit', pop:true, d:'返回系统视图' },
  { v:'bgp', c:'return', reset:true, d:'直接回到用户视图' },

  /* ---------------- BGP IPv4 地址族 ---------------- */
  { v:'bgpAf', c:'network <ipv4:目的网段> <mask:子网掩码>', out:'ok', d:'宣告网段',
    info:{ brief:'把路由表里已有的精确路由宣告进 BGP。',
           pitfall:['掩码必须与路由表完全一致，/24 不能宣告成 /16','路由表里没有这条路由则宣告无效'] } },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> enable', out:'ok', d:'在地址族下激活邻居' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> next-hop-local', out:'ok', d:'下一跳指向本机' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> route-policy <name:路由策略名> export', out:'ok', d:'对邻居应用出方向策略' },
  { v:'bgpAf', c:'aggregate <ipv4:聚合网段> <mask:子网掩码>', out:'ok', d:'路由聚合' },
  { v:'bgpAf', c:'reflect-client', out:'ok', d:'配置路由反射器客户端' },
  { v:'bgpAf', c:'quit', pop:true, d:'返回 BGP 视图' },

  /* ---------------- ACL 视图 ---------------- */
  { v:'acl', c:'rule <num[0-65534]:规则编号> <enum{permit,deny}:动作> source <ipv4:源网段地址> <wildcard:反掩码>', out:'ok', d:'匹配源地址',
    info:{ brief:'ACL 用「网段 + 反掩码」描述范围：0 的位必须匹配，1 的位忽略。',
           example:['rule 5 permit source 192.168.1.0 0.0.0.255','rule 10 deny source 10.0.0.0 0.0.0.255'],
           pitfall:['source 后是反掩码 0.0.0.255，写成 255.255.255.0 会被拒绝',
                    '只匹配单台主机可写 0.0.0.0，或 rule 5 permit source 192.168.1.1 0'] } },
  { v:'acl', c:'rule <num[0-65534]:规则编号> <enum{permit,deny}:动作> destination <ipv4:目的网段地址> <wildcard:反掩码>', out:'ok', d:'匹配目的地址' },
  { v:'acl', c:'rule <num[0-65534]:规则编号> <enum{permit,deny}:动作> source <ipv4:源网段地址> <wildcard:反掩码> destination <ipv4:目的网段地址> <wildcard:反掩码>', out:'ok', d:'同时匹配源和目的' },
  { v:'acl', c:'rule <num[0-65534]:规则编号> <enum{permit,deny}:动作> protocol <enum{tcp,udp,icmp,ip}:协议> destination-port eq <num[0-65535]:端口号>', out:'ok', d:'匹配协议与端口' },
  { v:'acl', c:'quit', pop:true, d:'返回系统视图' },

  /* ---------------- DHCP 地址池视图 ---------------- */
  { v:'pool', c:'network <ipv4:网段地址> mask <mask:子网掩码>', out:'ok', d:'指定可分配网段',
    info:{ brief:'声明这个地址池能分配哪个网段。',
           pitfall:['mask 是关键字，后面跟子网掩码，不是反掩码'] } },
  { v:'pool', c:'gateway-list <ipv4:网关地址>', out:'ok', d:'指定下发的网关地址',
    info:{ brief:'下发给客户端的默认网关，通常就是本机连接该网段的接口地址。',
           pitfall:['网关必须与 network 声明的网段同网段','这里是「网关」不是「下一跳」，会被写进客户端默认路由'] } },
  { v:'pool', c:'dns-list <ipv4:DNS服务器地址>', out:'ok', d:'指定下发的 DNS' },
  { v:'pool', c:'lease day <num[1-999]:租期天数>', out:'ok', d:'配置地址租期' },
  { v:'pool', c:'excluded-ip-address <ipv4:起始IP> <ipv4:结束IP>', out:'ok', d:'排除不分配的地址' },
  { v:'pool', c:'static-bind ip-address <ipv4:绑定IP> mac-address <mac:MAC地址>', out:'ok', d:'静态绑定 IP 与 MAC' },
  { v:'pool', c:'quit', pop:true, d:'返回系统视图' },

  /* ---------------- AAA 视图 ---------------- */
  { v:'aaa', c:'local-user <name:用户名> password cipher <str:密码>', out:'ok', d:'创建本地用户并设密码' },
  { v:'aaa', c:'local-user <name:用户名> privilege level <num[0-15]:权限级别>', out:'ok', d:'设置用户权限级别' },
  { v:'aaa', c:'local-user <name:用户名> service-type <enum{telnet,ssh,ftp,http}:服务类型>', out:'ok', d:'设置用户服务类型' },
  { v:'aaa', c:'authentication-scheme <name:认证方案名>', out:'ok', d:'创建认证方案' },
  { v:'aaa', c:'quit', pop:true, d:'返回系统视图' },

  /* ---------------- VTY 视图 ---------------- */
  { v:'ui', c:'authentication-mode <enum{password,aaa,none}:认证模式>', out:'ok', d:'设置登录认证方式' },
  { v:'ui', c:'protocol inbound <enum{telnet,ssh,all}:接入协议>', out:'ok', d:'限制接入协议' },
  { v:'ui', c:'user privilege level <num[0-15]:权限级别>', out:'ok', d:'设置用户级别' },
  { v:'ui', c:'idle-timeout <num[0-35791]:超时分钟>', out:'ok', d:'设置空闲超时' },
  { v:'ui', c:'quit', pop:true, d:'返回系统视图' },

  /* ---------------- MPLS / PIM / Route-Policy ---------------- */
  { v:'mpls', c:'lsp-trigger <enum{all,host,ip-prefix}:LSP触发策略>', out:'ok', d:'配置 LSP 触发策略' },
  { v:'mpls', c:'quit', pop:true, d:'返回系统视图' },
  { v:'pim', c:'static-rp <ipv4:静态RP地址>', out:'ok', d:'配置静态 RP' },
  { v:'pim', c:'quit', pop:true, d:'返回系统视图' },
  { v:'rp', c:'if-match acl <aclnum:ACL编号>', out:'ok', d:'匹配 ACL' },
  { v:'rp', c:'if-match ip-prefix <name:前缀列表名>', out:'ok', d:'匹配前缀列表' },
  { v:'rp', c:'apply cost <num[1-65535]:开销值>', out:'ok', d:'设置开销' },
  { v:'rp', c:'apply preference <num[1-255]:优先级>', out:'ok', d:'设置优先级' },
  { v:'rp', c:'apply ip-address next-hop <ipv4:下一跳IP>', out:'ok', d:'设置下一跳' },
  { v:'rp', c:'quit', pop:true, d:'返回系统视图' }
];

/* 第二批：排错查询、undo 形态、安全与组播等常用命令 */
var SPEC_MORE = [
  /* 用户视图 · 查询与排错 */
  { v:'user', c:'display interface brief', out:'ifbrief', d:'查看所有接口状态' },
  { v:'user', c:'display ip interface', out:'ifdetail', d:'查看接口 IP 参数' },
  { v:'user', c:'display mac-address vlan <vlanid:VLAN ID>', out:'mac', d:'按 VLAN 查看 MAC 表' },
  { v:'user', c:'display stp', out:'stp', d:'查看生成树详细信息' },
  { v:'user', c:'display stp region-configuration', out:'stp', d:'查看 MST 域配置' },
  { v:'user', c:'display lldp neighbor', out:'lldp', d:'查看 LLDP 邻居详情' },
  { v:'user', c:'display ntp-service status', out:'ntp', d:'查看 NTP 同步状态' },
  { v:'user', c:'display snmp-agent sys-info', out:'snmp', d:'查看 SNMP 信息' },
  { v:'user', c:'display ip pool name <name:地址池名称>', out:'ippool', d:'查看指定地址池' },
  { v:'user', c:'display acl <aclnum:ACL编号>', out:'acl', d:'查看 ACL 规则' },
  { v:'user', c:'display nat session all', out:'natsession', d:'查看 NAT 会话表' },
  { v:'user', c:'display vrrp brief', out:'vrrp', d:'查看 VRRP 简要状态' },
  { v:'user', c:'display ospf brief', out:'ospfpeer', d:'查看 OSPF 进程概要' },
  { v:'user', c:'display ospf error', out:'ospferror', d:'查看 OSPF 错误统计' },
  { v:'user', c:'display isis lsdb', out:'ospflsdb', d:'查看 IS-IS 链路状态库' },
  { v:'user', c:'display bgp routing-table peer <ipv4:邻居IP> advertised-routes', out:'bgproute', d:'查看向邻居发布的路由' },
  { v:'user', c:'display ip routing-table verbose', out:'route', d:'查看路由表详细信息' },
  { v:'user', c:'display current-configuration configuration <enum{ospf,bgp,isis}:模块>', out:'config', d:'按模块查看配置' },
  { v:'user', c:'display device', out:'device', d:'查看设备单板信息' },
  { v:'user', c:'display temperature', out:'temp', d:'查看设备温度' },
  { v:'user', c:'display startup', out:'startup', d:'查看启动配置' },
  { v:'user', c:'terminal monitor', out:'ok', d:'开启终端告警显示' },
  { v:'user', c:'undo terminal monitor', out:'ok', d:'关闭终端告警显示' },
  { v:'user', c:'reset counters interface <ifname:接口名>', out:'ok', d:'清除接口计数' },

  /* 系统视图 · 路由与基础服务 */
  { v:'system', c:'ip route-static <ipv4:目的网段> <mask:子网掩码> <ifname:出接口>', out:'route', d:'静态路由只指出接口' },
  { v:'system', c:'ip route-static <ipv4:目的网段> <mask:子网掩码> <ifname:出接口> <ipv4:下一跳IP>', out:'route', d:'静态路由出接口 + 下一跳' },
  { v:'system', c:'arp static <ipv4:IP地址> <mac:MAC地址>', out:'ok', d:'配置静态 ARP' },
  { v:'system', c:'dns resolve', out:'ok', d:'开启 DNS 解析' },
  { v:'system', c:'dns server <ipv4:DNS服务器地址>', out:'ok', d:'指定 DNS 服务器' },
  { v:'system', c:'ftp server enable', out:'ok', d:'开启 FTP 服务' },
  { v:'system', c:'sftp server enable', out:'ok', d:'开启 SFTP 服务' },
  { v:'system', c:'ssh authentication-type default password', out:'ok', d:'SSH 默认认证方式' },
  { v:'system', c:'user-interface maximum-vty <num[1-15]:最大VTY数>', out:'ok', d:'设置最大 VTY 数' },
  { v:'system', c:'ntp-service enable', out:'ok', d:'开启 NTP' },
  { v:'system', c:'ntp-service unicast-peer <ipv4:对端地址>', out:'ok', d:'指定 NTP 对等体' },
  { v:'system', c:'snmp-agent sys-info version <enum{v1,v2c,v3}:SNMP版本>', out:'ok', d:'设置 SNMP 版本' },
  { v:'system', c:'snmp-agent community read cipher <str:团体名>', out:'ok', d:'配置 SNMP 读团体名' },
  { v:'system', c:'info-center loghost <ipv4:日志服务器地址>', out:'ok', d:'指定日志服务器' },
  { v:'system', c:'header shell information <str:标语>', out:'ok', d:'配置登录后提示' },
  { v:'system', c:'stp region-configuration', to:'stpRegion', d:'进入 MST 域视图' },
  { v:'system', c:'stp instance <num[0-4094]:实例ID> priority <num[0-61440]:优先级>', out:'ok', d:'设置实例桥优先级' },
  { v:'system', c:'radius-server template <name:模板名>', out:'ok', d:'创建 RADIUS 模板' },
  { v:'system', c:'domain <name:域名>', out:'ok', d:'创建域' },
  { v:'system', c:'undo ip route-static <ipv4:目的网段> <mask:子网掩码> <ipv4:下一跳IP>', out:'ok', d:'删除静态路由' },

  /* 接口视图 · 安全与组播 */
  { v:'if', c:'traffic-filter outbound acl <aclnum:ACL编号>', out:'ok', d:'出方向流量过滤' },
  { v:'if', c:'port-security enable', out:'ok', d:'开启端口安全' },
  { v:'if', c:'port-security max-mac-num <num[1-4096]:最大MAC数>', out:'ok', d:'限制学习 MAC 数量' },
  { v:'if', c:'port-security protect-action <enum{protect,restrict,shutdown}:保护动作>', out:'ok', d:'端口安全违规动作' },
  { v:'if', c:'storm-control broadcast min-rate <num[1-100000]:pps>', out:'ok', d:'广播风暴抑制' },
  { v:'if', c:'dhcp select relay', out:'ok', d:'接口使用 DHCP 中继' },
  { v:'if', c:'dhcp relay server-ip <ipv4:DHCP服务器地址>', out:'ok', d:'指定 DHCP 服务器' },
  { v:'if', c:'dhcp snooping enable', out:'ok', d:'开启 DHCP Snooping' },
  { v:'if', c:'dhcp snooping trusted', out:'ok', d:'设置信任接口' },
  { v:'if', c:'stp port priority <num[0-240]:端口优先级>', out:'ok', d:'设置端口优先级' },
  { v:'if', c:'stp edged-port disable', out:'ok', d:'取消边缘端口' },
  { v:'if', c:'undo port default vlan', out:'ok', d:'恢复缺省 VLAN' },
  { v:'if', c:'undo port trunk allow-pass vlan <vlanlist:VLAN列表>', out:'ok', d:'取消 trunk 放行', rep:true },
  { v:'if', c:'undo vrrp vrid <num[1-255]:备份组号>', out:'ok', d:'删除 VRRP 备份组' },

  /* OSPF */
  { v:'ospf', c:'default-route-advertise always', out:'ok', d:'强制下发默认路由' },
  { v:'ospf', c:'import-route <enum{direct,static,isis,bgp}:引入路由类型> cost <num[0-16777214]:开销>', out:'ok', d:'引入路由并指定开销' },
  { v:'ospf', c:'silent-interface all', out:'ok', d:'全部接口静默' },
  { v:'ospf', c:'undo silent-interface <ifname:接口名>', out:'ok', d:'取消接口静默' },
  { v:'ospf', c:'undo area <areaid:区域ID>', out:'ok', d:'删除区域' },

  /* OSPF 区域 */
  { v:'ospfArea', c:'default-cost <num[0-16777214]:默认开销>', out:'ok', d:'设置 Stub 默认开销' },
  { v:'ospfArea', c:'stub no-summary', out:'ok', d:'完全 Stub 区域' },
  { v:'ospfArea', c:'nssa default-route-advertise', out:'ok', d:'NSSA 下发默认路由' },
  { v:'ospfArea', c:'filter <ipv4:过滤网段> <wildcard:反掩码>', out:'ok', d:'区域间路由过滤' },
  { v:'ospfArea', c:'undo network <ipv4:目的网段> <wildcard:反掩码>', out:'ok', d:'取消网段宣告' },

  /* IS-IS */
  { v:'isis', c:'is-name <name:动态主机名>', out:'ok', d:'配置动态主机名' },
  { v:'isis', c:'timer hello <num[1-65535]:Hello间隔>', out:'ok', d:'配置 Hello 间隔' },
  { v:'isis', c:'authentication-mode md5 <str:密码>', out:'ok', d:'配置区域认证' },
  { v:'isis', c:'import-route <enum{direct,static,ospf,bgp}:引入路由>', out:'ok', d:'引入外部路由' },
  { v:'isis', c:'summary <ipv4:汇总网段> <mask:子网掩码>', out:'ok', d:'路由聚合' },

  /* BGP */
  { v:'bgp', c:'peer <ipv4:邻居IP> route-policy <name:路由策略名> import', out:'ok', d:'对邻居应用入方向策略' },
  { v:'bgp', c:'peer <ipv4:邻居IP> filter-policy <aclnum:ACL编号> export', out:'ok', d:'按 ACL 过滤发布路由' },
  { v:'bgp', c:'peer <ipv4:邻居IP> description <str:描述>', out:'ok', d:'邻居描述' },
  { v:'bgp', c:'peer <ipv4:邻居IP> timer keepalive <num[0-21845]:保活秒> hold <num[0-65535]:保持秒>', out:'ok', d:'配置 BGP 定时器' },
  { v:'bgp', c:'peer <ipv4:邻居IP> valid-ttl-hops <num[1-255]:跳数>', out:'ok', d:'配置 TTL 安全' },
  { v:'bgp', c:'dampening', out:'ok', d:'开启路由振荡抑制' },
  { v:'bgp', c:'undo peer <ipv4:邻居IP>', out:'ok', d:'删除 BGP 邻居' },

  /* BGP 地址族 */
  { v:'bgpAf', c:'peer <ipv4:邻居IP> route-policy <name:路由策略名> import', out:'ok', d:'地址族入方向策略' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> filter-policy <aclnum:ACL编号> export', out:'ok', d:'地址族发布过滤' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> allow-as-loop <num[1-10]:允许次数>', out:'ok', d:'允许 AS 号重复' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> substitute-as', out:'ok', d:'AS 号替换' },

  /* ACL */
  { v:'acl', c:'rule <num[0-65534]:规则编号> <enum{permit,deny}:动作> protocol <enum{tcp,udp,icmp,ip}:协议> source <ipv4:源网段地址> <wildcard:反掩码> destination <ipv4:目的网段地址> <wildcard:反掩码>', out:'ok', d:'五元组匹配' },
  { v:'acl', c:'step <num[1-20]:步长>', out:'ok', d:'设置规则步长' },
  { v:'acl', c:'description <str:描述>', out:'ok', d:'ACL 描述' },
  { v:'acl', c:'undo rule <num[0-65534]:规则编号>', out:'ok', d:'删除规则' },

  /* 地址池 */
  { v:'pool', c:'netbios-name-server <ipv4:NetBIOS服务器>', out:'ok', d:'下发 NetBIOS 服务器' },
  { v:'pool', c:'domain-name <str:域名>', out:'ok', d:'下发域名' },
  { v:'pool', c:'option <num[1-254]:选项码> <str:选项值>', out:'ok', d:'自定义 DHCP 选项' },

  /* AAA / VTY */
  { v:'aaa', c:'local-user <name:用户名> idle-timeout <num[0-35791]:分钟>', out:'ok', d:'设置用户空闲超时' },
  { v:'aaa', c:'authorization-scheme <name:授权方案名>', out:'ok', d:'创建授权方案' },
  { v:'aaa', c:'accounting-scheme <name:计费方案名>', out:'ok', d:'创建计费方案' },
  { v:'aaa', c:'undo local-user <name:用户名>', out:'ok', d:'删除本地用户' },
  { v:'ui', c:'history-command max-size <num[0-256]:条数>', out:'ok', d:'设置历史命令条数' },
  { v:'ui', c:'screen-length <num[0-512]:行数>', out:'ok', d:'设置每屏行数' },
  { v:'ui', c:'undo idle-timeout', out:'ok', d:'恢复默认超时' },

  /* Route-Policy */
  { v:'rp', c:'if-match cost <num[1-16777215]:开销>', out:'ok', d:'匹配路由开销' },
  { v:'rp', c:'if-match tag <num[1-4294967295]:Tag值>', out:'ok', d:'匹配路由 Tag' },
  { v:'rp', c:'apply tag <num[1-4294967295]:Tag值>', out:'ok', d:'设置路由 Tag' },
  { v:'rp', c:'apply local-preference <num[0-4294967295]:本地优先级>', out:'ok', d:'设置本地优先级' },

  /* MST 域 */
  { v:'stpRegion', c:'region-name <name:域名>', out:'ok', d:'设置 MST 域名' },
  { v:'stpRegion', c:'instance <num[0-4094]:实例ID> vlan <vlanlist:VLAN列表>', out:'ok', d:'实例映射 VLAN', rep:true },
  { v:'stpRegion', c:'revision-level <num[0-65535]:修订级别>', out:'ok', d:'设置修订级别' },
  { v:'stpRegion', c:'active region-configuration', out:'ok', d:'激活域配置' },
  { v:'stpRegion', c:'quit', pop:true, d:'返回系统视图' },

  /* MPLS / PIM */
  { v:'mpls', c:'static-lsp ingress <name:LSP名> destination <ipv4:目的网段> <num[0-32]:掩码长度> nexthop <ipv4:下一跳IP> out-label <num[0-1048575]:出标签>', out:'ok', d:'配置静态 LSP' },
  { v:'pim', c:'c-bsr <ifname:接口名>', out:'ok', d:'配置候选 BSR' },
  { v:'pim', c:'c-rp <ifname:接口名>', out:'ok', d:'配置候选 RP' }
];
/* 第三批：undo 形态、排错查询、二层安全、路由策略细节 */
var SPEC_MORE2 = [
  /* 用户视图 · 查询与排错 */
  { v:'user', c:'display this', out:'config', d:'查看当前视图下的配置' },
  { v:'user', c:'display current-configuration interface <ifname:接口名>', out:'config', d:'查看指定接口配置' },
  { v:'user', c:'display ip routing-table statistics', out:'route', d:'查看路由统计' },
  { v:'user', c:'display ip routing-table acl <aclnum:ACL编号>', out:'route', d:'查看匹配 ACL 的路由' },
  { v:'user', c:'display fib', out:'route', d:'查看 FIB 表' },
  { v:'user', c:'display arp statistics all', out:'arp', d:'查看 ARP 统计' },
  { v:'user', c:'display mac-address aging-time', out:'mac', d:'查看 MAC 老化时间' },
  { v:'user', c:'display mac-address blackhole', out:'mac', d:'查看黑洞 MAC' },
  { v:'user', c:'display port-isolate group all', out:'portvlan', d:'查看端口隔离组' },
  { v:'user', c:'display storm-control interface all', out:'ifbrief', d:'查看风暴抑制' },
  { v:'user', c:'display dhcp snooping user-bind all', out:'arp', d:'查看 DHCP Snooping 绑定表' },
  { v:'user', c:'display transceiver interface <ifname:接口名>', out:'transceiver', d:'查看光模块信息' },
  { v:'user', c:'display interface <ifname:接口名> counters', out:'ifdetail', d:'查看接口收发计数' },
  { v:'user', c:'display ospf vlink', out:'ospfpeer', d:'查看虚连接状态' },
  { v:'user', c:'display bgp network', out:'bgproute', d:'查看 BGP 宣告的网段' },
  { v:'user', c:'display bgp peer verbose', out:'bgppeer', d:'查看 BGP 邻居详情' },
  { v:'user', c:'display isis interface', out:'isispeer', d:'查看 IS-IS 接口' },
  { v:'user', c:'display mpls lsp', out:'mplslsp', d:'查看 LSP 表' },
  { v:'user', c:'display mpls ldp session', out:'mplslsp', d:'查看 LDP 会话' },
  { v:'user', c:'display pim neighbor', out:'pim', d:'查看 PIM 邻居' },
  { v:'user', c:'display igmp group', out:'pim', d:'查看 IGMP 组' },
  { v:'user', c:'display cpu-usage history', out:'cpu', d:'查看 CPU 历史占用' },
  { v:'user', c:'display alarm active', out:'alarm', d:'查看活动告警' },
  { v:'user', c:'display power', out:'device', d:'查看电源状态' },
  { v:'user', c:'display fan', out:'device', d:'查看风扇状态' },
  { v:'user', c:'display elabel', out:'device', d:'查看电子标签' },
  { v:'user', c:'display boot-loader', out:'startup', d:'查看启动文件' },
  { v:'user', c:'debugging ip packet', out:'ok', d:'打开 IP 报文调试' },
  { v:'user', c:'debugging ospf packet', out:'ok', d:'打开 OSPF 报文调试' },
  { v:'user', c:'undo debugging all', out:'ok', d:'关闭所有调试' },
  { v:'user', c:'terminal debugging', out:'ok', d:'终端显示调试信息' },
  { v:'user', c:'reset arp all', out:'ok', d:'清除 ARP 表' },
  { v:'user', c:'reset ospf process', out:'ok', d:'重启 OSPF 进程' },
  { v:'user', c:'reset bgp all', out:'ok', d:'重置所有 BGP 连接' },

  /* 系统视图 · undo 与细节 */
  { v:'system', c:'undo sysname', out:'ok', d:'恢复默认设备名' },
  { v:'system', c:'undo vlan <vlanid:VLAN ID>', out:'ok', d:'删除 VLAN' },
  { v:'system', c:'undo acl <aclnum:ACL编号>', out:'ok', d:'删除 ACL' },
  { v:'system', c:'undo ospf <num[1-65535]:进程号>', out:'ok', d:'删除 OSPF 进程' },
  { v:'system', c:'undo bgp <asnum:AS号>', out:'ok', d:'删除 BGP 进程' },
  { v:'system', c:'undo isis <num[1-65535]:进程号>', out:'ok', d:'删除 IS-IS 进程' },
  { v:'system', c:'undo ip pool <name:地址池名称>', out:'ok', d:'删除地址池' },
  { v:'system', c:'undo user-interface vty 0 4', out:'ok', d:'恢复 VTY 默认配置' },
  { v:'system', c:'undo dhcp enable', out:'ok', d:'关闭 DHCP' },
  { v:'system', c:'undo header login information', out:'ok', d:'删除登录提示' },
  { v:'system', c:'undo info-center enable', out:'ok', d:'关闭信息中心' },
  { v:'system', c:'undo snmp-agent', out:'ok', d:'关闭 SNMP' },
  { v:'system', c:'undo ntp-service enable', out:'ok', d:'关闭 NTP' },
  { v:'system', c:'undo dns resolve', out:'ok', d:'关闭 DNS 解析' },
  { v:'system', c:'undo ftp server enable', out:'ok', d:'关闭 FTP 服务' },
  { v:'system', c:'undo telnet server enable', out:'ok', d:'关闭 Telnet 服务' },
  { v:'system', c:'ip route-static <ipv4:目的网段> <mask:子网掩码> <ipv4:下一跳IP> tag <num[1-4294967295]:Tag值>', out:'route', d:'静态路由打 Tag' },
  { v:'system', c:'ip route-static <ipv4:目的网段> <mask:子网掩码> <ipv4:下一跳IP> description <str:描述>', out:'route', d:'静态路由加描述' },
  { v:'system', c:'ip route-static default-preference <num[1-255]:默认优先级>', out:'ok', d:'静态路由默认优先级' },
  { v:'system', c:'acl name <name:ACL名称> <enum{basic,advanced}:ACL类型>', out:'ok', d:'创建命名 ACL' },
  { v:'system', c:'time-range <name:时间段名> <str:时间段>', out:'ok', d:'定义时间段' },
  { v:'system', c:'mac-address aging-time <num[1-1000000]:老化秒数>', out:'ok', d:'设置 MAC 老化时间' },
  { v:'system', c:'mac-address blackhole <mac:MAC地址> vlan <vlanid:VLAN ID>', out:'ok', d:'配置黑洞 MAC' },
  { v:'system', c:'stp timer hello <num[100-1000]:Hello时间>', out:'ok', d:'设置 Hello 时间' },
  { v:'system', c:'stp timer forward-delay <num[400-3000]:转发延迟>', out:'ok', d:'设置转发延迟' },
  { v:'system', c:'stp timer max-age <num[600-4000]:最大老化>', out:'ok', d:'设置最大老化时间' },
  { v:'system', c:'stp instance <num[0-4094]:实例ID> root primary', out:'ok', d:'指定实例根桥' },
  { v:'system', c:'ntp-service refclock-master <num[1-15]:层级>', out:'ok', d:'配置本地时钟为主时钟' },
  { v:'system', c:'snmp-agent trap enable', out:'ok', d:'开启 SNMP 告警' },
  { v:'system', c:'ftp timeout <num[1-35791]:分钟>', out:'ok', d:'设置 FTP 超时' },
  { v:'system', c:'telnet server port <num[1-65535]:端口号>', out:'ok', d:'修改 Telnet 端口' },
  { v:'system', c:'ssh server port <num[1-65535]:端口号>', out:'ok', d:'修改 SSH 端口' },
  { v:'system', c:'undo mac-address blackhole <mac:MAC地址> vlan <vlanid:VLAN ID>', out:'ok', d:'删除黑洞 MAC' },

  /* 接口视图 · 细节与 undo */
  { v:'if', c:'flow-control', out:'ok', d:'开启流控' },
  { v:'if', c:'undo negotiation auto', out:'ok', d:'关闭自协商' },
  { v:'if', c:'mac-address static <mac:MAC地址> vlan <vlanid:VLAN ID>', out:'ok', d:'配置静态 MAC' },
  { v:'if', c:'storm-control multicast min-rate <num[1-100000]:pps>', out:'ok', d:'组播风暴抑制' },
  { v:'if', c:'storm-control unicast min-rate <num[1-100000]:pps>', out:'ok', d:'未知单播风暴抑制' },
  { v:'if', c:'loopback-detect enable', out:'ok', d:'开启环回检测' },
  { v:'if', c:'ospf authentication-mode simple cipher <str:密码>', out:'ok', d:'OSPF 明文认证' },
  { v:'if', c:'ospf mtu-enable', out:'ok', d:'DD 报文携带 MTU' },
  { v:'if', c:'ospf trans-delay <num[1-5000]:传输延迟>', out:'ok', d:'配置传输延迟' },
  { v:'if', c:'ospf timer dead <num[1-65535]:Dead间隔>', out:'ok', d:'配置 Dead 定时器' },
  { v:'if', c:'isis authentication-mode md5 <str:密码>', out:'ok', d:'IS-IS 接口认证' },
  { v:'if', c:'isis timer hello <num[1-65535]:Hello间隔>', out:'ok', d:'IS-IS Hello 间隔' },
  { v:'if', c:'pim dr-priority <num[0-4294967294]:DR优先级>', out:'ok', d:'PIM DR 优先级' },
  { v:'if', c:'igmp static-group <ipv4:组播组地址>', out:'ok', d:'静态加入组播组' },
  { v:'if', c:'vrrp vrid <num[1-255]:备份组号> authentication-mode md5 <str:密码>', out:'ok', d:'VRRP 认证' },
  { v:'if', c:'vrrp vrid <num[1-255]:备份组号> timer advertise <num[1-255]:通告间隔>', out:'ok', d:'VRRP 通告间隔' },
  { v:'if', c:'nat static global <ipv4:公网地址> inside <ipv4:私网地址>', out:'ok', d:'一对一静态 NAT' },
  { v:'if', c:'undo description', out:'ok', d:'删除接口描述' },
  { v:'if', c:'undo mtu', out:'ok', d:'恢复默认 MTU' },
  { v:'if', c:'undo speed', out:'ok', d:'恢复默认速率' },
  { v:'if', c:'undo port-isolate enable', out:'ok', d:'关闭端口隔离' },
  { v:'if', c:'undo port-security enable', out:'ok', d:'关闭端口安全' },
  { v:'if', c:'undo stp cost', out:'ok', d:'恢复默认路径开销' },
  { v:'if', c:'undo ospf cost', out:'ok', d:'恢复默认 OSPF 开销' },
  { v:'if', c:'undo dhcp snooping enable', out:'ok', d:'关闭 DHCP Snooping' },
  { v:'if', c:'undo traffic-filter inbound', out:'ok', d:'取消入方向过滤' },

  /* 路由协议细节 */
  { v:'ospf', c:'asbr-summary <ipv4:汇总网段> <mask:子网掩码>', out:'ok', d:'ASBR 路由聚合' },
  { v:'ospf', c:'filter-policy <aclnum:ACL编号> export', out:'ok', d:'过滤发布的路由' },
  { v:'ospf', c:'preference <num[1-255]:优先级>', out:'ok', d:'修改 OSPF 路由优先级' },
  { v:'ospf', c:'undo import-route <enum{direct,static,isis,bgp}:引入路由类型>', out:'ok', d:'取消引入路由' },
  { v:'isis', c:'filter-policy <aclnum:ACL编号> import', out:'ok', d:'过滤接收的路由' },
  { v:'isis', c:'set-overload', out:'ok', d:'设置过载位' },
  { v:'bgp', c:'peer <ipv4:邻居IP> group <name:对等体组名>', out:'ok', d:'加入对等体组' },
  { v:'bgp', c:'peer <ipv4:邻居IP> public-as-only', out:'ok', d:'只发送公有 AS 号' },
  { v:'bgp', c:'peer <ipv4:邻居IP> route-limit <num[1-4294967295]:最大条数>', out:'ok', d:'限制接收路由数' },
  { v:'bgp', c:'peer <ipv4:邻居IP> bfd', out:'ok', d:'BGP 启用 BFD' },
  { v:'bgp', c:'peer <ipv4:邻居IP> keep-all-routes', out:'ok', d:'保留所有路由' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> group <name:对等体组名>', out:'ok', d:'地址族加入对等体组' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> public-as-only', out:'ok', d:'只发送公有 AS 号' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> route-limit <num[1-4294967295]:最大条数>', out:'ok', d:'限制路由条数' },

  /* ACL / 地址池 / 其他 */
  { v:'acl', c:'rule <num[0-65534]:规则编号> <enum{permit,deny}:动作> protocol <enum{tcp,udp,icmp,ip}:协议> source <ipv4:源网段地址> <wildcard:反掩码> destination-port eq <num[0-65535]:端口号>', out:'ok', d:'按源网段 + 端口匹配' },
  { v:'pool', c:'bootfile-name <str:启动文件名>', out:'ok', d:'下发启动文件名' },
  { v:'pool', c:'next-server <ipv4:服务器地址>', out:'ok', d:'下发 TFTP 服务器' },
  { v:'aaa', c:'local-user <name:用户名> ftp-directory <str:目录>', out:'ok', d:'设置 FTP 目录' },
  { v:'ui', c:'acl <aclnum:ACL编号> inbound', out:'ok', d:'限制登录源地址' },
  { v:'vlan', c:'undo port <ifname:接口名>', out:'ok', d:'把接口移出本 VLAN' },
  { v:'ethTrunk', c:'least active-linknumber <num[1-16]:最少活动链路数>', out:'ok', d:'最少活动链路数' },
  { v:'ethTrunk', c:'lacp timeout <enum{fast,slow}:超时模式>', out:'ok', d:'LACP 超时模式' },
  { v:'ethTrunk', c:'undo trunkport <ifname:成员接口>', out:'ok', d:'移出成员接口' },
  { v:'mpls', c:'static-lsp egress <name:LSP名> incoming-interface <ifname:入接口> in-label <num[0-1048575]:入标签>', out:'ok', d:'配置静态 LSP 出节点' },
  { v:'pim', c:'static-rp <ipv4:静态RP地址> priority <num[0-255]:优先级>', out:'ok', d:'静态 RP 优先级' }
];
/* 第四批：IPv6 / QoS / RIP / 策略路由 / 二层增强 / 文件系统 */
var SPEC_MORE3 = [
  /* IPv6 基础 */
  { v:'system', c:'ipv6', out:'ok', d:'全局使能 IPv6 报文转发' },
  { v:'system', c:'ipv6 route-static <ipv6addr:目的网段> <num[0-128]:前缀长度> <ipv6addr:下一跳IPv6>', out:'route', d:'IPv6 静态路由' },
  { v:'system', c:'ospfv3 <num[1-65535]:进程号>', to:'ospfv3', d:'启动 OSPFv3 进程' },
  { v:'ospfv3', c:'router-id <ipv4:Router ID>', out:'ok', d:'配置 OSPFv3 Router ID' },
  { v:'ospfv3', c:'quit', pop:true, d:'返回系统视图' },
  { v:'if', c:'ipv6 enable', out:'ok', d:'接口开启 IPv6' },
  { v:'if', c:'ipv6 address <ipv6addr:接口IPv6地址> <num[0-128]:前缀长度>', out:'ok', d:'配置接口 IPv6 地址' },
  { v:'if', c:'ipv6 address auto link-local', out:'ok', d:'自动生成链路本地地址' },
  { v:'if', c:'ipv6 address <ipv6addr:接口IPv6地址> <num[0-128]:前缀长度> eui-64', out:'ok', d:'按 EUI-64 生成接口标识' },
  { v:'if', c:'ospfv3 <num[1-65535]:进程号> area <areaid:区域ID>', out:'ok', d:'接口启用 OSPFv3 并指定区域' },
  { v:'if', c:'ipv6 nd ra halt', out:'ok', d:'抑制 RA 报文' },
  { v:'if', c:'undo ipv6 enable', out:'ok', d:'接口关闭 IPv6' },
  { v:'user', c:'display ipv6 interface brief', out:'ifbrief', d:'查看接口 IPv6 状态' },
  { v:'user', c:'display ipv6 routing-table', out:'route', d:'查看 IPv6 路由表' },
  { v:'user', c:'display ospfv3 peer', out:'ospfpeer', d:'查看 OSPFv3 邻居' },

  /* BGP IPv6 地址族 */
  { v:'bgp', c:'peer <ipv6addr:邻居IPv6> as-number <asnum:对端AS号>', out:'ok', d:'指定 IPv6 邻居及 AS 号' },
  { v:'bgp', c:'ipv6-family unicast', to:'bgp6', d:'进入 IPv6 单播地址族' },
  { v:'bgp6', c:'network <ipv6addr:目的网段> <num[0-128]:前缀长度>', out:'ok', d:'宣告 IPv6 网段' },
  { v:'bgp6', c:'peer <ipv6addr:邻居IPv6> enable', out:'ok', d:'在 IPv6 地址族激活邻居' },
  { v:'bgp6', c:'peer <ipv6addr:邻居IPv6> next-hop-local', out:'ok', d:'下一跳指向本机' },
  { v:'bgp6', c:'quit', pop:true, d:'返回 BGP 视图' },

  /* RIP */
  { v:'system', c:'rip <num[1-65535]:进程号>', to:'rip', d:'启动 RIP 进程' },
  { v:'rip', c:'version <enum{1,2}:版本>', out:'ok', d:'配置 RIP 版本' },
  { v:'rip', c:'network <ipv4:网段地址>', out:'ok', d:'宣告网段',
    info:{ brief:'RIP 的 network 只写主网段地址，不带掩码，也不带反掩码。',
           pitfall:['写成 network 192.168.1.0 0.0.0.255 会报错——RIP 不接受反掩码',
                    'RIP 是有类路由协议，v1 不携带掩码'] } },
  { v:'rip', c:'import-route <enum{direct,static,ospf,isis,bgp}:引入路由>', out:'ok', d:'引入外部路由' },
  { v:'rip', c:'silent-interface <ifname:接口名>', out:'ok', d:'配置抑制接口' },
  { v:'rip', c:'quit', pop:true, d:'返回系统视图' },
  { v:'user', c:'display rip <num[1-65535]:进程号> route', out:'riprout', d:'查看 RIP 路由' },

  /* 策略路由 PBR */
  { v:'system', c:'policy-based-route <name:策略名> permit node <num[0-65535]:节点号>', to:'pbr', d:'创建策略路由节点' },
  { v:'pbr', c:'if-match acl <aclnum:ACL编号>', out:'ok', d:'匹配 ACL' },
  { v:'pbr', c:'apply ip-address next-hop <ipv4:下一跳IP>', out:'ok', d:'指定下一跳' },
  { v:'pbr', c:'quit', pop:true, d:'返回系统视图' },
  { v:'if', c:'ip policy-based-route <name:策略名>', out:'ok', d:'接口应用策略路由' },

  /* QoS */
  { v:'system', c:'traffic classifier <name:流分类名>', to:'qosCls', d:'创建流分类（默认 and）' },
  { v:'system', c:'traffic classifier <name:流分类名> operator <enum{or,and}:匹配关系>', to:'qosCls', d:'创建流分类并指定匹配关系' },
  { v:'qosCls', c:'if-match acl <aclnum:ACL编号>', out:'ok', d:'按 ACL 分类' },
  { v:'qosCls', c:'if-match vlan-id <vlanid:VLAN ID>', out:'ok', d:'按 VLAN 分类' },
  { v:'qosCls', c:'quit', pop:true, d:'返回系统视图' },
  { v:'system', c:'traffic behavior <name:流行为名>', to:'qosBeh', d:'创建流行为' },
  { v:'qosBeh', c:'remark dscp <num[0-63]:DSCP值>', out:'ok', d:'重标记 DSCP' },
  { v:'qosBeh', c:'car cir <num[64-100000000]:承诺速率kbps>', out:'ok', d:'配置流量监管' },
  { v:'qosBeh', c:'quit', pop:true, d:'返回系统视图' },
  { v:'system', c:'traffic policy <name:流策略名>', to:'qosPol', d:'创建流策略' },
  { v:'qosPol', c:'classifier <name:流分类名> behavior <name:流行为名>', out:'ok', d:'绑定流分类与流行为' },
  { v:'qosPol', c:'quit', pop:true, d:'返回系统视图' },
  { v:'if', c:'traffic-policy <name:流策略名> inbound', out:'ok', d:'接口入方向应用流策略' },
  { v:'if', c:'traffic-policy <name:流策略名> outbound', out:'ok', d:'接口出方向应用流策略' },
  { v:'user', c:'display traffic policy user-defined', out:'qos', d:'查看用户自定义流策略' },

  /* BFD */
  { v:'system', c:'bfd', out:'ok', d:'全局使能 BFD' },
  { v:'if', c:'bfd min-tx-interval <num[3-1000]:最小发送间隔ms>', out:'ok', d:'BFD 最小发送间隔' },
  { v:'if', c:'bfd min-rx-interval <num[3-1000]:最小接收间隔ms>', out:'ok', d:'BFD 最小接收间隔' },
  { v:'if', c:'bfd detect-multiplier <num[3-50]:检测倍数>', out:'ok', d:'BFD 检测倍数' },

  /* 二层增强：Super VLAN / MUX VLAN / MAC VLAN / Voice VLAN */
  { v:'vlan', c:'aggregate-vlan <vlanid:Super VLAN>', out:'ok', d:'指定 Super VLAN' },
  { v:'vlan', c:'access-vlan <vlanlist:Sub VLAN列表>', out:'ok', d:'绑定 Sub VLAN', rep:true },
  { v:'vlan', c:'mux-vlan', out:'ok', d:'配置为 MUX VLAN' },
  { v:'vlan', c:'subordinate group <enum{principal,separate,common}:组类型>', out:'ok', d:'配置 MUX 从 VLAN 组' },
  { v:'vlan', c:'mac-vlan mac-address <mac:MAC地址>', out:'ok', d:'绑定 MAC 与 VLAN' },
  { v:'vlan', c:'voice-vlan <vlanid:VLAN ID> enable', out:'ok', d:'指定语音 VLAN' },
  { v:'if', c:'mac-vlan enable', out:'ok', d:'接口启用 MAC VLAN' },
  { v:'if', c:'voice-vlan enable', out:'ok', d:'接口启用语音 VLAN' },
  { v:'if', c:'dot1q termination vid <vlanid:VLAN ID>', out:'ok', d:'子接口封装单层 VLAN' },
  { v:'if', c:'link-protocol hdlc', out:'ok', d:'接口链路层协议改为 HDLC' },
  { v:'if', c:'ppp authentication-mode <enum{pap,chap}:认证方式>', out:'ok', d:'PPP 认证方式' },
  { v:'if', c:'ppp chap password cipher <str:密码>', out:'ok', d:'PPP CHAP 密码' },
  { v:'if', c:'pppoe-client dial-bundle-number <num[1-255]:拨号组号>', out:'ok', d:'PPPoE 客户端拨号' },

  /* 堆叠 / 文件系统 */
  { v:'system', c:'stack slot <num[0-8]:槽位号> priority <num[1-255]:优先级>', out:'ok', d:'设置堆叠优先级' },
  { v:'system', c:'stack slot <num[0-8]:槽位号> renumber <num[0-8]:新槽位号>', out:'ok', d:'修改堆叠槽位号' },
  { v:'user', c:'dir', out:'dir', d:'查看文件列表' },
  { v:'user', c:'copy <str:源文件> <str:目标文件>', out:'ok', d:'复制文件' },
  { v:'user', c:'move <str:源文件> <str:目标文件>', out:'ok', d:'移动文件' },
  { v:'user', c:'delete <str:文件名>', out:'ok', d:'删除文件' },
  { v:'user', c:'startup saved-configuration <str:配置文件名>', out:'ok', d:'指定下次启动配置文件' }
];

/* 第五批：VXLAN / Smart Link / RRPP / 防火墙 / RADIUS 模板 */
var SPEC_MORE4 = [
  /* VXLAN */
  { v:'system', c:'bridge-domain <num[1-16777215]:BD ID>', out:'ok', d:'创建广播域 BD' },
  { v:'if', c:'source <ipv4:VTEP源地址>', out:'ok', d:'Nve 接口指定 VTEP 源地址' },
  { v:'if', c:'vni <num[1-16777215]:VNI> head-end peer-list <ipv4:对端VTEP地址>', out:'ok', d:'VNI 绑定远端 VTEP' },

  /* Smart Link */
  { v:'system', c:'smart-link group <num[1-8]:组号>', to:'smartLink', d:'创建 Smart Link 组' },
  { v:'smartLink', c:'port <ifname:主接口> primary', out:'ok', d:'指定主接口' },
  { v:'smartLink', c:'port <ifname:从接口> secondary', out:'ok', d:'指定从接口' },
  { v:'smartLink', c:'protected-vlan reference-instance <num[0-4094]:实例ID>', out:'ok', d:'绑定保护 VLAN' },
  { v:'smartLink', c:'flush enable', out:'ok', d:'开启流量刷新' },
  { v:'smartLink', c:'quit', pop:true, d:'返回系统视图' },

  /* RRPP */
  { v:'system', c:'rrpp domain <num[1-8]:域ID>', to:'rrpp', d:'创建 RRPP 域' },
  { v:'rrpp', c:'control-vlan <vlanid:控制VLAN>', out:'ok', d:'指定控制 VLAN' },
  { v:'rrpp', c:'protected-vlan reference-instance <num[0-4094]:实例ID>', out:'ok', d:'绑定保护 VLAN' },
  { v:'rrpp', c:'ring <num[0-127]:环号> node-mode <enum{master,transit}:节点角色>', out:'ok', d:'配置环上节点角色' },
  { v:'rrpp', c:'quit', pop:true, d:'返回系统视图' },

  /* 防火墙 / ASPF */
  { v:'system', c:'firewall enable', out:'ok', d:'开启防火墙功能' },
  { v:'system', c:'firewall default <enum{permit,deny}:默认动作>', out:'ok', d:'设置域间默认动作' },
  { v:'if', c:'firewall packet-filter <aclnum:ACL编号> inbound', out:'ok', d:'接口入方向包过滤' },

  /* RADIUS / SNMP v3 / NTP 认证 / SCP */
  { v:'system', c:'radius-server template <name:模板名>', to:'radius', d:'进入 RADIUS 模板视图' },
  { v:'radius', c:'radius-server shared-key cipher <str:共享密钥>', out:'ok', d:'配置共享密钥' },
  { v:'radius', c:'radius-server authentication <ipv4:服务器地址> <num[1-65535]:端口>', out:'ok', d:'指定认证服务器' },
  { v:'radius', c:'quit', pop:true, d:'返回系统视图' },
  { v:'system', c:'snmp-agent usm-user v3 <name:用户名> group <name:组名>', out:'ok', d:'创建 SNMPv3 用户' },
  { v:'system', c:'snmp-agent group v3 <name:组名> privacy', out:'ok', d:'创建 SNMPv3 用户组' },
  { v:'system', c:'ntp-service authentication enable', out:'ok', d:'开启 NTP 认证' },
  { v:'system', c:'ntp-service authentication-keyid <num[1-1024]:密钥ID> md5 cipher <str:密钥>', out:'ok', d:'配置 NTP 认证密钥' },
  { v:'system', c:'scp server enable', out:'ok', d:'开启 SCP 服务' }
];

/* ===== 第六批：按 HCIP-Datacom 考纲逐项对齐 ===== */
var SPEC_MORE5 = [
  /* ---- A. OSPF 深化（LSA / 特殊区域 / 汇总 / 选路） ---- */
  { v:'ospf', c:'timer hello <num[1-65535]:Hello间隔>', out:'ok', d:'进程级 Hello 间隔' },
  { v:'ospf', c:'maximum load-balancing <num[1-8]:最大负载数>', out:'ok', d:'OSPF 等价路由数' },
  { v:'ospf', c:'nexthop <ipv4:下一跳IP> weight <num[1-254]:权重>', out:'ok', d:'配置等价下一跳权重' },
  { v:'ospf', c:'stub-router', out:'ok', d:'配置 Stub 路由器' },
  { v:'ospf', c:'undo silent-interface all', out:'ok', d:'取消全部接口静默' },
  { v:'ospf', c:'filter-policy <aclnum:ACL编号> import', out:'ok', d:'过滤接收的路由' },
  { v:'ospfArea', c:'abr-summary <ipv4:汇总网段> <mask:子网掩码> not-advertise', out:'ok', d:'汇总并抑制明细' },
  { v:'ospfArea', c:'filter <ipv4:过滤网段> <wildcard:反掩码> not-advertise', out:'ok', d:'过滤并抑制' },
  { v:'ospfArea', c:'network <ipv4:目的网段> <wildcard:反掩码> cost <num[1-65535]:开销>', out:'ok', d:'宣告网段并指定开销' },
  { v:'ospfArea', c:'stub default-cost <num[0-16777214]:默认开销>', out:'ok', d:'Stub 区域默认开销' },

  /* ---- B. IS-IS 深化（级别 / 泄漏 / 认证 / 开销） ---- */
  { v:'isis', c:'default-route-advertise', out:'ok', d:'下发默认路由' },
  { v:'isis', c:'timer lsp-generation <num[1-120]:最大间隔>', out:'ok', d:'LSP 生成间隔' },
  { v:'isis', c:'timer spf <num[1-120]:最大间隔>', out:'ok', d:'SPF 计算间隔' },
  { v:'isis', c:'circuit-cost <num[1-16777215]:circuit开销>', out:'ok', d:'全局 circuit 开销' },
  { v:'isis', c:'undo set-overload', out:'ok', d:'取消过载位' },
  { v:'if', c:'isis circuit-level <enum{level-1,level-2,level-1-2}:电路级别>', out:'ok', d:'配置接口 IS-IS 级别' },
  { v:'if', c:'isis silent', out:'ok', d:'接口抑制 IS-IS 报文' },
  { v:'if', c:'isis cost <num[1-16777215]:接口开销> level-1', out:'ok', d:'配置 Level-1 接口开销' },
  { v:'if', c:'isis cost <num[1-16777215]:接口开销> level-2', out:'ok', d:'配置 Level-2 接口开销' },

  /* ---- C. BGP 深化（选路 / 属性 / 反射 / 联盟） ---- */
  { v:'bgp', c:'timer keepalive <num[0-21845]:保活秒> hold <num[0-65535]:保持秒>', out:'ok', d:'全局 BGP 定时器' },
  { v:'bgp', c:'confederation id <asnum:联盟AS号>', out:'ok', d:'配置联盟 ID' },
  { v:'bgp', c:'confederation peer-as <asnum:子AS号>', out:'ok', d:'配置联盟子 AS' },
  { v:'bgp', c:'confederation nonstandard', out:'ok', d:'联盟非标准兼容' },
  { v:'bgp', c:'peer <ipv4:邻居IP> route-policy <name:路由策略名> export', out:'ok', d:'对邻居应用出方向策略' },
  { v:'bgp', c:'peer <ipv4:邻居IP> filter-policy <aclnum:ACL编号> import', out:'ok', d:'按 ACL 过滤接收路由' },
  { v:'bgp', c:'peer <ipv4:邻居IP> as-path-filter <num[1-256]:AS路径过滤器号> export', out:'ok', d:'按 AS-Path 过滤发布' },
  { v:'bgp', c:'peer <ipv4:邻居IP> ip-prefix <name:前缀列表名> export', out:'ok', d:'按前缀列表过滤发布' },
  { v:'bgp', c:'peer <ipv4:邻居IP> advertise-community', out:'ok', d:'向邻居发布团体属性' },
  { v:'bgp', c:'peer <ipv4:邻居IP> capability-advertise route-refresh', out:'ok', d:'通告 Route-Refresh 能力' },
  { v:'bgp', c:'peer <ipv4:邻居IP> route-reflector-client', out:'ok', d:'指定为路由反射客户端' },
  { v:'bgp', c:'group <name:对等体组名> internal', out:'ok', d:'创建 IBGP 对等体组' },
  { v:'bgp', c:'undo peer <ipv4:邻居IP> as-number', out:'ok', d:'删除邻居 AS 配置' },

  { v:'bgpAf', c:'aggregate <ipv4:聚合网段> <mask:子网掩码> as-set', out:'ok', d:'聚合携带 AS-SET' },
  { v:'bgpAf', c:'aggregate <ipv4:聚合网段> <mask:子网掩码> detail-suppressed', out:'ok', d:'聚合抑制明细' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> advertise-community', out:'ok', d:'发布团体属性' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> as-path-filter <num[1-256]:AS路径过滤器号> import', out:'ok', d:'按 AS-Path 过滤接收' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> ip-prefix <name:前缀列表名> export', out:'ok', d:'按前缀列表过滤发布' },
  { v:'bgpAf', c:'peer <ipv4:邻居IP> route-reflector-client', out:'ok', d:'地址族反射客户端' },
  { v:'bgpAf', c:'undo synchronization', out:'ok', d:'关闭同步（默认已关）' },

  /* ---- D. 路由控制（ip-prefix / as-path / community / route-policy） ---- */
  { v:'system', c:'ip ip-prefix <name:前缀列表名> index <num[0-4294967295]:序号> permit <ipv4:目的网段> <num[0-32]:掩码长度>', out:'ok', d:'前缀列表（带序号）' },
  { v:'system', c:'ip ip-prefix <name:前缀列表名> index <num[0-4294967295]:序号> permit <ipv4:目的网段> <num[0-32]:掩码长度> greater-equal <num[0-32]:最小掩码> less-equal <num[0-32]:最大掩码>', out:'ok', d:'前缀列表匹配掩码范围（考纲重点）',
    info:{ brief:'greater-equal / less-equal 限定掩码长度范围，是路由过滤的核心考点。',
           example:['ip ip-prefix P1 index 10 permit 10.0.0.0 8 greater-equal 24 less-equal 28'],
           pitfall:['只写 greater-equal 不写 less-equal 时，less-equal 默认等于 32',
                    '前缀长度必须落在 [greater-equal, less-equal] 区间内才匹配'] } },
  { v:'system', c:'ip ip-prefix <name:前缀列表名> index <num[0-4294967295]:序号> deny <ipv4:目的网段> <num[0-32]:掩码长度>', out:'ok', d:'前缀列表拒绝项' },
  { v:'system', c:'ip as-path-filter <num[1-256]:过滤器号> permit <str:正则表达式>', out:'ok', d:'AS-Path 过滤器',
    info:{ brief:'用正则匹配 AS 路径，常用于防环与选路。',
           example:['ip as-path-filter 1 permit ^100$','ip as-path-filter 2 deny _200_'],
           pitfall:['^ 表示开头、$ 表示结尾，_ 表示 AS 分隔符（空格、逗号、括号等）'] } },
  { v:'system', c:'ip community-filter <num[1-256]:过滤器号> basic <str:团体属性>', out:'ok', d:'团体属性过滤器' },
  { v:'rp', c:'if-match community-filter <num[1-256]:过滤器号>', out:'ok', d:'匹配团体属性' },
  { v:'rp', c:'apply community <str:团体属性>', out:'ok', d:'设置团体属性' },
  { v:'rp', c:'apply as-path <str:AS路径> additive', out:'ok', d:'追加 AS-Path' },
  { v:'rp', c:'apply preferred-value <num[0-65535]:首选值>', out:'ok', d:'设置 Preferred-Value' },
  { v:'rp', c:'apply cost <num[1-65535]:开销值>', out:'ok', d:'设置开销（已有，补充说明）' },

  /* ---- E. 组播（IGMP / PIM / MSDP） ---- */
  { v:'if', c:'pim dm', out:'ok', d:'接口启用 PIM-DM' },
  { v:'pim', c:'c-bsr priority <num[0-255]:优先级>', out:'ok', d:'候选 BSR 优先级' },
  { v:'pim', c:'c-rp priority <num[0-255]:优先级>', out:'ok', d:'候选 RP 优先级' },
  { v:'pim', c:'c-rp holdtime <num[1-65535]:保持时间>', out:'ok', d:'候选 RP 保持时间' },
  { v:'system', c:'msdp', to:'msdp', d:'进入 MSDP 视图' },
  { v:'msdp', c:'peer <ipv4:MSDP对等体> connect-interface <ifname:源接口>', out:'ok', d:'配置 MSDP 对等体' },
  { v:'msdp', c:'quit', pop:true, d:'返回系统视图' },

  /* ---- F. MPLS / LDP / MPLS VPN ----
     注意 `mpls ldp` 的父视图是 **mpls**，不是 system。
     真机的顺序是 system-view → mpls → mpls ldp，直接在建系统视图下敲会报错。
     接口视图下也有同名命令，但那条只是「接口使能」，不进新视图（见上方 if 段）。 */
  { v:'mpls', c:'mpls ldp', to:'mplsLdp', save:true, d:'全局启用 MPLS LDP（进入 LDP 视图）' },
  { v:'mplsLdp', c:'graceful-restart', out:'ok', d:'LDP GR' },
  { v:'mplsLdp', c:'quit', pop:true, d:'返回 MPLS 视图' },
  { v:'system', c:'ip vpn-instance <name:VPN实例名>', to:'vrf', d:'创建 VPN 实例' },
  { v:'vrf', c:'route-distinguisher <str:RD值>', out:'ok', d:'配置 RD（区分相同网段）',
    info:{ brief:'RD 加在 IPv4 前缀前，把不同 VPN 的相同网段变成唯一 VPNv4 前缀。',
           example:['route-distinguisher 100:1'],
           pitfall:['RD 只在本地有效，两端不要求一致','真正控制路由导入导出的是 RT'] } },
  { v:'vrf', c:'vpn-target <str:RT值> both', out:'ok', d:'配置 RT（控制路由导入导出）' },
  { v:'vrf', c:'quit', pop:true, d:'返回系统视图' },
  { v:'if', c:'ip binding vpn-instance <name:VPN实例名>', out:'ok', d:'接口绑定 VPN 实例' },
  { v:'bgp', c:'ipv4-family vpnv4', to:'bgpVpn', d:'进入 VPNv4 地址族' },
  { v:'bgpVpn', c:'peer <ipv4:邻居IP> enable', out:'ok', d:'VPNv4 激活邻居' },
  { v:'bgpVpn', c:'policy vpn-target', out:'ok', d:'启用 RT 过滤' },
  { v:'bgpVpn', c:'quit', pop:true, d:'返回 BGP 视图' },

  /* ---- G. IPv6 / DHCPv6 ---- */
  { v:'ospfv3', c:'import-route <enum{direct,static,ospf,isis,bgp}:引入路由>', out:'ok', d:'OSPFv3 引入外部路由' },
  { v:'ospfv3', c:'default-route-advertise', out:'ok', d:'OSPFv3 下发默认路由' },
  { v:'system', c:'dhcpv6 pool <name:地址池名称>', to:'dhcpv6', d:'创建 DHCPv6 地址池' },
  { v:'dhcpv6', c:'address prefix <ipv6addr:IPv6前缀> <num[0-128]:前缀长度>', out:'ok', d:'声明可分配前缀' },
  { v:'dhcpv6', c:'excluded-address <ipv6addr:排除地址>', out:'ok', d:'排除不分配的地址' },
  { v:'dhcpv6', c:'quit', pop:true, d:'返回系统视图' },
  { v:'if', c:'ipv6 nd ra interval <num[4-1800]:间隔秒>', out:'ok', d:'RA 发送间隔' },
  { v:'if', c:'ipv6 nd autoconfig managed-address-flag', out:'ok', d:'M 位置位（DHCPv6 分配地址）' },
  { v:'if', c:'ipv6 mtu <num[1280-1500]:MTU值>', out:'ok', d:'接口 IPv6 MTU' },
  { v:'if', c:'ipv6 address auto dhcp', out:'ok', d:'通过 DHCPv6 获取地址' },

  /* ---- H. 安全（IPSG / uRPF / 端口安全扩展） ---- */
  { v:'if', c:'ip source check user-bind enable', out:'ok', d:'IPSG：IP 报文源检查' },
  { v:'if', c:'urpf strict', out:'ok', d:'严格 uRPF（防源地址伪造）' },
  { v:'if', c:'urpf loose', out:'ok', d:'松散 uRPF' },
  { v:'if', c:'dhcp snooping user-bind autosave', out:'ok', d:'绑定表自动保存' },
  { v:'system', c:'cpu-defend policy <name:策略名>', out:'ok', d:'CPU 防攻击策略' },

  /* ---- I. QoS 深化 ---- */
  { v:'if', c:'qos car inbound cir <num[64-100000000]:承诺速率kbps>', out:'ok', d:'接口入方向限速' },
  { v:'if', c:'qos lr outbound cir <num[64-100000000]:承诺速率kbps>', out:'ok', d:'接口出方向限速' },
  { v:'if', c:'qos queue <num[0-7]:队列号> wrr weight <num[1-100]:权重>', out:'ok', d:'WRR 队列权重' },
  { v:'qosBeh', c:'remark 8021p <num[0-7]:802.1p优先级>', out:'ok', d:'重标记 802.1p' },
  { v:'qosBeh', c:'statistic enable', out:'ok', d:'开启流量统计' },
  { v:'qosCls', c:'if-match dscp <num[0-63]:DSCP值>', out:'ok', d:'按 DSCP 分类' },
  { v:'qosCls', c:'if-match any', out:'ok', d:'匹配所有流量' },

  /* ---- J. 排错与运维（H12-831 主线） ---- */
  { v:'user', c:'display ospf lsdb router', out:'ospflsdb', d:'查看 Type-1 LSA' },
  { v:'user', c:'display ospf lsdb network', out:'ospflsdb', d:'查看 Type-2 LSA' },
  { v:'user', c:'display ospf lsdb summary', out:'ospflsdb', d:'查看 Type-3 LSA' },
  { v:'user', c:'display ospf lsdb asbr', out:'ospflsdb', d:'查看 Type-4 LSA' },
  { v:'user', c:'display ospf lsdb ase', out:'ospflsdb', d:'查看 Type-5 LSA' },
  { v:'user', c:'display ospf lsdb nssa', out:'ospflsdb', d:'查看 Type-7 LSA' },
  { v:'user', c:'display bgp routing-table peer <ipv4:邻居IP> received-routes', out:'bgproute', d:'查看从邻居收到的路由' },
  { v:'user', c:'display bgp routing-table community', out:'bgproute', d:'按团体属性查看路由' },
  { v:'user', c:'display ip routing-table vpn-instance <name:VPN实例名>', out:'route', d:'查看 VPN 实例路由表' },
  { v:'user', c:'display bgp vpnv4 all routing-table', out:'bgproute', d:'查看 VPNv4 路由' },
  { v:'user', c:'display pim routing-table', out:'pim', d:'查看 PIM 路由表' },
  { v:'user', c:'display msdp peer-status', out:'pim', d:'查看 MSDP 对等体状态' },
  { v:'user', c:'display bfd session all', out:'bfd', d:'查看 BFD 会话' },
  { v:'user', c:'display rrpp brief', out:'rrpp', d:'查看 RRPP 状态' },
  { v:'user', c:'display smart-link group all', out:'rrpp', d:'查看 Smart Link 组' },
  { v:'user', c:'display eth-trunk <num[0-127]:Eth-Trunk编号> verbose', out:'trunk', d:'查看链路聚合详情' },
  { v:'user', c:'display stp instance <num[0-4094]:实例ID>', out:'stp', d:'查看指定实例生成树' },
  { v:'user', c:'reset ospf counters', out:'ok', d:'清除 OSPF 统计' },
  { v:'user', c:'reset bgp <asnum:AS号>', out:'ok', d:'重置指定 AS 的 BGP 连接' },
  { v:'user', c:'reset isis all', out:'ok', d:'重置 IS-IS 邻居' },

  /* ---- K. 考纲高频遗漏点 ---- */
  { v:'isis', c:'import-route isis level-1 into level-2', out:'ok', d:'IS-IS 路由泄漏（L1 → L2）',
    info:{ brief:'把 Level-1 路由引入 Level-2，让骨干区域能看到末梢区域的路由。',
           example:['import-route isis level-1 into level-2'],
           pitfall:['反向（L2 → L1）要配 filter-policy 或路由标记，否则易出环',
                    '泄漏后 L1 路由器仍只有默认路由，需要 L2 侧下发'] } },
  { v:'ospfArea', c:'nssa no-summary', out:'ok', d:'Totally NSSA 区域' },
  { v:'bgp', c:'default med <num[0-4294967295]:MED值>', out:'ok', d:'修改默认 MED' },
  { v:'bgp', c:'default local-preference <num[0-4294967295]:本地优先级>', out:'ok', d:'修改默认 Local-Preference' },
  { v:'bgp', c:'peer <ipv4:邻居IP> preferred-value <num[0-65535]:首选值>', out:'ok', d:'设置邻居路由首选值' },
  { v:'vlan', c:'igmp-snooping enable', out:'ok', d:'VLAN 内开启 IGMP Snooping' },
  { v:'if', c:'igmp-snooping enable', out:'ok', d:'接口开启 IGMP Snooping' },
  { v:'user', c:'display igmp-snooping group', out:'pim', d:'查看 IGMP Snooping 组表' },
  { v:'user', c:'display vrrp verbose', out:'vrrp', d:'查看 VRRP 详细状态' },
  { v:'user', c:'display ospf peer verbose', out:'ospfpeer', d:'查看 OSPF 邻居详情' }
];
SPEC = SPEC.concat(SPEC_MORE).concat(SPEC_MORE2).concat(SPEC_MORE3).concat(SPEC_MORE4).concat(SPEC_MORE5);

/* 把「一行一条」编译成命令树：关键字为边，<类型:语义> 为带类型的叶子 */
function parseToken(t){
  var m = /^<([a-z][a-z0-9]*)(?:\[(\d+)-(\d+)\])?(?:\{([^}]*)\})?(?::([^>]*))?>$/.exec(t);
  if (!m) return null;
  var o = { param:m[1], role:m[5] || '' };
  if (m[2] != null) o.range = [+m[2], +m[3]];
  if (m[4]) o.options = m[4].split(',');
  return o;
}

/* 按空格切词，但 <...> 内部允许有空格（如 <vlanid:VLAN ID>） */
function splitToks(s){
  var out = [], buf = '', i = 0;
  while (i < s.length){
    var ch = s[i];
    if (ch === '<'){
      if (buf) { out.push(buf); buf = ''; }
      var j = s.indexOf('>', i);
      if (j < 0) throw new Error('占位符缺少 >: ' + s);
      out.push(s.slice(i, j + 1));
      i = j + 1;
    } else if (ch === ' '){
      if (buf) { out.push(buf); buf = ''; }
      i++;
    } else { buf += ch; i++; }
  }
  if (buf) out.push(buf);
  return out;
}

function buildViews(){
  var out = {};
  Object.keys(VIEWMETA).forEach(function(id){
    var m = VIEWMETA[id];
    out[id] = { id:id, name:m.name, enter:m.enter || null, nodes:[] };
  });

  SPEC.forEach(function(item){
    var view = out[item.v];
    if (!view) throw new Error('未定义视图: ' + item.v);
    var toks = splitToks(item.c);
    var nodes = view.nodes;

    for (var i=0;i<toks.length;i++){
      var t = toks[i], isLast = (i === toks.length - 1), node = null;
      var p = parseToken(t);
      if (!p && t.charAt(0) === '<') throw new Error('参数写法有误: ' + t + '  ←  ' + item.c);

      if (p){
        for (var j=0;j<nodes.length;j++){
          var q = nodes[j];
          if (q.type === 'param' && q.param === p.param && q.role === p.role){ node = q; break; }
        }
        if (!node){
          node = { type:'param', param:p.param, role:p.role, help:'', children:[] };
          if (p.range) node.range = p.range;
          if (p.options) node.options = p.options;
          if (p.param === 'ipv4' && /IP|网关/.test(p.role)) node.warnHost = true;
          if (item.rep && isLast) node.rep = true;
          nodes.push(node);
        }
      } else {
        for (var k=0;k<nodes.length;k++){
          if (nodes[k].type === 'keyword' && nodes[k].text === t){ node = nodes[k]; break; }
        }
        if (!node){
          var al = (ALIAS[t] || []).slice();
          /* VRP 里 q 就等于 quit，即使同一视图还有 qos，也不能算歧义 */
          if (t === 'quit') al.push('q');
          node = { type:'keyword', text:t, alias:al,
                   help:(KEYHELP[t] || ''), children:[] };
          nodes.push(node);
        }
      }

      if (isLast){
        /* 进视图和「记一条配置」本来是两件事：`ospf 1` 只是进视图，
           而 `mpls` / `mpls ldp` 在真机上**既使能又进视图**，current-configuration
           里能看到它们。SPEC 里标 save:true 的命令两个动作都带上。 */
        node.action = item.to ? { view:item.to, save:!!item.save }
                    : item.out ? { print:item.out }
                    : item.pop ? { pop:true }
                    : item.reset ? { reset:true }
                    : { print:'ok' };
        if (item.d){
          node.cmd = item.d;              // 命令本身的说明
          if (node.type === 'keyword') node.help = item.d;
        }
        if (item.info) node.info = item.info;
      }
      nodes = node.children;
    }
  });

  /* display / ping 在所有视图可用，共享同一棵子树 */
  var shared = out.user.nodes.filter(function(n){ return n.text === 'display' || n.text === 'ping'; });
  shared.forEach(function(n){ n.home = 'user'; });
  /* 和 VRP 一样：在任何视图里都能直接 interface x / vlan x 跳到另一个对象视图 */
  var jump = out.system.nodes.filter(function(n){ return n.text === 'interface' || n.text === 'vlan'; });
  jump.forEach(function(n){ n.home = 'system'; });
  Object.keys(out).forEach(function(id){
    if (id === 'user') return;
    shared.concat(jump).forEach(function(n){
      var has = out[id].nodes.some(function(x){ return x.text === n.text; });
      if (!has){ n.shared = true; out[id].nodes.push(n); }
    });
  });

  /* 关键字没有单独说明时：若它只通向一条命令，就沿用那条命令的注释，
     这样 ? 列表里不会出现大片空白 */
  function collectLeaves(node, acc){
    (node.children || []).forEach(function(c){
      if (c.type === 'keyword' && !c.children.length) acc.push(c);
      else if (c.children && c.children.length) collectLeaves(c, acc);
      else if (c.cmd || c.info) acc.push(c);
    });
  }
  function fillHelp(nodes){
    nodes.forEach(function(n){
      if (n.children && n.children.length) fillHelp(n.children);
      if (n.type !== 'keyword' || n.help) return;
      var leaves = [];
      collectLeaves(n, leaves);
      if (leaves.length === 1){
        var lf = leaves[0];
        var t = (lf.cmd || (lf.info && lf.info.brief) || lf.help || '');
        if (t) n.help = t.split('。')[0];
      }
    });
  }
  Object.keys(out).forEach(function(id){ fillHelp(out[id].nodes); });

  return out;
}

var VIEWS = buildViews();

/* ============ 3. 解析引擎 ============ */

/* 3.1 把 "g 0/0/0" 合并成 "g0/0/0"（接口名带空格是 VRP 的合法写法） */
function mergeTokens(toks){
  var out = [];
  for (var i=0;i<toks.length;i++){
    var t = toks[i], nx = toks[i+1], n2 = toks[i+2];
    // 10 to 20 视为一个 VLAN 范围
    if (nx && n2 && /^\d+$/.test(t) && /^to$/i.test(nx) && /^\d+$/.test(n2)){
      out.push(t + 'to' + n2); i += 2; continue;
    }
    // g 0/0/0 → g0/0/0（接口名中间带空格是 VRP 合法写法）
    if (nx && /^(g|ge|gi|gigabitethernet|xge|10ge|xgigabitethernet|eth-trunk|etrunk|loopback|lo|vlanif|serial|s|null)$/i.test(t)
        && /^\d+(\/\d+)*$/.test(nx)){
      out.push(t + nx); i++;
    } else out.push(t);
  }
  return out;
}

function validateParam(node, value){
  var P = PARAMS[node.param];
  if (!P || !P.check) return { ok:true };
  return P.check(value, node);
}

/* 3.2 解析一行命令：返回 {tokens, path, cur, err, action} */
function analyze(viewId, raw){
  var toks = mergeTokens(String(raw || '').trim() ? String(raw).trim().split(/\s+/) : []);
  var cur = (VIEWS[viewId] || V_USER).nodes;
  var path = [];
  var err = null;

  for (var i=0;i<toks.length;i++){
    var tok = toks[i];

    /* --- 关键字：精确 / 别名 / 唯一前缀 --- */
    var exact = [], pre = [];
    for (var a=0;a<cur.length;a++){
      var n = cur[a];
      if (n.type !== 'keyword' || !n.text) continue;
      var hitExact = eq(n.text, tok) || (n.alias || []).some(function(x){ return eq(x, tok); });
      if (hitExact) exact.push(n);
      else if (starts(n.text, tok)) pre.push(n);
    }
    var pool = exact.length ? exact : (pre.length === 1 ? pre : []);

    if (!pool.length && pre.length > 1){
      err = { index:i, token:tok, kind:'ambiguous',
              msg:'Ambiguous command found at \'^\' position.',
              detail:'缩写匹配到多条命令，需要再多输入几个字母',
              hint:'"' + tok + '" 有歧义，可能是：' + pre.map(function(n){ return n.text; }).join(' / '),
              expect: pre.map(function(n){ return n.text; }) };
      break;
    }

    if (pool.length){
      var pick = pool[0];
      if (pool.length > 1 && toks[i+1]){
        for (var b=0;b<pool.length;b++){
          var ch = pool[b].children || [];
          for (var c=0;c<ch.length;c++){
            if (ch[c].type === 'keyword' && (eq(ch[c].text, toks[i+1]) || starts(ch[c].text, toks[i+1]))){ pick = pool[b]; }
          }
        }
      }
      path.push({ node:pick, value:tok, kind:'keyword', display:pick.text });
      cur = pick.children || [];
      continue;
    }

    /* --- 参数 --- */
    var paramNodes = cur.filter(function(n){ return n.type === 'param'; });
    if (paramNodes.length){
      var hit = null, firstErr = null;
      for (var d=0;d<paramNodes.length;d++){
        var v = validateParam(paramNodes[d], tok);
        if (v.ok){ hit = { node:paramNodes[d], v:v }; break; }
        if (!firstErr) firstErr = { node:paramNodes[d], v:v };
      }
      if (hit){
        path.push({ node:hit.node, value:tok, kind:'param',
                    display:hit.v.canon || tok, note:hit.v.note || '', warn:hit.v.maskConfused });
        cur = hit.node.children || [];
        /* 可重复参数（VLAN 列表等）连续吃掉后续同类 token */
        if (hit.node.rep){
          while (i + 1 < toks.length){
            var nv = validateParam(hit.node, toks[i+1]);
            if (!nv.ok) break;
            i++;
            path.push({ node:hit.node, value:toks[i], kind:'param',
                        display:nv.canon || toks[i], note:nv.note || '' });
          }
        }
        continue;
      }
      /* 与 VRP 一致：类型/取值不对统一报 Wrong parameter，
         中文原因放到 detail/hint 里，终端在下一行用 ↳ 带出来 */
      err = { index:i, token:tok, kind:'param', node:firstErr.node,
              msg:'Wrong parameter found at \'^\' position.',
              detail:firstErr.v.msg,
              fix:firstErr.v.hint || '',
              hint:(firstErr.v.msg || '') + (firstErr.v.hint ? '；' + firstErr.v.hint : ''),
              maskConfused:firstErr.v.maskConfused };
      break;
    }

    /* 命令已经写完整了还继续输入 → Too many parameters（VRP 的实际报法） */
    if (!cur.length && path.length){
      err = { index:i, token:tok, kind:'toomany',
              msg:'Too many parameters found at \'^\' position.',
              detail:'命令已经写完整了，后面多出了参数' };
      break;
    }

    err = { index:i, token:tok, kind:'unknown',
            msg:'Unrecognized command found at \'^\' position.',
            detail:'这里没有这条命令，检查拼写，或按 ? 看当前可用的命令',
            expect: cur.filter(function(n){ return n.type === 'keyword' && n.text; }).map(function(n){ return n.text; }) };
    break;
  }

  var last = path.length ? path[path.length-1].node : null;
  return {
    tokens: toks, path: path, cur: cur, err: err,
    action: last && last.action ? last.action : null,
    node: last
  };
}

/* 3.3 把缩写还原成完整命令：关键字取规范拼写，参数取规范化后的值
   （int g 0/0/1 → interface GigabitEthernet0/0/1） */
function canonical(res){
  if (!res || !res.path || !res.path.length) return '';
  return res.path.map(function(p){
    return p.kind === 'keyword' ? p.node.text : (p.display || p.value);
  }).join(' ');
}

/* 3.3a 补全建议：{items, prefix, base, ctx} */
function suggest(viewId, raw){
  var s = String(raw == null ? '' : raw);
  var trailing = /\s$/.test(s) || s === '';
  var base, prefix;
  if (trailing){ base = s.trim(); prefix = ''; }
  else {
    var k = s.lastIndexOf(' ');
    base = k < 0 ? '' : s.slice(0, k).trim();
    prefix = k < 0 ? s : s.slice(k + 1);
  }

  var ctx = analyze(viewId, base);
  var nodes = ctx.cur || [];
  var kws = [], params = [];

  for (var i=0;i<nodes.length;i++){
    var n = nodes[i];
    if (n.type === 'keyword'){
      if (!n.text) continue;
      var ok = !prefix || starts(n.text, prefix) || (n.alias || []).some(function(x){ return starts(x, prefix); });
      if (ok) kws.push({ kind:'kw', text:n.text, label:n.text, help:n.help, node:n });
    } else {
      var P = PARAMS[n.param] || {};
      params.push({ kind:'param', label:P.label || n.param, role:n.role || '',
                    sample:n.sample || P.sample || (n.options && n.options[0]) || '',
                    help:n.help || P.hint || '', node:n });
    }
  }
  return { items: kws.concat(kws.length ? [] : params), kws:kws, params:params,
           prefix:prefix, base:base, ctx:ctx, trailing:trailing };
}

function commonPrefix(arr){
  if (!arr.length) return '';
  var p = arr[0];
  for (var i=1;i<arr.length;i++){
    var s = arr[i];
    while (s.toLowerCase().indexOf(p.toLowerCase()) !== 0 && p.length) p = p.slice(0, -1);
  }
  return p;
}

/* 3.3b 参数候选值：枚举取 options，接口名之类给多个常见样本，其余给单个样本 */
function paramValues(node){
  var P = PARAMS[node.param] || {};
  if (node.options && node.options.length) return node.options.slice();
  if (P.samples && P.samples.length) return P.samples.slice();
  var one = node.sample || P.sample;
  return one ? [one] : [];
}

/* 3.4 命令库枚举 */
function enumerate(){
  var out = [], seen = {};
  function walk(viewId, nodes, tmpl, sample, chain){
    for (var i=0;i<nodes.length;i++){
      var n = nodes[i], isKw = n.type === 'keyword';
      var t2 = isKw ? (tmpl + (tmpl ? ' ' : '') + n.text) : (tmpl + (tmpl ? ' ' : '') + '⟨' + (n.role || (PARAMS[n.param]||{}).label || n.param) + '⟩');
      var s2 = isKw ? (sample + (sample ? ' ' : '') + n.text)
                    : (sample + (sample ? ' ' : '') + (n.sample || (PARAMS[n.param]||{}).sample || (n.options && n.options[0]) || ''));
      var ch = n.children || [];
      if (!ch.length){
        var key = viewId + '|' + t2;
        var trivial = (n.type === 'keyword' && (n.text === 'quit' || n.text === 'return'));
        if (!seen[key] && t2 && !trivial){
          seen[key] = 1;
          out.push({ view:viewId, syntax:t2, sample:s2, brief:deepBrief(n) || n.cmd || n.help || '',
                     node:n });
        }
      } else walk(viewId, ch, t2, s2, chain);
    }
  }
  for (var v in VIEWS){
    /* display / ping 是共享子树，只在用户视图下统计一次，否则会重复 25 遍 */
    var vn = VIEWS[v].nodes.filter(function(n){ return !n.home || n.home === v; });
    walk(v, vn, '', '', []);
  }
  return out;
}

function deepBrief(node){
  var info = findInfo(node);
  return info && info.brief ? info.brief : '';
}

/* 3.5 沿路径找最近的 info */
function findInfo(){
  for (var i=arguments.length-1;i>=0;i--){
    var n = arguments[i];
    if (n && n.info) return n.info;
  }
  return null;
}

function pathInfo(path){
  var nodes = path.map(function(p){ return p.node; });
  return findInfo.apply(null, nodes);
}

/* 3.6 视图祖先链（用于渲染分层上下文） */
function viewChain(viewId){
  var chain = [], id = viewId, guard = 0;
  while (id && VIEWS[id] && guard++ < 10){
    chain.unshift(id);
    var e = VIEWS[id].enter;
    id = e ? e.from : null;
  }
  return chain;
}

function maskInfo(v){
  if (!isIp(v)) return null;
  var b = toBits(v);
  var contiguous = /^1*0*$/.test(b);
  return {
    value: v,
    bits: b.replace(/(.{8})/g, '$1 ').trim(),
    contiguous: contiguous,
    prefix: contiguous ? prefixOf(v) : null,
    wildcard: fromBits(invBits(b)),
    kind: contiguous && v !== '0.0.0.0' && v !== '255.255.255.255' ? 'mask' : 'other'
  };
}

return {
  PARAMS: PARAMS, VIEWS: VIEWS, VIEWMETA: VIEWMETA, SPEC: SPEC,
  analyze: analyze, suggest: suggest, commonPrefix: commonPrefix, paramValues: paramValues,
  canonical: canonical,
  enumerate: enumerate, viewChain: viewChain, pathInfo: pathInfo,
  isIp: isIp, isMask: isMask, maskInfo: maskInfo, wildcardOf: wildcardOf,
  esc: esc, mergeTokens: mergeTokens
};
})();
if (typeof window !== 'undefined') window.VRP = VRP;
if (typeof module !== 'undefined' && module.exports) module.exports = VRP;
