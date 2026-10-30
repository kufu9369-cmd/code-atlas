/* ============================================================
   码典 · Web 前端（旧版）· 兼容 / 实战（6 条）
   ============================================================ */
(function (W) {
  'use strict';

  W.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'web-carousel',
      cat: 'web-compat',
      title: '原生 JS 轮播图（可自动播、可暂停）',
      desc: '不引组件库，一个定时器 + 位移实现，鼠标移入暂停、移出继续。',
      tags: ['轮播', '定时器', '实战'],
      device: 'IE9+ / 现代浏览器',
      level: '进阶',
      code: `<div class="carousel" id="{{carouselId}}">
  <ul class="slides">
    <li><img src="img/1.jpg" alt=""></li>
    <li><img src="img/2.jpg" alt=""></li>
    <li><img src="img/3.jpg" alt=""></li>
  </ul>
  <div class="dots"></div>
</div>

.carousel { position: relative; width: 100%; height: 360px; overflow: hidden; }
.slides { position: absolute; left: 0; top: 0; width: 300%; height: 100%; }
.slides li { float: left; width: 33.3333%; height: 100%; list-style: none; }
.slides li img { width: 100%; height: 100%; object-fit: cover; }
.dots { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; }
.dots i { display: inline-block; width: 8px; height: 8px; margin: 0 4px;
          border-radius: 50%; background: rgba(255,255,255,.5); cursor: pointer; }
.dots i.on { background: #fff; }

(function () {
  var wrap = document.getElementById('{{carouselId}}');
  var ul = wrap.querySelector('.slides');
  var lis = ul.children;
  var total = lis.length;
  var idx = 0;
  var timer = null;

  // 生成小圆点
  var dots = wrap.querySelector('.dots');
  for (var i = 0; i < total; i++) {
    var d = document.createElement('i');
    d.setAttribute('data-i', i);
    dots.appendChild(d);
  }
  var ds = dots.children;

  function go(n) {
    idx = (n + total) % total;                 // 循环取模，越界自动回绕
    ul.style.transition = 'left .4s';
    ul.style.left = -idx * 100 / total + '%';
    for (var i = 0; i < total; i++) ds[i].className = (i === idx) ? 'on' : '';
  }

  function play() { timer = setInterval(function () { go(idx + 1); }, {{interval}}); }
  function stop() { clearInterval(timer); }

  dots.onclick = function (e) {
    var t = e.target;
    if (t.tagName === 'I') go(+t.getAttribute('data-i'));
  };
  wrap.onmouseenter = stop;
  wrap.onmouseleave = play;

  go(0); play();
})();`,
      vars: {
        carouselId: { label: '轮播容器 id', value: 'banner', hint: '不带 #', desc: '页面上有多个轮播时靠 id 区分，别用 class 拿第一个。' },
        interval: { label: '切换间隔（毫秒）', value: '4000', type: 'int', min: 1000, max: 15000, hint: '3000–5000', desc: '低于 2 秒用户看不清；图片多时适当加长。' }
      },
      docs: {
        secs: [
          { h: '为什么不逐个改 left', p: '改每个 li 的样式要循环改 DOM，切换瞬间可能闪。把 ul 整体位移，一次 style 赋值，配合 transition 就是平滑滑动。' },
          { h: '切换时文字/按钮点不到', p: '轮播经常在动画中响应点击，导致连点错乱。加一个"是否在动画中"的锁，或者在 transitionend 里再解锁。' },
          { h: '移动端要加手势', p: '老项目常只做自动播放。至少加上 touchstart / touchend 算横向位移判断左右滑，体验差别很大。' }
        ],
        src: { n: 'MDN · CSS 过渡', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'web-tab',
      cat: 'web-compat',
      title: '原生 JS 选项卡（事件委托版）',
      desc: '一份逻辑支持多个选项卡容器，新增的 Tab 不用改代码。',
      tags: ['选项卡', '委托', '实战'],
      device: 'IE9+ / 现代浏览器',
      level: '进阶',
      code: `<div class="tabs" data-tabs>
  <div class="tab-nav">
    <a href="javascript:;" class="on">全部</a>
    <a href="javascript:;">待付款</a>
    <a href="javascript:;">已完成</a>
  </div>
  <div class="tab-pane">全部内容</div>
  <div class="tab-pane" style="display:none">待付款内容</div>
  <div class="tab-pane" style="display:none">已完成内容</div>
</div>

// 一个函数搞定页面上所有 [data-tabs]
(function () {
  var wraps = document.querySelectorAll('[data-tabs]');

  for (var k = 0; k < wraps.length; k++) {
    (function (wrap) {
      var nav = wrap.querySelector('.tab-nav');
      var panes = wrap.querySelectorAll('.tab-pane');

      nav.addEventListener('click', function (e) {
        var t = e.target;
        if (t.tagName !== 'A') return;                 // 只认 a
        var links = nav.getElementsByTagName('a');
        for (var i = 0; i < links.length; i++) {
          if (links[i] === t) {
            for (var j = 0; j < links.length; j++) links[j].className = '';
            t.className = 'on';
            for (var p = 0; p < panes.length; p++) panes[p].style.display = 'none';
            panes[i].style.display = 'block';
            break;
          }
        }
      }, false);
    })(wraps[k]);
  }
})();`,
      vars: {},
      docs: {
        secs: [
          { h: '为什么用 data 属性而不是写死 class', p: '[data-tabs] 是个标记，页面上有多少个容器就自动初始化多少个。写死 #tabs1、#tabs2 就得复制代码，加一个改一次。' },
          { h: 'javascript:; 是什么写法', p: '防止 a 标签跳转或提交，老项目里非常常见。现代写法是 href="#" 加 preventDefault，或者直接用 button。' },
          { h: '内容多时别用 display 切换', p: '几十个 Tab 全渲染再隐藏，首屏很重。改成点击时异步加载内容，或者用 iframe（老后台系统常见做法）。' }
        ],
        src: { n: 'MDN · addEventListener', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'web-lazyload',
      cat: 'web-compat',
      title: '图片懒加载：滚动到可视区再加载',
      desc: '长列表首屏只加载几张图，用 data-src 占位 + 滚动检测替换。',
      tags: ['懒加载', '性能', '滚动'],
      device: 'IE8+（IntersectionObserver 需 IE11+）',
      level: '进阶',
      code: `<img class="lazy" src="img/placeholder.png" data-src="img/real-1.jpg" alt="">
<img class="lazy" src="img/placeholder.png" data-src="img/real-2.jpg" alt="">

// ---------- 方案一：scroll 检测（兼容一切） ----------
(function () {
  var imgs = [].slice.call(document.querySelectorAll('img.lazy'));
  var ticking = false;

  function inView(el) {
    var r = el.getBoundingClientRect();
    var h = window.innerHeight || document.documentElement.clientHeight;
    return r.top < h + {{offset}};          // 提前一点加载，避免看到空白
  }

  function check() {
    for (var i = imgs.length - 1; i >= 0; i--) {
      if (inView(imgs[i])) {
        imgs[i].src = imgs[i].getAttribute('data-src');
        imgs[i].className = '';              // 移除 lazy，避免重复处理
        imgs.splice(i, 1);
      }
    }
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;                     // 节流：一帧只算一次
    ticking = true;
    setTimeout(check, 50);
  }

  window.addEventListener('scroll', onScroll, false);
  window.addEventListener('resize', onScroll, false);
  check();
})();

// ---------- 方案二：IntersectionObserver（更省 CPU） ----------
var io = new IntersectionObserver(function (entries) {
  entries.forEach(function (en) {
    if (!en.isIntersecting) return;
    var img = en.target;
    img.src = img.getAttribute('data-src');
    io.unobserve(img);
  });
}, { rootMargin: '{{offset}}px' });
[].forEach.call(document.querySelectorAll('img.lazy'), function (i) { io.observe(i); });`,
      vars: {
        offset: { label: '提前量（px）', value: '200', type: 'int', min: 0, max: 1000, hint: '100–300', desc: '提前多少距离开始加载。太小会看到白块，太大会失去懒加载的意义。' }
      },
      docs: {
        secs: [
          { h: '懒加载最容易踩的坑', ul: [
            '图片没有固定尺寸，加载前后高度跳变导致页面抖动 —— 给宽高或 padding-top 占位',
            'SEO 和打印时图片全空 —— 首屏关键图不要懒加载',
            'scroll 里每次都 getBoundingClientRect，几百张图会卡 —— 加节流或换 IntersectionObserver'
          ] },
          { h: '为什么还要用占位图', p: 'src 是空的会出破图图标，而且浏览器可能把空 src 当成当前页面再请求一次。给一张 1px 或小灰图占位最稳。' },
          { h: '移动端要监听 touchmove 吗', p: '不需要，scroll 事件在移动端同样触发（iOS 在惯性滚动中会延迟），只是要加 passive: true 提升滚动流畅度。' }
        ],
        src: { n: 'MDN · IntersectionObserver', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/IntersectionObserver' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'web-layout-bugs',
      cat: 'web-compat',
      title: '布局疑难清单：高度塌陷、1px 缝隙、margin 合并',
      desc: '六个高频「明明写对了却不对」的现象，照单排查。',
      tags: ['布局', 'bug', '排查'],
      device: '全浏览器',
      level: '进阶',
      code: `/* ① 父元素高度塌陷（子元素全浮动） */
.wrap::after { content: ""; display: block; clear: both; }

/* ② inline-block 之间莫名有缝隙（HTML 换行被当成空格） */
/* 修法一：父元素 font-size: 0，子元素再设回来 */
.list { font-size: 0; }
.list li { display: inline-block; font-size: 14px; }
/* 修法二：父元素 letter-spacing: -3px；子元素 letter-spacing: normal */
/* 修法三：HTML 里标签紧贴写（难维护，不推荐） */

/* ③ 上下 margin 合并 */
.a { margin-bottom: 20px; }
.b { margin-top: 30px; }        /* 实际间距是 30，不是 50 */
/* 修法：只给一个方向设 margin，或父元素加 overflow: hidden */

/* ④ 图片底部多出 3–4px 空白（行内元素的基线间隙） */
img { display: block; }         /* 或 vertical-align: top */

/* ⑤ 百分比 padding 按宽度算（不是高度） */
.box { width: 200px; padding-top: 50%; }   /* padding-top = 100px */

/* ⑥ 绝对定位居中偏 1px / 边框双倍 */
/* 用 inset: 0 + margin: auto 代替 top/left 50% + 负 margin */

/* ⑦ 文字超长不换行把表格撑破 */
td { word-break: break-all; word-wrap: break-word; }

/* ⑧ 两栏等高（float 做不到） */
/* 老办法：父元素 overflow: hidden + 子元素 padding-bottom: 9999px; margin-bottom: -9999px */
/* 新办法：display: flex; align-items: stretch; */`,
      vars: {},
      docs: {
        secs: [
          { h: '排查顺序建议', ul: [
            '先看元素的实际盒模型（F12 的 computed 里看 width/height 实际值）',
            '再看是不是浮动没清、是不是脱流了',
            '最后怀疑行内元素的基线与空白字符'
          ] },
          { h: '为什么 margin 会合并', p: '这是 CSS 规范行为：相邻的垂直外边距取较大值。它不是 bug，但在做精确间距时非常烦人，所以现代布局更推荐用 flex 的 gap。' },
          { h: '1px 问题', p: '在高倍屏上 1px 边框显示成 2 物理像素，看起来偏粗；某些缩放比例下又完全消失。要么接受，要么用 transform scaleY(.5) 的伪元素。' }
        ],
        src: { n: 'MDN · CSS 外边距合并', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Box_Model/Mastering_margin_collapsing' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'web-iframe-upload',
      cat: 'web-compat',
      title: 'iframe 无刷新上传（老浏览器方案）',
      desc: 'IE9 及以下不支持 FormData 上传，用隐藏 iframe 接响应是当年的标准做法。',
      tags: ['上传', 'iframe', '兼容'],
      device: 'IE6–IE9 / 现代浏览器（用 FormData 即可）',
      level: '综合',
      code: `<!-- 表单 target 指向隐藏 iframe，提交后响应进 iframe，页面不跳 -->
<form id="upForm" action="/upload" method="post"
      enctype="multipart/form-data" target="upFrame">
  <input type="file" name="file">
  <button type="submit">上传</button>
</form>
<iframe name="upFrame" id="upFrame" style="display:none"></iframe>

document.getElementById('upFrame').onload = function () {
  var doc = this.contentDocument || this.contentWindow.document;
  var text = doc.body ? doc.body.innerHTML : '';
  if (!text) return;                       // 首次加载是空，忽略
  try {
    var res = JSON.parse(text);
    if (res.ok) alert('上传成功：' + res.name);
    else alert('上传失败');
  } catch (e) {
    alert('服务端返回的不是 JSON：' + text.slice(0, 100));
  }
};

// ---------- 现代浏览器：FormData + XHR，能显示进度 ----------
var fd = new FormData();
fd.append('file', fileInput.files[0]);
var xhr = new XMLHttpRequest();
xhr.upload.onprogress = function (e) {
  if (e.lengthComputable) {
    var pct = Math.round(e.loaded / e.total * 100);
    bar.style.width = pct + '%';
  }
};
xhr.open('POST', '/upload');
xhr.send(fd);

// ---------- iframe 方案没有进度条 ----------
// 想看进度只能服务端分段接收 + 轮询，或者换现代方案`,
      vars: {},
      docs: {
        secs: [
          { h: '为什么 onload 会触发两次', p: 'iframe 刚开始加载 about:blank 就会触发一次 onload，此时 body 是空的。所以要判断内容为空就 return，否则第一次就解析失败了。' },
          { h: '服务端要返回什么', p: '返回一段 HTML 里的 <pre>{"ok":true}</pre> 最保险，因为老 IE 会把 JSON 当文件下载。很多老项目就是返回 text/html 包一层 pre。' },
          { h: '什么时候可以不用 iframe', p: '只要不需要支持 IE9 及以下，一律用 FormData + XHR/fetch，能带进度、能跨域（配 CORS）、代码也短。iframe 方案只在维护老系统时才有意义。' }
        ],
        src: { n: 'MDN · FormData', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/FormData' }
      }
    },

    /* ---------------- 6 ---------------- */
    {
      id: 'web-print',
      cat: 'web-compat',
      title: '打印样式：把网页印成能看的纸',
      desc: '隐藏导航和按钮、去掉背景色、处理分页与链接地址。',
      tags: ['打印', '@media print', '兼容'],
      device: '全浏览器',
      level: '进阶',
      code: `/* 方式一：单独的 print.css，页面里 link 加 media="print" */
<link rel="stylesheet" href="css/print.css" media="print">

/* 方式二：写在主样式里 */
@media print {
  /* ① 隐藏不该出现在纸上的东西 */
  .nav, .footer, .btn, .pager, .no-print { display: none !important; }

  /* ② 去掉背景色和阴影（打印机会当成大片墨块） */
  body { background: #fff !important; color: #000; }
  .card { box-shadow: none; border: 1px solid #ccc; }

  /* ③ 打印用衬线字体更清楚，字号建议 12pt */
  body { font: 12pt/1.6 "SimSun", serif; }

  /* ④ 分页控制 */
  h1, h2 { page-break-after: avoid; }      /* 标题后不换页 */
  table, img { page-break-inside: avoid; } /* 表格/图片不跨页断开 */
  .page-break { page-break-before: always; }

  /* ⑤ 链接补上地址，纸上才点得到 */
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 10pt; color: #555; }

  /* ⑥ 强制显示被折叠的内容 */
  .collapse { display: block !important; height: auto !important; }

  /* ⑦ 表格线要实心细线，屏幕上的浅灰印不出来 */
  table { border-collapse: collapse; }
  td, th { border: 1px solid #333 !important; }
}`,
      vars: {},
      docs: {
        secs: [
          { h: '打印预览和屏幕差很多怎么办', p: '先在浏览器打印预览里调，不要盲改代码。常见差异：背景图不打印（浏览器默认关）、颜色变淡（用 -webkit-print-color-adjust: exact）、分页位置不对。' },
          { h: '宽度要用 mm / cm', p: 'A4 宽 210mm，左右各留 10mm 边距，内容区约 190mm。用 px 在缩放比例下会错位，用 mm 单位最稳。' },
          { h: '什么时候直接用 PDF', p: '票据、合同这类对版式要求高的，别用网页打印，服务端生成 PDF 更可靠。网页打印只适合内容和版式都比较宽松的场景。' }
        ],
        src: { n: 'MDN · 打印样式', u: 'https://developer.mozilla.org/zh-CN/docs/Web/CSS/@media' }
      }
    }
  );

  W.kw = W.kw.concat([
    'carousel', 'lazy', 'print', 'page-break', 'iframe', 'FormData',
    'IntersectionObserver', 'getBoundingClientRect', 'serializeArray'
  ]);
})(window.__WEB);
