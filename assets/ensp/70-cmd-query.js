/* ============================================================
   码典 · eNSP 查询类命令词条（display / reset / debugging）
   ------------------------------------------------------------
   为什么要单独一个文件：
   排障时手里最先敲的永远是 display xxx，但以前的词典只有
   单字命令（display / isis / bgp），搜 "dis isis" 一条都对不上。
   这里按「看什么 → 在哪敲 → 关键字段怎么读」把查询命令补齐。

   约定：
   - key 用命令全名（含空格），只服务搜索，不参与代码高亮，
     免得 "all" "brief" 这种词把满屏代码都染蓝；
   - p 写清这个命令该看哪个字段、看不出所以然时下一步查什么；
   - eg 给一条能直接粘进 eNSP 的写法。
   ============================================================ */
(function (E) {
  'use strict';

  /* ================= 系统与设备 ================= */
  E.cmd['display version'] = {
    p: '第一手信息：VRP 版本、补丁号、设备型号、已运行时长。对不上手册的版本号，后面所有命令行为都可能不一样，先看这个。',
    eg: 'display version'
  };
  E.cmd['display current-configuration'] = {
    p: '内存里正在跑的配置（没 save 也在这），思科里对应 show run / show running-config。排查"明明配了却不生效"，先看这里有没有那一条。',
    eg: 'display current-configuration | include vlan'
  };
  E.cmd['display saved-configuration'] = {
    p: '下次启动会加载的配置（存在 vrpcfg.zip 里）。和 current 对比就知道断电后哪些会丢。',
    eg: 'display saved-configuration'
  };
  E.cmd['display startup'] = {
    p: '看下次启动用哪个配置文件、哪个 VRP 镜像。升级后起不来，多半是这里指错了文件。',
    eg: 'display startup'
  };
  E.cmd['display clock'] = {
    p: '设备当前时间。时间不对会让日志顺序错乱、时间段 ACL 全部失效。',
    eg: 'display clock'
  };
  E.cmd['display device'] = {
    p: '单板、电源、风扇槽位状态，看有没有 Abnormal 或 Offline。',
    eg: 'display device'
  };
  E.cmd['display elabel'] = {
    p: '电子标签：序列号、MAC 地址、制造日期。报修和做资产登记时需要。',
    eg: 'display elabel brief'
  };
  E.cmd['display cpu-usage'] = {
    p: 'CPU 占用率，重点看各任务的占比。控制面任务（如 OSPF/ARP）飙高通常是环路或攻击。',
    eg: 'display cpu-usage'
  };
  E.cmd['display memory-usage'] = {
    p: '内存占用率。持续上涨说明有泄漏，重启能缓解但根因要抓日志。',
    eg: 'display memory-usage'
  };
  E.cmd['display health'] = {
    p: '一键看健康度：CPU、内存、温度、电源、风扇汇总。开局巡检先跑这一条。',
    eg: 'display health'
  };
  E.cmd['display temperature'] = {
    p: '各单板温度。机房空调故障或风道堵塞时最先报警。',
    eg: 'display temperature all'
  };
  E.cmd['display fan'] = {
    p: '风扇状态与转速，看是否 Abnormal 或转速为 0。',
    eg: 'display fan'
  };
  E.cmd['display power'] = {
    p: '电源模块状态。双电源设备要看两路都在线，别只插了一路。',
    eg: 'display power'
  };
  E.cmd['display alarm'] = {
    p: '当前告警列表。有告警先清告警，别急着查业务。',
    eg: 'display alarm all'
  };
  E.cmd['display logbuffer'] = {
    p: '日志缓冲区：配置变更、接口 up/down、协议邻居抖动都在这。排障的时间线基本靠它。',
    eg: 'display logbuffer | include GigabitEthernet0/0/1'
  };
  E.cmd['display trapbuffer'] = {
    p: '告警缓冲区，和 logbuffer 互补：log 记事件，trap 记告警。',
    eg: 'display trapbuffer'
  };
  E.cmd['display users'] = {
    p: '当前登录的用户和来源 IP。发现陌生会话要立刻踢掉并改密码。',
    eg: 'display users'
  };
  E.cmd['display this'] = {
    p: '当前视图下已经生效的配置，不用回全局翻。配完一条想确认写没写进去，敲这个最快。',
    eg: 'display this'
  };
  E.cmd['display diagnostic-information'] = {
    p: '把版本、配置、接口、日志一次性打包成诊断信息。提工单时附这个，厂商才认。',
    eg: 'display diagnostic-information'
  };
  E.cmd['display patch-information'] = {
    p: '已加载的热补丁。有些 bug 靠打补丁修，不是升级版本。',
    eg: 'display patch-information'
  };
  E.cmd['display ntp-service status'] = {
    p: 'NTP 同步状态。Clock status 是 synchronized 才算真对上，unsynchronized 说明服务器没通。',
    eg: 'display ntp-service status'
  };
  E.cmd['display ssh server status'] = {
    p: 'SSH 服务开关、版本、认证超时。配了 SSH 却连不上，先确认这里是 Enable。',
    eg: 'display ssh server status'
  };
  E.cmd['display snmp-agent sys-info'] = {
    p: 'SNMP 版本与团体名/用户配置。网管采不到数据，多半是版本或团体名不匹配。',
    eg: 'display snmp-agent sys-info'
  };

  /* ================= 接口与链路 ================= */
  E.cmd['display interface brief'] = {
    p: '所有接口一屏看完：物理状态、协议状态、带宽利用率。Down 还是 Up 一眼定位，排障第一条命令。',
    eg: 'display interface brief'
  };
  E.cmd['display ip interface brief'] = {
    p: '只看三层：接口 IP、物理/协议状态。查"地址配了但 ping 不通"从这开始。',
    eg: 'display ip interface brief'
  };
  E.cmd['display interface'] = {
    p: '单个接口的详细统计：速率双工、收发字节、CRC 错包、丢包。看错包要盯 Errors 和 Discard 两行。',
    eg: 'display interface GigabitEthernet0/0/1'
  };
  E.cmd['display interface description'] = {
    p: '接口描述列表。规范做法是给每个口写 description，出问题直接按描述找人。',
    eg: 'display interface description'
  };
  E.cmd['display interface counters errors'] = {
    p: '只列错误计数：CRC、Runts、Giants、Collisions。CRC 涨得快通常是线缆、光模块或双工不匹配。',
    eg: 'display interface GigabitEthernet0/0/1 counters errors'
  };
  E.cmd['display transceiver interface'] = {
    p: '光模块信息：型号、波长、收发光功率。收光低于灵敏度就是光衰过大，换纤或换模块。',
    eg: 'display transceiver interface GigabitEthernet0/0/1 verbose'
  };
  E.cmd['display port vlan'] = {
    p: '每个接口的 PVID 和允许通过的 VLAN。Access 口看 PVID，Trunk 口看 Tagged 列表。',
    eg: 'display port vlan'
  };
  E.cmd['display eth-trunk'] = {
    p: '链路聚合组成员与状态。成员口 Selected 才算真正转发，Unselect 要查对端配置是否一致。',
    eg: 'display eth-trunk 1'
  };
  E.cmd['display link-aggregation verbose'] = {
    p: 'LACP 协商细节：系统优先级、MAC、各成员口的 LACP 状态机。看 Actor/Partner 两边参数对不对得上。',
    eg: 'display eth-trunk 1 verbose'
  };

  /* ================= 二层 ================= */
  E.cmd['display vlan'] = {
    p: 'VLAN 列表和每个 VLAN 里有哪几个接口。查"某个口到底在哪个 VLAN"最直接。',
    eg: 'display vlan'
  };
  E.cmd['display vlan verbose'] = {
    p: '单个 VLAN 的详情：包含哪些接口、二层组播、是否配置了 VLANIF。',
    eg: 'display vlan 10 verbose'
  };
  E.cmd['display mac-address'] = {
    p: 'MAC 地址表：MAC 在哪个接口、属于哪个 VLAN。查终端挂在哪个口、查 MAC 漂移都靠它。',
    eg: 'display mac-address | include 5489-98'
  };
  E.cmd['display mac-address aging-time'] = {
    p: 'MAC 老化时间，默认 300 秒。老化太短会导致频繁泛洪，太长会残留错误表项。',
    eg: 'display mac-address aging-time'
  };
  E.cmd['display stp'] = {
    p: '生成树完整状态：根桥是谁、本机开销、端口角色。根桥不是规划的那台，说明优先级没配对。',
    eg: 'display stp'
  };
  E.cmd['display stp brief'] = {
    p: '所有端口的 STP 角色和状态。ROOT/DESIGNATED 转发，ALTE 阻塞；出现 DISCARDING 要确认是否预期。',
    eg: 'display stp brief'
  };
  E.cmd['display stp region-configuration'] = {
    p: 'MST 域名、修订级别、实例与 VLAN 映射。三台交换机这三项必须完全一致，否则各算各的树。',
    eg: 'display stp region-configuration'
  };
  E.cmd['display loop-detection'] = {
    p: '环路检测状态。下面接的用户私接路由器造成环路，会在这里露出哪个口检出。',
    eg: 'display loop-detection'
  };
  E.cmd['display port-security'] = {
    p: '端口安全配置与已学习到的 MAC。触发了 protect/restrict/shutdown 要在这看计数和动作。',
    eg: 'display port-security interface GigabitEthernet0/0/1'
  };
  E.cmd['display arp'] = {
    p: 'ARP 表：IP 与 MAC 的映射。出现同一 MAC 对应多个 IP，基本就是 ARP 欺骗。',
    eg: 'display arp | include 192.168.10'
  };

  /* ================= 路由表 ================= */
  E.cmd['display ip routing-table'] = {
    p: 'IPv4 路由表（思科里叫 show ip route）。看目的网段、下一跳、出接口、优先级和开销。没有这条路由，后面全白搭。',
    eg: 'display ip routing-table'
  };
  E.cmd['display ip routing-table protocol'] = {
    p: '按协议过滤路由表：static / ospf / isis / bgp / direct。定位"协议学没学到"最快。',
    eg: 'display ip routing-table protocol ospf'
  };
  E.cmd['display ip routing-table verbose'] = {
    p: '一条路由的完整来源：谁生成的、优先级、标签、是否活跃。同网段多条时看谁被优选。',
    eg: 'display ip routing-table 192.168.20.0 verbose'
  };
  E.cmd['display fib'] = {
    p: '转发表（FIB）。路由表是控制面，FIB 才是真正转发用的；两者不一致说明表项没下发成功。',
    eg: 'display fib 192.168.20.1'
  };

  /* ================= OSPF ================= */
  E.cmd['display ospf peer'] = {
    p: 'OSPF 邻居与邻接状态。Full 才算收敛完成；停在 ExStart 多半是 MTU 或 MTU 校验问题，停在 2-Way 是 DR 选举正常现象。',
    eg: 'display ospf peer'
  };
  E.cmd['display ospf peer brief'] = {
    p: '邻居精简列表：Router ID、状态、接口。几十个邻居时用这个扫一眼谁掉了。',
    eg: 'display ospf peer brief'
  };
  E.cmd['display ospf routing'] = {
    p: 'OSPF 自己算出来的路由（不是全局路由表）。看区域、开销、下一跳，判断选路是否符合预期。',
    eg: 'display ospf routing'
  };
  E.cmd['display ospf lsdb'] = {
    p: '链路状态数据库。区域内所有路由器同一区域的 LSDB 必须一致，不一致就是没同步完或有过滤。',
    eg: 'display ospf lsdb'
  };
  E.cmd['display ospf interface'] = {
    p: '哪些接口跑了 OSPF、在哪个区域、DR 是谁、Hello/Dead 定时器。两端定时器不一致就建不了邻居。',
    eg: 'display ospf interface GigabitEthernet0/0/1'
  };
  E.cmd['display ospf error'] = {
    p: 'OSPF 收发包的错误统计。区域号不匹配、认证失败、MTU 不一致都会在这里计数，是查邻居起不来的关键。',
    eg: 'display ospf error'
  };
  E.cmd['display ospf brief'] = {
    p: 'OSPF 进程概况：Router ID、区域、SPF 计算次数。SPF 频繁计算说明拓扑一直在抖。',
    eg: 'display ospf brief'
  };
  E.cmd['display ospf vlink'] = {
    p: '虚连接状态。虚连接本质是单播隧道，底层必须有到对端 Router ID 的路由，否则永远 Down。',
    eg: 'display ospf vlink'
  };

  /* ================= IS-IS ================= */
  E.cmd['display isis peer'] = {
    p: 'IS-IS 邻居：State 必须是 Up，Holdtime 在倒数说明邻居还活着；Type 分出 L1/L2。一个 Level 起不来就查该级别的 circuit-level。',
    eg: 'display isis peer'
  };
  E.cmd['display isis peer verbose'] = {
    p: '邻居详情：对端 System ID、接口地址、优先级、邻接的 Level。排查级别不匹配看这里最准。',
    eg: 'display isis peer verbose'
  };
  E.cmd['display isis lsdb'] = {
    p: 'IS-IS 链路状态数据库。同 Level 的路由器 LSDB 必须一致；用 local 参数只看自己产生的 LSP。',
    eg: 'display isis lsdb'
  };
  E.cmd['display isis route'] = {
    p: 'IS-IS 计算出的路由。看目的地址、开销、下一跳和 Flags，判断 L1/L2 选路和渗透有没有生效。',
    eg: 'display isis route'
  };
  E.cmd['display isis interface'] = {
    p: '哪些接口使能了 IS-IS、运行在哪个 Level、开销、DIS 是谁。Level 配错是邻居起不来的第一原因。',
    eg: 'display isis interface'
  };
  E.cmd['display isis brief'] = {
    p: 'IS-IS 进程概况：System ID、级别、区域、SPF 次数。SPF 一直涨说明有链路在抖。',
    eg: 'display isis brief'
  };
  E.cmd['display isis name-table'] = {
    p: 'System ID 与主机名的对应表。看到一堆 0000.0000.0001 不知道是谁时，靠这张表翻译。',
    eg: 'display isis name-table'
  };
  E.cmd['display isis statistics'] = {
    p: 'IS-IS 收发包统计与错误计数。邻居起不来时看这里有没有收到 Hello、有没有认证失败。',
    eg: 'display isis statistics'
  };

  /* ================= BGP ================= */
  E.cmd['display bgp peer'] = {
    p: 'BGP 邻居状态与收发路由数。Established 才算成功；Active/Connect 是 TCP 没建起来，Idle 多半是配置未生效。',
    eg: 'display bgp peer'
  };
  E.cmd['display bgp peer verbose'] = {
    p: '邻居详情：状态机、定时器、收发的 Update 数、最后一次错误码。last error 是定位断链原因的关键。',
    eg: 'display bgp peer 10.0.0.2 verbose'
  };
  E.cmd['display bgp routing-table'] = {
    p: 'BGP 路由表。看 *> 前缀表示最优、NextHop 是否可达、Path 长度和 Origin。下一跳不可达是重灾区。',
    eg: 'display bgp routing-table'
  };
  E.cmd['display bgp routing-table community'] = {
    p: '按团体属性过滤 BGP 路由。打标签的策略到底生没生效，看这里。',
    eg: 'display bgp routing-table community 100:1'
  };
  E.cmd['display bgp routing-table as-path-filter'] = {
    p: '按 AS-Path 正则过滤，查"某条路径有没有被宣告出去"。',
    eg: 'display bgp routing-table as-path-filter 1'
  };
  E.cmd['display bgp network'] = {
    p: '本机用 network 命令宣告的网段，以及是否真的进了 BGP 表。宣告了但表里没有，通常是被策略挡了。',
    eg: 'display bgp network'
  };
  E.cmd['display bgp error'] = {
    p: 'BGP 错误统计：Notification 码、收包错误、TCP 建连失败。邻居反复断连时必看。',
    eg: 'display bgp error'
  };
  E.cmd['display bgp vpnv4 all peer'] = {
    p: 'MP-BGP 的 VPNv4 邻居状态。跨 AS 的 MPLS VPN 不通，先确认这一层有没有 Established。',
    eg: 'display bgp vpnv4 all peer'
  };

  /* ================= RIP ================= */
  E.cmd['display rip routing'] = {
    p: 'RIP 学到的路由：开销（跳数）、下一跳、老化时间。跳数 16 就是不可达。',
    eg: 'display rip 1 route'
  };
  E.cmd['display rip interface'] = {
    p: '哪些接口跑了 RIP、收发版本、是否抑制。版本不一致（v1/v2）是 RIP 邻居起不来的常见原因。',
    eg: 'display rip 1 interface'
  };

  /* ================= MPLS / VPN ================= */
  E.cmd['display mpls ldp session'] = {
    p: 'LDP 会话状态。Operational 才算成功；非 Operational 说明 TCP 646 端口没通或 LSR ID 配错。',
    eg: 'display mpls ldp session'
  };
  E.cmd['display mpls ldp peer'] = {
    p: 'LDP 对等体列表：对端 LSR ID、传输地址、发现来源。传输地址不可达是最常见断因。',
    eg: 'display mpls ldp peer'
  };
  E.cmd['display mpls ldp lsp'] = {
    p: 'LDP 分配的标签交换路径：入标签、出标签、下一跳。标签为 3 表示弹出（PHP）。',
    eg: 'display mpls ldp lsp'
  };
  E.cmd['display mpls lsp'] = {
    p: '所有 LSP（含静态和 LDP）。看 In/Out Label 和 Nexthop，判断标签转发是否通。',
    eg: 'display mpls lsp'
  };
  E.cmd['display mpls interface'] = {
    p: '哪些接口开了 MPLS 和 LDP。全局开了接口没开，标签转发照样不通。',
    eg: 'display mpls interface'
  };
  E.cmd['display ip vpn-instance'] = {
    p: 'VRF 列表。看每个 VPN 实例绑了哪些接口、RD 和 RT 是什么。',
    eg: 'display ip vpn-instance'
  };
  E.cmd['display ip vpn-instance verbose'] = {
    p: '单个 VRF 的详情：绑定的接口、RD、导入导出的 RT。RT 对不上，两个站点就互相看不到路由。',
    eg: 'display ip vpn-instance CUST-A verbose'
  };

  /* ================= 可靠性 ================= */
  E.cmd['display vrrp'] = {
    p: 'VRRP 主备状态：本机是 Master 还是 Backup、虚拟 IP、优先级。两台都是 Master 说明心跳断了。',
    eg: 'display vrrp'
  };
  E.cmd['display vrrp brief'] = {
    p: 'VRRP 精简列表：备份组、状态、优先级、抢占。快速核对主备关系是否符合预期。',
    eg: 'display vrrp brief'
  };
  E.cmd['display vrrp statistics'] = {
    p: 'VRRP 报文统计与状态切换原因。主备来回切，看这里的 last state change 和丢包计数。',
    eg: 'display vrrp statistics'
  };
  E.cmd['display bfd session all'] = {
    p: 'BFD 会话状态。Up 才算通；Down 时看诊断码（AdminDown / ControlTimerExpired）。',
    eg: 'display bfd session all'
  };
  E.cmd['display bfd session all verbose'] = {
    p: 'BFD 会话详情：本地/远端标识、检测时间、收发包数。检测倍数调到 3 倍以下容易误切。',
    eg: 'display bfd session all verbose'
  };
  E.cmd['display hrp state'] = {
    p: '防火墙双机热备状态。active/standby 判断主机备机，Role 和 peer 状态都要正常。',
    eg: 'display hrp state'
  };
  E.cmd['display hrp interface'] = {
    p: '心跳口状态与通道统计。心跳口不通，两台防火墙就会各自为政（双主）。',
    eg: 'display hrp interface'
  };

  /* ================= ACL / 策略 ================= */
  E.cmd['display acl all'] = {
    p: '所有 ACL 及其规则，带每条规则的命中计数。规则写了但计数为 0，说明流量根本没匹配上。',
    eg: 'display acl all'
  };
  E.cmd['display traffic-filter applied-record'] = {
    p: '哪个接口的哪个方向调用了哪个 ACL。ACL 写了不生效，八成是没调或调错方向。',
    eg: 'display traffic-filter applied-record'
  };
  E.cmd['display traffic-policy applied-record'] = {
    p: '流量策略的应用记录。QoS 限速没效果，先确认策略真的挂到接口上了。',
    eg: 'display traffic-policy applied-record'
  };
  E.cmd['display time-range all'] = {
    p: '时间段配置及当前是否处于 active。ACL 绑了时间段，过了时间规则自动失效。',
    eg: 'display time-range all'
  };
  E.cmd['display qos car interface'] = {
    p: '接口上的 CAR 限速配置与统计。看承诺速率、突发大小和实际通过/丢弃的包数。',
    eg: 'display qos car interface GigabitEthernet0/0/1'
  };

  /* ================= NAT / 防火墙 ================= */
  E.cmd['display nat session all'] = {
    p: 'NAT 会话表：内网地址端口与公网地址端口的映射。内网出不去，先看这里有没有会话生成。',
    eg: 'display nat session all'
  };
  E.cmd['display nat server'] = {
    p: 'NAT Server（端口映射）规则。外网访问内网服务器不通，先确认公网端口映射到谁。',
    eg: 'display nat server'
  };
  E.cmd['display nat address-group'] = {
    p: 'NAT 地址池及使用情况。地址池里的公网地址被占满，新会话就分配不到地址。',
    eg: 'display nat address-group 1'
  };
  E.cmd['display nat outbound'] = {
    p: '出方向 NAT 的应用情况。Easy IP 还是地址池、绑定在哪个接口，一眼看清楚。',
    eg: 'display nat outbound'
  };
  E.cmd['display firewall session table'] = {
    p: '防火墙会话表（USG 系列）。含源/目的、协议、老化时间。放行策略没生效时看有没有建会话。',
    eg: 'display firewall session table'
  };
  E.cmd['display firewall zone'] = {
    p: '安全区域与绑定的接口。接口没划进区域，任何策略都不会生效。',
    eg: 'display firewall zone'
  };
  E.cmd['display security-policy rule all'] = {
    p: '安全策略规则及命中计数。策略顺序是从上往下匹配，第一条命中就停，顺序错等于全错。',
    eg: 'display security-policy rule all'
  };
  E.cmd['display ipsec sa'] = {
    p: 'IPSec 安全联盟。有 SA 才说明隧道建起来了；没有就查第一阶段 IKE。',
    eg: 'display ipsec sa'
  };
  E.cmd['display ipsec proposal'] = {
    p: 'IPSec 安全提议：加密算法、认证算法、封装模式。两端必须完全一致。',
    eg: 'display ipsec proposal'
  };
  E.cmd['display ike sa'] = {
    p: 'IKE 第一阶段 SA。Phase 1 没成功，IPSec 隧道永远起不来，先查预共享密钥和提议。',
    eg: 'display ike sa'
  };
  E.cmd['display ike peer'] = {
    p: 'IKE 对等体配置：对端地址、版本、预共享密钥、提议。两端任一参数不一致就协商失败。',
    eg: 'display ike peer'
  };

  /* ================= 组播 ================= */
  E.cmd['display multicast routing-table'] = {
    p: '组播路由表：(S,G) 或 (*,G) 表项与出接口。有表项才可能转发。',
    eg: 'display multicast routing-table'
  };
  E.cmd['display pim neighbor'] = {
    p: 'PIM 邻居。PIM 邻居都不通，组播流量无从谈起；注意 PIM 邻居和单播路由是两回事。',
    eg: 'display pim neighbor'
  };
  E.cmd['display pim routing-table'] = {
    p: 'PIM 路由表：上游接口、下游接口、RPF 邻居。RPF 检查失败是组播不通的头号原因。',
    eg: 'display pim routing-table'
  };
  E.cmd['display igmp group'] = {
    p: 'IGMP 组：哪些主机加入了哪个组播组。接收端没加入，流量自然下不来。',
    eg: 'display igmp group'
  };
  E.cmd['display igmp interface'] = {
    p: '哪些接口开了 IGMP、版本、查询器。IGMP 版本和主机不一致会影响加入。',
    eg: 'display igmp interface'
  };

  /* ================= WLAN ================= */
  E.cmd['display ap all'] = {
    p: 'AC 上全部 AP 的上线状态（WLAN 排障第一条）。State 必须是 nor（normal）才算上线；fault 或国家码错误是常见卡点。',
    eg: 'display ap all'
  };
  E.cmd['display ap-group all'] = {
    p: 'AP 组及组内引用的 VAP、射频模板。AP 上线了但没信号，多半是组里没绑 VAP。',
    eg: 'display ap-group all'
  };
  E.cmd['display station all'] = {
    p: '在线终端列表：关联的 AP、信号强度、IP。终端连不上时看是否根本没关联上来。',
    eg: 'display station all'
  };
  E.cmd['display vap all'] = {
    p: 'VAP（虚拟接入点）状态与绑定的业务 VLAN。VAP 没 up，SSID 就发不出去。',
    eg: 'display vap all'
  };
  E.cmd['display capwap configuration'] = {
    p: 'CAPWAP 源接口配置。AC 的源地址必须在 AP 能路由到的网段，否则 AP 找不到 AC。',
    eg: 'display capwap configuration'
  };

  /* ================= 堆叠 / DHCP ================= */
  E.cmd['display stack'] = {
    p: '堆叠成员：成员 ID、优先级、主备角色、是否在位。成员 ID 冲突是堆叠起不来的头号原因。',
    eg: 'display stack'
  };
  E.cmd['display stack configuration'] = {
    p: '堆叠端口与连接关系。看堆叠线接在哪些口、链路是否 Up。',
    eg: 'display stack configuration'
  };
  E.cmd['display ip pool'] = {
    p: '地址池使用情况：总量、已用、冲突数。地址发完了，新终端就上不了网。',
    eg: 'display ip pool'
  };
  E.cmd['display dhcp snooping'] = {
    p: 'DHCP Snooping 配置与状态。接了交换机却不生效，通常是没开全局或没设信任口。',
    eg: 'display dhcp snooping'
  };
  E.cmd['display dhcp snooping user-bind'] = {
    p: 'Snooping 生成的 IP-MAC-接口 绑定表。IPSG 靠这张表放行，表是空的 IPSG 就全挡。',
    eg: 'display dhcp snooping user-bind all'
  };

  /* ================= reset：清计数、清邻居、清表 ================= */
  E.cmd['reset counters interface'] = {
    p: '清零接口收发计数。排障前先清一次，然后再看错误包增长，判断是历史遗留还是正在发生。',
    eg: 'reset counters interface GigabitEthernet0/0/1'
  };
  E.cmd['reset saved-configuration'] = {
    p: '删除下次启动的配置文件。恢复出厂的标准动作，重启后配置才真正清空。删之前务必先备份。',
    eg: 'reset saved-configuration'
  };
  E.cmd['reset arp all'] = {
    p: '清空动态 ARP 表，让设备重新学习。换过网关 MAC 或做过 ARP 欺骗处置后清一次。',
    eg: 'reset arp dynamic'
  };
  E.cmd['reset mac-address'] = {
    p: '清空 MAC 地址表。终端换了接口但表项没更新（MAC 漂移）时清一次。',
    eg: 'reset mac-address'
  };
  E.cmd['reset isis peer'] = {
    p: '重置 IS-IS 邻居，触发重新建邻。改完 Level 或认证后手动踢一下，不用等 Holdtime 超时。',
    eg: 'reset isis all'
  };
  E.cmd['reset bgp all'] = {
    p: '重置所有 BGP 邻居连接。硬重置会中断路由，生产上优先用 route-refresh 软重置。',
    eg: 'reset bgp all'
  };
  E.cmd['reset ospf process'] = {
    p: '重置 OSPF 进程，所有邻居重建。会短暂断网，改完区域或认证参数后使用。',
    eg: 'reset ospf process'
  };
  E.cmd['reset ip routing-table statistics'] = {
    p: '清零路由表统计计数。看某条路由是不是一直在翻动，先清再加观察。',
    eg: 'reset ip routing-table statistics'
  };
  E.cmd['reset nat session all'] = {
    p: '清空 NAT 会话表。映射改完老会话还走旧规则，清一次强制重建。',
    eg: 'reset nat session all'
  };
  E.cmd['reset firewall session table'] = {
    p: '清空防火墙会话表。策略改了但老会话仍被放行，清掉才会按新策略重新匹配。',
    eg: 'reset firewall session table'
  };
  E.cmd['reset vrrp statistics'] = {
    p: '清零 VRRP 统计。观察主备是否还在频繁切换时，先清计数再看增长。',
    eg: 'reset vrrp statistics'
  };
  E.cmd['reset dhcp snooping statistics'] = {
    p: '清零 Snooping 统计。看丢弃计数是否还在增长，判断私接 DHCP 是否已被拦住。',
    eg: 'reset dhcp snooping statistics'
  };

  /* ================= debugging：抓报文 ================= */
  E.cmd['terminal monitor'] = {
    p: '把日志输出到当前终端。SSH/Telnet 登录时默认不显示日志，不敲这条什么都看不到。',
    eg: 'terminal monitor'
  };
  E.cmd['terminal debugging'] = {
    p: '打开调试信息输出。只开 terminal monitor 是不够的，debugging 依旧不显示。',
    eg: 'terminal debugging'
  };
  E.cmd['debugging isis packet'] = {
    p: '打开 IS-IS 报文调试。能看清 Hello 发没发出去、认证过没过；查完立刻 undo，否则 CPU 会飙。',
    eg: 'debugging isis packet'
  };
  E.cmd['debugging ospf packet'] = {
    p: '打开 OSPF 报文调试。邻居卡在 ExStart/Exchange 时，用它看 DD 报文有没有来回。',
    eg: 'debugging ospf packet'
  };
  E.cmd['debugging bgp packet'] = {
    p: '打开 BGP 报文调试。邻居建不起来时可以看 Open 报文里 AS 号、Holdtime 是否被拒。',
    eg: 'debugging bgp packet'
  };

  /* ================= 常用配置补充 ================= */
  E.cmd['sysname'] = {
    p: '改设备名。开局第一件事，不然一堆 Switch 分不清谁是谁。',
    eg: 'sysname SW-Core-01'
  };
  E.cmd['user-interface vty'] = {
    p: '进入远程登录虚拟终端。0 4 表示允许 5 个并发会话。',
    eg: 'user-interface vty 0 4'
  };
  E.cmd['authentication-mode'] = {
    p: '登录认证方式：password 只验密码，aaa 验账号密码，建议一律用 aaa。',
    eg: 'authentication-mode aaa'
  };
  E.cmd['local-user'] = {
    p: '创建本地账号，指定密码、服务类型和权限级别。级别 15 才是管理员。',
    eg: 'local-user admin password irreversible-cipher Admin@2026'
  };
  E.cmd['aaa'] = {
    p: '进入 AAA 视图，本地认证、授权、计费都配在这里。',
    eg: 'aaa'
  };
  E.cmd['header login'] = {
    p: '登录横幅，写安全警告。等保检查项，很多单位强制要求。',
    eg: 'header login information "Authorized access only"'
  };
  E.cmd['clock timezone'] = {
    p: '设置时区，中国是 UTC+8。时区不对，日志时间会差 8 小时。',
    eg: 'clock timezone BJ add 08:00:00'
  };
  E.cmd['stp region-configuration'] = {
    p: '进入 MST 域配置视图。域名、修订级别、实例映射三样必须在所有设备上完全一致。',
    eg: 'stp region-configuration'
  };
  E.cmd['active region-configuration'] = {
    p: '提交 MST 域配置。配完不敲这条，前面写的都是草稿，不生效。',
    eg: 'active region-configuration'
  };
  E.cmd['stp root primary'] = {
    p: '把本机指定为根桥（优先级自动设为 0）。核心交换机上配，别让接入交换机抢到根。',
    eg: 'stp root primary'
  };
  E.cmd['interface range'] = {
    p: '批量进入多个接口，一次配完。省得一个个 interface 敲。',
    eg: 'interface range GigabitEthernet0/0/1 to GigabitEthernet0/0/10'
  };
  E.cmd['port-group'] = {
    p: '把多个接口加入端口组，后续命令对组内所有成员生效。',
    eg: 'port-group group-member GigabitEthernet0/0/1 to GigabitEthernet0/0/8'
  };
  E.cmd['mode lacp'] = {
    p: '把 Eth-Trunk 设为 LACP 模式（默认是手工模式）。LACP 能检测链路错连，优先用这个。',
    eg: 'mode lacp-static'
  };
  E.cmd['nat address-group'] = {
    p: '创建 NAT 公网地址池。地址不够时用 PAT 复用，够用就直接一对一。',
    eg: 'nat address-group 1 200.1.1.10 200.1.1.20'
  };
  E.cmd['dhcp select relay'] = {
    p: '接口启用 DHCP 中继。中继服务器地址还要单独指定，光开这个不够。',
    eg: 'dhcp select relay'
  };
  E.cmd['dhcp relay server-ip'] = {
    p: '指定 DHCP 服务器地址。中继就是把广播转成单播发给这个地址。',
    eg: 'dhcp relay server-ip 192.168.10.100'
  };
  E.cmd['vrrp track'] = {
    p: 'VRRP 跟踪上行接口，接口断了自动降优先级让备机接管。不配跟踪，上行断了主机还占着网关。',
    eg: 'vrrp vrid 1 track interface GigabitEthernet0/0/2 reduced 30'
  };
  /* ================= 连通性测试 ================= */
  E.cmd['ping'] = {
    p: '最基础的连通性测试。默认发 5 个包；-c 指定次数，-s 指定包长（测 MTU 时用），-a 指定源地址（测回程路由必用）。',
    eg: 'ping -c 10 -s 1472 192.168.20.1'
  };
  E.cmd['ping -a'] = {
    p: '带源地址 ping。排查"能 ping 通但对端回不来"时必须有它，否则默认用出接口地址，测不出真实业务路径。',
    eg: 'ping -a 192.168.10.1 192.168.20.1'
  };
  E.cmd['tracert'] = {
    p: '逐跳追踪路径。看在哪一跳开始不通或延迟突增；-a 指定源，-m 指定最大跳数。',
    eg: 'tracert -a 192.168.10.1 -m 8 8.8.8.8'
  };
  E.cmd['telnet'] = {
    p: '用 Telnet 客户端测试端口连通性（不只是登录设备）。能连上说明 TCP 端口通，连不上是策略或路由问题。',
    eg: 'telnet 192.168.20.1 22'
  };
  E.cmd['shutdown'] = {
    p: '关闭接口。排查时用来验证"是不是这个口的问题"，关掉后接口物理 Up 协议 Down。',
    eg: 'shutdown'
  };
  E.cmd['undo shutdown'] = {
    p: '开启接口（华为交换机接口默认是开启的，路由器部分型号默认关闭，新口不亮先敲这个）。',
    eg: 'undo shutdown'
  };
  E.cmd['reboot'] = {
    p: '重启设备。会中断业务，务必先 save；不支持 saved-configuration 时会提示是否保存。',
    eg: 'reboot'
  };
  E.cmd['startup saved-configuration'] = {
    p: '指定下次启动加载的配置文件。换配置前先备份一份再指过去，出问题能改回来。',
    eg: 'startup saved-configuration vrpcfg-backup.zip'
  };
  E.cmd['dir'] = {
    p: '看设备 Flash 里的文件。空间不足会导致 save 失败，配置就丢了。',
    eg: 'dir'
  };
  E.cmd['delete'] = {
    p: '删除 Flash 文件，删到回收站还能 undelete 恢复；加 /unreserved 才是真删。',
    eg: 'delete vrpcfg-backup.zip'
  };

  /* ================= WLAN 补充 ================= */
  E.cmd['security-profile'] = {
    p: 'WLAN 安全模板：认证方式（WPA2-PSK / 802.1X）和密码都在这配，配完要绑到 VAP 模板上才生效。',
    eg: 'security-profile name SEC-EMP'
  };
  E.cmd['ssid-profile'] = {
    p: 'SSID 模板，只负责"网络叫什么名字"。改名字改这里，改密码要改安全模板。',
    eg: 'ssid-profile name SSID-EMP'
  };
  E.cmd['vap-profile'] = {
    p: 'VAP 模板：把 SSID 模板、安全模板、业务 VLAN 串起来，是 WLAN 配置的枢纽。',
    eg: 'vap-profile name VAP-EMP'
  };
  E.cmd['forward-mode'] = {
    p: 'AP 的转发模式：tunnel 表示业务流量回 AC 集中转发，direct-forward 表示本地直接转发。前者便于统一管控，后者省带宽。',
    eg: 'forward-mode tunnel'
  };
  E.cmd['eirp'] = {
    p: 'AP 射频发射功率（dBm）。室内覆盖调得太大会互相干扰，太小又会有盲区，通常先按厂家默认值再微调。',
    eg: 'eirp 20'
  };

  /* ================= 覆盖度体检补漏 =================
     下面这些是从现有片段/实验的代码里统计出来的「在用但没收录」，
     不是凭空想的（见 _dev/check-cmd-coverage.js）。 */

  /* ipv4-family 在 BGP 配置里出现最多，却在词典里缺位 */
  E.cmd['ipv4-family unicast'] = {
    p: 'BGP 的 IPv4 单播地址族视图。peer、network、import-route 这些都要进到这里配，在 BGP 视图下直接敲是不生效的。',
    eg: 'ipv4-family unicast'
  };
  E.cmd['port-isolate'] = {
    p: '端口隔离：同一个 VLAN 内的接口互相不能通信，但都能上行。比给每个口分一个 VLAN 省事，酒店和宿舍常用。',
    eg: 'port-isolate enable group 1'
  };
  E.cmd['stp instance'] = {
    p: 'MSTP 实例映射：把哪些 VLAN 划进这个实例。不同实例可以有不同的根桥，实现负载分担。',
    eg: 'instance 1 vlan 10 20'
  };
  E.cmd['stp region-name'] = {
    p: 'MST 域名。所有交换机必须完全一致才算同一个域，否则各算各的树，等于没配。',
    eg: 'region-name CORP-MST'
  };
  E.cmd['stp revision-level'] = {
    p: 'MST 修订级别，默认 0。改过域内任何参数都要同步改它，否则设备认为配置不一致。',
    eg: 'revision-level 1'
  };
  E.cmd['area-authentication-mode'] = {
    p: 'OSPF 区域认证（对整个区域的报文生效）。两端必须配同样的方式和密码，只配一边会邻接失败。',
    eg: 'area-authentication-mode md5 1 cipher Ospf@2026'
  };
  E.cmd['domain-authentication-mode'] = {
    p: 'IS-IS 域级认证（L2 报文）。和区域认证分别管 L1/L2，配了域认证只影响 Level-2 邻接。',
    eg: 'domain-authentication-mode md5 cipher Isis@2026'
  };
  E.cmd['ike-peer'] = {
    p: 'IPSec 策略里引用 IKE 对等体。引用错了策略就绑不上，第一阶段直接失败。',
    eg: 'ike-peer PEER-B'
  };
  E.cmd['ike-proposal'] = {
    p: 'IPSec 策略里引用 IKE 提议（第一阶段的加密/认证算法）。两端提议必须有一个能对上。',
    eg: 'ike-proposal 10'
  };
  E.cmd['source-zone'] = {
    p: '安全策略的源区域。策略是「源区域 + 目的区域 + 内容」三段匹配，区域写反了策略就不生效。',
    eg: 'source-zone trust'
  };
  E.cmd['destination-zone'] = {
    p: '安全策略的目的区域，和源区域一起构成匹配条件。',
    eg: 'destination-zone untrust'
  };
  E.cmd['idle-timeout'] = {
    p: '会话空闲超时（VTY 下是分钟，NAT/防火墙上常是秒）。超时太短会频繁断连，太长会占用会话表。',
    eg: 'idle-timeout 10 0'
  };
  E.cmd['arp-proxy'] = {
    p: 'ARP 代理：接口收到跨网段的 ARP 请求时，用自己的 MAC 代替目标回应。单臂路由和 VLAN 隔离场景常用。',
    eg: 'arp-proxy enable'
  };
  E.cmd['dns-server'] = {
    p: 'DHCP 下发的 DNS 服务器地址（防火墙/AC 场景下常用这个写法，交换机上是 dns-list）。下发错了终端能上网但解析不了域名。',
    eg: 'dns-server 114.114.114.114'
  };
  E.cmd['traffic classifier'] = {
    p: '流分类：定义"哪些流量算一类"，靠 if-match 匹配 ACL、VLAN、DSCP。operator or 表示任一条件命中即算，and 表示全部满足。',
    eg: 'traffic classifier CLS-VIDEO operator or'
  };
  E.cmd['traffic behavior'] = {
    p: '流行为：定义"匹配上之后干什么"，限速、重标记、重定向、丢弃都在这里。',
    eg: 'traffic behavior BEH-LIMIT'
  };
  E.cmd['service-vlan'] = {
    p: 'VAP 模板里指定业务 VLAN，也就是终端拿到哪个网段的地址。改这里等于换整个无线业务的网段。',
    eg: 'service-vlan vlan-id 20'
  };
  E.cmd['action permit'] = {
    p: '安全策略的动作：permit 放行、deny 丢弃。默认策略是 deny，最后一条兜底规则别忘了看。',
    eg: 'action permit'
  };
  E.cmd['security acl'] = {
    p: 'IPSec 策略引用的 ACL，用来指定哪些流量走隧道。ACL 写反（源目颠倒）是最常见的隧道不通原因。',
    eg: 'security acl 3000'
  };
})(window.__ENSP);
