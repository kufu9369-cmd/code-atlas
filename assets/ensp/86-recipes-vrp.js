/* ============================================================
   码典 · 官方配置步骤（自动生成，别手改）
   ------------------------------------------------------------
   来源：华为 VRP 官方帮助文档的「配置指南」，经 Hinstruction 整理成 160 条。
   生成：node scripts/build-vrp-recipes.js
   收录：124 条（占位符填不出来 / 步骤太少的已剔除）
   约定跟其他剧本完全一样：steps[].c 能直接粘进设备，steps[].note 说为什么这么配。
   改内容 → 改 scripts/build-vrp-recipes.js，别在这里手改。
   ============================================================ */
(function (E) {
  'use strict';

  E.recipes.push(
    {
      id: "rec-vrp-ospf-001",
      title: "广播网络类型",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf network-type broadcast", note: "配置OSPF接口的网络类型为广播。" },
        { c: "ospf dr-priority 1", note: "可选：配置接口在选举DR时的优先级。" },
        { c: "ospf timer wait 30", note: "可选：配置OSPF接口的Wait定时器间隔。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-002",
      title: "使能OSPF IP FRR",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "frr", note: "进入OSPF IP FRR视图。" },
        { c: "loop-free-alternate", note: "使能OSPF IP FRR特性，生成无环的备份链路。" },
        { c: "frr-policy route route-policy T1", note: "可选：配置OSPF IP FRR过滤策略。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-004",
      title: "阻止指定多区域邻接接口创建BFD会话",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf enable area 0", note: "在接口使能OSPF。" },
        { c: "ospf enable multi-area 0", note: "在多区域邻接接口使能OSPF。" },
        { c: "ospf bfd block multi-area 0", note: "阻止指定多区域邻接接口创建BFD会话。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-005",
      title: "多区域邻接接口开销",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf enable area 0", note: "在接口使能OSPF。" },
        { c: "ospf enable multi-area 0", note: "在多区域邻接接口使能OSPF。" },
        { c: "ospf cost 10 multi-area 0", note: "设置多区域邻接接口的开销值。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-006",
      title: "Stub区域",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "area 0", note: "进入OSPF区域视图。" },
        { c: "stub", note: "配置当前区域为Stub区域。" },
        { c: "stub no-summary", note: "可选：配置禁止ABR向Stub区域内发送Type-3 LSA（Summary LSA）。" },
        { c: "stub default-route-advertise backbone-peer-ignore", note: "可选：配置发起默认路由，忽略检查骨干区域的邻居状态。" },
        { c: "default-cost 10", note: "可选：配置发送到Stub区域缺省路由的开销。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-007",
      title: "禁止指定多区域邻接接口的OSPF IP FRR能力",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf enable area 0", note: "在接口使能OSPF。" },
        { c: "ospf enable multi-area 0", note: "在多区域邻接接口使能OSPF。" },
        { c: "ospf frr block multi-area 0", note: "禁止指定多区域邻接接口的OSPF IP FRR能力。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-009",
      title: "抑制接口地址的发布",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "suppress-reachability", note: "配置抑制OSPF进程所有接口地址的发布。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf suppress-reachability", note: "配置抑制指定接口地址的发布。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-010",
      title: "NSSA区域",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "area 0", note: "进入OSPF区域视图。" },
        { c: "default-cost 10", note: "可选：配置ABR发送到NSSA区域的Type-3 LSA的缺省路由的开销。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-012",
      title: "OSPF接口认证",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf authentication-mode keychain Huawei@123", note: "cipher" },
        { c: "ospf authentication-mode null", note: "keychain" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-015",
      title: "接口发送Hello报文的时间间隔",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf timer hello 30", note: "配置接口发送Hello报文的时间间隔。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-016",
      title: "使能OSPF与BGP联动功能",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "stub-router on-startup", note: "将当前设备设置为Stub路由器。" },
        { c: "safe-sync enable", note: "配置安全同步功能。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-017",
      title: "指定接口的BFD for OSPF",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bfd", note: "使能全局BFD功能。" },
        { c: "quit", note: "返回系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf bfd enable", note: "配置BFD for OSPF特性。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-018",
      title: "LSA保持最大开销值的时间",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf peer hold-max-cost timer 30", note: "配置OSPF在本地设备的LSA中保持最大开销值的时间。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-019",
      title: "Smart-discover",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf smart-discover", note: "配置接口的Smart-discover功能。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-022",
      title: "OSPF负载分担",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "maximum load-balancing 1", note: "配置最大等价路由条数。" },
        { c: "nexthop 10.0.0.1 weight 1", note: "可选：配置等价路由的优先级。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-023",
      title: "多区域邻接接口验证方式",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf enable area 0", note: "在接口使能OSPF。" },
        { c: "ospf enable multi-area 0", note: "在多区域邻接接口使能OSPF。" },
        { c: "ospf authentication-mode keychain Huawei@123 multi-area 0", note: "cipher" },
        { c: "ospf authentication-mode null multi-area 0", note: "multi-area" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-024",
      title: "OSPF主机名",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "opaque-capability enable", note: "使能Opaque-LSA功能。" },
        { c: "hostname", note: "配置OSPF的动态主机名。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-025",
      title: "指定进程的BFD for OSPF",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "先进入系统视图，后面所有配置都在这里面" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf bfd block", note: "阻止指定接口创建BFD会话。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-026",
      title: "OSPF Network-LSA延迟删除功能",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF视图。" },
        { c: "area 0", note: "进入OSPF区域视图。" },
        { c: "network-lsa delete-delay", note: "配置OSPF Network-LSA延迟删除功能。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-028",
      title: "OSPF邻居震荡抑制",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf suppress-flapping peer disable quit", note: "可选：去使能OSPF邻居震荡抑制功能。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf suppress-flapping peer hold-down 30", note: "配置震荡抑制模式为Hold-down模式，并设置抑制持续时间。" },
        { c: "ospf suppress-flapping peer hold-max-cost disable", note: "可选：取消Hold-max-cost邻居震荡抑制模式。" },
        { c: "quit quit reset ospf 1 suppress-flapping peer", note: "可选：强制OSPF接口退出邻居震荡抑制阶段。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-029",
      title: "P2P网络类型",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf network-type p2p", note: "配置OSPF接口的网络类型为P2P。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-030",
      title: "OSPF邻居的失效时间",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf timer dead 30", note: "设置OSPF邻居失效的时间。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-031",
      title: "接收LSA的时间间隔",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "lsa-arrival-interval suppress-flapping 30", note: "可选：配置接收的OSPF LSA发生震荡时的抑制时间。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-033",
      title: "OSPF接口对LSA的传输延迟时间",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf trans-delay 1", note: "设置接口对LSA的传输延迟时间。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-034",
      title: "LSDB中外部路由的最大数量",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "lsdb-overflow-limit 1", note: "配置LSDB中外部路由的最大数量。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-035",
      title: "OSPF接口开销",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf cost 1", note: "设置OSPF接口的开销值。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "bandwidth-reference 1", note: "配置带宽参考值。" },
        { c: "bandwidth-config enable", note: "使能接口的配置带宽参与OSPF的接口开销值计算。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-036",
      title: "LSA频繁振荡时路由延迟计算功能",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "maxage-lsa route-calculate-delay 30", note: "使能OSPF LSA频繁振荡时路由延迟计算功能。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-037",
      title: "OSPF对发送的LSA进行过滤",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "quit", note: "返回系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-041",
      title: "OSPF对接收的路由进行过滤",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "filter-policy ip-prefix T1 import", note: "import" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-042",
      title: "邻接设备重传LSA的间隔",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf timer retransmit 30", note: "设置邻接设备重传LSA的间隔。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-043",
      title: "关闭OSPF LSA老化时间管理功能",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "lsa-age refresh disable", note: "关闭OSPF LSA老化时间管理功能。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-044",
      title: "安全同步",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "safe-sync enable", note: "配置安全同步功能。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-045",
      title: "OSPF sham-hello功能",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "sham-hello enable", note: "配置OSPF的sham-hello功能。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-048",
      title: "NBMA网络类型",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" },
        { c: "ospf network-type nbma", note: "配置OSPF接口的网络类型为NBMA。" },
        { c: "ospf timer poll 30", note: "可选：在NBMA接口上配置发送轮询报文的时间间隔。" },
        { c: "ospf dr-priority 1", note: "可选：配置接口在选举DR时的优先级。" },
        { c: "ospf timer wait 30", note: "可选：配置OSPF接口的Wait定时器间隔。" },
        { c: "quit", note: "退出当前接口视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "peer 10.0.0.1", note: "配置NBMA网络的邻居。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-049",
      title: "OSPF多区域邻接接口的邻居震荡抑制",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf suppress-flapping peer disable quit", note: "可选：去使能OSPF邻居震荡抑制功能。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf enable area 0", note: "在接口使能OSPF。" },
        { c: "ospf enable multi-area 0", note: "在多区域邻接接口使能OSPF。" },
        { c: "ospf suppress-flapping peer disable multi-area 0", note: "可选：去使能多区域邻接接口的OSPF邻居震荡抑制功能。" },
        { c: "ospf suppress-flapping peer hold-down 30 multi-area 0", note: "配置多区域邻接接口的震荡抑制模式为Hold-down模式，并设置抑制持续时间。" },
        { c: "ospf suppress-flapping peer hold-max-cost disable multi-area 0", note: "可选：取消Hold-max-cost邻居震荡抑制模式。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-050",
      title: "多区域邻接接口快速收敛",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ospf enable area 0", note: "在接口使能OSPF。" },
        { c: "ospf enable multi-area 0", note: "在多区域邻接接口使能OSPF。" },
        { c: "ospf timer hello 30 multi-area 0", note: "请根据实际需要，配置多区域邻接接口快速收敛。" },
        { c: "ospf timer dead 30 multi-area 0", note: "multi-area" },
        { c: "ospf timer retransmit 30 multi-area 0", note: "multi-area" },
        { c: "ospf smart-discover multi-area 0", note: "multi-area" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-ospf-052",
      title: "OSPF GR Helper",
      scene: "华为官方配置步骤（OSPF）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["ospf","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ospf 1", note: "进入OSPF进程视图。" },
        { c: "opaque-capability enable", note: "使能opaque-LSA特性。" },
        { c: "quit", note: "配置OSPF GR Helper，并设置过滤策略，当前设备只能作为通过过滤策略的邻居的GR Helper。请根据实际情况选择以下配置方式中的一种：" },
        { c: "ospf 1", note: "time-range" },
        { c: "graceful-restart helper-role ignore-external-lsa", note: "可选：配置Helper不对自治系统外部的LSA（AS-external LSA）进行检查。" },
        { c: "graceful-restart helper-role planned-only", note: "可选：配置Helper只支持Planned GR。" },
        { c: "graceful-restart non-ietf", note: "可选：使能非标准（Non-IETF）模式。" }
      ],
      verify: [{cmd:"display ospf peer brief",hope:"邻居状态到 Full"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-054",
      title: "BGP4+生成聚合缺省路由",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ip ipv6-prefix ipv6-prefix-name 1 2001:db8::1 255.255.255.0", note: "执配置IPv6地址前缀列表。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入BGP IPv6单播地址族视图。" },
        { c: "aggregate default-route origin-ipv6-prefix 2001:db8::1", note: "配置BGP按IPv6地址前缀过滤器生成聚合缺省路由。" },
        { c: "advertise aggregate-route lowest-priority", note: "可选：配置BGP4+聚合路由的优先级调整为低优先级。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-055",
      title: "BGP4+连接重传定时器",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "timer connect-retry 30", note: "配置BGP4+全局连接重传定时器。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-056",
      title: "BGP连接重传定时器",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "timer connect-retry 30", note: "配置BGP全局连接重传定时器。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-058",
      title: "BGP4+路径属性的处理方式",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入BGP IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-059",
      title: "BGP4+缺省路由",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-060",
      title: "混合EBGP对等体组",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "group T1 external", note: "创建EBGP对等体组。" },
        { c: "peer 10.0.0.1 as-number 100", note: "创建对等体，设置对等体的AS编号。" },
        { c: "peer T1 description T1", note: "可选：配置对等体组的描述信息。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-061",
      title: "BGP存活和保持定时器",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "timer keepalive 30 hold 30", note: "配置BGP定时器。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-062",
      title: "BGP下一跳迭代震荡抑制功能",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "undo nexthop recursive-lookup restrain disable", note: "使能下一跳迭代震荡抑制功能。" },
        { c: "quit", note: "退回BGP视图。" },
        { c: "nexthop recursive-lookup restrain suppress-interval 30 hold-interval 30 clear-interval 30", note: "配置下一跳迭代震荡抑制需要的抑制惩罚计数的时间阈值、保持惩罚计数的时间阈值和清除惩罚计数的时间阈值。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-063",
      title: "纯EBGP对等体组",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "group T1 external", note: "创建EBGP对等体组。" },
        { c: "peer T1 as-number 100", note: "设置该对等体组所属的AS编号。" },
        { c: "peer T1 description T1", note: "可选：配置对等体组的描述信息。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-064",
      title: "BGP生成聚合缺省路由",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ip ip-prefix ip-prefix-name 1 10.0.0.1 255.255.255.0", note: "配置IPv4地址前缀列表。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" },
        { c: "aggregate default-route origin-ip-prefix T1", note: "配置BGP按IPv4地址前缀过滤器生成聚合缺省路由。" },
        { c: "advertise aggregate-route lowest-priority", note: "可选：配置BGP聚合路由的优先级调整为低优先级。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-065",
      title: "应用BGP4+路由信息的接收策略",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "system-view", note: "进入系统视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-066",
      title: "BGP路径属性的处理方式",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-067",
      title: "应用BGP4+路由信息的发布策略",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "system-view", note: "进入系统视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-068",
      title: "IPv4/IPv6双协议栈",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "ipv6 enable", note: "使能接口的IPv6功能。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-069",
      title: "BGP对等体检测物理接口状态",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "vpn-instance VPN1", note: "可选：进入BGP-VPN实例视图。" },
        { c: "ipv4-family vpn-instance VPN1", note: "可选：进入BGP-VPN实例IPv4地址族视图。" },
        { c: "peer 10.0.0.1 rely-state interface GigabitEthernet 0/0/0", note: "配置BGP对等体检测指定物理接口物理状态。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-070",
      title: "BGP Auto FRR",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" },
        { c: "auto-frr", note: "使能单播路由的BGP Auto FRR功能。" },
        { c: "route-select delay 1", note: "可选：配置选路延迟功能。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-071",
      title: "BGP Best External",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family vpnv4", note: "进入BGP-VPNv4地址族视图" },
        { c: "bestroute best-external", note: "配置BGP在优选路由为IBGP路由时选出次优路由（Best-external路由）的功能。" },
        { c: "peer 10.0.0.1 advertise best-external", note: "配置BGP向邻居发布Best-external路由的功能。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-072",
      title: "BGP SSL/TLS认证",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "ssl policy T1", note: "创建SSL策略并进入SSL策略视图。" },
        { c: "quit", note: "返回系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-073",
      title: "BGP动态对等体组",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "bgp dynamic-session-limit 1", note: "可选：配置允许建立的BGP动态对等体会话的最大数量。" },
        { c: "peer T1 listen-as 1 1", note: "可选：配置EBGP动态对等体组侦听的对端AS号。" },
        { c: "peer T1 listen-as-segment begin-as 1 end-as 1", note: "可选：配置EBGP动态对等体组侦听的对端AS段。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-074",
      title: "IBGP对等体组",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "group T1 internal", note: "创建IBGP对等体组。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "peer T1 description T1", note: "可选：配置对等体组的描述信息。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-075",
      title: "BFD for BGP",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bfd", note: "使能全局BFD功能。" },
        { c: "quit", note: "返回系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "peer 10.0.0.1 bfd block", note: "可选：阻止对等体从对等体组中继承BFD功能。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-076",
      title: "BGP4+联盟",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "confederation id 100", note: "配置联盟ID。" },
        { c: "confederation peer-as 100 1", note: "配置与本地AS连接的其他EBGP对等体所属的子自治系统号。" },
        { c: "confederation nonstandard", note: "可选：配置和非标准的联盟兼容。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-077",
      title: "BFD for BGP4+",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bfd", note: "对本节点使能全局BFD能力。" },
        { c: "quit", note: "返回系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "peer 2001:db8::1 bfd block", note: "可选：阻止对等体从对等体组中继承BFD功能。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-078",
      title: "BGP联盟",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "confederation id 100", note: "配置联盟ID。" },
        { c: "confederation peer-as 100 1", note: "配置与本地AS连接的其他EBGP对等体所属的子自治系统号。" },
        { c: "confederation nonstandard", note: "可选：配置与非标准的AS联盟兼容。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-080",
      title: "BGP4+对等体检测物理接口状态",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "vpn-instance VPN1", note: "可选：进入BGP-VPN实例视图。" },
        { c: "ipv6-family vpn-instance VPN1", note: "可选：进入BGP-VPN实例IPv6地址族视图。" },
        { c: "peer 2001:db8::1 rely-state interface GigabitEthernet 0/0/0", note: "配置BGP4+对等体检测指定物理接口物理状态。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-081",
      title: "基于前缀的BGP ORF",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-082",
      title: "BGP发送超网单播路由",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" },
        { c: "supernet unicast advertise enable", note: "配置向对等体发送BGP超网单播路由。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-083",
      title: "本机的缺省Local_Pref属性值",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "default local-preference 1", note: "配置本机的缺省Local_Pref属性值。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-084",
      title: "BGP4+感知Eth-Trunk接口状态",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-085",
      title: "BGP4+更新报文定时器",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-086",
      title: "BGP4+协议优先级",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-087",
      title: "BGP4+路由迭代到缺省路由",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "nexthop recursive-lookup default-route", note: "配置BGP4+路由迭代到缺省路由。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-088",
      title: "BGP协议优先级",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "可选：进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-089",
      title: "BGP路由信息的首选值",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-090",
      title: "BGP负载分担",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "load-balancing as-path-ignore", note: "可选：改变负载分担的规则：" },
        { c: "load-balancing as-path-relax", note: "可选：改变负载分担的规则：" },
        { c: "load-balancing igp-metric-ignore", note: "可选：改变负载分担的规则：" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-091",
      title: "BGP4+路由衰减",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-092",
      title: "BGP4+ GR Helper",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "graceful-restart", note: "配置BGP4+协议的GR能力。" },
        { c: "graceful-restart timer wait-for-rib 30", note: "可选：配置重启侧（Restarting Speaker）和接收侧（Receiving Speaker）等待End-of-RIB消息的时间。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-093",
      title: "控制BGP路由信息的发布",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "acl name T1 basic", note: "选择执行下列命令，配置BGP对发往全局的路由信息进行过滤。" },
        { c: "system-view", note: "进入系统视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-094",
      title: "向对等体发送缺省路由",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-095",
      title: "BGP IPv6单播路由迭代到LDP LSP",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "unicast-route recursive-lookup tunnel-v4", note: "使能BGP-IPv6单播路由迭代LDP LSP功能。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-096",
      title: "BGP感知Eth-Trunk接口状态",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-097",
      title: "BGP路由衰减",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-098",
      title: "BGP路由迭代到缺省路由",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "nexthop recursive-lookup default-route", note: "配置BGP路由迭代到缺省路由。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-099",
      title: "BGP4+路由反射器",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "undo reflect between-clients", note: "可选：禁止客户机之间通过RR的路由反射。" },
        { c: "routing-table rib-only", note: "可选：禁止BGP4+路由下发到IP路由表。" },
        { c: "reflect change-path-attribute", note: "可选：使能路由反射器通过出口策略修改BGP4+路由的路径属性。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-100",
      title: "控制BGP路由信息的接收",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "acl name T1 basic", note: "选择执行下列命令，配置BGP对从全局接收的路由信息进行过滤。" },
        { c: "system-view", note: "进入系统视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-101",
      title: "（可选）配置应用隧道策略",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入BGP-IPv6单播地址族视图。" },
        { c: "peer 10.0.0.1 tnl-policy T1", note: "配置在指定的IPv4对等体上应用隧道策略。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-102",
      title: "使能IBGP邻居快速复位",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "ibgp-interface-sensitive", note: "使能在IBGP邻居的本地直连接口故障后，立即删除建立在该接口上的直连IBGP邻居。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-103",
      title: "BGP路由聚合",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "summary automatic", note: "配置对本地引入的路由自动聚合。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "advertise aggregate-route lowest-priority", note: "可选：配置BGP聚合路由的优先级调整为低优先级。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-104",
      title: "BGP4+团体属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "quit", note: "退出路由策略视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入BGP IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-105",
      title: "BGP4+ Auto FRR",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入BGP-IPv6单播地址族视图。" },
        { c: "auto-frr", note: "使能单播路由的BGP4+ Auto FRR功能。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-106",
      title: "BGP基本团体属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "quit", note: "退出路由策略视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-107",
      title: "BGP路由反射器",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" },
        { c: "undo reflect between-clients", note: "禁止客户机之间通过RR的路由反射。" },
        { c: "routing-table rib-only", note: "可选：禁止优选的BGP路由下发到IP路由表。" },
        { c: "reflect change-path-attribute", note: "可选：使能路由反射器通过出口策略修改BGP路由的路径属性。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-109",
      title: "BGP对等体单独作为一个打包组",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family vpnv4", note: "进入BGP-VPNv4地址族视图。" },
        { c: "peer 10.0.0.1 update-group-independent enable", note: "配置BGP对等体单独作为一个打包组。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-111",
      title: "BGP4+对等体存活和保持定时器",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "peer 2001:db8::1 timer send-hold 30", note: "min-holdtime" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-112",
      title: "BGP4+路由聚合",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "advertise aggregate-route lowest-priority", note: "可选：配置BGP4+聚合路由的优先级调整为低优先级。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-113",
      title: "对BGP下一跳迭代结果变化的延迟响应",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "nexthop recursive-lookup delay", note: "配置对下一跳迭代结果变化的延迟响应。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-115",
      title: "BGP Large-Community团体属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "quit", note: "退出路由策略视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-117",
      title: "Next_Hop属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-119",
      title: "BGP4+邻居震荡抑制",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "peer 2001:db8::1 oscillation-dampening", note: "对持续震荡的BGP4+对等体建连进行抑制。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-121",
      title: "BGP活跃路由发布",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "active-route-advertise", note: "配置BGP仅发布在IP路由表中被优选的路由给邻居。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-123",
      title: "BGP4+ Large-community属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "quit", note: "退出路由策略视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入BGP IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-124",
      title: "MED属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-126",
      title: "BGP按路由策略迭代下一跳",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "nexthop recursive-lookup route-policy T1", note: "配置BGP按指定路由策略迭代下一跳。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-128",
      title: "使能EBGP邻居快速复位",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ebgp-interface-sensitive", note: "使能EBGP邻居快速复位。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-129",
      title: "BGP邻居震荡抑制",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "peer 10.0.0.1 oscillation-dampening", note: "对持续震荡的BGP对等体建连进行抑制。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-130",
      title: "BGP扩展团体属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "apply extcommunity soo 1 1 additive", note: "additive" },
        { c: "quit", note: "退出路由策略视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入BGP IPv4单播地址族视图。" },
        { c: "ext-community-change enable", note: "可选：配置允许通过路由策略修改扩展团体属性，并将变更后的扩展团体属性发送给对等体（组）。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-131",
      title: "BGP4+负载分担",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "load-balancing as-path-ignore", note: "可选：改变负载分担的规则：" },
        { c: "load-balancing as-path-relax", note: "可选：改变负载分担的规则：" },
        { c: "load-balancing igp-metric-ignore", note: "可选：改变负载分担的规则：" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-132",
      title: "BGP4+扩展团体属性",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "apply extcommunity soo 1 1 additive", note: "additive" },
        { c: "quit", note: "退出路由策略视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入BGP IPv6单播地址族视图。" },
        { c: "ext-community-change enable", note: "可选：配置允许通过路由策略修改扩展团体属性，并将变更后的扩展团体属性发送给对等体（组）。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-133",
      title: "启动BGP进程",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "route loop-detect bgp enable", note: "可选：使能BGP环路检测功能。" },
        { c: "bgp 100", note: "启动BGP（指定本地AS编号），进入BGP视图。" },
        { c: "router-id 10.0.0.1", note: "可选：配置BGP的Router ID。" },
        { c: "prefix memory-limit", note: "可选：配置BGP内存保护。" },
        { c: "advertise lowest-priority on-startup", note: "可选：配置BGP把发布给邻居的路由改为最低优先级。" },
        { c: "advertise lowest-priority all-address-family peer-up", note: "可选：配置在邻居状态由Down到Up时将BGP路由的优先级调整为最低优先级。" },
        { c: "advertise delay on-startup delay-time 30", note: "可选：配置设备重启后将BGP路由延迟发布。" },
        { c: "vrf-route-distribute vpnv4 disable", note: "可选：配置BGP单播私网路由不上送到BGP VPNv4。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-135",
      title: "BGP ADD-PATH",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "route-policy T1 1 node 1", note: "可选：创建Route-Policy并进入该Route-Policy视图。" },
        { c: "quit", note: "可选：返回系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv4-family unicast", note: "进入IPv4单播地址族视图。" },
        { c: "bestroute add-path path-number 1", note: "使能BGP ADD-PATH特性，并指定优选出的路由的数量。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-136",
      title: "BGP4+ ADD-PATH",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "route-policy T1 1 node 1", note: "可选：创建Route-Policy并进入该Route-Policy视图。" },
        { c: "quit", note: "可选：返回系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" },
        { c: "bestroute add-path path-number 1", note: "使能BGP4+ ADD-PATH特性，并指定优选出的路由的数量。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bgp 100", note: "进入BGP视图。" },
        { c: "ipv6-family unicast", note: "进入IPv6单播地址族视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-bgp-137",
      title: "BGP BMP",
      scene: "华为官方配置步骤（BGP）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "综合",
      tags: ["bgp","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "bmp", note: "启动BMP并进入BMP视图。" },
        { c: "statistics-timer 30", note: "可选：配置BMP向监控服务器上报BGP运行状态统计信息的时间间隔。" },
        { c: "bmp-session 10.0.0.1", note: "配置BMP与监控服务器建立TCP连接的IPv4会话地址。" },
        { c: "monitor public", note: "配置BMP向监控服务器上报的路由类型。" },
        { c: "quit", note: "返回到BMP Session视图。" },
        { c: "ssl-policy name T1", note: "可选：配置BMP的SSL策略。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bmp", note: "启动BMP并进入BMP视图。" },
        { c: "bmp-session 10.0.0.1", note: "配置BMP与监控服务器建立TCP连接的IPv4会话地址。" },
        { c: "ipv4 unicast", note: "使能并进入BMP Session IPv4单播视图。" },
        { c: "trace-prefix all", note: "监控所有IPv4公网单播路由的处理轨迹，或者监控指定IPv4公网单播路由的处理轨迹。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "bmp", note: "启动BMP并进入BMP视图。" },
        { c: "bmp-session 10.0.0.1", note: "配置BMP与监控服务器建立TCP连接的IPv4会话地址。" },
        { c: "ipv4 vpn", note: "使能并进入BMP Session IPv4 VPN视图。" }
      ],
      verify: [{cmd:"display bgp peer",hope:"邻居状态到 Established"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-139",
      title: "使能IS-IS Auto FRR",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "frr", note: "进入IS-IS FRR视图。" },
        { c: "ipv6 frr", note: "进入IS-IS FRR视图。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-140",
      title: "调整IS-IS邻居震荡抑制参数",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "将接口从二层模式切换到三层模式。" },
        { c: "isis suppress-flapping peer hold-down 30", note: "配置震荡抑制模式为Hold-down模式。" },
        { c: "quit", note: "返回系统视图。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-141",
      title: "抑制IS-IS接口地址发布",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "将接口从二层模式切换到三层模式。" },
        { c: "isis enable", note: "使能接口IS-IS功能。" },
        { c: "isis suppress-reachability", note: "抑制IS-IS接口地址发布。" },
        { c: "isis ipv6 suppress-reachability", note: "抑制IS-IS接口地址发布。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-144",
      title: "IS-IS的SRLG FRR功能",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "将接口从二层模式切换到三层模式。" },
        { c: "isis srlg 1", note: "接口加入共享风险链路组SRLG（Shared Risk Link Group）。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-145",
      title: "IS-IS对等价路由处理方式",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "maximum load-balancing 1", note: "配置等价路由的最大数量。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "nexthop 10.0.0.1 weight 1", note: "配置等价路由的优先级。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-146",
      title: "调整邻居故障的检测时间",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "将接口从二层模式切换到三层模式。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-147",
      title: "设置IS-IS管理标记",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "配置接口从二层模式切换到三层模式。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-148",
      title: "调整SPF的计算时间",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "timer spf 30", note: "设置SPF智能定时器。" },
        { c: "suppress-flapping route-calculate timer 30", note: "设置路由振荡时收到LSP后启动路由计算的抑制时间。" },
        { c: "timer purge-zero-lsp route-calculate-delay 30", note: "设置收到Purge LSP报文后启动路由计算的抑制时间。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-149",
      title: "去使能IS-IS邻居震荡抑制功能",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "进阶",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "suppress-flapping peer disable", note: "去使能全局IS-IS邻居震荡抑制功能。" },
        { c: "quit", note: "退出IS-IS视图，并返回系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "将接口从二层模式切换到三层模式。" },
        { c: "isis suppress-flapping peer disable", note: "仅在该接口去使能IS-IS邻居震荡抑制功能。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-150",
      title: "IS-IS智能收敛功能",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "intelligent-convergence enable", note: "配置IS-IS智能收敛功能。" },
        { c: "ipv6 intelligent-convergence enable", note: "配置IS-IS智能收敛功能。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-153",
      title: "IS-IS主机名",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "创建IS-IS进程并进入IS-IS视图。" },
        { c: "is-name T1", note: "配置IS-IS动态主机名映射。" },
        { c: "is-name map 1 T1", note: "配置IS-IS静态主机名映射。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-154",
      title: "启动IS-IS接口抑制功能",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "将接口从二层模式切换到三层模式。" },
        { c: "isis silent", note: "启动IS-IS接口抑制功能。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-157",
      title: "IS-IS Mesh Group",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "interface GigabitEthernet 0/0/0", note: "进入接口视图。" },
        { c: "undo portswitch", note: "将接口从二层模式切换到三层模式。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-158",
      title: "使能IS-IS设备的LSP分片扩展",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis 1", note: "进入IS-IS视图。" },
        { c: "virtual-system 1", note: "配置虚拟系统。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    },
    {
      id: "rec-vrp-is-is-159",
      title: "去使能自动修改本地System ID功能",
      scene: "华为官方配置步骤（IS-IS）。占位符已填成示例值，按自己的拓扑改地址和接口号。",
      level: "入门",
      tags: ["isis","路由","官方"],
      topic: 'net',
      steps: [
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis system-id auto-recover disable", note: "配置去使能设备当检测网络中有System ID冲突时自动修改本地System ID功能。" },
        { c: "system-view", note: "进入系统视图。" },
        { c: "isis lsp seq-overflow auto-recover disable", note: "配置去使能当设备本地LSP序列号达到最大值时自动修改本地System ID功能。" }
      ],
      verify: [{cmd:"display isis peer",hope:"邻居状态到 Up"}],
      origin: 'official'
    }
  );
})(window.__ENSP);
