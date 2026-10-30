/* ============================================================
   码典 · JavaWeb · 整套代码 + 排错工作流
   ============================================================ */
(function (J) {
  'use strict';

  /* ---------------- 预设：整套代码 ---------------- */
  J.presets.push(
    {
      id: 'pre-jw-login',
      title: '登录 + 注册 + 拦截：完整一套',
      summary: '一张用户表，从建库、DAO、Service、Servlet 到 JSP 和 Filter，按顺序抄完就能跑。',
      features: ['Servlet', 'Session', 'Filter', 'JDBC'],
      scene: '老系统加登录，或者给新项目打底子。',
      steps: [
        { ref: 'jw-jdbc-six', note: '先把连接跑通，四条连接参数按自己的库改' },
        { ref: 'jw-prepared', note: '所有涉及用户输入的 SQL 都用占位符' },
        { ref: 'jw-tx', note: '注册要写用户表和角色关联表，必须在一个事务里' },
        { ref: 'jw-servlet-anno', note: '登录、注册两个动作挂在一个 Servlet 上，用 action 区分' },
        { ref: 'jw-session-login', note: '登录成功写 Session，注意 changeSessionId' },
        { ref: 'jw-jsp-form', note: '登录页和注册页共用一套回填逻辑' },
        { ref: 'jw-filter-encoding', note: '编码 + 登录拦截，白名单别漏了登录页' }
      ]
    },
    {
      id: 'pre-jw-crud',
      title: '后台 CRUD：列表 + 分页 + 编辑弹窗',
      summary: '一个表的增删改查全套：分页列表、条件查询、表单新增修改、删除确认、JSON 接口。',
      features: ['分页', 'JSON', '三层结构', '校验'],
      scene: '后台管理系统的第一个模块，之后所有模块都是它的复制粘贴。',
      steps: [
        { ref: 'jw-layers', note: '先把包结构定下来，后面加功能才不会乱' },
        { ref: 'jw-druid', note: '连接池配置一次，全项目共用' },
        { ref: 'jw-base-servlet', note: '一个 Servlet 用 action 分发 list / save / delete' },
        { ref: 'jw-page', note: '列表页的分页查询，注意 count 和明细条件一致' },
        { ref: 'jw-validate', note: '保存前统一校验，一次返回所有错误' },
        { ref: 'jw-json', note: '删除、修改走 Ajax，返回统一响应体' },
        { ref: 'jw-errorpage', note: '最后把 404 / 500 收口，别让用户看到堆栈' }
      ]
    }
  );

  /* ---------------- 工作流：排错 ---------------- */
  J.flows.push(
    {
      id: 'flow-jw-404',
      title: '部署后打不开：404 / 500 怎么查',
      summary: '先分清是「找不到东西」还是「代码炸了」，再看日志里的第一行异常。',
      root: 'n1',
      nodes: {
        n1: {
          kind: 'q', label: '浏览器显示的是什么？', note: '404 和 500 的排查方向完全相反',
          children: ['n1a', 'n1b', 'n1c']
        },
        n1a: { kind: 'o', label: '404 Not Found', children: ['n2'] },
        n1b: { kind: 'o', label: '500 Internal Server Error', children: ['n4'] },
        n1c: { kind: 'o', label: '页面一片空白 / 一直转圈', children: ['n6'] },

        n2: {
          kind: 'q', label: '访问的是 /demo/ 还是 /demo？', note: '少了结尾斜杠会先 302 再 404',
          children: ['n2a', 'n3']
        },
        n2a: { kind: 'warn', label: '少了结尾斜杠', children: ['r1'] },

        n3: {
          kind: 'q', label: 'Tomcat 里能看到这个应用吗？（manager 页面或 logs）', note: '应用列表里没有，说明根本没部署成功',
          children: ['n3a', 'n3b']
        },
        n3a: { kind: 'warn', label: '应用没起来', children: ['r2'], snippet: 'jw-tomcat' },
        n3b: { kind: 'o', label: '应用在，但地址对不上', children: ['r3'] },

        n4: {
          kind: 'q', label: '日志里有 Caused by 吗？', note: '只看第一行看不出根因，必须往下翻 Caused by',
          children: ['n4a', 'n4b']
        },
        n4a: { kind: 'o', label: '有，且是 ClassNotFound / NoSuchMethod', children: ['r4'], snippet: 'jw-maven-war' },
        n4b: { kind: 'o', label: '有，且是 SQLException', children: ['r5'], snippet: 'jw-jdbc-six' },

        n6: { kind: 'q', label: 'Network 里请求状态是 pending 还是 200？', note: '200 但空白，通常是 JSP 输出被吞了',
          children: ['n6a', 'n6b']
        },
        n6a: { kind: 'warn', label: 'pending 很久', children: ['r6'] },
        n6b: { kind: 'o', label: '200 但没内容', children: ['r7'], snippet: 'jw-jsp-basic' },

        r1: {
          kind: 'end', label: '补上结尾斜杠',
          body: 'demo.war 的 context path 是 /demo，访问 /demo 时 Tomcat 会 302 到 /demo/，某些反代配置下这一跳会丢，最终 404。直接访问 /demo/ 排除这一项。'
        },
        r2: {
          kind: 'end', label: '去 catalina 日志找部署失败原因',
          body: '常见三种：web.xml 格式不合法（标签没闭合）、Servlet 类没找到（jar 没打进去）、端口被占用（应用根本没启动）。日志里搜 "Deployment of web application archive" 那一行。'
        },
        r3: {
          kind: 'end', label: '核对 context path 与 url-pattern',
          body: 'war 文件名就是 context path：demo-1.0.0.war → /demo-1.0.0。web.xml 或注解里的 url-pattern 拼错一个字母也是 404，而且日志不会有任何提示。'
        },
        r4: {
          kind: 'end', label: '依赖范围写错了',
          body: 'servlet-api 必须 provided；反过来把业务 jar 写成 provided，运行时就会 ClassNotFound。用 mvn dependency:tree 看，再解开 war 检查 WEB-INF/lib。'
        },
        r5: {
          kind: 'end', label: '连接串 / 驱动 / 账号密码',
          body: 'MySQL 8 不写 serverTimezone 会抛时区异常，不写 useSSL=false 会有 SSL 警告；驱动版本和数据库大版本要对得上（8.0 驱动连 5.7 需要兼容模式）。'
        },
        r6: {
          kind: 'end', label: '请求卡在服务端',
          body: '多半是连接池拿不到连接（maxActive 满了或 maxWait 太长），或者 SQL 没有索引在慢查询。用 jstack 打一份线程快照，看业务线程停在哪个方法。'
        },
        r7: {
          kind: 'end', label: 'JSP 报错被错误页吃掉了',
          body: 'JSP 编译失败时容器会转发到 500 错误页，如果错误页自己也出错，最终就是一个空白页。临时把错误页注释掉，或者直接看 logs/localhost 日志里的 JSP 编译错误行号。'
        }
      }
    },

    {
      id: 'flow-jw-garbled',
      title: '中文乱码：定位到具体哪一环',
      summary: '乱码不是玄学。按「页面 → 请求 → 数据库 → 编译」四环依次验证，两分钟能定位。',
      root: 'g1',
      nodes: {
        g1: {
          kind: 'q', label: '乱码出现在哪？', note: '先确定是显示乱码、存进去乱码、还是查出来乱码',
          children: ['g1a', 'g1b', 'g1c']
        },
        g1a: { kind: 'o', label: '页面上的静态文字就乱', children: ['g2'] },
        g1b: { kind: 'o', label: '表单提交后乱', children: ['g3'] },
        g1c: { kind: 'o', label: '数据库里是问号 / 查出来乱', children: ['g5'] },

        g2: {
          kind: 'q', label: '浏览器里看页面的编码是什么？', note: 'F12 → Elements 里看 meta charset，或 Network 看 Content-Type',
          children: ['g2a', 'g2b']
        },
        g2a: { kind: 'warn', label: '不是 UTF-8', children: ['r1'], snippet: 'jw-jsp-basic' },
        g2b: { kind: 'o', label: '是 UTF-8，但还是乱', children: ['r2'] },

        g3: {
          kind: 'q', label: '是 POST 还是 GET 提交？', note: '两者的编码开关不在同一个地方',
          children: ['g3a', 'g3b']
        },
        g3a: { kind: 'o', label: 'POST', children: ['r3'], snippet: 'jw-param' },
        g3b: { kind: 'o', label: 'GET（参数在地址栏）', children: ['r4'], snippet: 'jw-param' },

        g5: {
          kind: 'q', label: '数据库和表的字符集是什么？', note: 'show create table 看 DEFAULT CHARSET',
          children: ['g5a', 'g5b']
        },
        g5a: { kind: 'warn', label: '不是 utf8mb4', children: ['r5'] },
        g5b: { kind: 'o', label: '是 utf8mb4，但连接串没写编码', children: ['r6'], snippet: 'jw-druid' },

        r1: {
          kind: 'end', label: '页面编码没对上',
          body: 'JSP 里 pageEncoding 决定文件怎么读、contentType 的 charset 决定浏览器怎么解，两个都要写 UTF-8。HTML 里再加 <meta charset="UTF-8"> 兜底，三者不一致时最先失效的是 meta。'
        },
        r2: {
          kind: 'end', label: '文件本身的编码不是 UTF-8',
          body: '用记事本另存过的 JSP 常常是 GBK。IDE 里看右下角编码，转成 UTF-8 并确认没有 BOM（BOM 会让 <%@ page 前多出空白，直接报 500）。'
        },
        r3: {
          kind: 'end', label: 'setCharacterEncoding 位置不对',
          body: '必须在第一次 getParameter 之前调用。放在 Filter 最前面最稳，而且 Filter 的映射顺序要在所有业务 Filter 之前（注解方式没有顺序保证，依赖顺序就改用 web.xml）。'
        },
        r4: {
          kind: 'end', label: '改 Tomcat 连接器的 URIEncoding',
          body: 'server.xml 的 Connector 上加 URIEncoding="UTF-8"（Tomcat 8+ 默认已是 UTF-8，7 及以前默认 ISO-8859-1）。代码里的 setCharacterEncoding 对 GET 无效。'
        },
        r5: {
          kind: 'end', label: '库表字符集不是 utf8mb4',
          body: 'utf8 在 MySQL 里是 3 字节，存不了 emoji 和部分生僻字。建库建表都用 utf8mb4 + utf8mb4_general_ci，已有的表用 alter table ... convert to character set utf8mb4 改。'
        },
        r6: {
          kind: 'end', label: '连接串缺 characterEncoding',
          body: 'jdbc:mysql://host/db 后面补上 useUnicode=true&characterEncoding=UTF-8。连接池还要确认它没有把 URL 覆盖成自己的一套。'
        }
      }
    }
  );
})(window.__JW);
