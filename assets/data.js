/* ============================================================
   码典 CodeAtlas — 数据层
   ------------------------------------------------------------
   想加内容只改这个文件，不用碰 app.js。

   片段（snippet）写法：
   {
     id:      'vlan-create',            // 全局唯一
     title:   '创建 VLAN 并命名',
     desc:    '一句话说明它解决什么问题',
     tags:    ['VLAN','二层'],
     device:  'S5700 / S3700',          // 适用设备/环境
     level:   '入门',
     code:    `...{{vlanId}}...`,        // {{变量名}} 就是「自主配置区」
     vars: {
       vlanId: { label:'VLAN 编号', value:'10',
                 hint:'1–4094', desc:'为什么这么填',
                 type:'int', min:1, max:4094, multiline:false }
     },
     variants: [                        // 可选：代码级分支（工具栏小胶囊）
       { id:'list', label:'指定 VLAN', code:`...`, vars:{...} }
     ],
     docs: {                            // 可选：官方解答
       secs: [ { h:'标题', p:'段落' }, { h:'标题', ul:['点1','点2'] } ],
       src:  { n:'来源名', u:'链接' }
     },
     flow: 'vlan-decision'              // 可选：关联的工作流
   }

   预设（preset）= 一整套代码，点进去是多个片段串起来的完整配置。
   工作流（flow）= 决策树 / 排查树，节点可展开，children 连成图。
   ============================================================ */

