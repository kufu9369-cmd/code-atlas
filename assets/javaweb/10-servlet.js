/* ============================================================
   码典 · JavaWeb · Servlet / 会话（8 条）
   ============================================================ */
(function (J) {
  'use strict';

  J.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'jw-servlet-anno',
      cat: 'javaweb-servlet',
      title: '注解式 Servlet：一个入口接管一组 URL',
      desc: '不写 web.xml，用 @WebServlet 映射 /user/*，GET 和 POST 走同一套处理逻辑。',
      tags: ['Servlet', '注解', '入门'],
      device: 'Tomcat 9 · JDK 8 · Servlet 3.1+',
      level: '入门',
      code: `@WebServlet(name = "userServlet", urlPatterns = {"{{urlPattern}}"}, loadOnStartup = 1)
public class UserServlet extends HttpServlet {

    @Override
    public void init() throws ServletException {
        // loadOnStartup = 1 时容器启动就执行，适合做一次性的初始化
        System.out.println("UserServlet init");
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        req.setCharacterEncoding("{{charset}}");       // 只影响 POST 体，GET 见下一条
        resp.setContentType("text/html;charset={{charset}}");

        String action = req.getParameter("action");
        PrintWriter out = resp.getWriter();
        out.write("<h3>action = " + action + "</h3>");
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        doGet(req, resp);          // 表单提交统一走一套逻辑，别写两份
    }
}`,
      vars: {
        urlPattern: {
          label: '映射路径', value: '/user/*',
          hint: '/user/* 或 /user',
          desc: '/user/* 是前缀匹配，/user/a、/user/b 都进这个方法；写成 /user 就只能精确匹配一个地址。'
        },
        charset: {
          label: '编码', value: 'UTF-8', type: 'text',
          hint: 'UTF-8',
          desc: '和 JSP 页面、数据库、Tomcat 连接器保持一致。四处不一致就是乱码的根源。'
        }
      },
      docs: {
        secs: [
          { h: '@WebServlet 的四个常用属性', ul: [
            'value / urlPatterns：映射路径，数组可以一次挂多个地址',
            'loadOnStartup：≥0 表示容器启动就创建实例并调 init()，数字越小越早',
            'name：Servlet 名字，等价于 web.xml 里的 servlet-name',
            'asyncSupported：是否支持异步，配合 AsyncContext 用'
          ] },
          { h: '注解和 web.xml 能共存吗', p: '能，但同一个 Servlet 别两处都配。web.xml 里 metadata-complete="true" 会让容器完全忽略注解，老项目升级时最容易被这条坑到：注解看着写了，实际根本没生效。' },
          { h: '为什么 GET 里 setCharacterEncoding 不生效', p: '请求体的编码才由它决定，而 GET 的参数在 URL 上，编码由连接器的 URIEncoding 决定。所以 GET 中文乱码要去 server.xml 的 Connector 上加 URIEncoding="UTF-8"，不是加在代码里。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · 注解与映射', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'jw-servlet-xml',
      cat: 'javaweb-servlet',
      title: 'web.xml 配置 Servlet（老项目必读）',
      desc: '没有注解的年份靠 web.xml 注册，一个 Servlet 挂多个路径，还能配初始化参数。',
      tags: ['Servlet', 'web.xml', '维护老项目'],
      device: 'Tomcat 7/8/9 · Servlet 2.5+',
      level: '入门',
      code: `<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         version="3.1" metadata-complete="{{metaComplete}}">

  <servlet>
    <servlet-name>{{servletName}}</servlet-name>
    <servlet-class>com.demo.web.UserServlet</servlet-class>
    <init-param>
      <param-name>pageSize</param-name>
      <param-value>{{pageSize}}</param-value>
    </init-param>
    <load-on-startup>1</load-on-startup>
  </servlet>

  <servlet-mapping>
    <servlet-name>{{servletName}}</servlet-name>
    <url-pattern>/user</url-pattern>
  </servlet-mapping>
  <servlet-mapping>
    <servlet-name>{{servletName}}</servlet-name>
    <url-pattern>/sys/user</url-pattern>
  </servlet-mapping>

  <welcome-file-list>
    <welcome-file>index.jsp</welcome-file>
  </welcome-file-list>
</web-app>`,
      vars: {
        servletName: {
          label: 'Servlet 名', value: 'userServlet',
          hint: '自定义，全文件唯一',
          desc: 'servlet 和 servlet-mapping 靠这个名字配对，写错一个字母就是 404，而且不会有任何报错提示。'
        },
        metaComplete: {
          label: '是否忽略注解', value: 'false',
          hint: 'true / false',
          desc: '写 true 容器只认 web.xml，@WebServlet 全部失效；只有确定全量用 xml 配置时才写 true。'
        },
        pageSize: {
          label: '初始化参数', value: '10',
          hint: '业务自定',
          desc: 'Servlet 里用 getServletConfig().getInitParameter("pageSize") 取出来，好处是不用改代码就能调。'
        }
      },
      docs: {
        secs: [
          { h: '版本头决定了能用什么', p: '<web-app version="3.1"> 才支持注解和异步；写 2.5 时容器按老规矩解析，注解直接不认。抄配置前先看这一行。' },
          { h: 'url-pattern 三种写法', ul: [
            '/user：精确匹配，只认这一个地址',
            '/user/*：前缀匹配，/user/1、/user/list 都进得来',
            '*.do：扩展名匹配，早期 Struts 风格；/ 会接管默认 Servlet，静态资源也会被吞，慎用'
          ] },
          { h: '改了 web.xml 必须重启', p: '容器不会热加载 web.xml，改完不生效八成是忘了重启。Tomcat 的 reloadable 只监控 classes 变化，对 web.xml 无效。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · 部署描述符', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'jw-param',
      cat: 'javaweb-servlet',
      title: '接收请求参数并根治中文乱码',
      desc: '单值 / 多值 / 数组三种取法，POST 用 setCharacterEncoding，GET 改连接器。',
      tags: ['参数', '乱码', '高频坑'],
      device: 'Tomcat 8/9 · JDK 8',
      level: '入门',
      code: `// ① 必须在第一次 getParameter 之前设置，否则无效
req.setCharacterEncoding("{{charset}}");

// ② 单个值（同名参数取第一个）
String name = req.getParameter("name");

// ③ 复选框这类多值，用数组，别用 getParameter
String[] hobbies = req.getParameterValues("hobby");

// ④ 取不到时给默认值，顺手去掉首尾空格
int page = {{defaultPage}};
String p = req.getParameter("page");
if (p != null && p.matches("\\\\d+")) {
    page = Integer.parseInt(p);
}

// ⑤ GET 中文乱码要改 Tomcat 的连接器（server.xml）：
//    <Connector port="8080" protocol="HTTP/1.1"
//               URIEncoding="{{charset}}" useBodyEncodingForURI="true"/>

resp.setContentType("text/html;charset={{charset}}");
resp.getWriter().write("name=" + name + ", page=" + page);`,
      vars: {
        charset: {
          label: '编码', value: 'UTF-8', type: 'text', hint: 'UTF-8',
          desc: '页面、请求、响应、数据库、编译五处都写 UTF-8，才可能彻底不乱码。'
        },
        defaultPage: {
          label: '默认页码', value: '1', type: 'int', min: 1, max: 9999,
          hint: '≥1',
          desc: '用户直接访问不带参数的地址时用它兜底，避免 parseInt(null) 抛异常。'
        }
      },
      docs: {
        secs: [
          { h: '乱码到底出在哪一环', ul: [
            '浏览器发出去时：页面 <meta charset> 和表单 accept-charset 决定',
            'Tomcat 收进来时：POST 看 setCharacterEncoding，GET 看 Connector 的 URIEncoding',
            'Java 编译时：javac -encoding UTF-8，否则 class 里就是坏字符',
            '存数据库时：库、表、连接串三处 characterEncoding'
          ] },
          { h: '为什么 setCharacterEncoding 常常"没用"', p: '它必须在第一次读取参数之前调用。只要有一次 getParameter（包括过滤器、框架、日志里顺手取了一下），请求就已经按默认 ISO-8859-1 解析完了，后面再设也没意义。规范做法是放在 Filter 最前面，且 Filter 要在所有业务 Filter 之前。' },
          { h: 'GET 和 POST 为什么表现不一样', p: 'POST 的参数在请求体里，由 setCharacterEncoding 决定；GET 的参数在 URL 里，Tomcat 用 URIEncoding 解码（8.x 起默认就是 UTF-8，7.x 默认 ISO-8859-1）。所以老项目升 Tomcat 时，GET 乱码往往自己好了，POST 反而没变。' }
        ],
        src: { n: 'Apache Tomcat 9 · HTTP Connector 属性', u: 'https://tomcat.apache.org/tomcat-9.0-doc/config/http.html' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'jw-forward-redirect',
      cat: 'javaweb-servlet',
      title: '转发与重定向：什么时候用哪个',
      desc: '转发能带 request 域并且地址栏不变，重定向是让浏览器再发一次请求。',
      tags: ['转发', '重定向', '请求域'],
      device: 'Tomcat 9 · Servlet 3.1+',
      level: '入门',
      code: `// ① 转发 FORWARD：服务器内部跳，一次请求，地址栏不变
req.setAttribute("msg", "保存成功");
req.getRequestDispatcher("/WEB-INF/jsp/user/list.jsp").forward(req, resp);

// ② 重定向 REDIRECT：返回 302，浏览器重新请求，地址栏会变
resp.sendRedirect(req.getContextPath() + "/user?action=list");

// ③ 提交后刷新页面会重复提交 —— 用重定向解决（POST-Redirect-GET）
//    doPost 里处理完写库，直接 redirect 到列表页，刷新也只是重新查询

// ④ 转发只能到本应用内部；重定向可以去任何地址（含外站）
resp.sendRedirect("https://example.com/callback");`,
      vars: {},
      docs: {
        secs: [
          { h: '四条本质区别', ul: [
            '请求次数：转发 1 次，重定向 2 次',
            '地址栏：转发不变，重定向变成新地址',
            '数据传递：转发能用 request 域，重定向不能（换新请求了）',
            '路径范围：转发只能应用内部，重定向可以跨站'
          ] },
          { h: '为什么保存完要重定向', p: 'POST 处理完直接转发到列表页，用户按 F5 会再发一次 POST，重复下单、重复插入就是这么来的。改成「POST 处理 → 重定向到 GET 列表」，刷新只是重新查一次，这就是 PRG 模式。' },
          { h: '转发到 WEB-INF 下的页面', p: 'WEB-INF 里的资源浏览器直接访问不到（404），只能由服务端转发进去。所以把 JSP 全放进 WEB-INF/jsp，是最省事的「禁止直接访问」方案。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · RequestDispatcher', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'jw-session-login',
      cat: 'javaweb-servlet',
      title: 'Session 登录态：登录、校验、退出',
      desc: '登录成功写 Session，每个受保护请求先校验，退出时 invalidate。',
      tags: ['Session', '登录', '权限'],
      device: 'Tomcat 9 · JDK 8',
      level: '进阶',
      code: `// ---------- 登录 ----------
String username = req.getParameter("username");
User user = userService.login(username, req.getParameter("password"));
if (user == null) {
    req.setAttribute("err", "用户名或密码错误");
    req.getRequestDispatcher("/WEB-INF/jsp/login.jsp").forward(req, resp);
    return;
}
// 防会话固定攻击：登录成功后换一个新的 Session ID
req.changeSessionId();
HttpSession session = req.getSession();
session.setAttribute("{{sessionKey}}", user);
session.setMaxInactiveInterval({{timeout}} * 60);      // 秒

resp.sendRedirect(req.getContextPath() + "/user?action=list");

// ---------- 校验（写在 Filter 或 BaseServlet 里） ----------
HttpSession s = req.getSession(false);                 // 不要凭空创建
Object cur = (s == null) ? null : s.getAttribute("{{sessionKey}}");
if (cur == null) {
    resp.sendRedirect(req.getContextPath() + "/login.jsp");
    return;
}

// ---------- 退出 ----------
req.getSession().invalidate();`,
      vars: {
        sessionKey: {
          label: 'Session 键名', value: 'loginUser',
          hint: '全项目统一',
          desc: '键名到处硬编码最容易写错（loginUser / user / currentUser）。定一个常量放公共类里。'
        },
        timeout: {
          label: '超时（分钟）', value: '30', type: 'int', min: 1, max: 1440,
          hint: '1–1440',
          desc: '后台系统一般 30 分钟。设太长会拖着一堆不用的会话占内存。'
        }
      },
      docs: {
        secs: [
          { h: 'getSession() 与 getSession(false)', p: '不带参数时没有就新建，哪怕只是来校验一下，也会顺手创建一个空会话，时间一长内存里全是垃圾 Session。校验场景一律用 getSession(false)，取不到就当没登录。' },
          { h: '为什么要 changeSessionId', p: '攻击者可以先给你一个已知的 Session ID，等你登录后这个 ID 就变成了已登录状态（会话固定）。登录成功时换一个 ID，旧 ID 立刻失效，这条路就堵住了。Servlet 3.1 起有现成方法。' },
          { h: '集群下 Session 不共享', p: '多台 Tomcat 时 Session 默认各存各的，用户第二次请求打到另一台就掉登录。要么做 Session 粘滞，要么把 Session 外置到 Redis（Spring Session 或自己写 Filter 包一层）。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · HttpSession', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 6 ---------------- */
    {
      id: 'jw-cookie-remember',
      cat: 'javaweb-servlet',
      title: 'Cookie 记住我：写入、读取、删除',
      desc: '把令牌写进 Cookie 让用户下次免登录，注意 Path、HttpOnly 和过期时间。',
      tags: ['Cookie', '免登录', '安全'],
      device: 'Tomcat 9 · Servlet 3.1+',
      level: '进阶',
      code: `// ---------- 写 ----------
Cookie c = new Cookie("{{cookieName}}", token);   // token 必须是随机串，别放用户名
c.setMaxAge({{days}} * 24 * 60 * 60);            // 秒；0 = 立刻删除，-1 = 关浏览器失效
c.setPath(req.getContextPath().isEmpty() ? "/" : req.getContextPath());
c.setHttpOnly(true);                             // 禁止 JS 读取，防 XSS 偷令牌
// c.setSecure(true);                            // 只有 HTTPS 才发送
resp.addCookie(c);

// ---------- 读 ----------
String token = null;
Cookie[] cs = req.getCookies();
if (cs != null) {
    for (Cookie ck : cs) {
        if ("{{cookieName}}".equals(ck.getName())) { token = ck.getValue(); break; }
    }
}

// ---------- 删 ----------
Cookie kill = new Cookie("{{cookieName}}", "");
kill.setMaxAge(0);
kill.setPath(req.getContextPath().isEmpty() ? "/" : req.getContextPath());
resp.addCookie(kill);`,
      vars: {
        cookieName: {
          label: 'Cookie 名', value: 'remember',
          hint: '英文，无空格',
          desc: '中文名浏览器会乱码，用英文。同一个域名下重名 Cookie 会互相覆盖。'
        },
        days: {
          label: '有效天数', value: '7', type: 'int', min: 1, max: 365,
          hint: '1–365',
          desc: '免登录时长。金融类系统一般只给 1–3 天，普通站点 7–30 天。'
        }
      },
      docs: {
        secs: [
          { h: '删除为什么删不掉', p: 'Cookie 的删除靠「同名 + 同 Path + 同 Domain 且 maxAge=0」。少一个条件就是新增了一个 Cookie，看起来像没删掉。设置时的 Path 是什么，删除时就写什么。' },
          { h: 'Cookie 里不要放敏感信息', p: 'Cookie 是明文存在用户机器上的，用户名、手机号、密码都不能放。正确做法是放一个随机令牌，服务端存「令牌 → 用户」的映射，令牌可以随时吊销。' },
          { h: 'HttpOnly 挡的是什么', p: '它让 document.cookie 读不到这条 Cookie，XSS 注入的脚本就没法把登录态发走。代价是前端拿不到，需要前端读取的信息别放这里。' }
        ],
        src: { n: 'MDN · Set-Cookie', u: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Set-Cookie' }
      }
    },

    /* ---------------- 7 ---------------- */
    {
      id: 'jw-filter-encoding',
      cat: 'javaweb-servlet',
      title: 'Filter：统一编码 + 登录拦截 + 放行白名单',
      desc: '一个过滤器干两件事：先把编码定死，再判断有没有登录，白名单直接放过。',
      tags: ['Filter', '拦截', '编码'],
      device: 'Tomcat 9 · Servlet 3.1+',
      level: '进阶',
      code: `@WebFilter(filterName = "authFilter", urlPatterns = {"/*"})
public class AuthFilter implements Filter {

    // 不需要登录就能访问的路径
    private static final String[] WHITE = {"/login", "/login.jsp", "/captcha", "/css/", "/js/"};

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;

        // ① 编码必须在任何 getParameter 之前
        req.setCharacterEncoding("{{charset}}");
        resp.setCharacterEncoding("{{charset}}");

        String path = req.getRequestURI().substring(req.getContextPath().length());
        for (String w : WHITE) {
            if (path.equals(w) || path.startsWith(w)) { chain.doFilter(request, response); return; }
        }

        // ② 登录校验
        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("{{sessionKey}}") == null) {
            if (path.endsWith(".ajax") || "XMLHttpRequest".equals(req.getHeader("X-Requested-With"))) {
                resp.setStatus(401);
                resp.getWriter().write("{\\"code\\":401,\\"msg\\":\\"未登录\\"}");
            } else {
                resp.sendRedirect(req.getContextPath() + "/login.jsp");
            }
            return;
        }

        chain.doFilter(request, response);   // 放行
    }
}`,
      vars: {
        charset: { label: '编码', value: 'UTF-8', type: 'text', hint: 'UTF-8', desc: '和页面、数据库保持一致。' },
        sessionKey: { label: 'Session 键名', value: 'loginUser', hint: '全项目统一', desc: '和登录时 setAttribute 用的键名必须一模一样。' },
        whiteList: {
          label: '白名单示例', value: '/login, /css/, /js/',
          hint: '逗号分隔',
          desc: '登录页、验证码、静态资源必须放行，否则登录页自己也被拦，变成无限重定向。'
        }
      },
      docs: {
        secs: [
          { h: '返回值是 JSON 还是跳转', p: 'Ajax 请求被重定向到登录页时，前端拿到的是一整页 HTML，解析 JSON 直接报错，看起来像"接口坏了"。判断请求头 X-Requested-With 或路径后缀，Ajax 返回 401 + JSON，页面请求才跳转。' },
          { h: '过滤器顺序怎么定', p: '注解方式没有顺序保证，多个过滤器互相依赖时必须改用 web.xml 的 <filter-mapping> 声明，按声明顺序执行。编码过滤器一定要排在最前面。' },
          { h: '静态资源也被拦了', p: 'urlPatterns="/*" 会连 css/js/图片一起拦。要么在白名单里放行目录前缀，要么把静态资源交给默认 Servlet（配置 default servlet-mapping），要么把过滤器映射改成只拦 *.do 这类业务后缀。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · Filter', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 8 ---------------- */
    {
      id: 'jw-listener',
      cat: 'javaweb-servlet',
      title: 'Listener：启动时加载配置、关闭时释放资源',
      desc: '应用启动只跑一次的逻辑放这儿，比 init() 更早，比静态块更可控。',
      tags: ['Listener', '初始化', '生命周期'],
      device: 'Tomcat 9 · Servlet 3.1+',
      level: '进阶',
      code: `@WebListener
public class AppListener implements ServletContextListener {

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        ServletContext ctx = sce.getServletContext();

        // ① 读配置：classpath 下的 properties
        Properties p = new Properties();
        try (InputStream in = ctx.getResourceAsStream("/WEB-INF/classes/{{configFile}}")) {
            p.load(in);
        } catch (IOException e) {
            throw new RuntimeException("配置加载失败", e);
        }
        ctx.setAttribute("appConfig", p);

        // ② 初始化连接池（只做一次，别每个请求都建）
        ctx.setAttribute("dataSource", DruidFactory.create(p));

        ctx.log("应用启动完成：" + ctx.getContextPath());
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        DataSource ds = (DataSource) sce.getServletContext().getAttribute("dataSource");
        if (ds instanceof DruidDataSource) ((DruidDataSource) ds).close();
    }
}`,
      vars: {
        configFile: {
          label: '配置文件', value: 'app.properties',
          hint: '放在 src/main/resources 下',
          desc: '打包后就在 WEB-INF/classes 里，用 getResourceAsStream 以 / 开头取。'
        }
      },
      docs: {
        secs: [
          { h: '三种 Listener 的分工', ul: [
            'ServletContextListener：应用启停，适合加载配置、建连接池',
            'HttpSessionListener：会话创建 / 销毁，可用来统计在线人数',
            'ServletRequestListener：每次请求前后，性能开销大，慎用'
          ] },
          { h: '为什么不用静态块', p: '静态块抛异常时容器只给一句 NoClassDefFoundError，堆栈被吃掉，排查极痛苦；Listener 里抛什么就能看到什么。而且静态块随类加载执行，时机不可控。' },
          { h: '连接池放 ServletContext 里', p: '每个请求新建连接池等于自杀：一个池几十个连接，几十个并发就把数据库连接数打满。放在 ServletContext（或静态单例），全应用共用一个。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · 监听器', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    }
  );

  /* 高亮关键字：Java 语法词（只在代码里出现，不会误伤配置文本） */
  J.kw = J.kw.concat([
    'public', 'private', 'protected', 'static', 'final', 'class', 'interface',
    'extends', 'implements', 'void', 'return', 'new', 'import', 'package',
    'try', 'catch', 'finally', 'throw', 'throws', 'this', 'super', 'null', 'true', 'false',
    'String', 'Integer', 'int', 'boolean', 'long', 'double', 'Object', 'List', 'Map',
    'HttpServlet', 'HttpServletRequest', 'HttpServletResponse', 'HttpSession', 'Cookie',
    'Filter', 'FilterChain', 'ServletContext', 'ServletException', 'IOException',
    'setAttribute', 'getAttribute', 'getParameter', 'getSession', 'sendRedirect', 'forward'
  ]);
})(window.__JW);
