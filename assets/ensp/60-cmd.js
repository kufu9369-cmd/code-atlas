/* ============================================================
   码典 · eNSP 命令词条（补充）
   ------------------------------------------------------------
   只放 data.js 里还没有的命令。合并时按 key 判断，
   已存在的直接跳过，不会覆盖原有解释。
   ============================================================ */
(function (E) {
  'use strict';

  /* ---------------- IS-IS ---------------- */
  E.cmd['isis'] = { p: '启动 IS-IS 进程并进入进程视图。进程号本地有效，两端可以不同。', eg: 'isis 1' };
  E.cmd['is-level'] = { p: '设置路由器级别：level-1 只管本区域，level-2 只管骨干，level-1-2 两者都管。', eg: 'is-level level-1-2' };
  E.cmd['network-entity'] = { p: '配置 NET 地址，格式为 区域ID.SystemID.NSEL，NSEL 必须是 00。', eg: 'network-entity 49.0001.0000.0000.0001.00' };
  E.cmd['circuit-level'] = { p: '设置接口的 IS-IS 级别，两端不一致就建不了邻接。', eg: 'isis circuit-level level-2' };
  E.cmd['silent-interface'] = { p: '抑制接口：只接收协议报文，不发送，通常用在接终端的接口上。', eg: 'silent-interface GigabitEthernet0/0/1' };

  /* ---------------- 路由策略 ---------------- */
  E.cmd['import-route'] = { p: '把其他协议或静态路由引入当前协议，可用 route-policy 过滤和改属性。', eg: 'import-route static route-policy RP-IMPORT' };
  E.cmd['filter-policy'] = { p: '路由过滤：对引入、接收或发布的路由做过滤，只影响路由表不进协议报文。', eg: 'filter-policy ip-prefix P1 import' };
  E.cmd['route-policy'] = { p: '创建路由策略节点，permit 或 deny，节点号小的先匹配，命中即停。', eg: 'route-policy RP permit node 10' };
  E.cmd['if-match'] = { p: '策略节点的匹配条件，同一节点内多条 if-match 是「与」关系。', eg: 'if-match acl 2000' };
  E.cmd['apply'] = { p: '策略节点的执行动作，用来修改路由属性。', eg: 'apply cost 50' };
  E.cmd['ip-prefix'] = { p: '前缀列表，比 ACL 更适合匹配路由，支持前缀长度范围。', eg: 'ip ip-prefix P1 index 10 permit 192.168.1.0 24' };

  /* ---------------- BGP ---------------- */
  E.cmd['bgp'] = { p: '启动 BGP 进程，参数是本地 AS 号。', eg: 'bgp 65001' };
  E.cmd['peer'] = { p: '指定 BGP 邻居地址，通常后面跟 as-number 或连接参数。', eg: 'peer 10.0.0.2 as-number 65002' };
  E.cmd['as-number'] = { p: '指定邻居所属的 AS 号，与本地相同是 iBGP，不同是 eBGP。', eg: 'peer 10.0.0.2 as-number 65002' };
  E.cmd['reflect-client'] = { p: '把邻居配置为路由反射客户端，配在 RR 上，客户端不用做反射配置。', eg: 'peer 2.2.2.2 reflect-client' };
  E.cmd['connect-interface'] = { p: '指定 BGP 报文的源接口，用 Loopback 建邻居可以避免物理口抖动导致断链。', eg: 'peer 2.2.2.2 connect-interface LoopBack0' };
  E.cmd['ebgp-max-hop'] = { p: '允许 eBGP 非直连建立邻居，默认 TTL 只有 1。', eg: 'peer 10.0.0.2 ebgp-max-hop 2' };
  E.cmd['advertise-community'] = { p: '向邻居发送团体属性。不配这条，对端收到的路由里没有团体标记，策略永远匹配不上。', eg: 'peer 10.0.0.2 advertise-community' };
  E.cmd['community-filter'] = { p: '团体属性过滤器，按 AS:值 匹配路由。', eg: 'ip community-filter 1 permit 100:1' };
  E.cmd['local-preference'] = { p: 'BGP 本地优先级，只在 AS 内部传递，值越大越优先，默认 100。', eg: 'apply local-preference 200' };
  E.cmd['as-path'] = { p: 'AS 路径属性，长度越短越优先；也可用于加长路径影响对端选路。', eg: 'apply as-path 100 200 additive' };

  /* ---------------- MPLS / VPN ---------------- */
  E.cmd['mpls'] = { p: '全局使能 MPLS 标签转发能力，接口上还要再开一次。', eg: 'mpls' };
  E.cmd['ldp'] = { p: '使能 LDP 标签分发协议，需全局和接口同时开启。', eg: 'mpls ldp' };
  E.cmd['lsr-id'] = { p: '设置 LSR ID，通常用 Loopback 地址，全网必须唯一。', eg: 'mpls lsr-id 1.1.1.1' };
  E.cmd['vpn-instance'] = { p: '创建 VRF（虚拟路由转发表），不同 VRF 的路由表完全隔离。', eg: 'ip vpn-instance CUST-A' };
  E.cmd['route-distinguisher'] = { p: '设置 RD，把不同 VRF 里相同的前缀变成全局唯一，本身不控制发布范围。', eg: 'route-distinguisher 100:1' };
  E.cmd['vpn-target'] = { p: '设置 RT，控制 VPN 路由的发布与接收范围，本端 export 的 RT 要出现在对端 import 列表里。', eg: 'vpn-target 100:1 both' };
  E.cmd['binding'] = { p: '把接口绑定到 VRF。必须先 binding 再配 IP，否则地址会落到全局路由表。', eg: 'ip binding vpn-instance CUST-A' };
  E.cmd['tunnel-protocol'] = { p: '指定隧道封装协议，GRE/IPSec 等。', eg: 'tunnel-protocol gre' };

  /* ---------------- IPSec ---------------- */
  E.cmd['ipsec'] = { p: 'IPSec 策略，把 ACL、IKE 对等体、加密提议串在一起。', eg: 'ipsec policy POL-VPN 10 isakmp' };
  E.cmd['ike'] = { p: 'IKE 对等体配置，v2 表示使用 IKEv2 版本。', eg: 'ike peer PEER-B v2' };
  E.cmd['proposal'] = { p: '安全提议，定义第一阶段或第二阶段使用的加密与认证算法。', eg: 'ipsec proposal IPSEC-P1' };
  E.cmd['pre-shared-key'] = { p: '预共享密钥，两端必须完全一致，不一致时第一阶段就协商失败。', eg: 'pre-shared-key cipher Ipsec@2026' };

  /* ---------------- 组播 ---------------- */
  E.cmd['multicast'] = { p: '组播总开关，不开这条接口上的 PIM 和 IGMP 都不生效。', eg: 'multicast routing-enable' };
  E.cmd['pim'] = { p: '接口使能 PIM 协议，sm 表示稀疏模式。', eg: 'pim sm' };
  E.cmd['igmp'] = { p: '接口使能 IGMP，用来接收主机的组播成员报告。', eg: 'igmp enable' };
  E.cmd['static-rp'] = { p: '指定静态 RP（汇聚点），PIM-SM 必须知道 RP 在哪。', eg: 'static-rp 10.10.10.10' };

  /* ---------------- WLAN ---------------- */
  E.cmd['capwap'] = { p: '指定 AC 的 CAPWAP 源接口，AP 靠这个地址找到 AC，必须在 AP 上线前配好。', eg: 'capwap source interface Vlanif100' };
  E.cmd['wlan'] = { p: '进入 WLAN 视图，所有无线模板都在这个视图下配置。', eg: 'wlan' };
  E.cmd['ssid'] = { p: '设置对外广播的无线网络名称。', eg: 'ssid Office-WiFi' };
  E.cmd['ap-group'] = { p: 'AP 组，把 VAP 模板绑到组上，组内所有 AP 统一下发。', eg: 'ap-group name default' };

  /* ---------------- 防火墙 ---------------- */
  E.cmd['hrp'] = { p: '双机热备，两台防火墙之间同步会话和配置。', eg: 'hrp enable' };
  E.cmd['security-policy'] = { p: 'USG 安全策略视图，默认拒绝所有流量，必须显式 permit。', eg: 'security-policy' };
  E.cmd['zone'] = { p: '安全区域，接口必须加入区域才能参与转发。', eg: 'firewall zone trust' };

  /* ---------------- IPv6 ---------------- */
  E.cmd['ipv6'] = { p: '全局使能 IPv6。接口上还要再配 ipv6 enable。', eg: 'ipv6' };
  E.cmd['nd'] = { p: 'IPv6 邻居发现。undo ipv6 nd ra halt 才会发送 RA，终端才能自动配置地址。', eg: 'undo ipv6 nd ra halt' };
  E.cmd['ospfv3'] = { p: '启动 OSPFv3（IPv6 版），没有 network 命令，直接在接口上挂进程和区域。', eg: 'ospfv3 1' };
  E.cmd['dhcpv6'] = { p: 'DHCPv6 地址池，用于有状态分配 IPv6 地址和 DNS。', eg: 'dhcpv6 pool v6pool' };

  /* ---------------- 可靠性 ---------------- */
  E.cmd['bfd'] = { p: '创建 BFD 会话，绑定对端 IP 和出接口，用毫秒级探测感知链路故障。', eg: 'bfd to-core bind peer-ip 10.0.0.2 interface GigabitEthernet0/0/1' };
  E.cmd['discriminator'] = { p: 'BFD 标识符，本地值要等于对端的远端值，填错会话一直 Down。', eg: 'discriminator local 1' };
  E.cmd['track'] = { p: '联动跟踪：被跟踪对象故障时，触发 VRRP 优先级下降或路由撤销。', eg: 'vrrp vrid 1 track interface GigabitEthernet0/0/24 reduced 30' };
  E.cmd['preempt-mode'] = { p: 'VRRP 抢占模式，delay 用于等路由收敛后再抢回主，避免二次中断。', eg: 'vrrp vrid 1 preempt-mode timer delay 20' };

  /* ---------------- 二层高级特性 ---------------- */
  E.cmd['aggregate-vlan'] = { p: '把当前 VLAN 设为 Super VLAN，只做网关容器不承载物理口。', eg: 'aggregate-vlan' };
  E.cmd['access-vlan'] = { p: '指定归属该 Super VLAN 的子 VLAN 列表。', eg: 'access-vlan 10 20 30' };
  E.cmd['mux-vlan'] = { p: '使能 MUX VLAN，在主 VLAN 下划分互通组和隔离组。', eg: 'mux-vlan' };
  E.cmd['subordinate'] = { p: 'MUX VLAN 的从 VLAN 角色：group 互通、separate 隔离。', eg: 'subordinate separate 102' };
  E.cmd['loop-detection'] = { p: '环路检测，发出带标识的报文，若从其他口收回说明有环。', eg: 'loop-detection enable' };
  E.cmd['observe-port'] = { p: '定义观察端口，被镜像的流量从这个口复制出去。', eg: 'observe-port 1 interface GigabitEthernet0/0/24' };
  E.cmd['port-mirroring'] = { p: '端口镜像，把指定接口的流量复制到观察口。', eg: 'port-mirroring to observe-port 1 both' };
  E.cmd['stack'] = { p: 'iStack 堆叠配置，多台设备虚拟成一台逻辑设备。', eg: 'stack member 1 priority 150' };
  E.cmd['qinq'] = { p: 'QinQ 双层标签，外层标签由 port default vlan 决定。', eg: 'qinq vlan-translation enable' };
  E.cmd['dot1q-tunnel'] = { p: '把接口设成 QinQ 隧道口，收到的标签报文整体当作数据再套一层。', eg: 'port link-type dot1q-tunnel' };
  E.cmd['vlan-mapping'] = { p: 'VLAN 映射，把入方向的 VLAN 标签替换成指定 VLAN。', eg: 'port vlan-mapping vlan 10 map-vlan 100' };

  /* ---------------- QoS ---------------- */
  E.cmd['traffic-classifier'] = { p: '流分类，定义「哪些流量」，operator or 表示多条 if-match 满足其一。', eg: 'traffic classifier CLS-LIMIT operator or' };
  E.cmd['traffic-behavior'] = { p: '流行为，定义「怎么处理」，如限速、重定向、重标记。', eg: 'traffic behavior BEH-LIMIT' };
  E.cmd['traffic-policy'] = { p: '流策略，把分类和行为绑定，再应用到接口方向。', eg: 'traffic policy POL-LIMIT' };
  E.cmd['car'] = { p: '流量监管，CIR/PIR 单位是 kbit/s，CBS/PBS 单位是字节。', eg: 'car cir 10000 pir 20000 cbs 187500 pbs 375000 green pass yellow pass red discard' };
  E.cmd['redirect'] = { p: '策略路由的重定向动作，把命中流量指到指定下一跳。', eg: 'redirect ip-nexthop 10.1.1.2' };
  E.cmd['time-range'] = { p: '时间段，可挂到 ACL 规则上做时间维度的访问控制，依赖设备本地时钟。', eg: 'time-range worktime 08:30 to 18:00 working-day' };

  /* ---------------- 接入安全 ---------------- */
  E.cmd['snooping'] = { p: 'DHCP Snooping，过滤非法 DHCP 应答，并生成 IP-MAC-接口 绑定表。', eg: 'dhcp snooping enable' };
  E.cmd['trusted'] = { p: '标记信任接口，只有信任口的 DHCP 应答才被放行，通常只给上行口。', eg: 'dhcp snooping trusted' };
  E.cmd['user-bind'] = { p: 'IPSG 静态绑定表项，给固定 IP 设备登记 IP 与 MAC 的对应关系。', eg: 'user-bind static ip-address 192.168.10.10 mac-address 5489-98aa-bb01 interface GigabitEthernet0/0/1 vlan 10' };

  /* ---------------- 运维 ---------------- */
  E.cmd['info-center'] = { p: '日志中心，把设备日志发送到 Syslog 服务器。', eg: 'info-center loghost 192.168.10.100 channel 2' };
  E.cmd['ntp-service'] = { p: 'NTP 客户端，指定时间服务器。设备时间不对会让日志和时间段策略全部错位。', eg: 'ntp-service unicast-server 192.168.10.100' };
  E.cmd['snmp-agent'] = { p: 'SNMP 代理，v3 用用户名 + 密码认证，不再用明文团体名。', eg: 'snmp-agent sys-info version v3' };
  E.cmd['ftp'] = { p: 'FTP 客户端，登录服务器后可上传下载配置文件。', eg: 'ftp 192.168.10.100' };
  E.cmd['put'] = { p: 'FTP 上传：把设备上的文件传到服务器。', eg: 'put vrpcfg.zip SW1-20261027.zip' };
  E.cmd['get'] = { p: 'FTP 下载：把服务器上的文件取到设备。', eg: 'get SW1-20261027.zip vrpcfg.zip' };

  /* ---------------- OSPF 补充 ---------------- */
  E.cmd['stub'] = { p: 'OSPF Stub 区域，拒绝外部 LSA，由 ABR 下发默认路由。区域内不能有 ASBR。', eg: 'stub' };
  E.cmd['nssa'] = { p: 'OSPF NSSA 区域，拒绝 Type 5 但允许区域内有 ASBR，用 Type 7 传外部路由。', eg: 'nssa' };
  E.cmd['vlink-peer'] = { p: 'OSPF 虚连接，填对端的 Router ID（不是接口地址）。', eg: 'vlink-peer 2.2.2.2' };
  E.cmd['abr-summary'] = { p: '区域间路由汇总，写在 area 视图下，只有 ABR 上有效。', eg: 'abr-summary 192.168.16.0 255.255.240.0' };
  E.cmd['asbr-summary'] = { p: '外部路由汇总，写在进程视图下，只有 ASBR 上有效。', eg: 'asbr-summary 172.16.0.0 255.255.0.0' };
})(window.__ENSP);
