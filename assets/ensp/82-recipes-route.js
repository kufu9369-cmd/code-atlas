/* ============================================================
   码典 · 配置剧本（二）路由
   ------------------------------------------------------------
   静态路由 / OSPF / RIP / IS-IS / BGP / IPv6，每个都是「从零到 ping 通」的主线。
   路由这块卡住 90% 是三个原因：没宣告、宣告了但网段写错、宣告了但接口没起。
   剧本里的 verify 都对着这三条写。
   ============================================================ */
(function (E) {
  'use strict';

  E.recipes.push(

    /* ==================== 静态路由 ==================== */
    {
      id: 'rec-static',
      title: '静态路由 + 默认路由',
      scene: '三台设备串成一条链，让两头能通',
      level: '入门',
      tags: ['静态路由', '默认路由', 'ip route-static'],
      steps: [
        { c: 'system-view' },
        { c: 'ip route-static 192.168.20.0 255.255.255.0 10.0.0.2', note: '目的网段 + 掩码 + 下一跳。掩码这里必须写全，不能写 24' },
        { c: 'ip route-static 0.0.0.0 0.0.0.0 10.0.0.2', note: '默认路由，去任何地方都丢给它，边缘设备常用' },
        { c: 'display ip routing-table', note: '看路由表里有没有、下一跳对不对' },
        { c: 'display ip routing-table protocol static', note: '只看静态路由，比翻整张表快' }
      ],
      verify: [
        { cmd: 'display ip routing-table', hope: '有 Static 标记的那条，Pre 默认 60' },
        { cmd: 'ping -a 192.168.10.1 192.168.20.2', hope: '带源地址 ping，才能验证回程路由也通' }
      ],
      pitfalls: [
        '只有去程没有回程：单方向 ping 不通，对面也要配一条回来的静态路由',
        '下一跳不是直连的：路由表里显示但实际不通，下一跳必须是自己能直达的地址',
        '掩码写成 24：命令报错「参数错误」，别拿掩码前缀当掩码'
      ]
    },

    {
      id: 'rec-static-float',
      title: '浮动静态路由：主备链路',
      scene: '两条路上行，平时走主用，主用断了自动切备用',
      level: '进阶',
      tags: ['浮动路由', 'preference', '静态路由', '备份'],
      steps: [
        { c: 'system-view' },
        { c: 'ip route-static 192.168.20.0 24 10.0.0.2', note: '主用，默认优先级 60' },
        { c: 'ip route-static 192.168.20.0 24 10.0.1.2 preference 70', note: '备用，preference 值更大 → 优先级更低，主用还在时它不进路由表' },
        { c: 'display ip routing-table', note: '正常情况下只看到主用那条' },
        { c: 'display ip routing-table protocol static', note: '备用的会显示为 Inactive，主用挂了才变 Active' }
      ],
      verify: [
        { cmd: 'display ip routing-table protocol static', hope: '主用 Active，备用 Inactive' }
      ],
      pitfalls: [
        'preference 写反了：数值越小越优先，写成 50 就把备用的变成主用了',
        '两条路下一跳相同：没有意义，等于只有一条'
      ]
    },

    /* ==================== OSPF ==================== */
    {
      id: 'rec-ospf-single',
      title: 'OSPF 单区域（area 0）',
      scene: '三台以上设备要互通，网段会变，静态路由维护不过来',
      level: '入门',
      tags: ['ospf', 'area 0', '动态路由', '邻居'],
      steps: [
        { c: 'system-view' },
        { c: 'ospf 1 router-id 1.1.1.1', note: '进程号本地有效，两端可以不同；router-id 全网唯一，建议用 Loopback 地址' },
        { c: 'area 0', note: '进骨干区域视图' },
        { c: 'network 10.0.0.0 0.0.0.255', note: '反掩码！不是 255.255.255.0。这一条写错是 OSPF 第一大坑' },
        { c: 'network 192.168.10.0 0.0.0.255', note: '每一条要宣告的直连网段都要写' },
        { c: 'quit' },
        { c: 'quit' },
        { c: 'display ospf peer brief', note: '看邻居状态是不是 Full' },
        { c: 'display ospf routing', note: '看 OSPF 算出来的路由' }
      ],
      verify: [
        { cmd: 'display ospf peer brief', hope: 'State 是 Full；Init 或 2-Way 说明没建起来' },
        { cmd: 'display ip routing-table protocol ospf', hope: '学到了对端网段的 OSPF 路由' }
      ],
      pitfalls: [
        '反掩码写成了正掩码：命令能敲进去，但宣告的网段完全错了，邻居建不起来',
        '只宣告了一个网段：邻居 Full，但某些网段 ping 不通',
        '两端 area 号不一致：同一链路上 area 必须相同，否则邻居起不来',
        '接口没起（down）：宣告了也没用，先 display ip interface brief'
      ]
    },

    {
      id: 'rec-ospf-multi',
      title: 'OSPF 多区域 + 路由汇总',
      scene: '网络规模变大，要按区域划分，减少 LSA 泛洪',
      level: '进阶',
      tags: ['ospf', '多区域', 'abr', '汇总', 'area'],
      steps: [
        { c: 'system-view', who: 'ABR' },
        { c: 'ospf 1 router-id 2.2.2.2', who: 'ABR' },
        { c: 'area 0', who: 'ABR', note: '连着骨干区域的那一侧' },
        { c: 'network 10.0.0.0 0.0.0.255', who: 'ABR' },
        { c: 'quit', who: 'ABR' },
        { c: 'area 1', who: 'ABR', note: '另一个区域，非骨干区域必须挂在 ABR 上' },
        { c: 'network 192.168.1.0 0.0.0.255', who: 'ABR' },
        { c: 'quit', who: 'ABR' },
        { c: 'area 1', who: 'ABR', note: '回到区域 1 里做汇总' },
        { c: 'abr-summary 192.168.0.0 255.255.0.0', who: 'ABR', note: '把 area 1 的明细汇总成一条发给 area 0' },
        { c: 'quit', who: 'ABR' },
        { c: 'display ospf lsdb summary', who: 'ABR', note: '看汇总后的 LSA 是不是只有一条' }
      ],
      verify: [
        { cmd: 'display ospf brief', hope: '这台是 ABR，能同时看到 area 0 和 area 1' },
        { cmd: 'display ip routing-table protocol ospf', hope: '对端看到的是汇总后的 /16，不是一堆 /24' }
      ],
      pitfalls: [
        '非骨干区域没有直接连 ABR：OSPF 规定所有非骨干区域必须通过 area 0 中转',
        '汇总写错掩码：会把不该汇总的网段也吃掉，造成黑洞',
        '虚连接忘了配：区域被切断时必须用 vlink 把骨干接回来'
      ]
    },

    {
      id: 'rec-ospf-vlink',
      title: 'OSPF 虚连接（区域被切断时救回来）',
      scene: '一个区域没有直连骨干，中间被别的区域隔开了',
      level: '高级',
      tags: ['ospf', 'vlink', '虚连接', '骨干区域'],
      steps: [
        { c: 'system-view', who: 'ABR1' },
        { c: 'ospf 1', who: 'ABR1' },
        { c: 'area 1', who: 'ABR1', note: 'vlink 要配在「穿越区域」里，也就是 area 1' },
        { c: 'vlink-peer 3.3.3.3', who: 'ABR1', note: '对端 ABR 的 router-id，不是接口地址' },
        { c: 'quit', who: 'ABR1' },
        { c: 'quit', who: 'ABR1' },
        { c: 'system-view', who: 'ABR2' },
        { c: 'ospf 1', who: 'ABR2' },
        { c: 'area 1', who: 'ABR2' },
        { c: 'vlink-peer 2.2.2.2', who: 'ABR2', note: '对称配置，填对方 router-id' },
        { c: 'quit', who: 'ABR2' },
        { c: 'quit', who: 'ABR2' }
      ],
      verify: [
        { cmd: 'display ospf vlink', hope: '两端都要看，State 是 Full 才算成功' }
      ],
      pitfalls: [
        'vlink-peer 填了接口 IP：必须填 router-id，填错永远起不来',
        '两个 ABR 都要求有到对方的区域内路由：vlink 是逻辑链路，底下要真能通',
        'router-id 重复：全 OSPF 域内必须唯一，重复会导致各种诡异现象'
      ]
    },

    {
      id: 'rec-ospf-auth',
      title: 'OSPF 区域认证',
      scene: '防止有人随便插一台设备进来学路由',
      level: '进阶',
      tags: ['ospf', '认证', 'authentication-mode', '安全'],
      steps: [
        { c: 'system-view' },
        { c: 'ospf 1' },
        { c: 'area 0', note: '区域认证对这个区域里所有接口生效' },
        { c: 'authentication-mode md5 1 cipher Huawei@123', note: '区域级认证，1 是 key id，两端必须一致' },
        { c: 'quit' },
        { c: 'quit' },
        { c: 'display ospf interface GigabitEthernet0/0/0', note: '看 Authentication 那一栏' }
      ],
      verify: [
        { cmd: 'display ospf peer brief', hope: '两端都配了 MD5 且密码一致时才是 Full' }
      ],
      pitfalls: [
        '一端配了一端没配：邻居卡在 Init，日志里刷认证失败',
        'key id 不一致：密码一样也认证不过，这个特别难查',
        '区域认证 vs 接口认证混用：接口级优先，两种都配时以接口为准'
      ]
    },

    /* ==================== RIP ==================== */
    {
      id: 'rec-rip',
      title: 'RIP v2 基础配置',
      scene: '小型网络，或者考试要考 RIP',
      level: '入门',
      tags: ['rip', 'ripv2', '距离矢量'],
      steps: [
        { c: 'system-view' },
        { c: 'rip 1', note: '进程号本地有效' },
        { c: 'version 2', note: '一定要配 v2：v1 是有类路由，不传掩码，/24 之外的网段全错' },
        { c: 'undo summary', note: '关掉自动汇总，否则 192.168.1.0/24 和 192.168.2.0/24 会被汇总成 192.168.0.0/16' },
        { c: 'network 10.0.0.0', note: 'RIP 的 network 只用主类网络号，不能写掩码' },
        { c: 'network 192.168.10.0' },
        { c: 'quit' },
        { c: 'display rip 1 route', note: '看 RIP 学到了什么' }
      ],
      verify: [
        { cmd: 'display rip 1 neighbor', hope: '能看到邻居地址' },
        { cmd: 'display ip routing-table protocol rip', hope: '有 RIP 路由，cost 是跳数' }
      ],
      pitfalls: [
        '没配 version 2：掩码信息丢了，跨网段路由出错',
        'network 写了掩码：命令直接报错',
        '没 undo summary：明细路由被汇总，某些网段出问题'
      ]
    },

    /* ==================== IS-IS ==================== */
    {
      id: 'rec-isis',
      title: 'IS-IS 基础配置',
      scene: '运营商网络，或者要和 IS-IS 域对接',
      level: '高级',
      tags: ['isis', 'net', 'level-2', '链路状态'],
      steps: [
        { c: 'system-view' },
        { c: 'isis 1', note: '进程号本地有效' },
        { c: 'is-level level-2', note: '骨干网用 level-2；两端级别不一致建不了邻接' },
        { c: 'network-entity 49.0001.0000.0000.0001.00', note: 'NET 地址：区域ID.SystemID.NSEL，NSEL 必须是 00' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/0' },
        { c: 'isis enable 1', note: '接口上要单独使能，不配这条等于没启 IS-IS' },
        { c: 'isis circuit-level level-2', note: '接口级别，要和全局一致' },
        { c: 'quit' },
        { c: 'display isis peer', note: '看邻接状态是不是 Up' }
      ],
      verify: [
        { cmd: 'display isis peer', hope: 'State 是 Up，Type 是 L2' },
        { cmd: 'display isis route', hope: '有 IS-IS 算出来的路由' }
      ],
      pitfalls: [
        'NET 地址 SystemID 重复：全区域必须唯一，重复会不停翻邻居',
        'NSEL 写成 01：必须是 00，写错邻接起不来',
        '接口忘了 isis enable：全局配得再对也没用'
      ]
    },

    /* ==================== BGP ==================== */
    {
      id: 'rec-bgp-ebgp',
      title: 'BGP eBGP 邻居（跨 AS）',
      scene: '两个 AS 之间要交换路由',
      level: '高级',
      tags: ['bgp', 'ebgp', 'as', '邻居'],
      steps: [
        { c: 'system-view' },
        { c: 'bgp 65001', note: '本地 AS 号' },
        { c: 'router-id 1.1.1.1', note: '不配会用最大的接口地址，不好排查' },
        { c: 'peer 10.0.0.2 as-number 65002', note: '对端地址 + 对端 AS。AS 号写错邻居起不来' },
        { c: 'quit' },
        { c: 'display bgp peer', note: 'State 要是 Established' },
        { c: 'display bgp routing-table', note: '看收到哪些 BGP 路由' }
      ],
      verify: [
        { cmd: 'display bgp peer', hope: 'State = Established，Up/Down 时间在走' },
        { cmd: 'display bgp routing-table', hope: 'Status 列有 *> 表示最优，Path 里有对端 AS 号' }
      ],
      pitfalls: [
        'AS 号写错或两端不对称：邻居卡在 Idle / Active，先查这个',
        'eBGP 默认 TTL=1：跨多跳要用 peer xxx ebgp-max-hop 2',
        '没配 network 或 import-route：邻居 Established 但一条路由都收不到'
      ]
    },

    {
      id: 'rec-bgp-ibgp',
      title: 'BGP iBGP + 路由反射器',
      scene: '同一个 AS 内多台设备跑 BGP，全互联太多邻居，改用 RR',
      level: '高级',
      tags: ['bgp', 'ibgp', 'rr', '路由反射', 'reflect-client'],
      steps: [
        { c: 'system-view', who: 'RR' },
        { c: 'bgp 65001', who: 'RR' },
        { c: 'router-id 1.1.1.1', who: 'RR' },
        { c: 'peer 2.2.2.2 as-number 65001', who: 'RR', note: '同 AS 号就是 iBGP' },
        { c: 'peer 2.2.2.2 connect-interface LoopBack0', who: 'RR', note: '用 Loopback 建邻居，物理口抖动不会断链' },
        { c: 'peer 3.3.3.3 as-number 65001', who: 'RR' },
        { c: 'peer 3.3.3.3 connect-interface LoopBack0', who: 'RR' },
        { c: 'peer 3.3.3.3 reflect-client', who: 'RR', note: '把 3.3.3.3 设为客户端，RR 替它反射路由' },
        { c: 'quit', who: 'RR' },
        { c: 'display bgp peer', who: 'RR' },
        { c: 'display bgp routing-table', who: 'RR', note: '客户端的路由会被标记为 reflected' }
      ],
      verify: [
        { cmd: 'display bgp peer', hope: '所有邻居 Established' },
        { cmd: 'display bgp routing-table', hope: '客户端学到了反射过来的路由' }
      ],
      pitfalls: [
        'connect-interface 没配：用物理口建邻居，口一抖 BGP 就断',
        'Loopback 之间没有 IGP 路由：iBGP 邻居根本建不起来，先保证 IGP 通',
        'iBGP 水平分割：从一个 iBGP 邻居学来的路由不传给另一个 iBGP，所以必须用 RR 或全互联'
      ]
    },

    {
      id: 'rec-bgp-policy',
      title: 'BGP 选路：local-preference + AS_PATH',
      scene: '双出口，让去程走 A、回程走 B',
      level: '高级',
      tags: ['bgp', 'local-preference', 'as-path', '选路', '路由策略'],
      steps: [
        { c: 'system-view' },
        { c: 'ip ip-prefix P-A index 10 permit 0.0.0.0 0 less-equal 32', note: '匹配全部路由，先建个全通的策略基础' },
        { c: 'route-policy RP-A permit node 10', note: '节点号小的先匹配，命中即停' },
        { c: 'if-match ip-prefix P-A' },
        { c: 'apply local-preference 200', note: '本 AS 内越大越优先，默认 100' },
        { c: 'quit' },
        { c: 'bgp 65001' },
        { c: 'peer 10.0.0.2 route-policy RP-A import', note: '对从 A 来的路由抬高本地优先级' },
        { c: 'peer 10.0.0.6 route-policy RP-B export', note: '回程影响对端，要用 export' },
        { c: 'quit' },
        { c: 'display bgp routing-table', note: '看最优路由的 Local Pref 列' }
      ],
      verify: [
        { cmd: 'display bgp routing-table', hope: '*> 那行的 Local Pref 是 200' }
      ],
      pitfalls: [
        'local-preference 只在 AS 内传：发给 eBGP 邻居会被清掉，影响对端选路要用 AS_PATH 或 MED',
        'route-policy 忘了 apply：只在 permit 节点里 if-match 而没有动作，等于全放行不改属性',
        '方向搞反：import 影响自己去程，export 影响对方来程'
      ]
    },

    {
      id: 'rec-import-route',
      title: '路由引入：把直连/静态引进 OSPF 或 BGP',
      scene: 'OSPF 域内要访问外部网段，但外部网段不属于 OSPF',
      level: '进阶',
      tags: ['import-route', '路由引入', 'route-policy', '重分发'],
      steps: [
        { c: 'system-view' },
        { c: 'ip ip-prefix P-IMPORT index 10 permit 192.168.100.0 24', note: '只引入指定网段，别一锅端' },
        { c: 'route-policy RP-IMPORT permit node 10' },
        { c: 'if-match ip-prefix P-IMPORT' },
        { c: 'apply cost 50', note: '顺便调个开销，方便控制选路' },
        { c: 'quit' },
        { c: 'ospf 1' },
        { c: 'import-route static route-policy RP-IMPORT', note: '引入路由时要指定类型：static / direct / rip / bgp' },
        { c: 'quit' },
        { c: 'display ospf lsdb ase', note: '看生成的 Type-5 LSA' }
      ],
      verify: [
        { cmd: 'display ospf lsdb ase self-originate', hope: '能看到自己产生的 ASE LSA' },
        { cmd: 'display ip routing-table protocol ospf', hope: '域内其他设备学到了被引入的网段' }
      ],
      pitfalls: [
        '引入但不加策略：把不该引入的（比如管理网段）也带进来了，容易出环路',
        '引入后的默认路由：import-route direct 会把所有直连都引进来，包括管理口',
        'OSPF 到 OSPF 互相引入：两个 ABR 都做双向引入，必然出次优路径甚至环路'
      ]
    },

    /* ==================== IPv6 ==================== */
    {
      id: 'rec-ipv6-basic',
      title: 'IPv6 地址 + OSPFv3',
      scene: '把一段网络升级成 IPv6，或者双栈实验',
      level: '进阶',
      tags: ['ipv6', 'ospfv3', 'nd', 'ra'],
      steps: [
        { c: 'system-view' },
        { c: 'ipv6', note: '全局使能 IPv6，不敲这条所有 ipv6 命令都报错' },
        { c: 'interface GigabitEthernet0/0/0' },
        { c: 'ipv6 enable', note: '接口上也要使能一次' },
        { c: 'ipv6 address 2001:db8:10::1/64', note: '地址后面直接带前缀长度' },
        { c: 'undo ipv6 nd ra halt', note: '开启 RA 通告，终端靠它自动配置地址；忘了这条 PC 拿不到地址' },
        { c: 'quit' },
        { c: 'ospfv3 1', note: 'IPv6 用 OSPFv3，不是 OSPFv2' },
        { c: 'router-id 1.1.1.1', note: 'OSPFv3 必须手工配 router-id，不会自动生成' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/0' },
        { c: 'ospfv3 1 area 0', note: 'OSPFv3 是在接口上宣告的，不像 OSPFv2 用 network' },
        { c: 'quit' },
        { c: 'display ospfv3 peer' }
      ],
      verify: [
        { cmd: 'display ipv6 interface brief', hope: '接口有 IPv6 地址，状态 up' },
        { cmd: 'display ospfv3 peer', hope: '邻居 Full' }
      ],
      pitfalls: [
        '全局 ipv6 没开：后面所有命令直接报错，但报错信息不明显',
        'RA 被抑制：接口 up、地址对，PC 就是配不出地址',
        'OSPFv3 忘了 router-id：不同版本行为不一样，手工配上最稳'
      ]
    },

    {
      id: 'rec-bfd',
      title: 'BFD：毫秒级链路检测',
      scene: '静态路由或 OSPF 收敛太慢，链路断了很久才发现',
      level: '高级',
      tags: ['bfd', '链路检测', '快速收敛'],
      steps: [
        { c: 'system-view' },
        { c: 'bfd', note: '全局使能 BFD' },
        { c: 'quit' },
        { c: 'bfd 1 bind peer-ip 10.0.0.2 source-ip 10.0.0.1', note: '建一个 BFD 会话，绑定对端和本端地址' },
        { c: 'discriminator local 1', note: '本地标识，两端要互为对方的 remote' },
        { c: 'discriminator remote 2' },
        { c: 'commit', note: '不敲 commit 配置不生效，这是最常漏的一步' },
        { c: 'quit' },
        { c: 'display bfd session all', note: 'State 是 Up 才算建起来' }
      ],
      verify: [
        { cmd: 'display bfd session all', hope: 'State = Up，Diagnose 正常' }
      ],
      pitfalls: [
        '忘了 commit：配置看着都在，会话就是不起来',
        'discriminator 两端没对上：local 要等于对方 remote',
        'BFD 和静态路由联动没配：光建会话不会切路由，要配 ip route-static bfd'
      ]
    }
  );
})(window.__ENSP);
