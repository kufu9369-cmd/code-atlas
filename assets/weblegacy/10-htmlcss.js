/* ============================================================
   码典 · Web 前端（旧版）· HTML / CSS（8 条）
   ============================================================ */
(function (W) {
  'use strict';

  W.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'web-html5-layout',
      cat: 'web-htmlcss',
      title: 'HTML5 语义化页面骨架',
      desc: 'header / nav / main / aside / footer 各就各位，比一堆 div 好维护也好读屏。',
      tags: ['HTML5', '结构', '入门'],
      device: 'IE9+ / 现代浏览器（IE8 需 html5shiv）',
      level: '入门',
      code: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="{{charset}}">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!-- 302px 是 iPhone 的逻辑宽度基准；老项目固定写 320/375 也行 -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}}</title>
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/main.css">
</head>
<body>
  <header class="hd">
    <h1 class="logo">站点名</h1>
    <nav class="nav">
      <ul>
        <li><a href="/" class="on">首页</a></li>
        <li><a href="/news/">新闻</a></li>
        <li><a href="/about/">关于</a></li>
      </ul>
    </nav>
  </header>

  <main class="main">
    <section class="banner">轮播区</section>
    <section class="list">
      <h2>最新动态</h2>
      <ul><li>条目</li></ul>
    </section>
    <aside class="side">侧栏</aside>
  </main>

  <footer class="ft">© 2026 站点名</footer>

  <script src="js/main.js"></script>
</body>
</html>`,
      vars: {
        charset: { label: '编码', value: 'UTF-8', hint: 'UTF-8 / GBK', desc: '页面文件实际存的编码必须和这里一致，另存为 GBK 却写 UTF-8 必乱码。' },
        title: { label: '页面标题', value: '企业官网', hint: '不超过 30 字', desc: '浏览器标签和搜索结果都显示它，用「栏目 - 站点名」的格式最好认。' }
      },
      docs: {
        secs: [
          { h: 'IE8 为什么认不出这些标签', p: 'IE8 不认识 header / nav / section，会当成行内元素，样式全乱。引入 html5shiv 并写上 /*html5{display:block}*/ 的 CSS 才能救回来。' },
          { h: 'X-UA-Compatible 是干什么的', p: '强制 IE 用最高版本内核渲染，否则装了 Chrome 框架的老 IE 可能用 IE7 模式打开，页面直接错位。这行在维护老项目时经常是"莫名其妙好了"的原因。' },
          { h: '一个页面只应有一个 h1', p: 'SEO 和读屏软件都靠标题层级理解结构。h1 是页面主题，h2 是区块标题，别为了字号大就用 h1。' }
        ],
        src: { n: 'MDN · HTML 元素参考', u: 'https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'web-box-model',
      cat: 'web-htmlcss',
      title: '盒模型：宽度到底算不算 padding',
      desc: '默认 content-box 让元素越撑越宽，加 box-sizing 才能按直觉算尺寸。',
      tags: ['盒模型', 'box-sizing', '布局'],
      device: 'IE8+ / 现代浏览器',
      level: '入门',
      code: `/* 默认：content-box —— width 只算内容区，padding 和 border 往外加 */
.a {
  width: 200px;
  padding: 10px;
  border: 1px solid #ccc;
  /* 实际占位 = 200 + 20 + 2 = 222px */
}

/* 改掉：border-box —— width 含 padding 和 border，写多少就是多少 */
.b {
  box-sizing: border-box;
  width: 200px;
  padding: 10px;
  border: 1px solid #ccc;
  /* 实际占位就是 200px，内容区被压缩到 178px */
}

/* 全站统一（IE8+ 都支持，放心用） */
*, *::before, *::after { box-sizing: border-box; }

/* 百分比宽度 + padding 的老写法：一定会溢出 */
.col { float: left; width: 33.33%; padding: 0 10px; }   /* 总宽 > 100% */
.col { float: left; width: 33.33%; padding: 0 10px; box-sizing: border-box; }  /* 正好 */

