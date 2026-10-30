/* ============================================================
   码典 · eNSP 预设（整套代码） + 排查工作流 + 高亮关键字
   ------------------------------------------------------------
   预设的 steps[].ref 必须指向真实存在的片段 id（内置的或本目录新增的），
   拼错了点进去会找不到代码。改动时先在 data.js / ensp 分片里搜一下 id。
   ============================================================ */
(function (E) {
  'use strict';

  /* ---------------- 预设：整套配置 ---------------- */
  E.presets.push(

    {
      id: 'preset-enterprise-core',
      title: '企业网核心：三层互通 + 网关冗余 + 双上行',
      summary: '两台核心做 VRRP 网关冗余和 OSPF，下联接入用链路聚合双上行，一台设备挂掉业务不断。',
      features: ['VRRP 主备网关', 'OSPF 单区域', 'LACP 双上行', 'DHCP 集中分配'],
      steps: [
        { ref: 'vlan-batch', label: '核心：批量建业务 VLAN', vars: {} },
        { ref: 'eth-trunk-lacp', label: '核心↔接入：LACP 聚合', vars: { trunkId: '1', maxActive: '8' } },
        { ref: 'svi', label: '核心：配 VLAN 网关', vars: {} },
        { ref: 'vrrp-bfd', label: '核心 A/B：VRRP 网关冗余', vars: { priority: '120' } },
        { ref: 'dhcp-pool', label: '核心：DHCP 地址池', vars: {} },
        { ref: 'ospf-single-area', label: '核心：OSPF 打通三层', vars: { procId: '1' } },
        { ref: 'stp-protect', label: '接入：生成树保护', vars: {} }
      ],
      docs: {
        secs: [
          { h: '顺序不能乱', p: '先建 VLAN 再配聚合口，聚合口通了才配 SVI 和 VRRP。VRRP 之前必须保证两台核心的二层是通的，否则两个 Master 同时存在。' },
          { h: '最容易漏的一步', p: 'VRRP 配了但没配 track，核心上行断了它还是 Master，终端全部黑洞。至少 track 上联口。' }
        ]
      }
    },

    {
      id: 'preset-ipv6-dual',
      title: 'IPv6 双栈开局',
      summary: '现网不动 IPv4，新增 IPv6 地址与路由，两端网段用 OSPFv3 互通。',
      features: ['IPv6 地址与 RA', 'OSPFv3', 'DHCPv6', 'ACL 放行'],
      steps: [
        { ref: 'ipv6-basic', label: '网关：IPv6 地址 + RA', vars: {} },
        { ref: 'dhcpv6', label: '网关：DHCPv6 下发', vars: {} },
        { ref: 'ipv6-ospfv3', label: '三层设备：OSPFv3', vars: {} },
        { ref: 'ipv6-basic', label: '对端：对称配置', vars: {} }
      ],
      docs: {
        secs: [
          { h: '两个地址体系要分开想', p: 'IPv4 用 OSPFv2 还是静态，跟 IPv6 完全不相关。别指望配了一个另一个自动好。' },
          { h: '终端拿不到地址先看 RA', p: '接口是不是忘了 undo ipv6 nd ra halt。这一条占了 IPv6 实验失败原因的一半。' }
        ]
      }
    },

    {
      id: 'preset-bgp-dual-homing',
      title: 'BGP 双出口（主备 + 属性调优）',
      summary: '两条运营商链路，用 local-preference 选主用、AS_PATH 影响回程，出问题自动切换。',
      features: ['双 eBGP 邻居', 'Local-Preference 主备', 'AS_PATH 调优', '路由策略过滤'],
      steps: [
        { ref: 'bgp-ebgp', label: '出口 A：eBGP 邻居', vars: { localAs: '65001', peerAs: '65002' } },
        { ref: 'bgp-ebgp', label: '出口 B：eBGP 邻居', vars: { localAs: '65001', peerAs: '65003' } },
        { ref: 'bgp-attr', label: '主备选择：Local-Pref', vars: { localPref: '200' } },
        { ref: 'route-policy', label: '路由过滤：只发自己的网段', vars: {} },
        { ref: 'bfd-static', label: '链路检测：BFD 联动', vars: {} }
      ],
      docs: {
        secs: [
          { h: '出方向靠 LP，入方向靠 MED', p: '想让自己的流量走 A 出口，在进口方向抬 LP；想让对方从 B 链路进来，在出口方向设小 MED。两个方向要分别配。' },
          { h: '别忘了过滤', p: '不做 route-policy 过滤，私网地址和不该宣告的网段都会发到公网，属于典型事故。' }
        ]
      }
    },

    {
      id: 'preset-mpls-vpn-pe',
      title: 'MPLS VPN：PE 侧开局',
      summary: '一台 PE 从零配上 VRF、MPLS/LDP、MP-BGP，接到运营商骨干。',
      features: ['MPLS + LDP', 'VRF 隔离', 'MP-BGP VPNv4', 'PE-CE 接入'],
      steps: [
        { ref: 'mpls-ldp', label: '骨干：MPLS + LDP', vars: {} },
        { ref: 'mpls-vpn', label: 'PE：VRF + VPNv4', vars: {} },
        { ref: 'ospf-single-area', label: '骨干：IGP 打通 LSR', vars: {} },
        { ref: 'diag-commands', label: '验收：三张表都要看', vars: {} }
      ],
      docs: {
        secs: [
          { h: '顺序：IGP → LDP → VRF → MP-BGP', p: 'LDP 依赖 IGP 的 Loopback 路由；VPNv4 依赖 LDP 的标签。任何一步跳过去，后面配得再对也不通。' },
          { h: '控制面通不代表业务通', p: 'BGP VPNv4 邻居 Established 只说明路由传了，数据面还要看 mpls lsp 有没有标签。' }
        ]
      }
    },

    {
      id: 'preset-wlan-office',
      title: '无线办公：AC + AP 全套下发',
      summary: '从 DHCP 到 AP 上线、SSID 下发，一次配完一层楼的无线覆盖。',
      features: ['AP 自动上线', 'SSID + WPA2', '业务 VLAN 隔离', '射频调优'],
      steps: [
        { ref: 'dhcp-option-43', label: 'DHCP：带 Option 43 发地址', vars: {} },
        { ref: 'wlan-ac-basic', label: 'AC：三个模板下发', vars: {} },
        { ref: 'wlan-ap-radio', label: 'AC：信道与功率', vars: {} },
        { ref: 'ssh-hardening', label: 'AC：管理面加固', vars: {} }
      ],
      docs: {
        secs: [
          { h: '先让 AP 拿到地址', p: 'AP 上电第一件事是 DHCP。地址拿不到，后面所有配置都白搭，先看 display ap all 的 IP 字段。' },
          { h: '射频规划决定体验', p: '同楼层相邻 AP 用 1/6/11 交错，功率不要盲目拉满。密集办公区把功率调小、AP 加密反而体验更好。' }
        ]
      }
    }

  );

  /* ---------------- 工作流：排查树 ---------------- */
  E.flows.push(

    {
      id: 'isis-neighbor',
      title: 'IS-IS 邻居起不来？按这五条查',
      summary: '从链路、级别、NET 一路查到认证，90% 的问题在前三步。',
      root: 'n1',
      nodes: {
        n1: { kind: 'q', label: '两台设备直连，ping 得通吗？', note: 'display isis interface 看接口是否 UP、是否使能', children: ['n2', 'n3'] },
        n2: { kind: 'o', label: 'ping 不通', body: '三层都没通就不用看 IS-IS。先确认接口 IP 同网段、接口没被 shutdown、中间没有 ACL 拦截。', children: ['n4'] },
        n4: { kind: 'end', label: '先修三层连通性', note: '接口 IP / 掩码 / shutdown 状态' },
        n3: { kind: 'q', label: 'display isis peer 里状态是什么？', note: 'Up 是正常，Initializing 说明 hello 收到了但协商失败', children: ['n5', 'n6'] },
        n5: { kind: 'o', label: '一片空白（没有邻居记录）', body: 'hello 根本没收到。查 isis enable 有没有配在接口上、两端 circuit-level 是否一致、接口是否被 silent-interface 抑制。', children: ['n7'] },
        n7: { kind: 'end', label: '级别不匹配或接口没使能', note: '两端 circuit-level 必须能对上：都 level-2，或一 level-1-2 一 level-1' },
        n6: { kind: 'q', label: '一直 Initializing / 反复震荡', note: '', children: ['n8', 'n9'] },
        n8: { kind: 'warn', label: '两台 NET 的 SystemID 是否相同？', body: 'SystemID 重复会导致 LSP ID 冲突，邻接反复建了又断。NET 中间那 12 位十六进制必须全网唯一。', children: ['n10'] },
        n10: { kind: 'end', label: '改 SystemID 后重启 IS-IS 进程', note: 'reset isis all 再观察' },
        n9: { kind: 'end', label: '检查认证', note: 'area-authentication-mode / domain-authentication-mode 两端是否一致；不一致会静默丢弃 hello，日志里只写 rejected' }
      }
    },

    {
      id: 'bgp-neighbor',
      title: 'BGP 邻居建不起来？按状态定位',
      summary: 'Idle / Connect / Active / OpenSent 各有各的原因，别看结果瞎改配置。',
      root: 'n1',
      nodes: {
        n1: { kind: 'q', label: 'display bgp peer 里 State 是什么？', note: '先看状态再动手，不同状态病因完全不同', children: ['n2', 'n3', 'n6'] },
        n2: { kind: 'o', label: 'Idle', body: '连尝试都没开始。常见于：没配 peer、peer 地址写错、路由到对端不可达、没有去往对端的路由。', children: ['n4'] },
        n4: { kind: 'end', label: '先修 peer 配置和到对端的路由', note: 'ping 得通对端地址再回来看 BGP' },
        n3: { kind: 'o', label: 'Active / Connect', body: '在尝试建 TCP 179 但失败。三种可能：对端没配 peer 指回来、中间防火墙挡了 179、eBGP 跨设备没配 ebgp-max-hop。', children: ['n5'] },
        n5: { kind: 'end', label: '双向都要配 peer', note: 'BGP 不是单向协议，只配一边永远建不起来' },
        n6: { kind: 'q', label: 'OpenSent / OpenConfirm 卡住', note: '', children: ['n7', 'n8'] },
        n7: { kind: 'warn', label: 'AS 号对不上？', body: '对端期望的 AS 和你配的不一致，会回 Open 错误。eBGP 两端 AS 相同也会被拒。', children: ['n9'] },
        n9: { kind: 'end', label: '核对两端 as-number', note: 'display bgp peer verbose 能看到对端 AS' },
        n8: { kind: 'end', label: 'Router ID 冲突或认证失败', note: '两台 RID 相同会直接断；配了 password 但两端不一致，报 authentication failure' }
      }
    },

    {
      id: 'mpls-vpn-trouble',
      title: 'MPLS VPN 业务不通：分控制面和转发面查',
      summary: '邻居 Up 但 ping 不通，八成是标签或 RT 的问题，不是 BGP。',
      root: 'n1',
      nodes: {
        n1: { kind: 'q', label: 'PE 之间 VPNv4 邻居 Established 吗？', note: 'display bgp vpnv4 all peer', children: ['n2', 'n3'] },
        n2: { kind: 'o', label: '不是 Established', body: '控制面就没通。查 Loopback 互通、ipv4-family vpnv4 下有没有 peer x enable、两边 AS 是否一致。', children: ['n4'] },
        n4: { kind: 'end', label: '先把 VPNv4 邻居建起来', note: '注意普通 IPv4 邻居 Up 不代表 VPNv4 也 Up' },
        n3: { kind: 'q', label: 'VRF 路由表里有对端网段吗？', note: 'display ip routing-table vpn-instance XXX', children: ['n5', 'n6'] },
        n5: { kind: 'warn', label: '没有路由', body: 'RT 不匹配是最常见原因：本端 export 的 RT 必须出现在对端 import 列表里。也可能 CE 侧没把路由引进来。', children: ['n7'] },
        n7: { kind: 'end', label: '两端 RT 成对配', note: 'vpn-target X both 是最省事的写法' },
        n6: { kind: 'q', label: '有路由但 ping 不通', note: '', children: ['n8', 'n9'] },
        n8: { kind: 'warn', label: 'display mpls lsp 有标签吗？', body: '没有标签说明 LDP 没跑通。骨干接口要同时开 mpls 和 mpls ldp，且 LSR ID 全网唯一。', children: ['n10'] },
        n10: { kind: 'end', label: '补 LDP：IGP → LDP → VPN', note: 'LDP 依赖 IGP 的 Loopback 路由可达' },
        n9: { kind: 'end', label: '查 CE 侧', note: 'PE-CE 之间是 BGP 还是静态？import-route 配了吗？CE 有没有回程路由到对端私网' }
      }
    },

    {
      id: 'wlan-ap-offline',
      title: 'AP 上线失败？按阶段拆开看',
      summary: '拿地址、找 AC、建隧道、拉配置——四步里断哪一步，display ap all 都告诉你。',
      root: 'n1',
      nodes: {
        n1: { kind: 'q', label: 'AP 拿到 IP 了吗？（display ap all 看 IP 字段）', note: '空或 0.0.0.0 表示第一步就失败了', children: ['n2', 'n3'] },
        n2: { kind: 'o', label: '没拿到地址', body: 'DHCP 问题。查 AP 口 trunk 的 pvid 是不是管理 VLAN、DHCP 池网段和接口地址是否同段、接口有没有 dhcp select。', children: ['n4'] },
        n4: { kind: 'end', label: '先让 AP 拿到管理地址', note: 'AP 口的 pvid 必须是管理 VLAN，最容易忘' },
        n3: { kind: 'q', label: 'State 显示什么？', note: 'nor 才是正常上线', children: ['n5', 'n6'] },
        n5: { kind: 'warn', label: '一直 flap / 未认证', body: 'AP 找不到 AC。查 capwap source interface 配了没、和 AP 是否可达、中间是否放通 UDP 5246/5247。', children: ['n7'] },
        n7: { kind: 'end', label: '修 CAPWAP 可达性', note: 'AC 上 display capwap configuration 确认源接口' },
        n6: { kind: 'q', label: '上线了但搜不到 SSID', note: '', children: ['n8', 'n9'] },
        n8: { kind: 'end', label: '检查 VAP 是否绑到 AP 组', note: 'ap-group 下没绑 vap-profile，AP 上线也没有无线信号' },
        n9: { kind: 'end', label: '检查 AP 是否在对应组里', note: 'AP 默认进 default 组；自定义组要手工把 AP 加进去' }
      }
    },

    {
      id: 'acl-not-working',
      title: '配了 ACL 却不生效',
      summary: '规则对不对、方向对不对、挂没挂上去——三个地方必查一个。',
      root: 'n1',
      nodes: {
        n1: { kind: 'q', label: 'ACL 真的被调用了吗？', note: 'display current-configuration | include traffic-filter', children: ['n2', 'n3'] },
        n2: { kind: 'o', label: '没挂到任何接口/策略上', body: 'ACL 只是规则集合，不挂上去什么也不做。三层过滤用 traffic-filter inbound acl，或者挂进 traffic policy。', children: ['n4'] },
        n4: { kind: 'end', label: '挂到接口入方向', note: 'inbound 管进来的流量，outbound 管出去的' },
        n3: { kind: 'q', label: 'display acl 里 matches 计数在涨吗？', note: '', children: ['n5', 'n6'] },
        n5: { kind: 'warn', label: '计数不动 = 没命中', body: '规则写的匹配条件和实际流量对不上。常见：源/目的写反了、反掩码算错、协议选错（tcp 写成 ip）、端口写错。', children: ['n7'] },
        n7: { kind: 'end', label: '逐条简化验证', note: '先写 rule permit ip 全放通，确认能通，再一条条收紧' },
        n6: { kind: 'q', label: '命中但不生效', note: '', children: ['n8', 'n9'] },
        n8: { kind: 'end', label: '检查规则顺序', note: 'ACL 从上到下匹配，命中即停。permit 写在 deny 前面，deny 永远轮不到' },
        n9: { kind: 'end', label: '检查末尾隐式 deny', note: 'ACL 末尾默认拒绝一切。只写了一条 deny，等于把所有流量都挡了' }
      }
    }

  );

  /* ---------------- 高亮关键字（协议 / 命令词） ---------------- */
  E.kw.push(
    'isis', 'is-level', 'network-entity', 'circuit-level',
    'bgp', 'as-number', 'router-id', 'reflect-client', 'vpnv4', 'advertise-community',
    'community-filter', 'local-preference', 'as-path', 'bestpath',
    'mpls', 'ldp', 'lsr-id', 'vpn-instance', 'route-distinguisher', 'vpn-target', 'ip binding',
    'ipsec', 'ike', 'proposal', 'pre-shared-key', 'tunnel-protocol', 'gre',
    'pim', 'igmp', 'multicast', 'static-rp',
    'capwap', 'ssid-profile', 'security-profile', 'vap-profile', 'ap-group', 'wlan',
    'hrp', 'security-policy', 'firewall', 'zone',
    'ospfv3', 'dhcpv6', 'ipv6',
    'bfd', 'vrrp', 'eth-trunk', 'lacp', 'qinq', 'qos', 'car',
    'route-policy', 'traffic-filter', 'traffic-policy', 'traffic-classifier', 'traffic-behavior',
    'loop-detection', 'smart-link', 'stack', 'super-vlan', 'mux-vlan', 'aggregate-vlan'
  );
})(window.__ENSP);
