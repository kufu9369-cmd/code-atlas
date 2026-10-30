/* ============================================================
   码典 · eNSP 入门层（设备管理 + 二层特性）
   ------------------------------------------------------------
   定位：刚装上 eNSP、能配 VLAN 和静态路由之后，接下来一定会撞上的东西。
   每条都是能直接粘进设备跑通的完整配置。
   ============================================================ */
(function (E) {
  'use strict';

  E.items.push(

    /* ---------------- 设备管理 ---------------- */
    {
      id: 'vrp-basic',
      title: 'VRP 命令行基本功',
      desc: '进视图、看配置、存盘——每天都要用的几条命令，先把它变成肌肉记忆。',
      tags: ['VRP', '命令行', '基础'],
      device: 'S5700 / AR2220 通用',
      level: '入门',
      code: `system-view
sysname {{hostname}}
quit

display version
display current-configuration | include {{keyword}}
display ip interface brief

save`,
      vars: {
        hostname: {
          label: '设备名', value: 'SW1', type: 'text',
          hint: '英文 + 数字，别用中文',
          desc: '台架上三台交换机都叫 Huawei 的时候，改完 sysname 才知道自己登的是哪一台。'
        },
        keyword: {
          label: '过滤关键字', value: 'vlan', type: 'text',
          hint: '接口名 / 协议名 / 关键字',
          desc: '整份配置几百行，| include 只留含这个词的行。查某个接口就填 GigabitEthernet0/0/1。'
        }
      },
      docs: {
        secs: [
          { h: '四个视图怎么切', p: '<Huawei> 用户视图只能查看和存盘；system-view 进系统视图才能改配置；再往下进接口视图、协议视图。quit 退一层，return 从任何位置直接退回用户视图。' },
          { h: 'display 不是 show', p: '华为用 display，抄 Cisco 的 show 在这里直接报错。最常用的三条：display version 看版本和运行时长，display current-configuration 看当前配置，display ip interface brief 一眼看所有接口的 IP 和 up/down。' },
          { h: '命令补全与帮助', p: '输入前几个字母按 Tab 自动补全，打 ? 列出当前视图能用的所有命令。记不全命令时按 ? 比查文档快。' },
          { h: 'save 之前别重启', p: '配置只在内存里，save 才写进 flash 的 vrpcfg.zip。不存盘直接 reboot，配的全部白做。' }
        ]
      }
    },

    {
      id: 'device-reset',
      title: '清空配置恢复出厂',
      desc: '实验做废了、换题目之前，把设备清干净再开始，别在脏配置上叠加。',
      tags: ['运维', '复位', '基础'],
      device: 'S5700 / AR2220 通用',
      level: '入门',
      code: `reset saved-configuration
reboot`,
      vars: {},
      docs: {
        secs: [
          { h: '两次都问 Y/N，第二次必须答 N', p: 'reset saved-configuration 会问「Continue? [Y/N]」，答 y；紧接着 reboot 会问「是否保存当前配置」，这里必须答 n，选了 y 等于把刚删掉的又存回去。' },
          { h: '只清配置，不动文件', p: 'flash 里的日志、License、补丁文件都还在，清的只是下次启动加载的配置文件（vrpcfg.zip）。' },
          { h: 'AR 路由器还要清接口', p: '如果之前改过接口 IP 又想彻底干净，reset 之后建议顺手 reboot 一次让接口恢复默认，别在残留配置上排查问题。' }
        ]
      }
    },

    {
      id: 'cfg-backup-ftp',
      title: '配置备份与恢复（FTP）',
      desc: '改配置前先存一份到电脑上，改崩了 30 秒回滚，比重新配一遍快得多。',
      tags: ['运维', '备份', 'FTP'],
      device: 'S5700 / AR2220 通用',
      level: '入门',
      code: `system-view
ftp client source-interface {{srcIntf}}
quit
ftp {{serverIp}}
{{userName}}
{{password}}
put vrpcfg.zip {{backupName}}
quit`,
      vars: {
        srcIntf: {
          label: '出接口', value: 'Vlanif10', type: 'text',
          hint: '有 IP、能到服务器的接口',
          desc: '不指定源接口时设备可能用自己的管理地址出去，服务器侧的 ACL 会拦掉，表现为一直卡在连接。'
        },
        serverIp: {
          label: 'FTP 服务器', value: '192.168.10.100', type: 'text',
          hint: '电脑的 IP（电脑上要开 FTP）',
          desc: 'eNSP 里通常就是你的本机地址，注意 VMware/VirtualBox 的虚拟网卡别选错网段。'
        },
        userName: { label: '用户名', value: 'admin', type: 'text', hint: 'FTP 账号', desc: '电脑上 FTP 服务端建的账号，不是设备本地账号。' },
        password: { label: '密码', value: 'Admin@123', type: 'text', hint: 'FTP 密码', desc: '明文会显示在配置里；正式环境建议改用 SFTP 或临时账号。' },
        backupName: {
          label: '备份文件名', value: 'SW1-20261027.zip', type: 'text',
          hint: '建议 设备名-日期',
          desc: '带上日期才知道哪份是最新的；恢复时直接引用这个文件名。'
        }
      },
      variants: [
        {
          id: 'backup',
          label: '备份到服务器',
          code: `system-view
ftp client source-interface {{srcIntf}}
quit
ftp {{serverIp}}
{{userName}}
{{password}}
put vrpcfg.zip {{backupName}}
quit`
        },
        {
          id: 'restore',
          label: '从服务器恢复',
          code: `system-view
ftp client source-interface {{srcIntf}}
quit
ftp {{serverIp}}
{{userName}}
{{password}}
get {{backupName}} vrpcfg.zip
quit
reboot`
        }
      ],
      docs: {
        secs: [
          { h: 'put 和 get 的方向', p: '站在设备的角度：put 是设备把文件上传到服务器（备份），get 是从服务器把文件下载回设备（恢复）。别搞反。' },
          { h: '恢复后必须重启', p: 'get 覆盖的是 vrpcfg.zip，只有重启加载才生效。重启时如果问是否保存当前配置，答 n。' },
          { h: '连不上先查这三处', p: '① 电脑防火墙拦了 21 端口；② 设备没有到服务器的路由；③ FTP 服务端只允许本地用户登录。eNSP 里最常见的是第一条。' }
        ]
      }
    },

    {
      id: 'ntp-client',
      title: 'NTP 时间同步',
      desc: '全网设备时间对了，日志和抓包才能对上时序，排障起码省一半时间。',
      tags: ['运维', 'NTP', '时间'],
      device: 'S5700 / AR2220 通用',
      level: '入门',
      code: `system-view
clock timezone {{tzName}} add {{offset}}
ntp-service unicast-server {{serverIp}} source-interface {{srcIntf}}
quit
display ntp-service status`,
      vars: {
        tzName: { label: '时区名', value: 'CST', type: 'text', hint: '自定义名称', desc: '只是显示用的标签，写 CST 或 BJ 都行。' },
        offset: { label: '时区偏移', value: '08:00:00', type: 'text', hint: 'HH:MM:SS', desc: '北京时间是加 8 小时。设备默认 UTC，不设时区日志会比实际差 8 小时。' },
        serverIp: { label: 'NTP 服务器', value: '192.168.10.100', type: 'text', hint: '内网 NTP 或公网时间源', desc: '内网建议指向核心交换机或域控，不要所有设备都去连公网。' },
        srcIntf: { label: '源接口', value: 'Vlanif10', type: 'text', hint: '带 IP 的管理接口', desc: '指定源接口后回程路由才确定，否则交换机多出口时容易同步失败。' }
      },
      docs: {
        secs: [
          { h: '看到什么算成功', p: 'display ntp-service status 里 clock status 显示 synchronized， stratum 不再是 16。刚配完要等十几秒，别急着判定失败。' },
          { h: '和 sysname 一样重要', p: '两台设备日志时间差 8 小时，A 报的故障在 B 上找不到对应记录。做任何联调实验前先把这个配了。' }
        ]
      }
    },

    {
      id: 'syslog-server',
      title: '日志上报到 Syslog 服务器',
      desc: '设备重启、接口 down、配置被改，都会主动送到服务器留档。',
      tags: ['运维', '日志', 'Syslog'],
      device: 'S5700 / AR2220 通用',
      level: '入门',
      code: `info-center enable
info-center loghost {{serverIp}} channel 2
info-center source default channel 2 log level {{level}}
quit
display info-center`,
      vars: {
        serverIp: { label: '日志服务器', value: '192.168.10.100', type: 'text', hint: '接收 UDP 514', desc: '电脑上跑个 Syslog 接收器（如 3CDaemon）就能收，eNSP 里很适合抓设备重启原因。' },
        level: {
          label: '日志级别', value: 'warning', type: 'text',
          hint: 'debugging / informational / warning / error',
          desc: 'warning 只报问题和变更，够日常用；调协议时临时改成 debugging，不然关键报文细节看不到。'
        }
      },
      docs: {
        secs: [
          { h: 'channel 2 是什么', p: 'VRP 的日志有 8 个通道，通道 2 专门给日志服务器用。不写 channel 默认走控制台，服务器一条也收不到。' },
          { h: '级别是「包含以上」', p: '设成 warning 表示 warning 以及比它更严重的 error、critical 都会发。想让调试信息也上来就设 debugging，代价是量大。' }
        ]
      }
    },

    {
      id: 'snmp-v3',
      title: 'SNMPv3 只读监控',
      desc: '给监控平台开一个带认证加密的只读账号，别再用 v2c 的 public 明文团体名。',
      tags: ['运维', 'SNMP', '监控', '安全'],
      device: 'S5700 / AR2220 通用',
      level: '入门',
      code: `snmp-agent
snmp-agent sys-info version v3
snmp-agent group v3 {{groupName}} privacy read-view iso-view write-view iso-view notify-view iso-view
snmp-agent usm-user v3 {{userName}} group {{groupName}}
snmp-agent usm-user v3 {{userName}} authentication-mode sha {{authPwd}} privacy-mode aes128 {{privPwd}}
snmp-agent target-host trap address udp-domain {{nmsIp}} params securityname {{userName}} v3 privacy`,
      vars: {
        groupName: { label: '组名', value: 'monitor', type: 'text', hint: '英文', desc: '权限按组分配，同一组里的用户权限一致。' },
        userName: { label: '用户名', value: 'nms', type: 'text', hint: '监控平台里填这个', desc: 'v3 不再用团体名，认证靠用户名 + 密码。' },
        authPwd: { label: '认证密码', value: 'Auth@12345', type: 'text', hint: '至少 8 位', desc: '只验身份，不加密数据。太短会报错，VRP 要求不少于 8 位。' },
        privPwd: { label: '加密密码', value: 'Priv@12345', type: 'text', hint: '至少 8 位', desc: 'privacy 模式下数据加密，抓包也看不到内容。' },
        nmsIp: { label: '网管服务器', value: '192.168.10.100', type: 'text', hint: '接收 Trap 的地址', desc: '只收不主动查也能配 Trap，设备出事件会主动推。' }
      },
      docs: {
        secs: [
          { h: 'v3 的三档安全级别', p: 'noAuthNoPriv 只认用户名；authNoPriv 验密码不加密；authPriv 既验密码又加密。生产环境用 authPriv，抓包看不到内容。' },
          { h: '为什么 read-view 和 write-view 都写 iso-view', p: 'iso-view 是默认视图，含绝大多数 MIB 节点。只想给只读权限的话，write-view 其实不给也行，但很多网管平台会探测写权限，配齐更省事。' },
          { h: 'eNSP 里的限制', p: 'eNSP 设备对 SNMP 的支持是简化版，私有 MIB 大多取不到。练命令行和权限模型够用，别指望在模拟器里调通完整网管。' }
        ]
      }
    },

    {
      id: 'ssh-hardening',
      title: 'SSH 登录加固',
      desc: '关掉 telnet、只留 SSH、限制源网段、加空闲超时——接入设备开局的必做四件事。',
      tags: ['安全', 'SSH', 'AAA', '开局'],
      device: 'S5700 / AR2220 通用',
      level: '入门',
      code: `stelnet server enable
ssh user {{userName}} authentication-type password
ssh user {{userName}} service-type stelnet
aaa
 local-user {{userName}} password irreversible-cipher {{password}}
 local-user {{userName}} privilege level 15
 local-user {{userName}} service-type ssh
 quit
acl number 2000
 rule 5 permit source {{adminNet}} {{adminWildcard}}
 quit
user-interface vty 0 4
 authentication-mode aaa
 protocol inbound ssh
 acl 2000 inbound
 idle-timeout {{idleMin}} 0
 quit`,
      vars: {
        userName: { label: '管理员账号', value: 'netadmin', type: 'text', hint: '别用 admin', desc: '默认猜得到的账号是暴力破解的第一目标，换个不常见的名字。' },
        password: { label: '密码', value: 'Netadm@2026', type: 'text', hint: '12 位以上，含大小写数字符号', desc: 'irreversible-cipher 存的是不可逆摘要，配置文件里看不到明文。' },
        adminNet: { label: '允许登录网段', value: '192.168.10.0', type: 'text', hint: '管理网段', desc: '只让管理网段能 SSH，办公网和访客网直接连不上。' },
        adminWildcard: { label: '反掩码', value: '0.0.0.255', type: 'text', hint: '0 表示必须匹配', desc: 'ACL 用的是反掩码：/24 对应 0.0.0.255，单个 IP 对应 0.0.0.0。' },
        idleMin: { label: '空闲超时（分钟）', value: '10', type: 'int', min: 1, max: 120, hint: '5–15 比较合适', desc: '终端忘了关就一直挂着，超时自动断开，减少被利用的窗口。' }
      },
      docs: {
        secs: [
          { h: '四步缺一不可', p: 'stelnet server enable 开服务；ssh user 指定该账号用 SSH 登录；aaa 里建本地用户并给权限；vty 上把认证方式改成 aaa 并且只允许 ssh 协议。只做前两步是最常见的半成品——服务开了照样登不上。' },
          { h: '为什么还要 ACL', p: 'SSH 本身有密码保护，但暴露在办公网里等于给爆破留了个入口，日志里会看到成片的失败记录。acl 2000 inbound 挂在 vty 上，源地址不在白名单直接拒绝，连密码都不用输。' },
          { h: 'privilege level 15 的代价', p: '15 是最高权限，能改任何配置包括再建账号。只做查看的账号给 level 1，别为了省事全给 15。' },
          { h: 'telnet 怎么彻底关', p: 'vty 上写了 protocol inbound ssh 之后 telnet 就进不来了；如果之前单独开过 telnet server enable，再补一条 undo telnet server enable。' }
        ]
      }
    },

    /* ---------------- 二层进阶特性 ---------------- */
    {
      id: 'vlan-qinq',
      title: 'QinQ 双层 VLAN 标签',
      desc: '运营商/园区汇聚常用的做法：接入侧打一层私网标签，上行再套一层公网标签。',
      tags: ['VLAN', 'QinQ', '二层'],
      device: 'S5700',
      level: '进阶',
      code: `interface GigabitEthernet0/0/1
 port link-type dot1q-tunnel
 port default vlan {{svlan}}
 quit
interface GigabitEthernet0/0/24
 port link-type trunk
 port trunk allow-pass vlan {{svlan}}
 quit`,
      vars: {
        svlan: { label: '外层 VLAN', value: '100', type: 'int', min: 1, max: 4094, hint: '1–4094', desc: '客户侧带进来的标签原样保留当内层，交换机再统一套上这一层。每个客户/楼栋分配一个不同的外层 VLAN。' }
      },
      docs: {
        secs: [
          { h: 'dot1q-tunnel 就是以前的 QinQ 口', p: '接口设成 dot1q-tunnel 后，收到的带标签报文不再按标签转发表转发，而是整个帧当成数据，再套上 port default vlan 指定的外层标签。所以不同客户的相同 VLAN ID 不会互相串。' },
          { h: '外层 VLAN 必须逐段放通', p: '上行 trunk 要 allow-pass 外层 VLAN，中间经过的每一台设备都要放通，漏一台就断。' },
          { h: 'MTU 会变大', p: '多了一层 4 字节标签，大包可能被丢。跨设备长距离传输时留意 MTU 不一致导致的「小包通、大包不通」。' }
        ]
      }
    },

    {
      id: 'super-vlan',
      title: 'Super VLAN（VLAN 聚合）',
      desc: '几十个小 VLAN 只用一个网关地址，省 IP 又省 Vlanif 接口——但 VLAN 之间默认不通。',
      tags: ['VLAN', 'Super VLAN', '网关'],
      device: 'S5700',
      level: '进阶',
      code: `vlan batch {{superVlan}} {{subVlans}}
vlan {{superVlan}}
 aggregate-vlan
 access-vlan {{subVlans}}
 quit
interface Vlanif{{superVlan}}
 ip address {{gateway}} {{mask}}
 arp-proxy enable
 quit`,
      vars: {
        superVlan: { label: 'Super VLAN', value: '100', type: 'int', min: 1, max: 4094, hint: '只做网关，不接物理口', desc: '这个 VLAN 本身不承载业务，纯粹用来当聚合容器。' },
        subVlans: { label: '子 VLAN 列表', value: '10 20 30', type: 'text', hint: '空格分隔', desc: '真正接终端的 VLAN。每个子 VLAN 都归到 Super VLAN 下面，共用同一个网关。' },
        gateway: { label: '网关地址', value: '192.168.1.1', type: 'text', hint: '所有子 VLAN 共用', desc: '本来要 3 个网段 3 个网关，现在一个地址搞定，代价是子 VLAN 之间二层隔离。' },
        mask: { label: '子网掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '掩码要盖住所有子 VLAN 的地址范围。' }
      },
      docs: {
        secs: [
          { h: 'arp-proxy 不能省', p: '子 VLAN 的终端网关都指向 Super VLAN 的地址，跨子 VLAN 访问时设备要做 ARP 代理，把这台设备的 MAC 回给对方。不开 arp-proxy，终端 ARP 不到网关，表现就是「IP 配了但 ping 不通网关」。' },
          { h: '子 VLAN 之间默认隔离', p: '这正是 Super VLAN 的用途——比如一栋楼每个房间一个 VLAN，房间之间本来就不该互通，却又要共用 192.168.1.0/24 这个网段。要互通得改成 MUX VLAN 的 group 角色，或者干脆用普通 VLAN + 三层转发。' },
          { h: '子 VLAN 不能有 Vlanif', p: '给子 VLAN 配 Vlanif 会跟 Super VLAN 的地址冲突，报「地址重叠」。' }
        ]
      }
    },

    {
      id: 'mux-vlan',
      title: 'MUX VLAN（主从 VLAN 隔离）',
      desc: '一个主 VLAN 下分「互通组」和「隔离组」：组内能互访，隔离组之间完全看不见。',
      tags: ['VLAN', 'MUX VLAN', '隔离'],
      device: 'S5700',
      level: '进阶',
      code: `vlan batch {{principalVlan}} {{groupVlan}} {{separateVlan}}
vlan {{principalVlan}}
 mux-vlan
 subordinate group {{groupVlan}}
 subordinate separate {{separateVlan}}
 quit
interface GigabitEthernet0/0/1
 port link-type access
 port default vlan {{principalVlan}}
 port mux-vlan enable
 quit`,
      vars: {
        principalVlan: { label: '主 VLAN', value: '100', type: 'text', hint: '上联/服务器所在', desc: '主 VLAN 里的设备能和下面所有组通信，通常是网关或服务器侧。' },
        groupVlan: { label: '互通组 VLAN', value: '101', type: 'text', hint: '组内可以互访', desc: '比如同一个部门的几台打印机，彼此需要通。' },
        separateVlan: { label: '隔离组 VLAN', value: '102', type: 'text', hint: '互相完全隔离', desc: '比如客房、自习室，只能访问主 VLAN，彼此之间连 ARP 都不通。' }
      },
      docs: {
        secs: [
          { h: '和端口隔离的区别', p: '端口隔离是「接口级」的，同一 VLAN 内两两隔离；MUX VLAN 是「VLAN 级」的，可以按角色分组——一组互相通、另一组完全隔离，而且能跨设备。' },
          { h: 'port mux-vlan enable 必须加', p: '只在 VLAN 里定义角色没用，接终端的每个接口都要开 mux-vlan enable，否则那个口还是按普通 VLAN 转发。' },
          { h: '一个主 VLAN 只能有一个 group 和一个 separate', p: '想分多个互通组要用不同的主 VLAN。' }
        ]
      }
    },

    {
      id: 'dhcp-snooping',
      title: 'DHCP Snooping 防私接路由器',
      desc: '有人插个家用路由器当 DHCP 服务器，全网拿到 192.168.1.x 就废了。这条配置把非法应答拦在接入侧。',
      tags: ['DHCP', '安全', '接入'],
      device: 'S5700',
      level: '进阶',
      code: `dhcp enable
dhcp snooping enable
interface GigabitEthernet0/0/24
 dhcp snooping enable
 dhcp snooping trusted
 quit
interface GigabitEthernet0/0/1
 dhcp snooping enable
 quit
display dhcp snooping user-bind all`,
      vars: {},
      docs: {
        secs: [
          { h: 'trusted 只给上行口', p: '交换机的 DHCP 应答（offer/ack）只允许从 trusted 口进来。接终端的口全部保持 untrusted，私接的路由器发出来的 offer 会被直接丢弃。' },
          { h: '必须全局先开', p: 'dhcp snooping enable 是总开关，只在接口上开不生效。这是最常见的配了没效果的原因。' },
          { h: '绑定表是后面两个特性的基础', p: 'IPSG 和 DAI 都要读这张「IP-MAC-接口-VLAN」绑定表。Snooping 不开，那两个也用不了。' }
        ]
      }
    },

    {
      id: 'ipsg',
      title: 'IPSG 源 IP 防护',
      desc: '终端私自改 IP 就上不了网——按绑定表逐包检查源 IP 和 MAC 是否对得上。',
      tags: ['安全', 'IPSG', 'IP 防伪'],
      device: 'S5700',
      level: '进阶',
      code: `dhcp snooping enable
interface GigabitEthernet0/0/1
 dhcp snooping enable
 ip source check user-bind enable
 quit`,
      vars: {
        ip: {
          label: '静态绑定的 IP', value: '192.168.10.10', type: 'text',
          hint: '固定 IP 设备的地址',
          desc: '只在「静态绑定」分支用到。服务器、打印机这类手配 IP 的设备必须静态登记，否则开了 IPSG 立刻断网。'
        },
        mac: {
          label: '设备 MAC', value: '5489-98aa-bb01', type: 'text',
          hint: '华为格式 xxxx-xxxx-xxxx',
          desc: '从设备标签或 display arp 里取，写错就绑不上，表现为这台机器一直不通。'
        },
        vlan: {
          label: '所属 VLAN', value: '10', type: 'int', min: 1, max: 4094,
          hint: '接口所在 VLAN',
          desc: '绑定表按 IP+MAC+接口+VLAN 四元组生效，VLAN 填错同样不匹配。'
        }
      },
      variants: [
        {
          id: 'dynamic',
          label: '动态（依赖 DHCP）',
          code: `dhcp snooping enable
interface GigabitEthernet0/0/1
 dhcp snooping enable
 ip source check user-bind enable
 quit`
        },
        {
          id: 'static',
          label: '静态绑定',
          code: `user-bind static ip-address {{ip}} mac-address {{mac}} interface GigabitEthernet0/0/1 vlan {{vlan}}
interface GigabitEthernet0/0/1
 ip source check user-bind enable
 quit`
        }
      ],
      docs: {
        secs: [
          { h: '绑定表从哪来', p: '动态方式靠 DHCP Snooping 自动学；静态方式手工写 user-bind static。服务器、打印机这类固定 IP 的设备必须用静态绑定，否则一开机就被拦。' },
          { h: '典型的「配完全断网」', p: '只给部分接口开了 IPSG，却用静态绑定漏了几台设备，那几台直接不通。上线前先把所有固定 IP 设备登记完，或者在非业务时间做。' },
          { h: '和端口安全一起用', p: 'port-security 管的是「一个口能学几个 MAC」，IPSG 管的是「这个 IP 是不是它的」。两者互补，不冲突。' }
        ]
      }
    },

    {
      id: 'stp-protect',
      title: '生成树三种保护',
      desc: 'BPDU 保护防私接交换机、根保护防抢根、边缘端口让接电脑的口秒通。',
      tags: ['STP', '二层', '保护'],
      device: 'S5700',
      level: '进阶',
      code: `stp mode rstp
stp bpdu-protection
interface GigabitEthernet0/0/1
 stp edged-port enable
 quit
interface GigabitEthernet0/0/2
 stp root-protection
 quit`,
      vars: {},
      docs: {
        secs: [
          { h: 'edged-port 是什么', p: '接终端的口不是交换机，不会参与生成树计算。设成边缘端口后插上网线立刻转发，不用等 30 秒的 listening/learning。代价是：如果这个口真的接了交换机，会形成环路。' },
          { h: 'bpdu-protection 的暴力执法', p: '全局开启后，边缘端口一旦收到 BPDU 就自动 shutdown 并告警。这正是它的价值（防私接），但接了自己人的小交换机也会被关，排障时要记得手动 undo shutdown。' },
          { h: 'root-protection 放在根桥的指定口', p: '在核心交换机上，朝下的接口开 root-protection。有人把优先级调成 0 来抢根，这些口会保持 discarding，抢不走根。注意方向别搞反：放在根桥的「上游」口会把自己搞成不通。' }
        ]
      }
    },

    {
      id: 'loop-detect',
      title: '环路检测（Loop Detection）',
      desc: '不跑 STP 的小网络（或 STP 收敛前）用这个快速发现并阻断环路。',
      tags: ['环路', '二层', '检测'],
      device: 'S5700',
      level: '进阶',
      code: `loop-detection enable
loop-detection action {{action}}
interface GigabitEthernet0/0/1
 loop-detection enable
 quit`,
      vars: {
        action: {
          label: '检测到环路后的动作', value: 'block', type: 'text',
          hint: 'block / shutdown / no-learning / alarm',
          desc: 'block 只阻断该 VLAN 的转发，其他 VLAN 不受影响；shutdown 直接关接口，恢复要人工 undo；alarm 只告警不阻断，适合先观察再下手。'
        }
      },
      docs: {
        secs: [
          { h: '它靠什么判断', p: '从接口发出带本设备标识的检测报文，如果又从别的口收回来了，说明中间有环。和 STP 的思路相反——STP 是预防，它是事后发现。' },
          { h: '什么时候用它', p: '小型网络、临时接线、或者根本不该有环的接入层。真想防环还是得靠 STP，环路检测是兜底。' }
        ]
      }
    },

    {
      id: 'port-mirror',
      title: '端口镜像抓包',
      desc: '把某个口的流量复制到观察口，电脑接上去用 Wireshark 就能看到真实报文。',
      tags: ['抓包', '排障', '镜像'],
      device: 'S5700',
      level: '进阶',
      code: `observe-port 1 interface GigabitEthernet0/0/24
interface GigabitEthernet0/0/1
 port-mirroring to observe-port 1 {{direction}}
 quit`,
      vars: {
        direction: {
          label: '镜像方向', value: 'both', type: 'text',
          hint: 'inbound / outbound / both',
          desc: 'inbound 只看进入这个口的流量，outbound 只看出去的。双向都抓时观察口的带宽要够，否则会因为拥塞丢包，抓出来的现象反而误导人。'
        }
      },
      docs: {
        secs: [
          { h: '观察口不要配业务', p: '被设成 observe-port 的接口不能再当普通数据口用，否则镜像流量和业务流量混在一起。单独留一个口专做抓包。' },
          { h: 'eNSP 里的用法', p: '在 eNSP 里接一台 PC，用 Packet Capture 抓这个口同样可行；但镜像能抓到的还包括本机 CPU 转发的报文，比软件抓包更接近真实。' }
        ]
      }
    }

  );
})(window.__ENSP);