/* margin 上下会合并（collapsing），左右不会 */
.box { margin: 20px 0; }   /* 两个相邻 .box 之间只有 20px，不是 40px */`,
      vars: {},
      docs: {
        secs: [
          { h: '三种宽度别搞混', ul: [
            'width：CSS 里写的，content-box 下只是内容区',
            'clientWidth：内容 + padding，不含 border 和滚动条',
            'offsetWidth：内容 + padding + border，布局占位就看它'
          ] },
          { h: 'margin 合并怎么破', p: '相邻兄弟、父子（父无 border/padding 时）都会合并。给父元素加 overflow:hidden 或 padding-top，或者改用 flex 布局，就不会合并了。' },
          { h: 'IE6/7 的怪异模式', p: '不写 DOCTYPE 时 IE 进怪异模式，盒模型等同于 border-box，和老版本页面对不上。这也是"加了 <!DOCTYPE html> 页面就崩了"的原因。' }
        ],
        src: { n: 'MDN · box-sizing', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/box-sizing' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'web-float',
      cat: 'web-htmlcss',
      title: '浮动布局与清除浮动的四种写法',
      desc: '浮动元素脱离文档流，父容器会高度塌陷，清浮动必须做。',
      tags: ['浮动', 'clearfix', '高度塌陷'],
      device: 'IE6+ / 现代浏览器',
      level: '入门',
      code: `.wrap { width: {{wrapWidth}}px; margin: 0 auto; }

/* 两列：左固定，右自适应（BFC 不会被浮动覆盖） */
.side  { float: left; width: 200px; }
.main  { overflow: hidden; }        /* 触发 BFC，自动避开浮动 */

/* 三列等分 */
.col { float: left; width: 33.33%; box-sizing: border-box; padding: 0 10px; }

/* ---------- 清除浮动：四种写法 ---------- */

/* ① 父元素触发 BFC（最省事） */
.clearfix-1 { overflow: hidden; }        /* 副作用：会裁掉溢出的下拉菜单 */
.clearfix-2 { display: flow-root; }      /* 现代写法，无副作用 */

/* ② 伪元素清浮动（兼容性最好，推荐） */
.clearfix::after {
  content: "";
  display: block;
  height: 0;
  clear: both;
  visibility: hidden;
}
.clearfix { *zoom: 1; }                  /* IE6/7 私有属性，触发 hasLayout */

/* ③ 末尾加空元素（能不用就不用，多一层 DOM） */
<div style="clear:both"></div>

/* ④ 直接给下一个元素 clear */
.next { clear: both; }`,
      vars: {
        wrapWidth: {
          label: '容器宽度', value: '1200', type: 'int', min: 320, max: 1920,
          hint: '1200 / 1000 / 百分比',
          desc: 'PC 站常用 1000–1200。做响应式时改成 max-width + width:100%。'
        }
      },
      docs: {
        secs: [
          { h: '为什么父元素会塌陷', p: '浮动元素脱离普通文档流，父元素计算高度时看不到它，只剩 0。所以背景色不够高、边框包不住子元素，都是同一个原因。' },
          { h: 'overflow:hidden 的两个副作用', p: '一是会裁掉溢出的绝对定位子元素（下拉菜单最常见的坑）；二是会和 margin 合并、滚动条行为纠缠。能用 display:flow-root 就用它，现代浏览器都支持。' },
          { h: '*zoom:1 是什么', p: 'IE6/7 的私有 hack，用来触发 hasLayout —— 老 IE 的 BFC 替代品。写在 CSS 里会被其他浏览器忽略，是当年标准的清浮动写法。' }
        ],
        src: { n: 'MDN · float 与清除浮动', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/float' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'web-position',
      cat: 'web-htmlcss',
      title: '定位：父相子绝与层级 z-index',
      desc: 'absolute 参照最近的非 static 祖先，所以「父 relative、子 absolute」是万能组合。',
      tags: ['定位', 'absolute', 'z-index'],
      device: 'IE8+ / 现代浏览器',
      level: '入门',
      code: `.card {
  position: relative;          /* ① 父：只做参照，不给偏移量 */
  padding: 16px;
}

.card .badge {
  position: absolute;          /* ② 子：相对 .card 定位 */
  top: -8px;
  right: -8px;
  z-index: {{zIndex}};              /* 同层叠上下文内，值大的在上 */
}

/* fixed：相对视口，滚动不动。老安卓 WebView 里有兼容问题 */
.backtop { position: fixed; right: 20px; bottom: 20px; }

/* sticky：滚动到阈值就吸顶，父元素不能 overflow:hidden */
.head { position: sticky; top: 0; z-index: 10; }

/* 全屏遮罩：inset 是 top/right/bottom/left 的简写 */
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: none; }
.mask.on { display: block; }

