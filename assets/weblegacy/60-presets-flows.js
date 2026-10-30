/* ============================================================
   码典 · Web 前端（旧版）· 整套页面 + 排错工作流
   ============================================================ */
(function (W) {
  'use strict';

  W.presets.push(
    {
      id: 'pre-web-page',
      title: '企业站首页：从骨架到轮播',
      summary: '一个完整首页的搭法：语义骨架、导航、轮播、三列内容区、页脚、移动端适配，按顺序拼起来。',
      features: ['HTML5', '浮动布局', '轮播', '响应式'],
      scene: '接一个静态展示站，或者给老页面重做结构。',
      steps: [
        { ref: 'web-html5-layout', note: '先把结构定下来，后面只是往里填内容' },
        { ref: 'web-box-model', note: '统一 box-sizing，避免宽度算不准' },
        { ref: 'web-float', note: '三列内容区用浮动 + 清浮动' },
        { ref: 'web-css3', note: '卡片圆角阴影、按钮渐变，观感提升最快的一步' },
        { ref: 'web-carousel', note: '首屏轮播，注意给容器固定高度防止抖动' },
        { ref: 'web-center', note: '标题区和按钮的居中，按支持的浏览器选方案' },
        { ref: 'web-media', note: '最后加断点，窄屏变单列' }
      ]
    },
    {
      id: 'pre-web-admin',
      title: '老后台页面：查询 + 表格 + 分页 + 弹窗',
      summary: '后台系统里出现频率最高的页面模板，用 jQuery 写也不复杂。',
      features: ['jQuery', 'Ajax', '表单校验', '分页'],
      scene: '维护 5 年前的后台管理系统，一加就是列表页。',
      steps: [
        { ref: 'web-html5-layout', note: '后台页面也有结构：头部、侧栏、内容区' },
        { ref: 'web-layout-bugs', note: '先把塌陷、缝隙这些基础问题排掉' },
        { ref: 'web-regex-form', note: '查询条件的格式校验，别把脏参数发给后端' },
        { ref: 'web-jq-event', note: '表格里的按钮用事件委托绑定' },
        { ref: 'web-jq-ajax', note: '全局配好 loading 和错误提示，业务只管成功回调' },
        { ref: 'web-xhr', note: '不想引 jQuery 时用原生实现同一套' },
        { ref: 'web-print', note: '列表要能打印，补一份打印样式' }
      ]
    }
  );

  W.flows.push(
    {
      id: 'flow-web-layout',
      title: '页面样式不对：按现象定位',
      summary: '错位、塌陷、被盖住、有缝隙 —— 四类现象对应四种原因，不用逐行看 CSS。',
      root: 'l1',
      nodes: {
        l1: {
          kind: 'q', label: '现象是哪一种？', note: '先归类，比从第一行 CSS 看起快十倍',
          children: ['l1a', 'l1b', 'l1c', 'l1d']
        },
        l1a: { kind: 'o', label: '父元素背景/边框包不住子元素', children: ['r1'], snippet: 'web-float' },
        l1b: { kind: 'o', label: '元素跑到奇怪的位置（左上角/偏一半）', children: ['l2'] },
        l1c: { kind: 'o', label: '该在下面的跑到上面，或点不到', children: ['r3'], snippet: 'web-position' },
        l1d: { kind: 'o', label: '两个块之间有莫名其妙的缝', children: ['l4'] },

        l2: {
          kind: 'q', label: '这个元素是 absolute 吗？', note: 'F12 看 computed 里的 position',
          children: ['l2a', 'l2b']
        },
        l2a: { kind: 'warn', label: '是 absolute', children: ['r2'], snippet: 'web-position' },
        l2b: { kind: 'o', label: '不是，但位置偏移', children: ['r4'] },

        l4: {
          kind: 'q', label: '相邻的是 inline-block 还是普通块？', note: 'inline-block 之间的缝是空白字符造成的',
          children: ['l4a', 'l4b']
        },
        l4a: { kind: 'o', label: 'inline-block / inline', children: ['r5'] },
        l4b: { kind: 'o', label: '普通块级', children: ['r6'], snippet: 'web-box-model' },

        r1: {
          kind: 'end', label: '清浮动（或改用 flex）',
          body: '子元素全是 float 时父元素高度为 0。给父元素加 ::after 清浮动（兼容最好），或 display: flow-root；能改布局就用 flex，一劳永逸。'
        },
        r2: {
          kind: 'end', label: 'absolute 找不到定位祖先',
          body: 'absolute 参照最近的非 static 祖先，没有就跑到初始包含块（近似视口左上角）。给父元素加 position: relative 即可。注意父元素的 transform / filter 也会创建包含块。'
        },
        r3: {
          kind: 'end', label: '层叠上下文与 z-index',
          body: 'z-index 只在同一层叠上下文内比较。父元素有 position + z-index、opacity < 1、transform 时会新建上下文，子元素再大的 z-index 也出不去。要么把浮层移出该父元素，要么调父元素的层级。'
        },
        r4: {
          kind: 'end', label: 'margin 或 padding 在作怪',
          body: 'F12 打开盒模型覆盖层，一眼能看到是谁把元素推开了。常见是父元素的 padding-top、或上一个兄弟的 margin-bottom 合并。'
        },
        r5: {
          kind: 'end', label: 'inline-block 的空白间隙',
          body: 'HTML 标签之间的换行被当成一个空格。父元素设 font-size: 0 再给子元素设回来，或父元素 letter-spacing: -3px，或者干脆用 flex（无此问题）。'
        },
        r6: {
          kind: 'end', label: '垂直 margin 合并',
          body: '相邻块级元素的上下 margin 取较大值，不是相加。要么只给一个方向设 margin，要么把其中一层改成 flex 容器（flex 子元素之间不合并）。'
        }
      }
    },

    {
      id: 'flow-web-ajax',
      title: 'Ajax 请求失败：三分钟定位',
      summary: '先看是没发出去、发出去了没回来、还是回来了但代码没处理。',
      root: 'a1',
      nodes: {
        a1: {
          kind: 'q', label: 'Network 面板里能看到这条请求吗？', note: '看不到和失败是两件事',
          children: ['a1a', 'a1b']
        },
        a1a: { kind: 'o', label: '看不到请求', children: ['r1'] },
        a1b: { kind: 'o', label: '能看到，状态码是红的', children: ['a2'] },

        a2: {
          kind: 'q', label: '状态码是哪一类？', note: '4xx 是请求的问题，5xx 是服务端的问题',
          children: ['a2a', 'a2b', 'a2c', 'a2d']
        },
        a2a: { kind: 'o', label: '0 / 报 CORS 错误', children: ['r2'], snippet: 'jw-cors' },
        a2b: { kind: 'o', label: '404', children: ['r3'], snippet: 'web-xhr' },
        a2c: { kind: 'o', label: '500', children: ['r4'], snippet: 'jw-errorpage' },
        a2d: { kind: 'o', label: '状态 200，但回调没执行', children: ['a3'] },

        a3: {
          kind: 'q', label: '控制台有没有 JSON 解析报错？', note: 'Unexpected token < 是最常见的',
          children: ['a3a', 'a3b']
        },
        a3a: { kind: 'warn', label: '有，返回的是 HTML', children: ['r5'] },
        a3b: { kind: 'o', label: '没有报错，但数据是空的', children: ['r6'] },

        r1: {
          kind: 'end', label: '请求根本没发出去',
          body: '三种可能：① 事件绑定在表单提交上但没 return false，页面刷新把请求掐断了；② 代码抛异常在 open 之前就中断，看 Console；③ 元素的 id/name 写错，取值为 undefined 后拼 URL 出错。'
        },
        r2: {
          kind: 'end', label: '跨域被拦',
          body: '浏览器先发 OPTIONS 预检，服务端要返回 200 且带 Allow-Origin / Allow-Methods / Allow-Headers。带 Cookie 时 Allow-Origin 不能是 *，且要 Allow-Credentials: true。Nginx 反代时注意头没被吞掉。'
        },
        r3: {
          kind: 'end', label: '地址不对',
          body: '部署在 /demo 下却请求了 /user，少了 contextPath。或者是相对路径的基准问题（页面在 /demo/a/b.html 时相对路径会拼到 b.html 同级）。统一用绝对路径 + contextPath 最稳。'
        },
        r4: {
          kind: 'end', label: '服务端异常',
          body: '看服务端日志的堆栈，不要只看前端提示。参数类型不匹配（前端传字符串后端接 int）、必填参数为空、SQL 报错是最常见的三类。'
        },
        r5: {
          kind: 'end', label: '返回的是 HTML 不是 JSON',
          body: '接口出错跳到了错误页，或者后端根本没设 Content-Type: application/json。先在浏览器直接打开这个接口地址，看到的是什么就说明后端返回的是什么。'
        },
        r6: {
          kind: 'end', label: '结构对不上或大小写错',
          body: '后端返回 {code, data:{list:[]}}，前端却读 res.list。打印 JSON.stringify(res) 出来对照字段，别凭记忆写。'
        }
      }
    }
  );
})(window.__WEB);
