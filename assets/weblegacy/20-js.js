/* ============================================================
   码典 · Web 前端（旧版）· JavaScript（9 条）
   ============================================================ */
(function (W) {
  'use strict';

  W.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'web-dom',
      cat: 'web-js',
      title: 'DOM 查询与增删改',
      desc: 'getElementById / querySelectorAll 的选择，以及创建、插入、删除节点的标准写法。',
      tags: ['DOM', '选择器', '入门'],
      device: 'IE8+ / 现代浏览器',
      level: '入门',
      code: `// ---------- 查询 ----------
var box  = document.getElementById('box');               // 最快，单个
var list = document.getElementsByClassName('item');      // 动态集合，会随 DOM 变
var tags = document.getElementsByTagName('li');
var one  = document.querySelector('#box .item');         // IE8+，第一个
var all  = document.querySelectorAll('#box .item');      // 静态集合，推荐

// 动态集合会「边遍历边变」，删除节点时最容易出错
for (var i = list.length - 1; i >= 0; i--) list[i].parentNode.removeChild(list[i]);

// ---------- 创建与插入 ----------
var li = document.createElement('li');
li.className = 'item';
li.setAttribute('data-id', '{{dataId}}');
li.innerHTML = '<span class="t">标题</span>';            // 有 XSS 风险，别塞用户输入
li.textContent = '纯文本更安全';                          // IE9+，IE8 用 innerText

var ul = document.querySelector('.list');
ul.appendChild(li);                    // 加到末尾
ul.insertBefore(li, ul.firstChild);    // 插到最前
ul.removeChild(li);                    // 删除（老写法）
li.parentNode && li.parentNode.removeChild(li);

// ---------- 样式与类名 ----------
li.style.color = '#f60';
li.classList.add('on');                // IE10+
li.classList.remove('on');
li.classList.toggle('on');
// IE9 及以下没有 classList，用字符串替换
li.className = (' ' + li.className + ' ').replace(' on ', ' ').replace(/^\\s+|\\s+$/g, '');`,
      vars: {
        dataId: { label: '数据 id', value: '1001', hint: '数字或字符串', desc: '自定义属性统一用 data- 前缀，IE8+ 可用 getAttribute 读。' }
      },
      docs: {
        secs: [
          { h: 'innerHTML 和 textContent 怎么选', p: '内容含用户输入一律用 textContent，innerHTML 会解析 HTML，一段 <img onerror> 就能执行脚本。只有拼固定模板时才用 innerHTML。' },
          { h: '动态集合 vs 静态集合', p: 'getElementsByClassName 返回的是实时的，DOM 一变长度就变；querySelectorAll 是快照。遍历删除时用倒序循环，或者先转成数组。' },
          { h: '性能上要注意什么', p: '循环里反复查 DOM 和改样式会触发多次重排。做法是先查好缓存成变量，改完再一次插入（DocumentFragment 或先拼字符串最后一次 innerHTML）。' }
        ],
        src: { n: 'MDN · Document 接口', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Document' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'web-event',
      cat: 'web-js',
      title: '事件绑定：addEventListener 与 attachEvent',
      desc: '一套兼容写法同时兼容现代浏览器和 IE8，顺带处理 this 指向。',
      tags: ['事件', '兼容', '绑定'],
      device: 'IE6+ / 现代浏览器',
      level: '入门',
      code: `// ---------- 现代浏览器 ----------
el.addEventListener('click', handler, false);      // 第三个参数 true 是捕获阶段

// ---------- IE8 及以下 ----------
el.attachEvent('onclick', handler);                 // 注意要带 on

// ---------- 兼容封装 ----------
function on(el, type, fn) {
  if (el.addEventListener) {
    el.addEventListener(type, fn, false);
  } else if (el.attachEvent) {
    el.attachEvent('on' + type, function () {
      fn.call(el, window.event);      // IE 里 this 是 window，事件对象在 window.event
    });
  } else {
    el['on' + type] = fn;             // 最后的兜底，会覆盖已有绑定
  }
}

function off(el, type, fn) {
  if (el.removeEventListener) el.removeEventListener(type, fn, false);
  else if (el.detachEvent) el.detachEvent('on' + type, fn);
}

// ---------- 页面加载完再执行 ----------
document.addEventListener('DOMContentLoaded', init, false);   // 不等等图片
window.onload = init;                                          // 等所有资源，慢
// jQuery 的 ready 对应 DOMContentLoaded，比 onload 早很多`,
      vars: {},
      docs: {
        secs: [
          { h: '为什么绑定没生效', ul: [
            '脚本写在 head 里，元素还没解析出来 —— 放到 body 末尾或包进 DOMContentLoaded',
            'IE8 用 addEventListener 直接报错「对象不支持此属性或方法」',
            '给一组元素绑定时用了 getElementById，只有一个元素被绑上'
          ] },
          { h: 'this 为什么不是按钮', p: 'IE 的 attachEvent 里 this 是 window。想拿到触发元素用事件对象的 target / srcElement，或者像上面那样用 fn.call(el) 强制改指向。' },
          { h: 'onclick 和 addEventListener 的区别', p: 'onclick 只能绑一个，后绑的覆盖前面的；addEventListener 可以绑多个，按顺序执行。老代码里 onclick 满天飞时，改造成本要提前评估。' }
        ],
        src: { n: 'MDN · EventTarget.addEventListener', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'web-bubble',
      cat: 'web-js',
      title: '冒泡、捕获与事件委托',
      desc: '给父容器绑一次事件处理所有子元素，动态新增的节点自动生效。',
      tags: ['冒泡', '事件委托', '性能'],
      device: 'IE9+（委托用 target/srcElement 兼容 IE8）',
      level: '进阶',
      code: `// ---------- 阻止冒泡 / 阻止默认行为 ----------
function stop(e) {
  if (e.stopPropagation) e.stopPropagation();     // 标准
  else e.cancelBubble = true;                     // IE
}
function prevent(e) {
  if (e.preventDefault) e.preventDefault();
  else e.returnValue = false;                     // IE
}
// 一行都写：return false 只在 jQuery / 内联 onclick 里同时管两件事，
// 原生 addEventListener 里 return false 什么也不做

// ---------- 事件委托 ----------
var ul = document.getElementById('{{listId}}');
ul.addEventListener('click', function (e) {
  var t = e.target || e.srcElement;
  // 从点击目标往上找，直到找到 li 或回到 ul
  while (t && t !== ul && t.nodeName.toLowerCase() !== 'li') {
    t = t.parentNode;
  }
  if (!t || t === ul) return;

  var id = t.getAttribute('data-id');
  console.log('点击了第 ' + id + ' 项');
}, false);

// 好处：之后 appendChild 新增的 li 不用再绑一次事件`,
      vars: {
        listId: { label: '列表容器 id', value: 'list', hint: '不用带 #', desc: '委托绑在稳定的父容器上，别绑在会被替换的元素上。' }
      },
      docs: {
        secs: [
          { h: '为什么用委托', p: '1000 个 li 绑 1000 个事件，内存和初始化时间都很高；而且动态渲染的节点必须重新绑定，很容易漏。委托只在父级绑一次，逻辑集中。' },
          { h: 'target 和 currentTarget', p: 'target 是真正点到的元素（可能是 li 里的 span），currentTarget 是绑事件的元素。委托里必须从 target 往上找，直接用 target 会在点到子元素时失效。' },
          { h: '哪些事件不能委托', p: 'focus、blur 不冒泡（要用 focusin/focusout），mouseenter/mouseleave 也不冒泡。另外阻止冒泡要谨慎，容易把上层的委托一起干掉。' }
        ],
        src: { n: 'MDN · 事件冒泡与捕获', u: 'https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Building_blocks/Events' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'web-timer',
      cat: 'web-js',
      title: '定时器、防抖与节流',
      desc: 'setInterval 会堆积、scroll 会狂触发，两种封装解决高频执行。',
      tags: ['定时器', '防抖', '节流'],
      device: 'IE8+ / 现代浏览器',
      level: '进阶',
      code: `// ---------- 基础 ----------
var t = setTimeout(function () { /* 延迟执行一次 */ }, {{delay}});
clearTimeout(t);

var it = setInterval(function () { /* 每隔一段时间执行 */ }, 1000);
clearInterval(it);          // 离开页面/组件销毁时一定要清，否则内存泄漏

// ---------- 防抖：停下来才执行（搜索框输入、窗口 resize） ----------
function debounce(fn, wait) {
  var timer = null;
  return function () {
    var ctx = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}
input.addEventListener('input', debounce(function (e) {
  search(e.target.value);
}, {{delay}}));

// ---------- 节流：固定频率执行（滚动加载、mousemove） ----------
function throttle(fn, gap) {
  var last = 0;
  return function () {
    var now = +new Date();
    if (now - last < gap) return;
    last = now;
    fn.apply(this, arguments);
  };
}
window.addEventListener('scroll', throttle(onScroll, 200));

// ---------- 定时器不准？ ----------
// JS 单线程，定时器只是「到点排队」，前面有长任务就会被推迟。
// 需要精确计时用时间戳自己算差值，而不是相信回调次数。`,
      vars: {
        delay: { label: '延迟 / 间隔', value: '300', type: 'int', min: 16, max: 5000, hint: '毫秒', desc: '输入防抖 200–400ms 最舒服；滚动节流 100–200ms；小于 16ms 没意义（一帧就是 16.7ms）。' }
      },
      docs: {
        secs: [
          { h: '防抖和节流的区别', p: '防抖是"等你不动了再做一次"（适合搜索联想）；节流是"不管多频繁，每 N 毫秒最多做一次"（适合滚动监听）。用错场景要么感觉卡，要么感觉没反应。' },
          { h: '定时器为什么会越走越快', p: 'setInterval 在页面被切到后台时会被浏览器降频，恢复后可能连着补执行几次。用 setTimeout 递归调用能避免堆积。' },
          { h: '离开页面要清定时器', p: '单页应用里组件销毁但定时器还在，回调里操作已删除的 DOM，会报 Cannot read property of null，也占内存。' }
        ],
        src: { n: 'MDN · Window.setTimeout', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Window/setTimeout' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'web-regex-form',
      cat: 'web-js',
      title: '表单校验与常用正则',
      desc: '手机号、邮箱、身份证、密码强度一次备齐，前端校验只为体验，后端必须再查。',
      tags: ['正则', '表单校验', '常用'],
      device: 'IE8+ / 现代浏览器',
      level: '进阶',
      code: `var RULE = {
  mobile: /^1[3-9]\\d{9}$/,
  email: /^[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+$/,
  idcard: /^[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]$/,
  password: /^(?=.*[A-Za-z])(?=.*\\d)[\\w!@#$%^&*]{8,20}$/,   // 字母+数字，8–20 位
  url: /^(https?:\\/\\/)?([\\w-]+\\.)+[\\w-]+(\\/[\\w-./?%&=]*)?$/,
  chinese: /^[\\u4e00-\\u9fa5]+$/
};

function check(form) {
  var errs = [];
  var phone = form.mobile.value.trim();
  if (!phone) errs.push('手机号不能为空');
  else if (!RULE.mobile.test(phone)) errs.push('手机号格式不正确');

  var pwd = form.password.value;
  if (!RULE.password.test(pwd)) errs.push('密码需 8–20 位，且包含字母和数字');
  if (pwd !== form.repassword.value) errs.push('两次输入的密码不一致');

  // 一次把所有错误显示出来，别让用户一条条试
  document.getElementById('err').innerHTML = errs.join('<br>');
  return errs.length === 0;
}

// 提交时校验 + 阻止默认提交
document.getElementById('{{formId}}').onsubmit = function () {
  return check(this);          // 返回 false 阻止提交
};

// 唯一性、验证码这类必须异步校验的，放在 blur 里 + 防抖`,
      vars: {
        formId: { label: '表单 id', value: 'regForm', hint: '不带 #', desc: '表单 id 要和 HTML 里一致，onsubmit 返回 false 才拦得住提交。' }
      },
      docs: {
        secs: [
          { h: '前端校验只是体验', p: 'F12 改一行、curl 直接发请求都能绕过。所有规则后端必须再实现一遍，前端负责提示友好，后端负责安全。' },
          { h: '正则里的坑', ul: [
            'test() 带 g 标志时 lastIndex 会累加，连续调用结果会跳 —— 校验用不带 g 的正则',
            '中文范围 \\u4e00-\\u9fa5 不含生僻字和 emoji，需要时用 \\u4e00-\\u9fff',
            '号码规则会变（比如 16x 号段），别写死在十几个地方，集中成一张表'
          ] },
          { h: '提示写在哪', p: '错误提示放在输入框旁边比弹 alert 好得多：不打断操作、能同时显示多条、用户改的时候还看得见。' }
        ],
        src: { n: 'MDN · 正则表达式', u: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_Expressions' }
      }
    },

    /* ---------------- 6 ---------------- */
    {
      id: 'web-xhr',
      cat: 'web-js',
      title: '原生 Ajax：XMLHttpRequest 完整流程',
      desc: '不依赖 jQuery 也要会写的四步，含 GET/POST、超时和错误处理。',
      tags: ['Ajax', 'XHR', '异步'],
      device: 'IE7+（IE5/6 用 ActiveXObject）',
      level: '进阶',
      code: `function ajax(opt) {
  var xhr = window.XMLHttpRequest
    ? new XMLHttpRequest()
    : new ActiveXObject('Microsoft.XMLHTTP');   // IE5/6

  var method = (opt.method || 'GET').toUpperCase();
  var url = opt.url;
  var data = opt.data || null;

  // GET 要把参数拼到地址上，并处理缓存
  if (method === 'GET' && data) {
    url += (url.indexOf('?') > -1 ? '&' : '?') + data;
    data = null;
  }
  xhr.open(method, url, true);

  if (method === 'POST') {
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  }
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');  // 后端据此判断是不是 Ajax

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;                 // 4 = 完成
    if (xhr.status >= 200 && xhr.status < 300) {
      var res = xhr.responseText;
      try { res = JSON.parse(res); } catch (e) { }    // 不是 JSON 就原样返回
      opt.success && opt.success(res);
    } else {
      opt.error && opt.error(xhr.status, xhr.statusText);
    }
  };

  xhr.timeout = {{timeout}};                                  // IE9+
  xhr.ontimeout = function () { opt.error && opt.error('timeout'); };

  xhr.send(data);
}

// 用法
ajax({
  url: '/user?action=list',
  method: 'GET',
  success: function (res) { render(res.data); },
  error: function (code) { alert('请求失败：' + code); }
});`,
      vars: {
        timeout: { label: '超时（毫秒）', value: '10000', type: 'int', min: 1000, max: 120000, hint: '10s', desc: '不设超时，后端卡死时前端会一直转圈，用户只能刷新。' }
      },
      docs: {
        secs: [
          { h: 'readyState 的五个值', ul: [
            '0 UNSENT：还没 open',
            '1 OPENED：已 open 未 send',
            '2 HEADERS_RECEIVED：收到响应头',
            '3 LOADING：正在接收响应体',
            '4 DONE：完成，这时候才读 status'
          ] },
          { h: '为什么 state 是 4 但 status 是 0', p: '跨域被拦、请求被中断、页面卸载都会出现 status 0。看到 0 先看控制台有没有 CORS 报错，别在南辕北辙地查接口。' },
          { h: 'GET 缓存导致数据不更新', p: 'IE 对 GET 缓存特别激进。加时间戳参数（_t=Date.now()）或设 Cache-Control: no-cache 才能拿到新数据。' }
        ],
        src: { n: 'MDN · XMLHttpRequest', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest' }
      }
    },

    /* ---------------- 7 ---------------- */
    {
      id: 'web-json',
      cat: 'web-js',
      title: 'JSON 解析与序列化（含老 IE 兜底）',
      desc: 'JSON.parse / stringify 的标准用法，以及 IE7 及以下的处理方式。',
      tags: ['JSON', '兼容', '数据'],
      device: 'IE8+（IE7 需 json2.js）',
      level: '入门',
      code: `// ---------- 解析 ----------
var obj = JSON.parse('{"name":"张三","age":18}');

// 字符串里的引号必须转义，单引号不是合法 JSON
// ✗ JSON.parse("{'name':'张三'}")   会抛 SyntaxError

// ---------- 序列化 ----------
var str = JSON.stringify({ name: '张三', age: 18 });
// 输出 {"name":"张三","age":18}

// 格式化输出（调试时好看）
JSON.stringify(obj, null, 2);

// 只要部分字段
JSON.stringify(obj, ['name']);            // 白名单
// 过滤掉 undefined / 函数
JSON.stringify(obj, function (k, v) {
  return typeof v === 'function' ? undefined : v;
});

// ---------- 老 IE（IE7 及以下）没有 JSON ----------
// 引入 json2.js 后会补上 JSON 对象；
// 或者用 eval 兜底（只在数据可信时用，等于执行任意代码）
function parseJSON(s) {
  if (window.JSON && window.JSON.parse) return JSON.parse(s);
  return eval('(' + s + ')');
}

// ---------- 深拷贝（简单数据） ----------
var copy = JSON.parse(JSON.stringify(source));
// 缺点：Date 变字符串、undefined 和函数丢失`,
      vars: {},
      docs: {
        secs: [
          { h: '为什么 JSON.parse 比 eval 安全', p: 'parse 只认 JSON 语法，遇到函数调用直接报错；eval 会执行字符串里的任何 JS。服务端返回内容被篡改时，eval 就是执行入口。' },
          { h: '常见报错怎么定位', p: 'SyntaxError: Unexpected token < 通常是接口返回了 HTML 错误页（比如 500 页面），不是 JSON 格式错。先看 Network 里的原始响应体。' },
          { h: '中文字符被转义了', p: '看到 \\u5f20\\u4e09 是正常现象，stringify 默认会转义非 ASCII。前端 parse 后自动还原。想不转义可以自己遍历替换。' }
        ],
        src: { n: 'MDN · JSON', u: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON' }
      }
    },

    /* ---------------- 8 ---------------- */
    {
      id: 'web-storage',
      cat: 'web-js',
      title: '本地存储：localStorage / sessionStorage / Cookie',
      desc: '三种存储的寿命、容量和用法，附一层统一的取值封装。',
      tags: ['localStorage', 'Cookie', '存储'],
      device: 'IE8+（localStorage）/ IE6+（Cookie）',
      level: '进阶',
      code: `// ---------- localStorage：永久，除非手动清 ----------
localStorage.setItem('theme', 'dark');
var theme = localStorage.getItem('theme');       // 没有返回 null
localStorage.removeItem('theme');
localStorage.clear();                           // 清空本站全部

// 存对象必须转字符串
localStorage.setItem('user', JSON.stringify({ id: 1, name: '张三' }));
var user = JSON.parse(localStorage.getItem('user') || '{}');

// ---------- sessionStorage：关掉标签页就没了 ----------
sessionStorage.setItem('step', '2');            // 适合多步表单

// ---------- Cookie：会随请求发给服务端 ----------
function setCookie(name, value, days) {
  var exp = new Date();
  exp.setTime(exp.getTime() + days * 24 * 3600 * 1000);
  document.cookie = name + '=' + encodeURIComponent(value)
    + ';expires=' + exp.toUTCString() + ';path=/';
}
function getCookie(name) {
  var m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[2]) : null;
}

// ---------- 私有模式 / 超限会抛异常 ----------
try {
  localStorage.setItem('k', 'v');
} catch (e) {
  // Safari 无痕模式、容量超限（一般 5MB）都会抛 QuotaExceededError
}`,
      vars: {},
      docs: {
        secs: [
          { h: '什么时候用哪个', ul: [
            'localStorage：主题、上次访问位置、离线草稿（同源永久共享）',
            'sessionStorage：多步表单、一次性状态（同标签页）',
            'Cookie：需要服务端读的东西（登录态、语言偏好），会白白占请求头'
          ] },
          { h: '三者的容量与作用域', p: 'localStorage / sessionStorage 各约 5MB、同源共享、不发给服务端；Cookie 单个约 4KB、同域共享、每次请求都带上。别把 1MB 的 JSON 塞 Cookie。' },
          { h: '存储的不是"安全区"', p: 'localStorage 里任何同源 JS 都能读，XSS 一旦成功就能把 token 取走。敏感数据只放 HttpOnly Cookie，或者干脆只存服务端会话。' }
        ],
        src: { n: 'MDN · Window.localStorage', u: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage' }
      }
    },

    /* ---------------- 9 ---------------- */
    {
      id: 'web-oop',
      cat: 'web-js',
      title: '原型继承、call/apply/bind 与闭包',
      desc: 'ES5 时代的面向对象三件套，看懂老代码绕不过去。',
      tags: ['原型', '继承', '闭包'],
      device: 'IE8+ / 现代浏览器',
      level: '综合',
      code: `// ---------- 构造函数 + 原型 ----------
function Person(name) {
  this.name = name;                 // 实例属性
}
Person.prototype.say = function () {  // 原型方法，所有实例共享
  return '我是 ' + this.name;
};

var p = new Person('张三');
p.say();

// ---------- 继承：原型链 + 构造函数 ----------
function Student(name, grade) {
  Person.call(this, name);          // ① 继承实例属性
  this.grade = grade;
}
Student.prototype = Object.create(Person.prototype);   // ② 继承原型方法（IE9+）
Student.prototype.constructor = Student;               // ③ 修正 constructor
Student.prototype.study = function () { return this.grade + ' 年级'; };

// IE8 没有 Object.create，用中转函数
function inherit(Child, Parent) {
  function F() {}
  F.prototype = Parent.prototype;
  Child.prototype = new F();
  Child.prototype.constructor = Child;
}

// ---------- call / apply / bind ----------
function sum(a, b) { return this.base + a + b; }
sum.call({ base: 10 }, 1, 2);      // 13，参数逐个传
sum.apply({ base: 10 }, [1, 2]);   // 13，参数用数组
var bound = sum.bind({ base: 10 });// 返回新函数，this 固定
bound(1, 2);                       // 13

// ---------- 闭包：记住外层变量 ----------
function counter() {
  var n = 0;
  return function () { return ++n; };   // n 不会被回收
}
var c = counter();
c();  // 1
c();  // 2

// 循环里用 var 的经典坑：全部输出 3
for (var i = 0; i < 3; i++) {
  setTimeout(function () { console.log(i); }, 0);
}
// 修法一：改成 let；修法二：用 IIFE 把 i 关进去
for (var j = 0; j < 3; j++) {
  (function (k) { setTimeout(function () { console.log(k); }, 0); })(j);
}`,
      vars: {},
      docs: {
        secs: [
          { h: 'new 到底做了什么', p: '① 创建一个空对象 ② 把它的 __proto__ 指向构造函数的 prototype ③ 用这个对象当 this 执行构造函数 ④ 构造函数返回对象就用返回的，否则用这个新对象。' },
          { h: 'bind 和 call 的核心区别', p: 'call/apply 立即执行，bind 只返回一个 this 已固定的新函数。绑定一次之后再用 call 也改不了 this，这是写事件回调时最有用的一点。' },
          { h: '闭包为什么会内存泄漏', p: '闭包让外层函数的变量一直活着。如果闭包里引用了 DOM 节点，即使节点被移除也不会回收 —— 老 IE 的循环引用泄漏更严重，用完记得把引用置 null。' }
        ],
        src: { n: 'MDN · 继承与原型链', u: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Inheritance_and_the_prototype_chain' }
      }
    }
  );

  W.kw = W.kw.concat([
    'function', 'var', 'let', 'const', 'return', 'if', 'else', 'for', 'while',
    'typeof', 'instanceof', 'prototype', 'constructor', 'this', 'new', 'null',
    'true', 'false', 'undefined', 'document', 'window', 'setTimeout', 'setInterval',
    'addEventListener', 'attachEvent', 'innerHTML', 'textContent', 'className',
    'classList', 'querySelector', 'getElementById', 'JSON', 'localStorage',
    'sessionStorage', 'XMLHttpRequest', 'console'
  ]);
})(window.__WEB);