/* 让内容不压在浮层下面：给 body 加 padding-bottom，而不是硬改 z-index */`,
      vars: {
        zIndex: { label: '层级', value: '10', type: 'int', min: 1, max: 9999, hint: '1–9999', desc: '同一层叠上下文内比较。父子元素不在同一上下文时，子元素再大也压不过别的上下文。' }
      },
      docs: {
        secs: [
          { h: '为什么 z-index:9999 还是被盖住', p: 'z-index 只在同一个层叠上下文里比较。父元素一旦有 position + z-index、opacity 小于 1、transform，就会新建上下文，子元素被困在里面，跟外面的 9999 比不了。' },
          { h: 'absolute 找不到参照怎么办', p: '一路往上找都没有非 static 的祖先，就参照初始包含块（近似视口）。表现是「跑到页面左上角了」，说明父元素的 position 忘了写。' },
          { h: 'fixed 在移动端的坑', p: '软键盘弹出时 fixed 元素可能错位，老 iOS 还有滚动抖动。要么改用 absolute + 滚动容器，要么在输入时切回 static。' }
        ],
        src: { n: 'MDN · position', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/position' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'web-center',
      cat: 'web-htmlcss',
      title: '水平垂直居中：从 IE6 到 flex 全集',
      desc: '按「能不能改结构」「浏览器支持到哪儿」选方案，四种写法覆盖所有年代。',
      tags: ['居中', 'flex', '兼容'],
      device: 'IE6+ / 现代浏览器',
      level: '入门',
      code: `/* ① 绝对定位 + 负 margin：需知道宽高，IE6+ 都能用 */
.box { position: absolute; top: 50%; left: 50%;
       width: {{w}}px; height: {{h}}px; margin: -{{halfH}}px 0 0 -{{halfW}}px; }

/* ② 绝对定位 + margin:auto：需知道宽高，IE8+ */
.box { position: absolute; inset: 0; width: {{w}}px; height: {{h}}px; margin: auto; }

/* ③ translate：不需要知道宽高，IE9+ */
.box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }

/* ④ flex：最省心，IE10+（-ms- 前缀）/ 现代浏览器 */
.wrap { display: flex; align-items: center; justify-content: center; height: 100vh; }

/* ⑤ 单行文字垂直居中：line-height 等于高度，最老也最好用 */
.btn { height: 40px; line-height: 40px; text-align: center; }

/* ⑥ table-cell：不知道高度、又要兼容 IE7 时的老办法 */
.wrap { display: table; height: 300px; width: 100%; }
.inner { display: table-cell; vertical-align: middle; text-align: center; }`,
      vars: {
        w: { label: '宽度', value: '300', type: 'int', min: 10, max: 1920, hint: 'px', desc: '方案 ①② 依赖它算负 margin，尺寸固定时才可用。' },
        h: { label: '高度', value: '200', type: 'int', min: 10, max: 1080, hint: 'px', desc: '同上。内容高度不固定时改用 translate 或 flex。' },
        halfW: { label: '宽度一半', value: '150', type: 'int', min: 5, max: 960, hint: '= 宽度 / 2', desc: '负 margin 用。改宽度时记得一起改，这是最容易忘的地方。' },
        halfH: { label: '高度一半', value: '100', type: 'int', min: 5, max: 540, hint: '= 高度 / 2', desc: '负 margin 用，方向是垂直向上。' }
      },
      docs: {
        secs: [
          { h: '怎么选', ul: [
            '只支持现代浏览器：flex，两行搞定',
            '要兼容 IE9：absolute + translate',
            '要兼容 IE7/8 且尺寸固定：absolute + 负 margin',
            '只居中一行字：line-height，最稳'
          ] },
          { h: 'translate 百分比相对谁', p: 'transform 里的百分比是相对元素自身尺寸，不是父元素。所以 translate(-50%,-50%) 正好把元素自身挪回中心，不需要知道具体宽高。' },
          { h: 'flex 居中被内容撑破', p: 'flex 容器里的子元素默认 min-width:auto，内容超长会把容器撑开而不是换行。加 min-width:0 或 overflow:hidden 才能正常收缩。' }
        ],
        src: { n: 'MDN · CSS Flexible Box Layout', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Flexible_Box_Layout' }
      }
    },

    /* ---------------- 6 ---------------- */
    {
      id: 'web-css3',
      cat: 'web-htmlcss',
      title: 'CSS3 圆角 / 阴影 / 渐变 / 过渡',
      desc: '一套老项目常用的装饰写法，顺带记住哪些属性要加 -webkit- 前缀。',
      tags: ['CSS3', '圆角', '渐变', '过渡'],
      device: 'IE9+（渐变 IE10+）',
      level: '进阶',
      code: `.card {
  border-radius: {{radius}}px;                    /* 圆角，IE9+ */
  box-shadow: 0 2px 8px rgba(0, 0, 0, .12);  /* 外阴影 */
  background: #fff;
}

