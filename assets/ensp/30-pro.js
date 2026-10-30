/* ============================================================
   码典 · eNSP 高级层（IS-IS / BGP / MPLS / VPN / 组播 / 无线 / 防火墙）
   ------------------------------------------------------------
   定位：HCIP 往上、真实项目里那些「不配就不通、配错也不报错」的部分。
   这层的每条都在 docs 里点明了「最容易配错的那一步」。
   ============================================================ */
(function (E) {
  'use strict';

  E.items.push(

    /* ---------------- IS-IS ---------------- */
    {
      id: 'isis-basic',
      title: 'IS-IS 基础配置',
      desc: '运营商和大型园区常用的链路状态协议，NET 地址是第一个坎。',
      tags: ['IS-IS', '动态路由', 'NET'],
      device: 'AR2220 / S5700',
      level: '综合',
      code: `isis {{procId}}
 is-level {{level}}
 network-entity {{net}}
 quit
interface GigabitEthernet0/0/1
 ip address {{localIp}} {{mask}}
 isis enable {{procId}}
 isis circuit-level {{circuitLevel}}
 quit`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本地有效', desc: '本地有效，两端可以不同。' },
        level: { label: '路由器级别', value: 'level-1-2', type: 'text', hint: 'level-1 / level-2 / level-1-2', desc: 'level-1 只维护本区域路由；level-2 维护骨干路由；level-1-2 两者都维护，通常用在区域边界。' },
        net: { label: 'NET 地址', value: '49.0001.0000.0000.0001.00', type: 'text', hint: '区域+SystemID+00', desc: '格式是 区域ID.SystemID.NSEL。SystemID 必须 12 个十六进制字符，NSEL 固定 00。全网 SystemID 不能重复。' },
        localIp: { label: '接口地址', value: '10.0.0.1', type: 'text', hint: '互联接口 IP', desc: 'IS-IS 需要接口有 IP 才能建立邻接。' },
        mask: { label: '掩码', value: '255.255.255.252', type: 'text', hint: '互联常用 /30', desc: '两端必须同网段，否则邻接起不来。' },
        circuitLevel: { label: '接口级别', value: 'level-2', type: 'text', hint: 'level-1 / level-2 / level-1-2', desc: '接口级别决定这个接口发哪种 hello。两端级别不匹配就是邻居起不来的头号原因。' }
      },
      docs: {
        secs: [
          { h: 'NET 地址怎么拆', p: '49.0001 是区域 ID（可以更长，如 49.0001.0002），中间 12 位十六进制是 SystemID（等价于 OSPF 的 Router ID），最后 00 是 NSEL 必须为 0。写成 49.0001.0000.0000.0001 少了 .00 会直接报错。' },
          { h: '级别不匹配是最常见的失败', p: '两端都配 level-2 才能建 level-2 邻接；一端 level-1 一端 level-2 就是起不来，而且日志里只写 adjacency rejected，不告诉你原因。display isis peer 看到状态一直 Initializing 就往这查。' },
          { h: '和 OSPF 的根本差别', p: 'OSPF 宣告网段靠 network 命令，IS-IS 是在接口上 isis enable。另外 IS-IS 的 L1/L2 不是「区域」的概念——L1 是区域内，L2 是骨干，一台 L1-2 路由器同时属于两个层次。' }
        ]
      }
    },

    {
      id: 'isis-adv',
      title: 'IS-IS 路由渗透与认证',
      desc: 'L1 区域默认看不到 L2 的明细路由，只拿到一条默认——想让分支走最优路径就得做渗透。',
      tags: ['IS-IS', '路由渗透', '认证'],
      device: 'AR2220 / S5700',
      level: '综合',
      code: `isis {{procId}}
 is-level level-1-2
 import-route isis level-2 into level-1 filter-policy ip-prefix {{prefixName}}
 area-authentication-mode md5 cipher {{areaPwd}}
 domain-authentication-mode md5 cipher {{domainPwd}}
 quit
ip ip-prefix {{prefixName}} index 10 permit {{allowNet}} {{allowLen}}
`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本地有效', desc: '本地有效。' },
        prefixName: { label: '前缀列表名', value: 'PENETRATE', type: 'text', hint: '英文大写好认', desc: '用来控制哪些 L2 路由允许渗透到 L1。' },
        areaPwd: { label: '区域认证密码', value: 'Area@2026', type: 'text', hint: '同区域一致', desc: '区域级认证，同一区域内所有设备必须一致，否则 L1 邻接起不来。' },
        domainPwd: { label: '域认证密码', value: 'Domain@2026', type: 'text', hint: '骨干一致', desc: '域级认证，只在 L2 邻接时校验。' },
        allowNet: { label: '允许渗透网段', value: '10.10.0.0', type: 'text', hint: '要放过去的 L2 路由', desc: '不写前缀列表就是全部渗透，路由表会被撑爆，一定要过滤。' },
        allowLen: { label: '前缀长度', value: '16', type: 'int', min: 1, max: 32, hint: '允许的掩码长度', desc: '配合网段使用。' }
      },
      docs: {
        secs: [
          { h: '为什么 L1 默认看不到明细', p: 'IS-IS 里 L1 路由器只有本区域链路状态库，出区域只能靠 L1-2 路由器下发的 ATT 位生成一条默认路由。所以分支到另一个分支会「绕到骨干再回来」，路径次优。渗透就是把指定 L2 明细塞进 L1。' },
          { h: '不过滤的代价', p: '全网 L2 路由可能有上万条，全渗透进 L1 会让每台接入设备的 LSDB 和路由表暴涨，内存和 CPU 都吃紧。filter-policy 是必须的，不是可选优化。' },
          { h: '两个认证的作用域不同', p: 'area-authentication-mode 保护 L1 的 IIH 和 LSP，同区域必须一致；domain-authentication-mode 保护 L2 的 PDU。只配一个，另一个层次的邻居照样能裸奔接入。' }
        ]
      }
    },

    /* ---------------- BGP ---------------- */
    {
      id: 'bgp-ebgp',
      title: 'BGP 邻居建立（eBGP）',
      desc: '跨 AS 互联的第一步：指定 AS 号、指向对端、把要宣告的网段 network 出去。',
      tags: ['BGP', 'eBGP', '路由'],
      device: 'AR2220',
      level: '综合',
      code: `bgp {{localAs}}
 router-id {{routerId}}
 peer {{peerIp}} as-number {{peerAs}}
 network {{advNet}} {{advMask}}
 quit`,
      vars: {
        localAs: { label: '本端 AS 号', value: '65001', type: 'int', min: 1, max: 4294967295, hint: '私有 AS 64512–65534', desc: 'eBGP 两端 AS 号必须不同，相同会被当成 iBGP 处理。实验环境用私有 AS 段。' },
        routerId: { label: 'Router ID', value: '1.1.1.1', type: 'text', hint: '点分十进制', desc: '不配会从接口地址自动选，接口一变邻居就断。' },
        peerIp: { label: '对端地址', value: '10.0.0.2', type: 'text', hint: '直连对端 IP', desc: 'eBGP 默认要求直连（TTL=1），跨设备要用 peer ebgp-max-hop。' },
        peerAs: { label: '对端 AS 号', value: '65002', type: 'int', min: 1, max: 4294967295, hint: '与本地不同', desc: '填错的表现是邻居卡在 Active 或 Connect，display bgp peer 里能看到 AS 不匹配的提示。' },
        advNet: { label: '宣告网段', value: '192.168.10.0', type: 'text', hint: '要发出去的路由', desc: 'network 命令要求路由表里必须已经存在这条精确路由，否则不生效也不报错。' },
        advMask: { label: '宣告掩码', value: '255.255.255.0', type: 'text', hint: '精确匹配', desc: '必须是路由表里的精确掩码，配 255.255.255.0 而路由是 /24 才匹配。' }
      },
      docs: {
        secs: [
          { h: 'network 不生效的经典原因', p: 'BGP 的 network 不是「宣告这个网段」，而是「把路由表里已有的这条精确路由导进 BGP」。路由表里没有 192.168.10.0/24，这条命令就是空操作，而且没有任何告警。先用 display ip routing-table 确认路由存在。' },
          { h: '邻居卡在 Active 怎么查', p: 'Active 表示设备在尝试建 TCP 179 连接但没成功。查三处：路由可达吗、对端有没有配 peer 指回来、中间防火墙放没放通 TCP 179。' },
          { h: 'eBGP 和 iBGP 的分界', p: '两端 AS 号相同就是 iBGP（要求全互联或路由反射器，且有 split-horizon：从 iBGP 学到的路由不再传给其他 iBGP 邻居）；不同就是 eBGP（会改 AS_PATH，默认改下一跳）。' }
        ]
      }
    },

    {
      id: 'bgp-ibgp-rr',
      title: 'iBGP + 路由反射器',
      desc: 'iBGP 要求全互联，N 台设备要 N(N-1)/2 条会话——用 RR 把规模压下来。',
      tags: ['BGP', 'iBGP', '路由反射'],
      device: 'AR2220',
      level: '综合',
      code: `bgp {{localAs}}
 router-id {{routerId}}
 peer {{clientIp}} as-number {{localAs}}
 peer {{clientIp}} reflect-client
 quit`,
      vars: {
        localAs: { label: 'AS 号', value: '65001', type: 'int', min: 1, max: 4294967295, hint: '与客户端相同', desc: 'RR 和客户端必须在同一 AS。' },
        routerId: { label: 'Router ID', value: '1.1.1.1', type: 'text', hint: 'RR 的 RID', desc: '集群内的 RID，建议用 Loopback。' },
        clientIp: { label: '客户端地址', value: '2.2.2.2', type: 'text', hint: '客户端的 Loopback', desc: '通常用 Loopback 建邻居，需要先配 peer connect-interface。' }
      },
      docs: {
        secs: [
          { h: 'reflect-client 的方向', p: '这条命令配在 RR 上，指向客户端。客户端只需要正常配 peer 指向 RR，不用做任何反射配置。配反了（在客户端上指向 RR 加 reflect-client）不会生效。' },
          { h: '为什么要用 Loopback 建邻居', p: '物理口断了邻居就断，用 Loopback 加 peer x.x.x.x connect-interface LoopBack0，只要有一条路径可达邻居就不断。iBGP 尤其要这样配。' },
          { h: '下一跳不自动改', p: 'iBGP 从 eBGP 学到的路由传给 iBGP 邻居时下一跳不变，接收方可能到不了那个下一跳。要么在 RR 上配 peer x next-hop-local，要么保证内部路由可达。' }
        ]
      }
    },

    {
      id: 'bgp-attr',
      title: 'BGP 选路属性调优',
      desc: '双出口时决定走哪条链路，靠 local-preference、AS_PATH、MED 三个属性。',
      tags: ['BGP', '选路', '属性'],
      device: 'AR2220',
      level: '综合',
      code: `route-policy {{lpPolicy}} permit node 10
 apply local-preference {{localPref}}
 quit
route-policy {{medPolicy}} permit node 10
 apply cost {{med}}
 quit
bgp {{localAs}}
 peer {{ibgpPeer}} route-policy {{lpPolicy}} import
 peer {{ebgpPeer}} route-policy {{medPolicy}} export
 quit`,
      vars: {
        lpPolicy: { label: 'Local-Pref 策略名', value: 'SET-LP', type: 'text', hint: '进口方向用', desc: 'local-preference 只在 AS 内部传递，用来告诉自己的设备「优先走这条出口」。' },
        localPref: { label: 'Local-Preference', value: '200', type: 'int', min: 0, max: 4294967295, hint: '默认 100，越大越优', desc: '在入口方向抬高某条路由的 LP，全网都会优先选它。' },
        medPolicy: { label: 'MED 策略名', value: 'SET-MED', type: 'text', hint: '出口方向用', desc: 'MED 是给对端 AS 看的「入口偏好」。' },
        med: { label: 'MED 值', value: '50', type: 'int', min: 0, max: 4294967295, hint: '默认 0，越小越优', desc: '注意 MED 越小越优，和 LP 相反，这是最容易记混的地方。' },
        localAs: { label: 'AS 号', value: '65001', type: 'int', min: 1, max: 4294967295, hint: '本 AS', desc: '本端 AS 号。' },
        ibgpPeer: { label: 'iBGP 邻居', value: '2.2.2.2', type: 'text', hint: '内部邻居地址', desc: 'LP 通常在 iBGP 邻居的 import 方向设置。' },
        ebgpPeer: { label: 'eBGP 邻居', value: '10.0.0.2', type: 'text', hint: '外部邻居地址', desc: 'MED 通常在这个 eBGP 邻居的 export 方向设置。' }
      },
      docs: {
        secs: [
          { h: '选路顺序记三档就够', p: '先用 Local-Preference 比（大者优），再用 AS_PATH 长度比（短者优），最后用 MED 比（小者优）。真实顺序有十几步，实际排障盯这三个基本够。' },
          { h: 'LP 大优、MED 小优', p: '这两个方向相反，是考试和现场都爱错的点。口诀：LP 是「我更喜欢」所以越大越喜欢；MED 是「代价」所以越小越好。' },
          { h: 'AS_PATH 的两种玩法', p: '加长自己的 AS_PATH 让对方别走这条路（apply as-path xxx additive）；或者用 as-path-filter 过滤掉带特定 AS 的路由。前者影响对端，后者影响自己。' }
        ]
      }
    },

    {
      id: 'bgp-community',
      title: 'BGP 团体属性打标签',
      desc: '给路由打上 100:1 这样的标签，对端按标签统一做策略，比逐条匹配网段好维护。',
      tags: ['BGP', 'Community', '策略'],
      device: 'AR2220',
      level: '综合',
      code: `ip community-filter 1 permit {{community}}
route-policy {{markPolicy}} permit node 10
 apply community {{community}} additive
 quit
route-policy {{matchPolicy}} permit node 10
 if-match community-filter 1
 apply local-preference {{localPref}}
 quit
bgp {{localAs}}
 peer {{peerIp}} route-policy {{markPolicy}} export
 peer {{peerIp}} advertise-community
 quit`,
      vars: {
        community: { label: '团体值', value: '100:1', type: 'text', hint: 'AS:自定义值', desc: '常用格式 AS号:数字。也可以写 no-export、no-advertise 这类公认团体。' },
        markPolicy: { label: '打标策略名', value: 'MARK-COMM', type: 'text', hint: '出口方向', desc: '把标签打上去，随路由一起发出去。' },
        matchPolicy: { label: '匹配策略名', value: 'MATCH-COMM', type: 'text', hint: '进口方向', desc: '对端按标签做动作。' },
        localPref: { label: '匹配后 LP', value: '200', type: 'int', min: 0, max: 4294967295, hint: '默认 100', desc: '举例：带 100:1 标签的路由优先。' },
        localAs: { label: 'AS 号', value: '65001', type: 'int', min: 1, max: 4294967295, hint: '本 AS', desc: '本端 AS 号。' },
        peerIp: { label: '邻居地址', value: '10.0.0.2', type: 'text', hint: '对端 IP', desc: '收发策略都配在这个邻居上。' }
      },
      docs: {
        secs: [
          { h: 'advertise-community 千万别漏', p: '默认情况下 BGP 不发团体属性。策略配得再完美，忘了这条对端收到的路由里根本没有标签，匹配永远是空。这个坑几乎人人踩过一次。' },
          { h: 'additive 的作用', p: '不加 additive 会覆盖掉原有团体；加了就追加。上游已经打过标签时，用 additive 避免把人家的标记抹掉。' },
          { h: '公认团体可以直接用', p: 'no-export 表示不传出本 AS，no-advertise 表示不发给任何邻居，no-export-subconfed 用于联盟场景。不用自己定义。' }
        ]
      }
    },

    /* ---------------- MPLS / VPN ---------------- */
    {
      id: 'mpls-ldp',
      title: 'MPLS 基础 + LDP',
      desc: '先让设备会打标签、会分发标签，后面才能谈 MPLS VPN。',
      tags: ['MPLS', 'LDP', '标签'],
      device: 'AR2220 / S5700',
      level: '综合',
      code: `mpls lsr-id {{lsrId}}
mpls
mpls ldp
 quit
interface GigabitEthernet0/0/1
 ip address {{localIp}} {{mask}}
 mpls
 mpls ldp
 quit`,
      vars: {
        lsrId: { label: 'LSR ID', value: '1.1.1.1', type: 'text', hint: '通常是 Loopback 地址', desc: '全网唯一，建议用 Loopback0 的地址。改了之后 LDP 会话会重建。' },
        localIp: { label: '接口地址', value: '10.0.0.1', type: 'text', hint: '互联接口 IP', desc: 'MPLS 域的互联接口地址。' },
        mask: { label: '掩码', value: '255.255.255.252', type: 'text', hint: '互联常用 /30', desc: '两端同网段。' }
      },
      docs: {
        secs: [
          { h: '三层配置别漏 ip address', p: 'MPLS 标签转发仍然要有 IP 路由基础。接口只开 mpls 不配 IP，标签会话建不起来。' },
          { h: 'mpls 和 mpls ldp 是两步', p: '全局 mpls 开标签转发能力，mpls ldp 开标签分发协议，接口上两个都要开。少一个的现象是「有标签表但没有会话」。' },
          { h: '验证看三张表', p: 'display mpls ldp session 看会话是否 Operational；display mpls lsp 看标签转发表；display mpls route-table 看标签路由。三张表都齐才算通。' }
        ]
      }
    },

    {
      id: 'mpls-vpn',
      title: 'MPLS VPN（VRF + MP-BGP）',
      desc: '一张物理网跑多个客户，靠 VRF 隔离、RD 区分、RT 控制发布范围。',
      tags: ['MPLS VPN', 'VRF', 'MP-BGP'],
      device: 'AR2220',
      level: '综合',
      code: `ip vpn-instance {{vrfName}}
 ipv4-family
  route-distinguisher {{rd}}
  vpn-target {{rt}} both
  quit
 quit
interface GigabitEthernet0/0/2
 ip binding vpn-instance {{vrfName}}
 ip address {{ceIp}} {{ceMask}}
 quit
bgp {{localAs}}
 ipv4-family vpnv4
  peer {{peIp}} enable
  quit
 ipv4-family vpn-instance {{vrfName}}
  peer {{ceIp}} as-number {{ceAs}}
  quit
 quit`,
      vars: {
        vrfName: { label: 'VRF 名', value: 'CUST-A', type: 'text', hint: '每客户一个', desc: 'VRF 就是「虚拟路由转发表」，不同 VRF 的路由表完全隔离，可以有重复的私网地址。' },
        rd: { label: 'RD', value: '100:1', type: 'text', hint: 'ASN:数字', desc: 'RD 只是把不同 VRF 里相同的 IPv4 前缀变成全局唯一，本身不控制发布范围。' },
        rt: { label: 'RT', value: '100:1', type: 'text', hint: 'ASN:数字', desc: 'RT 才是控制「谁收得到」的关键：本端 export 的 RT 要出现在对端 import 列表里，路由才能互通。' },
        ceIp: { label: 'CE 地址', value: '192.168.1.2', type: 'text', hint: 'PE 侧连 CE 的接口地址', desc: 'PE 上这个接口绑定 VRF 后再配地址，配地址要在 binding 之后。' },
        ceMask: { label: 'CE 侧掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '和 CE 侧地址配套。' },
        localAs: { label: 'PE 的 AS 号', value: '65001', type: 'int', min: 1, max: 4294967295, hint: '运营商 AS', desc: 'PE 之间跑 MP-BGP 的 AS。' },
        peIp: { label: '对端 PE 地址', value: '2.2.2.2', type: 'text', hint: '对端 PE 的 Loopback', desc: 'VPNv4 邻居通常用 Loopback 建立。' },
        ceAs: { label: 'CE AS 号', value: '65010', type: 'int', min: 1, max: 4294967295, hint: '客户 AS', desc: 'PE-CE 之间跑 BGP 时填客户的 AS；如果是静态或 OSPF 接入，这一段换成 import-route。' }
      },
      docs: {
        secs: [
          { h: 'RD 和 RT 别搞混', p: 'RD 解决「地址冲突」，让两个客户都有 192.168.1.0/24 时不打架；RT 解决「谁能收到」，是一张通行证。只配 RD 不配 RT，路由哪也去不了。' },
          { h: '顺序：先 binding 再配 IP', p: '接口上先 ip binding vpn-instance 再 ip address，反过来会把地址配到全局路由表里，之后要 undo 重配。' },
          { h: '两端 RT 要成对', p: 'A 端 export 100:1、import 100:1；B 端也必须 export 100:1、import 100:1。单向配错的表现是「A 能到 B、B 回不来」。' },
          { h: 'VPNv4 邻居要先 enable', p: 'bgp 里 peer 建好之后，还要在 ipv4-family vpnv4 视图下 peer x.x.x.x enable，否则 VPNv4 路由一条也不传。' }
        ]
      }
    },

    {
      id: 'gre-tunnel',
      title: 'GRE 隧道',
      desc: '两个私网隔着公网互通的最简单做法，不管加密，只管封装。',
      tags: ['GRE', '隧道', 'VPN'],
      device: 'AR2220',
      level: '综合',
      code: `interface Tunnel0/0/1
 tunnel-protocol gre
 source {{srcPublicIp}}
 destination {{dstPublicIp}}
 ip address {{tunnelIp}} {{tunnelMask}}
 quit
ip route-static {{remotePrivateNet}} {{remoteMask}} Tunnel0/0/1`,
      vars: {
        srcPublicIp: { label: '本端公网地址', value: '200.1.1.1', type: 'text', hint: '本端出口 IP', desc: '隧道源地址，必须是对端能路由到的地址。' },
        dstPublicIp: { label: '对端公网地址', value: '202.1.1.1', type: 'text', hint: '对端出口 IP', desc: '隧道目的地址，两端必须互指。' },
        tunnelIp: { label: '隧道地址', value: '10.10.10.1', type: 'text', hint: '隧道内网地址', desc: '隧道接口的 IP，和业务网段不冲突即可，两端要同网段。' },
        tunnelMask: { label: '隧道掩码', value: '255.255.255.252', type: 'text', hint: '/30', desc: '隧道只连两台设备，/30 足够。' },
        remotePrivateNet: { label: '对端私网', value: '192.168.20.0', type: 'text', hint: '要通过隧道到达的网段', desc: '对端私网网段。' },
        remoteMask: { label: '对端私网掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '和网段配套。' }
      },
      docs: {
        secs: [
          { h: '隧道不加密', p: 'GRE 只是把原报文整个封进新 IP 包，抓包能直接看到内容。要加密就在 GRE 上叠 IPSec，或者直接用 IPSec 传输模式。' },
          { h: '路由要指向隧道', p: '隧道起来了不等于业务通。必须有一条指向 Tunnel 接口的静态路由，把对端私网流量引进去。这条漏了，隧道 up 但 ping 不通。' },
          { h: 'MTU 会踩坑', p: '封装后报文变大 24 字节，超过路径 MTU 就会被丢。现象是 ping 通但大文件传不动，或者 TCP 建连后卡住。必要时调小接口 MTU 或配 TCP MSS。' }
        ]
      }
    },

    {
      id: 'ipsec-vpn',
      title: 'IPSec VPN（IKEv2 预共享密钥）',
      desc: '点对点加密隧道，ACL 定义「哪些流量要保护」，策略里把 IKE 和 IPSec 串起来。',
      tags: ['IPSec', 'IKE', '加密', 'VPN'],
      device: 'AR2220',
      level: '综合',
      code: `acl number 3000
 rule 5 permit ip source {{localNet}} {{localWildcard}} destination {{remoteNet}} {{remoteWildcard}}
 quit
ipsec proposal {{propName}}
 esp authentication-algorithm sha2-256
 esp encryption-algorithm aes-256
 quit
ike proposal 10
 authentication-method pre-share
 encryption-algorithm aes-cbc-256
 dh group14
 quit
ike peer {{peerName}} v2
 pre-shared-key cipher {{psk}}
 ike-proposal 10
 remote-address {{peerIp}}
 quit
ipsec policy {{policyName}} 10 isakmp
 security acl 3000
 ike-peer {{peerName}}
 proposal {{propName}}
 quit
interface GigabitEthernet0/0/1
 ipsec policy {{policyName}}
 quit`,
      vars: {
        localNet: { label: '本地私网', value: '192.168.10.0', type: 'text', hint: '本端要保护的内网', desc: 'ACL 定义的是「源是本端私网、目的是对端私网」的流量，只有这些才加密。' },
        localWildcard: { label: '本地反掩码', value: '0.0.0.255', type: 'text', hint: '/24', desc: '和本地私网配套。' },
        remoteNet: { label: '对端私网', value: '192.168.20.0', type: 'text', hint: '对端内网网段', desc: '两端 ACL 要镜像对称：A 的源是 B 的目的。' },
        remoteWildcard: { label: '对端反掩码', value: '0.0.0.255', type: 'text', hint: '/24', desc: '和对端私网配套。' },
        propName: { label: 'IPSec 提议名', value: 'IPSEC-P1', type: 'text', hint: '英文', desc: '定义第二阶段用什么算法保护数据。' },
        peerName: { label: 'IKE 对等体名', value: 'PEER-B', type: 'text', hint: '本端自定义', desc: '本端起的名字，对端不需要一致，但指向的地址必须对。' },
        psk: { label: '预共享密钥', value: 'Ipsec@2026', type: 'text', hint: '两端一致', desc: '两端必须完全一致，包括大小写。不一致的现象是第一阶段就协商失败。' },
        peerIp: { label: '对端公网地址', value: '202.1.1.1', type: 'text', hint: '对端出口 IP', desc: 'IKE 协商的目标地址。' },
        policyName: { label: 'IPSec 策略名', value: 'POL-VPN', type: 'text', hint: '接口上引用', desc: '把 ACL、IKE 对等体、提议串在一起。' }
      },
      docs: {
        secs: [
          { h: '两阶段要分开看', p: '第一阶段（IKE）协商管理隧道，第二阶段（IPSec SA）协商数据加密。排障先看 display ike sa 有没有 Established，再看 display ipsec sa。第一阶段都不通的话，改第二阶段的算法完全没用。' },
          { h: 'ACL 必须是镜像的', p: 'A 端写「源 10.0.0.0/24 到 20.0.0.0/24」，B 端就要写「源 20.0.0.0/24 到 10.0.0.0/24」。两边写一样，只有单向能通。' },
          { h: 'NAT 和 IPSec 打架', p: '出口同时配了 NAT，内网到对端私网的流量会先被 NAT 转换掉，IPSec 的 ACL 就匹配不上了。要在 NAT 的 ACL 里 deny 掉这段流量（NAT 排除）。' }
        ]
      }
    },

    /* ---------------- 组播 / 无线 ---------------- */
    {
      id: 'multicast-pim',
      title: '组播 PIM-SM + IGMP',
      desc: '一份视频流发给多个接收者，靠 PIM-SM 建共享树、IGMP 管理成员。',
      tags: ['组播', 'PIM', 'IGMP'],
      device: 'AR2220 / S5700',
      level: '综合',
      code: `multicast routing-enable
interface GigabitEthernet0/0/1
 pim sm
 igmp enable
 quit
pim
 static-rp {{rpIp}}
 quit`,
      vars: {
        rpIp: { label: 'RP 地址', value: '10.10.10.10', type: 'text', hint: '汇聚点地址', desc: 'PIM-SM 需要指定汇聚点（RP）。实验里用 static-rp 最省事，生产环境常用 BSR 动态选举。' }
      },
      docs: {
        secs: [
          { h: '三条命令缺一不可', p: 'multicast routing-enable 是总开关；接口 pim sm 才参与组播转发；igmp enable 让这个接口能收成员报告。只配前两条，接收者发 IGMP 加入也没人理。' },
          { h: 'RP 必须全网一致', p: '所有设备必须认同一个 RP，配错了表现是「能收到第一包，之后树建不起来」，接收者一直卡在加入状态。' },
          { h: 'RPF 检查会拦掉组播', p: '组播转发要求入接口是「到源的最短路径接口」。单播路由不对称时组播必断，而且现象很怪——单播 ping 得通，组播就是不来。' }
        ]
      }
    },

    {
      id: 'wlan-ac-basic',
      title: 'WLAN 基础：AC + AP 上线',
      desc: 'AC 管 AP，三个模板（安全 / SSID / VAP）拼出一个能用的无线网络。',
      tags: ['WLAN', 'AC', 'AP', 'CAPWAP'],
      device: 'AC6005 + AP 系列',
      level: '综合',
      code: `vlan batch {{mgmtVlan}} {{svcVlan}}
dhcp enable
interface Vlanif{{mgmtVlan}}
 ip address {{acIp}} {{acMask}}
 dhcp select interface
 quit
capwap source interface Vlanif{{mgmtVlan}}
wlan
 security-profile name {{secName}}
  security wpa-wpa2 psk pass-phrase {{wifiPwd}} aes
  quit
 ssid-profile name {{ssidName}}
  ssid {{ssid}}
  quit
 vap-profile name {{vapName}}
  forward-mode tunnel
  service-vlan vlan-id {{svcVlan}}
  ssid-profile {{ssidName}}
  security-profile {{secName}}
  quit
 ap-group name {{groupName}}
  vap-profile {{vapName}} wlan 1 radio all
  quit
 quit`,
      vars: {
        mgmtVlan: { label: '管理 VLAN', value: '100', type: 'int', min: 1, max: 4094, hint: 'AP 与 AC 通信', desc: 'AP 拿管理地址、与 AC 建 CAPWAP 隧道用这个 VLAN。' },
        svcVlan: { label: '业务 VLAN', value: '200', type: 'int', min: 1, max: 4094, hint: '终端上网', desc: '终端拿到的地址属于这个 VLAN。' },
        acIp: { label: 'AC 管理地址', value: '192.168.100.254', type: 'text', hint: 'capwap 源地址', desc: '必须和管理 VLAN 同网段，AP 靠它找到 AC。' },
        acMask: { label: 'AC 掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '和管理地址配套。' },
        secName: { label: '安全模板名', value: 'sec-open', type: 'text', hint: '英文', desc: '定义认证和加密方式。' },
        wifiPwd: { label: 'Wi-Fi 密码', value: 'Wifi@2026', type: 'text', hint: '8 位以上', desc: 'WPA2-PSK 要求至少 8 位，太短会提示密码强度不足。' },
        ssidName: { label: 'SSID 模板名', value: 'ssid-office', type: 'text', hint: '英文', desc: '模板名，不是对外广播的名字。' },
        ssid: { label: 'SSID 名称', value: 'Office-WiFi', type: 'text', hint: '手机上看到的名字', desc: '终端搜索到的无线名称，建议不要暴露公司名。' },
        vapName: { label: 'VAP 模板名', value: 'vap-office', type: 'text', hint: '英文', desc: 'VAP 把 SSID、安全、业务 VLAN 绑成一个「虚拟 AP」。' },
        groupName: { label: 'AP 组名', value: 'default', type: 'text', hint: 'AP 默认在 default 组', desc: 'AP 上线后自动加入 default 组，把 VAP 绑到组上，组里所有 AP 都生效。' }
      },
      docs: {
        secs: [
          { h: 'capwap source 必须先配', p: 'AP 上线时先和 AC 建 CAPWAP 隧道，源接口决定 AC 用哪个地址跟 AP 通信。没配或配错网段，AP 会一直显示「正在获取 IP」或「找不到 AC」。' },
          { h: '三个模板的关系', p: 'security-profile 管怎么认证加密，ssid-profile 管广播什么名字，vap-profile 把前两者和业务 VLAN 绑起来。最后 ap-group 把 vap 挂到 AP 组。少一层就出不来信号。' },
          { h: '隧道转发 vs 本地转发', p: 'forward-mode tunnel 表示终端流量要经 CAPWAP 隧道回 AC 再转发，配置集中、策略好做，但 AC 成瓶颈；local 是 AP 本地直接进业务 VLAN，性能好但策略分散。' },
          { h: 'eNSP 里的限制', p: 'eNSP 的 AC 和 AP 是简化实现，漫游、射频调优这些高级功能表现不完整。练通上线流程和模板关系没问题，别指望模拟真实射频环境。' }
        ]
      }
    },

    {
      id: 'wlan-ap-radio',
      title: 'AP 射频与固定 IP 上线',
      desc: 'AP 上线后要调信道和功率，否则同频干扰会让实际速率远超预期地低。',
      tags: ['WLAN', 'AP', '射频'],
      device: 'AC6005 + AP 系列',
      level: '综合',
      code: `wlan
 ap-id {{apId}} ap-mac {{apMac}}
  ap-name {{apName}}
  ap-group {{groupName}}
  radio 0
   channel 20mhz {{channel}}
   eirp {{eirp}}
   quit
  quit
 quit`,
      vars: {
        apId: { label: 'AP ID', value: '1', type: 'int', min: 0, max: 1023, hint: 'AC 内唯一', desc: 'AC 给 AP 分配的本地编号，离线配置时用 ap-id + ap-mac 先把 AP 登记好。' },
        apMac: { label: 'AP MAC', value: '00e0-fc00-0001', type: 'text', hint: '华为格式 xxxx-xxxx-xxxx', desc: '必须和 AP 实际 MAC 完全一致，写成冒号分隔会认不到。' },
        apName: { label: 'AP 名称', value: 'AP-3F-01', type: 'text', hint: '按位置命名', desc: '带楼层和序号，排障时一眼知道是哪个点位。' },
        groupName: { label: 'AP 组', value: 'default', type: 'text', hint: '与 VAP 绑定一致', desc: '把 AP 放进对应组，组上绑的 VAP 才会生效。' },
        channel: { label: '信道', value: '6', type: 'int', min: 1, max: 165, hint: '2.4G 用 1/6/11', desc: '2.4G 只有 1、6、11 三个互不重叠信道，相邻 AP 必须错开，否则同频干扰。' },
        eirp: { label: '发射功率（dBm）', value: '20', type: 'int', min: 1, max: 30, hint: '室内一般 18–20', desc: '功率越大覆盖越广但干扰也越大。密集部署时反而要调小，靠密度换容量。' }
      },
      docs: {
        secs: [
          { h: '同频干扰比信号弱更致命', p: '两个相邻 AP 都用信道 6，终端信号满格但速率只有几百 K。原因不是覆盖不够，是空口在互相抢。规划时按 1-6-11 交错。' },
          { h: 'MAC 格式写错就上不了线', p: '华为 AC 认 00e0-fc00-0001 这种连字符格式。写成 00:e0:fc:00:00:01 或者大写混排都可能匹配不上，AP 会一直处于未认证状态。' },
          { h: '功率不是越大越好', p: '功率调大 → 覆盖变大 → 更多终端黏在远处低速率 → 空口效率下降。高密场景的正确方向是缩小单 AP 覆盖、增加 AP 数量。' }
        ]
      }
    },

    /* ---------------- 堆叠 / 防火墙 ---------------- */
    {
      id: 'istack',
      title: 'iStack 堆叠（两台变一台）',
      desc: '两台交换机用堆叠线连起来当一台用，管理地址只有一个，链路还能跨设备聚合。',
      tags: ['堆叠', 'iStack', '高可用'],
      device: 'S5700 系列',
      level: '综合',
      code: `stack
 stack member 1 priority {{priority}}
 stack member 1 domain {{domain}}
 quit
interface stack-port 1/1
 port interface GigabitEthernet0/0/1 enable
 port interface GigabitEthernet0/0/2 enable
 quit`,
      vars: {
        priority: { label: '成员优先级', value: '150', type: 'int', min: 1, max: 255, hint: '默认 100，大的当主', desc: '优先级高的成为主交换机。主备倒换时业务会短暂中断，建议主设备选业务量小、位置稳定的那台。' },
        domain: { label: '堆叠域号', value: '10', type: 'int', min: 1, max: 255, hint: '同域才能堆', desc: '两台设备域号必须相同才能堆成一个逻辑设备。' }
      },
      docs: {
        secs: [
          { h: '堆叠线要交叉连', p: 'A 的 0/0/1 连 B 的 0/0/2，A 的 0/0/2 连 B 的 0/0/1，形成环。只连一条也能堆起来，但没有冗余。' },
          { h: '成员编号会变', p: '堆叠成功后原设备的接口编号会变成 1/0/1、2/0/1 这种「框号/槽位/端口」格式，原来的配置引用会失效，需要按新编号重配。' },
          { h: '堆叠不是万能的', p: '控制面是主备，备机不转发协议报文；主设备重启时业务会中断几秒到几十秒。追求无中断要用 CSS 或独立组网。' }
        ]
      }
    },

    {
      id: 'fw-zone-policy',
      title: '防火墙安全区域与策略',
      desc: 'USG 默认全拒绝，接口必须先进区域、再放行策略，否则什么都不通。',
      tags: ['防火墙', '安全策略', 'USG'],
      device: 'USG6000V',
      level: '综合',
      code: `firewall zone trust
 add interface GigabitEthernet1/0/0
 quit
firewall zone untrust
 add interface GigabitEthernet1/0/1
 quit
security-policy
 rule name {{ruleName}}
  source-zone trust
  destination-zone untrust
  source-address {{srcIp}} {{srcMask}}
  action permit
  quit
 quit`,
      vars: {
        ruleName: { label: '策略名', value: 'allow-inside-out', type: 'text', hint: '英文，描述用途', desc: '策略名要能看出干什么，后面几十条策略时救命。' },
        srcIp: { label: '源地址', value: '192.168.10.0', type: 'text', hint: '内网网段', desc: '限定只有这个网段能出去，比 any 安全得多。' },
        srcMask: { label: '源掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '和源地址配套。' }
      },
      docs: {
        secs: [
          { h: '接口不进区域就是死的', p: 'USG 的接口必须加入某个安全区域（trust / untrust / dmz / local）才能参与转发。只配 IP 不加区域，接口 up 但不通，这个坑几乎每个新手都踩。' },
          { h: '默认策略是 deny', p: 'security-policy 里没有匹配规则时默认拒绝。所以「配了策略还是不通」要先确认规则真的命中了——display security-policy rule all 能看到命中计数。' },
          { h: 'local 区域管设备自己', p: 'ping 防火墙接口、SSH 登录防火墙，属于访问 local 区域，也需要单独放行。放行了 trust→untrust 不代表能管设备。' }
        ]
      }
    },

    {
      id: 'fw-nat-server',
      title: '防火墙 NAT Server（端口映射）',
      desc: '把内网服务器发布到公网，一次只暴露一个端口，比整机 DMZ 安全。',
      tags: ['防火墙', 'NAT Server', '端口映射'],
      device: 'USG6000V',
      level: '综合',
      code: `nat server {{proto}} global {{globalIp}} {{globalPort}} inside {{insideIp}} {{insidePort}}`,
      vars: {
        proto: { label: '协议', value: 'tcp', type: 'text', hint: 'tcp / udp', desc: '按业务选。Web 用 tcp，DNS/VoIP 用 udp。' },
        globalIp: { label: '公网地址', value: '202.1.1.10', type: 'text', hint: '对外发布的地址', desc: '外网用户访问的地址，通常是出口的公网 IP 或地址池里的一个。' },
        globalPort: { label: '公网端口', value: '8080', type: 'int', min: 1, max: 65535, hint: '对外端口', desc: '不建议直接用 80/443，换成高位端口能挡掉大量自动化扫描。' },
        insideIp: { label: '内网服务器', value: '192.168.10.10', type: 'text', hint: '真实服务器地址', desc: '内网服务器的私网地址。' },
        insidePort: { label: '内网端口', value: '80', type: 'int', min: 1, max: 65535, hint: '服务实际端口', desc: '服务器上服务实际监听的端口。' }
      },
      docs: {
        secs: [
          { h: 'NAT Server 不是策略', p: 'NAT Server 只做地址转换，能不能通还要靠 security-policy 放行 untrust → trust 且目的地址是转换后的内网地址。很多人只配了 NAT 发现不通，就是漏了策略。' },
          { h: '端口映射比 DMZ 安全', p: '整机 DMZ 暴露所有端口，服务器上一个没打补丁的服务就成了入口。只映射必要端口，其余全部拒绝。' },
          { h: '和源 NAT 一起用时看顺序', p: '防火墙先做目的 NAT（NAT Server）再做源 NAT（NAT Policy），策略匹配的是转换后的地址。排查时用 display firewall session table 看实际会话。' }
        ]
      }
    },

    {
      id: 'fw-hrp',
      title: '防火墙双机热备（HRP）',
      desc: '两台防火墙主备部署，会话表实时同步，主挂了备机接管且已建立的连接不断。',
      tags: ['防火墙', '双机热备', 'HRP'],
      device: 'USG6000V ×2',
      level: '综合',
      code: `hrp enable
hrp interface GigabitEthernet1/0/2 remote {{peerIp}}
hrp track interface GigabitEthernet1/0/0
hrp auto-sync config`,
      vars: {
        peerIp: { label: '对端心跳地址', value: '10.0.0.2', type: 'text', hint: '心跳口对端 IP', desc: '两台防火墙之间专门一条心跳链路，建议独立直连，不要走业务口。' }
      },
      docs: {
        secs: [
          { h: '心跳口别复用业务口', p: '心跳流量不大但要求稳定。和业务混跑时，业务一拥塞心跳就超时，触发误切换，两台互相抢主，业务反复中断。' },
          { h: 'hrp track 决定谁接管', p: '上行口 down 时，主设备优先级下降，备机抢占。不配 track，主设备上行断了它照样是主，流量全部黑洞——这和 VRRP 的 track 是同一个道理。' },
          { h: '双主是最危险的故障', p: '心跳断了但两台都还活着，会同时成为主设备，同一套 IP 冲突、会话表各管一半。生产环境要配 HRP 心跳线的 BFD 检测和双主告警。' }
        ]
      }
    }

  );
})(window.__ENSP);
