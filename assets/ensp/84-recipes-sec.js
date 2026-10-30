/* ============================================================
   码典 · 配置剧本（三）安全 / VPN / 组播 / WLAN / 综合
   ------------------------------------------------------------
   这一批都是「配完不一定通、通了一定有原因」的场景：
   ACL 方向搞反、NAT 少了 inside、隧道两端提议不一致、PIM 少了 RP。
   剧本里把每条命令放在它真正该在的视图里，顺序就是排查顺序。
   ============================================================ */
(function (E) {
  'use strict';

  E.recipes.push(

    /* ==================== ACL ==================== */
    {
      id: 'rec-acl-basic',
      title: '基本 ACL：限制谁能访问',
      scene: '只允许某个网段 telnet 登录，其他一律拒绝',
      level: '入门',
      tags: ['acl', '基本acl', '2000', '访问控制'],
      steps: [
        { c: 'system-view' },
        { c: 'acl 2000', note: '基本 ACL 号段 2000-2999，只匹配源 IP' },
        { c: 'rule 5 permit source 192.168.10.0 0.0.0.255', note: 'rule 号小的先匹配，步长建议留间隔方便插队' },
        { c: 'rule 10 deny source any', note: '最后一条拒绝所有。ACL 默认放行，不写这条等于没限制' },
        { c: 'quit' },
        { c: 'user-interface vty 0 4' },
        { c: 'acl 2000 inbound', note: '在 VTY 上应用，方向 inbound 表示进来的连接' },
        { c: 'quit' },
        { c: 'display acl 2000', note: '看规则的匹配计数' }
      ],
      verify: [
        { cmd: 'display acl 2000', hope: '每条规则后面有匹配计数，能看出哪条命中' }
      ],
      pitfalls: [
        '忘了 deny any：ACL 末尾隐含 permit，等于什么都没拦',
        '源地址掩码写成 255.255.255.0：ACL 用的是反掩码 0.0.0.255',
        'ACL 配了没应用：规则是对的，但没挂到接口或 VTY 上就不生效'
      ]
    },

    {
      id: 'rec-acl-adv',
      title: '高级 ACL：按协议和端口过滤',
      scene: '禁止某网段访问服务器的 80 端口，其他不限',
      level: '进阶',
      tags: ['acl', '高级acl', '3000', '端口', '流量过滤'],
      steps: [
        { c: 'system-view' },
        { c: 'acl 3000', note: '高级 ACL 3000-3999，能匹配源/目的 IP、协议、端口' },
        { c: 'rule 5 deny tcp source 192.168.10.0 0.0.0.255 destination 192.168.20.10 0 destination-port eq 80', note: 'destination 后面那个 0 是反掩码，表示精确匹配单台主机' },
        { c: 'rule 10 permit ip', note: '放行其他所有流量' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/1' },
        { c: 'traffic-filter inbound acl 3000', note: '在接口上应用，inbound 是进入这个口的方向' },
        { c: 'quit' },
        { c: 'display acl 3000' },
        { c: 'display traffic-filter applied-record', note: '确认 ACL 真的挂上去了' }
      ],
      verify: [
        { cmd: 'display traffic-filter applied-record', hope: '能看到接口 + 方向 + ACL 号' },
        { cmd: 'display acl 3000', hope: 'deny 规则的匹配计数在涨' }
      ],
      pitfalls: [
        'destination 写成 255.255.255.255：那是匹配所有目的，跟你想的相反',
        '规则顺序反了：permit ip 写在 deny 前面，deny 永远不生效',
        '方向搞反：inbound 是别人进我，outbound 是我出去。写反了完全没效果'
      ]
    },

    /* ==================== NAT ==================== */
    {
      id: 'rec-nat-easyip',
      title: 'NAT Easy IP：整个内网共享一个公网地址',
      scene: '家里/小公司只有一条拨号线路，内网所有设备共用一个公网 IP 上网',
      level: '入门',
      tags: ['nat', 'easy-ip', '地址转换', '上网'],
      steps: [
        { c: 'system-view' },
        { c: 'acl 2000' },
        { c: 'rule 5 permit source 192.168.10.0 0.0.0.255', note: '只给这个网段做转换，别把所有流量都 NAT 出去' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/1', note: '接公网的那个口' },
        { c: 'nat outbound 2000', note: 'Easy IP 不用配地址池，直接用这个接口的地址' },
        { c: 'quit' },
        { c: 'ip route-static 0.0.0.0 0.0.0.0 100.64.0.1', note: '默认路由指向运营商对端网关，这里填你自己那条线的对端地址' },
        { c: 'display nat session all', note: '有会话说明 NAT 在工作' }
      ],
      verify: [
        { cmd: 'display nat session all', hope: '能看到内网地址被转换成公网地址的会话' },
        { cmd: 'display nat outbound', hope: '出方向 ACL 2000 已生效' }
      ],
      pitfalls: [
        'nat outbound 配在内网口：方向完全反了，一个包都转不出去',
        'ACL 写成本网段以外：内网流量不匹配规则，NAT 不生效',
        'NAT 只改源地址：回来的包靠会话表回程，会话超时后就断了'
      ]
    },

    {
      id: 'rec-nat-server',
      title: 'NAT Server：把内网服务器发布出去',
      scene: '内网有台 Web 服务器，要让外网能访问',
      level: '进阶',
      tags: ['nat', 'nat-server', '端口映射', '发布'],
      steps: [
        { c: 'system-view' },
        { c: 'interface GigabitEthernet0/0/1', note: '公网口' },
        { c: 'nat server protocol tcp global current-interface 8080 inside 192.168.10.100 80', note: '外网访问公网IP:8080 → 转到内网 80 端口' },
        { c: 'quit' },
        { c: 'display nat server', note: '确认映射关系建对了' },
        { c: 'display nat session all', note: '外网访问时这里应该有会话' }
      ],
      verify: [
        { cmd: 'display nat server', hope: 'Global 地址和 Inside 地址都正确' }
      ],
      pitfalls: [
        '发布到外网但没放行 ACL：安全策略或 ACL 把流量挡在 NAT 之前',
        '内网服务器没配网关：包能进去，回不来',
        '端口冲突：8080 已被设备自身的管理端口占用，换一个'
      ]
    },

    /* ==================== VPN ==================== */
    {
      id: 'rec-gre',
      title: 'GRE 隧道：把两个私网连起来',
      scene: '两个分支机构，中间隔着公网，要像一个内网一样互通',
      level: '高级',
      tags: ['gre', '隧道', 'tunnel', 'vpn'],
      scope: '两端对称，Tunnel 地址互指',
      steps: [
        { c: 'system-view' },
        { c: 'interface Tunnel0/0/0', note: 'Tunnel 是逻辑接口，编号自己定' },
        { c: 'ip address 172.16.0.1 30', note: '隧道内互联地址，两端同网段' },
        { c: 'tunnel-protocol gre', note: 'GRE 封装' },
        { c: 'source 10.0.0.1', note: '隧道起点：本端公网地址或出接口' },
        { c: 'destination 20.0.0.2', note: '隧道终点：对端公网地址' },
        { c: 'quit' },
        { c: 'ip route-static 192.168.20.0 24 Tunnel0/0/0', note: '把对端私网路由指向隧道' },
        { c: 'display interface Tunnel0/0/0', note: '两端 source/destination 互为逆序时，接口才 up' }
      ],
      verify: [
        { cmd: 'display interface Tunnel0/0/0', hope: 'Line protocol current state 是 UP' }
      ],
      pitfalls: [
        'source / destination 填反：Tunnel 一直 down，这是 GRE 最常见的错',
        '隧道 down 但两端能 ping 通公网：检查是不是某一端禁止了 GRE 协议（协议号 47）',
        '隧道内网段和现网重合：地址冲突，路由混乱'
      ]
    },

    {
      id: 'rec-ipsec',
      title: 'IPSec VPN：加密隧道',
      scene: '两地之间走公网，要求数据全程加密',
      level: '高级',
      tags: ['ipsec', 'ike', 'vpn', '加密', '安全'],
      scope: '两端提议必须完全一致',
      steps: [
        { c: 'system-view' },
        { c: 'acl 3000', note: '定义哪些流量要走 VPN（感兴趣流）' },
        { c: 'rule 5 permit ip source 192.168.10.0 0.0.0.255 destination 192.168.20.0 0.0.0.255' },
        { c: 'quit' },
        { c: 'ike proposal 1', note: '第一阶段提议' },
        { c: 'encryption-algorithm aes-256', note: '两端必须完全相同，不一致协商失败' },
        { c: 'authentication-algorithm sha2-256' },
        { c: 'dh group14' },
        { c: 'quit' },
        { c: 'ike peer PEER1 v1', note: 'IKEv1 兼容性好，v2 更简洁' },
        { c: 'pre-shared-key cipher Huawei@123', note: '预共享密钥，两端必须一致' },
        { c: 'remote-address 20.0.0.2' },
        { c: 'quit' },
        { c: 'ipsec proposal IPSEC1' },
        { c: 'esp authentication-algorithm sha2-256' },
        { c: 'esp encryption-algorithm aes-256' },
        { c: 'quit' },
        { c: 'ipsec policy POL1 10 isakmp', note: '10 是序号，多条策略靠它排序' },
        { c: 'security acl 3000' },
        { c: 'ike-peer PEER1' },
        { c: 'proposal IPSEC1' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/1', note: '在公网出接口上应用' },
        { c: 'ipsec policy POL1' },
        { c: 'quit' },
        { c: 'display ike sa', note: '看第一阶段 SA 建立情况' },
        { c: 'display ipsec sa', note: '看第二阶段 SA，有 SA 才说明隧道通了' }
      ],
      verify: [
        { cmd: 'display ike sa', hope: 'Phase-1 状态 Established' },
        { cmd: 'display ipsec sa', hope: '有入方向和出方向的 SA' }
      ],
      pitfalls: [
        '两端提议不一致：IKE 阶段就失败，日志里是 NO_PROPOSAL_CHOSEN',
        'ACL 感兴趣流不对称：一端写 10网段→20网段，另一端写反，第二阶段起不来',
        '预共享密钥不一致：表现和提议不一致几乎一样，都要看日志'
      ]
    },

    /* ==================== MPLS ==================== */
    {
      id: 'rec-mpls-ldp',
      title: 'MPLS + LDP 基础',
      scene: '要跑 MPLS VPN，先把标签转发打通',
      level: '高级',
      tags: ['mpls', 'ldp', '标签', 'lsr-id'],
      steps: [
        { c: 'system-view' },
        { c: 'mpls lsr-id 1.1.1.1', note: '全网唯一，建议用 Loopback 地址，必须先配这个才能开 mpls' },
        { c: 'mpls', note: '全局使能' },
        { c: 'mpls ldp', note: '全局使能 LDP' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/0' },
        { c: 'mpls', note: '接口上再开一次，不配这行标签出不去' },
        { c: 'mpls ldp' },
        { c: 'quit' },
        { c: 'display mpls ldp session', note: 'Operational 才算建起来' },
        { c: 'display mpls lsp', note: '看标签转发表项' }
      ],
      verify: [
        { cmd: 'display mpls ldp session', hope: 'State = Operational' },
        { cmd: 'display mpls lsp', hope: '有 In/Out Label' }
      ],
      pitfalls: [
        'lsr-id 没配就开 mpls：命令直接报错',
        '只在全局开了接口没开：LDP 会话建得起来，但标签换不出去',
        'LDP 邻居靠 IGP 路由：底层 IGP 没通，LDP 也起不来'
      ]
    },

    {
      id: 'rec-mpls-vpn',
      title: 'MPLS VPN：VRF + MP-BGP',
      scene: '一张物理网承载多个客户，路由完全隔离',
      level: '高级',
      tags: ['mpls', 'vpn', 'vrf', 'rd', 'rt', 'mp-bgp'],
      steps: [
        { c: 'system-view', who: 'PE1' },
        { c: 'ip vpn-instance CUST-A', who: 'PE1', note: 'VRF，每个客户一个' },
        { c: 'route-distinguisher 100:1', who: 'PE1', note: 'RD 让不同 VRF 的相同前缀全局唯一，本身不控制发布范围' },
        { c: 'vpn-target 100:1 both', who: 'PE1', note: 'RT 才控制发布范围，两端要对得上' },
        { c: 'quit', who: 'PE1' },
        { c: 'interface GigabitEthernet0/0/1', who: 'PE1' },
        { c: 'ip binding vpn-instance CUST-A', who: 'PE1', note: '必须先 binding 再配 IP，否则地址会落到全局路由表' },
        { c: 'ip address 192.168.10.1 24', who: 'PE1' },
        { c: 'quit', who: 'PE1' },
        { c: 'bgp 100', who: 'PE1' },
        { c: 'peer 2.2.2.2 as-number 100', who: 'PE1' },
        { c: 'peer 2.2.2.2 connect-interface LoopBack0', who: 'PE1' },
        { c: 'ipv4-family vpnv4', who: 'PE1', note: 'VPNv4 地址族，必须开，不然 VPN 路由传不过去' },
        { c: 'peer 2.2.2.2 enable', who: 'PE1' },
        { c: 'quit', who: 'PE1' },
        { c: 'ipv4-family vpn-instance CUST-A', who: 'PE1', note: '把客户的路由引进 BGP' },
        { c: 'import-route direct', who: 'PE1' },
        { c: 'quit', who: 'PE1' },
        { c: 'display bgp vpnv4 all routing-table', who: 'PE1', note: '看 VPNv4 路由' },
        { c: 'display ip routing-table vpn-instance CUST-A', who: 'PE1', note: '看客户 VRF 里的路由' }
      ],
      verify: [
        { cmd: 'display bgp vpnv4 all peer', hope: 'VPNv4 邻居 Established' },
        { cmd: 'display ip routing-table vpn-instance CUST-A', hope: '学到了对端客户的网段' }
      ],
      pitfalls: [
        'RT 不匹配：VPNv4 路由收到了，但进不了 VRF 的路由表，表现为「明明有路由却不通」',
        'vpnv4 地址族没开：普通 IPv4 邻居 Established，VPN 路由一条都不传',
        '先配 IP 再 binding：地址留在全局路由表，客户流量走错表'
      ]
    },

    /* ==================== 组播 ==================== */
    {
      id: 'rec-multicast',
      title: '组播：IGMP + PIM-SM',
      scene: '视频会议/IPTV，一对多推送，组播省带宽',
      level: '高级',
      tags: ['组播', 'igmp', 'pim', 'multicast', 'rp'],
      steps: [
        { c: 'system-view' },
        { c: 'multicast routing-enable', note: '全局组播开关，不敲这条后面全报错' },
        { c: 'interface GigabitEthernet0/0/0', note: '接接收者的接口' },
        { c: 'pim sm', note: 'PIM-SM 是稀疏模式，需要 RP；PIM-DM 是密集模式，不需要' },
        { c: 'igmp enable', note: '面向终端的接口要开 IGMP' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/1', note: '面向组播源的接口' },
        { c: 'pim sm' },
        { c: 'quit' },
        { c: 'pim', note: '进 PIM 视图配 RP' },
        { c: 'static-rp 10.0.0.1', note: '指定 RP，全组播域内必须一致；用静态 RP 最省事' },
        { c: 'quit' },
        { c: 'display pim neighbor', note: '看 PIM 邻居' },
        { c: 'display igmp group', note: '看有没有终端加入组' }
      ],
      verify: [
        { cmd: 'display pim neighbor', hope: '邻居 Up' },
        { cmd: 'display multicast routing-table', hope: '有 (S,G) 或 (*,G) 表项' }
      ],
      pitfalls: [
        '忘了 multicast routing-enable：所有组播命令报错，但报错不够明显',
        'RP 不一致或没配：PIM-SM 全靠 RP 汇聚，没 RP 组播流量断了',
        '终端接口没开 igmp enable：PIM 邻居正常，但没人加入组，流量不下来'
      ]
    },

    /* ==================== WLAN ==================== */
    {
      id: 'rec-wlan-ac',
      title: 'WLAN：AC 上线 AP + 下发 SSID',
      scene: '无线实验，AP 要通过 AC 上线并广播信号',
      level: '高级',
      tags: ['wlan', 'ac', 'ap', 'ssid', 'capwap', '无线'],
      steps: [
        { c: 'system-view' },
        { c: 'vlan batch 100 200', note: '100 给 AP 管理，200 给业务' },
        { c: 'interface Vlanif100' },
        { c: 'ip address 192.168.100.1 24', note: 'AP 的管理地址网段' },
        { c: 'quit' },
        { c: 'dhcp enable', note: 'AP 要能拿到地址才能找 AC' },
        { c: 'ip pool AP' },
        { c: 'network 192.168.100.0 mask 255.255.255.0' },
        { c: 'gateway-list 192.168.100.1' },
        { c: 'option 43 sub-option 2 ip-address 192.168.100.1', note: '告诉 AP 的 AC 地址，跨网段上线必须配这条' },
        { c: 'quit' },
        { c: 'capwap source interface Vlanif100', note: 'AC 的 CAPWAP 源地址，必须配' },
        { c: 'wlan', note: '进 WLAN 视图' },
        { c: 'ap auth-mode no-auth', note: '实验环境免认证上线；生产用 mac-auth' },
        { c: 'quit' },
        { c: 'display ap all', note: 'State 是 nor 表示正常上线' }
      ],
      verify: [
        { cmd: 'display ap all', hope: 'State = nor，能看出 AP 型号和 IP' },
        { cmd: 'display capwap configuration', hope: '源接口是 Vlanif100' }
      ],
      pitfalls: [
        'capwap source interface 没配：AP 一直 State = fsm，反复重连',
        '跨网段没配 option 43：AP 拿不到地址就找不到 AC',
        'AC 上没建 AP 的 VLAN：管理网段都不通，AP 起不来'
      ]
    },

    /* ==================== 防火墙 ==================== */
    {
      id: 'rec-firewall-zone',
      title: '防火墙：安全区域 + 安全策略',
      scene: 'USG 防火墙串在网络里，默认什么都不通，要放行',
      level: '进阶',
      tags: ['防火墙', 'usg', 'zone', '安全策略', 'security-policy'],
      steps: [
        { c: 'system-view' },
        { c: 'firewall zone trust', note: '内网区域' },
        { c: 'add interface GigabitEthernet1/0/1' },
        { c: 'quit' },
        { c: 'firewall zone untrust', note: '外网区域' },
        { c: 'add interface GigabitEthernet1/0/2' },
        { c: 'quit' },
        { c: 'security-policy', note: 'USG6000 用 security-policy；老版本用 interzone' },
        { c: 'rule name ALLOW-OUT' },
        { c: 'source-zone trust', note: '从内到外' },
        { c: 'destination-zone untrust' },
        { c: 'action permit', note: '不配 action 默认拒绝' },
        { c: 'quit' },
        { c: 'quit' },
        { c: 'display security-policy rule all', note: '确认策略和命中计数' }
      ],
      verify: [
        { cmd: 'display firewall zone', hope: '接口已经加到对应区域' },
        { cmd: 'display security-policy rule all', hope: '策略存在且命中数在涨' }
      ],
      pitfalls: [
        '接口没加到区域：安全策略再对也不生效，流量直接被丢',
        '只配了单向策略：内到外通了，回来的包被拦，ping 不通',
        '忘了 action permit：规则建了但默认拒绝，看着有策略实际全拦'
      ]
    },

    /* ==================== 综合排查 ==================== */
    {
      id: 'rec-troubleshoot',
      title: 'ping 不通的标准排查顺序',
      scene: '配置都配了，就是不通。按这个顺序查，别乱试',
      level: '综合',
      tags: ['排查', 'ping不通', 'troubleshoot', '定位'],
      steps: [
        { c: 'display ip interface brief', note: '第一层：物理 up 吗、协议 up 吗、IP 配了吗。80% 的问题到这一步就有了' },
        { c: 'display interface GigabitEthernet0/0/0', note: '第二层：看 CRC 错包、速率双工、In/Out 有没有丢包' },
        { c: 'display vlan', note: '二层：端口在不在正确的 VLAN 里' },
        { c: 'display mac-address', note: '二层：MAC 学到了吗。学不到就说明链路根本没通' },
        { c: 'display arp all', note: '三层：ARP 学得到吗。学不到说明同网段都不通，别查路由' },
        { c: 'display ip routing-table 192.168.20.0', note: '路由：有没有去程路由。没有就查宣告/静态配置' },
        { c: 'system-view', note: '要补配置了才进系统视图，前面那些 display 在用户视图就能敲' },
        { c: 'ip route-static 192.168.20.0 24 10.0.0.2', note: '如果确实缺路由，先加一条静态验证连通性，再回去修协议' },
        { c: 'display acl 3000', note: '策略：ACL 有没有误拦，看匹配计数' },
        { c: 'display nat session all', note: 'NAT：地址转换有没有生效，会话表空说明根本没匹配上' },
        { c: 'ping -a 192.168.10.1 192.168.20.2', note: '带源地址 ping，排除「回程路由不对」这类假故障' }
      ],
      verify: [
        { cmd: 'ping -a 源地址 目的地址', hope: '带源 ping 能通说明去程回程都对' }
      ],
      pitfalls: [
        '一上来就改配置：先看，再看，最后才改。改之前先记下原配置',
        '只看 ping 结果不看 ARP：同网段不通和跨网段不通是两类问题',
        '忽略掩码：两端掩码不一致时，ARP 范围不同，表现非常像路由问题'
      ]
    },

    {
      id: 'rec-save-basic',
      title: '配完必须做的事：验证 + 保存',
      scene: '每次配完都该走的收尾三步，省掉明天重配一遍',
      level: '入门',
      tags: ['save', '保存', '验证', '开局'],
      steps: [
        { c: 'display current-configuration', note: '第 1 步：确认配置真的进去了。刚才敲的和这里不一致就是没生效' },
        { c: 'display saved-configuration', note: '第 2 步：看看已保存的和当前的差多少（可能差了一整天的活）' },
        { c: 'save', note: '第 3 步：保存，交互里选 y。不保存重启全丢' },
        { c: 'display startup', note: '确认下次启动用的是哪个配置文件' }
      ],
      verify: [
        { cmd: 'display startup', hope: 'Next startup saved-configuration file 指向你保存的那个' }
      ],
      pitfalls: [
        'save 时手滑选了 n：配置只在内存，重启回到出厂',
        '改了但没 display current-configuration 核实：命令敲下去报错被刷过去了',
        '多台设备只 save 了一台：剩下的重启后配置不一致，排查时非常痛苦'
      ]
    }
  );
})(window.__ENSP);