/* 线性渐变：老写法带 -webkit-，现代写法不带 */
.btn {
  background: #4a86ff;
  background: -webkit-linear-gradient(top, #5a94ff, #3a76ef);
  background: linear-gradient(to bottom, #5a94ff, #3a76ef);
  /* 老 IE 用滤镜兜底，现在多数项目可以不管 */
  filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#5a94ff', endColorstr='#3a76ef');
}

/* 过渡：只写要动的属性，别写 all（性能差还会误触发） */
.btn {
  transition: background-color .2s ease, transform .2s ease;
}
.btn:hover { transform: translateY(-1px); }

/* 文本溢出省略号：三行必须一起写 */
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 多行省略：-webkit- 私有属性，兼容性有限但很常用 */
.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}`,
      vars: {
        radius: { label: '圆角半径', value: '8', type: 'int', min: 0, max: 40, hint: 'px', desc: '卡片 8–12，按钮 4–6，头像用 50%。超过元素一半高度会变成胶囊形。' }
      },
      docs: {
        secs: [
          { h: '什么时候还需要前缀', p: '-webkit- 前缀现在主要为了老 Safari / 老安卓 WebView。border-radius、box-shadow 早已不需要；flex、transform、transition 在很老的 WebView 上可能要。用 Autoprefixer 按目标浏览器生成，别手写。' },
          { h: '渐变为什么写了不生效', p: '多数是方向写错（top 是「从上到下」不是「到上」）或颜色值拼错。另外 background 后面又写了 background-color 会覆盖掉渐变，检查层叠顺序。' },
          { h: 'transition all 的坑', p: 'all 会把 width、left 这类触发布局的属性也纳入动画，卡顿明显；而且任何属性变化都会触发过渡，容易出现"莫名其妙闪一下"。明确列出属性最稳。' }
        ],
        src: { n: 'MDN · CSS 渐变', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/gradient' }
      }
    },

    /* ---------------- 7 ---------------- */
    {
      id: 'web-media',
      cat: 'web-htmlcss',
      title: '响应式：媒体查询 + rem 适配',
      desc: 'PC 站做宽度断点，移动端用 rem / vw 等比缩放，两套思路配合用。',
      tags: ['响应式', '媒体查询', 'rem'],
      device: 'IE9+（媒体查询）/ rem IE9+',
      level: '进阶',
      code: `/* ---------- ① 媒体查询：按宽度断点 ---------- */
.wrap { width: {{wrapWidth}}px; margin: 0 auto; }

@media screen and (max-width: 1200px) { .wrap { width: 100%; padding: 0 16px; } }
@media screen and (max-width: 768px)  { .col { width: 50%; } }
@media screen and (max-width: 480px)  { .col { width: 100%; } }

/* 移动端高倍屏图片 */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .logo { background-image: url(img/logo@2x.png); background-size: 100px 40px; }
}

/* ---------- ② rem：根字号随屏宽变化 ---------- */
html { font-size: 16px; }
@media (max-width: 375px) { html { font-size: 14px; } }

.card { padding: 1rem; font-size: .875rem; }   /* 1rem = 当前根字号 */

