/* ============================================================
   码典 · eNSP 进阶层（路由 / 网关 / 策略）
   ------------------------------------------------------------
   定位：VLAN 互通已经会了，开始碰动态路由、路由策略、网关冗余、IPv6。
   这一层的每条配置都对应一个「为什么这么写」的坑，docs 里写清楚了。
   ============================================================ */
(function (E) {
  'use strict';

  E.items.push(

    /* ---------------- 链路与网关 ---------------- */
    {
      id: 'eth-trunk-lacp',
      title: '链路聚合 LACP（动态）',
      desc: '两条线捆成一条，带宽叠加还能互相备份——但要对面也是 LACP 才谈得起来。',
      tags: ['链路聚合', 'LACP', 'Eth-Trunk'],
      device: 'S5700 / S3700',
      level: '进阶',
      code: `interface Eth-Trunk {{trunkId}}
 mode lacp-static
 max active-linknumber {{maxActive}}
 lacp preempt enable
 lacp preempt delay {{delaySec}}
 quit
interface GigabitEthernet0/0/1
 eth-trunk {{trunkId}}
 quit
interface GigabitEthernet0/0/2
 eth-trunk {{trunkId}}
 quit`,
      vars: {
        trunkId: { label: 'Eth-Trunk 编号', value: '1', type: 'int', min: 0, max: 63, hint: '0–63', desc: '两台设备两端建议用同一个编号，排障时好对应。' },
        maxActive: { label: '最大活动链路数', value: '8', type: 'int', min: 1, max: 8, hint: '1–8', desc: '成员口多于这个数时，多余的做备份不转发。想让所有链路都跑流量就填够。' },
        delaySec: { label: '抢占延迟（秒）', value: '30', type: 'int', min: 0, max: 300, hint: '0–300', desc: '主链路抖动恢复时不要立刻抢回来，避免来回切换把流量打断两次。' }
      },
      docs: {
        secs: [
          { h: 'static 和 manual 的区别', p: 'mode lacp-static 走 LACP 协议，两端会协商、能检测单通（一端断了 LACP 报文就停）；mode manual 是强制捆绑，只要物理口 up 就当链路可用，对端其实没配也照样转发，单通时极易形成黑洞。优先用 lacp-static。' },
          { h: '成员口必须干净', p: '加进 Eth-Trunk 之前，物理口上不能有独立的 VLAN、IP、STP 配置，否则报错。正确顺序是先 interface GE 口 undo 掉多余配置，再 eth-trunk。' },
          { h: '两端都要配', p: '只在一边配 Eth-Trunk，另一边当普通口用，LACP 根本协商不起来，表现是成员口一直处于 Unselected。' }
        ]
      }
    },

    {
      id: 'vrrp-bfd',
      title: 'VRRP 网关冗余（带接口跟踪）',
      desc: '两台核心做同一个网关，主挂了备机秒级接手，终端连网关都不用改。',
      tags: ['VRRP', '网关冗余', '高可用'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `interface Vlanif{{vlanId}}
 ip address {{localIp}} {{mask}}
 vrrp vrid {{vrid}} virtual-ip {{vip}}
 vrrp vrid {{vrid}} priority {{priority}}
 vrrp vrid {{vrid}} preempt-mode timer delay {{delay}}
 vrrp vrid {{vrid}} track interface GigabitEthernet0/0/24 reduced 30
 quit`,
      vars: {
        vlanId: { label: '业务 VLAN', value: '10', type: 'int', min: 1, max: 4094, hint: '终端所在 VLAN', desc: 'Vlanif 就是终端的网关接口。' },
        localIp: { label: '本机接口地址', value: '192.168.10.2', type: 'text', hint: '主备各不同', desc: '这是设备自己的真实地址，终端不用它；终端用的是 VIP。' },
        mask: { label: '掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '主备两端必须一致。' },
        vip: { label: '虚拟网关地址', value: '192.168.10.1', type: 'text', hint: '终端填这个', desc: 'VRID 相同、VIP 相同的两台设备自动组成一个备份组，优先级高的当 Master。' },
        vrid: { label: 'VRID', value: '1', type: 'int', min: 1, max: 255, hint: '1–255', desc: '同一网段里只能有一个备份组用这个号，多个业务网段用不同的 VRID。' },
        priority: { label: '优先级', value: '120', type: 'int', min: 1, max: 254, hint: '默认 100，大的是主', desc: '主机给 120，备机保持默认 100。有人把备机也设成 120 就会双主。' },
        delay: { label: '抢占延迟（秒）', value: '20', type: 'int', min: 0, max: 3600, hint: '10–60', desc: '主机重启回来别马上抢，等路由收敛完再接管，否则会瞬断。' }
      },
      docs: {
        secs: [
          { h: 'track 才是关键', p: '只配 VRRP，主机上行口断了它照样是 Master，因为它自己不知道出口没了——终端全部黑洞。track interface 让上行口 down 时优先级自动降 30，备机超过它就接管。' },
          { h: '为什么要改成 BFD 联动', p: '接口 down 能触发，但「接口 up 着、中间链路断了」触发不了。要求更快可以用 vrrp vrid 1 track bfd-session xxx，毫秒级感知。' },
          { h: 'VIP 不能和接口地址重复', p: '虚拟 IP 必须是网段里没人用的地址，配成和某台设备的接口地址一样会报错。' }
        ]
      }
    },

    {
      id: 'bfd-static',
      title: 'BFD 联动静态路由',
      desc: '静态路由自己感知不到链路故障，靠 BFD 在毫秒级把它撤掉，切到备份路径。',
      tags: ['BFD', '静态路由', '可靠性'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `bfd {{bfdName}} bind peer-ip {{peerIp}} interface GigabitEthernet0/0/1
 discriminator local {{localId}}
 discriminator remote {{remoteId}}
 commit
 quit
ip route-static {{dstNet}} {{dstMask}} {{nextHop}} track bfd-session {{bfdName}}`,
      vars: {
        bfdName: { label: 'BFD 会话名', value: 'to-core', type: 'text', hint: '自定义', desc: '后面 track 要引用这个名字。' },
        peerIp: { label: '对端地址', value: '10.0.0.2', type: 'text', hint: '直连对端接口 IP', desc: 'BFD 走 UDP 3784，两端地址必须互达。' },
        localId: { label: '本地标识', value: '1', type: 'int', min: 1, max: 8191, hint: '1–8191', desc: '本端随便定，但必须等于对端的 remote 值，两边要成对配。' },
        remoteId: { label: '远端标识', value: '2', type: 'int', min: 1, max: 8191, hint: '1–8191', desc: '填对端配置里的 local 值。填错的表现是会话一直 Down，日志里提示 discriminator 不匹配。' },
        dstNet: { label: '目的网段', value: '0.0.0.0', type: 'text', hint: '默认路由就填 0.0.0.0', desc: '要绑 BFD 的那条路由的目的地址。' },
        dstMask: { label: '掩码', value: '0.0.0.0', type: 'text', hint: '默认路由填 0.0.0.0', desc: '和上一项配套。' },
        nextHop: { label: '下一跳', value: '10.0.0.2', type: 'text', hint: '与 BFD 对端一致', desc: '一般就是 BFD 对端地址。' }
      },
      docs: {
        secs: [
          { h: '为什么静态路由需要它', p: '静态路由只要接口 up 就一直在路由表里，哪怕中间的光缆断了。BFD 用高频小包探测，几个毫秒发现不通，把路由撤掉，备份路由立刻生效。' },
          { h: '两端都要配', p: 'BFD 是双向协商，只配一边会一直处于 Down。对端也要有一条 bind peer-ip 指向你这边的地址。' },
          { h: 'commit 别忘了', p: 'discriminator 配完必须 commit 才生效，漏了会提示会话未创建。' }
        ]
      }
    },

    /* ---------------- OSPF 全家族 ---------------- */
    {
      id: 'ospf-single-area',
      title: 'OSPF 单区域最小配置',
      desc: '两台三层设备跑通 OSPF 只需要三行：进程、router-id、network。',
      tags: ['OSPF', '动态路由', '基础'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `ospf {{procId}} router-id {{routerId}}
 area 0.0.0.0
  network {{net}} {{wildcard}}
  quit
 quit`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本机有效', desc: '进程号只有本地意义，两端不一样也能建邻居，别在这上面排查问题。' },
        routerId: { label: 'Router ID', value: '1.1.1.1', type: 'text', hint: '点分十进制，全网唯一', desc: '不配的话会自动选最大的接口地址，接口一变动就变，邻居关系跟着抖。建议手工指定 Loopback0 的地址。' },
        net: { label: '宣告网段', value: '192.168.10.0', type: 'text', hint: '要宣告的网段', desc: '宣告的是「哪些网段参与 OSPF」，不是「从哪个接口发」。' },
        wildcard: { label: '反掩码', value: '0.0.0.255', type: 'text', hint: '/24 对应 0.0.0.255', desc: 'OSPF 用反掩码，和 ACL 一样。写成 255.255.255.0 会报错。' }
      },
      docs: {
        secs: [
          { h: 'network 的语义', p: 'network 192.168.10.0 0.0.0.255 表示「凡是地址落在这个范围内的接口，都参与 OSPF 并且属于该区域」。所以接口 IP 改了但 network 没改，邻居就断了。' },
          { h: '邻居起不来的三个默认原因', p: '① 区域号不一致；② 两端掩码不一致（A 是 /24、B 是 /30 就建不起来）；③ hello/dead 定时器不一致。这三条占了九成。' },
          { h: '不要宣告外网口', p: '把公网出口也宣告进 OSPF，等于向运营商发内部路由。出口用默认路由 + import-route。' }
        ]
      }
    },

    {
      id: 'ospf-multi-area',
      title: 'OSPF 多区域 + MD5 认证',
      desc: '区域多了要防「野路由器」插进来乱发 LSA，MD5 认证是最低成本的兜底。',
      tags: ['OSPF', '多区域', '认证'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `ospf {{procId}} router-id {{routerId}}
 area 0.0.0.0
  authentication-mode md5
  network {{backboneNet}} {{backboneWildcard}}
  quit
 area {{areaId}}
  authentication-mode md5
  network {{branchNet}} {{branchWildcard}}
  quit
 quit
interface GigabitEthernet0/0/1
 ospf authentication-mode md5 {{keyId}} cipher {{keyText}}
 quit`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本机有效', desc: '本地有效，两端可不同。' },
        routerId: { label: 'Router ID', value: '1.1.1.1', type: 'text', hint: '全网唯一', desc: '建议用 Loopback 地址，稳定不抖。' },
        backboneNet: { label: '骨干区网段', value: '10.0.0.0', type: 'text', hint: '区域 0 的网段', desc: 'ABR 至少要有一个接口在区域 0，否则区域间路由传不过去。' },
        backboneWildcard: { label: '骨干区反掩码', value: '0.0.0.3', type: 'text', hint: '/30 对应 0.0.0.3', desc: '互联口通常是 /30 或 /31。' },
        areaId: { label: '分支区域号', value: '0.0.0.1', type: 'text', hint: '也可写 1', desc: '非骨干区域必须直连区域 0，否则要靠虚连接。' },
        branchNet: { label: '分支网段', value: '192.168.20.0', type: 'text', hint: '该区域的业务网段', desc: '分支区域内的业务地址。' },
        branchWildcard: { label: '分支反掩码', value: '0.0.0.255', type: 'text', hint: '/24 对应 0.0.0.255', desc: '和网段配套。' },
        keyId: { label: '密钥 ID', value: '1', type: 'int', min: 1, max: 255, hint: '1–255', desc: '两端必须一致，不一致会提示 authentication failure。' },
        keyText: { label: '密钥', value: 'Ospf@2026', type: 'text', hint: '两端一致', desc: 'cipher 表示以密文存储，配置文件里看不到明文。' }
      },
      docs: {
        secs: [
          { h: '区域认证 vs 接口认证', p: 'area 下写 authentication-mode 是「这个区域默认都认证」，还要在接口上用 ospf authentication-mode 给具体密钥；两处都写才生效。只写区域级不写接口级，邻居照样起不来。' },
          { h: '认证失败怎么认', p: 'display ospf error 能看到 authentication failure 计数在涨；邻居卡在 Init 或直接没有。这类问题和 hello 定时器不一致的表现很像，先看 error 计数再动手。' },
          { h: 'ABR 必须贴着区域 0', p: '非骨干区域之间的路由不会直接互通，必须经区域 0 中转。所以分支区域要直连骨干，隔开了就得配虚连接。' }
        ]
      }
    },

    {
      id: 'ospf-stub-nssa',
      title: 'OSPF 特殊区域（Stub / NSSA）',
      desc: '分支只有一条出口时，把外部 LSA 挡住，省下路由表也省下设备内存。',
      tags: ['OSPF', 'Stub', 'NSSA'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `ospf {{procId}}
 area {{stubArea}}
  stub
  quit
 area {{nssaArea}}
  nssa
  quit
 quit`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本机有效', desc: '本地有效。' },
        stubArea: { label: 'Stub 区域', value: '0.0.0.1', type: 'text', hint: '只有单出口的分支', desc: 'Stub 区域拒绝 Type 5 外部 LSA，改由 ABR 下发一条默认路由。区域内不能有 ASBR。' },
        nssaArea: { label: 'NSSA 区域', value: '0.0.0.2', type: 'text', hint: '有外部路由要引入的分支', desc: 'NSSA 也拒绝 Type 5，但允许区域内有 ASBR，用 Type 7 在本区域内传递外部路由。' }
      },
      docs: {
        secs: [
          { h: 'Stub 和 NSSA 怎么选', p: '分支里没有要引入的外部路由（比如没有出口），用 stub；分支自己要引几条静态路由进来（有本地出口），用 nssa。选错了会报错或者路由丢了。' },
          { h: 'no-summary 再省一层', p: 'stub no-summary（完全 Stub）连 Type 3 区域间路由也挡掉，只留一条默认路由。NSSA 对应 nssa no-summary。适合「只有一条路出去」的分支。' },
          { h: '所有路由器都要配', p: '同一个区域里的设备必须全部配成同样的特殊区域类型，有一台没配就建不了邻居，报 area type mismatch。' },
          { h: '骨干区域不能是特殊区域', p: '区域 0 永远不能配 stub/nssa。' }
        ]
      }
    },

    {
      id: 'ospf-summary',
      title: 'OSPF 路由汇总',
      desc: '一个区域里几十条明细路由，汇总成一条发出去，邻居的路由表立刻就干净了。',
      tags: ['OSPF', '路由汇总', '优化'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `ospf {{procId}}
 area {{areaId}}
  abr-summary {{areaNet}} {{areaMask}}
  quit
 asbr-summary {{extNet}} {{extMask}}
 quit`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本地有效', desc: '本地有效。' },
        areaId: { label: '区域号', value: '0.0.0.1', type: 'text', hint: '被汇总的区域', desc: '汇总动作发生在 ABR 上，写在「被汇总的那个区域」下面。' },
        areaNet: { label: '区域间汇总地址', value: '192.168.16.0', type: 'text', hint: '能覆盖明细的网段', desc: '比如明细是 16.0/24 到 23.0/24，汇总成 16.0/20。' },
        areaMask: { label: '区域间汇总掩码', value: '255.255.240.0', type: 'text', hint: '/20 对应 255.255.240.0', desc: '掩码要能把所有明细盖住，盖不住会丢路由。' },
        extNet: { label: '外部路由汇总地址', value: '172.16.0.0', type: 'text', hint: 'ASBR 上引入的路由', desc: '外部路由汇总写在 ASBR 的进程视图下。' },
        extMask: { label: '外部汇总掩码', value: '255.255.0.0', type: 'text', hint: '/16', desc: '同上，注意别把不该通的路由也汇总进来。' }
      },
      docs: {
        secs: [
          { h: '两种汇总位置不同', p: 'abr-summary 写在 area 视图，只有 ABR 有效；asbr-summary 写在进程视图，只有 ASBR 有效。位置写错不报错，但一点效果都没有。' },
          { h: '汇总会掩盖故障', p: '把 16.0/24 到 23.0/24 汇总成 16.0/20 之后，其中一条明细断了，邻居是感知不到的——它只看到汇总路由还在。这是代价，不是 bug。' },
          { h: '掩码算错的典型现象', p: '汇总地址和掩码覆盖不到某些明细，那些明细依然单独出现在路由表里，看起来像「汇总没生效」。' }
        ]
      }
    },

    {
      id: 'ospf-vlink',
      title: 'OSPF 虚连接（Virtual Link）',
      desc: '分支区域被隔开、没有直连骨干区时的补救手段——通过一个中转区域「借道」。',
      tags: ['OSPF', '虚连接', '拓扑'],
      device: 'S5700 / AR2220',
      level: '综合',
      code: `ospf {{procId}}
 area {{transitArea}}
  vlink-peer {{remoteRouterId}}
  quit
 quit`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本地有效', desc: '本地有效。' },
        transitArea: { label: '中转区域', value: '0.0.0.2', type: 'text', hint: '两端共同所在的区域', desc: '虚连接写在「穿过的那个区域」下，不是要连接的区域。' },
        remoteRouterId: { label: '对端 Router ID', value: '2.2.2.2', type: 'text', hint: '对端设备的 RID', desc: '填对端的 Router ID，不是接口 IP。填成接口地址是最常见的错误。' }
      },
      docs: {
        secs: [
          { h: '什么时候真的需要它', p: '区域 2 直接连在区域 1 上，中间没有区域 0。这时区域 2 的路由传不到其他区域，用虚连接把区域 2 的逻辑链路「搭」到区域 0 上。' },
          { h: '两端都要配', p: '虚连接是双向的，A 指向 B 的 RID，B 也要指向 A 的 RID，缺一边只能单向通。' },
          { h: '中转区域不能是 Stub', p: 'Stub/NSSA 区域不能承载虚连接，因为虚连接需要 Type 3/4 LSA 传输，而 Stub 挡住了这些。' },
          { h: '能不用就别用', p: '虚连接让拓扑变复杂、排障变难。设计上能直连骨干就别绕。' }
        ]
      }
    },

    /* ---------------- 策略与 IPv6 ---------------- */
    {
      id: 'rip-v2',
      title: 'RIPv2（带认证与不汇总）',
      desc: '小网络或老旧设备互联还能碰到，配的时候注意关掉自动汇总。',
      tags: ['RIP', '动态路由', '老旧协议'],
      device: 'AR2220 / S5700',
      level: '进阶',
      code: `rip {{procId}}
 version 2
 undo summary
 network {{net}}
 silent-interface {{silentIntf}}
 quit`,
      vars: {
        procId: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本地有效', desc: '本地有效。' },
        net: { label: '宣告网段', value: '192.168.10.0', type: 'text', hint: '主类网段', desc: 'RIP 按主类网段宣告，写 192.168.10.0 实际宣告的是整个 192.168.10.0/24。' },
        silentIntf: { label: '抑制接口', value: 'GigabitEthernet0/0/24', type: 'text', hint: '只收不发的接口', desc: '接终端的接口设成 silent，不往外发 RIP 报文，省带宽也少暴露信息。' }
      },
      docs: {
        secs: [
          { h: 'undo summary 必须加', p: 'RIPv2 默认会把子网汇总成主类网络边界，跨网段时明细就丢了。关掉自动汇总才能传明细路由。' },
          { h: '跳数上限 15', p: '16 跳视为不可达。网络直径超过 15 台设备就不要用 RIP 了，怎么调都不对。' },
          { h: '收敛慢是天然的', p: 'RIP 靠 30 秒一次的周期更新，拓扑变了要等好几个周期才收敛。这也是它被 OSPF 取代的原因。' }
        ]
      }
    },

    {
      id: 'route-policy',
      title: '路由策略 route-policy',
      desc: '哪些路由能进来、进来后改什么属性，全靠它——路由控制的主力工具。',
      tags: ['路由策略', 'route-policy', 'ACL'],
      device: 'S5700 / AR2220',
      level: '综合',
      code: `acl number 2000
 rule 5 permit source {{matchNet}} {{matchWildcard}}
 quit
route-policy {{policyName}} permit node 10
 if-match acl 2000
 apply cost {{cost}}
 apply tag {{tag}}
 quit
route-policy {{policyName}} permit node 20
 quit`,
      vars: {
        matchNet: { label: '匹配网段', value: '192.168.20.0', type: 'text', hint: '要特殊处理的路由', desc: 'ACL 匹配的是路由的目的地址。' },
        matchWildcard: { label: '反掩码', value: '0.0.0.255', type: 'text', hint: '/24 对应 0.0.0.255', desc: '和网段配套。' },
        policyName: { label: '策略名', value: 'RP-IMPORT', type: 'text', hint: '英文大写好认', desc: '后面 import-route 或 filter-policy 要引用。' },
        cost: { label: '设置开销', value: '50', type: 'int', min: 1, max: 65535, hint: '越大越不优先', desc: 'apply cost 改的是路由的度量值，用来影响选路。' },
        tag: { label: '设置 Tag', value: '100', type: 'int', min: 0, max: 4294967295, hint: '标记来源', desc: '给路由打标记，方便在别的设备上按 tag 过滤或做策略。' }
      },
      docs: {
        secs: [
          { h: 'node 20 那三行的作用', p: 'route-policy 末尾默认是 deny all —— 没被任何 node 匹配到的路由会被丢掉。加一个空的 permit node 20 才能「匹配到的特殊处理、其余放行」。少了它，大量正常路由会凭空消失。' },
          { h: 'if-match 之间是「与」', p: '同一个 node 里多个 if-match 必须全部满足才命中；不同 node 之间按 node 号从小到大依次匹配，命中一个就停。' },
          { h: '改属性 vs 过滤', p: 'route-policy 里 apply 是改属性，deny 才是过滤。只想过滤不想改，用 filter-policy 更直接。' }
        ]
      }
    },

    {
      id: 'pbr-config',
      title: '策略路由 PBR',
      desc: '不按目的地址转发，而是按源地址 / 端口指定下一跳——双出口分流的标准做法。',
      tags: ['PBR', '策略路由', '双出口'],
      device: 'S5700 / AR2220',
      level: '综合',
      code: `acl number 3000
 rule 5 permit ip source {{srcNet}} {{srcWildcard}} destination {{dstNet}} {{dstWildcard}}
 quit
traffic classifier {{clsName}} operator or
 if-match acl 3000
 quit
traffic behavior {{behName}}
 redirect ip-nexthop {{nextHop}}
 quit
traffic policy {{polName}}
 classifier {{clsName}} behavior {{behName}}
 quit
interface GigabitEthernet0/0/1
 traffic-policy {{polName}} inbound
 quit`,
      vars: {
        srcNet: { label: '源网段', value: '192.168.20.0', type: 'text', hint: '要分流的用户', desc: '比如让访客网走第二条出口。' },
        srcWildcard: { label: '源反掩码', value: '0.0.0.255', type: 'text', hint: '/24', desc: '和源网段配套。' },
        dstNet: { label: '目的网段', value: '0.0.0.0', type: 'text', hint: '0.0.0.0 表示任意', desc: '只想让访问特定目标走特殊链路时才填具体网段。' },
        dstWildcard: { label: '目的反掩码', value: '255.255.255.255', type: 'text', hint: '任意目的填全 1', desc: '0.0.0.0/0 对应反掩码 255.255.255.255。' },
        clsName: { label: '流分类名', value: 'CLS-GUEST', type: 'text', hint: '提示用途', desc: '和 behavior、policy 配套命名。' },
        behName: { label: '流行为名', value: 'BEH-ISP2', type: 'text', hint: '提示动作', desc: '一个行为只做一件事，改下一跳就用 redirect。' },
        nextHop: { label: '指定下一跳', value: '10.1.1.2', type: 'text', hint: '第二条出口的对端', desc: '这个地址必须直连可达，否则策略命中后报文直接丢。' },
        polName: { label: '流策略名', value: 'POL-GUEST', type: 'text', hint: '接口上引用它', desc: '真正生效的位置在接口上。' }
      },
      docs: {
        secs: [
          { h: 'PBR 优先级高于路由表', p: '命中流策略的报文不再查路由表，直接按 redirect 的下一跳走。所以下一跳不可达时是「黑洞」而不是「回退到路由表」。' },
          { h: 'default 流行为兜底', p: '一个 traffic policy 里最好配一条 classifier default behavior xxx，否则没命中的报文走默认动作，有时会丢。' },
          { h: '只在入口方向生效', p: 'traffic-policy inbound 是标准用法；outbound 方向很多型号不支持 PBR，配了不报错但不生效。' }
        ]
      }
    },

    {
      id: 'acl-time-range',
      title: 'ACL + 时间段管控',
      desc: '上班时间禁止某类访问、午休放行，靠 time-range 挂到 ACL 规则上。',
      tags: ['ACL', '时间段', '访问控制'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `time-range {{rangeName}} {{startTime}} to {{endTime}} {{days}}
acl number {{aclNo}}
 rule 5 deny tcp source {{srcNet}} {{srcWildcard}} destination {{dstIp}} 0 destination-port eq {{port}} time-range {{rangeName}}
 rule 10 permit ip
 quit`,
      vars: {
        rangeName: { label: '时间段名', value: 'worktime', type: 'text', hint: '英文', desc: 'ACL 规则里按名字引用。' },
        startTime: { label: '开始时间', value: '08:30', type: 'text', hint: 'HH:MM', desc: '时间段起点。' },
        endTime: { label: '结束时间', value: '18:00', type: 'text', hint: 'HH:MM', desc: '时间段终点。' },
        days: { label: '生效日', value: 'working-day', type: 'text', hint: 'daily / working-day / off-day', desc: 'working-day 只在工作日生效，daily 每天都生效。也可以写 Mon Tue 指定星期。' },
        aclNo: { label: 'ACL 编号', value: '3000', type: 'int', min: 3000, max: 3999, hint: '3000–3999 高级 ACL', desc: '高级 ACL 能同时匹配源、目的、协议、端口；2000–2999 只能匹配源地址。' },
        srcNet: { label: '源网段', value: '192.168.20.0', type: 'text', hint: '被限制的用户', desc: '谁不能访问。' },
        srcWildcard: { label: '源反掩码', value: '0.0.0.255', type: 'text', hint: '/24', desc: '和源网段配套。' },
        dstIp: { label: '目的地址', value: '10.10.10.10', type: 'text', hint: '具体服务器 IP', desc: '单个目标地址，对应反掩码 0。' },
        port: { label: '目的端口', value: '80', type: 'int', min: 1, max: 65535, hint: '80 / 443 / 3389', desc: '配合 tcp 协议使用，udp 也一样。' }
      },
      docs: {
        secs: [
          { h: '最后那条 permit ip 是保命的', p: 'ACL 末尾隐式 deny all。如果只写一条 deny 就想「只挡这个」，结果是把所有流量都挡住了。必须显式补一条 permit。' },
          { h: '时间段依赖设备时钟', p: 'time-range 用的是设备本地时间。设备时间不对，管控就会在错误的时间生效——所以 NTP 是前提。' },
          { h: '规则顺序决定结果', p: 'ACL 从上到下匹配，命中即停。permit 写在 deny 前面，deny 就永远轮不到。rule 后面的数字就是顺序号，建议留出间隔方便插入。' }
        ]
      }
    },

    {
      id: 'nat-napt',
      title: 'NAT 地址池复用（NAPT）',
      desc: '内网一个 /24 只有几个公网地址时，用地址池做端口级复用。',
      tags: ['NAT', '地址池', '出口'],
      device: 'AR2220',
      level: '进阶',
      code: `acl number 2000
 rule 5 permit source {{insideNet}} {{insideWildcard}}
 quit
nat address-group 1 {{poolStart}} {{poolEnd}}
 quit
interface GigabitEthernet0/0/1
 nat outbound 2000 address-group 1
 quit`,
      vars: {
        insideNet: { label: '内网网段', value: '192.168.10.0', type: 'text', hint: '要上网的内网', desc: '只有匹配这个 ACL 的流量才做 NAT。' },
        insideWildcard: { label: '内网反掩码', value: '0.0.0.255', type: 'text', hint: '/24', desc: '和网段配套。' },
        poolStart: { label: '地址池起始', value: '200.1.1.10', type: 'text', hint: '公网地址段内', desc: '运营商给的一段公网地址。' },
        poolEnd: { label: '地址池结束', value: '200.1.1.20', type: 'text', hint: '与起始同段', desc: '11 个地址能撑几百个内网终端，靠端口复用实现。' }
      },
      docs: {
        secs: [
          { h: '什么时候用地址池', p: '只有 1 个公网地址用 easy-ip 更省事；有多个地址、或者要给不同部门分配不同出口地址，才建地址池。' },
          { h: '端口复用上限', p: '一个公网 IP 理论 65535 个端口，实际可用约 4 万连接。终端特别多时会出现「地址池有地址但新连接建不起来」，这时候要扩池或者做连接数限制。' },
          { h: '内网口别做 NAT', p: 'nat outbound 要配在出公网的接口上。配在内网口方向会对内网流量做转换，表现是内网互访全断。' }
        ]
      }
    },

    {
      id: 'ipv6-basic',
      title: 'IPv6 地址与 RA 基础',
      desc: '开 IPv6、配地址、放行 RA——三步走完终端才能拿到自动配置的地址。',
      tags: ['IPv6', 'ND', '基础'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `ipv6
interface Vlanif{{vlanId}}
 ipv6 enable
 ipv6 address {{ipv6Addr}}/{{prefixLen}}
 undo ipv6 nd ra halt
 quit`,
      vars: {
        vlanId: { label: 'VLAN', value: '10', type: 'int', min: 1, max: 4094, hint: '业务 VLAN', desc: '终端所在的二层 VLAN。' },
        ipv6Addr: { label: 'IPv6 地址', value: '2001:db8:10::1', type: 'text', hint: '写前缀部分', desc: '这是网关地址，终端会用 RA 里的前缀加自己的接口标识生成地址。' },
        prefixLen: { label: '前缀长度', value: '64', type: 'int', min: 1, max: 128, hint: '业务网段一般 64', desc: 'SLAAC 要求必须是 /64，写 /48 终端拿不到地址。' }
      },
      docs: {
        secs: [
          { h: 'undo ipv6 nd ra halt 为什么必须', p: '设备接口默认不发送 RA 报文。不放开这条，终端永远收不到前缀，自动配置一直处于「正在获取」状态。这是 IPv6 实验里最高频的坑。' },
          { h: '全局 ipv6 要先开', p: 'interface 下的 ipv6 enable 是接口级开关，system-view 下的 ipv6 是设备级总开关。只开接口不开全局，接口上配不了地址。' },
          { h: '一个接口可以有多个地址', p: 'link-local 是自动生成的（fe80:: 开头），全局地址可以手工配多个。别把 fe80 地址配给终端做网关。' }
        ]
      }
    },

    {
      id: 'ipv6-ospfv3',
      title: 'IPv6 路由：静态 + OSPFv3',
      desc: 'OSPFv3 是给 IPv6 重写的版本，配置思路和 OSPFv2 一样，但网段声明挪到了接口上。',
      tags: ['IPv6', 'OSPFv3', '动态路由'],
      device: 'AR2220 / S5700',
      level: '综合',
      code: `ipv6
ipv6 route-static {{dstPrefix}} {{dstLen}} {{nextHop}}
ospfv3 {{procId}}
 router-id {{routerId}}
 quit
interface GigabitEthernet0/0/1
 ipv6 enable
 ipv6 address {{localAddr}}/{{prefixLen}}
 ospfv3 {{procId}} area 0.0.0.0
 quit`,
      vars: {
        dstPrefix: { label: '目的前缀', value: '2001:db8:20::', type: 'text', hint: '静态路由目标', desc: '要去的 IPv6 网段。' },
        dstLen: { label: '前缀长度', value: '64', type: 'int', min: 1, max: 128, hint: '常用 64', desc: '和目的前缀配套。' },
        nextHop: { label: '下一跳', value: '2001:db8:10::2', type: 'text', hint: '直连对端地址', desc: 'IPv6 静态路由的下一跳必须是链路可达的地址。' },
        procId: { label: 'OSPFv3 进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本地有效', desc: '本地有效。' },
        routerId: { label: 'Router ID', value: '3.3.3.3', type: 'text', hint: '仍是 IPv4 格式', desc: 'OSPFv3 的 Router ID 还是点分十进制 IPv4 格式，这点很多人会愣一下。' },
        localAddr: { label: '接口地址', value: '2001:db8:10::1', type: 'text', hint: '本接口 IPv6 地址', desc: '互联接口的地址。' },
        prefixLen: { label: '接口前缀长度', value: '64', type: 'int', min: 1, max: 128, hint: '互联可用 64', desc: '和接口地址配套。' }
      },
      docs: {
        secs: [
          { h: '最大的变化：没有 network 命令', p: 'OSPFv3 不在进程里写 network 宣告网段，而是直接在接口上用 ospfv3 1 area 0 把接口挂进区域。找不到 network 命令不是漏了，是设计变了。' },
          { h: 'Router ID 必须手工配', p: 'OSPFv3 不依赖 IPv4 地址自动选 RID，设备上没配 IPv4 地址时进程起不来。养成在进程下写 router-id 的习惯。' }
        ]
      }
    },

    {
      id: 'dhcpv6',
      title: 'DHCPv6 有状态分配',
      desc: 'IPv6 也要像 IPv4 那样集中管地址、发 DNS，用 DHCPv6 而不是纯 SLAAC。',
      tags: ['IPv6', 'DHCPv6', '地址分配'],
      device: 'AR2220 / S5700',
      level: '综合',
      code: `ipv6
dhcpv6 pool {{poolName}}
 address prefix {{prefix}}/{{prefixLen}}
 excluded-address {{excludeStart}} {{excludeEnd}}
 dns-server {{dnsAddr}}
 quit
interface Vlanif{{vlanId}}
 ipv6 enable
 ipv6 address {{gatewayAddr}}/{{prefixLen2}}
 dhcpv6 server {{poolName}}
 undo ipv6 nd ra halt
 quit`,
      vars: {
        poolName: { label: '地址池名', value: 'v6pool', type: 'text', hint: '英文', desc: '接口上用这个名字引用。' },
        prefix: { label: '地址前缀', value: '2001:db8:10::', type: 'text', hint: '要分配的网段', desc: '终端从这个前缀里取地址。' },
        prefixLen: { label: '前缀长度', value: '64', type: 'int', min: 1, max: 128, hint: '一般 64', desc: '和前缀配套。' },
        excludeStart: { label: '排除起始', value: '2001:db8:10::1', type: 'text', hint: '网关等固定地址', desc: '把网关、服务器地址排除掉，免得被分配给终端造成冲突。' },
        excludeEnd: { label: '排除结束', value: '2001:db8:10::ff', type: 'text', hint: '与起始配套', desc: '排除一段连续地址。' },
        dnsAddr: { label: 'DNS 地址', value: '2001:db8:10::1', type: 'text', hint: 'IPv6 DNS', desc: '没有 DNS 终端能通 IP 但解析不了域名。' },
        vlanId: { label: 'VLAN', value: '10', type: 'int', min: 1, max: 4094, hint: '业务 VLAN', desc: '终端所在 VLAN。' },
        gatewayAddr: { label: '网关地址', value: '2001:db8:10::1', type: 'text', hint: '本接口 IPv6', desc: '同时作为终端的默认网关。' },
        prefixLen2: { label: '接口前缀长度', value: '64', type: 'int', min: 1, max: 128, hint: '一般 64', desc: '和网关地址配套。' }
      },
      docs: {
        secs: [
          { h: '有状态 vs 无状态', p: 'SLAAC 靠 RA 里的前缀自动拼地址，不给 DNS 也不给租期；DHCPv6 有状态能下 DNS、能集中管理租期。企业网通常 DHCPv6 拿地址 + RA 给默认网关，两者配合。' },
          { h: 'RA 里的 M 位', p: '要让终端用 DHCPv6 拿地址，RA 报文的 M 标志位要置 1。VRP 上配了 dhcpv6 server 之后会自动处理，但如果你同时又想保留 SLAAC，注意别把 M/O 位配冲突。' },
          { h: '排除地址不是可选的', p: '不排除网关地址，DHCPv6 可能把网关地址分给终端，全网随机性断网，而且极难排查。' }
        ]
      }
    },

    {
      id: 'dhcp-option-43',
      title: 'DHCP Option 43（给 AP 下发 AC 地址）',
      desc: 'AP 出厂不知道 AC 在哪，靠 DHCP 的 Option 43 告诉它——WLAN 开局必配。',
      tags: ['DHCP', 'Option 43', 'WLAN'],
      device: 'S5700 / AR2220',
      level: '进阶',
      code: `dhcp enable
ip pool {{poolName}}
 network {{net}} mask {{mask}}
 gateway-list {{gateway}}
 option 43 sub-option 2 ip-address {{acIp}}
 quit`,
      vars: {
        poolName: { label: '地址池名', value: 'ap-pool', type: 'text', hint: '给 AP 用的池', desc: 'AP 和管理网段通常单独一个池，方便做策略。' },
        net: { label: '网段', value: '192.168.100.0', type: 'text', hint: 'AP 管理网段', desc: 'AP 拿地址的网段。' },
        mask: { label: '掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '和网段配套。' },
        gateway: { label: '网关', value: '192.168.100.1', type: 'text', hint: '管理 VLAN 网关', desc: 'AP 的默认网关。' },
        acIp: { label: 'AC 地址', value: '192.168.100.254', type: 'text', hint: 'AC 的 capwap 源地址', desc: 'AP 拿到这个地址后主动去建 CAPWAP 隧道。华为设备用 sub-option 2。' }
      },
      docs: {
        secs: [
          { h: 'sub-option 2 是华为的写法', p: '华为 AP 从 Option 43 的 sub-option 2 里取 AC 地址（十六进制编码）。换成思科是 sub-option 241 或者直接把 IP 拼成字符串，不能照抄。' },
          { h: 'AP 和业务走不同 VLAN', p: 'AP 管理地址、员工业务地址分属不同 VLAN。Option 43 只决定 AP 去哪找 AC，不影响终端上网的业务 VLAN。' },
          { h: 'AP 拿不到地址先查这三条', p: '① 接口有没有 dhcp select global；② 地址池的 network 和接口地址是否同网段；③ 中间链路是否放通管理 VLAN。' }
        ]
      }
    },

    {
      id: 'qos-car',
      title: 'QoS 流量限速（CAR）',
      desc: '给某类流量封顶：超过就丢或者降级，用来防一条业务把出口带宽吃光。',
      tags: ['QoS', '限速', 'CAR'],
      device: 'S5700 / AR2220',
      level: '综合',
      code: `acl number 3000
 rule 5 permit ip source {{srcNet}} {{srcWildcard}}
 quit
traffic classifier {{clsName}} operator or
 if-match acl 3000
 quit
traffic behavior {{behName}}
 car cir {{cirKbps}} pir {{pirKbps}} cbs {{cbsBytes}} pbs {{pbsBytes}} green pass yellow pass red discard
 quit
traffic policy {{polName}}
 classifier {{clsName}} behavior {{behName}}
 quit
interface GigabitEthernet0/0/1
 traffic-policy {{polName}} inbound
 quit`,
      vars: {
        srcNet: { label: '限速对象', value: '192.168.20.0', type: 'text', hint: '按源网段限速', desc: '也可以改成匹配端口、DSCP 等其他条件。' },
        srcWildcard: { label: '反掩码', value: '0.0.0.255', type: 'text', hint: '/24', desc: '和网段配套。' },
        clsName: { label: '流分类名', value: 'CLS-LIMIT', type: 'text', hint: '提示用途', desc: '命名对应起来便于排障。' },
        behName: { label: '流行为名', value: 'BEH-LIMIT', type: 'text', hint: '提示动作', desc: '承载 car 动作。' },
        polName: { label: '流策略名', value: 'POL-LIMIT', type: 'text', hint: '接口引用', desc: '真正生效在接口上。' },
        cirKbps: { label: '承诺速率 CIR（kbps）', value: '10000', type: 'int', min: 64, max: 100000000, hint: '10000 = 10Mbps', desc: '低于这个速率保证转发。单位是 kbit/s，别当成 KB/s。' },
        pirKbps: { label: '峰值速率 PIR（kbps）', value: '20000', type: 'int', min: 64, max: 100000000, hint: '一般设成 CIR 的 1.5–2 倍', desc: '介于 CIR 和 PIR 之间的流量标黄，按 yellow 动作处理。' },
        cbsBytes: { label: '承诺突发 CBS（字节）', value: '187500', type: 'int', min: 1000, max: 100000000, hint: '约为 CIR×15ms', desc: '允许的突发量。设太小会把正常的突发打成红色丢包。' },
        pbsBytes: { label: '峰值突发 PBS（字节）', value: '375000', type: 'int', min: 1000, max: 100000000, hint: '约为 PIR×15ms', desc: '峰值突发量，一般取 CBS 的两倍。' }
      },
      docs: {
        secs: [
          { h: '单位最容易搞错', p: 'CIR/PIR 是 kbit/s，CBS/PBS 是字节。想限 10Mbps 填 10000，不是 10240 也不是 1024。填错十倍的现象是「限了跟没限一样」。' },
          { h: 'green pass yellow pass red discard 是标准三色', p: '绿通过、黄通过（也可改成 yellow remark-dscp 降级）、红丢弃。想对超额流量降级而不是丢，就把 yellow 改成重新标记。' },
          { h: '限速方向决定看谁', p: 'inbound 限的是「进入这个口」的流量，outbound 是「从这个口出去」。给用户限速要在他上联的口做 inbound，方向搞反等于没限。' }
        ]
      }
    }

  );
})(window.__ENSP);
