/* ============================================================
   码典 · Web 前端（旧版）· jQuery（6 条）
   ------------------------------------------------------------
   老项目里 jQuery 仍然满地都是。这里不评价该不该用，
   只讲怎么快速看懂和维护它。
   ============================================================ */
(function (W) {
  'use strict';

  W.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'web-jq-selector',
      cat: 'web-jquery',
      title: 'jQuery 选择器与遍历',
      desc: 'CSS 选择器直接能用的写法，加上 find / siblings / eq 这些遍历方法。',
      tags: ['jQuery', '选择器', '遍历'],
      device: 'jQuery 1.9+ / 3.x',
      level: '入门',
      code: `// ---------- 基础选择 ----------
$('#id');                     // 单个
$('.item');                   // 集合，返回 jQuery 对象（不是数组）
$('ul li:first');             // 伪类，jQuery 自己实现的，比原生多
$('input[name="mobile"]');
$('.list > li');              // 只选直接子元素

// ---------- 常用遍历 ----------
var $items = $('.item');
$items.eq(0);                 // 第 0 个，返回 jQuery 对象
$items.get(0);                // 第 0 个，返回原生 DOM
$items.first(); $items.last();
$items.find('span');          // 后代
$items.children('a');         // 直接子元素
$items.parent(); $items.closest('.box');   // 最近匹配的祖先
$items.siblings();            // 同级兄弟（不含自己）
$items.next(); $items.prev();

// ---------- 过滤 ----------
$items.filter('.on');         // 在集合里再筛
$items.not('.on');
$items.has('img');            // 含某后代的
$items.is('.on');             // 返回布尔值，判断用 is()

// ---------- 遍历 ----------
$items.each(function (i, el) {
  // this === el，都是原生 DOM
  $(el).attr('data-idx', i);
});

// 转成真数组再用 forEach / map
Array.prototype.slice.call($items).forEach(function (el) { });

// ---------- 性能提示 ----------
// ✓ 先用 id 缩小范围，再找子元素
$('#box').find('.item');
// ✗ 直接全文档找，再层层筛
$('.item').find('...').filter('...');`,
      vars: {},
      docs: {
        secs: [
          { h: 'jQuery 对象和 DOM 不是一回事', p: '$(el) 拿到的是包装对象，没有原生方法；el 是原生 DOM，不能用 .css(). 混用时用 $() 包一层或 .get(0) 取出来，这是新手最常见的报错原因。' },
          { h: 'closest 和 parents 的区别', p: 'closest 从自己开始往上找，找到第一个匹配就停；parents 返回所有祖先。事件委托里定位容器用 closest 才对。' },
          { h: '为什么 $ 突然不可用', p: '多半是 jQuery 加载失败（路径 404 / CDN 挂了）。加一句 window.jQuery || document.write 兜底，或者干脆用本地文件。' }
        ],
        src: { n: 'jQuery API 文档 · 选择器', u: 'https://api.jquery.com/category/selectors/' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'web-jq-dom',
      cat: 'web-jquery',
      title: 'DOM 操作：改内容、改样式、增删节点',
      desc: 'html / text / attr / addClass 的取舍，以及链式写法能省多少代码。',
      tags: ['jQuery', 'DOM', '链式'],
      device: 'jQuery 1.9+ / 3.x',
      level: '入门',
      code: `// ---------- 内容 ----------
$('#box').html('<b>加粗</b>');        // 解析 HTML，别塞用户输入
$('#box').text('纯文本');             // 自动转义，安全
$('#box').val('输入框的值');           // 表单元素专用

// ---------- 属性 ----------
$('img').attr('src', '/img/a.png');
var id = $('img').attr('data-id');    // 自定义属性
$('input').prop('checked', true);     // checked / disabled / selected 必须用 prop
$('input').removeAttr('disabled');

// ---------- 样式 ----------
$('#box').addClass('on').removeClass('off').toggleClass('active');
$('#box').css({ color: '#f60', 'font-size': '14px' });   // 带中划线要加引号
var w = $('#box').width();            // 内容宽，不含 padding
var ow = $('#box').outerWidth(true);  // 含 padding、border、margin

// ---------- 增删 ----------
$('<li>').text('新条目').appendTo('ul');       // 创建 + 插入
$('ul').append('<li>末尾</li>');
$('ul').prepend('<li>开头</li>');
$('.a').before('<p>前面</p>');
$('.a').after('<p>后面</p>');
$('.a').remove();                     // 删除节点和事件
$('.a').empty();                      // 清空子节点

// ---------- 显示隐藏 ----------
$('#tip').show(); $('#tip').hide(); $('#tip').toggle();
// 内部是改 display，不是改透明度；隐藏后不占位`,
      vars: {},
      docs: {
        secs: [
          { h: 'attr 和 prop 到底用哪个', p: '布尔属性（checked、disabled、selected、readonly）必须用 prop。用 attr 设置 checked 在老版本 jQuery 里行为不一致，取出的值可能永远是初始值。' },
          { h: 'remove 和 detach 的区别', p: 'remove 会把节点上的事件和数据一起清掉；detach 保留，之后还能重新插回去。频繁移除再插入的场景用 detach。' },
          { h: 'width() 系列别记混', ul: [
            'width()：内容区宽度',
            'innerWidth()：内容 + padding',
            'outerWidth()：内容 + padding + border',
            'outerWidth(true)：再加 margin'
          ] }
        ],
        src: { n: 'jQuery API 文档 · 属性与样式', u: 'https://api.jquery.com/category/attributes/' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'web-jq-event',
      cat: 'web-jquery',
      title: '事件绑定：on / delegate 与动态元素',
      desc: '动态生成的节点用委托绑一次，别在每次渲染后重复 bind。',
      tags: ['jQuery', '事件', '委托'],
      device: 'jQuery 1.7+（on）/ 1.4+（delegate）',
      level: '进阶',
      code: `// ---------- 直接绑定 ----------
$('#btn').on('click', function (e) {
  e.preventDefault();        // 阻止默认行为
  e.stopPropagation();       // 阻止冒泡
  // return false; 等于上面两句都执行（jQuery 特有）
});

// ---------- 委托：动态元素必须用这个 ----------
// 1.7 之前：$('#list').delegate('li', 'click', fn)
// 1.7 之后统一是 on，第四个参数是选择器
$('#{{listId}}').on('click', 'li', function () {
  var id = $(this).data('id');
  // $(this) 永远是被点的那条 li
});

// ---------- 一次性事件 ----------
$('#btn').one('click', function () { });

// ---------- 解绑 ----------
$('#btn').off('click');                    // 解绑所有 click
$('#list').off('click', 'li');             // 解绑委托

// ---------- 合成事件 ----------
$('#box').hover(
  function () { $(this).addClass('on'); },
  function () { $(this).removeClass('on'); }
);
$('input').focus().select();

// ---------- 命名空间：便于整组解绑 ----------
$('#btn').on('click.ns', function () { });
$('#btn').off('.ns');                      // 一次清掉该命名空间的所有事件

// ---------- 触发 ----------
$('#btn').trigger('click');
$('#btn').click();                         // 简写，等价`,
      vars: {
        listId: { label: '列表容器 id', value: 'list', hint: '不带 #', desc: '委托绑在渲染时已存在的父容器上，绑在 ul 上就能覆盖后续新增的 li。' }
      },
      docs: {
        secs: [
          { h: '为什么动态元素点了没反应', p: '代码执行时元素还不存在，$(".item").on(...) 找不到任何东西。要么等渲染完再绑，要么用委托。委托只需要父容器存在。' },
          { h: 'return false 的陷阱', p: 'jQuery 里 return false 同时做了 preventDefault 和 stopPropagation，会把父级的委托也拦住，出现"点了一次整个列表都不响应"。需要哪一个就明确调哪一个。' },
          { h: '重复绑定导致执行多次', p: '每次 Ajax 渲染后都调一次 on，会叠加上去。用 off().on() 成对写，或者把绑定放在初始化里只做一次。' }
        ],
        src: { n: 'jQuery API 文档 · .on()', u: 'https://api.jquery.com/on/' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'web-jq-ajax',
      cat: 'web-jquery',
      title: '$.ajax：全局配置与统一错误处理',
      desc: '一次配好 contentType、loading、错误提示，业务代码只写成功回调。',
      tags: ['jQuery', 'Ajax', '统一处理'],
      device: 'jQuery 1.9+ / 3.x',
      level: '进阶',
      code: `// ---------- 全局配置：只写一次 ----------
$.ajaxSetup({
  dataType: 'json',
  timeout: {{timeout}},
  beforeSend: function (xhr) {
    $('#loading').show();
    var token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  },
  complete: function () { $('#loading').hide(); },
  error: function (xhr) {
    // 401 跳登录，其他给个统一提示
    if (xhr.status === 401) { location.href = '/login'; return; }
    alert('请求失败：' + (xhr.status || '网络异常'));
  }
});

// ---------- 业务调用 ----------
$.ajax({
  url: '/user',
  type: 'POST',                       // 注意是 type 不是 method（1.9 两者都行）
  data: { action: 'save', id: {{userId}} },
  success: function (res) {
    if (res.code === 0) { toast('保存成功'); refresh(); }
    else toast(res.msg);
  }
});

// ---------- 简写 ----------
$.get('/user?action=list', function (res) { render(res.data); });
$.post('/user', { action: 'del', id: 12 }, function (res) { });
$.getJSON('/data.json', function (data) { });

// ---------- 串行 / 并行 ----------
$.when($.get('/a'), $.get('/b')).done(function (a, b) {
  // 两个都完成后执行，参数顺序和 when 一致
});

// ---------- 表单序列化 ----------
var data = $('#form').serialize();              // a=1&b=2
var obj  = $('#form').serializeArray();         // [{name,value}]`,
      vars: {
        timeout: { label: '超时（毫秒）', value: '15000', type: 'int', min: 1000, max: 120000, hint: '15s', desc: '统一在 ajaxSetup 里配，别每个请求各写一遍。' },
        userId: { label: '用户 id', value: '1001', hint: '数字', desc: '示例参数，按实际业务替换。' }
      },
      docs: {
        secs: [
          { h: '为什么错误提示重复弹两次', p: 'ajaxSetup 里配了 error，请求里又写了 error，两个都会执行。要么统一在全局处理，要么请求里覆盖但不重复提示。' },
          { h: 'POST 数据后端收不到', p: 'jQuery 默认用 application/x-www-form-urlencoded，PHP 的 $_POST 才认。传 JSON 要给 contentType: "application/json" 并 JSON.stringify(data)，否则后端拿到的是空。' },
          { h: '跨域时 Cookie 带不上', p: '需要 xhrFields: { withCredentials: true }，同时后端 Access-Control-Allow-Origin 不能是 *。两个条件缺一个都不行。' }
        ],
        src: { n: 'jQuery API 文档 · jQuery.ajax()', u: 'https://api.jquery.com/jQuery.ajax/' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'web-jq-anim',
      cat: 'web-jquery',
      title: '动画与队列：fadeIn / animate / stop',
      desc: '常用动效三行搞定，重点记住 stop() 和动画排队问题。',
      tags: ['jQuery', '动画', '队列'],
      device: 'jQuery 1.9+ / 3.x',
      level: '进阶',
      code: `// ---------- 内置 ----------
$('#tip').fadeIn(200);
$('#tip').fadeOut(200);
$('#tip').slideDown(200);
$('#tip').slideUp(200);
$('#tip').fadeToggle(200);

// ---------- 自定义 ----------
$('#box').animate({
  left: '+=100px',
  opacity: 0.5
}, {{duration}}, 'swing', function () {
  // 动画结束回调
});

// ---------- 停止动画（菜单快速划过时必加） ----------
$('#menu li').hover(
  function () { $(this).find('.sub').stop(true, true).slideDown(150); },
  function () { $(this).find('.sub').stop(true, true).slideUp(150); }
);
// stop(clearQueue, jumpToEnd)：不清队列 + 跳到终点，避免动画排长队

// ---------- 延迟与队列 ----------
$('#box').slideUp(200).delay(300).slideDown(200);

// ---------- 关闭动画（低端机/测试用） ----------
$.fx.off = true;

// ---------- CSS3 过渡更省性能 ----------
// jQuery 动画是逐帧改 style，现代浏览器用 CSS 更顺：
// .box { transition: transform .2s; }
// .box.on { transform: translateY(-2px); }
// 只需要切换类名：$('#box').toggleClass('on');`,
      vars: {
        duration: { label: '时长（毫秒）', value: '300', type: 'int', min: 50, max: 2000, hint: '150–400', desc: '150–200ms 感觉利落，超过 500ms 会显得迟钝。' }
      },
      docs: {
        secs: [
          { h: '动画排队是怎么来的', p: 'jQuery 动画进队列串行执行。鼠标快速划过菜单时，多次 hover 会排一长队，表现是"划过去半天还在动"。入口加 stop(true, true) 清队列并跳到终点。' },
          { h: '为什么滑动的元素高度跳变', p: 'slideDown 依赖元素高度，元素如果有 padding/border 或者内部是浮动的，算出来的高度不对。给动画容器明确高度，或者用 animate 改 max-height。' },
          { h: '动画为什么不流畅', p: 'jQuery 改的是 left/top/width 这类触发布局的属性，每帧都要重排。能用 transform / opacity 就用 CSS 过渡，性能差别很明显。' }
        ],
        src: { n: 'jQuery API 文档 · .animate()', u: 'https://api.jquery.com/animate/' }
      }
    },

    /* ---------------- 6 ---------------- */
    {
      id: 'web-jq-plugin',
      cat: 'web-jquery',
      title: '写一个自己的 jQuery 插件（选项卡）',
      desc: '用 $.fn 扩展，支持链式调用和默认参数，一个文件就是一个组件。',
      tags: ['jQuery', '插件', '组件'],
      device: 'jQuery 1.9+ / 3.x',
      level: '综合',
      code: `(function ($) {
  'use strict';

  var DEFAULTS = {
    activeClass: 'on',
    trigger: 'click',        // click / mouseover
    index: 0                 // 默认选中第几个
  };

  $.fn.tabs = function (options) {
    var opts = $.extend({}, DEFAULTS, options);

    // 返回 this 才能链式调用；内部用 each 支持多实例
    return this.each(function () {
      var $wrap = $(this);
      var $nav = $wrap.find('.tab-nav > *');
      var $panes = $wrap.find('.tab-pane');

      function activate(i) {
        $nav.removeClass(opts.activeClass).eq(i).addClass(opts.activeClass);
        $panes.hide().eq(i).show();
        $wrap.trigger('tab:change', [i]);      // 对外抛事件
      }

      $nav.off(opts.trigger + '.tabs').on(opts.trigger + '.tabs', function () {
        activate($nav.index(this));
      });

      activate(opts.index);
      $wrap.data('tabs', { activate: activate });   // 暴露方法给外部调用
    });
  };
})(jQuery);

// ---------- 用法 ----------
$('.tabs').tabs({ index: {{defaultIndex}} });

// 外部控制
$('.tabs').data('tabs').activate(2);

// 监听切换
$('.tabs').on('tab:change', function (e, i) {
  console.log('切到第 ' + i + ' 个');
});`,
      vars: {
        defaultIndex: { label: '默认选中项', value: '0', type: 'int', min: 0, max: 9, hint: '从 0 开始', desc: '0 表示第一个。写成 0 而不是 1，这是 jQuery eq/index 的约定。' }
      },
      docs: {
        secs: [
          { h: '插件必须遵守的三条', ul: [
            '返回 this.each(...) 以支持链式调用和多实例',
            '用 $.extend 合并默认参数，不要直接改 DEFAULTS 对象',
            '事件加命名空间（.tabs），方便 off 时精确解绑'
          ] },
          { h: '为什么用 data 暴露方法', p: 'jQuery 插件没有实例概念，把方法挂在 data 上是那个年代的标准做法。注意语义化命名，避免和别的插件冲突。' },
          { h: '初始化两次会怎样', p: '同一个元素重复调用会绑两次事件，点击切两下。初始化前先判断 data 标记，或者在开头 off 一遍。' }
        ],
        src: { n: 'jQuery 官方 · 编写插件', u: 'https://learn.jquery.com/plugins/basic-plugin-creation/' }
      }
    }
  );

  W.kw = W.kw.concat([
    'jQuery', 'extend', 'each', 'append', 'prepend', 'removeClass', 'addClass',
    'toggleClass', 'hasClass', 'serialize', 'trigger', 'delegate', 'fadeIn', 'fadeOut'
  ]);
})(window.__WEB);
