/* ============================================================
   码典 · 配置剧本（一）二层 + 基础
   ------------------------------------------------------------
   剧本是什么：一条完整的配置主线，按你实际敲的顺序排好。

   和「片段」的区别：
   - 片段回答「这条命令什么意思」；
   - 剧本回答「下一步该敲什么」。

   在 eNSP 里卡住时按 Ctrl+Alt+Z，把控制台回显复制进来，
   引擎会认出你走到第几步，然后把下一句怼到你脸上。

   写法约定（引擎靠这些字段工作，别改名字）：
   - steps[].c     一条能直接粘进设备的命令，按真实顺序排
   - steps[].note  为什么敲这条 / 最容易错在哪（一句话，别写长）
   - steps[].who   哪台设备。省略就归到「通用」
   - verify        配完拿什么验、期望看到什么
   - pitfalls      这一套最常见的翻车点

   跨设备的场景尽量写成「单台主线 + note 里说另一台照抄」，
   步骤少一点，匹配更准，整段复制也不会把两台命令揉在一起。
   ============================================================ */
(function (E) {
  'use strict';

  E.recipes.push(

    /* ==================== 二层 ==================== */
    {
      id: 'rec-vlan-trunk',
      title: 'VLAN 隔离 + Trunk 互联',
      scene: '两台交换机，PC 分属两个 VLAN，中间一条线要同时跑两个 VLAN',
      level: '入门',
      tags: ['vlan', 'trunk', '802.1q', '二层'],
      scope: 'SW1 与 SW2 对称配置',
      steps: [
        { c: 'system-view', note: '从用户视图进系统视图，提示符从 <SW1> 变成 [SW1]' },
        { c: 'sysname SW1', note: '先改名，不然两台都叫 Huawei，配串了你都不知道' },
        { c: 'vlan batch 10 20', note: '一次建两个 VLAN。VLAN 不建也能划端口，但不会出现在 display vlan 里' },
        { c: 'interface GigabitEthernet0/0/1', note: '进接 PC 的接口' },
        { c: 'port link-type access', note: '接终端的口必须是 access，默认是 hybrid' },
        { c: 'port default vlan 10', note: '把口划进 VLAN 10' },
        { c: 'quit', note: '退出接口视图，回到系统视图' },
        { c: 'interface GigabitEthernet0/0/2', note: '第二个接 PC 的口' },
        { c: 'port link-type access' },
        { c: 'port default vlan 20' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/24', note: '交换机之间的互联口' },
        { c: 'port link-type trunk', note: '互联口设 trunk，才能一次带多个 VLAN' },
        { c: 'port trunk allow-pass vlan 10 20', note: '这一条最容易漏：trunk 默认只放行 VLAN 1' }
      ],
      verify: [
        { cmd: 'display vlan', hope: 'VLAN 10 / 20 都在，各自的端口列表里有 Gi0/0/1、Gi0/0/2' },
        { cmd: 'display port vlan active', hope: '互联口那行 PVID=1，VLAN List 包含 10、20' }
      ],
      pitfalls: [
        'trunk 忘了 allow-pass vlan：链路是 up 的，但 VLAN 10 的 PC ping 不通对端，最容易被误判成路由问题',
        '两端都忘了建 VLAN：trunk 放行了，但 VLAN 不存在，报文直接被丢',
        '接 PC 的口留成 hybrid：有的能通有的不通，看你默认 PVID 是多少'
      ]
    },

    {
      id: 'rec-vlan-hybrid',
      title: 'Hybrid 口：同一口给不同 VLAN 打不同标签',
      scene: '一个接口既要接服务器（不带标签）又要带多个 VLAN，access/trunk 都做不到',
      level: '进阶',
      tags: ['hybrid', 'vlan', 'pvid', 'untagged'],
      steps: [
        { c: 'system-view' },
        { c: 'sysname SW1' },
        { c: 'vlan batch 10 20 30' },
        { c: 'interface GigabitEthernet0/0/1', note: '接服务器的口' },
        { c: 'port link-type hybrid', note: 'Hybrid 是华为默认类型，能同时处理 tagged 和 untagged' },
        { c: 'port hybrid pvid vlan 10', note: '收到的无标签帧归到 VLAN 10' },
        { c: 'port hybrid untagged vlan 10 20', note: '发出去时剥掉 10 和 20 的标签' },
        { c: 'port hybrid tagged vlan 30', note: '发出去时保留 30 的标签' },
        { c: 'quit' },
        { c: 'display port vlan', note: '一条命令看全部口的 PVID 和 Tagged/Untagged 列表' }
      ],
      verify: [
        { cmd: 'display port vlan', hope: 'Gi0/0/1 的 PVID=10，Untagged 含 10 20，Tagged 含 30' }
      ],
      pitfalls: [
        'pvid 和 untagged 不匹配：发出去的帧不带标签，对端按自己的 pvid 归 VLAN，跑到别的 VLAN 去了',
        'hybrid 口想当 access 用：只要 pvid + untagged 都配成同一个 VLAN，效果一样'
      ]
    },

    {
      id: 'rec-svi',
      title: '三层交换机：用 Vlanif 做网关',
      scene: '一台三层交换机下挂多个 VLAN，VLAN 之间要能互访',
      level: '入门',
      tags: ['svi', 'vlanif', '三层', '网关'],
      scope: '三层交换机本机',
      steps: [
        { c: 'system-view' },
        { c: 'sysname CORE1' },
        { c: 'vlan batch 10 20', note: '先有 VLAN 才能建对应的 Vlanif' },
        { c: 'interface Vlanif10', note: '这就是 VLAN 10 的网关接口' },
        { c: 'ip address 192.168.10.1 24', note: '掩码可以写 24，也可以写 255.255.255.0' },
        { c: 'quit' },
        { c: 'interface Vlanif20' },
        { c: 'ip address 192.168.20.1 24' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/1', note: '下联接 PC 的口' },
        { c: 'port link-type access' },
        { c: 'port default vlan 10' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/2' },
        { c: 'port link-type access' },
        { c: 'port default vlan 20' }
      ],
      verify: [
        { cmd: 'display ip interface brief', hope: 'Vlanif10 / Vlanif20 都是 up，IP 正确' },
        { cmd: 'display ip routing-table', hope: '两条直连路由，192.168.10.0/24 和 192.168.20.0/24' }
      ],
      pitfalls: [
        'Vlanif 是 down 的：这个 VLAN 里没有任何 up 的成员口，接口起不来，网关也就不通',
        'PC 网关填错：PC 的网关必须填 Vlanif 地址，不是互联口地址',
        '交换机是二层型号（如 S3700 部分版本）：不支持 Vlanif 配 IP，只能上三层型号'
      ]
    },

    {
      id: 'rec-single-arm',
      title: '单臂路由：一台路由器带多个 VLAN',
      scene: '只有二层交换机 + 一台路由器，想让两个 VLAN 互通',
      level: '入门',
      tags: ['单臂路由', '子接口', 'dot1q', 'vlan'],
      scope: 'AR1 一个物理口 + 两个子接口',
      steps: [
        { c: 'system-view' },
        { c: 'sysname AR1' },
        { c: 'interface GigabitEthernet0/0/0', note: '先确保物理口是 up 的（undo shutdown）' },
        { c: 'undo shutdown' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/0.10', note: '子接口号随便起，但建议和 VLAN 号一致' },
        { c: 'dot1q termination vid 10', note: '让这个子接口认 VLAN 10 的标签' },
        { c: 'ip address 192.168.10.1 24' },
        { c: 'arp broadcast enable', note: '不敲这条，子接口不转发 ARP，PC ping 网关直接不通' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/0.20' },
        { c: 'dot1q termination vid 20' },
        { c: 'ip address 192.168.20.1 24' },
        { c: 'arp broadcast enable' }
      ],
      verify: [
        { cmd: 'display ip interface brief', hope: 'Gi0/0/0.10 和 .20 都是 up' },
        { cmd: 'display arp all', hope: '能学到两个网段 PC 的 ARP' }
      ],
      pitfalls: [
        '漏了 arp broadcast enable：这是单臂路由第一大坑，接口 up、IP 对，就是 ping 不通',
        '交换机侧互联口没配 trunk：路由器收不到带标签的帧，子接口全 down',
        '交换机 trunk 忘了 allow-pass vlan：同上，表现一样'
      ]
    },

    {
      id: 'rec-eth-trunk',
      title: '链路聚合 Eth-Trunk（LACP）',
      scene: '两台交换机之间两条线捆成一条，带宽翻倍且一条断了不断网',
      level: '进阶',
      tags: ['eth-trunk', 'lacp', '聚合', '链路'],
      scope: '两端都要配，参数必须一致',
      steps: [
        { c: 'system-view' },
        { c: 'sysname SW1' },
        { c: 'interface Eth-Trunk1', note: '逻辑口，不受物理口数量限制' },
        { c: 'mode lacp-static', note: '静态 LACP 有协商，比手工模式可靠；手工模式两端配错也能起来但会环路' },
        { c: 'port link-type trunk' },
        { c: 'port trunk allow-pass vlan 10 20' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/23', note: '把物理口加进聚合组' },
        { c: 'eth-trunk 1' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/24' },
        { c: 'eth-trunk 1' },
        { c: 'quit' },
        { c: 'display eth-trunk 1', note: '看 Selected 才算真正生效，Unselect 说明参数不一致' }
      ],
      verify: [
        { cmd: 'display eth-trunk 1', hope: '两个成员口状态都是 Selected，Up 数量 2' }
      ],
      pitfalls: [
        '一端 lacp 一端手工：死活起不来，display eth-trunk 里一直是 Unselect',
        '成员口速率/双工不一致：LACP 会挑一部分口加入，剩下的挂 Unselect',
        '先在成员口上配了别的业务：加进 Eth-Trunk 后原配置会被覆盖，要重配在 Eth-Trunk 上'
      ]
    },

    {
      id: 'rec-stp',
      title: 'STP 防环：指定根桥 + 边缘端口',
      scene: '两台以上交换机成环，不配生成树就会广播风暴',
      level: '进阶',
      tags: ['stp', 'rstp', '生成树', '边缘端口', '根桥'],
      steps: [
        { c: 'system-view' },
        { c: 'sysname SW1' },
        { c: 'stp mode rstp', note: 'RSTP 收敛秒级，默认的 STP 要 30 秒以上' },
        { c: 'stp root primary', note: '在这台核心上敲，优先级自动降到 0，它必成根桥' },
        { c: 'stp enable' },
        { c: 'interface GigabitEthernet0/0/1', note: '接 PC 的口配成边缘端口' },
        { c: 'stp edged-port enable', note: '边缘口不参与生成树计算，插上就能通，省掉 30 秒' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/24', note: '交换机互联口绝对不能配边缘口' },
        { c: 'stp cost 20000', note: '想人为控制哪条路被阻塞，就调这个口的开销' }
      ],
      verify: [
        { cmd: 'display stp brief', hope: '看得到 ROOT / DESI / ALTE 状态，互联口里有一条 ALTE（被阻塞）' },
        { cmd: 'display stp', hope: '根桥 ID 就是你这台核心' }
      ],
      pitfalls: [
        '互联口配了 edged-port：形成环路时 BPDU 被丢弃，环永远破不了，直接广播风暴',
        '两台都配 stp root primary：优先级都是 0，最后比 MAC，结果不可控',
        '根桥位置放错：根桥应该在核心，放在接入层会导致流量绕远路'
      ]
    },

    {
      id: 'rec-port-security',
      title: '端口安全：限制 MAC 数量 + 违例动作',
      scene: '办公区一个网口被人私接小交换机，要限制只能接几台设备',
      level: '进阶',
      tags: ['端口安全', 'port-security', 'mac', '接入安全'],
      steps: [
        { c: 'system-view' },
        { c: 'interface GigabitEthernet0/0/1' },
        { c: 'port-security enable', note: '先开，不开后面两条命令直接报错' },
        { c: 'port-security max-mac-num 2', note: '最多学 2 个 MAC，超了就触发违例' },
        { c: 'port-security protect-action restrict', note: 'restrict 只丢弃并告警；protect 静默丢弃；shutdown 直接关端口（最狠）' },
        { c: 'quit' },
        { c: 'display port-security interface GigabitEthernet0/0/1', note: '看当前学到几个、有没有触发过违例' }
      ],
      verify: [
        { cmd: 'display port-security interface GigabitEthernet0/0/1', hope: 'Port Security 是 enabled，Max MAC 是 2' }
      ],
      pitfalls: [
        '顺序反了：先配 max-mac-num 会报错，必须先 port-security enable',
        '选 shutdown 动作：一旦违例端口直接 down，要手动 undo shutdown 才能恢复，别在远程设备上试'
      ]
    },

    {
      id: 'rec-port-isolate',
      title: '端口隔离：同 VLAN 内互不相通',
      scene: '同一个 VLAN 里，住户之间不该互通，但都要能上网关',
      level: '进阶',
      tags: ['端口隔离', 'port-isolate', '安全'],
      steps: [
        { c: 'system-view' },
        { c: 'port-isolate mode l2', note: '二层隔离模式，同一隔离组内的口互相不通' },
        { c: 'interface GigabitEthernet0/0/1' },
        { c: 'port-isolate enable group 1', note: '隔离组号默认就是 1' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/2' },
        { c: 'port-isolate enable group 1' },
        { c: 'quit' },
        { c: 'interface GigabitEthernet0/0/24', note: '上联口不要加隔离组，否则所有用户都上不了网关' }
      ],
      verify: [
        { cmd: 'display port-isolate group all', hope: '两个接入口都在 group 1 里，上联口不在' }
      ],
      pitfalls: [
        '上联口也加了隔离：用户全断网，而且现象很像链路故障',
        '以为隔离能跨交换机：端口隔离只在本机生效，跨设备要靠 VLAN 或 MUX VLAN'
      ]
    },

    {
      id: 'rec-mirror',
      title: '端口镜像：把流量复制给抓包口',
      scene: '要抓某个口的报文分析，但笔记本不能串进去',
      level: '进阶',
      tags: ['镜像', 'mirror', '抓包', 'observe-port'],
      steps: [
        { c: 'system-view' },
        { c: 'observe-port 1 interface GigabitEthernet0/0/24', note: '指定观察口，笔记本接这儿抓包' },
        { c: 'interface GigabitEthernet0/0/1', note: '被监控的口' },
        { c: 'port-mirroring to observe-port 1 both', note: 'both 双向都镜像；inbound 只抓进来的' },
        { c: 'quit' },
        { c: 'display observe-port', note: '确认观察口配上了' }
      ],
      verify: [
        { cmd: 'display observe-port', hope: 'Observe-port 1 指向 Gi0/0/24' }
      ],
      pitfalls: [
        '观察口接了正常业务：镜像口只发不收，接了终端会断网',
        '镜像口带宽不够：被镜像口跑满时镜像口会丢包，抓到的报文不全'
      ]
    },

    /* ==================== 地址与网关 ==================== */
    {
      id: 'rec-dhcp-global',
      title: 'DHCP：全局地址池分配',
      scene: '三层交换机做网关，统一给多个 VLAN 下发地址',
      level: '入门',
      tags: ['dhcp', '地址池', 'ip pool', '自动分配'],
      steps: [
        { c: 'system-view' },
        { c: 'dhcp enable', note: '全局开关，不敲这条后面全白配' },
        { c: 'ip pool VLAN10', note: '地址池名字自己定，建议带上 VLAN 号' },
        { c: 'network 192.168.10.0 mask 255.255.255.0', note: '这里必须写 mask 形式，不能写 24' },
        { c: 'gateway-list 192.168.10.1', note: '下发给 PC 的网关，就是 Vlanif10 的地址' },
        { c: 'dns-list 114.114.114.114 8.8.8.8' },
        { c: 'excluded-ip-address 192.168.10.1 192.168.10.20', note: '把网关和静态设备排除掉，避免地址冲突' },
        { c: 'lease day 3', note: '租期，默认 1 天；实验里调短一点能更快看到续租' },
        { c: 'quit' },
        { c: 'interface Vlanif10', note: '关键：告诉这个接口用全局池' },
        { c: 'dhcp select global', note: '不配这条，接口不知道去哪找地址池' }
      ],
      verify: [
        { cmd: 'display ip pool', hope: 'VLAN10 池里 Idle 数量减少，Used 增加' },
        { cmd: 'display dhcp server ip-in-use', hope: '能看到 PC 拿到的地址和 MAC' }
      ],
      pitfalls: [
        '忘了 dhcp select global：地址池配得再对也不下发，PC 一直 169.254',
        'network 写成 24 掩码形式：命令直接报错，地址池建不出来',
        'gateway-list 和 Vlanif 地址不一致：PC 拿到地址但上不了网'
      ]
    },

    {
      id: 'rec-dhcp-if',
      title: 'DHCP：接口地址池（单臂路由/小网络）',
      scene: '路由器一个接口带一个网段，不想单独建池子',
      level: '入门',
      tags: ['dhcp', '接口池', 'dhcp select interface'],
      steps: [
        { c: 'system-view' },
        { c: 'dhcp enable' },
        { c: 'interface GigabitEthernet0/0/0.10' },
        { c: 'dot1q termination vid 10' },
        { c: 'ip address 192.168.10.1 24', note: '接口地址会被自动当网关下发' },
        { c: 'arp broadcast enable' },
        { c: 'dhcp select interface', note: '用接口所在网段做池子，网关自动是这个接口地址' },
        { c: 'dhcp server dns-list 114.114.114.114' },
        { c: 'dhcp server excluded-ip-address 192.168.10.2 192.168.10.10' }
      ],
      verify: [
        { cmd: 'display ip pool name GigabitEthernet0/0/0.10', hope: '能看到这个接口对应的池' }
      ],
      pitfalls: [
        '接口池的网关不能改：它固定用接口地址，想换网关只能用全局池',
        '子接口没 arp broadcast enable：PC 拿不到地址也 ping 不通，两个问题一起出现'
      ]
    },

    {
      id: 'rec-vrrp',
      title: 'VRRP 双网关冗余',
      scene: '两台核心互为备份，一台挂了终端网关不换也能继续上网',
      level: '进阶',
      tags: ['vrrp', '网关冗余', '主备', 'track'],
      scope: 'CORE1 / CORE2 对称，仅优先级不同',
      steps: [
        { c: 'system-view', who: 'CORE1' },
        { c: 'interface Vlanif10', who: 'CORE1', note: '两台核心都要有这个 Vlanif' },
        { c: 'ip address 192.168.10.2 24', who: 'CORE1', note: '真实地址，两台必须不同' },
        { c: 'vrrp vrid 10 virtual-ip 192.168.10.254', who: 'CORE1', note: '虚拟网关，PC 的网关填这个' },
        { c: 'vrrp vrid 10 priority 120', who: 'CORE1', note: '默认 100，主用调到 120，越大越优先' },
        { c: 'vrrp vrid 10 preempt-mode timer delay 20', who: 'CORE1', note: '延迟 20 秒抢占，避免上行还没恢复就抢回来造成断流' },
        { c: 'vrrp vrid 10 track interface GigabitEthernet0/0/1 reduced 30', who: 'CORE1', note: '上行口 down 就把优先级降 30，自动让位给备用' },
        { c: 'quit', who: 'CORE1' },
        { c: 'system-view', who: 'CORE2' },
        { c: 'interface Vlanif10', who: 'CORE2' },
        { c: 'ip address 192.168.10.3 24', who: 'CORE2' },
        { c: 'vrrp vrid 10 virtual-ip 192.168.10.254', who: 'CORE2', note: '虚拟 IP 必须和 CORE1 完全一致' }
      ],
      verify: [
        { cmd: 'display vrrp', hope: 'CORE1 是 Master，CORE2 是 Backup，Virtual IP 一致' }
      ],
      pitfalls: [
        '没配 track：上行断了它还是 Master，流量全黑洞，比没配 VRRP 还惨',
        'vrid 或 virtual-ip 两端不一致：两个都是 Master，IP 冲突告警',
        'VRRP 之前二层不通：先保证两台核心之间能通，否则抢占逻辑全是错的'
      ]
    },

    {
      id: 'rec-ssh-telnet',
      title: '远程登录：Telnet 与 SSH',
      scene: '不想每次跑到机柜前插 console 线',
      level: '入门',
      tags: ['ssh', 'telnet', 'aaa', 'vty', '远程登录'],
      steps: [
        { c: 'system-view' },
        { c: 'sysname AR1' },
        { c: 'aaa', note: '在 AAA 视图里建本地用户' },
        { c: 'local-user admin password cipher Huawei@123', note: 'cipher 表示存密文，敲进去会自动加密' },
        { c: 'local-user admin privilege level 15', note: '级别 15 是最高权限，0~15 越大权限越高' },
        { c: 'local-user admin service-type ssh telnet', note: '不写这条，用户建了也登不进来' },
        { c: 'quit' },
        { c: 'stelnet server enable', note: 'SSH 服务默认是关的，这一条必敲' },
        { c: 'rsa local-key-pair create', note: '生成密钥对，交互里选 2048 位' },
        { c: 'user-interface vty 0 4', note: '同时允许 5 个远程会话（0 到 4）' },
        { c: 'authentication-mode aaa', note: '用 AAA 里的账号密码验证' },
        { c: 'protocol inbound ssh', note: '只收 SSH；要 Telnet 就写 all 或 telnet' },
        { c: 'quit' },
        { c: 'interface Vlanif1', note: '管理地址，SSH 要靠它连' },
        { c: 'ip address 192.168.1.1 24' }
      ],
      verify: [
        { cmd: 'display ssh server status', hope: 'SSH Server 是 enabled' },
        { cmd: 'display users', hope: '能看到自己当前这个会话' }
      ],
      pitfalls: [
        'protocol inbound ssh 但没开 stelnet server enable：端口 22 根本不通',
        'service-type 漏了 ssh：账号密码全对，就是提示认证失败',
        'privilege level 忘了配：登进去是级别 0，什么配置都改不了'
      ]
    },

    {
      id: 'rec-console',
      title: 'Console 口与密码恢复思路',
      scene: '刚拿到设备，或者密码忘了进不去',
      level: '入门',
      tags: ['console', '密码', 'user-interface', '开局'],
      steps: [
        { c: 'system-view' },
        { c: 'user-interface console 0', note: 'console 口是 0，不是 vty' },
        { c: 'authentication-mode password', note: '实验环境用密码模式最简单；生产建议 aaa' },
        { c: 'set authentication password cipher Huawei@123' },
        { c: 'idle-timeout 10 0', note: '10 分钟无操作自动断开，防止占着会话' },
        { c: 'quit' },
        { c: 'save', note: '不保存的话重启就回到出厂，白配' }
      ],
      verify: [
        { cmd: 'display current-configuration | include console', hope: '能看到 console 0 下的认证配置' }
      ],
      pitfalls: [
        '改了 console 密码没记住：只能断电重启进 BootROM 清配置，会丢全部配置',
        'save 时选 N：配置只在内存里，重启全没，这个坑新手踩得最多'
      ]
    },

    {
      id: 'rec-ip-basic',
      title: '接口 IP 与连通性排查三步',
      scene: '两台设备直连，配置看起来都对但 ping 不通',
      level: '入门',
      tags: ['ip', 'ping', '排查', '接口', '直连'],
      steps: [
        { c: 'system-view' },
        { c: 'interface GigabitEthernet0/0/0' },
        { c: 'ip address 10.0.0.1 24', note: '两端要在同一网段、掩码一致' },
        { c: 'undo shutdown', note: '接口默认可能是 shutdown 的，这是第一大坑' },
        { c: 'quit' },
        { c: 'display ip interface brief', note: '第一步排查：物理 up 吗、协议 up 吗、IP 配上了吗' },
        { c: 'display interface GigabitEthernet0/0/0', note: '第二步：看有没有 CRC 错包、速率双工是否一致' },
        { c: 'display arp all', note: '第三步：ARP 学不到就说明二层根本不通，别急着查路由' }
      ],
      verify: [
        { cmd: 'display ip interface brief', hope: 'Physical 和 Protocol 两列都是 up（不是 up/down）' },
        { cmd: 'ping 10.0.0.2', hope: '通，且 ARP 表里有对方' }
      ],
      pitfalls: [
        'undo shutdown 忘了敲：接口 up/down，IP 配了也不通',
        '掩码不一致：一个 /24 一个 /30，看起来同网段实际不通',
        'eNSP 里线没连对：接口显示 down，先去看拓扑连的是不是同一个口'
      ]
    }
  );
})(window.__ENSP);
