/* ============================================================
   码典 · Web 前端（旧版）专题（分片收集器）
   ------------------------------------------------------------
   定位：不是「最新前端教程」，而是接手老项目、维护存量页面、
   应付还在跑 IE / 老安卓 WebView 的现场。

     10-htmlcss.js  HTML 结构、盒模型、浮动、定位、居中、CSS3、适配、IE hack
     20-js.js       DOM、事件、定时器、正则校验、原生 Ajax、存储、面向对象
     30-jquery.js   选择器、DOM、事件委托、Ajax、动画、插件
     40-compat.js   轮播、选项卡、懒加载、布局坑、iframe 上传、打印
     50-labs.js     实训
     60-presets-flows.js  整套页面 + 排错工作流
     70-cmd.js      命令 / API 词条
   ============================================================ */
window.__WEB = window.__WEB || {
  topic: 'web',
  cats: [
    {
      id: 'web-htmlcss', name: 'HTML / CSS',
      sub: '语义结构、盒模型、浮动、定位、居中、CSS3、适配、IE hack',
      icon: 'layers', short: 'HTML/CSS', ext: 'html'
    },
    {
      id: 'web-js', name: 'JavaScript',
      sub: 'DOM、事件、定时器、表单校验、原生 Ajax、存储、原型与闭包',
      icon: 'code', short: 'JS', ext: 'js'
    },
    {
      id: 'web-jquery', name: 'jQuery',
      sub: '选择器、DOM 操作、事件委托、$.ajax、动画、插件',
      icon: 'git', short: 'jQuery', ext: 'js'
    },
    {
      id: 'web-compat', name: '兼容 / 实战',
      sub: '轮播、选项卡、懒加载、布局坑、iframe 上传、打印样式',
      icon: 'branch', short: '实战', ext: 'js'
    }
  ],
  items: [],
  labs: [],
  presets: [],
  flows: [],
  cmd: {},
  cmdSrc: {},
  kw: []
};