/* ---------- ③ vw：设计稿 750 的等比方案 ---------- */
/* 100vw = 屏宽，1rem 想等于 设计稿 100px，则 html 字号 = 100 / 750 * 100vw */
html { font-size: 13.3333vw; }
.box { width: 7.5rem; }        /* 设计稿 750px 宽的元素 */`,
      vars: {
        wrapWidth: { label: 'PC 容器宽', value: '1200', type: 'int', min: 320, max: 1920, hint: '1000–1200', desc: '超过 1200 在大屏上会显得空，配合 margin:auto 居中即可。' }
      },
      docs: {
        secs: [
          { h: '为什么用 rem 而不是 px', p: '移动端屏幕从 320 到 430 都有，px 写死在大屏上显得小、小屏上挤。rem 跟着根字号缩放，一套尺寸适配所有宽度。' },
          { h: '断点怎么定', p: '别按机型定（iPhone 有十几种宽度），按内容定：拖窗口拖到布局开始难看的那一刻，就是断点。1200 / 992 / 768 / 480 只是常用起点。' },
          { h: '老安卓的 1px 边框', p: 'devicePixelRatio 为 2 时 1px 看起来偏粗。常见解法是 transform: scaleY(0.5) 的伪元素，或直接接受它——为了 1px 引入一堆 hack 往往不划算。' }
        ],
        src: { n: 'MDN · 使用媒体查询', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/Media_Queries/Using_media_queries' }
      }
    },

    /* ---------------- 8 ---------------- */
    {
      id: 'web-ie-hack',
      cat: 'web-htmlcss',
      title: 'IE 兼容：条件注释与 CSS hack',
      desc: '只对老 IE 生效的写法合集，以及哪些该放弃、哪些必须救。',
      tags: ['IE', 'hack', '兼容'],
      device: 'IE6–IE11',
      level: '进阶',
      code: `<!-- ---------- 条件注释：只给指定 IE 加载 ---------- -->
<!--[if lt IE 9]>
  <script src="js/html5shiv.min.js"></script>
  <script src="js/respond.min.js"></script>   <!-- 让 IE8 支持媒体查询 -->
<![endif]-->

<!--[if IE 8]><link rel="stylesheet" href="css/ie8.css"><![endif]-->
<!--[if IE 9]><link rel="stylesheet" href="css/ie9.css"><![endif]-->
<!-- 条件注释在 IE10+ 已失效，IE10/11 只能靠 CSS hack 或特性检测 -->

/* ---------- CSS hack：只影响特定 IE ---------- */
.selector {
  color: red;            /* 所有浏览器 */
  _color: blue;          /* 只 IE6（下划线 hack） */
  *color: green;         /* 只 IE6/7（星号 hack） */
  color: black \\9;       /* IE6–IE9 */
  color: purple \\0/;     /* IE8/9 */
}

/* ---------- 特性检测比 hack 更靠谱 ---------- */
if (!('placeholder' in document.createElement('input'))) {
  // IE9 及以下没有 placeholder，手动模拟
}

/* ---------- 必须救的三个点 ---------- */
/* 1. IE8 不支持 rgba，用滤镜或纯色兜底 */
.box { background: #333; background: rgba(0,0,0,.8); }
/* 2. IE8 不支持 box-shadow / border-radius，只能给降级样式 */
/* 3. IE9 以下不支持 flex，布局必须另有 float 方案 */`,
      vars: {},
      docs: {
        secs: [
          { h: '先分级再决定救不救', ul: [
            '完全兼容（IE6/7）：成本极高，除非客户明确要求，基本已不该做',
            '基础可用（IE8/9）：布局不乱、功能能用，装饰效果可以降级',
            '现代浏览器（IE10+ / Chrome）：全部效果'
          ] },
          { h: 'hack 写在独立的 ie.css 里', p: '混在主样式里，半年后没人敢删。按版本拆成 ie8.css / ie9.css，用条件注释加载，将来整体丢弃时只删两个文件。' },
          { h: 'IE 的 console 问题', p: 'IE9 不打开开发者工具时 console 对象不存在，任何 console.log 都会抛错并中断脚本。上线前要么删掉，要么在入口加 console 的兜底空实现。' }
        ],
        src: { n: 'MDN · Internet Explorer 兼容性', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Reference' }
      }
    }
  );

  /* 高亮词只放「一眼能认出是 CSS/HTML 专用」的，别把 width / color
     这种满屏都有的词加进来，否则整个代码块会被染成一片蓝色。 */
  W.kw = W.kw.concat([
    'DOCTYPE', 'header', 'footer', 'section', 'aside', 'nav', 'div', 'span',
    'href', 'padding', 'margin', 'border', 'float', 'clear', 'overflow',
    'position', 'absolute', 'relative', 'fixed', 'z-index', 'transform',
    'transition', 'background', 'gradient', 'box-sizing', 'border-radius',
    'media', 'screen', 'viewport', 'rem'
  ]);
})(window.__WEB);
