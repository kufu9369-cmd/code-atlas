/* ============================================================
   码典 · eNSP 实验（9 个）
   ------------------------------------------------------------
   拓扑坐标约束（校验会挡）：x 在 10–750、y 在 10–topo.h-10。
   默认 h=260，所以 y 取 60~200 最安全，节点之间留出 200 以上间距。
   ============================================================ */
(function (E) {
  'use strict';

  E.labs.push(

    /* ---------------- 1. 链路聚合 ---------------- */
    {
      id: 'lab-eth-trunk-lacp',
      title: '链路聚合：两条线捆成一条',
      level: '进阶',
      minutes: 25,
      goal: '用 LACP 把两条物理链路捆成一条逻辑链路，断开其中一条业务不中断。',
      scene: '两台交换机之间带宽不够、又想要冗余，机房正好有空余光纤。先把两条口做成 Eth-Trunk，再让业务 VLAN 走聚合口。',
      topo: {
        h: 260,
        nodes: [
          { id: 'SW1', label: 'SW1', sub: '接入', t: 'switch', x: 120, y: 175 },
          { id: 'SW2', label: 'SW2', sub: '汇聚', t: 'switch', x: 400, y: 175 },
          { id: 'PC1', label: 'PC1', sub: 'VLAN 10', t: 'pc', x: 120, y: 65 },
          { id: 'PC2', label: 'PC2', sub: 'VLAN 10', t: 'pc', x: 400, y: 65 }
        ],
        links: [
          ['PC1', 'SW1', 'Access V10'],
          ['SW1', 'SW2', 'Eth-Trunk ×2'],
          ['SW2', 'PC2', 'Access V10']
        ]
      },
      plan: [
        { dev: 'SW1', intf: 'GE0/0/23-24', ip: '—', note: '成员口，两条都捆进 Eth-Trunk 1' },
        { dev: 'SW2', intf: 'GE0/0/23-24', ip: '—', note: '对端同样捆 Eth-Trunk 1' },
        { dev: 'SW1', intf: 'Eth-Trunk1', ip: '—', note: 'Trunk 放通 VLAN 10' }
      ],
      vars: {
        trunkId: { label: 'Eth-Trunk 编号', value: '1', hint: '两端一致', desc: '两端用同一个编号便于对照。' },
        vlanId: { label: '业务 VLAN', value: '10', hint: '1–4094', desc: 'PC 所在 VLAN。' }
      },
      steps: [
        { title: 'SW1：建聚合口并捆成员', note: '顺序很重要：先建 Eth-Trunk 再绑成员口。反过来要先把物理口的配置 undo 干净。',
          code: `system-view
sysname SW1
vlan batch {{vlanId}}
interface Eth-Trunk {{trunkId}}
 mode lacp-static
 quit
interface GigabitEthernet0/0/23
 eth-trunk {{trunkId}}
 quit
interface GigabitEthernet0/0/24
 eth-trunk {{trunkId}}
 quit` },
        { title: 'SW1：聚合口当 Trunk 用', note: '业务 VLAN 配在 Eth-Trunk 上，不是配在成员口上。成员口的 VLAN 配置会被聚合口覆盖。',
          code: `interface Eth-Trunk {{trunkId}}
 port link-type trunk
 port trunk allow-pass vlan {{vlanId}}
 quit` },
        { title: 'SW2：镜像同样配置', note: '两边必须都是 lacp-static。一边 static 一边 manual 时 LACP 协商不起来，成员口一直是 Unselected。',
          code: `system-view
sysname SW2
vlan batch {{vlanId}}
interface Eth-Trunk {{trunkId}}
 mode lacp-static
 port link-type trunk
 port trunk allow-pass vlan {{vlanId}}
 quit
interface GigabitEthernet0/0/23
 eth-trunk {{trunkId}}
 quit
interface GigabitEthernet0/0/24
 eth-trunk {{trunkId}}
 quit` },
        { title: '两端接 PC', note: '',
          code: `interface GigabitEthernet0/0/1
 port link-type access
 port default vlan {{vlanId}}
 quit` },
        { title: '验证 + 断链测试', note: '先确认两条链路都在转发，再 shutdown 一条，观察 ping 是否只丢一两个包。',
          code: `display eth-trunk {{trunkId}}
display lacp error`
        }
      ],
      verify: [
        { cmd: 'display eth-trunk 1', hope: '两个成员口 Status 都是 Up，Operate status 都是 Up，WorkingMode 显示 LACP' },
        { cmd: 'display interface Eth-Trunk 1', hope: 'Line protocol current state 为 UP，带宽是单条的两倍' },
        { cmd: 'shutdown 一条成员口后 ping', hope: '只丢 1–2 个包，业务不中断；Eth-Trunk 状态仍是 Up' }
      ],
      pitfalls: [
        '成员口上加进 Eth-Trunk 之前必须先清掉原有的 VLAN / STP 配置，否则报错提示接口已被占用。',
        '只在一边配聚合，另一边当独立口用，LACP 报文收不到，成员口一直 Unselected，业务反而比单线还慢。',
        'member 口速率和双工必须一致，100M 混 1000M 时低速率那条会被踢出聚合。',
        '改完聚合口记得两端 save，重启后配置丢了会左右不通。'
      ],
      docs: {
        secs: [
          { h: '聚合成功后看什么', p: 'display eth-trunk 1 里最关键是 Operate status：Up 才是真正参与转发，Unselected 表示 LACP 协商失败或超出最大活动链路数。' },
          { h: '带宽是叠加的，但不是简单相加', p: '一条 TCP 流只会走其中一条成员链路，聚合提升的是「总吞吐」，不是单流带宽。想单流跑满要用支持逐包分流的模式。' }
        ]
      }
    },

    /* ---------------- 2. NAT 出网 ---------------- */
    {
      id: 'lab-nat-outbound',
      title: 'NAT 出网：内网访问外网 + 发布服务器',
      level: '进阶',
      minutes: 30,
      goal: '让内网 PC 通过地址转换访问外网，同时把内网 Web 服务器以端口映射方式发布出去。',
      scene: '公司只有一条宽带、一个公网地址。既要让员工上网（源 NAT），又要让外部访问内部网站（目的 NAT）。',
      topo: {
        h: 260,
        nodes: [
          { id: 'PC1', label: 'PC1', sub: '192.168.10.10', t: 'pc', x: 110, y: 70 },
          { id: 'SRV1', label: 'SRV1', sub: 'Web 服务器', t: 'server', x: 110, y: 190 },
          { id: 'SW1', label: 'SW1', sub: '接入', t: 'switch', x: 380, y: 130 },
          { id: 'R1', label: 'R1', sub: '出口路由器', t: 'router', x: 640, y: 130 },
          { id: 'ISP', label: 'ISP', sub: '模拟外网', t: 'router', x: 640, y: 40 }
        ],
        links: [
          ['PC1', 'SW1', 'Access V10'],
          ['SRV1', 'SW1', 'Access V10'],
          ['SW1', 'R1', 'Trunk / 路由口'],
          ['R1', 'ISP', '公网出口']
        ]
      },
      plan: [
        { dev: 'R1', intf: 'GE0/0/0', ip: '192.168.10.1/24', note: '内网网关' },
        { dev: 'R1', intf: 'GE0/0/1', ip: '200.1.1.1/30', note: '公网接口' },
        { dev: 'PC1', intf: '以太网', ip: '192.168.10.10/24 网关 192.168.10.1', note: '' },
        { dev: 'SRV1', intf: '以太网', ip: '192.168.10.100/24 网关 192.168.10.1', note: '' }
      ],
      vars: {
        insideNet: { label: '内网网段', value: '192.168.10.0', hint: '/24', desc: '允许上网的内网范围。' },
        insideWildcard: { label: '反掩码', value: '0.0.0.255', hint: '/24 对应 0.0.0.255', desc: 'ACL 用反掩码。' },
        publicIp: { label: '公网地址', value: '200.1.1.1', hint: '出口接口地址', desc: 'easy-ip 会把源地址转换成它。' },
        srvIp: { label: '服务器内网地址', value: '192.168.10.100', hint: '真实地址', desc: '被发布出去的服务器。' },
        pubPort: { label: '对外端口', value: '8080', hint: '高位端口更安全', desc: '外部访问 200.1.1.1:8080 会转到内网 80。' }
      },
      steps: [
        { title: 'R1 接口与默认路由', note: '内网口做网关，公网口配运营商给的地址。默认路由指向运营商。',
          code: `system-view
sysname R1
interface GigabitEthernet0/0/0
 ip address 192.168.10.1 255.255.255.0
 quit
interface GigabitEthernet0/0/1
 ip address {{publicIp}} 255.255.255.252
 quit
ip route-static 0.0.0.0 0.0.0.0 200.1.1.2` },
        { title: '源 NAT：让内网能出去', note: 'easy-ip 直接借用公网接口地址做端口复用，最省事。',
          code: `acl number 2000
 rule 5 permit source {{insideNet}} {{insideWildcard}}
 quit
interface GigabitEthernet0/0/1
 nat outbound 2000
 quit` },
        { title: '目的 NAT：发布内网 Web', note: '外网访问 8080，转到内网服务器的 80。',
          code: `interface GigabitEthernet0/0/1
 nat server protocol tcp global current-interface {{pubPort}} inside {{srvIp}} 80
 quit` },
        { title: '验证会话表', note: '在 PC 上 ping 外网地址，然后在 R1 上看会话，能看到源地址被换成公网地址。',
          code: `display nat session all`
        }
      ],
      verify: [
        { cmd: 'PC1 ping 200.1.1.2', hope: '能通（模拟外网地址）' },
        { cmd: 'display nat session all', hope: '能看到 ICMP 会话，源地址已转换为公网地址，端口做了复用' },
        { cmd: '外部主机访问 200.1.1.1:8080', hope: '能打开内网 192.168.10.100 的 80 服务' }
      ],
      pitfalls: [
        'nat outbound 配在内网口上——会对内网互访也做转换，表现是内网全断。必须配在公网出口。',
        'ACL 忘了写序号后面的 permit，只写一条 deny 就把所有流量都挡住了（缺省 deny all）。',
        '发布服务器时没放通外层防火墙策略（如果有防火墙）——NAT 只转换地址，不负责放行。',
        '公网侧回程路由缺失：运营商不知道 192.168.10.0/24 在哪，需要靠 NAT 转换掉源地址，不能只配路由。'
      ],
      docs: {
        secs: [
          { h: 'easy-ip 和地址池的区别', p: 'easy-ip 直接用出接口地址做转换，适合只有一个公网地址；地址池适合有多个公网地址、要给不同用户分配不同出口地址的场景。' },
          { h: '为什么 servers 要用 nat server 而不是 outbound', p: 'outbound 是「内网主动出去」时改源地址；nat server 是「外部主动进来」时改目的地址。方向完全不同，不能互换。' }
        ]
      }
    },

    /* ---------------- 3. ACL 精细化管控 ---------------- */
    {
      id: 'lab-acl-control',
      title: 'ACL 管控：访客网只能访问指定服务器',
      level: '进阶',
      minutes: 25,
      goal: '访客 VLAN 只能访问公司门户服务器，其余一律拒绝；员工 VLAN 不受限制。',
      scene: '会议室访客连 Wi-Fi 后既不能访问内部系统，也不能随便上外网，只允许打开公司门户看介绍页。',
      topo: {
        h: 260,
        nodes: [
          { id: 'PC1', label: 'PC1', sub: '员工 192.168.10.10', t: 'pc', x: 110, y: 65 },
          { id: 'PC2', label: 'PC2', sub: '访客 192.168.20.10', t: 'pc', x: 110, y: 195 },
          { id: 'SW1', label: 'SW1', sub: '核心', t: 'switch', x: 400, y: 130 },
          { id: 'SRV1', label: 'SRV1', sub: '门户 192.168.30.10', t: 'server', x: 680, y: 130 }
        ],
        links: [
          ['PC1', 'SW1', 'VLAN 10'],
          ['PC2', 'SW1', 'VLAN 20'],
          ['SW1', 'SRV1', 'VLAN 30']
        ]
      },
      plan: [
        { dev: 'SW1', intf: 'Vlanif10', ip: '192.168.10.1/24', note: '员工网关' },
        { dev: 'SW1', intf: 'Vlanif20', ip: '192.168.20.1/24', note: '访客网关' },
        { dev: 'SW1', intf: 'Vlanif30', ip: '192.168.30.1/24', note: '服务器网关' }
      ],
      vars: {
        guestNet: { label: '访客网段', value: '192.168.20.0', hint: '/24', desc: '被限制的网段。' },
        guestWildcard: { label: '访客反掩码', value: '0.0.0.255', hint: '/24', desc: 'ACL 反掩码。' },
        portalIp: { label: '门户服务器', value: '192.168.30.10', hint: '唯一放行的目标', desc: '访客只能访问这一台。' },
        portalPort: { label: '门户端口', value: '80', hint: '80 / 443', desc: '只放通 Web 端口。' }
      },
      steps: [
        { title: '三层接口与 VLAN', note: '三个 VLAN 各配网关，先保证互通，再加限制。',
          code: `system-view
sysname SW1
vlan batch 10 20 30
interface Vlanif10
 ip address 192.168.10.1 255.255.255.0
 quit
interface Vlanif20
 ip address 192.168.20.1 255.255.255.0
 quit
interface Vlanif30
 ip address 192.168.30.1 255.255.255.0
 quit` },
        { title: '写高级 ACL', note: '3000–3999 是高级 ACL，能匹配源、目的、协议、端口。',
          code: `acl number 3000
 rule 5 permit tcp source {{guestNet}} {{guestWildcard}} destination {{portalIp}} 0 destination-port eq {{portalPort}}
 rule 10 deny ip source {{guestNet}} {{guestWildcard}}
 rule 20 permit ip
 quit` },
        { title: '在访客网关入方向应用', note: 'traffic-filter 挂在 Vlanif20 的 inbound，访客上行流量全过一遍 ACL。',
          code: `interface Vlanif20
 traffic-filter inbound acl 3000
 quit` },
        { title: '验证', note: '',
          code: `display acl 3000` }
      ],
      verify: [
        { cmd: 'PC2 ping 192.168.30.10', hope: '能通（门户服务器）' },
        { cmd: 'PC2 ping 192.168.10.10', hope: '不通（被 rule 10 deny 拦掉）' },
        { cmd: 'PC1 ping 192.168.30.10', hope: '能通（员工网不在限制范围内）' },
        { cmd: 'display acl 3000', hope: '能看到每条 rule 的匹配计数在增长，确认命中顺序正确' }
      ],
      pitfalls: [
        'ACL 末尾隐含 deny all，只写一条 deny 会导致访客所有流量都被挡，最后那条 permit ip 是保命的。',
        'rule 5 必须写在 deny 前面，顺序反了永远匹配不到。序号留间隔（5/10/20）方便以后插规则。',
        'traffic-filter 的方向：访客流量从 Vlanif20 进来，所以是 inbound。配 outbound 拦的是下发给访客的流量，效果完全不同。',
        '改完不清空计数器就看效果，容易误判——display acl 里 matches 是累计值。'
      ],
      docs: {
        secs: [
          { h: 'ACL 编号的含义', p: '2000–2999 基本 ACL 只能匹配源；3000–3999 高级 ACL 能匹配源/目的/协议/端口；4000–4999 二层 ACL；5000–5999 用户 ACL。选错类型会写不出想要的规则。' },
          { h: 'traffic-filter 放在三层还是二层', p: '放在 Vlanif 上是三层过滤，跨网段流量才受控；放在物理口上会连二层同网段流量一起管。想只控制跨网段的访问就用 Vlanif。' }
        ]
      }
    },

    /* ---------------- 4. SSH 加固 ---------------- */
    {
      id: 'lab-ssh-hardening',
      title: '设备开局安全加固（SSH + AAA + 源限制）',
      level: '进阶',
      minutes: 20,
      goal: '把一台新交换机配成可远程管理、但只允许指定网段 SSH 登录的状态。',
      scene: '设备上架第一件事不是配业务，是先把管理入口收紧：关 telnet、只留 SSH、限制源网段、账号分级。',
      topo: {
        h: 260,
        nodes: [
          { id: 'PC1', label: 'PC1', sub: '管理终端 .100', t: 'pc', x: 120, y: 130 },
          { id: 'SW1', label: 'SW1', sub: '待加固', t: 'switch', x: 400, y: 130 },
          { id: 'SW2', label: 'SW2', sub: '业务接入', t: 'switch', x: 680, y: 130 }
        ],
        links: [
          ['PC1', 'SW1', 'VLAN 10 管理'],
          ['SW1', 'SW2', 'Trunk']
        ]
      },
      plan: [
        { dev: 'SW1', intf: 'Vlanif10', ip: '192.168.10.1/24', note: '管理网关' },
        { dev: 'PC1', intf: '以太网', ip: '192.168.10.100/24', note: '管理员电脑' }
      ],
      vars: {
        adminUser: { label: '管理员账号', value: 'netadmin', hint: '别用 admin', desc: '默认账号是爆破第一目标。' },
        adminPwd: { label: '密码', value: 'Netadm@2026', hint: '12 位以上', desc: '大小写数字符号混合。' },
        adminNet: { label: '允许登录网段', value: '192.168.10.0', hint: '管理网段', desc: '其他网段连 SSH 端口都连不上。' },
        adminWildcard: { label: '反掩码', value: '0.0.0.255', hint: '/24', desc: 'ACL 反掩码。' }
      },
      steps: [
        { title: '管理地址与 SSH 服务', note: '先把 Vlanif 配好，SSH 才能用这个地址登录。',
          code: `system-view
sysname SW1
vlan batch 10
interface Vlanif10
 ip address 192.168.10.1 255.255.255.0
 quit
stelnet server enable` },
        { title: '本地账号与权限', note: 'irreversible-cipher 存不可逆摘要，配置文件里看不到明文。',
          code: `aaa
 local-user {{adminUser}} password irreversible-cipher {{adminPwd}}
 local-user {{adminUser}} privilege level 15
 local-user {{adminUser}} service-type ssh
 quit
ssh user {{adminUser}} authentication-type password
ssh user {{adminUser}} service-type stelnet` },
        { title: 'VTY 只收 SSH + 源限制', note: '这两步最容易漏：只开 SSH 服务但 VTY 还是 aaa+all，telnet 照样能进。',
          code: `acl number 2000
 rule 5 permit source {{adminNet}} {{adminWildcard}}
 quit
user-interface vty 0 4
 authentication-mode aaa
 protocol inbound ssh
 acl 2000 inbound
 idle-timeout 10 0
 quit` },
        { title: '验证', note: '用 PC1 登录试一次；再用别的网段试，应该直接连不上。',
          code: `display ssh server status
display users` }
      ],
      verify: [
        { cmd: 'display ssh server status', hope: 'SSH server 状态为 Enable，版本支持 2.0' },
        { cmd: 'PC1 用 PuTTY / xshell 登录 192.168.10.1', hope: '能登录，提示符显示 SW1' },
        { cmd: '非管理网段登录', hope: '连接被拒绝，连密码提示都出不来' },
        { cmd: 'display acl 2000', hope: '能看到 5 号规则命中计数增长' }
      ],
      pitfalls: [
        '只配 stelnet server enable 不配 ssh user，登录时报「用户没有 SSH 服务权限」。',
        'VTY 上忘了 protocol inbound ssh，telnet 依然能进——这是加固最常见的漏项。',
        'ACL 编号用成 3000 以上（高级 ACL），在 VTY 上不生效，只认基本 ACL（2000–2999）。',
        '配了 ACL 但没确认自己的管理终端在允许范围内，一保存就把自己关在门外，只能去机房接 Console。'
      ],
      docs: {
        secs: [
          { h: '加固前后对比', p: '默认状态：telnet + ssh 都开、任何地址能连、账号 admin。加固后：只有 SSH、只有管理网段、强密码 + 15 级权限。这中间的差距就是被入侵的概率差。' },
          { h: '先确认自己没被关在门外', p: '配 ACL 限制 VTY 之前，先用 display acl 确认自己的源地址在 permit 范围内，再 save。顺序错了就只能去现场接 Console 线。' }
        ]
      }
    },

    /* ---------------- 5. IS-IS ---------------- */
    {
      id: 'lab-isis-basic',
      title: 'IS-IS 单区域 + 路由渗透',
      level: '综合',
      minutes: 35,
      goal: '三台路由器跑通 IS-IS，并让 L1 区域能看到 L2 的明细路由而不是只走默认。',
      scene: '运营商/大型园区常见结构：接入层是 L1，骨干是 L2。默认 L1 只有一个 ATT 默认路由，跨区域会绕路，需要做渗透。',
      topo: {
        h: 260,
        nodes: [
          { id: 'R1', label: 'R1', sub: 'L1', t: 'router', x: 110, y: 130 },
          { id: 'R2', label: 'R2', sub: 'L1-2 边界', t: 'router', x: 400, y: 130 },
          { id: 'R3', label: 'R3', sub: 'L2', t: 'router', x: 680, y: 130 }
        ],
        links: [
          ['R1', 'R2', '10.0.1.0/30 L1'],
          ['R2', 'R3', '10.0.2.0/30 L2']
        ]
      },
      plan: [
        { dev: 'R1', intf: 'GE0/0/0', ip: '10.0.1.1/30', note: 'L1 接口' },
        { dev: 'R1', intf: 'LoopBack0', ip: '192.168.1.1/32', note: '业务网段' },
        { dev: 'R2', intf: 'GE0/0/0', ip: '10.0.1.2/30', note: '朝 R1' },
        { dev: 'R2', intf: 'GE0/0/1', ip: '10.0.2.1/30', note: '朝 R3' },
        { dev: 'R3', intf: 'GE0/0/0', ip: '10.0.2.2/30', note: '朝 R2' },
        { dev: 'R3', intf: 'LoopBack0', ip: '192.168.3.1/32', note: '业务网段' }
      ],
      vars: {
        areaNet: { label: 'R1 的 NET', value: '49.0001.0000.0000.0001.00', hint: '区域 49.0001', desc: 'R1 属于区域 49.0001，SystemID 0000.0000.0001。' },
        areaNet2: { label: 'R2 的 NET', value: '49.0001.0000.0000.0002.00', hint: '同区域，SystemID 不同', desc: 'L1 邻居要求区域 ID 相同、SystemID 不同。' },
        areaNet3: { label: 'R3 的 NET', value: '49.0002.0000.0000.0003.00', hint: '区域 49.0002', desc: 'R3 在另一个区域，只能和 R2 建 L2 邻居。' }
      },
      steps: [
        { title: 'R1：L1 路由器', note: 'is-level level-1 表示只维护本区域链路状态。',
          code: `system-view
sysname R1
isis 1
 is-level level-1
 network-entity {{areaNet}}
 quit
interface GigabitEthernet0/0/0
 ip address 10.0.1.1 255.255.255.252
 isis enable 1
 quit
interface LoopBack0
 ip address 192.168.1.1 255.255.255.255
 isis enable 1
 quit` },
        { title: 'R2：区域边界', note: 'level-1-2 同时维护两个层次，是 L1 与 L2 之间的桥梁。',
          code: `system-view
sysname R2
isis 1
 is-level level-1-2
 network-entity {{areaNet2}}
 quit
interface GigabitEthernet0/0/0
 ip address 10.0.1.2 255.255.255.252
 isis enable 1
 isis circuit-level level-1
 quit
interface GigabitEthernet0/0/1
 ip address 10.0.2.1 255.255.255.252
 isis enable 1
 isis circuit-level level-2
 quit` },
        { title: 'R3：L2 路由器', note: '',
          code: `system-view
sysname R3
isis 1
 is-level level-2
 network-entity {{areaNet3}}
 quit
interface GigabitEthernet0/0/0
 ip address 10.0.2.2 255.255.255.252
 isis enable 1
 quit
interface LoopBack0
 ip address 192.168.3.1 255.255.255.255
 isis enable 1
 quit` },
        { title: 'R2 做路由渗透', note: '不做渗透时 R1 只能拿到一条默认路由，到 R3 的流量都算「绕行」。做完能看到 192.168.3.1 的明细。',
          code: `ip ip-prefix PENETRATE index 10 permit 192.168.3.0 24
isis 1
 import-route isis level-2 into level-1 filter-policy ip-prefix PENETRATE
 quit` },
        { title: '验证邻居与路由', note: '',
          code: `display isis peer
display ip routing-table protocol isis` }
      ],
      verify: [
        { cmd: 'display isis peer', hope: 'R1 与 R2 是 L1 邻接（Up），R2 与 R3 是 L2 邻接（Up）' },
        { cmd: 'display ip routing-table protocol isis', hope: 'R1 上能看到 192.168.3.1/32 的明细路由（渗透生效），否则只有 0.0.0.0/0' },
        { cmd: 'R1 ping 192.168.3.1', hope: '能通' }
      ],
      pitfalls: [
        'NET 少了结尾的 .00，直接报错。完整格式是 区域.SystemID.NSEL，NSEL 必须 00。',
        '两端 circuit-level 不一致（一边 level-1 一边 level-2），邻居起不来且日志只写 adjacency rejected。',
        '同区域两台设备的 SystemID 相同，LSP ID 冲突，邻接反复震荡。',
        'STP 默认开启时 IS-IS 在交换机上会被生成树影响，实验里两台路由器直连不受影响，接交换机要注意。'
      ],
      docs: {
        secs: [
          { h: '为什么 L1 只拿到默认路由', p: 'L1-2 路由器会在 L1 LSP 里置 ATT 位，L1 路由器看到 ATT 就生成一条指向 L1-2 的默认路由。它不知道 L2 的明细，所以跨区域一律走默认。' },
          { h: '渗透的边界要靠前缀列表', p: 'import-route isis level-2 into level-1 不加过滤会把整个 L2 路由表灌进 L1，几千条路由会把接入设备压垮。用 ip-prefix 精确放行是必须的。' }
        ]
      }
    },

    /* ---------------- 6. BGP ---------------- */
    {
      id: 'lab-bgp-ebgp',
      title: 'BGP：eBGP + iBGP 路由反射',
      level: '综合',
      minutes: 35,
      goal: '两个 AS 之间建立 eBGP，AS 内部用 iBGP + 路由反射器打通，最后做到端到端互通。',
      scene: '双出口企业网或运营商互联的标准结构：AS 边界跑 eBGP，内部跑 iBGP，用 RR 避免全互联。',
      topo: {
        h: 260,
        nodes: [
          { id: 'R1', label: 'R1', sub: 'AS 65001', t: 'router', x: 110, y: 130 },
          { id: 'R2', label: 'R2', sub: 'AS 65002 边界', t: 'router', x: 400, y: 130 },
          { id: 'R3', label: 'R3', sub: 'AS 65002 RR', t: 'router', x: 680, y: 130 }
        ],
        links: [
          ['R1', 'R2', 'eBGP 10.0.1.0/30'],
          ['R2', 'R3', 'iBGP 10.0.2.0/30']
        ]
      },
      plan: [
        { dev: 'R1', intf: 'GE0/0/0', ip: '10.0.1.1/30', note: 'eBGP 互联' },
        { dev: 'R1', intf: 'LoopBack0', ip: '192.168.1.1/32', note: '要宣告的网段' },
        { dev: 'R2', intf: 'GE0/0/0', ip: '10.0.1.2/30', note: 'AS 边界外连' },
        { dev: 'R2', intf: 'GE0/0/1', ip: '10.0.2.1/30', note: 'AS 内部' },
        { dev: 'R3', intf: 'GE0/0/1', ip: '10.0.2.2/30', note: 'AS 内部' },
        { dev: 'R3', intf: 'LoopBack0', ip: '192.168.3.1/32', note: '要宣告的网段' }
      ],
      vars: {
        asLocal: { label: 'R1 的 AS', value: '65001', hint: '私有 AS 段', desc: '实验用 64512–65534 私有 AS。' },
        asRemote: { label: 'R2/R3 的 AS', value: '65002', hint: '与对端不同', desc: '同一个 AS 内部跑 iBGP。' }
      },
      steps: [
        { title: '基础地址与互通', note: 'BGP 建立在 IP 可达的基础上，先把直连和路由搞定。',
          code: `system-view
sysname R1
interface GigabitEthernet0/0/0
 ip address 10.0.1.1 255.255.255.252
 quit
interface LoopBack0
 ip address 192.168.1.1 255.255.255.255
 quit` },
        { title: 'R1 起 eBGP 并宣告网段', note: 'network 要求路由表里有这条精确路由——Loopback 直连路由天然存在，所以能直接宣告。',
          code: `bgp {{asLocal}}
 router-id 1.1.1.1
 peer 10.0.1.2 as-number {{asRemote}}
 network 192.168.1.1 255.255.255.255
 quit` },
        { title: 'R2 双方向邻居', note: '对外 eBGP 指向 R1，对内 iBGP 指向 R3，并让 R3 成为反射客户端。',
          code: `system-view
sysname R2
interface GigabitEthernet0/0/0
 ip address 10.0.1.2 255.255.255.252
 quit
interface GigabitEthernet0/0/1
 ip address 10.0.2.1 255.255.255.252
 quit
bgp {{asRemote}}
 router-id 2.2.2.2
 peer 10.0.1.1 as-number {{asLocal}}
 peer 10.0.2.2 as-number {{asRemote}}
 peer 10.0.2.2 reflect-client
 quit` },
        { title: 'R3 宣告自己的网段', note: '',
          code: `system-view
sysname R3
interface GigabitEthernet0/0/1
 ip address 10.0.2.2 255.255.255.252
 quit
interface LoopBack0
 ip address 192.168.3.1 255.255.255.255
 quit
bgp {{asRemote}}
 router-id 3.3.3.3
 peer 10.0.2.1 as-number {{asRemote}}
 network 192.168.3.1 255.255.255.255
 quit` },
        { title: '验证', note: '',
          code: `display bgp peer
display bgp routing-table` }
      ],
      verify: [
        { cmd: 'display bgp peer', hope: '三条邻居关系都是 Established（R1↔R2 是 eBGP，R2↔R3 是 iBGP）' },
        { cmd: 'display bgp routing-table', hope: 'R3 上能看到 192.168.1.1/32，R1 上能看到 192.168.3.1/32' },
        { cmd: 'R1 ping 192.168.3.1', hope: '能通（需要 R2 有到 192.168.3.0 的路由，BGP 已注入）' }
      ],
      pitfalls: [
        'network 命令宣告的网段在路由表里不存在，命令不报错也不生效——先 display ip routing-table 确认。',
        'iBGP 邻居卡在 Active：忘了在 iBGP 对等体上都配对方，iBGP 需要双向 peer。',
        'eBGP 两端 AS 号写成一样，会按 iBGP 处理，反而建不起来。',
        'R2 上忘配 reflect-client，R3 学不到 R1 的路由（iBGP 有水平分割，从 iBGP 学的不传给其他 iBGP）。'
      ],
      docs: {
        secs: [
          { h: 'iBGP 为什么需要 RR', p: 'iBGP 的水平分割规则要求：从 iBGP 邻居学到的路由不能再传给其他 iBGP 邻居。所以 4 台设备要 6 条会话全互联。RR 打破这个限制，允许把客户端路由反射给其他客户端。' },
          { h: 'eBGP 默认 TTL=1', p: 'eBGP 报文的 TTL 是 1，跨设备必须用 peer x ebgp-max-hop。这也是为什么 eBGP 邻居通常都是直连地址。' }
        ]
      }
    },

    /* ---------------- 7. MPLS VPN ---------------- */
    {
      id: 'lab-mpls-vpn',
      title: 'MPLS VPN：两个客户私网互通',
      level: '综合',
      minutes: 45,
      goal: '在两个 PE 之间建立 VPNv4 邻居，让两个站点相同网段的私网互相通而且不串。',
      scene: '运营商给多个客户提供专网：客户内部用私网地址，不同客户可以用相同的 192.168.1.0/24。靠 VRF 隔离、RD 区分、RT 控制发布。',
      topo: {
        h: 260,
        nodes: [
          { id: 'CE1', label: 'CE1', sub: '192.168.1.0/24', t: 'router', x: 110, y: 70 },
          { id: 'PE1', label: 'PE1', sub: 'VRF CUST-A', t: 'router', x: 330, y: 170 },
          { id: 'PE2', label: 'PE2', sub: 'VRF CUST-A', t: 'router', x: 570, y: 170 },
          { id: 'CE2', label: 'CE2', sub: '192.168.1.0/24', t: 'router', x: 700, y: 70 }
        ],
        links: [
          ['CE1', 'PE1', '10.1.0.0/30'],
          ['PE1', 'PE2', 'MPLS 骨干 10.0.0.0/30'],
          ['PE2', 'CE2', '10.2.0.0/30']
        ]
      },
      plan: [
        { dev: 'CE1', intf: 'GE0/0/0', ip: '10.1.0.1/30', note: '接 PE1' },
        { dev: 'CE1', intf: 'LoopBack0', ip: '192.168.1.1/24', note: '模拟客户网段' },
        { dev: 'PE1', intf: 'GE0/0/0', ip: '10.1.0.2/30', note: '绑 VRF' },
        { dev: 'PE1', intf: 'GE0/0/1', ip: '10.0.0.1/30', note: 'MPLS 骨干' },
        { dev: 'PE1', intf: 'LoopBack0', ip: '1.1.1.1/32', note: 'LSR ID / BGP 源' },
        { dev: 'PE2', intf: 'GE0/0/0', ip: '10.0.0.2/30', note: 'MPLS 骨干' },
        { dev: 'PE2', intf: 'GE0/0/1', ip: '10.2.0.1/30', note: '绑 VRF' },
        { dev: 'CE2', intf: 'LoopBack0', ip: '192.168.1.2/24', note: '模拟客户网段' }
      ],
      vars: {
        vrfName: { label: 'VRF 名', value: 'CUST-A', hint: '每客户一个', desc: '两个 PE 上的 VRF 名要一致，便于对照。' },
        rd: { label: 'RD', value: '100:1', hint: 'ASN:数字', desc: '让两端相同的私网前缀在 MP-BGP 里变成两条不同路由。' },
        rt: { label: 'RT', value: '100:1', hint: 'ASN:数字', desc: '控制发布范围：本端 export 的 RT 必须在对端 import 列表里。' },
        peAs: { label: 'PE 的 AS', value: '65000', hint: '运营商 AS', desc: 'PE 之间跑 MP-BGP。' }
      },
      steps: [
        { title: '骨干：IP + IGP + MPLS/LDP', note: '先把 PE 之间打通三层，再开 MPLS 和 LDP。Loopback 作为 LSR ID。',
          code: `system-view
sysname PE1
mpls lsr-id 1.1.1.1
mpls
mpls ldp
 quit
interface LoopBack0
 ip address 1.1.1.1 255.255.255.255
 quit
interface GigabitEthernet0/0/1
 ip address 10.0.0.1 255.255.255.252
 mpls
 mpls ldp
 quit
ospf 1 router-id 1.1.1.1
 area 0.0.0.0
  network 10.0.0.0 0.0.0.3
  network 1.1.1.1 0.0.0.0
  quit
 quit` },
        { title: 'PE1：建 VRF 并绑接口', note: '先 ip binding 再 ip address，顺序反了地址会落到全局路由表。',
          code: `ip vpn-instance {{vrfName}}
 ipv4-family
  route-distinguisher {{rd}}
  vpn-target {{rt}} both
  quit
 quit
interface GigabitEthernet0/0/0
 ip binding vpn-instance {{vrfName}}
 ip address 10.1.0.2 255.255.255.252
 quit` },
        { title: 'PE1：MP-BGP 与 PE-CE', note: 'vpnv4 家族负责传 VPN 路由，vpn-instance 家族负责和 CE 交换。',
          code: `bgp {{peAs}}
 router-id 1.1.1.1
 peer 2.2.2.2 as-number {{peAs}}
 peer 2.2.2.2 connect-interface LoopBack0
 ipv4-family vpnv4
  peer 2.2.2.2 enable
  quit
 ipv4-family vpn-instance {{vrfName}}
  peer 10.1.0.1 as-number 65010
  quit
 quit` },
        { title: 'PE2：镜像配置', note: '对端 PE 同样建 VRF、绑接口、起 MP-BGP，RT 必须成对。',
          code: `system-view
sysname PE2
mpls lsr-id 2.2.2.2
mpls
mpls ldp
 quit
interface LoopBack0
 ip address 2.2.2.2 255.255.255.255
 quit
interface GigabitEthernet0/0/0
 ip address 10.0.0.2 255.255.255.252
 mpls
 mpls ldp
 quit
ospf 1 router-id 2.2.2.2
 area 0.0.0.0
  network 10.0.0.0 0.0.0.3
  network 2.2.2.2 0.0.0.0
  quit
 quit
ip vpn-instance {{vrfName}}
 ipv4-family
  route-distinguisher 200:1
  vpn-target {{rt}} both
  quit
 quit
interface GigabitEthernet0/0/1
 ip binding vpn-instance {{vrfName}}
 ip address 10.2.0.1 255.255.255.252
 quit
bgp {{peAs}}
 router-id 2.2.2.2
 peer 1.1.1.1 as-number {{peAs}}
 peer 1.1.1.1 connect-interface LoopBack0
 ipv4-family vpnv4
  peer 1.1.1.1 enable
  quit
 ipv4-family vpn-instance {{vrfName}}
  peer 10.2.0.2 as-number 65020
  quit
 quit` },
        { title: '验证', note: '',
          code: `display bgp vpnv4 all peer
display ip routing-table vpn-instance {{vrfName}}` }
      ],
      verify: [
        { cmd: 'display mpls ldp session', hope: 'PE1 与 PE2 的 LDP 会话状态为 Operational' },
        { cmd: 'display bgp vpnv4 all peer', hope: 'VPNv4 邻居 Established' },
        { cmd: 'display ip routing-table vpn-instance CUST-A', hope: 'PE1 上能看到对端 192.168.1.2 的明细路由，下一跳指向 PE2' },
        { cmd: 'CE1 ping CE2 的业务地址', hope: '能通' }
      ],
      pitfalls: [
        'RD 两端配成一样也能通，但多客户场景会冲突；RD 的作用是唯一化，一般按客户区分。',
        'RT 单边配错（一端 export 100:1 一端 import 200:1），路由发出去但对方收不下，表现是单向不通。',
        '接口上先配 IP 再 ip binding，地址会留在全局路由表，要 undo ip address 重配。',
        'VPNv4 邻居没 enable，MP-BGP 一条路由都不传，但普通 IPv4 邻居看起来是 Established，很有迷惑性。',
        '骨干没开 mpls ldp，VPNv4 路由能传但标签没有，数据面直接丢包——控制面通、业务不通的典型。'
      ],
      docs: {
        secs: [
          { h: '三张表都要看', p: '控制面看 BGP VPNv4 邻居和路由，转发面看 mpls lsp（标签），隔离看 vpn-instance 路由表。三张表任一缺失都会出现「邻居通但业务不通」。' },
          { h: 'eNSP 里的注意点', p: 'eNSP 的 AR 路由器支持 MPLS 和 VPNv4，但 S5700 交换机对 MPLS 的支持有限。做这个实验请全程用 AR2220/AR201。' }
        ]
      }
    },

    /* ---------------- 8. IPv6 双栈 ---------------- */
    {
      id: 'lab-ipv6-dual',
      title: 'IPv6 双栈 + OSPFv3',
      level: '进阶',
      minutes: 30,
      goal: '同一张网络同时跑 IPv4 和 IPv6，用 OSPFv3 让两端 IPv6 网段互通。',
      scene: '现网不能一刀切改成 IPv6，通常先双栈运行：原有 IPv4 业务不动，新增 IPv6 业务并行。',
      topo: {
        h: 260,
        nodes: [
          { id: 'PC1', label: 'PC1', sub: '双栈终端', t: 'pc', x: 110, y: 130 },
          { id: 'SW1', label: 'SW1', sub: '三层交换', t: 'switch', x: 390, y: 130 },
          { id: 'R1', label: 'R1', sub: '出口路由', t: 'router', x: 670, y: 130 }
        ],
        links: [
          ['PC1', 'SW1', 'VLAN 10 双栈'],
          ['SW1', 'R1', '10.0.0.0/30 + 2001:db8:0::/64']
        ]
      },
      plan: [
        { dev: 'SW1', intf: 'Vlanif10', ip: '192.168.10.1/24 + 2001:db8:10::1/64', note: '终端网关' },
        { dev: 'SW1', intf: 'Vlanif100', ip: '10.0.0.1/30 + 2001:db8:0::1/64', note: '上联 R1' },
        { dev: 'R1', intf: 'GE0/0/0', ip: '10.0.0.2/30 + 2001:db8:0::2/64', note: '接 SW1' },
        { dev: 'R1', intf: 'LoopBack0', ip: '2001:db8:100::1/64', note: '模拟远端网段' }
      ],
      vars: {
        v6Prefix: { label: '终端网段前缀', value: '2001:db8:10::', hint: '必须是 /64', desc: 'SLAAC 要求 /64，写别的长度终端拿不到地址。' },
        v6Remote: { label: '远端网段', value: '2001:db8:100::', hint: '模拟外网', desc: '用来验证 OSPFv3 是否把路由传过来了。' }
      },
      steps: [
        { title: 'SW1：全局开 IPv6 + 双栈地址', note: 'system-view 下的 ipv6 是总开关，接口上还要 ipv6 enable。',
          code: `system-view
sysname SW1
ipv6
vlan batch 10 100
interface Vlanif10
 ipv6 enable
 ipv6 address {{v6Prefix}}1/64
 undo ipv6 nd ra halt
 quit
interface Vlanif100
 ipv6 enable
 ipv6 address 2001:db8:0::1/64
 quit` },
        { title: 'R1：对端地址 + OSPFv3', note: 'OSPFv3 没有 network 命令，直接在接口上挂进程和区域。',
          code: `system-view
sysname R1
ipv6
interface GigabitEthernet0/0/0
 ipv6 enable
 ipv6 address 2001:db8:0::2/64
 ospfv3 1 area 0.0.0.0
 quit
interface LoopBack0
 ipv6 enable
 ipv6 address {{v6Remote}}1/64
 ospfv3 1 area 0.0.0.0
 quit
ospfv3 1
 router-id 1.1.1.1
 quit` },
        { title: 'SW1 也跑 OSPFv3', note: '注意 Router ID 仍是 IPv4 格式，而且必须手工配。',
          code: `interface Vlanif100
 ospfv3 1 area 0.0.0.0
 quit
ospfv3 1
 router-id 2.2.2.2
 quit` },
        { title: '验证双栈', note: '',
          code: `display ipv6 interface brief
display ospfv3 peer
display ipv6 routing-table` }
      ],
      verify: [
        { cmd: 'display ipv6 interface brief', hope: '各接口都有 link-local（fe80::）和全局地址，状态 UP' },
        { cmd: 'display ospfv3 peer', hope: 'SW1 与 R1 邻接状态为 Full' },
        { cmd: 'display ipv6 routing-table', hope: 'SW1 上能看到 2001:db8:100::/64 的 OSPFv3 路由' },
        { cmd: 'PC1 ping 2001:db8:100::1', hope: '能通；同时原 IPv4 业务不受影响' }
      ],
      pitfalls: [
        '忘了 undo ipv6 nd ra halt，终端收不到 RA，地址一直「正在获取」。',
        '前缀长度写成 /48 或 /56，SLAAC 不生效，必须 /64。',
        'OSPFv3 没配 router-id，设备上又没有 IPv4 地址时进程起不来。',
        '接口只配了全局地址没 ipv6 enable，命令直接报错。'
      ],
      docs: {
        secs: [
          { h: '双栈的真实含义', p: '不是「同时配两种地址」这么简单，而是两套协议栈完全独立运行：IPv4 用 OSPFv2，IPv6 用 OSPFv3，路由表分开维护，互不影响。' },
          { h: '为什么总要 /64', p: 'SLAAC 规定接口标识占 64 位，前缀也必须是 64 位。前缀短于 64 时地址空间浪费且标准不允许自动配置。' }
        ]
      }
    },

    /* ---------------- 9. WLAN ---------------- */
    {
      id: 'lab-wlan-basic',
      title: 'WLAN：AC + AP 上线与业务下发',
      level: '综合',
      minutes: 40,
      goal: '让 AP 通过 CAPWAP 上线到 AC，终端搜到 SSID 并拿到业务地址上网。',
      scene: '办公室无线覆盖：AC 集中管理所有 AP，配置一次模板全楼生效，不用每台 AP 单独调。',
      topo: {
        h: 260,
        nodes: [
          { id: 'AC1', label: 'AC1', sub: 'AC6005', t: 'switch', x: 110, y: 130 },
          { id: 'SW1', label: 'SW1', sub: 'PoE 接入', t: 'switch', x: 390, y: 130 },
          { id: 'AP1', label: 'AP1', sub: 'AP4050', t: 'switch', x: 660, y: 70 },
          { id: 'PC1', label: 'PC1', sub: '无线终端', t: 'pc', x: 660, y: 195 }
        ],
        links: [
          ['AC1', 'SW1', 'Trunk 100/200'],
          ['SW1', 'AP1', 'Trunk PVID 100'],
          ['AP1', 'PC1', '无线关联']
        ]
      },
      plan: [
        { dev: 'AC1', intf: 'Vlanif100', ip: '192.168.100.254/24', note: 'capwap 源接口' },
        { dev: 'SW1', intf: 'Vlanif100', ip: '192.168.100.1/24', note: 'AP 网关（DHCP）' },
        { dev: 'SW1', intf: 'GE0/0/1', ip: '—', note: 'Trunk 连 AC，放通 100/200' },
        { dev: 'SW1', intf: 'GE0/0/2', ip: '—', note: 'Trunk PVID 100 连 AP' }
      ],
      vars: {
        mgmtVlan: { label: '管理 VLAN', value: '100', hint: 'AP 与 AC 通信', desc: 'AP 从这个 VLAN 拿地址找 AC。' },
        svcVlan: { label: '业务 VLAN', value: '200', hint: '终端上网', desc: '终端地址属于这个 VLAN。' },
        ssid: { label: 'SSID', value: 'Office-WiFi', hint: '手机看到的名字', desc: '不要暴露公司名。' },
        wifiPwd: { label: 'Wi-Fi 密码', value: 'Wifi@2026', hint: '至少 8 位', desc: 'WPA2-PSK 最短 8 位。' }
      },
      steps: [
        { title: 'AC：管理地址与 CAPWAP 源', note: 'capwap source 必须在 AP 上线前配好，否则 AP 不知道自己该找谁。',
          code: `system-view
sysname AC1
vlan batch {{mgmtVlan}} {{svcVlan}}
interface Vlanif{{mgmtVlan}}
 ip address 192.168.100.254 255.255.255.0
 quit
capwap source interface Vlanif{{mgmtVlan}}` },
        { title: 'SW1：给 AP 发地址', note: 'AP 上线第一步是拿管理地址。DHCP 要在 AP 所在 VLAN 的接口上使能。',
          code: `system-view
sysname SW1
vlan batch {{mgmtVlan}} {{svcVlan}}
dhcp enable
interface Vlanif{{mgmtVlan}}
 ip address 192.168.100.1 255.255.255.0
 dhcp select interface
 quit
interface GigabitEthernet0/0/1
 port link-type trunk
 port trunk allow-pass vlan {{mgmtVlan}} {{svcVlan}}
 quit
interface GigabitEthernet0/0/2
 port link-type trunk
 port trunk pvid vlan {{mgmtVlan}}
 port trunk allow-pass vlan {{mgmtVlan}} {{svcVlan}}
 quit` },
        { title: 'AC：三个模板拼出无线网络', note: '安全模板管加密、SSID 模板管名字、VAP 模板把它们和业务 VLAN 绑起来。',
          code: `wlan
 security-profile name sec-office
  security wpa-wpa2 psk pass-phrase {{wifiPwd}} aes
  quit
 ssid-profile name ssid-office
  ssid {{ssid}}
  quit
 vap-profile name vap-office
  forward-mode tunnel
  service-vlan vlan-id {{svcVlan}}
  ssid-profile ssid-office
  security-profile sec-office
  quit
 ap-group name default
  vap-profile vap-office wlan 1 radio all
  quit
 quit` },
        { title: '确认 AP 上线', note: 'AP 重启后会主动找 AC，注意看 state 是否为 nor（normal）。',
          code: `display ap all` }
      ],
      verify: [
        { cmd: 'display ap all', hope: 'AP 的 State 为 nor，IP 是 192.168.100.x 网段' },
        { cmd: 'display vap ssid Office-WiFi', hope: '能看到 VAP 已下发，状态为 ON' },
        { cmd: 'PC1 连接 Wi-Fi', hope: '能搜到 Office-WiFi，输密码后关联成功并拿到 192.168.200.x 地址' }
      ],
      pitfalls: [
        'capwap source interface 没配或配错网段，AP 一直停在「正在获取 IP」或「寻找 AC」。',
        'VAP 模板没绑到 ap-group，AP 上线了但一条 SSID 都不广播。',
        'AP 口 trunk 没设 pvid 为管理 VLAN，AP 发出的不带标签报文落不到管理 VLAN，拿不到地址。',
        '安全模板密码少于 8 位，配置直接报错。',
        'eNSP 的 AC/AP 是简化实现，真机上还需要 license 和 AP 型号匹配，模拟器里不用管但别照搬结论。'
      ],
      docs: {
        secs: [
          { h: '上线流程四步', p: 'AP 拿 IP → 通过 DHCP Option 43 或广播找到 AC → 建 CAPWAP 隧道 → 从 AC 拉取配置。任何一步断了看 display ap all 的 State 就能定位到哪一段。' },
          { h: '隧道转发 vs 本地转发', p: 'tunnel 模式下终端流量经 CAPWAP 回 AC，策略集中但 AC 是瓶颈；local 模式下 AP 直接把流量送进业务 VLAN，性能好但每台 AP 都要配。' }
        ]
      }
    }

  );
})(window.__ENSP);