window.CODEATLAS = {

  meta: {
    name: '码典',
    en: 'CodeAtlas',
    version: '1.1.3',
    tagline: '可配置的代码大全'
  },

  /* ---------- 语法高亮关键字 ---------- */
  keywords: [
    // 华为 VRP
    'system-view','quit','save','undo','display','reset','vlan','batch','description','interface',
    'port','link-type','access','trunk','hybrid','allow-pass','pvid','default','dhcp','enable',
    'ip','pool','network','mask','gateway-list','dns-list','lease','day','excluded-ip-address',
    'address','static-bind','ospf','router-id','area','acl','number','rule','permit','deny','source',
    'destination','traffic-filter','inbound','outbound','nat','route-static','shutdown','edged-port',
    'stp','eth-trunk','mode','lacp-static','telnet','user-interface','authentication-mode','protocol',
    'aaa','local-user','password','service-type','ssh','destination-port','eq','mask-length',
    // Linux / Shell
    'sudo','systemctl','apt','install','grep','chmod','chown','tar','ssh','ssh-keygen','ssh-copy-id',
    'ss','netstat','nginx','restart','status','enable','daemon-reload',
    // SQL
    'create','table','primary','key','not','null','engine','charset','collate','select','from',
    'where','insert','into','values','auto_increment','comment','unique','index','order','by',
    'group','limit','join','on','user','grant','privileges','to','flush','identified',
    // Python
    'def','return','import','for','in','print','if','elif','else','while','with','as','class',
    'try','except','raise','str','int','list','dict',
    // 新增：Hybrid / 单臂路由 / VRRP / 聚合 / STP / SSH / 端口安全
    'hybrid','dot1q','termination','arp','vrrp','vrid','priority','stp','bpdu-protection',
    'stelnet','privilege','port-security','max-mac-num','protect-action','sticky','global',
    'inside','irreversible-cipher','root','secondary','eth-trunk',
    // 新增：SQL / Linux / Git
    'explain','limit','offset','join','update','delete','drop','alter',
    'mysqldump','mysql','docker','df','du','find','ufw','firewall-cmd','firewall','reload',
    'journalctl','lsof','df','sort','head','tail','grep','curl',
    'commit','revert','rebase','stash','merge','push','pull','clone','checkout','restore',
    'switch','branch','remote','origin','staged','diff-filter','git','diff','add','status','pop'
  ],

  /* ---------- 命令词典：点代码里的命令，弹出官方口径解释 ---------- */
  cmd: {
    'system-view': { p:'从<用户视图>进入<系统视图>。华为设备所有配置命令都必须在这个视图或其子视图里执行。', eg:'system-view' },
    'quit':        { p:'返回上一级视图。在系统视图下执行退回用户视图——只有回到用户视图才能 save。', eg:'quit' },
    'save':        { p:'把当前运行配置写入启动配置（vrpcfg.zip）。不执行 save，断电或重启后配置全部丢失。', eg:'save' },
    'undo':        { p:'撤销配置的标准前缀：undo + 原命令。例如 undo shutdown 是开启端口。', eg:'undo shutdown' },
    'display':     { p:'查询类命令前缀，只读不改配置。排障第一步几乎都是 display。', eg:'display current-configuration' },
    'vlan':        { p:'创建 VLAN 并进入 VLAN 视图。VLAN 已存在时直接进入视图，不会重复创建。', eg:'vlan 10' },
    'batch':       { p:'与 vlan 连用一次性创建多个：vlan batch 10 20 30，或 vlan batch 10 to 20。', eg:'vlan batch 10 to 20' },
    'description': { p:'给 VLAN / 接口加备注。只影响可读性，不参与转发。排障时能省很多时间。', eg:'description office' },
    'interface':   { p:'进入接口视图。interface Vlanif 10 进入的是三层 VLAN 接口（SVI），不是物理口。', eg:'interface Vlanif 10' },
    'link-type':   { p:'端口链路类型，三种：access 接终端、trunk 接交换机、hybrid 混合。改类型会清掉原有 VLAN 配置。', eg:'port link-type trunk' },
    'access':      { p:'Access 口只属于一个 VLAN，发出的帧不带 tag，接 PC / 打印机这类终端。', eg:'port link-type access' },
    'trunk':       { p:'Trunk 口承载多个 VLAN，帧带 802.1Q tag，用于交换机之间、交换机与路由器之间。', eg:'port link-type trunk' },
    'allow-pass':  { p:'Trunk 口放通哪些 VLAN。注意：不写这一行，Trunk 只放通 VLAN 1，其他 VLAN 全被丢。', eg:'port trunk allow-pass vlan 10 20 30' },
    'pvid':        { p:'端口默认 VLAN。收到 untagged 帧时归到这个 VLAN，对端是 Access 口时经常要配。', eg:'port trunk pvid vlan 10' },
    'default':     { p:'与 vlan 连用：port default vlan 10 把 Access 口划进 VLAN 10。', eg:'port default vlan 10' },
    'address':     { p:'ip address 给接口配 IP 和掩码。三层口、VLANIF、Loopback 都用它。', eg:'ip address 192.168.10.1 255.255.255.0' },
    'dhcp':        { p:'dhcp enable 全局开启 DHCP 服务。不开这一条，地址池配了也不生效——最高频的坑。', eg:'dhcp enable' },
    'pool':        { p:'ip pool NAME 创建全局地址池并进入池视图，后续 network / gateway-list 都在这里配。', eg:'ip pool vlan10' },
    'network':     { p:'两个用途：地址池里表示网段；OSPF 里 network 用来宣告哪些网段参与路由。', eg:'network 192.168.10.0 mask 255.255.255.0' },
    'mask':        { p:'子网掩码。地址池里写点分十进制（255.255.255.0），OSPF 里写通配符（0.0.0.255）。', eg:'mask 255.255.255.0' },
    'gateway-list':{ p:'下发给终端的默认网关。一般就是对应 VLANIF 的地址。', eg:'gateway-list 192.168.10.1' },
    'dns-list':    { p:'下发给终端的 DNS 服务器，可写多个，空格分隔。', eg:'dns-list 114.114.114.114 8.8.8.8' },
    'excluded-ip-address': { p:'从地址池里排除的地址。网关、服务器、打印机这些要留出来，否则会被分给 PC 造成冲突。', eg:'excluded-ip-address 192.168.10.1 192.168.10.10' },
    'lease':       { p:'租期。lease day 3 表示 3 天，也支持 day 0 hour 8 minute 0 这种精细写法。', eg:'lease day 3' },
    'ospf':        { p:'启动 OSPF 进程并进入 OSPF 视图。进程号本地有效，两台设备可以不同。', eg:'ospf 1 router-id 1.1.1.1' },
    'router-id':   { p:'OSPF 路由器标识，格式像 IP。建议手动指定为 Loopback0 地址，否则可能因接口变化而重算。', eg:'router-id 1.1.1.1' },
    'area':        { p:'OSPF 区域。单区域就用 area 0（骨干区域），所有非骨干区域最终都要挂在 area 0 上。', eg:'area 0' },
    'acl':         { p:'acl number 2000–2999 是基本 ACL（只匹配源），3000–3999 是高级 ACL（可匹配协议/端口/目的）。', eg:'acl number 3000' },
    'rule':        { p:'ACL 规则。编号小的先匹配，命中即停。所以 permit / deny 的先后顺序决定结果。', eg:'rule 5 permit tcp source ...' },
    'permit':      { p:'允许匹配到的流量。', eg:'rule 5 permit ip' },
    'deny':        { p:'拒绝匹配到的流量。ACL 末尾有一条隐式 deny any，别忘。', eg:'rule 10 deny ip' },
    'source':      { p:'匹配源地址 + 通配符掩码。通配符是掩码取反：/24 → 0.0.0.255。', eg:'source 192.168.10.0 0.0.0.255' },
    'traffic-filter': { p:'在接口上调用 ACL 做流量过滤，需要指定方向 inbound / outbound。', eg:'traffic-filter inbound acl 3000' },
    'nat':         { p:'NAT 相关。nat outbound 加在出接口上，让内网地址在出去时被转换。', eg:'nat outbound 2000' },
    'outbound':    { p:'出方向。nat outbound 2000 = 内网出外网时用 ACL 2000 的地址做转换（Easy IP）。', eg:'nat outbound 2000' },
    'route-static':{ p:'静态路由：ip route-static 目的网段 掩码 下一跳。默认路由就是 0.0.0.0 0.0.0.0。', eg:'ip route-static 0.0.0.0 0.0.0.0 192.168.1.1' },
    'edged-port':  { p:'STP 边缘端口，接终端时用。不参与生成树计算，链路一上来就转发，避免 PC 等 30 秒。', eg:'stp edged-port enable' },
    'eth-trunk':   { p:'链路聚合逻辑口。把多条物理链路绑成一个，带宽叠加 + 冗余。', eg:'interface Eth-Trunk 1' },
    'destination-port': { p:'高级 ACL 匹配目的端口，常与 eq 连用：destination-port eq 80。', eg:'destination-port eq 443' },
    'sudo':        { p:'以超级用户权限执行单条命令。', eg:'sudo systemctl restart nginx' },
    'systemctl':   { p:'systemd 服务管理：start / stop / restart / enable / status / daemon-reload。', eg:'systemctl status nginx' },
    'ssh-keygen':  { p:'生成 SSH 密钥对，默认写到 ~/.ssh/。推荐 -t ed25519，比 RSA 更短更安全。', eg:'ssh-keygen -t ed25519' },
    'chmod':       { p:'改权限。755 = 属主 rwx、组 rx、其他 rx；644 = 属主 rw、其他人只读。', eg:'chmod 755 deploy.sh' },
    'create':      { p:'创建类语句。CREATE TABLE / CREATE USER。', eg:'CREATE TABLE users (...)' },
    'engine':      { p:'指定存储引擎。InnoDB 支持事务和行锁，99% 的场景都用它。', eg:'ENGINE=InnoDB' },
    'charset':     { p:'字符集。utf8mb4 才是完整的 UTF-8（支持 emoji），不要用 utf8。', eg:'DEFAULT CHARSET=utf8mb4' },

    /* --- 第二批：Hybrid / 单臂路由 / VRRP / 聚合 / STP / SSH / 端口安全 --- */
    'hybrid':      { p:'port link-type hybrid：Hybrid 口是 Access 和 Trunk 的超集，可以精确控制哪些 VLAN 发出去带 tag、哪些不带。', eg:'port link-type hybrid' },
    'dot1q':       { p:'dot1q termination vid X：让子接口只接收指定 VLAN 的 tag 帧并剥掉 tag，是单臂路由的核心命令。', eg:'dot1q termination vid 10' },
    'termination': { p:'终止。dot1q termination 表示在子接口上终结 802.1Q 标签。', eg:'dot1q termination vid 10' },
    'arp':         { p:'arp broadcast enable 让接口能收发 ARP 广播。单臂路由子接口不配这一行，表现就是网关通、终端不通。', eg:'arp broadcast enable' },
    'vrrp':        { p:'虚拟路由冗余协议。两台设备共用一个虚拟 IP 和虚拟 MAC，主设备故障时备设备接管。', eg:'vrrp vrid 10 virtual-ip 192.168.10.1' },
    'vrid':        { p:'VRRP 组号（1–255）。同一网段内不能冲突，建议和 VLAN 号呼应。', eg:'vrrp vrid 10 virtual-ip ...' },
    'priority':    { p:'VRRP 优先级（1–254，默认 100）。大的是 Master；255 保留给虚拟 IP 的真实拥有者。', eg:'vrrp vrid 10 priority 120' },
    'stp':         { p:'生成树协议，用来消除二层环路。stp mode rstp 切到快速生成树，收敛从 30 秒降到秒级。', eg:'stp mode rstp' },
    'bpdu-protection': { p:'边缘端口的 BPDU 保护。边缘口一旦收到 BPDU（说明误接了交换机，可能成环），立刻 err-down 关闭端口。', eg:'stp bpdu-protection' },
    'stelnet':     { p:'stelnet server enable 开启 SSH 服务端。不开这一条，客户端连 22 端口会被拒。', eg:'stelnet server enable' },
    'privilege':   { p:'local-user X privilege level N：账号权限级别 0–15，15 是管理级。巡检账号给 1 或 5 就够。', eg:'local-user netadmin privilege level 15' },
    'irreversible-cipher': { p:'密码以不可逆加密方式存储。display current-configuration 时看不到明文，比 cipher 更安全。', eg:'password irreversible-cipher xxx' },
    'port-security': { p:'端口安全：限制端口能学习到的 MAC 数量，超出按 protect-action 处理。防私接路由器、防 MAC 泛洪。', eg:'port-security enable' },
    'max-mac-num': { p:'端口允许学习的最大 MAC 数。接一台 PC 填 1，接交换机要留余量。', eg:'port-security max-mac-num 1' },
    'protect-action': { p:'超限动作：protect 静默丢弃 / restrict 丢弃并告警 / shutdown 直接关端口。', eg:'port-security protect-action restrict' },
    'sticky':      { p:'粘滞 MAC：端口学到的 MAC 写入配置长期绑定，换设备就上不了网。适合固定工位。', eg:'port-security mac-address sticky' },

    /* --- 第二批：NAT 补充 --- */
    'global':      { p:'nat server 里 global 后面是公网侧参数（地址 + 端口），对应 inside 的内网侧。', eg:'nat server protocol tcp global 202.1.1.10 8080 inside ...' },
    'inside':      { p:'nat server 里 inside 后面是内网服务器的真实地址和端口。', eg:'... inside 192.168.10.100 80' },

    /* --- 第二批：SQL / 运维 --- */
    'explain':     { p:'看 SQL 的执行计划。重点看 type（出现 ALL 就是全表扫）、key（用了哪个索引）、rows（预估扫描行数）。', eg:'EXPLAIN SELECT * FROM orders WHERE status=1' },
    'limit':       { p:'分页。LIMIT offset, size 的语义是"扫描 offset+size 行，丢掉前 offset 行"，所以偏移量越大越慢。', eg:'LIMIT 100000, 20' },
    'mysqldump':   { p:'MySQL 逻辑备份工具，导出成 SQL 文本。--single-transaction 让 InnoDB 备份不锁表。', eg:'mysqldump -u root -p --single-transaction db > db.sql' },
    'df':          { p:'df -h 看各文件系统的使用率。-i 看 inode 使用率，inode 满了也会写不进去。', eg:'df -h' },
    'du':          { p:'du -sh 统计目录总占用。逐层往下钻是定位"谁吃了磁盘"的标准做法。', eg:'du -sh /* | sort -h | tail' },
    'find':        { p:'按条件查找文件。-size +500M 找大文件，-mtime +7 找 7 天前的，-delete 直接删除（慎用）。', eg:'find / -xdev -type f -size +500M' },
    'lsof':        { p:'lsof +L1 列出"已删除但被进程占用"的文件。磁盘删了不释放空间时，靠它找到元凶。', eg:'lsof +L1' },
    'ufw':         { p:'Ubuntu 的防火墙前端。ufw allow 8080/tcp 放通端口，改完立即生效不用 reload。', eg:'ufw allow 8080/tcp' },
    'firewall-cmd':{ p:'CentOS 的 firewalld 命令行。--permanent 的规则要 --reload 才生效；不带 --permanent 的重启就丢。', eg:'firewall-cmd --permanent --add-port=8080/tcp' },
    'docker':      { p:'容器运行时。docker run 一次给全参数，漏一个就得删容器重来。', eg:'docker run -d --name app -p 8080:80 nginx' },

    /* --- 第二批：Git --- */
    'commit':      { p:'git commit 把暂存区的内容固化成一次版本快照。只提交 add 过的东西。', eg:'git commit -m "feat: xxx"' },
    'revert':      { p:'新建一个提交，把指定提交的改动反向抵消。历史完整保留，是已推送分支的正确回滚方式。', eg:'git revert a1b2c3d' },
    'rebase':      { p:'变基：把你的提交挪到另一个分支的最新提交之后，历史变成一条直线。只对尚未推送的提交用。', eg:'git pull --rebase' },
    'stash':       { p:'把未提交的改动暂存起来，工作区回到干净状态。stash pop 取回。', eg:'git stash' },
    'merge':       { p:'合并分支。--no-ff 强制生成合并提交，能在历史上看出"这条功能从哪合进来"。', eg:'git merge --no-ff feature/login' },
    'restore':     { p:'git restore 还原文件内容；--staged 只取消暂存、保留改动。比 checkout 语义更清晰。', eg:'git restore --staged src/app.js' },
    'switch':      { p:'git switch 切换分支（2.23+）；-c 是新建并切换。比 checkout 安全，因为它不会误删改动。', eg:'git switch -c feature/login' },
    'checkout':    { p:'老命令，既能切分支又能还原文件，容易误用。新版本建议换成 switch / restore。', eg:'git checkout -- file' }
  },

  /* ============================================================
     命令词条 → 官方文档归属
     只列非华为的命令；没列出的默认查华为 S 系列命令参考。
     键名对应 app.js 里的 CMD_SRC。
     ============================================================ */
  cmdSrc: {
    linux:  ['sudo','systemctl','ssh-keygen','chmod','df','du','find','lsof','ufw','firewall-cmd'],
    git:    ['commit','revert','rebase','stash','merge','restore','switch','checkout'],
    mysql:  ['create','engine','charset','explain','limit','mysqldump'],
    docker: ['docker']
  },

  /* ============================================================
     分类 & 片段
     ============================================================ */
  categories: [
    {
      id: 'ensp',
      name: '华为 eNSP',
      sub: '交换机 / 路由器',
      icon: 'switch',
      items: [

        /* ---------------- 1 ---------------- */
        {
          id: 'vlan-create',
          title: '创建 VLAN 并命名',
          desc: '在交换机上建一个业务 VLAN，顺手加一条备注，排障时能一眼认出来。',
          tags: ['VLAN', '二层', '基础'],
          device: 'S5700 / S3700',
          level: '入门',
          code: `system-view
vlan {{vlanId}}
 description {{vlanName}}
 quit
quit
save`,
          vars: {
            vlanId: {
              label: 'VLAN 编号', value: '10', type: 'int', min: 1, max: 4094,
              hint: '1–4094，VLAN 1 是默认 VLAN 别用',
              desc: '全网唯一的业务编号。常见规划：10 管理、20 办公、30 访客、40 服务器。'
            },
            vlanName: {
              label: 'VLAN 名称', value: 'office', type: 'text',
              hint: '英文 / 数字，与用途对应',
              desc: '只影响可读性，display vlan 时会显示。建议和编号成对出现：10-office。'
            }
          },
          docs: {
            secs: [
              { h: '这条命令在做什么', p: 'system-view 进入系统视图；vlan 10 同时做两件事——VLAN 10 不存在就创建它，然后进入 VLAN 视图；description 只是备注。' },
              { h: '为什么 quit 两次', p: '第一次退出 VLAN 视图回到系统视图，第二次退回用户视图。只有回到用户视图才能执行 save。' },
              { h: '必踩的坑', ul: [
                '配完不 save，重启后全没了——eNSP 里关掉设备再开也一样。',
                'VLAN 建好不等于通了：端口还得划进去，跨设备还得 Trunk 放通。',
                'VLAN 1 是所有端口的初始 VLAN，别拿它承载业务。',
                'ID 只能 1–4094。1 是缺省 VLAN 且删不掉，4095 是系统保留，输这两个以外的数会直接报错。'
              ] },
              { h: '建完怎么确认真的建上了', p: 'display vlan 能看到所有 VLAN 和各自包含的接口；display vlan summary 看总数。新建的空 VLAN 在 display vlan 里 Ports 是空的——这是正常的，没接口加入不代表没建成。' }
            ],
            src: { n: '华为官方 · 配置 VLAN（V200R011C10 以太网交换）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
          },
          flow: 'vlan-decision'
        },

        /* ---------------- 2 ---------------- */
        {
          id: 'port-access',
          title: '端口划入 VLAN（Access）',
          desc: '把接终端的端口设成 Access 并划进指定 VLAN，这是"VLAN 真正生效"的那一步。',
          tags: ['VLAN', 'Access', '接口'],
          device: 'S5700 / S3700',
          level: '入门',
          code: `system-view
interface {{intf}}
 port link-type access
 port default vlan {{vlanId}}
 undo shutdown
 quit
save`,
          vars: {
            intf: { label: '接口名', value: 'GigabitEthernet0/0/1', type: 'text', hint: '可简写为 g0/0/1', desc: 'eNSP 里看设备面板上的编号。别和 console 口、上行口搞混。' },
            vlanId: { label: 'VLAN 编号', value: '10', type: 'int', min: 1, max: 4094, hint: '必须已存在', desc: '这个 VLAN 得先创建过，否则命令会报错。' }
          },
          docs: {
            secs: [
              { h: '顺序很关键', p: '必须先 port link-type access 再 port default vlan 10。顺序反了会提示端口类型不匹配。' },
              { h: 'port default vlan 一步做了两件事', p: '它同时把这个口加入 VLAN 10，并把 PVID 设成 10。所以 Access 口不需要再单独配 pvid——这也解释了为什么 Access 口 display vlan 里能看到它，而 Trunk 口配了 pvid 却看不到（pvid 只管打标签，不管加入）。' },
              { h: 'Access 口一个口只能属于一个 VLAN', p: '再执行一次 port default vlan 20，是把这个口从 VLAN 10 搬到 VLAN 20，不是同时属于两个。想让一个口承载多个 VLAN，只能改 Trunk 或 Hybrid。这是初学者最常见的理解偏差。' },
              { h: 'undo shutdown 有必要吗', p: '华为交换机端口默认是开启的，写上是防止之前被 shutdown 过。属于"写了不出错"的习惯动作。' },
              { h: '验证', ul: ['display port vlan —— 看端口的 PVID 和允许 VLAN', 'display vlan 10 —— 看哪些端口在这个 VLAN 里'] }
            ],
            src: { n: '华为官方 · 基于接口划分 VLAN（Access/Trunk/Hybrid）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
          }
        },

        /* ---------------- 3 ---------------- */
        {
          id: 'port-group',
          title: '端口组批量划 VLAN',
          desc: '一个机柜几十个口要划同一个 VLAN，用 port-group 一次配完，不用一个个 interface。',
          tags: ['VLAN', '批量', '效率'],
          device: 'S5700 / S3700',
          level: '入门',
          code: `system-view
port-group {{groupName}}
 group-member {{portRange}}
 port link-type access
 port default vlan {{vlanId}}
 quit
save`,
          vars: {
            groupName: { label: '端口组名', value: 'office-ports', type: 'text', hint: '自取，仅本地有效', desc: '建议按用途命名，如 office-ports / guest-ports。' },
            portRange: {
              label: '端口范围', value: 'GigabitEthernet0/0/1 to GigabitEthernet0/0/12', type: 'text', multiline: true,
              hint: '支持 to 区间或空格列举',
              desc: '连续端口用 A to B；不连续就空格分隔并列多个：g0/0/1 g0/0/3 g0/0/5。'
            },
            vlanId: { label: 'VLAN 编号', value: '10', type: 'int', min: 1, max: 4094, hint: '目标 VLAN', desc: '组内所有端口都会被划进这个 VLAN。' }
          },
          docs: {
            secs: [
              { h: 'port-group 的本质', p: '它不是配置，是一个"批处理手柄"：把后续命令同时作用到组内所有端口。配完退出即失效，设备里不会留下这个组。' },
              { h: '注意', ul: ['组内端口必须支持同样的命令，混了电口和光口可能报错', '要长期保存这种批量关系，请用端口组之外的方式（如脚本），port-group 本身不持久'] }
            ],
            src: { n: '华为官方 · 基于接口划分 VLAN（配置 VLAN 章节）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
          }
        },

        /* ---------------- 4 ---------------- */
        {
          id: 'trunk',
          title: '交换机互联（Trunk）',
          desc: '两台交换机之间传多个 VLAN，用 Trunk 打 tag。三种常见写法都在下面的选项里。',
          tags: ['VLAN', 'Trunk', '互联'],
          device: 'S5700 / S3700',
          level: '进阶',
          code: `system-view
interface {{intf}}
 port link-type trunk
 port trunk allow-pass vlan {{vlanList}}
 undo shutdown
 quit
save`,
          vars: {
            intf: { label: '互联接口', value: 'GigabitEthernet0/0/24', type: 'text', hint: '两端都要配', desc: '交换机之间相连的端口，通常用最后一个口或光口。' },
            vlanList: { label: '放通 VLAN', value: '10 20 30', type: 'text', hint: '空格分隔，或写 all', desc: '只写业务 VLAN。放通 all 会把不该过的 VLAN 也放过去，不安全。' },
            pvid: { label: '端口 PVID', value: '1', type: 'int', min: 1, max: 4094, hint: '仅"对接 Access 口"时用', desc: '对端是 Access 口时，本端 Trunk 的 PVID 要设成对端的 VLAN，否则 untagged 帧归错 VLAN。' }
          },
          variants: [
            {
              id: 'list', label: '指定 VLAN',
              code: `system-view
interface {{intf}}
 port link-type trunk
 port trunk allow-pass vlan {{vlanList}}
 undo shutdown
 quit
save`
            },
            {
              id: 'all', label: '放通全部',
              code: `system-view
interface {{intf}}
 port link-type trunk
 port trunk allow-pass vlan all
 undo shutdown
 quit
save`
            },
            {
              id: 'pvid', label: '配 PVID',
              code: `system-view
interface {{intf}}
 port link-type trunk
 port trunk pvid vlan {{pvid}}
 port trunk allow-pass vlan {{vlanList}}
 undo shutdown
 quit
save`
            }
          ],
          docs: {
            secs: [
              { h: '最容易忘的一行', p: '很多人只写了 port link-type trunk 就以为通了。不写 allow-pass，Trunk 默认只放通 VLAN 1，其他 VLAN 的帧全部丢弃——这是 eNSP 里"配了 VLAN 但 ping 不通"的第一大原因。' },
              { h: '为什么帧要打 tag', p: '一条物理链路上要同时跑多个 VLAN 的流量，必须给每个帧打上 802.1Q 标签标明它属于哪个 VLAN，对端才能还原。Access 口收到 untagged 帧则按 PVID 归类。' },
              { h: '什么时候要 PVID', ul: ['两端都是 Trunk 互联：PVID 保持默认 1 即可，但两端必须一致', '一端 Access、一端 Trunk（比如交换机接路由器单臂路由）：Trunk 侧 PVID 要等于 Access 侧 VLAN'] },
              {
                h: 'PVID 最大的坑：配了不等于加入',
                p: '官方在"VLANIF 接口 Down"的排查表里专门标注了这一条：port trunk pvid vlan 10 只表示在这个 Trunk 口上把 PVID 改成 10，并没有把接口加入 VLAN 10。Hybrid 的 port hybrid pvid vlan 同样如此。结果就是 PVID 看着配好了，display vlan 10 的 Ports 里却没有这个口，网关也起不来。判断标准只有一个：display vlan 10 里能不能看到这个接口。'
              },
              {
                h: '改链路类型会清空已有 VLAN 配置',
                p: '在已经配过 VLAN 的接口上执行 port link-type，设备会弹 Warning: This command will delete VLANs on this port. Continue?[Y/N]。输入 y，这个口上原有的 VLAN 配置就被删干净了。从 Access 改 Trunk 时尤其容易踩——改完必须重新 allow-pass 一遍。'
              }
            ],
            src: { n: '华为官方 · 配置 Trunk 接口与 allow-pass', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
          },
          flow: 'vlan-decision'
        },

        /* ---------------- 5 ---------------- */
        {
          id: 'svi',
          title: 'VLANIF 三层网关（SVI）',
          desc: '让 VLAN 之间能互通：给每个 VLAN 起一个 VLANIF 接口当网关，交换机变成三层交换机。',
          tags: ['三层', 'VLANIF', '网关'],
          device: 'S5700（三层型号）',
          level: '进阶',
          code: `system-view
interface Vlanif {{vlanId}}
 ip address {{gateway}} {{mask}}
 undo shutdown
 quit
save`,
          vars: {
            vlanId: { label: 'VLAN 编号', value: '10', type: 'int', min: 1, max: 4094, hint: '已有 VLAN', desc: 'VLANIF 编号必须和 VLAN 编号一致，这是硬绑定。' },
            gateway: { label: '网关地址', value: '192.168.10.1', type: 'text', hint: '该网段可用地址', desc: '习惯用 .1 或 .254。终端的默认网关就填这个。' },
            mask: { label: '子网掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '/24 就是 255.255.255.0。也可以用 24 这种简写。' }
          },
          docs: {
            secs: [
              { h: 'VLANIF 是什么', p: '一个虚拟的三层接口，和某个 VLAN 一一绑定。它就是这个 VLAN 的网关：VLAN 内的终端把跨网段流量交给它，它再查路由转发。' },
              {
                h: '官方列的 5 个 Down 原因（按这个顺序查）',
                ul: [
                  'VLAN 没建 —— VLANIF 与 VLAN 是硬绑定，VLAN 不存在接口就起不来。',
                  '没有接口加入 VLAN —— 最高频的一个。特别注意：port trunk pvid vlan 10 只是改 PVID，并不把接口加进 VLAN 10；要 port trunk allow-pass vlan 10 才算加入。Hybrid 的 pvid 同理，配了 pvid 不等于加入。',
                  '加入 VLAN 的接口物理状态全是 Down —— 注意是"全部"。只要还有一个 Up，VLANIF 就是 Up。',
                  'VLANIF 下没配 IP 地址 —— 三层接口没地址，等于没有网关。',
                  'VLANIF 被 shutdown —— 忘了 undo shutdown。'
                ]
              },
              {
                h: '创建 VLANIF 时报错怎么读',
                ul: [
                  'Error: The VLAN does not exist. → 对应的 VLAN 还没建，先 vlan vlan-id。',
                  'Error: ... has reached its maximum. → VLANIF 数量到规格上限，用 undo interface vlanif 删掉不用的。',
                  'Error: The VLAN is used by XXX. → 这个 VLAN 是动态/控制/保留 VLAN（被 ERPS、RRPP、SEP、Smart Link、GVRP、VBST 等占用），换一个。'
                ]
              },
              {
                h: '两台交换机用 VLANIF 互通不了',
                p: '官方检查顺序：①两边 VLANIF 是否都 Up；②互联接口是否都加入了该 VLAN——重点看加入方式，一端显示 UT（Untagged）、另一端 TG（Tagged）就不通，交换机互联必须都是 Tagged；③两端互联口的 PVID 是否一致。这三步过了还不通，才轮到查路由和 ACL。'
              },
              {
                h: '还有两个不在官方清单里但很常见',
                ul: [
                  '终端网关填错 / 没填',
                  '三层交换机没开路由功能（部分型号需要 ip routing，S5700 默认开启）'
                ]
              },
              { h: '验证', p: 'display ip interface brief 看 Vlanif10 是否 up；display vlan 10 看 Ports 字段里有没有你的接口；再从 PC ping 网关。' }
            ],
            src: { n: '华为官方 · 配置 VLAN 间互访（VLANIF）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
          },
          flow: 'vlan-decision'
        },

        /* ---------------- 6 ---------------- */
        {
          id: 'dhcp-pool',
          title: 'DHCP 全局地址池',
          desc: '让终端自动拿到 IP、网关、DNS。配完 PC 侧选"DHCP"就能上网。',
          tags: ['DHCP', '自动化', '服务'],
          device: 'S5700 / AR 系列',
          level: '进阶',
          code: `system-view
dhcp enable
interface Vlanif {{vlanId}}
 ip address {{gateway}} {{mask}}
 dhcp select global
 quit
ip pool {{poolName}}
 network {{network}} mask {{mask}}
 gateway-list {{gateway}}
 dns-list {{dns}}
 excluded-ip-address {{exStart}} {{exEnd}}
 lease day {{lease}}
 quit
quit
save`,
          vars: {
            vlanId: { label: '服务哪个 VLAN', value: '10', type: 'int', min: 1, max: 4094, hint: '= VLANIF 编号', desc: 'DHCP 要在这一层的 VLANIF 上使能。终端属于哪个 VLAN，就填这个 VLAN 的编号。' },
            poolName: { label: '地址池名', value: 'vlan10', type: 'text', hint: '自取', desc: '建议 vlan+编号，方便对应。' },
            network: { label: '网段', value: '192.168.10.0', type: 'text', hint: '网络号，不是网关', desc: '必须是网络地址（末位 0），写错整池都不发地址。' },
            mask: { label: '掩码', value: '255.255.255.0', type: 'text', hint: '与 VLANIF 一致', desc: '要和 VLANIF 的掩码保持一致。' },
            gateway: { label: '网关', value: '192.168.10.1', type: 'text', hint: '= VLANIF 地址', desc: '必须等于该 VLAN 的 VLANIF 地址。' },
            dns: { label: 'DNS', value: '114.114.114.114 8.8.8.8', type: 'text', multiline: true, hint: '可写多个，空格分隔', desc: '国内常用 114.114.114.114；写两个做冗余。' },
            exStart: { label: '排除起始', value: '192.168.10.1', type: 'text', hint: '保留地址段', desc: '网关、服务器、打印机要排除，否则会被分给 PC 造成 IP 冲突。' },
            exEnd: { label: '排除结束', value: '192.168.10.10', type: 'text', hint: '保留地址段', desc: '和起始地址一起构成一段保留区间。' },
            lease: { label: '租期（天）', value: '3', type: 'int', min: 0, max: 999, hint: '0 表示永不过期', desc: '办公网 1–7 天常见。太短会增加 DHCP 报文，太长地址回收慢。' }
          },
          docs: {
            secs: [
              {
                h: '四件事缺一不可（少最后一件最常见）',
                ul: [
                  'dhcp enable —— 系统视图下的全局开关。缺省是关闭的，不写地址池根本不生效。',
                  'interface Vlanif + dhcp select global —— 在终端所在的那层接口上告诉设备"用全局地址池发地址"。这一步最容易漏：地址池写得再全，接口没使能就一个包也不回。',
                  'ip pool + network —— 告诉设备发哪个网段。',
                  'VLANIF 有 IP —— 没有三层接口，DHCP 不知道从哪一层应答。'
                ]
              },
              { h: '官方给的三个排查方向', p: '华为文档把"客户端拿不到地址"归成三类：①没开 DHCP（display current-configuration | include dhcp enable 查不到就是没开）；②配置不对（display ip pool 看地址池在不在、display this 看接口有没有使能）；③地址池里没可用地址。按这个顺序查，比乱试快得多。' },
              {
                h: '地址池没地址了怎么判断',
                p: 'display ip pool 里的 Idle(Expired) 字段就是"还剩下几个能发的"。显示 0 表示池子空了。官方给的两个解法：客户端比地址多，就减小掩码长度扩容量；客户端比地址少，就缩短租期让闲置地址早点回收。另外 excluded 排太多、network 写成网关地址，也会让可用地址凭空变少。'
              },
              {
                h: 'eNSP 实验里的两个小动作',
                p: 'PC 侧先 ipconfig /release 再 /renew，强制重来一次，别等租期。设备侧 display dhcp server statistics 看有没有收到 Discover——如果计数器一直是 0，说明包根本没到设备，问题在链路或 VLAN，不在 DHCP 配置。'
              }
            ],
            src: { n: '华为官方 · 基于全局地址池的 DHCP 服务器示例', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178148/86e5b900' }
          },
          flow: 'net-troubleshoot'
        },

        /* ---------------- 7 ---------------- */
        {
          id: 'static-route',
          title: '静态路由',
          desc: '手动告诉设备"去某个网段走哪个下一跳"。小网络最省事，也是默认路由的标准写法。',
          tags: ['路由', '三层', '基础'],
          device: 'S5700 / AR 系列',
          level: '入门',
          code: `system-view
ip route-static {{dest}} {{mask}} {{nextHop}}
quit
save`,
          vars: {
            dest: { label: '目的网段', value: '0.0.0.0', type: 'text', hint: '默认路由写 0.0.0.0', desc: '想去的网段。做默认路由就写 0.0.0.0。' },
            mask: { label: '掩码', value: '0.0.0.0', type: 'text', hint: '与目的网段配套', desc: '默认路由配 0.0.0.0。' },
            nextHop: { label: '下一跳', value: '192.168.1.2', type: 'text', hint: '对端直连可达的地址', desc: '必须是本机直连网段内的地址，否则路由不生效。' }
          },
          docs: {
            secs: [
              { h: '默认路由长什么样', p: 'ip route-static 0.0.0.0 0.0.0.0 192.168.1.2 —— 目的和掩码全 0，表示"其他所有流量"。' },
              { h: '下一跳为什么必须是直连', p: '设备要能 ARP 到下一跳才能转发。写一个非直连的地址，路由会显示为 inactive。' },
              { h: '单向不通', p: '静态路由是单向的。A 配了去 B 的路由，B 也必须配回程路由，否则 ping 有去无回。' },
              {
                h: '配了却不生效？先比优先级',
                p: '设备选路先比优先级（preference），数值越小越优先。静态路由默认 60，OSPF 默认 10。所以同一目的网段如果 OSPF 也学到了，静态路由会被压住、不进路由表（display ip routing-table 里看不到，不是配错了）。要强制走静态，就 ip route-static ... preference 10 以内。反过来，把备份路由的 preference 调大（比如 80）就是标准的浮动静态路由做法——主链路断了它才顶上。'
              },
              {
                h: '查路由只看三个字段',
                p: 'display ip routing-table 里：Destination/Mask 是目的网段、Proto 是来源（Static / OSPF）、Pre 是优先级。路由没进表，先看是不是被更小优先级的同网段路由顶掉了，再看下一跳是不是不可达——下一跳不可达的路由不会进表。'
              }
            ],
            src: { n: '华为官方 · 配置 IPv4 静态路由示例', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178149/1385ca0f' }
          }
        },

        /* ---------------- 8 ---------------- */
        {
          id: 'ospf',
          title: 'OSPF 单区域',
          desc: '三台以上设备、网段一多，静态路由就维护不动了。OSPF 自动学路由，这是最小可用配置。',
          tags: ['OSPF', '动态路由', '三层'],
          device: 'S5700 / AR 系列',
          level: '进阶',
          code: `system-view
ospf {{pid}} router-id {{rid}}
 area {{area}}
  network {{net}} {{wildcard}}
 quit
quit
save`,
          vars: {
            pid: { label: '进程号', value: '1', type: 'int', min: 1, max: 65535, hint: '本地有效', desc: '两台设备可以不同，只在本机区分进程。' },
            rid: { label: 'Router ID', value: '1.1.1.1', type: 'text', hint: '格式像 IP，全网唯一', desc: '建议手动配成 Loopback0 的地址。不配的话可能因接口 IP 变化而重算邻居。' },
            area: { label: '区域号', value: '0', type: 'text', hint: '单区域填 0', desc: '0 是骨干区域。多区域时其他区域都要挂在 0 上。' },
            net: { label: '宣告网段', value: '192.168.10.0', type: 'text', hint: '要宣告的网络号', desc: '只宣告直连网段。宣告错了邻居能建立但学不到路由。' },
            wildcard: { label: '通配符', value: '0.0.0.255', type: 'text', hint: '掩码取反', desc: '/24 的通配符是 0.0.0.255（不是掩码本身，这是最常错的地方）。' }
          },
          docs: {
            secs: [
              { h: 'network 里的通配符', p: 'OSPF 用通配符掩码而不是子网掩码。255.255.255.0 要写成 0.0.0.255——掩码按位取反。写成掩码形式，命令会报错或匹配到错误网段。' },
              { h: 'network 写对了才生效', p: '官方给了两个硬条件，缺一个接口就跑不起 OSPF：①接口 IP 的掩码长度 ≥ network 命令里写的掩码长度；②接口的主 IP 必须在 network 指定的网段范围内。所以 /30 的互联口宣告成 24 位是无效的。' },
              { h: '为什么掩码不一致会断邻居', p: '官方原文：OSPF 收到 Hello 报文时会做网络掩码检查，报文中携带的掩码和本设备不一致就直接丢弃该 Hello，邻居根本建不起来。这就是"两端掩码不一致"为什么是高频故障原因。' },
              { h: '邻居起不来的常见原因', ul: ['area 号不一致', '接口没宣告进 OSPF（network 写错）', '两端掩码不一致', 'Hello/Dead 计时器不一致', '中间有 ACL 挡了组播 224.0.0.5'] },
              { h: '验证命令', p: 'display ospf peer brief 看邻居是否 Full；display ip routing-table protocol ospf 看有没有学到路由。' }
            ],
            src: { n: '华为官方 · 使能 OSPF（area / network 配置）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1100459458/c9060695' }
          },
          flow: 'ospf-neighbor'
        },

        /* ---------------- 9 ---------------- */
        {
          id: 'acl',
          title: 'ACL 访问控制 + 接口调用',
          desc: '谁能访问谁、哪个端口封掉——ACL 是交换机和路由器上最常用的"门禁"。',
          tags: ['ACL', '安全', '过滤'],
          device: 'S5700 / AR 系列',
          level: '进阶',
          code: `system-view
acl number {{aclNum}}
{{rules}}
 quit
interface {{intf}}
 traffic-filter {{dir}} acl {{aclNum}}
 quit
save`,
          vars: {
            aclNum: { label: 'ACL 编号', value: '3000', type: 'int', min: 2000, max: 3999, hint: '2000–2999 基本 / 3000–3999 高级', desc: '要匹配协议或端口就必须用 3000 段的高级 ACL。' },
            rules: {
              label: '规则块（可多行）', value: ` rule 5 permit tcp source 192.168.10.0 0.0.0.255 destination 192.168.20.0 0.0.0.255 destination-port eq 80
 rule 10 deny ip`,
              type: 'text', multiline: true,
              hint: '每行一条 rule，编号小的先生效',
              desc: '整块都是自主区：可以按需增删规则。注意末尾有隐式 deny any，所以放通规则要写在前。'
            },
            intf: { label: '调用接口', value: 'GigabitEthernet0/0/1', type: 'text', hint: '一般加在靠近源或目的的接口', desc: '加在哪个方向决定了过滤谁，想清楚再下手。' },
            dir: { label: '方向', value: 'inbound', type: 'text', hint: 'inbound / outbound', desc: 'inbound = 从外部进接口的流量；outbound = 从接口出去的流量。' }
          },
          docs: {
            secs: [
              { h: '规则顺序决定结果', p: 'ACL 从上到下逐条匹配，命中即停。把 deny 写在 permit 前面，后面的 permit 永远不会被执行——这是"ACL 配了不生效"的头号原因。' },
              { h: '隐式 deny', p: 'ACL 末尾有一条看不见的 deny any。所以只写 permit 规则的 ACL，效果是"只放通列出的，其余全拒"。' },
              { h: '通配符别写成掩码', p: '0.0.0.255 表示"前 24 位必须匹配"。写成 255.255.255.0 会匹配到完全不同的地址范围。' },
              {
                h: '方向配反了，ACL 等于没配',
                p: 'traffic-filter 必须跟 inbound 或 outbound。官方定义：inbound 检查从该接口进入设备的报文，outbound 检查从该接口发出的报文。方向反了不会报错，只是过滤不到任何流量——表现为"ACL 明明写了，一点效果没有"。判断方法：想挡住谁进入，就配在靠近来源的那个接口的 inbound 上。'
              },
              {
                h: '编号决定你能写什么',
                p: '2000–2999 是基本 ACL，只能匹配源 IP；3000–3999 是高级 ACL，能匹配源/目的 IP、协议号、端口。想按端口封（比如只封 3389）就必须用 3000 段，用 2000 段写 destination-port 会直接报错。'
              },
              {
                h: '这条命令为什么在 QoS 分册里',
                p: '华为把 traffic-filter 归到"配置指南-QoS"的简化流策略里，不在安全分册。查文档搜不到时别以为没这功能，换个分册找。'
              }
            ],
            src: { n: '华为官方 · 配置基于 ACL 的报文过滤（配置指南-QoS）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178152/e9b94643' }
          },
          flow: 'net-troubleshoot'
        },

        /* ---------------- 10 ---------------- */
        {
          id: 'nat-easyip',
          title: 'Easy IP 出口 NAT',
          desc: '内网私有地址出门变成公网地址。家用/小型办公最常用的是 Easy IP（复用出接口地址）。',
          tags: ['NAT', '出口', '三层'],
          device: 'AR 系列路由器',
          level: '进阶',
          code: `system-view
acl number {{aclNum}}
 rule 5 permit source {{inside}} {{wildcard}}
 quit
interface {{outside}}
 nat outbound {{aclNum}}
 quit
save`,
          vars: {
            aclNum: { label: 'ACL 编号', value: '2000', type: 'int', min: 2000, max: 2999, hint: '基本 ACL 足够', desc: 'NAT 只需要匹配源地址，用 2000 段基本 ACL 就够。' },
            inside: { label: '内网网段', value: '192.168.10.0', type: 'text', hint: '要被转换的源', desc: '写内网网络号。多个网段可以加多条 rule。' },
            wildcard: { label: '通配符', value: '0.0.0.255', type: 'text', hint: '掩码取反', desc: '/24 对应 0.0.0.255。' },
            outside: { label: '出接口', value: 'GigabitEthernet0/0/0', type: 'text', hint: '连公网/上级的接口', desc: '注意是 WAN 侧接口，不是内网口。' }
          },
          docs: {
            secs: [
              { h: 'Easy IP 做了什么', p: '把内网源地址直接换成出接口的公网地址，并用端口号区分不同会话。因为不需要额外申请公网地址池，所以叫"Easy"。' },
              { h: 'NAT 生效的前提', ul: ['内网有到出口的默认路由', '出口接口本身有可用的公网地址', 'ACL 匹配到了源网段（nat outbound 后面跟的编号要对）'] },
              { h: '验证', p: 'display nat session all 看有没有会话表项；从 PC ping 外网地址应能通，但 ping 内网看不到变化。' }
            ],
            src: { n: '华为官方 · 内网用户通过 Easy IP 访问外网示例', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1100130778/6753723e' }
          }
        },

        /* ---------------- 11 ---------------- */
        {
          id: 'vlan-batch',
          title: '批量创建 VLAN',
          desc: '一次建一堆 VLAN：连续的用 to，不连续的用空格列举。开局建十几个 VLAN 时省一半时间。',
          tags: ['VLAN', '批量', '效率'],
          device: 'S5700 / S3700',
          level: '入门',
          code: `system-view
vlan batch {{vlanSpec}}
quit
save`,
          vars: {
            vlanSpec: {
              label: 'VLAN 列表', value: '10 20 30 40', type: 'text', multiline: true,
              hint: '连续写 10 to 20，不连续写 10 20 30',
              desc: '两种写法可以混用：vlan batch 10 to 15 20 30。注意 to 是闭区间，10 to 20 会建 11 个。'
            }
          },
          docs: {
            secs: [
              { h: 'to 是闭区间', p: 'vlan batch 10 to 20 会创建 VLAN 10 到 20 共 11 个，不是 10 个。算端口的时候容易少算一个。' },
              { h: '建完还要做什么', p: '批量创建只是把容器造好。端口要划进去（port-group），跨设备要 Trunk 放通，否则 VLAN 建了也没有流量。' },
              { h: '验证', p: 'display vlan 能看到所有 VLAN 及各自的端口列表；display vlan summary 看总数。' }
            ],
            src: { n: '华为官方 · 配置 VLAN（批量创建与命名）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
          }
        },

        /* ---------------- 12 ---------------- */
        {
          id: 'hybrid',
          title: 'Hybrid 端口',
          desc: '一个端口既要接终端（不带 tag）又要给对端交换机送 VLAN（带 tag）时用。Access 和 Trunk 都能用 Hybrid 表达。',
          tags: ['VLAN', 'Hybrid', '进阶'],
          device: 'S5700 / S3700',
          level: '进阶',
          code: `system-view
interface {{intf}}
 port link-type hybrid
 port hybrid pvid vlan {{pvid}}
 port hybrid untagged vlan {{untagged}}
 port hybrid tagged vlan {{tagged}}
 undo shutdown
 quit`,
          vars: {
            intf: { label: '接口', value: 'GigabitEthernet0/0/1', type: 'text', hint: '要配的端口', desc: 'Hybrid 最常用于服务器网口：既跑业务 VLAN 又跑管理 VLAN。' },
            pvid: { label: 'PVID', value: '10', type: 'int', min: 1, max: 4094, hint: '收 untagged 帧归这个 VLAN', desc: '收到的、不带 tag 的帧会归到这个 VLAN。' },
            untagged: { label: 'untagged VLAN', value: '10', type: 'text', hint: '发出去时剥掉 tag', desc: '列在这里的 VLAN，从这个口发出时是不带 tag 的。必须包含 PVID，否则该 VLAN 发不出去。' },
            tagged: { label: 'tagged VLAN', value: '20 30', type: 'text', hint: '发出去时带 tag', desc: '列在这里的 VLAN 发出的帧带 802.1Q tag，对端必须是 Trunk 或 Hybrid。' }
          },
          docs: {
            secs: [
              { h: 'Hybrid 的判断规则', p: '收到帧：带 tag 就按 tag 归属；不带 tag 就归 PVID。发出帧：查 untagged 列表，在列表里就剥掉 tag 发；不在但在 tagged 列表里就带 tag 发；都不在就不发。' },
              { h: '和 Access / Trunk 的关系', p: 'Access 口 = untagged 列表只有 PVID、tagged 列表为空；Trunk 口 = 所有放通的 VLAN 都在 tagged 列表。所以 Hybrid 是两者的超集。' },
              { h: '最常见的错', p: 'untagged vlan 里没写 PVID 所在的那个 VLAN，导致本该不带 tag 发出的流量发不出去。写完先 display port vlan 确认。' }
            ],
            src: { n: '华为官方 · 基于接口划分 VLAN（Hybrid 接口）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
          }
        },

        /* ---------------- 13 ---------------- */
        {
          id: 'single-arm',
          title: '单臂路由（子接口）',
          desc: '只有一台普通路由器、没有三层交换机时，用一个物理口划子接口给每个 VLAN 当网关。',
          tags: ['路由', 'VLAN', '子接口'],
          device: 'AR 系列路由器',
          level: '进阶',
          code: `system-view
interface {{subIntf}}
 dot1q termination vid {{vlanId}}
 ip address {{gateway}} {{mask}}
 arp broadcast enable
 undo shutdown
 quit
save`,
          vars: {
            subIntf: { label: '子接口', value: 'GigabitEthernet0/0/0.10', type: 'text', hint: '物理口.编号', desc: '子接口编号建议和 VLAN 号一致，方便对应。' },
            vlanId: { label: '对应 VLAN', value: '10', type: 'int', min: 1, max: 4094, hint: '这个子接口服务哪个 VLAN', desc: 'dot1q termination vid 让子接口只收该 VLAN 的 tag 帧，并剥掉 tag。' },
            gateway: { label: '网关地址', value: '192.168.10.1', type: 'text', hint: '该网段网关', desc: '终端网关填这个地址。' },
            mask: { label: '掩码', value: '255.255.255.0', type: 'text', hint: '点分十进制', desc: '要和终端网段一致。' }
          },
          docs: {
            secs: [
              { h: '必配 arp broadcast enable', p: '这一行不开，子接口能 ping 通自己但学不到终端的 ARP，表现是"网关通、终端不通"。单臂路由实验里最高频的坑。' },
              { h: '一个子接口只终结一个 VLAN', p: '官方明确：每个子接口只支持终结一个 VLAN。不同主接口下的子接口可以关联相同 VLAN，但同一个主接口下的不同子接口绝不能关联同一个 VLAN ID，否则报文会串。' },
              { h: '生产环境别反复开关它', p: '官方提示：使能或去使能子接口的 ARP 广播功能，会让该子接口的路由状态先 Down 再 Up 一次，可能导致整网路由震荡，影响正在跑的业务。实验里随便试，线上改之前挑窗口期。' },
              { h: '交换机那侧怎么配', p: '连路由器的交换机端口要设成 Trunk，并 allow-pass 所有业务 VLAN。路由器一个物理口承载全部 VLAN 的 tag 流量，这就是"单臂"。' },
              { h: '单臂路由的代价', p: '所有 VLAN 间流量都要绕到路由器再回来，物理口是瓶颈。VLAN 一多就该换三层交换机做 SVI。' }
            ],
            src: { n: '华为官方 · 配置 Dot1q 终结子接口实现 VLAN 间通信', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1100411240/60c75ace' }
          }
        },

        /* ---------------- 14 ---------------- */
        {
          id: 'vrrp',
          title: 'VRRP 网关冗余',
          desc: '两台三层交换机做同一个网关，主机挂了备机立刻接手。终端只配一个虚拟网关地址，感知不到切换。',
          tags: ['VRRP', '冗余', '高可用'],
          device: 'S5700（三层）',
          level: '进阶',
          code: `system-view
interface Vlanif {{vlanId}}
 ip address {{localIp}} {{mask}}
 vrrp vrid {{vrid}} virtual-ip {{vip}}
 vrrp vrid {{vrid}} priority {{priority}}
 quit
save`,
          vars: {
            vlanId: { label: 'VLAN', value: '10', type: 'int', min: 1, max: 4094, hint: '两台设备要一致', desc: '两台交换机上都要有同名 VLANIF。' },
            localIp: { label: '本机地址', value: '192.168.10.2', type: 'text', hint: '各自真实的 IP', desc: '两台设备各不相同，比如 .2 和 .3。' },
            mask: { label: '掩码', value: '255.255.255.0', type: 'text', hint: '两台一致', desc: '不一致会导致 VRRP 报文校验失败。' },
            vrid: { label: 'VRID', value: '10', type: 'int', min: 1, max: 255, hint: '同一个组的编号', desc: '同一网段内 VRID 不能冲突。建议与 VLAN 号呼应。' },
            vip: { label: '虚拟网关', value: '192.168.10.1', type: 'text', hint: '终端填这个', desc: '这个地址不属于任何一台物理设备，是 VRRP 虚拟出来的。终端网关就填它。' },
            priority: { label: '优先级', value: '120', type: 'int', min: 1, max: 254, hint: '大的是 Master，默认 100', desc: '主用配 120，备用保持默认 100。255 保留给 IP 拥有者。' }
          },
          docs: {
            secs: [
              { h: '谁当 Master', p: '优先级大的当 Master，优先级相同则比接口 IP 大的当。Master 定期发 VRRP 通告，备用收不到（默认 3 秒多）就接管虚拟 IP 和 MAC。' },
              { h: '为什么要配 track', p: '默认只看 VRRP 报文，不看上行链路。Master 的上行断了它还活着，流量照样往它那儿送然后黑洞。要配 vrrp vrid 10 track interface GigabitEthernet0/0/24 reduced 30，上行一断自动降优先级让位。' },
              { h: '验证', p: 'display vrrp 看 State 是 Master 还是 Backup、Virtual IP 是否生效；在终端上 tracert 看网关 MAC 有没有变。' }
            ],
            src: { n: '华为官方 · 配置基于 IPv4 的 VRRP 基本功能', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178155/a9d163a2' }
          }
        },

        /* ---------------- 15 ---------------- */
        {
          id: 'eth-trunk',
          title: '链路聚合（LACP）',
          desc: '两条网线绑成一条逻辑链路：带宽叠加，一条断了不断网。交换机之间互联的标准做法。',
          tags: ['聚合', 'LACP', '冗余'],
          device: 'S5700 / S3700',
          level: '进阶',
          code: `system-view
interface Eth-Trunk {{trunkId}}
 mode lacp-static
 port link-type trunk
 port trunk allow-pass vlan {{vlanList}}
 quit
interface {{member1}}
 eth-trunk {{trunkId}}
 quit
interface {{member2}}
 eth-trunk {{trunkId}}
 quit
save`,
          vars: {
            trunkId: { label: 'Eth-Trunk 编号', value: '1', type: 'int', min: 0, max: 63, hint: '0–63，两端要一致', desc: '逻辑接口编号，两端设备必须用同一个编号。' },
            vlanList: { label: '放通 VLAN', value: '10 20', type: 'text', hint: '空格分隔或 all', desc: '聚合口当 Trunk 用，放通业务 VLAN。' },
            member1: { label: '成员口 1', value: 'GigabitEthernet0/0/23', type: 'text', hint: '物理口', desc: '两端要交叉连（本端 23 对对端 23 或 24 都行，只要成对）。' },
            member2: { label: '成员口 2', value: 'GigabitEthernet0/0/24', type: 'text', hint: '物理口', desc: '成员口的速率、双工、VLAN 配置必须一致，否则起不来。' }
          },
          docs: {
            secs: [
              { h: '顺序别搞反', p: '先建 Eth-Trunk 并配好 Trunk/allow-pass，再把成员口加进去。成员口会继承聚合口的配置——反过来配，端口上的配置会被覆盖掉。' },
              { h: 'lacp-static vs manual', p: 'lacp-static 是标准 LACP 协商（推荐），对端也要 LACP 才能起来；manual 是手工负载分担，不协商，一端配了就能通但容易配错。' },
              { h: '别用动态 LACP（官方警告）', p: '官方原文：手工模式适用于对端不支持 LACP 的场景；动态 LACP 仅用于华为设备与服务器互连；其他场景建议静态 LACP，部署动态 LACP 网络会有成环风险。所以日常组网只有 manual 和 lacp-static 两个选项。' },
              { h: '两端模式必须一致', p: '官方要求：本端和对端的聚合模式要相同。一边 lacp-static 一边 manual，成员口会一直处于未选中状态，display eth-trunk 能看到但流量不走。' },
              { h: '起不来的原因', ul: ['成员口速率/双工不一致', '成员口上已有其他业务配置', '对端没配聚合或模式不同（一边 LACP 一边 manual）', '成员口数量超过设备上限'] }
            ],
            src: { n: '华为官方 · 创建 Eth-Trunk 并配置链路聚合模式', u: 'https://support.huawei.com/hedex/api/pages/EDOC1100510632/AZP0930P/01/resources/vrp_eth-trunk_cfg_0012.html' }
          }
        },

        /* ---------------- 16 ---------------- */
        {
          id: 'stp',
          title: '生成树：根桥 + 边缘端口',
          desc: '防止环路，同时让接终端的端口别等 30 秒。手动指定根桥比让设备自己选举可控得多。',
          tags: ['STP', '防环', '二层'],
          device: 'S5700 / S3700',
          level: '进阶',
          code: `system-view
stp mode rstp
stp root primary
stp bpdu-protection
interface {{edgeIntf}}
 stp edged-port enable
 quit
save`,
          vars: {
            edgeIntf: { label: '接终端的端口', value: 'GigabitEthernet0/0/1', type: 'text', hint: '要批量就多配几次', desc: '只给接 PC/打印机的端口开边缘端口，接交换机的口绝对不能开。' }
          },
          variants: [
            {
              id: 'root', label: '根桥 + 边缘端口',
              code: `system-view
stp mode rstp
stp root primary
stp bpdu-protection
interface {{edgeIntf}}
 stp edged-port enable
 quit
save`
            },
            {
              id: 'backup', label: '备用根桥',
              code: `system-view
stp mode rstp
stp root secondary
stp bpdu-protection
interface {{edgeIntf}}
 stp edged-port enable
 quit
save`
            },
            {
              id: 'loop', label: '端口被 STP 阻塞',
              code: `# 先看清楚是被谁阻塞的
display stp brief

# 强制某个口不做生成树计算（接终端时用）
system-view
interface {{edgeIntf}}
 stp edged-port enable
 quit

# 需要临时放开某端口（确认无环再动）
display stp interface {{edgeIntf}}`
            }
          ],
          docs: {
            secs: [
              { h: '为什么接终端要开边缘端口', p: '普通端口参与生成树计算，链路 up 后要经历 Listening → Learning → Forwarding，RSTP 约 30 秒才转发。终端会在这段时间里拿不到 DHCP、上不了网。边缘端口直接进转发状态。' },
              { h: 'bpdu-protection 到底做什么', p: '这里有两层，别混。默认行为：边缘端口一旦收到 BPDU（说明对面接的是交换机不是终端，可能形成环路），会自动降级成普通端口，重新参与 STP 计算——端口不会关，只是"来了就转发"的待遇没了。加了 stp bpdu-protection 才是真的狠：收到 BPDU 直接把端口 err-down 关掉。官方在 FAQ 里明说，正是因为有"自动降级"这层兜底，才推荐把用户侧端口都设成边缘端口。代价：err-down 的端口要手动 undo shutdown，或者配 error-down auto-recovery 自动恢复。' },
              { h: '想彻底不参与 STP 还有一招', p: '端口下 stp disable 会让它一直保持转发、完全不跑生成树。风险比边缘端口大得多——它连"收到 BPDU 自动降级"这层保护都没有。所以官方建议优先用边缘端口，stp disable 只留给确实不需要 STP 的口。' },
              { h: '根桥要手动定', p: '不指定的话按优先级+MAC 自动选，结果常常不是你想要的那台。核心交换机 stp root primary，备用核心 stp root secondary。' },
              { h: '两个数值记牢', p: '官方定义：stp root primary 配完后本设备优先级自动变成 0；stp root secondary 自动变成 4096。同一台设备不能既当根桥又当备份根桥——要改优先级得先 undo stp root。' },
              { h: '还要配 TC 保护', p: '边缘端口接的终端一断一接就产生一次 TC，终端频繁 up/down 时 TC 会泛滥，整网 MAC 表被反复清空。官方加固建议：stp tc-protection，和边缘端口一起配。' }
            ],
            src: { n: '华为官方 · 配置 STP/RSTP（S5700 V200R011C10 以太网交换）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/538c74bc' }
          }
        },

        /* ---------------- 17 ---------------- */
        {
          id: 'telnet-ssh',
          title: '开启 SSH 远程管理',
          desc: '关掉明文 Telnet，用 SSH 登录。顺带建管理账号。开局安全加固的第一步。',
          tags: ['SSH', '管理', '安全'],
          device: 'S5700 / AR 系列',
          level: '进阶',
          code: `system-view
rsa local-key-pair create
stelnet server enable
aaa
 local-user {{user}} password irreversible-cipher {{password}}
 local-user {{user}} privilege level {{level}}
 local-user {{user}} service-type ssh
 quit
user-interface vty 0 4
 authentication-mode aaa
 protocol inbound ssh
 quit
save`,
          vars: {
            user: { label: '管理账号', value: 'netadmin', type: 'text', hint: '别用 admin', desc: '建议用个人专属账号，出问题能追溯到人。' },
            password: { label: '密码', value: 'ChangeMe_2026!', type: 'text', hint: '12 位以上混合', desc: 'irreversible-cipher 表示密文存储，display 时看到的不是明文。' },
            level: { label: '权限级别', value: '15', type: 'int', min: 0, max: 15, hint: '0–15，15 是管理级', desc: '15 是最高权限，能执行所有命令。只做巡检的账号给 1 或 5 就够。' }
          },
          docs: {
            secs: [
              { h: '为什么必须换 SSH', p: 'Telnet 的用户名和密码在网络上是明文传输，抓包就能看到。SSH 全程加密。生产设备只开 SSH 是基本要求。' },
              { h: 'protocol inbound ssh 的效果', p: '这一行配上去之后，VTY 线路只接受 SSH 连接，Telnet 直接被拒。等于顺手关掉了 Telnet，不用额外配 undo telnet server enable。' },
              { h: '第一次连不上', ul: ['stelnet server enable 忘了配', '没生成密钥对（rsa local-key-pair create）', '账号的 service-type 不是 ssh', '客户端用旧算法，需要在 ssh server 侧加兼容算法'] }
            ],
            src: { n: '华为官方 · 配置通过 STelnet 登录设备', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1100333467/5a7baebd' }
          }
        },

        /* ---------------- 18 ---------------- */
        {
          id: 'port-security',
          title: '端口安全：限制 MAC 数量',
          desc: '一个接入口只允许指定数量的 MAC，超了就惩罚。防私接路由器、防 MAC 泛洪。',
          tags: ['安全', 'MAC', '接入'],
          device: 'S5700 / S3700',
          level: '进阶',
          code: `system-view
interface {{intf}}
 port-security max-mac-num {{maxMac}}
 port-security enable
 port-security protect-action {{action}}
 quit
save`,
          vars: {
            intf: { label: '接入口', value: 'GigabitEthernet0/0/1', type: 'text', hint: '接终端的端口', desc: '只配接入口，不要配级联口/Trunk 口，否则会把正常流量挡住。' },
            maxMac: { label: '最大 MAC 数', value: '1', type: 'int', min: 1, max: 1024, hint: '接一台 PC 就填 1', desc: '超过这个数量的新 MAC 会触发 protect-action。接交换机的话要留余量。' },
            action: { label: '超限动作', value: 'restrict', type: 'text', hint: 'restrict / protect / shutdown', desc: 'restrict=丢弃并告警（推荐）；protect=静默丢弃；shutdown=直接关端口，最狠但要手动恢复。' },
            mac: { label: '绑定的 MAC', value: '5489-98a1-2b3c', type: 'text', hint: '格式 xxxx-xxxx-xxxx', desc: '要长期绑定的终端 MAC，在交换机上用 display mac-address 查到后填这里。' }
          },
          variants: [
            {
              id: 'count', label: '限 MAC 数量',
              code: `system-view
interface {{intf}}
 port-security max-mac-num {{maxMac}}
 port-security enable
 port-security protect-action {{action}}
 quit
save`
            },
            {
              id: 'sticky', label: '粘滞 MAC 绑定',
              code: `system-view
interface {{intf}}
 port-security max-mac-num {{maxMac}}
 port-security enable
 port-security mac-address sticky
 port-security protect-action {{action}}
 quit
save`
            },
            {
              id: 'static', label: '手工绑定 MAC',
              code: `system-view
interface {{intf}}
 port-security max-mac-num 1
 port-security enable
 port-security mac-address sticky {{mac}}
 quit
save`
            }
          ],
          docs: {
            secs: [
              { h: '顺序不能反（官方明确要求）', ul: [
                '必须先 port-security max-mac-num N，再 port-security enable。',
                '官方文档原文：接口下已有多个用户在线时反向操作，会导致这些用户下线，仅保留 1 个。',
                '原因：enable 的瞬间就按当时的 MAC 上限生效，缺省上限是 1，多出来的在线用户直接判为超限。'
              ] },
              {
                h: '三种动作的区别',
                ul: [
                  '不配这行时，官方缺省动作就是 restrict。',
                  'restrict：丢弃超限报文并上报告警，官方推荐的也是这个——出了问题能查到日志。',
                  'protect：只丢弃，不上报告警。静默处理，事后查不到痕迹。',
                  'shutdown：接口直接置为 error-down 并告警。默认不会自动恢复，要用 restart 命令重启接口才能救回来（不是 undo shutdown）。想让它自己恢复，得先配 error-down auto-recovery cause port-security interval 指定延时。'
                ]
              },
              { h: 'sticky 是什么', p: '粘滞 MAC：端口学到的第一个 MAC 会被写进配置并长期绑定，换设备就上不了网。适合固定办公位，不适合会议室和临时工位。' },
              { h: '别配错地方', p: '在级联口或 Trunk 口上配 max-mac-num，会把下挂所有终端的 MAC 都算进来，很容易误封。' },
              { h: '和这些功能互斥', p: '官方前置条件：端口安全不能和基于接口的 MAC 学习限制、MUX VLAN、MAC 认证、802.1X 认证、DHCP Snooping 的 MAC 安全功能同时使用，配之前要先关掉。' }
            ],
            src: { n: '华为官方 · 配置端口安全示例（S5700 V200R011C10 安全分册）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178157/e7b747b0' }
          }
        },

        /* ---------------- 19 ---------------- */
        {
          id: 'nat-server',
          title: 'NAT Server 端口映射',
          desc: '让外网能访问内网的 Web / 远程桌面。和 Easy IP 方向相反：那个是出，这个是进。',
          tags: ['NAT', '映射', '出口'],
          device: 'AR 系列路由器',
          level: '进阶',
          code: `system-view
interface {{outside}}
 nat server protocol tcp global {{publicIp}} {{publicPort}} inside {{privateIp}} {{privatePort}}
 quit
save`,
          vars: {
            outside: { label: '外网接口', value: 'GigabitEthernet0/0/0', type: 'text', hint: 'WAN 侧接口', desc: '映射规则挂在这个接口上。' },
            publicIp: { label: '公网地址', value: '202.1.1.10', type: 'text', hint: '可写 current-interface', desc: '写 current-interface 表示用出接口自己的地址，省去填具体 IP。' },
            publicPort: { label: '公网端口', value: '8080', type: 'int', min: 1, max: 65535, hint: '外网访问的端口', desc: '不要和路由器自身占用的端口冲突（如 80 管理口）。' },
            privateIp: { label: '内网服务器', value: '192.168.10.100', type: 'text', hint: '真实服务器地址', desc: '映射的目标，通常是内网服务器的固定 IP。' },
            privatePort: { label: '内网端口', value: '80', type: 'int', min: 1, max: 65535, hint: '服务器实际监听端口', desc: '可以和公网端口不同，比如公网 8080 → 内网 80。' }
          },
          variants: [
            {
              id: 'ip', label: '指定公网 IP',
              code: `system-view
interface {{outside}}
 nat server protocol tcp global {{publicIp}} {{publicPort}} inside {{privateIp}} {{privatePort}}
 quit
save`
            },
            {
              id: 'cur', label: '用出接口地址',
              code: `system-view
interface {{outside}}
 nat server protocol tcp global current-interface {{publicPort}} inside {{privateIp}} {{privatePort}}
 quit
save`
            }
          ],
          docs: {
            secs: [
              { h: '和 Easy IP 的方向区别', p: 'nat outbound 是内网主动出去（源地址转换）；nat server 是外网主动进来（目的地址转换）。两种可以同时配，互不影响。' },
              { h: '映射不通排查顺序', ul: ['ACL 是否把入方向挡了（NAT server 优先于 ACL，但仍要确认）', '服务器自身防火墙（Windows 防火墙最常见）', '服务器网关是否指向这台路由器', '运营商是否封了该端口（80/443 常见）'] },
              {
                h: '内网访问自己的公网 IP 不通',
                p: '官方明确说过这件事：内网主机用内网地址访问服务器能通，用服务器的公网 IP 地址访问就不通——除非另外配源 NAT 做回程转换。这就是 NAT 回环（hairpin）问题。很多人以为是映射配错了，其实映射是对的，缺的是内网侧那一层。'
              },
              {
                h: '别配全端口映射',
                p: '官方提醒：用 current-interface 把全部端口映射给内网服务器后，公网用户就再也访问不到这台 AR 路由器自己的 Web 管理界面和其他服务了——所有端口都被转走了。只有一个公网 IP 时，务必指定端口，不要图省事做全映射。'
              },
              { h: '安全提醒', p: '把内网 RDP(3389) 映射到公网等于开门。至少要换高端口 + 强密码，或者干脆用 VPN。' }
            ],
            src: { n: '华为官方 · 用户无法访问内部服务器故障处理', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1100479885' }
          }
        },

        /* ---------------- 20 ---------------- */
        {
          id: 'diag-commands',
          title: '排障命令速查',
          desc: '不带配置，纯查询。网络不通时按这个顺序敲，比乱猜快得多。',
          tags: ['排障', '查询', 'display'],
          device: 'S5700 / AR 系列',
          level: '入门',
          code: `# ① 接口状态：谁 up 谁 down，有没有错包
display interface brief
display interface {{intf}}

# ② 二层：VLAN 里有哪些口、端口 PVID 对不对
display vlan
display port vlan
display mac-address

# ③ 三层：有没有地址、有没有路由、ARP 学到了吗
display ip interface brief
display ip routing-table
display arp

# ④ 设备健康
display cpu-usage
display logbuffer`,
          vars: {
            intf: { label: '看哪个接口', value: 'GigabitEthernet0/0/1', type: 'text', hint: '要看具体端口时填', desc: 'display interface 后面跟端口名，能看到收发字节、错包、CRC 计数。' },
            dest: { label: '查哪个网段', value: '192.168.20.0', type: 'text', hint: '路由查询的目标网段', desc: 'display ip routing-table 后面跟网段，只看去这个地方走哪条路。' }
          },
          variants: [
            {
              id: 'l2', label: '二层不通',
              code: `# 端口是不是 up、有没有错包
display interface brief
display interface {{intf}}

# 端口在哪个 VLAN、PVID 对不对
display port vlan
display vlan

# MAC 学到了吗（学不到说明二层根本没通）
display mac-address`
            },
            {
              id: 'l3', label: '三层不通',
              code: `# 接口有没有 IP、是不是 up
display ip interface brief

# 有没有到目的网段的路由
display ip routing-table {{dest}}

# ARP 学到了吗（学不到说明对端没回）
display arp

# 路由协议邻居正常吗
display ospf peer brief`
            },
            {
              id: 'health', label: '设备异常',
              code: `# CPU / 内存有没有打满
display cpu-usage
display memory-usage

# 最近发生了什么（看日志时间戳）
display logbuffer

# 配置有没有被改过（对比当前配置和保存的配置）
display current-configuration
display saved-configuration`
            }
          ],
          docs: {
            secs: [
              { h: '排障的顺序比命令重要', p: '从下往上：物理（接口 up？错包？）→ 二层（VLAN/MAC 学到没）→ 三层（IP/路由/ARP）→ 应用。跳层查会浪费大量时间。' },
              { h: 'display 和 display current-configuration 的区别', p: '前者查运行状态（实时），后者查配置（意图）。两者不一致往往就是问题所在：配置写了但没生效，说明状态层面有阻塞。' },
              { h: 'eNSP 里的小技巧', p: '在任意视图下打 display this 只看当前视图的配置；undo terminal monitor 关掉日志刷屏，否则调试信息一直打断你敲命令。' }
            ],
            src: { n: '华为官方 · S 系列交换机命令参考', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178145' }
          },
          flow: 'vlan-troubleshoot'
        }
      ]
    },

    /* ============================================================ */
    {
      id: 'linux',
      name: 'Linux',
      sub: '命令与服务',
      icon: 'term',
      items: [
        {
          id: 'ssh-key',
          title: 'SSH 免密登录',
          desc: '生成密钥、推到服务器、直接登录。之后 scp、git、部署脚本都不用再输密码。',
          tags: ['SSH', '密钥', '运维'],
          device: 'Linux / macOS',
          level: '入门',
          code: `# 1. 本机生成密钥（一路回车即可）
ssh-keygen -t ed25519 -C "{{comment}}"

# 2. 把公钥推到服务器
ssh-copy-id {{user}}@{{host}}

# 3. 直接登录
ssh {{user}}@{{host}}`,
          vars: {
            comment: { label: '密钥备注', value: 'me@laptop', type: 'text', hint: '建议写清机器/用途', desc: '只是注释，方便以后在 authorized_keys 里认出这是哪台机器的密钥。' },
            user: { label: '用户名', value: 'root', type: 'text', hint: '目标服务器账号', desc: '生产环境建议用普通用户 + sudo，不要长期用 root 登录。' },
            host: { label: '主机', value: '192.168.1.10', type: 'text', hint: 'IP 或域名', desc: '配过 ~/.ssh/config 的话这里可以写别名。' }
          },
          docs: {
            secs: [
              { h: '为什么用 ed25519', p: '比 RSA 密钥更短、签名更快，同等安全强度。老系统（OpenSSH < 6.5）不支持时才退回 rsa -b 4096。' },
              { h: 'ssh-copy-id 做了什么', p: '把 ~/.ssh/id_ed25519.pub 追加到服务器的 ~/.ssh/authorized_keys，并帮你修好权限。' },
              { h: '推完还是要输密码？', ul: [
                '服务器 ~/.ssh 权限必须是 700，authorized_keys 必须是 600 — 权限过宽 sshd 会直接忽略',
                '服务器 /etc/ssh/sshd_config 里 PubkeyAuthentication 要是 yes',
                '改完配置记得 systemctl restart sshd'
              ] }
            ],
            src: { n: 'OpenSSH Manual · ssh-keygen / ssh-copy-id', u: 'https://www.openssh.com/manual.html' }
          }
        },
        {
          id: 'systemd-service',
          title: 'systemd 部署一个服务',
          desc: '把自己的脚本/程序做成系统服务：开机自启、崩溃自动重启、日志进 journalctl。',
          tags: ['systemd', '部署', '服务'],
          device: 'Ubuntu / CentOS',
          level: '进阶',
          code: `# /etc/systemd/system/{{unitName}}.service
[Unit]
Description={{desc}}
After=network.target

[Service]
Type=simple
User={{user}}
WorkingDirectory={{workdir}}
ExecStart={{exec}}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target

# 启用
sudo systemctl daemon-reload
sudo systemctl enable --now {{unitName}}`,
          vars: {
            unitName: { label: '服务名', value: 'myapp', type: 'text', hint: '文件名要和它一致', desc: '文件名、Description、systemctl 命令里的名字要统一，否则会找不到服务。' },
            desc: { label: '描述', value: 'My Python API', type: 'text', hint: '一句人话', desc: 'systemctl status 时会显示这行。' },
            user: { label: '运行用户', value: 'www-data', type: 'text', hint: '别用 root', desc: '最小权限原则。要绑 80 端口可以用 capabilities 或者前置 nginx。' },
            workdir: { label: '工作目录', value: '/opt/myapp', type: 'text', hint: '程序的绝对路径', desc: '相对路径的读写都基于这里，配错会导致找不到配置文件。' },
            exec: { label: '启动命令', value: '/opt/myapp/venv/bin/python /opt/myapp/main.py', type: 'text', hint: '必须是绝对路径', desc: 'systemd 不做 PATH 展开，写 python 会失败——用完整路径。' }
          },
          docs: {
            secs: [
              { h: 'Type 怎么选', p: 'simple（默认）适用于前台常驻进程；forking 用于自己 daemon 化的老程序；oneshot 用于跑完就退出的任务。' },
              { h: '配完不生效的三个原因', ul: ['改了文件没执行 systemctl daemon-reload', 'ExecStart 用了相对路径或裸命令名', 'User 指定的用户没有目录读权限'] },
              { h: '看日志', p: 'journalctl -u myapp -f 实时跟；-n 100 看最近 100 行；--since "10 min ago" 按时间。' }
            ],
            src: { n: 'systemd.service 手册', u: 'https://www.freedesktop.org/software/systemd/man/systemd.service.html' }
          }
        },
        {
          id: 'nginx-proxy',
          title: 'Nginx 反向代理',
          desc: '把域名/端口转到后端服务，顺便解决跨域、HTTPS、静态资源。最小可用配置。',
          tags: ['Nginx', '反代', '部署'],
          device: 'Nginx 1.18+',
          level: '进阶',
          code: `server {
    listen {{port}};
    server_name {{domain}};

    location / {
        proxy_pass http://{{upstream}};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`,
          vars: {
            port: { label: '监听端口', value: '80', type: 'int', min: 1, max: 65535, hint: '80 / 443 / 自定义', desc: '80 需要 root 或 capabilities。本地调试常用 8080 避免冲突。' },
            domain: { label: '域名', value: 'example.com', type: 'text', hint: '含子域，或写 _', desc: '写 _ 表示匹配任意域名（默认站点常用）。' },
            upstream: { label: '后端地址', value: '127.0.0.1:8000', type: 'text', hint: 'host:port，不带 http://', desc: 'proxy_pass 后面已经写了 http://，这里不要再重复，否则会拼成 http://http://。' }
          },
          docs: {
            secs: [
              { h: 'proxy_set_header 为什么必须写', p: '不传这些头，后端看到的客户端 IP 永远是 127.0.0.1，日志、限流、鉴权全都会错。Host 不传则后端可能拒绝请求或跳错域名。' },
              { h: 'location / 与 location /api/', p: '前缀越长优先级越高。/api/ 下的请求会走更精确的块。注意 proxy_pass 末尾有无斜杠会影响路径拼接方式。' },
              { h: '改完必须做的事', p: 'nginx -t 先测语法，再 systemctl reload nginx 平滑生效。直接 restart 会断连接。' }
            ],
            src: { n: 'Nginx 官方文档 · proxy_pass', u: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html' }
          }
        },
        {
          id: 'cron',
          title: 'crontab 定时任务',
          desc: '定时备份、定时清理、定时健康检查。五个字段的顺序永远是第一个踩的坑。',
          tags: ['定时', 'cron', '运维'],
          device: 'Linux / macOS',
          level: '入门',
          code: `# crontab -e 编辑（当前用户）
# 分 时 日 月 周  命令

# 每天 {{hour}}:{{minute}} 执行
{{minute}} {{hour}} * * * {{script}} >> /var/log/cron.log 2>&1

# 每 5 分钟检查一次
*/5 * * * * {{script}}

# 每周一 3:30 清理 {{days}} 天前的日志
30 3 * * 1 find {{logDir}} -name "*.log" -mtime +{{days}} -delete`,
          vars: {
            minute: { label: '分钟', value: '0', type: 'int', min: 0, max: 59, hint: '0–59', desc: '*/5 表示每 5 分钟，0,30 表示整点和半点。' },
            hour: { label: '小时', value: '8', type: 'int', min: 0, max: 23, hint: '0–23，24 小时制', desc: '注意是 24 小时制，晚上 8 点写 20。' },
            script: { label: '脚本路径', value: '/opt/app/daily.sh', type: 'text', hint: '必须绝对路径', desc: 'cron 的 PATH 极简，写相对命令名会找不到。这也是「手动能跑、定时不跑」的头号原因。' },
            logDir: { label: '日志目录', value: '/var/log/app', type: 'text', hint: '要清理的目录', desc: 'find 只删文件不动目录，配合 -delete 使用。' },
            days: { label: '保留天数', value: '7', type: 'int', min: 1, max: 365, hint: '-mtime +N', desc: '7 表示保留最近 7 天，更早的删掉。' }
          },
          docs: {
            secs: [
              { h: '五个字段的顺序', p: '分 时 日 月 周。最常错的是把分和时写反（想 8:00 写成 0 8 是对的，写成 8 0 就变成 0:08）。周的范围是 0–7，0 和 7 都表示周日。' },
              { h: '手动能跑，定时不跑', ul: ['cron 环境里 PATH 只有 /usr/bin:/bin，用绝对路径', '脚本没有执行权限（chmod +x）', '脚本里的相对路径基于 cron 的起始目录，不是脚本所在目录', '没有重定向输出，出错也看不到', '服务没启动：systemctl status cron / crond'] },
              { h: '>> 2>&1 是什么意思', p: '把标准输出追加到日志文件，2>&1 表示错误输出也进同一个文件。不写这个，cron 会尝试给你发邮件，多数机器上邮件服务没配，输出就丢了。' }
            ],
            src: { n: 'crontab(5) man page', u: 'https://man7.org/linux/man-pages/man5/crontab.5.html' }
          }
        },
        {
          id: 'docker-run',
          title: 'docker run 一条命令起服务',
          desc: '带开机自启、端口映射、目录挂载、环境变量的完整写法。少写一个参数就要重来一次。',
          tags: ['Docker', '部署', '容器'],
          device: 'Docker 20+',
          level: '入门',
          code: `docker run -d \\
  --name {{name}} \\
  --restart={{restart}} \\
  -p {{hostPort}}:{{containerPort}} \\
  -v {{hostDir}}:{{containerDir}} \\
  -e {{envKey}}={{envVal}} \\
  {{image}}

# 看日志 / 进容器 / 停掉
docker logs -f {{name}}
docker exec -it {{name}} /bin/sh
docker stop {{name}} && docker rm {{name}}`,
          vars: {
            name: { label: '容器名', value: 'myapp', type: 'text', hint: '唯一的容器名', desc: '起名字的目的是后面 logs/exec/stop 能用名字而不是一串哈希。' },
            restart: { label: '重启策略', value: 'always', type: 'text', hint: 'always / unless-stopped', desc: 'always 会开机自启；unless-stopped 在你手动 stop 后不会再拉起，调试时更好用。' },
            hostPort: { label: '宿主端口', value: '8080', type: 'int', min: 1, max: 65535, hint: '外面访问的端口', desc: '被占用会启动失败，换一个或者先 lsof -i:8080 看谁占着。' },
            containerPort: { label: '容器端口', value: '80', type: 'int', min: 1, max: 65535, hint: '程序在容器里监听的端口', desc: '要和程序实际监听的端口一致，写错就是 curl 不通。' },
            hostDir: { label: '宿主目录', value: '/opt/app/data', type: 'text', hint: '绝对路径', desc: '不挂载的话容器删了数据就没了。建议用绝对路径，相对路径会被当成卷名。' },
            containerDir: { label: '容器目录', value: '/app/data', type: 'text', hint: '容器内路径', desc: '程序读写数据的路径。' },
            envKey: { label: '环境变量名', value: 'TZ', type: 'text', hint: '大写+下划线', desc: '时区 TZ=Asia/Shanghai 是必配的，否则日志时间全是 UTC。' },
            envVal: { label: '环境变量值', value: 'Asia/Shanghai', type: 'text', hint: '按需填写', desc: '多个变量就写多个 -e，一行一个。' },
            image: { label: '镜像', value: 'nginx:1.27-alpine', type: 'text', hint: '建议带版本号', desc: '不要用 latest —— 下次拉取可能就变了，线上事故的常见来源。' }
          },
          docs: {
            secs: [
              { h: '-d 和 --restart 是两件事', p: '-d 表示后台运行（脱离终端）；--restart 表示异常退出或重启机器后自动拉起。只写 -d，机器重启容器就没了。' },
              { h: '-p 宿主:容器 的顺序', p: '左边是宿主机端口，右边是容器内端口。写反了本地 curl localhost:8080 会通不到的端口。' },
              { h: '容器起来又立刻退出的排查', ul: ['docker logs 看报错', 'docker ps -a 看退出码（137 = 被 OOM 杀，1 = 程序自己报错）', '前台程序是否真的在前台跑（守护进程模式会让容器认为主进程结束）', '端口冲突 / 配置目录权限'] }
            ],
            src: { n: 'Docker 官方文档 · docker run', u: 'https://docs.docker.com/reference/cli/docker/container/run/' }
          }
        },
        {
          id: 'firewall',
          title: '开放端口（firewalld / ufw）',
          desc: '服务起在服务器上，外面连不进来，八成是防火墙。两套常见系统的写法都在下面。',
          tags: ['防火墙', '端口', '运维'],
          device: 'CentOS / Ubuntu',
          level: '入门',
          code: `# firewalld（CentOS / RHEL）
firewall-cmd --permanent --add-port={{port}}/tcp
firewall-cmd --reload
firewall-cmd --list-ports`,
          vars: {
            port: { label: '端口', value: '8080', type: 'int', min: 1, max: 65535, hint: '要开放的端口', desc: '数据库端口（3306/6379）不要对全网开放，限定来源 IP 更安全。' }
          },
          variants: [
            {
              id: 'firewalld', label: 'firewalld',
              code: `# CentOS / RHEL
firewall-cmd --permanent --add-port={{port}}/tcp
firewall-cmd --reload
firewall-cmd --list-ports

# 只允许某个网段访问
firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=192.168.1.0/24 port port={{port}} protocol=tcp accept'
firewall-cmd --reload`
            },
            {
              id: 'ufw', label: 'ufw',
              code: `# Ubuntu / Debian
ufw allow {{port}}/tcp
ufw status verbose

# 只允许某个来源
ufw allow from 192.168.1.0/24 to any port {{port}} proto tcp

# 开放后确认
ufw status numbered`
            },
            {
              id: 'check', label: '连不上先自检',
              code: `# 1. 服务真的在监听吗（0.0.0.0 才对，127.0.0.1 外面连不进来）
ss -lntp | grep {{port}}

# 2. 本机能通吗
curl -I http://127.0.0.1:{{port}}

# 3. 防火墙放通了吗
firewall-cmd --list-ports
ufw status

# 4. 云服务器还有一层安全组，要单独配`
            }
          ],
          docs: {
            secs: [
              { h: '--permanent 必须配 --reload', p: '不带 --permanent 的规则重启就没了；带了 --permanent 不 reload 又不生效。两个都要写。' },
              { h: '云服务器是两层', p: '本机防火墙放通只是第一层，阿里云/腾讯云还有安全组，必须去控制台再放通一次。只配一层的现象是：本机 curl 通，外面死活连不上。' },
              { h: '监听地址比防火墙更常被忽略', p: 'ss -lntp 看到 127.0.0.1:8080 说明服务只绑了本地回环，防火墙开成筛子也没用。要改成 0.0.0.0 或具体网卡地址。' }
            ],
            src: { n: 'firewalld / ufw 官方文档', u: 'https://firewalld.org/documentation/' }
          }
        },
        {
          id: 'disk-full',
          title: '磁盘满了怎么查',
          desc: 'df 看到 100%，du 找不到大文件？可能文件被删了但进程还握着。这套命令按顺序过一遍。',
          tags: ['磁盘', '排障', '运维'],
          device: 'Linux',
          level: '进阶',
          code: `# ① 哪个分区满了
df -h

# ② 谁吃的空间最大（逐层往下钻）
du -sh /* 2>/dev/null | sort -h | tail -10
du -sh /var/* 2>/dev/null | sort -h | tail -10

# ③ 找大文件（超过 {{size}}）
find / -xdev -type f -size +{{size}} -exec ls -lh {} \\; 2>/dev/null | sort -k5 -h | tail -20

# ④ 关键：文件删了但空间没释放
lsof +L1 | head -20

# ⑤ 日志占大头时先压缩而不是删
journalctl --vacuum-size=200M`,
          vars: {
            size: { label: '大文件阈值', value: '500M', type: 'text', hint: '500M / 1G', desc: 'find -size 支持 M/G 单位。阈值太小会刷屏。' }
          },
          docs: {
            secs: [
              { h: '删了文件，df 还是 100%', p: '进程还在写这个文件句柄，inode 没释放，空间就不会还回来。用 lsof +L1 找到持有已删除文件的进程，重启该进程即可释放。不查这一步，你会一直以为 du 算错了。' },
              { h: 'du 和 df 对不上', ul: ['已删除但被占用的文件（lsof +L1）', '挂载点被另一个文件系统覆盖，du 看不到', 'inode 用尽：df -i 看 IUse%，满了也会写不进去但显示还有空间'] },
              { h: '-xdev 为什么要加', p: '不加 -xdev 会扫到 /proc、/sys 和挂载的其他分区，又慢又容易报一堆权限错误。' }
            ],
            src: { n: 'man df / du / lsof', u: 'https://man7.org/linux/man-pages/man1/df.1.html' }
          }
        }
      ]
    },

    /* ============================================================ */
    {
      id: 'mysql',
      name: 'MySQL',
      sub: '建表与授权',
      icon: 'db',
      items: [
        {
          id: 'create-table',
          title: '建一张规范的用户表',
          desc: '带主键、索引、注释、utf8mb4 的建表模板，直接改成自己的字段就能用。',
          tags: ['建表', 'DDL', '规范'],
          device: 'MySQL 8.0',
          level: '入门',
          code: `CREATE TABLE {{table}} (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  name VARCHAR({{nameLen}}) NOT NULL COMMENT '姓名',
  email VARCHAR(120) DEFAULT NULL COMMENT '邮箱',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_email (email),
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='{{tableComment}}';`,
          vars: {
            table: { label: '表名', value: 'users', type: 'text', hint: '小写下划线', desc: '建议用业务名词复数：users / orders / order_items。' },
            nameLen: { label: '姓名长度', value: '64', type: 'int', min: 8, max: 255, hint: 'VARCHAR 长度', desc: '中文姓名 64 足够；要存昵称可以放宽到 128。' },
            tableComment: { label: '表备注', value: '用户表', type: 'text', hint: '给人看的', desc: '一定要写。半年后回头看表结构，注释能救你。' }
          },
          docs: {
            secs: [
              { h: '为什么是 utf8mb4', p: 'MySQL 的 utf8 实际上是 utf8mb3，只支持 3 字节，存不了 emoji 和部分生僻字。utf8mb4 才是完整 UTF-8。' },
              { h: 'BIGINT UNSIGNED 主键', p: '自增整型主键插入快、索引小。UNSIGNED 把上限从 922 亿提到 1844 亿。分布式场景再换雪花 ID。' },
              { h: '索引别乱加', ul: ['主键自动有聚簇索引', '唯一约束用 UNIQUE KEY', '普通检索列用 KEY，但低选择性的列（如性别）加了反而拖慢写入'] }
            ],
            src: { n: 'MySQL 8.0 Reference · CREATE TABLE', u: 'https://dev.mysql.com/doc/refman/8.0/en/create-table.html' }
          }
        },
        {
          id: 'grant-user',
          title: '创建用户并授权',
          desc: '只给该给的权限：建账号、授库级权限、立即生效。别再用 root 连业务。',
          tags: ['权限', '账号', '安全'],
          device: 'MySQL 8.0',
          level: '入门',
          code: `CREATE USER '{{user}}'@'{{host}}' IDENTIFIED BY '{{password}}';
GRANT {{privileges}} ON {{database}}.* TO '{{user}}'@'{{host}}';
FLUSH PRIVILEGES;`,
          vars: {
            user: { label: '用户名', value: 'app_user', type: 'text', hint: '业务专用账号', desc: '一个应用一个账号，出问题好定位、好回收。' },
            host: { label: '来源主机', value: '192.168.1.%', type: 'text', hint: '% 为任意，或具体 IP', desc: '生产上别写 %，限制到应用服务器的网段更安全。' },
            password: { label: '密码', value: 'ChangeMe_2026!', type: 'text', hint: '强密码', desc: '这行会被复制到脚本里，注意别提交进 git。' },
            privileges: { label: '权限集', value: 'SELECT, INSERT, UPDATE, DELETE', type: 'text', hint: '逗号分隔，或 ALL PRIVILEGES', desc: '业务账号通常不需要 DROP / ALTER，DDL 交给发布流程。' },
            database: { label: '数据库', value: 'app_db', type: 'text', hint: '库名', desc: '库级授权比全局授权安全得多。' }
          },
          docs: {
            secs: [
              { h: 'MySQL 8 的密码策略', p: '8.0 默认启用 validate_password 插件，密码太简单会被拒。可以 SET GLOBAL validate_password.policy=LOW 临时放宽（生产不建议）。' },
              { h: 'FLUSH PRIVILEGES 还需要吗', p: '用 GRANT / CREATE USER 语句改权限时不需要，它只在直接改 mysql 系统表后才必要。写上也不会出错。' },
              { h: '连接到不上的排查顺序', ul: ['账号的 host 部分是否匹配来源 IP', 'bind-address 是否只监听 127.0.0.1', '防火墙 / 安全组是否放通 3306', '云数据库还要单独配白名单'] }
            ],
            src: { n: 'MySQL 8.0 Reference · GRANT', u: 'https://dev.mysql.com/doc/refman/8.0/en/grant.html' }
          }
        },
        {
          id: 'paging-query',
          title: '分页查询与执行计划',
          desc: '带 LIMIT 的分页谁都会写，但深分页会把数据库拖死。顺便用 EXPLAIN 看它到底走没走索引。',
          tags: ['查询', '分页', '优化'],
          device: 'MySQL 8.0',
          level: '进阶',
          code: `-- 普通分页（页码靠前的页没问题）
SELECT {{cols}}
FROM {{table}}
WHERE {{cond}}
ORDER BY {{orderCol}} DESC
LIMIT {{offset}}, {{size}};

-- 深分页优化：先走索引取主键，再回表
SELECT t.{{cols}}
FROM {{table}} t
JOIN (SELECT id FROM {{table}} WHERE {{cond}}
      ORDER BY {{orderCol}} DESC LIMIT {{offset}}, {{size}}) x
  ON t.id = x.id;

-- 看它到底怎么执行的
EXPLAIN SELECT * FROM {{table}} WHERE {{cond}};`,
          vars: {
            cols: { label: '查询字段', value: 'id, name, created_at', type: 'text', hint: '别用 SELECT *', desc: '明确的字段列表才能用上覆盖索引，SELECT * 更容易回表。' },
            table: { label: '表名', value: 'orders', type: 'text', hint: '小写下划线', desc: '要查的表。' },
            cond: { label: '过滤条件', value: "status = 'paid'", type: 'text', hint: '尽量走索引', desc: '条件列上有索引才能避免全表扫。' },
            orderCol: { label: '排序列', value: 'created_at', type: 'text', hint: '要有索引', desc: '排序列没索引会触发 filesort，数据量大时非常慢。' },
            offset: { label: '偏移量', value: '100000', type: 'int', min: 0, max: 10000000, hint: '跳过的行数', desc: '深分页的元凶：LIMIT 100000,20 会真的扫过前 10 万行再丢掉。' },
            size: { label: '每页条数', value: '20', type: 'int', min: 1, max: 1000, hint: '一页多少行', desc: '一页几百条以上通常说明前端设计有问题。' }
          },
          docs: {
            secs: [
              { h: '深分页为什么慢', p: 'LIMIT 100000, 20 的语义是"扫描 100020 行，丢掉前 100000 行"。偏移量越大扫得越多，和翻页深度成正比。用游标（记住上一页最后一个 id，where id > last_id）或子查询先取主键再回表，能把代价降下来。' },
              { h: '游标分页的写法', p: 'SELECT ... WHERE id > {上一页最后一条的 id} ORDER BY id LIMIT 20 —— 不管翻到第几页都是索引定位，代价恒定。代价是不能跳页。' },
              { h: 'EXPLAIN 看什么', ul: ['type：出现 ALL 就是全表扫，至少要 range / ref', 'key：实际用的索引，NULL 表示没用上', 'rows：预估扫描行数，越大越危险', 'Extra：出现 Using filesort / Using temporary 要留意'] }
            ],
            src: { n: 'MySQL 8.0 Reference · LIMIT Optimization', u: 'https://dev.mysql.com/doc/refman/8.0/en/limit-optimization.html' }
          }
        },
        {
          id: 'mysqldump',
          title: '备份与恢复（mysqldump）',
          desc: '不锁表的一致性备份，带存储过程和触发器。备份命令写错，恢复时才发现就是事故。',
          tags: ['备份', '恢复', '运维'],
          device: 'MySQL 8.0',
          level: '入门',
          code: `# 备份（--single-transaction 保证 InnoDB 一致性快照，不锁表）
mysqldump -u{{user}} -p \\
  --single-transaction \\
  --routines --triggers \\
  --default-character-set=utf8mb4 \\
  {{database}} > {{file}}.sql

# 恢复（先建库）
mysql -u{{user}} -p -e "CREATE DATABASE IF NOT EXISTS {{database}} DEFAULT CHARSET utf8mb4"
mysql -u{{user}} -p {{database}} < {{file}}.sql

# 确认备份是不是真的可用（经常被跳过的一步）
tail -3 {{file}}.sql`,
          vars: {
            user: { label: '账号', value: 'root', type: 'text', hint: '要有读权限', desc: '备份需要 SELECT、SHOW VIEW、TRIGGER、LOCK TABLES 等权限。' },
            database: { label: '数据库', value: 'app_db', type: 'text', hint: '单个库', desc: '要备份的库名。用 --all-databases 备份全部。' },
            file: { label: '备份文件名', value: 'app_db_20261027', type: 'text', hint: '建议带日期', desc: '养成 库名_日期 的命名习惯，恢复时不会挑错文件。' }
          },
          docs: {
            secs: [
              { h: '--single-transaction 的作用', p: '在一个事务里做快照，导出过程中不锁表，业务照常读写。仅对 InnoDB 有效；MyISAM 表还是会锁。' },
              { h: '-p 后面别直接跟密码', p: '写成 -p密码 会留在 shell history 和进程列表里（ps 能看到）。只写 -p 让它交互输入，或者用 ~/.my.cnf 配置。' },
              { h: '备份有没有真的成功', ul: ['tail -3 看文件末尾是否有 "Dump completed"', '文件大小是否合理（几 KB 说明导空了）', '定期做一次真实恢复演练——没恢复过的备份不算备份'] }
            ],
            src: { n: 'MySQL 8.0 Reference · mysqldump', u: 'https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html' }
          }
        }
      ]
    },

    /* ============================================================ */
    {
      id: 'python',
      name: 'Python',
      sub: '脚本片段',
      icon: 'code',
      items: [
        {
          id: 'requests-paging',
          title: '分页抓取接口',
          desc: '带超时、带状态检查、带翻页的最小可用模板。别再用裸 requests.get 了。',
          tags: ['requests', '爬虫', '接口'],
          device: 'Python 3.10+',
          level: '入门',
          code: `import requests

url = "{{url}}"
headers = {"User-Agent": "{{ua}}"}

for page in range(1, {{pages}} + 1):
    r = requests.get(url, headers=headers,
                     params={"page": page, "size": {{size}}},
                     timeout={{timeout}})
    r.raise_for_status()
    items = r.json().get("items", [])
    print(f"page {page}: {len(items)} 条")
    if not items:
        break`,
          vars: {
            url: { label: '接口地址', value: 'https://example.com/api/list', type: 'text', hint: '不含参数的基地址', desc: '参数交给 params，别自己拼字符串——编码和特殊字符会出错。' },
            ua: { label: 'User-Agent', value: 'Mozilla/5.0 (compatible; CodeAtlas/1.0)', type: 'text', hint: '标识自己', desc: '很多站点默认拒绝空 UA。写清楚自己是谁，礼貌一点。' },
            pages: { label: '总页数', value: '20', type: 'int', min: 1, max: 10000, hint: '最大翻页数', desc: '配合下面的空列表 break，可以写成一个大数当上限。' },
            size: { label: '每页条数', value: '50', type: 'int', min: 1, max: 500, hint: '分页大小', desc: '太大容易超时，太小请求次数多。50 是常见折中值。' },
            timeout: { label: '超时（秒）', value: '10', type: 'int', min: 1, max: 120, hint: '必须设', desc: '不设 timeout 的请求可能永久挂住，把整个脚本卡死。' }
          },
          docs: {
            secs: [
              { h: 'raise_for_status 的作用', p: '4xx / 5xx 默认不会抛异常，只会得到一个"看起来正常"的响应。加上它，错误才会在这里暴露。' },
              { h: 'timeout 是必填项', p: 'requests 默认无超时。网络异常时会无限等待——这是"脚本莫名卡住"最常见的原因。' },
              { h: '礼貌抓取', ul: ['控制频率，必要时 time.sleep(0.5)', '看清楚 robots.txt 与接口条款', '别把别人服务打挂，也别绕过登录鉴权'] }
            ],
            src: { n: 'Requests 官方文档 · Quickstart', u: 'https://requests.readthedocs.io/en/latest/user/quickstart/' }
          }
        },
        {
          id: 'json-config',
          title: '读写 JSON 配置',
          desc: '改配置不手抖：读进来、改一个字段、格式化写回。保留中文，缩进 2 空格。',
          tags: ['json', '配置', '文件'],
          device: 'Python 3.10+',
          level: '入门',
          code: `import json
import pathlib

path = pathlib.Path("{{path}}")
cfg = json.loads(path.read_text(encoding="utf-8"))

cfg["{{key}}"] = {{value}}

path.write_text(
    json.dumps(cfg, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print("已更新:", path)`,
          vars: {
            path: { label: '配置文件路径', value: 'config.json', type: 'text', hint: '相对脚本目录', desc: '用 pathlib 比裸字符串拼路径更安全，跨平台也不用管斜杠。' },
            key: { label: '字段名', value: 'debug', type: 'text', hint: '要改的那一项', desc: '只支持已存在的顶层字段修改；新增字段也没问题。' },
            value: { label: '新值', value: 'true', type: 'text', hint: 'JSON 字面量：true / 1 / "x"', desc: '注意这里是 JSON 语法不是 Python：true 小写，字符串要带引号。' }
          },
          docs: {
            secs: [
              { h: 'ensure_ascii=False', p: '不写这个，中文会被转成 \\u4e2d\\u6587 这种转义序列。文件本身还是合法的，但人看不懂。' },
              { h: '为什么用 pathlib', p: 'Path 对象自动处理平台路径分隔符，read_text / write_text 还帮你管好了文件开关和编码。' },
              { h: '如果要原子写', p: '先写临时文件再 os.replace，避免写到一半断电导致配置文件损坏。生产环境的配置写入建议这么干。' }
            ],
            src: { n: 'Python 文档 · json', u: 'https://docs.python.org/3/library/json.html' }
          }
        },
        {
          id: 'gen-config',
          title: '批量生成设备配置',
          desc: 'VLAN 有三十个、每台设备都要配一遍时，别再手敲。模板 + 数据行，一次生成整份配置。',
          tags: ['模板', '批量', '自动化'],
          device: 'Python 3.10+',
          level: '进阶',
          code: `import pathlib

TEMPLATE = """system-view
vlan {vid}
 description {name}
 quit
"""

rows = [
    {"vid": 10, "name": "office"},
    {"vid": 20, "name": "guest"},
    {"vid": 30, "name": "server"},
]

out = pathlib.Path("{{outFile}}")
with out.open("w", encoding="utf-8") as f:
    for r in rows:
        f.write(TEMPLATE.format(**r))

print("已生成", out, "共", len(rows), "段")`,
          vars: {
            outFile: { label: '输出文件', value: 'vlan.cfg', type: 'text', hint: '生成的配置文件', desc: '用 .cfg 便于在 eNSP 里对照，或者直接粘进设备。' }
          },
          docs: {
            secs: [
              { h: '为什么用模板而不是拼字符串', p: 'f-string 或字符串相加会把配置结构散在代码里，改一个缩进要改十处。模板把"结构"和"数据"分开，改数据不用碰结构。' },
              { h: '注意大括号', p: '这里用的是 str.format，占位符是单个大括号 {vid}。如果配置里需要输出真正的大括号（比如 JSON），要写成双大括号 {{ }} 转义。' },
              { h: '往下延伸', p: '把 rows 换成 pandas 读 Excel 的结果，就是"给一张 VLAN 规划表，自动生成全部设备配置"。再往下是加设备模板（交换机/路由器不同模板）和分段拼接。' }
            ],
            src: { n: 'Python 文档 · 字符串格式化', u: 'https://docs.python.org/3/library/string.html#format-string-syntax' }
          }
        },
        {
          id: 'excel-read',
          title: 'pandas 读 Excel 并汇总',
          desc: '把 Excel 当数据库查：读进来、清掉空行、按列分组求和。做数据核对时非常省事。',
          tags: ['pandas', 'Excel', '数据'],
          device: 'Python 3.10+ + pandas',
          level: '进阶',
          code: `import pandas as pd

df = pd.read_excel("{{path}}", sheet_name={{sheet}}, dtype=str)
df = df.dropna(how="all").dropna(axis=1, how="all")

print("行数", len(df))
print("列名", list(df.columns))
print(df.head({{rows}}))

# 按某一列汇总
print(df.groupby("{{groupCol}}")["{{valueCol}}"].agg(["count", "sum"]))`,
          vars: {
            path: { label: 'Excel 路径', value: 'data.xlsx', type: 'text', hint: '相对脚本目录', desc: 'xlsx 需要 openpyxl 依赖：pip install openpyxl。' },
            sheet: { label: '工作表', value: '0', type: 'text', hint: '0 表示第一个，也可写名字', desc: '写 0 是索引，写 "汇总" 是表名。表名写错会报错而不是静默读错表。' },
            rows: { label: '预览行数', value: '10', type: 'int', min: 1, max: 100, hint: 'head(n)', desc: '只看前几行确认列对齐了没有。' },
            groupCol: { label: '分组列', value: '部门', type: 'text', hint: '按这列分组', desc: 'Chinese 列名也能直接用，不用改英文。' },
            valueCol: { label: '求和列', value: '金额', type: 'text', hint: '要汇总的数值列', desc: '如果这列被读成字符串，sum 会变成字符串拼接——就是因为没加 dtype 控制。' }
          },
          docs: {
            secs: [
              { h: 'dtype=str 是保命的', p: 'pandas 会自动推断类型，工号 001 会变成 1，身份证号会变科学计数法，金额可能变 float 出现 0.1+0.2 精度问题。全读成 str，需要计算时再显式转换。' },
              { h: '清空行空列', p: 'Excel 里经常有大片空单元格，pandas 会当成有效数据。dropna(how="all") 删掉全空的行，dropna(axis=1, how="all") 删掉全空的列。' },
              { h: '常见报错', ul: ['Missing optional dependency "openpyxl" → pip install openpyxl', 'FileNotFoundError → 路径是相对当前工作目录，不是脚本目录', 'ValueError: Worksheet named xxx not found → 表名拼错或有多余空格'] }
            ],
            src: { n: 'pandas 文档 · read_excel', u: 'https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html' }
          }
        }
      ]
    },

    /* ============================================================ */
    {
      id: 'git',
      name: 'Git',
      sub: '版本控制',
      icon: 'git',
      items: [
        {
          id: 'git-undo',
          title: '撤销：改错了怎么退',
          desc: '改错了、暂存多了、提交早了。三种情况三种命令，用错一个就可能丢代码。',
          tags: ['撤销', 'reset', '必备'],
          device: 'Git 2.23+',
          level: '入门',
          code: `# 丢弃单个文件的未提交修改（不可恢复）
git restore {{file}}

# 不确定要不要留，先存起来
git stash

# 撤销暂存，改动还在工作区
git restore --staged {{file}}

# 本地提交回退（还没 push）
git reset --soft HEAD~1    # 改动留在暂存区
git reset --hard HEAD~1    # 改动一起丢掉（危险）

# 已经 push 了：别改历史，用反向提交
git revert {{commit}}`,
          vars: {
            file: { label: '文件路径', value: 'src/app.js', type: 'text', hint: '相对仓库根目录', desc: '写 . 表示全部文件，但那样风险大，建议先写具体文件。' },
            commit: { label: '提交号', value: 'a1b2c3d', type: 'text', hint: 'git log 里复制', desc: 'revert 会新建一个提交把这次改动抵消掉，历史完整保留。' }
          },
          variants: [
            {
              id: 'work', label: '改完没暂存',
              code: `# 看看改了什么
git diff {{file}}

# 丢弃修改（不可恢复，慎用）
git restore {{file}}

# 舍不得丢就先存起来
git stash
git stash list
git stash pop`
            },
            {
              id: 'stage', label: '暂存了没提交',
              code: `# 取消暂存，文件改动还在
git restore --staged {{file}}

# 老版本 git 的写法
git reset HEAD {{file}}

# 确认状态
git status`
            },
            {
              id: 'commit', label: '提交了（已 push）',
              code: `# 已经推到远端：不要改历史，用反向提交
git revert {{commit}}
git push

# 如果还没推，可以回退
git reset --soft HEAD~1
git commit -m "修正后的提交信息"`
            }
          ],
          docs: {
            secs: [
              { h: 'reset 和 revert 的根本区别', p: 'reset 移动分支指针，等于"历史没发生过"；revert 新建一个提交把改动反向抵消，历史保留。已经 push 的分支用 reset 会让别人的本地历史和远端分叉，所以只能用 revert。' },
              { h: '--soft / --mixed / --hard', ul: ['--soft：只动 HEAD，改动全留在暂存区', '--mixed（默认）：动 HEAD 和暂存区，改动留在工作区', '--hard：连工作区一起清空，未提交的改动永久丢失'] },
              { h: '踩过 --hard 的坑', p: 'git reset --hard 不弹确认，不产生任何备份。已经 add 但没 commit 的改动也会没。执行前先 git stash 或复制一份，成本很低。' }
            ],
            src: { n: 'Git 文档 · git-reset / git-revert', u: 'https://git-scm.com/docs/git-reset' }
          }
        },
        {
          id: 'git-branch',
          title: '开分支、提交、合并',
          desc: '一条功能线一个分支，合并前先拉最新。这套流程走顺了，主干永远不会是烂摊子。',
          tags: ['分支', '合并', '协作'],
          device: 'Git 2.23+',
          level: '入门',
          code: `# 1. 从主干开分支
git switch {{main}}
git pull
git switch -c {{branch}}

# 2. 干活并提交
git add -A
git commit -m "{{msg}}"

# 3. 合并回主干（--no-ff 保留分支痕迹）
git switch {{main}}
git pull --rebase
git merge --no-ff {{branch}}

# 4. 推送
git push origin {{main}}`,
          vars: {
            main: { label: '主干分支', value: 'main', type: 'text', hint: 'main 或 master', desc: '老仓库可能还叫 master，先 git branch 看一眼。' },
            branch: { label: '功能分支', value: 'feature/login', type: 'text', hint: 'feature/xxx 或 fix/xxx', desc: '一个分支只做一件事，名字写清做什么。' },
            msg: { label: '提交信息', value: 'feat: 新增登录接口', type: 'text', hint: '类型: 描述', desc: 'conventional commits 格式：feat/fix/docs/refactor/chore 前缀 + 中文描述。' }
          },
          docs: {
            secs: [
              { h: 'switch 和 checkout 的区别', p: 'git switch 只切分支，语义单一；git checkout 既能切分支又能还原文件，容易误用把改动弄丢。新版本优先用 switch 和 restore。' },
              { h: '--no-ff 有什么用', p: '默认的 fast-forward 合并不会产生 merge commit，历史上看不出这里曾经有过分支。--no-ff 强制生成一个合并提交，能看清"这条功能是从哪合并进来的"，排查问题很有用。' },
              { h: 'pull --rebase 的意义', p: '直接 git pull 会产生一个无意义的 "Merge branch main of ..." 提交。--rebase 把你的本地提交挪到最新的远端提交之后，历史是一条直线。注意只对还没推送的本地提交用。' }
            ],
            src: { n: 'Git 文档 · 分支与合并', u: 'https://git-scm.com/book/zh/v2/Git-%E5%88%86%E6%94%AF-%E5%88%86%E6%94%AF%E7%9A%84%E6%96%B0%E5%BB%BA%E4%B8%8E%E5%90%88%E5%B9%B6' }
          }
        },
        {
          id: 'git-conflict',
          title: '冲突解决流程',
          desc: '看到 <<<<<<< 别慌。一共四步：看清谁跟谁冲突、手动改、标记已解决、继续。',
          tags: ['冲突', 'merge', 'rebase'],
          device: 'Git 2.23+',
          level: '进阶',
          code: `# 1. 哪些文件冲突了
git status
git diff --name-only --diff-filter=U

# 2. 打开文件，会看到三段标记
#   <<<<<<< HEAD           ← 当前分支的版本
#   你的代码
#   =======
#   对方的代码
#   >>>>>>> {{branch}}     ← 被合并分支的版本

# 3. 手动改成最终想要的样子，把三行标记全删掉
git add {{file}}

# 4. 继续
git commit              # merge 过程中
git rebase --continue   # rebase 过程中

# 搞乱了想全部重来
git merge --abort
git rebase --abort`,
          vars: {
            branch: { label: '来源分支', value: 'feature/login', type: 'text', hint: '冲突标记里显示的名字', desc: '标记里 >>>>>>> 后面跟的就是它，便于判断哪段是谁写的。' },
            file: { label: '冲突文件', value: 'src/app.js', type: 'text', hint: '解决完的文件', desc: '必须 git add 才算标记为已解决，只保存文件不 add，git 仍认为冲突未解决。' }
          },
          docs: {
            secs: [
              { h: '三行标记的含义', p: '<<<<<<< 到 ======= 之间是当前分支（HEAD）的内容；======= 到 >>>>>>> 之间是合进来的分支的内容。你要做的是把这段整体替换成最终结果，然后把三行标记删干净。' },
              { h: 'rebase 时 ours / theirs 是反的', p: 'merge 时 ours = 当前分支；rebase 时因为你在"重放"自己的提交，ours = 目标分支，theirs = 你的提交。这时候用 git checkout --ours 经常拿错内容，直接手改最稳。' },
              { h: '解决完还是 "unmerged"', ul: ['没执行 git add（最常见）', '标记行没删干净，文件里还留着 <<<<<<<', 'add 的是别的文件，看 git status 里具体路径'] }
            ],
            src: { n: 'Git 文档 · 解决冲突', u: 'https://git-scm.com/book/zh/v2/Git-%E5%88%86%E6%94%AF-%E5%88%86%E6%94%AF%E7%9A%84%E6%96%B0%E5%BB%BA%E4%B8%8E%E5%90%88%E5%B9%B6#_basic_merge_conflicts' }
          }
        }
      ]
    }
  ],

  /* ============================================================
     预设库：一整套代码
     ============================================================ */
  presets: [
    {
      id: 'preset-office-lan',
      title: '单台交换机：办公 + 访客 VLAN',
      summary: '一台接入交换机同时跑两个业务 VLAN，端口批量划分，上行 Trunk 放通。中小办公室的标准开局。',
      features: ['2 个业务 VLAN', '端口组批量下发', '上行 Trunk 放通', '配完即可用'],
      scene: '一台 S5700 接入交换机，上行接到核心/路由器。12 个办公口、8 个访客口。',
      steps: [
        { ref: 'vlan-create', vars: { vlanId: '10', vlanName: 'office' }, note: '建办公 VLAN' },
        { ref: 'vlan-create', vars: { vlanId: '20', vlanName: 'guest' }, note: '建访客 VLAN' },
        { ref: 'port-group', vars: { groupName: 'office-ports', portRange: 'GigabitEthernet0/0/1 to GigabitEthernet0/0/12', vlanId: '10' }, note: '1–12 口划给办公' },
        { ref: 'port-group', vars: { groupName: 'guest-ports', portRange: 'GigabitEthernet0/0/13 to GigabitEthernet0/0/20', vlanId: '20' }, note: '13–20 口划给访客' },
        { ref: 'trunk', vars: { intf: 'GigabitEthernet0/0/24', vlanList: '10 20' }, note: '上行口 Trunk 放通两个 VLAN' }
      ],
      docs: {
        secs: [
          { h: '这套配置的顺序逻辑', p: '先建 VLAN（容器），再划端口（成员），最后配上行（出口）。顺序反过来会报"VLAN 不存在"。' },
          { h: '访客 VLAN 还缺什么', p: '真正隔离访客还需要在网关侧做 ACL：允许访客访问外网，拒绝访问内部网段。这套只做了二层隔离。' }
        ],
        src: { n: '华为官方 · 配置 VLAN（含 VLAN 配置举例）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
      }
    },
    {
      id: 'preset-l3-office',
      title: '小型办公网三层互通',
      summary: 'SVI 起网关 + DHCP 自动分配 + OSPF 学路由 + NAT 出公网。从二层到能上网，一套打通。',
      features: ['VLANIF 网关', 'DHCP 自动分配', 'OSPF 动态路由', 'Easy IP 出口'],
      scene: '一台三层交换机做核心，一台路由器出口。终端自动获取地址并能访问互联网。',
      steps: [
        { ref: 'vlan-create', vars: { vlanId: '10', vlanName: 'office' }, note: '业务 VLAN' },
        { ref: 'svi', vars: { vlanId: '10', gateway: '192.168.10.1', mask: '255.255.255.0' }, note: '起网关' },
        { ref: 'dhcp-pool', vars: { poolName: 'vlan10', network: '192.168.10.0', mask: '255.255.255.0', gateway: '192.168.10.1' }, note: '自动分配地址' },
        { ref: 'ospf', vars: { pid: '1', rid: '10.0.0.1', area: '0', net: '192.168.10.0', wildcard: '0.0.0.255' }, note: '和出口路由器学路由' },
        { ref: 'static-route', vars: { dest: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.0.2' }, note: '默认路由指向出口' },
        { ref: 'nat-easyip', vars: { aclNum: '2000', inside: '192.168.10.0', wildcard: '0.0.0.255', outside: 'GigabitEthernet0/0/0' }, note: '出口做 NAT' }
      ],
      docs: {
        secs: [
          { h: '数据包完整走一遍', p: 'PC(DHCP 拿到 192.168.10.100) → 网关 VLANIF10 → 查路由走默认路由 → 出口路由器 → NAT 换成公网地址 → 互联网。任何一环断了都会"上不了网"，所以排障要逐层验证。' },
          { h: '最后一步别忘', p: '所有设备都要 save。eNSP 里忘记 save 直接关设备，前面配的全白做。' }
        ],
        src: { n: '华为官方 · 配置 VLAN 间互访 / 静态路由示例', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/5141188a' }
      }
    },
    {
      id: 'preset-double-core',
      title: '双核心：VRRP 网关冗余 + OSPF',
      summary: '两台三层交换机互为备份网关，终端只配一个虚拟网关。核心挂了 3 秒内切换，终端无感知。',
      features: ['VRRP 双活网关', 'OSPF 动态路由', 'DHCP 统一下发', '核心故障不断网'],
      scene: '两台 S5700 做核心，下挂接入交换机，上行接出口路由器。要求任意一台核心故障时业务不中断。',
      steps: [
        { ref: 'vlan-create', vars: { vlanId: '10', vlanName: 'office' }, note: '业务 VLAN（两台都要建）' },
        { ref: 'svi', vars: { vlanId: '10', gateway: '192.168.10.2', mask: '255.255.255.0' }, note: '核心 A 的实地址' },
        { ref: 'vrrp', vars: { vlanId: '10', localIp: '192.168.10.2', vrid: '10', vip: '192.168.10.1', priority: '120' }, note: '核心 A 配 Master' },
        { ref: 'dhcp-pool', vars: { poolName: 'vlan10', network: '192.168.10.0', gateway: '192.168.10.1' }, note: '网关指向虚拟 IP' },
        { ref: 'ospf', vars: { pid: '1', rid: '10.0.0.1', area: '0', net: '192.168.10.0' }, note: '与核心 B、出口互通' }
      ],
      docs: {
        secs: [
          { h: '两台核心的差异', p: '核心 B 上：SVI 地址换成 192.168.10.3、VRRP 优先级保持默认 100（当 Backup）。VLAN、DHCP、OSPF 配置基本对称。' },
          { h: '为什么网关要填虚拟 IP', p: '终端网关如果填了某台核心的实地址，那台一挂终端就断。填 VRRP 虚拟地址，Master 切换后虚拟 MAC 一起漂移，终端完全感知不到。' },
          { h: '别忘了 track', p: 'VRRP 默认不感知上行链路状态。核心 A 的上行口断了它仍然自称 Master，流量就黑洞了。要配 track 把上行接口和优先级绑起来。' }
        ],
        src: { n: '华为官方 · VRRP 基本功能配置（双核心网关）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178155/a9d163a2' }
      }
    },
    {
      id: 'preset-hardening',
      title: '接入交换机开局安全加固',
      summary: '关掉明文 Telnet、限制每个口的 MAC 数量、给终端口开边缘端口。新设备上架的标准动作。',
      features: ['只留 SSH','端口 MAC 限制','边缘端口免等待','BPDU 保护'],
      scene: '新到货的接入交换机，准备放进办公网，先做一轮基础加固再下挂终端。',
      steps: [
        { ref: 'telnet-ssh', vars: { user: 'netadmin', password: 'ChangeMe_2026!', level: '15' }, note: '建立加密管理通道' },
        { ref: 'stp', vars: { edgeIntf: 'GigabitEthernet0/0/1' }, note: '选根桥 + 开边缘端口' },
        { ref: 'port-security', vars: { intf: 'GigabitEthernet0/0/1', maxMac: '1', action: 'restrict' }, note: '限制每口 MAC 数' }
      ],
      docs: {
        secs: [
          { h: '顺序有讲究', p: '先配好 SSH 再关 Telnet，否则会把自己锁在外面——尤其你是通过 Telnet 连上去的时候。' },
          { h: '加固之后你可能被锁', ul: ['SSH 密钥没生成成功就关了 Telnet', '账号 service-type 没写 ssh', 'port-security 配在了级联口上，把正常流量挡了'] },
          { h: '还要补的', p: 'console 口密码、禁用未使用的端口、配置 NTP 让日志时间准确、配置 syslog 外发。这些属于设备基线，建议单独做一份 checklist。' }
        ],
        src: { n: '华为官方 · 配置端口安全示例（安全加固）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178157/e7b747b0' }
      }
    },
    {
      id: 'preset-aggregation',
      title: '双链路聚合 + Trunk 上联',
      summary: '两条网线绑成一条 2G 的逻辑链路，跑多个 VLAN。一根断、业务不断，带宽还翻倍。',
      features: ['LACP 双链路', '带宽叠加', '单链路故障不断', '承载多 VLAN'],
      scene: '接入交换机到核心之间放了两根网线，要求带宽叠加 + 冗余，且要承载全部业务 VLAN。',
      steps: [
        { ref: 'vlan-create', vars: { vlanId: '10', vlanName: 'office' }, note: '业务 VLAN' },
        { ref: 'vlan-create', vars: { vlanId: '20', vlanName: 'guest' }, note: '访客 VLAN' },
        { ref: 'eth-trunk', vars: { trunkId: '1', vlanList: '10 20', member1: 'GigabitEthernet0/0/23', member2: 'GigabitEthernet0/0/24' }, note: '聚合 + 当 Trunk 放通' },
        { ref: 'port-group', vars: { groupName: 'office-ports', portRange: 'GigabitEthernet0/0/1 to GigabitEthernet0/0/12', vlanId: '10' }, note: '接入端口批量划分' }
      ],
      docs: {
        secs: [
          { h: '两端都要配', p: 'LACP 是协商协议，一端配了 lacp-static 另一端是普通端口，聚合起不来。两端 trunkId 要一致、成员口要成对。' },
          { h: '成员口配置会被覆盖', p: '把物理口加入 Eth-Trunk 时，它原有的 VLAN 配置会被聚合口的配置覆盖。所以先把 Eth-Trunk 配好再加成员，不要反过来。' },
          { h: '带宽是不是真的翻倍', p: '单条 TCP 连接仍然只走一条物理链路（默认按源/目的 MAC 做哈希），所以两个大文件并发才看得到叠加效果。要单流跑满需要改哈希策略。' }
        ],
        src: { n: '华为官方 · Eth-Trunk 链路聚合配置', u: 'https://support.huawei.com/hedex/api/pages/EDOC1100510632/AZP0930P/01/resources/vrp_eth-trunk_cfg_0012.html' }
      }
    }
  ],

  /* ============================================================
     工作流：分支 / 选项，像流程图一样展开
     kind: q=问题  o=选项  end=结论  warn=警告
     ============================================================ */
  flows: [
    {
      id: 'vlan-decision',
      title: 'VLAN 跨设备通信方案怎么选',
      summary: '先问三个问题，就能确定该用 Access、Trunk 还是 SVI。不用再背"什么时候配 Trunk"。',
      root: 'q1',
      nodes: {
        q1: { kind: 'q', label: '多台交换机之间，需要同一个 VLAN 跨设备通信吗？', note: '先判断需求，再决定端口类型', children: ['o1', 'o2'] },

        o1: { kind: 'o', label: '需要，同 VLAN 要跨设备', children: ['q2'] },
        o2: { kind: 'o', label: '不需要，各交换机独立', children: ['r1'] },

        q2: { kind: 'q', label: '这条互联链路上，只跑一个 VLAN 吗？', note: '跑几个 VLAN 决定要不要打 tag', children: ['o3', 'o4'] },

        o3: { kind: 'o', label: '只跑一个 VLAN', children: ['r2'] },
        o4: { kind: 'o', label: '跑多个 VLAN', children: ['q3'] },

        q3: { kind: 'q', label: '需要在这台交换机上做三层网关吗？', note: '决定要不要配 VLANIF', children: ['o5', 'o6'] },

        o5: { kind: 'o', label: '需要，本机当网关', children: ['r3'] },
        o6: { kind: 'o', label: '不需要，网关在上层', children: ['r4'] },

        r1: {
          kind: 'end', label: 'Access 口即可', snippet: 'port-access',
          body: '每台交换机独立建 VLAN，端口 port link-type access + port default vlan。不需要 Trunk，也不需要三层。'
        },
        r2: {
          kind: 'end', label: 'Access 对接，或 Trunk + PVID', snippet: 'trunk',
          body: '一端 Access 一端 Trunk 时，Trunk 侧的 PVID 要设成对端的 VLAN，否则 untagged 帧会归到 VLAN 1。两边都 Trunk 的话 PVID 保持默认即可。'
        },
        r3: {
          kind: 'end', label: 'Trunk 放通 + VLANIF 起网关', snippet: 'svi',
          body: '互联两边配 Trunk 并 allow-pass 全部业务 VLAN，然后每个 VLAN 起一个 VLANIF 作为该网段网关。终端网关填 VLANIF 地址。'
        },
        r4: {
          kind: 'end', label: '只做 Trunk，网关交给上层', snippet: 'trunk',
          body: '本机只做二层转发：配 Trunk 并 allow-pass。网关放在核心交换机或路由器（可用单臂路由子接口）。'
        }
      }
    },

    {
      id: 'net-troubleshoot',
      title: '终端上不了网：逐层排查',
      summary: '从"有没有 IP"一路问到"能不能出公网"，每一步只验证一件事，定位不靠猜。',
      root: 't1',
      nodes: {
        t1: { kind: 'q', label: 'PC 拿到 IP 了吗？（ipconfig 看）', note: '这是分水岭，决定往二层还是三层查', children: ['t_o1', 't_o2'] },

        t_o1: { kind: 'o', label: '没有 IP，或是 169.254.x.x', children: ['t2'] },
        t_o2: { kind: 'o', label: '有正确的网段地址', children: ['t3'] },

        t2: { kind: 'q', label: '端口划进正确的 VLAN 了吗？', note: 'display port vlan 看 PVID', children: ['t2a', 't2b'] },
        t2a: { kind: 'warn', label: '端口 VLAN 不对', children: ['t_r1'], snippet: 'port-access' },
        t2b: { kind: 'o', label: 'VLAN 正确，那就是 DHCP 问题', children: ['t_r2'] },

        t3: { kind: 'q', label: '能 ping 通网关吗？', note: '网关地址 = 对应 VLANIF 地址', children: ['t3a', 't3b'] },
        t3a: { kind: 'warn', label: 'ping 不通网关', children: ['t_r3'], snippet: 'svi' },
        t3b: { kind: 'o', label: '网关通，但外网不通', children: ['t4'] },

        t4: { kind: 'q', label: '能 ping 通外网 IP（如 114.114.114.114）吗？', note: '区分"路由/NAT 问题"和"DNS 问题"', children: ['t4a', 't4b'] },
        t4a: { kind: 'o', label: '能通，只是打不开网页', children: ['t_r4'] },
        t4b: { kind: 'warn', label: 'IP 也不通', children: ['t_r5'], snippet: 'nat-easyip' },

        t_r1: {
          kind: 'end', label: '先修端口 VLAN', snippet: 'port-access',
          body: 'interface 进端口 → port link-type access → port default vlan 10。改完在 PC 上 ipconfig /release + /renew。'
        },
        t_r2: {
          kind: 'end', label: '查 DHCP：开关、地址池、排除段', snippet: 'dhcp-pool',
          body: '按顺序确认：1) 有没有 dhcp enable；2) ip pool 的 network 是否本网段；3) excluded 是不是排光了地址；4) display ip pool 看 Idle 是否为 0；5) VLANIF 是否有地址且 up。'
        },
        t_r3: {
          kind: 'end', label: '查网关：VLANIF 是否 up', snippet: 'svi',
          body: 'display ip interface brief 看 Vlanif10 的状态。down 通常是因为该 VLAN 里没有 up 的物理端口。再确认 PC 的网关地址填的是不是 VLANIF 地址。'
        },
        t_r4: {
          kind: 'end', label: 'DNS 问题', snippet: 'dhcp-pool',
          body: '能 ping 通 IP 但打不开网页 = 域名解析失败。检查 DHCP 池里的 dns-list 是否下发、PC 的 DNS 是否为空，或手动设 114.114.114.114 验证。'
        },
        t_r5: {
          kind: 'end', label: '查路由与 NAT', snippet: 'nat-easyip',
          body: '三层设备要有默认路由指向出口；出口路由器要有 nat outbound 且 ACL 匹配内网网段；display nat session all 看有没有会话表项。'
        }
      }
    },

    {
      id: 'ospf-neighbor',
      title: 'OSPF 邻居起不来？按这五条查',
      summary: '邻居卡在 Init / ExStart / 2-Way，每种状态对应不同原因。对照着查最快。',
      root: 'p1',
      nodes: {
        p1: { kind: 'q', label: 'display ospf peer 有邻居吗？', note: '先确认是"没有"还是"卡在某个状态"', children: ['p_o1', 'p_o2'] },

        p_o1: { kind: 'warn', label: '完全看不到邻居', children: ['p_r1'] },
        p_o2: { kind: 'o', label: '有邻居但状态不对', children: ['p2'] },

        p2: { kind: 'q', label: '卡在哪个状态？', children: ['p3a', 'p3b', 'p3c'] },
        p3a: { kind: 'o', label: 'Init / 2-Way', children: ['p_r2'] },
        p3b: { kind: 'o', label: 'ExStart / Exchange', children: ['p_r3'] },
        p3c: { kind: 'o', label: '一直 Full 之后又掉', children: ['p_r4'] },

        p_r1: {
          kind: 'end', label: '先查宣告和链路', snippet: 'ospf',
          body: '1) area 号两端是否一致；2) network 是否宣告了互联的那个网段（通配符写错是高频原因）；3) 两端接口是否 up、能否互相 ping 通；4) 中间设备是否挡了 224.0.0.5。'
        },
        p_r2: {
          kind: 'end', label: 'Init / 2-Way：报文通了但没被接受', snippet: 'ospf',
          body: 'Init 说明收到了 Hello 但对方没认可我。常见：单播能通但组播被拦、DR 选举问题（广播网络 2-Way 是正常状态，不用管）、两端 router-id 冲突。'
        },
        p_r3: {
          kind: 'end', label: 'ExStart / Exchange：MTU 不一致', snippet: 'ospf',
          body: '这个状态几乎都是 MTU 不匹配导致的。两端接口 MTU 必须一致；或者配 ospf mtu-ignore 忽略检查。'
        },
        p_r4: {
          kind: 'end', label: 'Full 之后掉线：计时器或链路抖动', snippet: 'ospf',
          body: 'Hello / Dead 计时器两端必须一致（默认 10 / 40 秒）。另外查接口是否在反复 up/down（光衰、网线、聚合口），以及是否有 ACL 周期性阻断。'
        }
      }
    },

    {
      id: 'vlan-troubleshoot',
      title: '不同 VLAN 之间 ping 不通',
      summary: '上不了外网是一回事，VLAN 之间不通是另一回事。这里只查"内部互通"，从二层往上逐层排。',
      root: 'v1',
      nodes: {
        v1: { kind: 'q', label: '同一个 VLAN 内的两台 PC 能互通吗？', note: '先确认二层是通的，不通就别往三层查', children: ['v_o1', 'v_o2'] },

        v_o1: { kind: 'warn', label: '不通，同 VLAN 都打不通', children: ['v_r1'] },
        v_o2: { kind: 'o', label: '通，同 VLAN 正常', children: ['v2'] },

        v2: { kind: 'q', label: '两台 PC 的网关填的是本 VLAN 的 VLANIF 地址吗？', note: '跨 VLAN 必须先交给网关', children: ['v_o3', 'v_o4'] },

        v_o3: { kind: 'warn', label: '没填网关 / 填错了', children: ['v_r2'] },
        v_o4: { kind: 'o', label: '网关填对了', children: ['v3'] },

        v3: { kind: 'q', label: 'display ip interface brief 里，对应的 Vlanif 是 up 且地址正确吗？', note: '没有 Vlanif 或状态 down 都不通', children: ['v_o5', 'v_o6'] },

        v_o5: { kind: 'warn', label: '没有 Vlanif，或状态 down', children: ['v_r3'] },
        v_o6: { kind: 'o', label: 'up 且地址正确', children: ['v_r4'] },

        v_r1: {
          kind: 'end', label: '先修二层：端口 VLAN 和 PVID', snippet: 'port-access',
          body: 'display port vlan 看两个端口的 PVID 是不是同一个 VLAN。常见：一个口 port default vlan 写错了、端口被 shutdown、或者开了端口隔离（port-isolate enable）导致同 VLAN 也不通。'
        },
        v_r2: {
          kind: 'end', label: '改终端网关', snippet: 'svi',
          body: '跨 VLAN 通信必须经过网关，网关地址就是该 VLAN 的 VLANIF 地址。eNSP 里在 PC 的"基础配置"页把网关填对，再用 ipconfig /renew 刷新生效。'
        },
        v_r3: {
          kind: 'end', label: '补 VLANIF 或让 VLAN 里有 up 的口', snippet: 'svi',
          body: '没配就 interface Vlanif X 加 ip address。配了但 down：说明这个 VLAN 里没有任何 up 的物理端口——VLAN 只存在于配置里，没有成员，接口就不会 up。先把接入口划进这个 VLAN。'
        },
        v_r4: {
          kind: 'end', label: '查 ACL、掩码、主机防火墙', snippet: 'acl',
          body: '到这一步三层已经通了，问题在策略层：1) 接口上是否调了 traffic-filter 把跨 VLAN 流量挡了；2) 两台 PC 掩码是否一致（不一致会认为是同网段，直接 ARP 而不走网关）；3) Windows 防火墙默认可能不回 ICMP。'
        }
      }
    },

    {
      id: 'nat-choice',
      title: 'NAT 该配哪一种',
      summary: '内网要出去、外网要进来、还是双向都要？方向搞错，配再多也不通。',
      root: 'n1',
      nodes: {
        n1: { kind: 'q', label: '你的流量方向是？', note: 'NAT 分源地址转换和目的地址转换，方向完全不同', children: ['n_o1', 'n_o2', 'n_o3'] },

        n_o1: { kind: 'o', label: '内网主动访问外网', children: ['n_r1'] },
        n_o2: { kind: 'o', label: '外网要访问内网的服务器', children: ['n2'] },
        n_o3: { kind: 'o', label: '内网服务器要用公网地址主动发起连接', children: ['n_r3'] },

        n2: { kind: 'q', label: '手上有几个公网 IP？', note: '一个用出接口地址就够，多个可以分别映射', children: ['n_o4', 'n_o5'] },

        n_o4: { kind: 'o', label: '只有一个（拨号 / 单线）', children: ['n_r2'] },
        n_o5: { kind: 'o', label: '有多个固定公网 IP', children: ['n_r4'] },

        n_r1: {
          kind: 'end', label: 'Easy IP（nat outbound）', snippet: 'nat-easyip',
          body: '内网多个地址复用出接口的一个公网地址，靠端口号区分会话。配一条 ACL 匹配内网网段，然后在出接口上 nat outbound ACL编号。家用、小型办公都是这个。'
        },
        n_r2: {
          kind: 'end', label: 'NAT Server + current-interface', snippet: 'nat-server',
          body: '公网地址写 current-interface，直接把出接口地址的某个端口映射到内网服务器。比如公网 8080 → 192.168.10.100:80。端口用非标准的更安全。'
        },
        n_r3: {
          kind: 'end', label: 'NAT Server（双向）或静态一对一', snippet: 'nat-server',
          body: 'nat server 本身就是双向的：外网能主动进来，内网服务器出去时源地址也会被换成公网地址，所以服务器看到的对端是真实地址，适合需要双向访问的场景。'
        },
        n_r4: {
          kind: 'end', label: '每个公网 IP 各自映射', snippet: 'nat-server',
          body: '在 nat server 里把 global 后面的地址换成各自的公网 IP。多个公网地址可以做多台服务器的 1:1 映射。注意公网 IP 要已经在接口或子接口上可达。'
        }
      }
    }
  ],

  /* ============================================================
     实验（lab）
     ------------------------------------------------------------
     和预设的区别：预设是「给你一套能用的配置」，
     实验是「带着你从头做一遍，并告诉你做完怎么验证、哪里会错」。
     字段：
       goal     这个实验要做成什么事
       topo     拓扑：nodes 坐标在 760×h 的画布上，links 带网段标签
       plan     地址规划表
       vars     实验级变量池，全实验共用一份（改一次，所有步骤同步）
       steps    步骤：code 里用 {{var}}，ref 可选（关联的单条片段）
       verify   验证：命令 + 期望看到什么
       pitfalls 常见错误
     ============================================================ */
  labs: [
    {
      id: 'lab-ospf-multi-area',
      title: 'OSPF 多区域与路由汇总',
      level: '进阶',
      minutes: 25,
      goal: '把两片网络分别放进 Area 0 和 Area 1，让骨干路由器只看到一条汇总路由，而不是一堆明细。',
      scene: '分支机构网段越加越多、核心路由表被明细撑爆时，用多区域 + abr-summary 收敛。',
      topo: {
        h: 250,
        nodes: [
          { id: 'r3', t: 'router', label: 'R3', sub: 'Area 1', x: 130, y: 70 },
          { id: 'r1', t: 'router', label: 'R1', sub: 'ABR', x: 380, y: 70 },
          { id: 'r2', t: 'router', label: 'R2', sub: 'Area 0', x: 630, y: 70 },
          { id: 'pc1', t: 'pc', label: 'PC1', sub: '10.1.1.10', x: 130, y: 190 },
          { id: 'pc2', t: 'pc', label: 'PC2', sub: '10.2.1.10', x: 630, y: 190 }
        ],
        links: [
          ['r3', 'r1', '10.0.13.0/24'],
          ['r1', 'r2', '10.0.12.0/24'],
          ['r3', 'pc1', '10.1.1.0/24'],
          ['r2', 'pc2', '10.2.1.0/24']
        ]
      },
      plan: [
        { dev: 'R1', intf: 'GE0/0/0', ip: '10.0.13.1/24', note: '接 R3，划进 Area 1' },
        { dev: 'R1', intf: 'GE0/0/1', ip: '10.0.12.1/24', note: '接 R2，划进 Area 0' },
        { dev: 'R2', intf: 'GE0/0/0', ip: '10.0.12.2/24', note: '骨干侧' },
        { dev: 'R2', intf: 'GE0/0/1', ip: '10.2.1.1/24', note: 'PC2 网关' },
        { dev: 'R3', intf: 'GE0/0/0', ip: '10.0.13.2/24', note: '接 R1' },
        { dev: 'R3', intf: 'GE0/0/1', ip: '10.1.1.1/24', note: 'PC1 网关' },
        { dev: 'R3', intf: 'LoopBack0', ip: '10.1.2.1/24', note: '模拟第二个分部网段，用来看汇总效果' }
      ],
      vars: {
        area0: { label: '骨干区域号', value: '0', hint: '0', desc: 'OSPF 的骨干区域固定是 0，所有非骨干区域必须挂在 ABR 上。' },
        area1: { label: '分支区域号', value: '1', hint: '1–4294967295', desc: '可以写成十进制，也可以写成点分格式 0.0.0.1。' },
        sumNet: { label: '汇总网段', value: '10.1.0.0', hint: '10.1.0.0', desc: '把 10.1.1.0/24 和 10.1.2.0/24 合成 10.1.0.0/16 后通告给骨干。' },
        sumMask: { label: '汇总掩码', value: '255.255.0.0', hint: '/16', desc: '掩码要能覆盖住所有明细网段，写小了会漏通告。' },
        rid1: { label: 'R1 Router ID', value: '1.1.1.1', hint: '点分十进制', desc: '建议手工指定，否则重启后可能因接口地址变化而变，导致邻居重建。' },
        rid2: { label: 'R2 Router ID', value: '2.2.2.2', hint: '点分十进制', desc: '两台 R2 都配成同一个 ID 就起不来邻居，全网必须唯一。' },
        rid3: { label: 'R3 Router ID', value: '3.3.3.3', hint: '点分十进制', desc: 'R3 自己标识，同样全网唯一；它是 ABR，两个区域都要用这个 ID。' }
      },
      steps: [
        {
          title: 'R1：接口地址（一边接骨干、一边接分支）',
          note: 'ABR 的两个接口必须分别落在两个区域里',
          code: `system-view
sysname R1

interface GigabitEthernet 0/0/0
 ip address 10.0.13.1 255.255.255.0
 quit
interface GigabitEthernet 0/0/1
 ip address 10.0.12.1 255.255.255.0
 quit`
        },
        {
          title: 'R1：OSPF 双区域 + 在 Area 1 做汇总',
          note: 'abr-summary 写在区域视图下，只会影响注入骨干的方向',
          ref: 'ospf',
          code: `ospf 1 router-id {{rid1}}
 area {{area0}}
  network 10.0.12.0 0.0.0.255
  quit
 area {{area1}}
  network 10.0.13.0 0.0.0.255
  abr-summary {{sumNet}} {{sumMask}}
  quit
 quit`
        },
        {
          title: 'R2：骨干路由器，只加 Area 0',
          note: 'R2 不知道 Area 1 的存在，它只认识 ABR 通告过来的路由',
          code: `system-view
sysname R2

interface GigabitEthernet 0/0/0
 ip address 10.0.12.2 255.255.255.0
 quit
interface GigabitEthernet 0/0/1
 ip address 10.2.1.1 255.255.255.0
 quit

ospf 1 router-id {{rid2}}
 area {{area0}}
  network 10.0.12.0 0.0.0.255
  network 10.2.1.0 0.0.0.255
  quit
 quit`
        },
        {
          title: 'R3：分支路由器 + 一个 LoopBack 冒充第二个网段',
          note: '有了 10.1.1.0/24 和 10.1.2.0/24 两条明细，才看得出汇总有没有生效',
          code: `system-view
sysname R3

interface GigabitEthernet 0/0/0
 ip address 10.0.13.2 255.255.255.0
 quit
interface GigabitEthernet 0/0/1
 ip address 10.1.1.1 255.255.255.0
 quit
interface LoopBack 0
 ip address 10.1.2.1 255.255.255.0
 quit

ospf 1 router-id {{rid3}}
 area {{area1}}
  network 10.0.13.0 0.0.0.255
  network 10.1.1.0 0.0.0.255
  network 10.1.2.0 0.0.0.255
  quit
 quit`
        },
        {
          title: 'PC 侧地址',
          note: 'PC1 网关 10.1.1.1，PC2 网关 10.2.1.1',
          code: `# eNSP 里在 PC 的「基础配置」页填：
# PC1  IP 10.1.1.10  掩码 255.255.255.0  网关 10.1.1.1
# PC2  IP 10.2.1.10  掩码 255.255.255.0  网关 10.2.1.1`
        }
      ],
      verify: [
        { cmd: 'display ospf peer brief', hope: 'R1 上有两个邻居（R2、R3），状态都是 Full' },
        { cmd: 'display ospf brief', hope: 'R1 显示自己是 ABR，且 Area 0 与 Area 1 都有接口' },
        { cmd: 'display ip routing-table | include 10.1.', hope: 'R2 上只看到 10.1.0.0/16 这一条，看不到 10.1.1.0/24 和 10.1.2.0/24' },
        { cmd: 'ping 10.2.1.10', hope: '在 R3 上 ping PC2 通，说明跨区域转发正常' }
      ],
      pitfalls: [
        'R2 上的 network 只写 10.0.12.0，忘了写 10.2.1.0 —— PC2 能收到路由但回不去，表现为「单向不通」。',
        '汇总网段和掩码盖不住明细（比如写成 10.1.1.0/255.255.255.0），结果只有一条被汇总，另一条仍以明细出现在骨干。',
        'ABR 必须有一个接口在 Area 0。两个接口都在非骨干区域时，区域间路由传不过去。',
        'ospf 1 router-id 只在新进程首次生效。改 Router ID 要先 undo ospf 1 重建，或重启 OSPF 进程。'
      ],
      docs: {
        secs: [
          { h: '多区域的三条硬规则', ul: [
            '必须有骨干区域 Area 0，所有非骨干区域都要通过 ABR 与骨干相连。',
            'ABR 同时属于两个及以上区域，负责在区域之间产生 Type 3 LSA（区域间路由）。',
            '区域间路由必须在骨干区域中转，非骨干区域之间不能直接建立邻居来传递路由。'
          ] },
          { h: 'abr-summary 做了什么', p: '在 ABR 的区域视图下执行，把该区域的明细路由聚合成一条网段更短的路由（Type 3 LSA）注入其他区域。骨干路由器因此只需维护一条汇总路由。注意它不会影响本区域内部的明细路由。' },
          { h: '为什么要手工指定 Router ID', p: '不指定时设备会自动选一个接口地址当 Router ID，接口地址变动或设备重启后 Router ID 可能变化，导致邻居关系重建甚至短暂中断。生产环境建议手工指定。' }
        ],
        src: { n: '华为官方 · S5700 V200R011C10 配置指南-IP单播路由（OSPF）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1100459458/c9060695' }
      }
    },

    {
      id: 'lab-dhcp-relay',
      title: 'DHCP 中继：跨网段自动分配地址',
      level: '进阶',
      minutes: 20,
      goal: '让 DHCP 服务器放在中心机房，也能给远端的用户网段发地址。',
      scene: '一台 DHCP 服务器管理多个网段，用户网关在三层交换机上，服务器不在用户网段内。',
      topo: {
        h: 250,
        nodes: [
          { id: 'pc', t: 'pc', label: 'PC1', sub: '自动获取', x: 80, y: 190 },
          { id: 'sw', t: 'switch', label: 'SW1', sub: '接入', x: 80, y: 70 },
          { id: 'core', t: 'switch', label: 'Core', sub: '中继 · 网关', x: 380, y: 70 },
          { id: 'srv', t: 'router', label: 'DHCP', sub: '192.168.100.10', x: 670, y: 70 }
        ],
        links: [
          ['pc', 'sw', 'VLAN 10'],
          ['sw', 'core', 'Trunk V10'],
          ['core', 'srv', '192.168.100.0/24']
        ]
      },
      plan: [
        { dev: 'Core', intf: 'Vlanif10', ip: '192.168.10.1/24', note: '用户网关，同时是 DHCP 中继接口' },
        { dev: 'Core', intf: 'Vlanif100', ip: '192.168.100.1/24', note: '和服务器互联' },
        { dev: 'Core', intf: 'GE0/0/1', ip: 'Trunk，放行 VLAN10', note: '接接入交换机' },
        { dev: 'Core', intf: 'GE0/0/2', ip: 'Access，VLAN100', note: '接 DHCP 服务器' },
        { dev: 'DHCP', intf: 'GE0/0/0', ip: '192.168.100.10/24', note: '服务器地址' },
        { dev: 'DHCP', intf: '全局地址池', ip: '192.168.10.0/24', note: '网段必须是用户网段，网关 192.168.10.1' }
      ],
      vars: {
        vlanUser: { label: '用户 VLAN', value: '10', hint: '1–4094', desc: 'PC 所在 VLAN，网关建在它的 Vlanif 上。' },
        vlanSrv: { label: '服务器 VLAN', value: '100', hint: '1–4094', desc: '承载 DHCP 服务器的互联 VLAN。' },
        gw: { label: '用户网关', value: '192.168.10.1', hint: '必须是中继接口地址', desc: '地址池里的 gateway-list 必须填这个地址，填错客户端拿到地址也上不了网。' },
        poolNet: { label: '地址池网段', value: '192.168.10.0', hint: 'C 类网段', desc: '要分配的用户网段，不是服务器自己的网段。' },
        srvIp: { label: 'DHCP 服务器地址', value: '192.168.100.10', hint: '和 Core 互联同网段', desc: '中继把客户端请求单播到这个地址。' }
      },
      steps: [
        {
          title: 'Core：VLAN、网关和上行口',
          note: '先有网关接口，中继才有地方配',
          code: `system-view
sysname Core

vlan batch {{vlanUser}} {{vlanSrv}}

interface GigabitEthernet 0/0/1
 port link-type trunk
 port trunk allow-pass vlan {{vlanUser}}
 quit
interface GigabitEthernet 0/0/2
 port link-type access
 port default vlan {{vlanSrv}}
 quit

interface Vlanif {{vlanUser}}
 ip address {{gw}} 255.255.255.0
 quit
interface Vlanif {{vlanSrv}}
 ip address 192.168.100.1 255.255.255.0
 quit`
        },
        {
          title: 'Core：开 DHCP + 把 Vlanif10 设成中继',
          note: 'dhcp enable 是总开关，不开则中继、服务器功能全部不生效',
          code: `dhcp enable

interface Vlanif {{vlanUser}}
 dhcp select relay
 dhcp relay server-ip {{srvIp}}
 quit`
        },
        {
          title: 'DHCP 服务器：全局地址池（必须是全局池）',
          note: '接口地址池不响应中继请求，这是最容易踩的坑',
          ref: 'dhcp-pool',
          code: `system-view
sysname DHCP-Server

dhcp enable

ip pool vlan{{vlanUser}}
 network {{poolNet}} mask 255.255.255.0
 gateway-list {{gw}}
 dns-list 223.5.5.5
 excluded-ip-address 192.168.10.200 192.168.10.254
 lease day 1
 quit

interface GigabitEthernet 0/0/0
 ip address {{srvIp}} 255.255.255.0
 dhcp select global
 quit`
        },
        {
          title: 'DHCP 服务器：补一条回程路由',
          note: '服务器回包要靠这条路由，缺了它客户端拿不到地址',
          code: `ip route-static {{poolNet}} 255.255.255.0 192.168.100.1`
        },
        {
          title: '接入交换机：只是把 VLAN 透传下去',
          code: `system-view
sysname SW1

vlan {{vlanUser}}

interface GigabitEthernet 0/0/1
 port link-type access
 port default vlan {{vlanUser}}
 quit
interface GigabitEthernet 0/0/24
 port link-type trunk
 port trunk allow-pass vlan {{vlanUser}}
 quit`
        }
      ],
      verify: [
        { cmd: 'display ip pool name vlan10', hope: '地址池里有已分配（Used）记录，说明请求到达了服务器' },
        { cmd: 'display dhcp server statistics', hope: '能看到收到 Discover/Request 报文计数在增长' },
        { cmd: '在 PC 上 ipconfig /renew', hope: '拿到 192.168.10.x 地址，网关 192.168.10.1' },
        { cmd: 'ping 192.168.100.10', hope: 'PC 能 ping 通服务器，说明去回双向都通' }
      ],
      pitfalls: [
        '地址池用了「接口地址池」而不是「全局地址池」—— 中继请求不被响应，PC 一直拿不到地址。',
        '服务器没有回程路由：请求能到服务器，但应答回不来，现象是「服务器日志有请求，客户端就是没地址」。',
        'gateway-list 填错（填成服务器地址或别的网段）。客户端拿到地址，但网关不对，上不了网。',
        '交换机侧忘了 dhcp enable。中继、服务器功能都依赖这个总开关，不开的话配置看着都在，就是不生效。',
        'DHCP 报文最多中继 16 次，超过直接丢弃。级联很深时要注意。'
      ],
      docs: {
        secs: [
          { h: '中继为什么需要网关接口', p: 'DHCP 广播包不能跨网段，中继设备在收到广播后，用自己的网关接口地址作为源地址，把请求单播给服务器。服务器据此知道该从哪个地址池分配地址。所以中继必须配在用户网关接口上，且该接口地址要和服务器上地址池的 gateway-list 一致。' },
          { h: '必须用全局地址池', p: '接口地址池只服务于本接口直连的网段，中继请求需要服务器从全局地址池里匹配网段。这是官方明确要求，也是实操中最常见的失败原因。' },
          { h: '两条路由不能缺', p: '中继设备要有到服务器的路由；服务器要有回用户网段的路由。缺任何一条，DHCP 四步交互（Discover-Offer-Request-Ack）都完不成。' }
        ],
        src: { n: '华为官方 · S5700 V200R011C10 配置指南-IP业务（DHCP）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178148/add4da88' }
      }
    },

    {
      id: 'lab-dhcp-snooping',
      title: 'DHCP Snooping + IPSG：防私接路由器',
      level: '进阶',
      minutes: 25,
      goal: '让私接的路由器发不出 DHCP 应答，同时让手改静态 IP 的终端直接上不了网。',
      scene: '宿舍、办公室有人私接路由器导致全网 IP 冲突；或者有人手工配 IP 绕过管理。',
      topo: {
        h: 250,
        nodes: [
          { id: 'core', t: 'switch', label: 'Core', sub: 'DHCP 服务器', x: 650, y: 70 },
          { id: 'sw', t: 'switch', label: 'SW1', sub: 'Snooping + IPSG', x: 370, y: 70 },
          { id: 'pc1', t: 'pc', label: 'PC1', sub: '正常用户', x: 190, y: 195 },
          { id: 'pc2', t: 'pc', label: 'PC2', sub: '正常用户', x: 370, y: 195 },
          { id: 'rogue', t: 'router', label: '私接路由', sub: '要拦掉', x: 550, y: 195 }
        ],
        links: [
          ['core', 'sw', 'Trunk V10 · 信任口'],
          ['sw', 'pc1', 'VLAN 10'],
          ['sw', 'pc2', 'VLAN 10'],
          ['sw', 'rogue', 'VLAN 10']
        ]
      },
      plan: [
        { dev: 'Core', intf: 'Vlanif10', ip: '192.168.10.1/24', note: '网关 + 全局地址池' },
        { dev: 'Core', intf: 'GE0/0/1', ip: 'Trunk 放行 VLAN10', note: '接 SW1' },
        { dev: 'SW1', intf: 'GE0/0/24', ip: 'Trunk 放行 VLAN10', note: '上联口，必须设成信任口' },
        { dev: 'SW1', intf: 'GE0/0/1–2', ip: 'Access VLAN10', note: '接正常用户' },
        { dev: 'SW1', intf: 'GE0/0/3', ip: 'Access VLAN10', note: '接私接路由器的口，不设信任' }
      ],
      vars: {
        vlanUser: { label: '用户 VLAN', value: '10', hint: '1–4094', desc: 'Snooping 和 IPSG 都按 VLAN 生效。' },
        gwIp: { label: '网关地址', value: '192.168.10.1', hint: 'Vlanif 地址', desc: 'DHCP 服务器（Core）上的网关。' },
        poolNet: { label: '地址池网段', value: '192.168.10.0', hint: 'C 类网段', desc: '服务器要分配的用户网段，写网络号不写掩码。' }
      },
      steps: [
        {
          title: 'Core：先把 DHCP 服务器跑起来（对照组）',
          note: '没有正常的 DHCP 服务器，Snooping 就没有可信的绑定表',
          ref: 'dhcp-pool',
          code: `system-view
sysname Core

dhcp enable
vlan batch {{vlanUser}}

ip pool v{{vlanUser}}
 network {{poolNet}} mask 255.255.255.0
 gateway-list {{gwIp}}
 dns-list 223.5.5.5
 quit

interface Vlanif {{vlanUser}}
 ip address {{gwIp}} 255.255.255.0
 dhcp select global
 quit

interface GigabitEthernet 0/0/1
 port link-type trunk
 port trunk allow-pass vlan {{vlanUser}}
 quit`
        },
        {
          title: 'SW1：开 DHCP Snooping（全局 + VLAN）',
          note: '两级开关都要开，只开全局等于没开',
          code: `system-view
sysname SW1

dhcp enable
dhcp snooping enable

vlan {{vlanUser}}
 dhcp snooping enable
 quit`
        },
        {
          title: 'SW1：上联口设为信任口',
          note: '这一步漏了，全网用户都拿不到地址',
          code: `interface GigabitEthernet 0/0/24
 port link-type trunk
 port trunk allow-pass vlan {{vlanUser}}
 dhcp snooping trusted
 quit`
        },
        {
          title: 'SW1：用户口（不设信任）+ 开启 IPSG',
          note: 'IPSG 在 VLAN 视图下开启，它会拿绑定表核对源 IP 和 MAC',
          code: `interface GigabitEthernet 0/0/1
 port link-type access
 port default vlan {{vlanUser}}
 quit
interface GigabitEthernet 0/0/2
 port link-type access
 port default vlan {{vlanUser}}
 quit
interface GigabitEthernet 0/0/3
 port link-type access
 port default vlan {{vlanUser}}
 quit

vlan {{vlanUser}}
 ip source check user-bind enable
 quit`
        }
      ],
      verify: [
        { cmd: 'display dhcp snooping user-bind all', hope: '正常用户有绑定表项（IP + MAC + 接口 + VLAN）' },
        { cmd: 'display dhcp snooping configuration', hope: '确认全局和 VLAN 都已使能，信任口是 GE0/0/24' },
        { cmd: '在私接路由器上关掉 DHCP 后重试，或直接接一台开了 DHCP 的路由器', hope: '接私接路由器的口学不到地址，它发不出 DHCP 应答' },
        { cmd: '把 PC1 改成静态 IP 192.168.10.88 再 ping 网关', hope: 'ping 不通 —— 绑定表里没有这条记录，IPSG 直接丢弃' }
      ],
      pitfalls: [
        '上联口忘了 dhcp snooping trusted —— 服务器应答被当成非法报文丢弃，全 VLAN 用户拿不到地址。这是最典型的「配完就全网瘫痪」。',
        '只开了全局 dhcp snooping enable，没在 VLAN 视图再开一次，功能不生效。',
        'IPSG 依赖绑定表。用户必须先通过 DHCP 正常上线一次，静态 IP 用户需要手工配静态绑定表（user-bind static），否则永远上不了网。',
        '信任口配在了用户口上 —— 私接路由器就不会被拦。信任口只应该配在上联方向。',
        'DHCP Snooping 和 DHCP 中继同时存在时，别中途删除中继上的服务器地址，会导致绑定表不刷新。'
      ],
      docs: {
        secs: [
          { h: 'Snooping 拦的是什么', p: '交换机把「上联口」设为信任口，只信任从信任口来的 DHCP 应答（Offer/ACK）。用户口收到的 DHCP 应答一律丢弃 —— 私接路由器发出的应答就走这条规则被拦掉。同时它把合法用户的 IP-MAC-接口-VLAN 记成绑定表。' },
          { h: 'IPSG 靠绑定表工作', p: 'IPSG（IP Source Guard）在收到报文时，拿源 IP 和源 MAC 去绑定表核对，对不上就丢包。所以它能拦住手改静态 IP、冒用他人 IP 两类行为。前提是绑定表里有这个用户的合法记录。' },
          { h: '静态 IP 用户怎么办', p: '没有 DHCP 过程就不会自动生成绑定表。这类用户需要管理员手工配置静态绑定（如 dhcp static-bind 或在 VLAN 下配置 user-bind static），否则开了 IPSG 之后他会直接断网。' }
        ],
        src: { n: '华为官方 · S5700 V200R011C10 配置指南-安全（DHCP Snooping / IPSG）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178157' }
      }
    },

    {
      id: 'lab-mstp-instance',
      title: 'MSTP 多实例：两条链路互相备份',
      level: '综合',
      minutes: 30,
      goal: '一个三角环里，让 VLAN 10 走左边链路、VLAN 20 走右边链路，互为备份，谁都不闲着。',
      scene: '双核心双上行组网，希望流量按 VLAN 分摊到两条链路，同时任何一条断了都能自动切换。',
      topo: {
        h: 275,
        nodes: [
          { id: 'sw1', t: 'switch', label: 'SW1', sub: '实例1 主 · 实例2 备', x: 380, y: 62 },
          { id: 'sw2', t: 'switch', label: 'SW2', sub: '实例1 备 · 实例2 主', x: 150, y: 225 },
          { id: 'sw3', t: 'switch', label: 'SW3', sub: '接入', x: 610, y: 225 }
        ],
        links: [
          ['sw1', 'sw2', 'Trunk V10/20'],
          ['sw1', 'sw3', 'Trunk V10/20'],
          ['sw2', 'sw3', 'Trunk V10/20']
        ]
      },
      plan: [
        { dev: 'SW1', intf: 'GE0/0/1', ip: 'Trunk 放行 10 20', note: '接 SW2' },
        { dev: 'SW1', intf: 'GE0/0/2', ip: 'Trunk 放行 10 20', note: '接 SW3' },
        { dev: 'SW2', intf: 'GE0/0/1', ip: 'Trunk 放行 10 20', note: '接 SW1' },
        { dev: 'SW2', intf: 'GE0/0/2', ip: 'Trunk 放行 10 20', note: '接 SW3' },
        { dev: 'SW3', intf: 'GE0/0/1–2', ip: 'Trunk 放行 10 20', note: '分别接 SW1、SW2' }
      ],
      vars: {
        region: { label: '域名', value: 'RG1', hint: '字符串', desc: '三台设备必须完全一致，差一个字符就分成两个域，各算各的树。' },
        rev: { label: '修订级别', value: '1', hint: '0–65535', desc: '和域名、实例映射一起决定设备属于哪个域，也要一致。' },
        vlanA: { label: '实例 1 的 VLAN', value: '10', hint: '1–4094', desc: '这个 VLAN 的流量主走 SW1。' },
        vlanB: { label: '实例 2 的 VLAN', value: '20', hint: '1–4094', desc: '这个 VLAN 的流量主走 SW2，实现负载分担。' }
      },
      steps: [
        {
          title: '三台交换机：先建端口（VLAN 都要放行）',
          note: '下面这段在 SW1、SW2、SW3 上各配一遍，接口号按实际拓扑改',
          code: `system-view
vlan batch {{vlanA}} {{vlanB}}

interface GigabitEthernet 0/0/1
 port link-type trunk
 port trunk allow-pass vlan {{vlanA}} {{vlanB}}
 quit
interface GigabitEthernet 0/0/2
 port link-type trunk
 port trunk allow-pass vlan {{vlanA}} {{vlanB}}
 quit`
        },
        {
          title: '三台交换机：配置同一个 MST 域（关键）',
          note: 'region-name / revision-level / 实例映射，三台必须一模一样，最后必须 active',
          code: `stp mode mstp

stp region-configuration
 region-name {{region}}
 revision-level {{rev}}
 instance 1 vlan {{vlanA}}
 instance 2 vlan {{vlanB}}
 active region-configuration
 quit`
        },
        {
          title: 'SW1：实例 1 当主根、实例 2 当备根',
          note: 'root primary 等价于把优先级设成 0，root secondary 设成 4096',
          code: `stp instance 1 root primary
stp instance 2 root secondary`
        },
        {
          title: 'SW2：反过来，实例 2 当主根',
          note: '两台核心互换角色，两条链路就都用上了',
          code: `stp instance 2 root primary
stp instance 1 root secondary`
        },
        {
          title: 'SW3：只做接入，不改优先级',
          note: '接入交换机保持默认 32768，让核心决定拓扑',
          code: `# SW3 不需要额外配置，域配置和端口做完即可
# 确认生成树已启用：
stp enable`
        }
      ],
      verify: [
        { cmd: 'display stp region-configuration', hope: '三台输出的域名、修订级别、实例映射完全一致，状态是 Active' },
        { cmd: 'display stp instance 1 brief', hope: 'SW1 是根桥（CIST Root/ERPC 为 0），SW3 上有一条链路是 Discarding/Alternate' },
        { cmd: 'display stp instance 2 brief', hope: '根桥变成 SW2，被阻塞的端口和实例 1 时相反' },
        { cmd: '断开 SW1 到 SW3 的链路再看 display stp brief', hope: '实例 1 的流量切到 SW1–SW2–SW3 路径，业务不中断（丢几个包）' }
      ],
      pitfalls: [
        '域名/修订级别/实例映射只要有一处不一致，设备就属于不同域，各自算一棵树 —— 环路照样存在，看起来「配了 MSTP 但没生效」。',
        '忘了 active region-configuration。配置在缓冲区里，没激活就等于没配。',
        '同一个实例上两台设备都设 root primary，优先级相同就比 MAC，结果不可控。',
        'Trunk 没放行 VLAN 10/20，生成树正常但业务不通，容易误判成 STP 问题。',
        '三层接口（Vlanif）地址配在同一网段又接成环，STP 管不了三层环路。'
      ],
      docs: {
        secs: [
          { h: 'MSTP 和 STP/RSTP 的差别', p: 'STP/RSTP 所有 VLAN 共用一棵树，无法按 VLAN 分流。MSTP 可以按实例（instance）建多棵树，每个实例绑定一组 VLAN，不同实例可以选择不同的根桥和阻塞端口，从而实现 VLAN 级负载分担。' },
          { h: '一个域的三个要素', p: '域名（region-name）、修订级别（revision-level）、VLAN 与实例的映射关系，三者完全相同才算同一个 MST 域。任何一项不同，设备就被划到不同域，域间按 CIST 互通，多实例的负载分担设计就失效了。' },
          { h: 'root primary 到底做了什么', p: '它不是一个独立协议动作，本质是把该实例的桥优先级设成一个很小的值（primary 通常为 0，secondary 为 4096），从而在选举中胜出。优先级数值越小越优先，且必须是 4096 的倍数。' }
        ],
        src: { n: '华为官方 · S5700 V200R011C10 配置指南-以太网交换（MSTP）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178154/299644e0' }
      }
    },

    {
      id: 'lab-floating-static',
      title: '浮动静态路由：主链路断了自动切备份',
      level: '入门',
      minutes: 15,
      goal: '配两条去同一目标的路由，平时只有主链路转发，主链路一断自动切到备份链路。',
      scene: '双运营商出口、双上行链路的备份场景，不想上动态路由协议时的最轻方案。',
      topo: {
        h: 275,
        nodes: [
          { id: 'r1', t: 'router', label: 'R1', sub: '出口路由器', x: 110, y: 140 },
          { id: 'r2', t: 'router', label: 'R2', sub: '主链路', x: 380, y: 62 },
          { id: 'r3', t: 'router', label: 'R3', sub: '备链路', x: 380, y: 225 },
          { id: 'tgt', t: 'server', label: '目标网段', sub: '192.168.100.0/24', x: 670, y: 140 }
        ],
        links: [
          ['r1', 'r2', '主 10.0.12.0/24'],
          ['r1', 'r3', '备 10.0.13.0/24'],
          ['r2', 'tgt', '192.168.100.1'],
          ['r3', 'tgt', '192.168.100.2']
        ]
      },
      plan: [
        { dev: 'R1', intf: 'GE0/0/1', ip: '10.0.12.1/24', note: '主链路，指向 R2' },
        { dev: 'R1', intf: 'GE0/0/2', ip: '10.0.13.1/24', note: '备链路，指向 R3' },
        { dev: 'R2', intf: 'GE0/0/0', ip: '10.0.12.2/24', note: '主链路对端' },
        { dev: 'R2', intf: 'GE0/0/1', ip: '192.168.100.1/24', note: '目标网段' },
        { dev: 'R3', intf: 'GE0/0/0', ip: '10.0.13.2/24', note: '备链路对端' },
        { dev: 'R3', intf: 'GE0/0/1', ip: '192.168.100.2/24', note: '目标网段' }
      ],
      vars: {
        target: { label: '目标网段', value: '192.168.100.0', hint: '网段地址', desc: '要去的地方。' },
        targetMask: { label: '目标掩码', value: '255.255.255.0', hint: '/24', desc: '掩码写错会让这条路由匹配到别的网段，看着有路由其实不通。' },
        prefMain: { label: '主路由优先级', value: '60', hint: '1–255', desc: '华为静态路由默认优先级是 60，数值越小越优先。' },
        prefBackup: { label: '备份路由优先级', value: '80', hint: '必须大于主路由', desc: '只比主路由大一点的数（60–100 之间）最省事，写反了备份永远不生效。' }
      },
      steps: [
        {
          title: 'R1：接口地址',
          code: `system-view
sysname R1

interface GigabitEthernet 0/0/1
 ip address 10.0.12.1 255.255.255.0
 quit
interface GigabitEthernet 0/0/2
 ip address 10.0.13.1 255.255.255.0
 quit`
        },
        {
          title: 'R1：两条去同一目标、优先级不同的静态路由',
          note: '这是整个实验的核心，两行命令的差别只在最后的 preference',
          ref: 'static-route',
          code: `ip route-static {{target}} {{targetMask}} 10.0.12.2 preference {{prefMain}}
ip route-static {{target}} {{targetMask}} 10.0.13.2 preference {{prefBackup}}`
        },
        {
          title: 'R2：主链路一侧',
          code: `system-view
sysname R2

interface GigabitEthernet 0/0/0
 ip address 10.0.12.2 255.255.255.0
 quit
interface GigabitEthernet 0/0/1
 ip address 192.168.100.1 255.255.255.0
 quit`
        },
        {
          title: 'R3：备份链路一侧',
          note: '两边都要有回程路由，否则只是「去得通、回不来」',
          code: `system-view
sysname R3

interface GigabitEthernet 0/0/0
 ip address 10.0.13.2 255.255.255.0
 quit
interface GigabitEthernet 0/0/1
 ip address 192.168.100.2 255.255.255.0
 quit

ip route-static 10.0.12.0 255.255.255.0 10.0.13.1`
        }
      ],
      verify: [
        { cmd: 'display ip routing-table {{target}}', hope: '只显示下一跳 10.0.12.2 的那条，优先级 60' },
        { cmd: 'display ip routing-table protocol static', hope: '注意：优先级 80 的备份路由默认不显示，未激活的路由不进主路由表' },
        { cmd: '在 R1 上 shutdown GE0/0/1', hope: '再查路由表，下一跳变成 10.0.13.2；ping 目标网段恢复' },
        { cmd: 'undo shutdown GE0/0/1', hope: '主链路恢复后路由自动切回，备份重新隐藏' }
      ],
      pitfalls: [
        'preference 写反（备份设 50、主设 60）。数值越小越优先，结果备份成了主路由。',
        '看不到备份路由就以为没配上 —— 未激活的路由不进主路由表，这是正常现象。',
        '只配了去的路由，没配回程。现象是能 ping 通一跳、业务不通。',
        '目标网段写成了主机地址（192.168.100.10/24），导致掩码和网段不匹配。',
        '用 shutdown 测切换很方便，但真实故障可能是链路「物理 up、中间断了」，那种场景静态路由感知不到，需要 BFD 或动态路由。'
      ],
      docs: {
        secs: [
          { h: '浮动的本质是优先级差', p: '到同一目的地配两条静态路由，优先级（Preference）不同。数值小的那条进入路由表并转发，数值大的那条处于未激活状态。主路由消失后，备份路由才被激活。这个「备份路由平时待命、故障时顶上来」的行为，就叫浮动静态路由。' },
          { h: 'Preference 的方向别记反', p: '华为设备上 Preference 数值越小越优先：直连 0、静态 60、OSPF 内部 10、OSPF 外部 150。所以备份路由的 Preference 必须比主路由大。' },
          { h: '它的盲区', p: '静态路由只能感知接口状态。如果链路中间断了而本地接口仍 up，路由不会切换。这种场景要靠 BFD 联动静态路由、或者改用 OSPF 等动态协议。' }
        ],
        src: { n: '华为官方 · 配置 IPv4 静态路由备份（浮动静态路由）', u: 'https://support.huawei.com/hedex/api/pages/EDOC1100502133/AZP0905S/03/resources/vrp_ipv4-static-route_cfg_0014.html' }
      }
    },

    {
      id: 'lab-port-isolate',
      title: '端口隔离：同 VLAN 内也能互相看不见',
      level: '入门',
      minutes: 12,
      goal: 'PC1 和 PC2 在同一个 VLAN，但要互相 ping 不通，同时又都能访问 PC3 和网关。',
      scene: '酒店、宿舍、医院病房：同一 VLAN 便于统一网关，但住户之间不该互通。',
      topo: {
        h: 250,
        nodes: [
          { id: 'sw', t: 'switch', label: 'SW1', sub: '隔离组 1', x: 380, y: 70 },
          { id: 'pc1', t: 'pc', label: 'PC1', sub: '192.168.10.11', x: 160, y: 200 },
          { id: 'pc2', t: 'pc', label: 'PC2', sub: '192.168.10.12', x: 380, y: 200 },
          { id: 'pc3', t: 'pc', label: 'PC3', sub: '192.168.10.13', x: 600, y: 200 }
        ],
        links: [
          ['sw', 'pc1', 'GE0/0/1 · 组1'],
          ['sw', 'pc2', 'GE0/0/2 · 组1'],
          ['sw', 'pc3', 'GE0/0/3 · 不隔离']
        ]
      },
      plan: [
        { dev: 'SW1', intf: 'GE0/0/1', ip: 'Access VLAN10', note: 'PC1，加隔离组 1' },
        { dev: 'SW1', intf: 'GE0/0/2', ip: 'Access VLAN10', note: 'PC2，加隔离组 1' },
        { dev: 'SW1', intf: 'GE0/0/3', ip: 'Access VLAN10', note: 'PC3，不加隔离组' },
        { dev: 'SW1', intf: 'Vlanif10', ip: '192.168.10.1/24', note: '三台 PC 的共同网关' }
      ],
      vars: {
        vlanUser: { label: '用户 VLAN', value: '10', hint: '1–4094', desc: '三台 PC 都在这个 VLAN 里。' },
        isoGroup: { label: '隔离组号', value: '1', hint: '1–64', desc: '同一组内的端口互相隔离；不同组之间不隔离。不写组号时默认进组 1。' },
        gwIp: { label: '网关地址', value: '192.168.10.1', hint: 'Vlanif 地址', desc: '想验证「三层仍可通」时需要它。' }
      },
      steps: [
        {
          title: 'SW1：VLAN 和网关',
          code: `system-view
sysname SW1

vlan {{vlanUser}}

interface Vlanif {{vlanUser}}
 ip address {{gwIp}} 255.255.255.0
 quit`
        },
        {
          title: 'SW1：PC1、PC2 划进 VLAN 并加入同一个隔离组',
          note: 'port-isolate enable group N，组号相同才互相隔离',
          code: `interface GigabitEthernet 0/0/1
 port link-type access
 port default vlan {{vlanUser}}
 port-isolate enable group {{isoGroup}}
 quit
interface GigabitEthernet 0/0/2
 port link-type access
 port default vlan {{vlanUser}}
 port-isolate enable group {{isoGroup}}
 quit`
        },
        {
          title: 'SW1：PC3 不加入隔离组（对照组）',
          note: 'PC3 应该能和 PC1、PC2 都通',
          code: `interface GigabitEthernet 0/0/3
 port link-type access
 port default vlan {{vlanUser}}
 quit`
        },
        {
          title: '（可选）要连三层也不通，切成 all 模式',
          note: '默认是 l2：二层隔离、三层互通。管不住跨网段访问',
          code: `port-isolate mode all`
        }
      ],
      verify: [
        { cmd: 'display port-isolate group {{isoGroup}}', hope: 'GE0/0/1 和 GE0/0/2 都在组 1 里' },
        { cmd: 'PC1 ping PC2', hope: '不通（同组隔离生效）' },
        { cmd: 'PC1 ping PC3', hope: '通（PC3 不在隔离组）' },
        { cmd: 'PC1 ping 192.168.10.1', hope: '通 —— 默认 l2 模式下三层转发不受影响' }
      ],
      pitfalls: [
        '以为配了隔离就彻底不通了。默认 port-isolate mode l2，只隔离二层，跨网段（经网关）照样通。要连三层一起断，得切 all 模式。',
        '两台设备之间做隔离组是无效的。端口隔离只在本设备内部生效，跨设备要靠 MUX VLAN 或 ACL。',
        '不同隔离组的端口之间不隔离。想隔离就别把端口分到不同组。',
        '管理口不支持端口隔离命令，配了会报错。',
        '隔离组最多 64 个（不同型号略有差异），大规模场景要提前规划组号。'
      ],
      docs: {
        secs: [
          { h: '端口隔离解决什么问题', p: '同一 VLAN 内的主机默认可以二层互通。用端口隔离把若干端口放进同一个隔离组，组内端口之间的二层报文互不可达，但它们与组外端口、与网关仍然可以正常通信。相比给每户分一个 VLAN，它省 VLAN、省 IP 规划。' },
          { h: 'l2 和 all 的区别', p: 'l2（默认）：只隔离二层，被隔离的两台主机仍可通过三层网关互相访问。all：二层三层都隔离，即使经过网关也无法互访。要不要彻底隔离，取决于业务场景。' },
          { h: '生效范围', p: '端口隔离只在同一台设备内部生效，不影响跨设备流量。另外不同隔离组之间不隔离，只有同组才隔离。' }
        ],
        src: { n: '华为官方 · S5700 V200R011C10 配置指南-接口管理（端口隔离）', u: 'https://support.huawei.com/enterprise/zh/doc/EDOC1000178158/a6ba0af7' }
      }
    }
  ]
};
