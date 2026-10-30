/* ============================================================
   码典 · JavaWeb · MVC / 接口（6 条）
   ============================================================ */
(function (J) {
  'use strict';

  J.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'jw-layers',
      cat: 'javaweb-mvc',
      title: '三层结构：包怎么分、谁调谁',
      desc: 'Controller 只管收发，Service 管业务和事务，DAO 只管 SQL，依赖方向永远单向。',
      tags: ['三层架构', '分包', '规范'],
      device: '任意 JavaWeb 项目',
      level: '入门',
      code: `com.demo
├── web            表现层：Servlet / Controller，收参数、给响应
│   ├── UserServlet.java
│   └── filter/AuthFilter.java
├── service        业务层：组合业务、开事务、做校验
│   ├── UserService.java
│   └── impl/UserServiceImpl.java
├── dao            数据层：只有 SQL 和结果集映射
│   ├── UserDao.java
│   └── impl/UserDaoImpl.java
├── entity         实体：和表一一对应，别塞业务方法
├── util           工具：连接池、日期、加密
└── common         公共：统一响应体、异常、常量

// 调用链只有这一条，禁止反向依赖
UserServlet → UserService → UserDao → DB

// Controller 里不写 SQL、不写业务判断
User user = userService.login(username, password);

// Service 里不碰 request / response（这样能被定时任务复用）
public User login(String username, String rawPwd) {
    User u = userDao.findByName(username);
    if (u == null || !PasswordUtil.matches(rawPwd, u.getPassword())) return null;
    return u;
}`,
      vars: {},
      docs: {
        secs: [
          { h: '分层的判断标准', p: '一句话：写单元测试时，Service 不启动 Tomcat 也能测。做不到，说明业务里掺了 Web 层的东西（request、session、response）。' },
          { h: '为什么不能反向依赖', p: 'DAO 里 import HttpServletRequest，等于把数据层钉死在 Web 环境里，定时任务、消息消费者都没法复用，测试也必须造一个假请求。' },
          { h: '实体和 VO 要不要分开', p: '简单项目共用 entity 就行。一旦出现"列表页只要 3 个字段"「接口不能返回密码」这类需求，就该加 VO/DTO，否则迟早把 password 一起返回给前端。' }
        ],
        src: { n: 'Martin Fowler · Presentation Domain Data Layering', u: 'https://martinfowler.com/bliki/PresentationDomainDataLayering.html' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'jw-base-servlet',
      cat: 'javaweb-mvc',
      title: 'BaseServlet：一个 Servlet 处理多个动作',
      desc: '用反射按 action 分发到方法，省掉 UserServlet、OrderServlet 里成堆的 if-else。',
      tags: ['BaseServlet', '反射', '分发'],
      device: 'Tomcat 9 · JDK 8',
      level: '进阶',
      code: `public abstract class BaseServlet extends HttpServlet {

    @Override
    protected void service(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        req.setCharacterEncoding("UTF-8");
        resp.setContentType("text/html;charset=UTF-8");

        String action = req.getParameter("action");
        if (action == null || action.trim().isEmpty()) action = "index";

        try {
            // 找同名方法，参数固定为 (req, resp)
            Method m = this.getClass().getDeclaredMethod(
                    action, HttpServletRequest.class, HttpServletResponse.class);
            m.setAccessible(true);
            m.invoke(this, req, resp);
        } catch (NoSuchMethodException e) {
            resp.sendError(404, "未知的 action: " + action);
        } catch (Exception e) {
            Throwable cause = (e instanceof InvocationTargetException) ? e.getCause() : e;
            throw new ServletException("action=" + action + " 执行失败", cause);
        }
    }
}

// 子类只写业务方法，不再覆写 doGet / doPost
@WebServlet("/user")
public class UserServlet extends BaseServlet {
    protected void list(HttpServletRequest req, HttpServletResponse resp) { /* ... */ }
    protected void save(HttpServletRequest req, HttpServletResponse resp) { /* ... */ }
}`,
      vars: {},
      docs: {
        secs: [
          { h: 'action 必须白名单', p: '反射能调到本类的所有方法，包括 deleteAll、init 这类危险方法。上线前把允许的 action 放进 Set 校验，或者只允许以 do 开头的方法被调用。' },
          { h: 'InvocationTargetException 为什么看不到真实异常', p: '反射调用的异常会被包一层，直接打 e.getMessage() 只能看到 null。必须取 getCause()，否则排查时永远不知道业务里到底抛了什么。' },
          { h: '比一堆 if-else 好在哪', p: '加一个功能只加一个方法，不用改分发逻辑，方法名就是 URL 参数，前端一看就懂。缺点是类型不安全，编译期发现不了拼写错误。' }
        ],
        src: { n: 'Oracle Java · Method.invoke', u: 'https://docs.oracle.com/javase/8/docs/api/java/lang/reflect/Method.html' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'jw-json',
      cat: 'javaweb-mvc',
      title: '返回 JSON：统一响应体 + 手写序列化',
      desc: '一个 code/msg/data 结构走全站，前端不用为每个接口写一套解析。',
      tags: ['JSON', '统一响应', '接口'],
      device: 'Tomcat 9 · fastjson / Jackson',
      level: '进阶',
      code: `// ---------- 统一响应体 ----------
public class R<T> {
    private int code;      // 0 成功，非 0 失败
    private String msg;
    private T data;
    public static <T> R<T> ok(T data) { return new R<>(0, "ok", data); }
    public static <T> R<T> fail(int code, String msg) { return new R<>(code, msg, null); }
    // getter / setter 省略
}

// ---------- Servlet 里怎么写 ----------
resp.setContentType("application/json;charset=UTF-8");
resp.setCharacterEncoding("UTF-8");

try {
    List<User> list = userService.list(req.getParameter("kw"));
    // Jackson：new ObjectMapper().writeValue(resp.getWriter(), R.ok(list));
    // fastjson：resp.getWriter().write(JSON.toJSONString(R.ok(list)));
    resp.getWriter().write(JSON.toJSONString(R.ok(list)));
} catch (BizException e) {
    resp.setStatus(200);                    // 业务失败 HTTP 仍是 200，靠 code 区分
    resp.getWriter().write(JSON.toJSONString(R.fail({{errCode}}, e.getMessage())));
} catch (Exception e) {
    resp.setStatus(500);
    resp.getWriter().write(JSON.toJSONString(R.fail(500, "系统繁忙")));
}`,
      vars: {
        errCode: { label: '业务错误码', value: '1001', type: 'int', min: 1, max: 9999, hint: '自定义', desc: '前端按 code 分支处理（1001 未登录、1002 无权限…），别用 HTTP 状态码表达业务语义。' }
      },
      docs: {
        secs: [
          { h: 'HTTP 状态码和业务码分工', ul: [
            'HTTP 层：401 未认证、403 无权限、404 路径不存在、500 服务端异常',
            '业务层：账号被锁、库存不足、余额不够，这些用 200 + code',
            '两者混用会让前端既判 status 又判 code，迟早写错'
          ] },
          { h: '实体直接返回有什么风险', p: 'User 实体带 password、salt、手机号，直接序列化就把敏感字段吐给前端了。要么用 @JsonIgnore 标注，要么返回专门的 VO。' },
          { h: '中文变成问号或 \\u 转义', p: '不设 charset=UTF-8 浏览器按 ISO-8859-1 解析就是乱码；看到大量 \\u4e2d 是正常的转义，前端 JSON.parse 会自动还原，不是 bug。' }
        ],
        src: { n: 'MDN · JSON', u: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'jw-cors',
      cat: 'javaweb-mvc',
      title: 'CORS 跨域：预检、放行与携带 Cookie',
      desc: '前后端分端口部署时，跨域拦的是浏览器，解法在服务端响应头。',
      tags: ['跨域', 'CORS', '前后端分离'],
      device: 'Tomcat 9 · Servlet 3.1+',
      level: '进阶',
      code: `@WebFilter("/*")
public class CorsFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;

        String origin = req.getHeader("Origin");
        // ① 不要写 * ：带 Cookie 时浏览器直接拒绝
        if (origin != null && ALLOW.contains(origin)) {
            resp.setHeader("Access-Control-Allow-Origin", origin);
            resp.setHeader("Vary", "Origin");
        }
        resp.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,{{customHeader}}");
        resp.setHeader("Access-Control-Allow-Credentials", "true");
        resp.setHeader("Access-Control-Max-Age", "3600");

        // ② 预检请求直接返回 200，不往下走
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            resp.setStatus(HttpServletResponse.SC_OK);
            return;
        }
        chain.doFilter(request, response);
    }
}`,
      vars: {
        customHeader: {
          label: '自定义请求头', value: 'X-Token',
          hint: '逗号分隔',
          desc: '前端带的自定义头必须在 Allow-Headers 里列出，少一个就报 CORS 错误，而报错信息不会告诉你是哪个头。'
        }
      },
      docs: {
        secs: [
          { h: '什么时候会有预检', p: '简单请求（GET/POST + 表单类型 Content-Type）不发预检；带 application/json、自定义头、PUT/DELETE 时，浏览器先发 OPTIONS 问一句能不能。所以 OPTIONS 必须返回 200 且带齐头，否则正式请求根本发不出去。' },
          { h: 'Allow-Origin 不能是 *', p: '带 Cookie 的请求（withCredentials）要求 Allow-Origin 必须是具体域名，不能是通配。所以要先判断 Origin 在白名单里，再把 Origin 原样回写。' },
          { h: '改了代码还是跨域', p: '先看浏览器 Network 里的 OPTIONS 请求响应头有没有生效。很多时候是 Nginx 把响应头吃掉了，或者后端有两套过滤器重复设置 Origin（重复头也会失败）。' }
        ],
        src: { n: 'MDN · 跨源资源共享（CORS）', u: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CORS' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'jw-rest',
      cat: 'javaweb-mvc',
      title: '从 URL 里取路径参数（REST 风格）',
      desc: '没有 Spring 的老项目，也能把 /user/12 里的 12 解析成 id。',
      tags: ['REST', '路径参数', '路由'],
      device: 'Tomcat 9 · Servlet 3.1+',
      level: '进阶',
      code: `@WebServlet("/api/user/*")
public class UserApiServlet extends HttpServlet {

    @Override
    protected void service(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        String path = req.getPathInfo();          // "/12" 或 "/12/orders"
        String method = req.getMethod();
        String[] seg = (path == null ? "" : path).split("/");

        resp.setContentType("application/json;charset=UTF-8");

        // GET /api/user          → 列表
        if (seg.length <= 1 || seg[1].isEmpty()) {
            if (!"GET".equals(method)) { resp.sendError(405); return; }
            write(resp, userService.list());
            return;
        }

        long id;
        try {
            id = Long.parseLong(seg[1]);
        } catch (NumberFormatException e) {
            resp.sendError(400, "id 必须是数字");
            return;
        }

        // GET /api/user/12       → 详情
        if (seg.length == 2) {
            if ("GET".equals(method)) { write(resp, userService.get(id)); return; }
            if ("DELETE".equals(method)) { userService.remove(id); write(resp, "ok"); return; }
            resp.sendError(405);
            return;
        }

        // GET /api/user/12/orders → 子资源
        if (seg.length == 3 && "orders".equals(seg[2]) && "GET".equals(method)) {
            write(resp, orderService.listByUser(id));
            return;
        }
        resp.sendError(404);
    }
}`,
      vars: {},
      docs: {
        secs: [
          { h: 'getPathInfo 和 getServletPath 的区别', p: '/api/user/* 映射下，访问 /api/user/12：getServletPath() 返回 /api/user，getPathInfo() 返回 /12。想取路径变量就用 getPathInfo，它没有就是 null，记得判空。' },
          { h: '为什么要自己解析', p: 'Servlet 规范没有路径变量语法（@PathParam 是 JAX-RS 的东西）。老项目里通常就是这个 split 手动拆，或者引入一个小框架。理解了这段，看 Spring MVC 的 @PathVariable 就是同一件事。' },
          { h: '方法不支持要回 405', p: '返回 405 并带 Allow 头是标准做法；全都回 404 会让前端误以为地址写错了。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · HttpServletRequest', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 6 ---------------- */
    {
      id: 'jw-validate',
      cat: 'javaweb-mvc',
      title: '参数校验：入口挡住脏数据',
      desc: '必填、类型、长度、范围在一个方法里查完，错误一次返回给前端。',
      tags: ['校验', '健壮性', '入口'],
      device: 'Tomcat 9 · JDK 8',
      level: '进阶',
      code: `public class Validator {
    private final List<String> errors = new ArrayList<>();

    public Validator required(String v, String label) {
        if (v == null || v.trim().isEmpty()) errors.add(label + "不能为空");
        return this;
    }
    public Validator maxLen(String v, int max, String label) {
        if (v != null && v.length() > max) errors.add(label + "不能超过 " + max + " 个字");
        return this;
    }
    public Validator range(Integer v, int min, int max, String label) {
        if (v == null || v < min || v > max) errors.add(label + "必须在 " + min + "–" + max + " 之间");
        return this;
    }
    public Validator matches(String v, String regex, String label, String hint) {
        if (v != null && !v.isEmpty() && !v.matches(regex)) errors.add(label + hint);
        return this;
    }
    public boolean hasError() { return !errors.isEmpty(); }
    public String first() { return errors.isEmpty() ? null : errors.get(0); }
}

// 用法：链式写完，一次判断
Validator v = new Validator();
v.required(username, "用户名")
 .maxLen(username, 20, "用户名")
 .range(age, 1, 120, "年龄")
 .matches(phone, "^1[3-9]\\\\d{9}$", "手机号", "格式不正确");

if (v.hasError()) { req.setAttribute("err", v.first()); forward("/WEB-INF/jsp/user/form.jsp"); return; }`,
      vars: {},
      docs: {
        secs: [
          { h: '前端校验不能替代后端', p: '前端校验是体验，后端校验才是安全。禁用 JS、改请求、直接 curl 都能绕过前端，所以入口必须再查一遍。' },
          { h: '一次返回所有错误比返回第一条好', p: '用户填错三个字段，一条条试三次很烦躁。收集成列表一次显示，是表单体验的关键差别。' },
          { h: '正则里的反斜杠', p: 'Java 字符串里写 \\\\d 才等于正则的 \\d。写 \\d 编译器直接报 illegal escape character，这是最常见的语法错误之一。' }
        ],
        src: { n: 'OWASP · 输入校验速查', u: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html' }
      }
    }
  );

  J.kw = J.kw.concat([
    'Service', 'Dao', 'Impl', 'Validator', 'Method', 'invoke', 'getDeclaredMethod',
    'ObjectMapper', 'JSON', 'toJSONString', 'Origin', 'OPTIONS', 'getPathInfo'
  ]);
})(window.__JW);
