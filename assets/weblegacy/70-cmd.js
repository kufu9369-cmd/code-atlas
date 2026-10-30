/* ============================================================
   码典 · Web 前端（旧版）命令 / API 词条
   ------------------------------------------------------------
   搜 "document get" 和 "getElementById" 都会命中同一条。
   ============================================================ */
(function (W) {
  'use strict';

  var C = W.cmd;

  /* ---------------- DOM ---------------- */
  C['document.getElementById'] = { p: '按 id 取单个元素，最快也最稳。id 重复时只返回第一个，页面上千万别出现重复 id。', eg: 'var box = document.getElementById("box");' };
  C['document.querySelector'] = { p: 'CSS 选择器取第一个匹配元素，IE8+。选择器写错会返回 null，不会报错 — 后续操作才炸。', eg: 'var one = document.querySelector("#box .item");' };
  C['document.querySelectorAll'] = { p: '取所有匹配元素，返回静态 NodeList（不会随 DOM 变化）。IE8 只支持 CSS2 选择器。', eg: 'var all = document.querySelectorAll("ul li.on");' };
  C['document.createElement'] = { p: '创建元素节点，还没插入文档。创建后要 appendChild / insertBefore 才显示。', eg: 'var li = document.createElement("li");' };
  C['appendChild'] = { p: '把节点插到父元素末尾。如果要插到指定位置，用 insertBefore。', eg: 'ul.appendChild(li);' };
  C['removeChild'] = { p: '删除子节点，必须通过父节点调用。现代浏览器有 el.remove()，老 IE 没有。', eg: 'li.parentNode.removeChild(li);' };
  C['element.innerHTML'] = { p: '读写元素内的 HTML，会解析标签。塞用户输入就是 XSS 入口，拼模板时才用。', eg: 'box.innerHTML = "<b>标题</b>";' };
  C['element.textContent'] = { p: '纯文本读写，自动转义，安全。IE8 用 innerText。', eg: 'box.textContent = userInput;' };
  C['element.classList'] = { p: '类名操作集合，有 add / remove / toggle / contains。IE10+ 才支持，IE9 及以下用 className 字符串拼。', eg: 'box.classList.toggle("on");' };
  C['getBoundingClientRect'] = { p: '拿元素相对视口的位置和尺寸，做滚动加载、拖拽、弹层定位都靠它。会触发重排，别在滚动里高频调用。', eg: 'var r = el.getBoundingClientRect(); if (r.top < innerHeight) load();' };
  C['offsetWidth'] = { p: '元素占位宽度：内容 + padding + border，不含 margin。取整数值，小数会被四舍五入。', eg: 'var w = el.offsetWidth;' };
  C['scrollTop'] = { p: '滚动条已滚动的距离，读写都行。回到顶部就是把它设为 0。', eg: 'document.documentElement.scrollTop = 0;' };

  /* ---------------- 事件 ---------------- */
  C['element.addEventListener'] = { p: '标准事件绑定，可绑多个。第三个参数 true 表示捕获阶段，false（默认）是冒泡。IE8 不支持，要用 attachEvent。', eg: 'el.addEventListener("click", fn, false);' };
  C['attachEvent'] = { p: 'IE8 及以下的事件绑定，事件名要带 on，this 指向 window，事件对象在 window.event。', eg: 'el.attachEvent("onclick", fn);' };
  C['removeEventListener'] = { p: '解绑事件，必须传同一个函数引用。用匿名函数绑定的解不掉。', eg: 'el.removeEventListener("click", fn, false);' };
  C['event.target'] = { p: '真正触发事件的元素（可能是子元素）。IE8 用 srcElement。事件委托全靠它。', eg: 'var t = e.target || e.srcElement;' };
  C['event.stopPropagation'] = { p: '阻止冒泡到父元素。IE 用 e.cancelBubble = true。滥用会让上层委托全部失效。', eg: 'e.stopPropagation();' };
  C['event.preventDefault'] = { p: '阻止默认行为（链接跳转、表单提交）。IE 用 e.returnValue = false。不能阻止冒泡。', eg: 'e.preventDefault();' };
  C['window.onload'] = { p: '等所有资源（图片、样式）加载完才执行，很慢。要尽早操作 DOM 用 DOMContentLoaded。', eg: 'window.onload = function () { init(); };' };
  C['DOMContentLoaded'] = { p: 'DOM 解析完就触发，不等图片。jQuery 的 $(document).ready 就是它。', eg: 'document.addEventListener("DOMContentLoaded", init, false);' };

  /* ---------------- 定时器 ---------------- */
  C['setTimeout'] = { p: '延迟执行一次，返回定时器 id。JS 单线程，到点只是排队，前面有长任务会推迟。', eg: 'var t = setTimeout(fn, 300);' };
  C['setInterval'] = { p: '按间隔重复执行。页面切后台会被降频，恢复后可能补执行多次，需要精确计时的场景改用递归 setTimeout。', eg: 'var it = setInterval(tick, 1000);' };
  C['clearInterval'] = { p: '清除 setInterval。离开页面或组件销毁时不清，回调会操作已删除的 DOM 并占内存。', eg: 'clearInterval(it);' };

  /* ---------------- Ajax ---------------- */
  C['XMLHttpRequest'] = { p: '原生 Ajax 核心对象。IE5/6 用 ActiveXObject("Microsoft.XMLHTTP")。', eg: 'var xhr = new XMLHttpRequest();' };
  C['xhr.open'] = { p: '初始化请求，第三个参数 true 表示异步（别写 false，会锁死界面）。', eg: 'xhr.open("POST", "/user?action=save", true);' };
  C['xhr.send'] = { p: '发送请求。GET 传 null，POST 传参数字符串或 FormData。', eg: 'xhr.send("mobile=13800138000");' };
  C['xhr.readyState'] = { p: '请求状态：0 未初始化、1 已 open、2 收到响应头、3 接收中、4 完成。只有 4 才能读 status。', eg: 'if (xhr.readyState === 4 && xhr.status === 200) { }' };
  C['xhr.setRequestHeader'] = { p: '设置请求头。POST 表单要设 Content-Type，传 JSON 设 application/json，跨域带 Cookie 需要 withCredentials。', eg: 'xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");' };

  /* ---------------- 数据 ---------------- */
  C['JSON.parse'] = { p: '把 JSON 字符串转成对象，比 eval 安全。报 Unexpected token < 说明返回的是 HTML 错误页。', eg: 'var obj = JSON.parse(str);' };
  C['JSON.stringify'] = { p: '对象转 JSON 字符串。Date 会变成字符串、undefined 和函数会丢，不能当深拷贝用。', eg: 'var s = JSON.stringify({ a: 1 });' };
  C['localStorage'] = { p: '同源永久存储，约 5MB，只能存字符串。对象要 JSON.stringify。无痕模式或超限会抛 QuotaExceededError。', eg: 'localStorage.setItem("user", JSON.stringify(u));' };
  C['sessionStorage'] = { p: '同源、同标签页的临时存储，关掉标签页就清空。适合多步表单。', eg: 'sessionStorage.setItem("step", "2");' };
  C['document.cookie'] = { p: '读写 Cookie 的字符串接口，格式是 name=value;expires=...;path=/。值必须 encodeURIComponent。', eg: 'document.cookie = "token=" + encodeURIComponent(v) + ";path=/";' };

  /* ---------------- JS 语言 ---------------- */
  C['Array.prototype.forEach'] = { p: '数组遍历，不能 break（要中断用 for 或 some/every）。类数组要用 [].forEach.call 或先转数组。', eg: 'list.forEach(function (item, i) { });' };
  C['Function.prototype.call'] = { p: '改变 this 并立即执行，参数逐个传。继承里常写 Parent.call(this, x)。', eg: 'fn.call(obj, 1, 2);' };
  C['Function.prototype.apply'] = { p: '和 call 一样，但参数用数组传。最适合把数组展开成参数列表。', eg: 'fn.apply(obj, [1, 2]);' };
  C['Function.prototype.bind'] = { p: '固定 this 返回新函数，不立即执行。绑定后 call/apply 也改不回来。', eg: 'var bound = fn.bind(obj);' };
  C['Object.create'] = { p: '创建指定原型的对象，做继承比 new Parent() 干净。IE8 及以下没有，要用中转函数模拟。', eg: 'Student.prototype = Object.create(Person.prototype);' };

  /* ---------------- jQuery ---------------- */
  C['$(document).ready'] = { p: 'DOM 就绪就执行，比 window.onload 早，且可以写多个。简写就是 $(function(){})。', eg: '$(function () { init(); });' };
  C['$.ajax'] = { p: 'jQuery 的 Ajax 主方法。type 是请求方法，dataType 是期望响应类型，不写会按响应头猜。', eg: '$.ajax({ url: "/user", type: "POST", data: { id: 1 }, success: function (res) {} });' };
  C['$.ajaxSetup'] = { p: '全局 Ajax 默认配置，用来统一超时、请求头、loading 和错误提示，避免每个请求都写一遍。', eg: '$.ajaxSetup({ timeout: 15000, dataType: "json" });' };
  C['$.get'] = { p: 'GET 请求的简写，参数拼在 URL 上。有缓存问题，加时间戳或用 $.ajax 设 cache:false。', eg: '$.get("/user?action=list", function (res) { });' };
  C['$.post'] = { p: 'POST 请求的简写，默认 Content-Type 是 application/x-www-form-urlencoded。', eg: '$.post("/user", { action: "del", id: 12 }, function (res) { });' };
  C['$.extend'] = { p: '合并对象。第一个参数传 true 是深拷贝；写插件时用它合并默认参数，别直接改默认对象。', eg: 'var opts = $.extend({}, DEFAULTS, options);' };
  C['$.fn'] = { p: 'jQuery 原型，往上面挂方法就是插件。方法里要 return this.each(...) 才支持链式调用和多实例。', eg: '$.fn.tabs = function (opt) { return this.each(function () { }); };' };
  C['jQuery.on'] = { p: '统一的绑定入口。第四个参数传选择器就是事件委托，动态元素也能响应。', eg: '$("#list").on("click", "li", function () { });' };
  C['jQuery.delegate'] = { p: '1.7 之前的事件委托写法，现在等价于 on(事件, 选择器, 函数)，新代码统一用 on。', eg: '$("#list").delegate("li", "click", fn);' };
  C['jQuery.attr'] = { p: '读写 HTML 属性。布尔属性（checked、disabled）要用 prop，用 attr 取值会有历史兼容问题。', eg: '$("img").attr("src", "/img/a.png");' };
  C['jQuery.prop'] = { p: '读写 DOM 属性，checked / disabled / selected 必须用它。', eg: '$("input").prop("checked", true);' };
  C['jQuery.serialize'] = { p: '把表单序列化成 a=1&b=2 字符串，直接当 Ajax 的 data。空字段也会带上。', eg: 'var data = $("#form").serialize();' };

  /* ---------------- CSS ---------------- */
  C['box-sizing'] = { p: '设成 border-box 后 width 包含 padding 和 border，尺寸按直觉算，全站统一加最省心。', eg: '*, *::before, *::after { box-sizing: border-box; }' };
  C['position: relative'] = { p: '相对自身原位偏移，同时创建定位参照。父相子绝里的「父相」就是它。', eg: '.card { position: relative; }' };
  C['position: absolute'] = { p: '相对最近的非 static 祖先定位，脱离文档流。找不到定位祖先就跑到页面左上角。', eg: '.badge { position: absolute; top: 0; right: 0; }' };
  C['z-index'] = { p: '层叠顺序，只在同一层叠上下文内比较。父元素有 position+z-index / transform / opacity<1 会新建上下文，子元素再大也压不出去。', eg: '.modal { z-index: 1000; }' };
  C['display: flex'] = { p: '弹性布局，IE10 需 -ms- 前缀，IE9 及以下不支持。居中、等分、等高一次解决。', eg: '.wrap { display: flex; align-items: center; justify-content: center; }' };
  C['@media'] = { p: '媒体查询，按屏宽/分辨率切换样式。IE8 不支持（需 respond.js），移动端适配的基础。', eg: '@media screen and (max-width: 768px) { .col { width: 100%; } }' };

  W.cmdSrc.web = [
    'document.getElementById', 'document.querySelector', 'document.querySelectorAll',
    'document.createElement', 'appendChild', 'removeChild', 'element.innerHTML',
    'element.textContent', 'element.classList', 'getBoundingClientRect',
    'offsetWidth', 'scrollTop',
    'element.addEventListener', 'attachEvent', 'removeEventListener', 'event.target',
    'event.stopPropagation', 'event.preventDefault', 'window.onload', 'DOMContentLoaded',
    'setTimeout', 'setInterval', 'clearInterval',
    'XMLHttpRequest', 'xhr.open', 'xhr.send', 'xhr.readyState', 'xhr.setRequestHeader',
    'JSON.parse', 'JSON.stringify', 'localStorage', 'sessionStorage', 'document.cookie',
    'Array.prototype.forEach', 'Function.prototype.call', 'Function.prototype.apply',
    'Function.prototype.bind', 'Object.create',
    '$(document).ready', '$.ajax', '$.ajaxSetup', '$.get', '$.post', '$.extend', '$.fn',
    'jQuery.on', 'jQuery.delegate', 'jQuery.attr', 'jQuery.prop', 'jQuery.serialize',
    'box-sizing', 'position: relative', 'position: absolute', 'z-index',
    'display: flex', '@media'
  ];
})(window.__WEB);
