/* ============================================================
   码典 · Web 前端（旧版）· 实训（2 条）
   ============================================================ */
(function (W) {
  'use strict';

  W.labs.push(
    {
      id: 'lab-web-tab',
      title: '手写一个选项卡组件（不引任何库）',
      level: '入门',
      minutes: 30,
      fileExt: 'js',
      goal: '用 30 分钟从零写一个能复用的选项卡：结构、样式、事件委托、以及怎么暴露方法给外部。',
      scene: '老项目要加一个 Tab，又不想为了一个组件引入整个 UI 库。',
      planHead: ['文件', '内容', '关键点', '说明'],
      plan: [
        { dev: 'index.html', intf: '结构', ip: '.tabs > .tab-nav + .tab-pane', note: '结构固定，样式才好写' },
        { dev: 'css/main.css', intf: '样式', ip: '.on 类控制选中', note: '别用行内 style' },
        { dev: 'js/tabs.js', intf: '逻辑', ip: '委托 + 闭包', note: '支持多个容器' },
        { dev: '—', intf: '验证', ip: '点每个 Tab', note: '内容跟着切，样式不串' }
      ],
      vars: {
        activeClass: { label: '选中类名', value: 'on', hint: '英文', desc: '和 CSS 里写的一致。用 on 而不是 active，老项目里更常见。' },
        defaultIndex: { label: '默认选中', value: '0', type: 'int', min: 0, max: 9, hint: '从 0 开始', desc: '0 是第一个。页面上有排序需求时这个值会变。' }
      },
      steps: [
        {
          title: '结构：导航和内容一一对应',
          note: '顺序对应关系靠 DOM 顺序，别靠 data 属性对号（容易写错）',
          code: `<div class="tabs" data-tabs>
  <div class="tab-nav">
    <a href="javascript:;" class="{{activeClass}}">全部</a>
    <a href="javascript:;">待付款</a>
    <a href="javascript:;">已完成</a>
  </div>
  <div class="tab-pane">全部内容</div>
  <div class="tab-pane" hidden>待付款内容</div>
  <div class="tab-pane" hidden>已完成内容</div>
</div>`
        },
        {
          title: '样式：选中态只靠一个类',
          note: '内容区用 hidden 属性控制，比 style.display 更干净',
          code: `.tabs { border: 1px solid #e3e6ee; border-radius: 8px; background: #fff; }
.tab-nav { display: flex; border-bottom: 1px solid #e3e6ee; }
.tab-nav a {
  padding: 10px 18px; color: #666; text-decoration: none; font-size: 14px;
  border-bottom: 2px solid transparent;
}
.tab-nav a.{{activeClass}} { color: #2b6cff; border-bottom-color: #2b6cff; }
.tab-pane { padding: 16px; font-size: 14px; line-height: 1.8; }

/* 老浏览器不认 flex 时退回 float，宽度给死 */
.no-flex .tab-nav { overflow: hidden; }
.no-flex .tab-nav a { float: left; }`
        },
        {
          title: '逻辑：一个函数初始化所有容器',
          note: 'IIFE 包一层，避免变量污染全局',
          code: `(function () {
  var wraps = document.querySelectorAll('[data-tabs]');

  function init(wrap) {
    var nav = wrap.querySelector('.tab-nav');
    var panes = wrap.querySelectorAll('.tab-pane');
    var links = nav.getElementsByTagName('a');

    function activate(i) {
      for (var k = 0; k < links.length; k++) {
        links[k].className = (k === i) ? '{{activeClass}}' : '';
      }
      for (var p = 0; p < panes.length; p++) {
        panes[p].hidden = (p !== i);
      }
      wrap.setAttribute('data-active', i);        // 方便外部样式/埋点读取
    }

    nav.addEventListener('click', function (e) {
      var t = e.target;
      if (t.tagName !== 'A') return;
      for (var i = 0; i < links.length; i++) {
        if (links[i] === t) { activate(i); return; }
      }
    }, false);

    activate({{defaultIndex}});
    wrap.activateTab = activate;                  // 暴露方法
  }

  for (var i = 0; i < wraps.length; i++) init(wraps[i]);
})();`
        },
        {
          title: '扩展：支持 URL 定位（#tab=2 直接打开对应页）',
          note: '后台系统里很常见，从别的页跳过来要停在指定 Tab',
          code: `// 初始化时读一次 hash
var m = location.hash.match(/tab=(\\d+)/);
var start = m ? parseInt(m[1], 10) : {{defaultIndex}};
activate(start);

// 切换时写回 hash（用 replaceState 避免污染历史）
if (history.replaceState) {
  history.replaceState(null, '', '#tab=' + i);
}`
        }
      ],
      verify: [
        { cmd: '点第二个 Tab', hope: '第二块内容显示，其余隐藏，导航下划线跟着走' },
        { cmd: '快速连点三个 Tab', hope: '内容与导航始终对应，不出现两个同时亮' },
        { cmd: '页面里再放一个 [data-tabs]', hope: '两个容器互不影响，各自独立切换' },
        { cmd: '地址栏加 #tab=2 刷新', hope: '默认停在第三个 Tab' }
      ],
      pitfalls: [
        '用 class 选 .tab-pane 时把导航也算进去了，索引整体偏一位。',
        '每次点击都用 innerHTML 重绘内容，导致里面的表单输入丢失。',
        '用 querySelector 只初始化了第一个容器，页面上第二个 Tab 点不动。',
        '选中态同时改 class 和 style，两处样式打架，改一个忘一个。'
      ]
    },

    {
      id: 'lab-web-ajax',
      title: '表单校验 + Ajax 提交（对接 JavaWeb 接口）',
      level: '进阶',
      minutes: 40,
      fileExt: 'js',
      goal: '一个注册表单：前端校验、Ajax 提交、后端统一响应、错误回显、防重复提交，一条链路打通。',
      scene: '前后端不分离的老项目，页面是 JSP 渲染的，但提交想用 Ajax 不刷新。',
      planHead: ['部分', '内容', '关键点', '说明'],
      plan: [
        { dev: 'form', intf: '输入框 + 错误位', ip: '每个字段旁边留提示位', note: '别用 alert' },
        { dev: 'js/validate.js', intf: '规则表', ip: '正则集中管理', note: '前后端规则要一致' },
        { dev: 'js/submit.js', intf: 'XHR 提交', ip: '禁用按钮 + 超时', note: '防重复提交' },
        { dev: '后端', intf: '/user?action=save', ip: '返回 {code,msg,data}', note: '和前端约定好' }
      ],
      vars: {
        api: { label: '提交地址', value: '/user?action=save', hint: '相对路径', desc: '部署在子路径下时要带 contextPath，否则 404。' },
        timeout: { label: '超时（毫秒）', value: '10000', type: 'int', min: 1000, max: 60000, hint: '10s', desc: '超时要给用户明确提示，而不是一直转圈。' }
      },
      steps: [
        {
          title: '表单结构：每个字段配一个错误位',
          note: '错误位用固定高度，避免报错时页面跳动',
          code: `<form id="regForm" action="{{api}}" method="post">
  <p>
    <label>手机号</label>
    <input name="mobile" maxlength="11" autocomplete="off">
    <em class="err" data-for="mobile"></em>
  </p>
  <p>
    <label>密码</label>
    <input name="password" type="password" maxlength="20">
    <em class="err" data-for="password"></em>
  </p>
  <p>
    <label>确认密码</label>
    <input name="repassword" type="password" maxlength="20">
    <em class="err" data-for="repassword"></em>
  </p>
  <button type="submit" id="submitBtn">注 册</button>
</form>`
        },
        {
          title: '校验规则：集中成一张表',
          note: '规则只写一处，改规则不用满文件找',
          code: `var RULES = {
  mobile: [
    { test: function (v) { return v !== ''; }, msg: '手机号不能为空' },
    { test: function (v) { return /^1[3-9]\\d{9}$/.test(v); }, msg: '手机号格式不正确' }
  ],
  password: [
    { test: function (v) { return v.length >= 8; }, msg: '密码至少 8 位' },
    { test: function (v) { return /[A-Za-z]/.test(v) && /\\d/.test(v); }, msg: '密码需包含字母和数字' }
  ]
};

function setErr(name, msg) {
  var el = document.querySelector('.err[data-for="' + name + '"]');
  if (el) el.innerHTML = msg || '';
}
function validateField(name, value) {
  var rules = RULES[name] || [];
  for (var i = 0; i < rules.length; i++) {
    if (!rules[i].test(value)) { setErr(name, rules[i].msg); return false; }
  }
  setErr(name, '');
  return true;
}`
        },
        {
          title: '提交：防重复 + 超时 + 统一响应',
          note: '提交期间禁用按钮，是防重复提交最有效的一招',
          code: `var form = document.getElementById('regForm');
var btn = document.getElementById('submitBtn');

form.onsubmit = function () {
  var mobile = form.mobile.value.trim();
  var pwd = form.password.value;

  var ok = validateField('mobile', mobile) & validateField('password', pwd);
  if (pwd !== form.repassword.value) { setErr('repassword', '两次输入不一致'); ok = false; }
  else setErr('repassword', '');
  if (!ok) return false;                 // 阻止默认提交

  btn.disabled = true;
  btn.innerHTML = '提交中…';

  var xhr = new XMLHttpRequest();
  xhr.open('POST', '{{api}}', true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  xhr.timeout = {{timeout}};

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    btn.disabled = false;
    btn.innerHTML = '注 册';

    if (xhr.status !== 200) { alert('网络异常（' + xhr.status + '）'); return; }
    var res;
    try { res = JSON.parse(xhr.responseText); }
    catch (e) { alert('返回格式错误'); return; }

    if (res.code === 0) { location.href = '/user?action=list'; }
    else { setErr('mobile', res.msg); }     // 业务错误回到对应字段
  };
  xhr.ontimeout = function () {
    btn.disabled = false; btn.innerHTML = '注 册';
    alert('请求超时，请检查网络后重试');
  };

  xhr.send('mobile=' + encodeURIComponent(mobile)
         + '&password=' + encodeURIComponent(pwd));
  return false;                          // 关键：拦住浏览器默认提交
};`
        },
        {
          title: '后端：统一响应体（JavaWeb 侧）',
          note: 'code=0 表示成功，msg 直接给前端展示',
          code: `@WebServlet("/user")
public class UserServlet extends HttpServlet {
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        req.setCharacterEncoding("UTF-8");
        resp.setContentType("application/json;charset=UTF-8");

        String mobile = req.getParameter("mobile");
        String pwd = req.getParameter("password");

        if (mobile == null || !mobile.matches("^1[3-9]\\\\d{9}$")) {
            resp.getWriter().write("{\\"code\\":1001,\\"msg\\":\\"手机号格式不正确\\"}");
            return;
        }
        if (userService.existsByMobile(mobile)) {
            resp.getWriter().write("{\\"code\\":1002,\\"msg\\":\\"该手机号已注册\\"}");
            return;
        }
        userService.register(mobile, pwd);
        resp.getWriter().write("{\\"code\\":0,\\"msg\\":\\"ok\\"}");
    }
}`
        }
      ],
      verify: [
        { cmd: '手机号填空提交', hope: '下方出现红字提示，Network 里没有请求发出' },
        { cmd: '手机号填 12345', hope: '提示格式不正确，不提交' },
        { cmd: '密码 12345678（纯数字）', hope: '提示需含字母和数字' },
        { cmd: '两次密码不一致', hope: '确认密码下方提示不一致' },
        { cmd: '正常提交后连点按钮', hope: '按钮置灰显示「提交中…」，只发一次请求' },
        { cmd: '注册已存在的手机号', hope: '后端返回 1002，提示显示在手机号下方' }
      ],
      pitfalls: [
        'onsubmit 里忘了 return false，校验通过了也照样刷新页面，Ajax 白做。',
        '用 alert 做错误提示：一次只能显示一条，用户要试五六次才能提交成功。',
        '提交时不锁按钮，用户连点导致重复注册 —— 前端锁 + 后端唯一索引，两道都要有。',
        '把密码拼进 GET 的 URL，日志和浏览器历史里全是明文。',
        '后端返回 500 时前端只弹「网络异常」，没看 responseText，真正的异常信息被丢掉了。'
      ]
    }
  );
})(window.__WEB);
