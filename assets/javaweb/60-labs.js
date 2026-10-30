/* ============================================================
   码典 · JavaWeb · 实训（2 条）
   ------------------------------------------------------------
   为什么叫实训不叫实验：
   eNSP 的实验有拓扑，这里没有设备，验证方式改成「打开哪个地址、
   看到什么现象」。数据结构和实验完全一致，渲染器共用。
   ============================================================ */
(function (J) {
  'use strict';

  J.labs.push(
    {
      id: 'lab-jw-login',
      title: '从零跑通一个登录功能',
      level: '入门',
      minutes: 40,
      fileExt: 'java',
      goal: '不用框架，用一张表、一个 DAO、一个 Servlet、一个 JSP、一个 Filter，把登录到拦截的完整链路走通。',
      scene: '接手一个没有框架的老系统，或者面试要讲清「一次请求怎么走完的」。',
      planHead: ['文件 / 位置', '内容', '关键点', '说明'],
      plan: [
        { dev: 'sql/user.sql', intf: 't_user 表', ip: 'id / username / password', note: '密码存哈希，不存明文' },
        { dev: 'dao/UserDao.java', intf: 'findByName', ip: 'select ... where username=?', note: '只做数据访问' },
        { dev: 'service/UserService.java', intf: 'login', ip: '校验 + 密码比对', note: '不碰 request' },
        { dev: 'web/LoginServlet.java', intf: '/login', ip: 'post → session', note: '成功后重定向' },
        { dev: 'WEB-INF/jsp/login.jsp', intf: '表单页', ip: '放 WEB-INF 下', note: '禁止直接访问' },
        { dev: 'filter/AuthFilter.java', intf: '/*', ip: '白名单 + 校验', note: '未登录跳登录页' }
      ],
      vars: {
        dbName: { label: '库名', value: 'demo', hint: '已建好的库', desc: '先 create database demo default charset utf8mb4;' },
        charset: { label: '编码', value: 'UTF-8', hint: 'UTF-8', desc: '建库、连接串、页面、Filter 四处一致。' },
        table: { label: '用户表', value: 't_user', hint: '小写中划线/下划线', desc: 'MySQL 在 Linux 上表名区分大小写，统一小写最省事。' }
      },
      steps: [
        {
          title: '建表 + 一条测试数据',
          note: '密码先写明文占位，下一步换成 BCrypt 哈希',
          code: `create database if not exists {{dbName}} default charset utf8mb4;

use {{dbName}};

create table {{table}} (
  id          bigint primary key auto_increment,
  username    varchar(50)  not null unique comment '登录名',
  password    varchar(100) not null        comment '哈希后的密码',
  status      tinyint      not null default 1 comment '1 启用 0 停用',
  create_time datetime     not null default current_timestamp
) engine = InnoDB default charset = utf8mb4;

insert into {{table}} (username, password) values ('admin', '123456');`
        },
        {
          title: 'DAO：按用户名查一条',
          note: '只做 SQL，不判断业务；返回 null 表示不存在',
          code: `public class UserDao {
    public User findByName(String username) {
        String sql = "select id, username, password, status from {{table}} where username = ?";
        try (Connection conn = DataSourceUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, username);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) return null;
                User u = new User();
                u.setId(rs.getLong("id"));
                u.setUsername(rs.getString("username"));
                u.setPassword(rs.getString("password"));
                u.setStatus(rs.getInt("status"));
                return u;
            }
        } catch (SQLException e) {
            throw new RuntimeException("查询用户失败", e);
        }
    }
}`
        },
        {
          title: 'Service：业务判断都放这里',
          note: '停用的账号、密码错误都返回 null，由上层决定怎么提示',
          code: `public class UserService {
    private final UserDao userDao = new UserDao();

    public User login(String username, String rawPassword) {
        if (username == null || username.trim().isEmpty()) return null;

        User u = userDao.findByName(username.trim());
        if (u == null || u.getStatus() != 1) return null;

        // 生产必须用哈希比对，这里演示兼容明文迁移
        if (!PasswordUtil.matches(rawPassword, u.getPassword())) return null;
        return u;
    }
}`
        },
        {
          title: 'Servlet：收参数、写 Session、重定向',
          note: '成功后 changeSessionId 防会话固定',
          code: `@WebServlet("/login")
public class LoginServlet extends HttpServlet {
    private final UserService userService = new UserService();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        req.setCharacterEncoding("{{charset}}");

        String username = req.getParameter("username");
        String password = req.getParameter("password");

        User user = userService.login(username, password);
        if (user == null) {
            req.setAttribute("err", "用户名或密码错误");
            req.setAttribute("username", username);
            req.getRequestDispatcher("/WEB-INF/jsp/login.jsp").forward(req, resp);
            return;
        }

        req.changeSessionId();
        req.getSession().setAttribute("loginUser", user);
        resp.sendRedirect(req.getContextPath() + "/user?action=list");
    }
}`
        },
        {
          title: '登录页：放 WEB-INF 下，只能转发进来',
          note: '错误提示从 request 域取，回填用户名',
          code: `<%@ page contentType="text/html;charset={{charset}}" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<!DOCTYPE html>
<html>
<head><meta charset="{{charset}}"><title>登录</title>
<style>
  body{font:14px/1.6 system-ui;background:#0f1218;color:#e8ebf2;display:grid;place-items:center;height:100vh;margin:0}
  form{background:#161b26;padding:28px 32px;border-radius:12px;width:280px}
  input{width:100%;padding:9px 10px;margin:6px 0 14px;border:1px solid #2a3346;border-radius:8px;background:#0f1218;color:inherit}
  button{width:100%;padding:10px;border:0;border-radius:8px;background:#ffb454;color:#141414;font-weight:600}
  .err{color:#ff7a93;font-size:12.5px;margin-bottom:8px}
</style></head>
<body>
<form action="\${pageContext.request.contextPath}/login" method="post">
  <h3>登录</h3>
  <c:if test="\${not empty err}"><div class="err">\${err}</div></c:if>
  <input name="username" value="\${username}" placeholder="用户名" required>
  <input name="password" type="password" placeholder="密码" required>
  <button type="submit">登 录</button>
</form>
</body>
</html>`
        },
        {
          title: 'Filter：白名单放行，其余必须登录',
          note: '白名单必须包含 /login 和静态资源，否则登录页自己也被拦',
          code: `@WebFilter("/*")
public class AuthFilter implements Filter {
    private static final String[] WHITE = {"/login", "/css/", "/js/", "/favicon.ico"};

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;
        req.setCharacterEncoding("{{charset}}");

        String path = req.getRequestURI().substring(req.getContextPath().length());
        for (String w : WHITE) {
            if (path.equals(w) || path.startsWith(w)) { chain.doFilter(request, response); return; }
        }

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("loginUser") == null) {
            resp.sendRedirect(req.getContextPath() + "/login");
            return;
        }
        chain.doFilter(request, response);
    }
}`
        }
      ],
      verify: [
        { cmd: '访问 http://localhost:8080/demo/user?action=list', hope: '没登录 → 自动跳到 /login' },
        { cmd: '输入 admin / 错误密码', hope: '留在登录页，显示「用户名或密码错误」，用户名已回填' },
        { cmd: '输入 admin / 123456', hope: '跳到列表页，地址栏是 /user?action=list' },
        { cmd: '列表页按 F5', hope: '只是重新查一次，不会重复提交表单' },
        { cmd: '直接访问 /WEB-INF/jsp/login.jsp', hope: '404 —— WEB-INF 下的页面浏览器进不来' }
      ],
      pitfalls: [
        '白名单少了 /login，登录页请求也被拦，浏览器显示「重定向次数过多」。',
        'POST 处理成功后又 forward 到列表页：按 F5 会重复提交表单，必须用 sendRedirect。',
        '密码明文比对。哪怕是练习项目，也养成存哈希的习惯，改造老系统时这一条往往就是最大的安全洞。',
        'Filter 里没有 setCharacterEncoding，或者放在业务代码之后，中文用户名一律乱码。',
        '登录页写在 webapp 根目录下，用户可以直接访问但拿不到 err 属性，看起来「错误提示不见了」。'
      ]
    },

    {
      id: 'lab-jw-page',
      title: '连接池 + 分页列表 + 导出全链路',
      level: '进阶',
      minutes: 45,
      fileExt: 'java',
      goal: '一条列表页从连接池拿连接，查总数和当前页，把分页参数回传给页面，最后支持导出 Excel。',
      scene: '后台管理系统的标准列表页，几乎所有 JavaWeb 项目都绕不开。',
      planHead: ['文件 / 位置', '内容', '关键点', '说明'],
      plan: [
        { dev: 'util/DataSourceUtil', intf: 'getConnection', ip: 'Druid 单例', note: '全应用共用一个池' },
        { dev: 'dao/UserDao#page', intf: 'count + limit', ip: '两条 SQL', note: '总页数向上取整' },
        { dev: 'service/UserService', intf: 'page()', ip: '返回 PageResult', note: '带页码归一化' },
        { dev: 'web/UserServlet#list', intf: '/user?action=list', ip: 'request 域 + 转发', note: '页码从参数取' },
        { dev: 'WEB-INF/jsp/list.jsp', intf: '表格 + 分页条', ip: 'JSTL 遍历', note: '拼接页码链接' }
      ],
      vars: {
        pageSize: { label: '每页条数', value: '10', type: 'int', min: 1, max: 200, hint: '10 / 20 / 50', desc: '固定服务端值，别让前端随便传大数字。' },
        table: { label: '用户表', value: 't_user', hint: '小写下划线', desc: '和登录实训用的是同一张表，可以直接接着做。' }
      },
      steps: [
        {
          title: '连接池工具类：拿连接、关连接',
          note: 'close 是还回池，不是断开物理连接',
          code: `public final class DataSourceUtil {
    private static final DataSource DS;

    static {
        try (InputStream in = DataSourceUtil.class.getClassLoader()
                .getResourceAsStream("druid.properties")) {
            Properties p = new Properties();
            p.load(in);
            DS = DruidDataSourceFactory.createDataSource(p);
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);   // 启动就炸，别拖到第一个请求
        }
    }

    public static Connection getConnection() throws SQLException {
        return DS.getConnection();
    }

    public static DataSource get() { return DS; }
}`
        },
        {
          title: 'DAO：总数 + 当前页',
          note: '两条 SQL 用同一个 where 条件，否则分页数字对不上',
          code: `public PageResult<User> page(int pageNo, int pageSize) {
    int total = 0;
    try (Connection conn = DataSourceUtil.getConnection();
         PreparedStatement ps = conn.prepareStatement(
             "select count(*) from {{table}} where status = 1");
         ResultSet rs = ps.executeQuery()) {
        if (rs.next()) total = rs.getInt(1);
    } catch (SQLException e) { throw new RuntimeException(e); }

    List<User> rows = new ArrayList<>();
    try (Connection conn = DataSourceUtil.getConnection();
         PreparedStatement ps = conn.prepareStatement(
             "select id, username, create_time from {{table}} "
           + "where status = 1 order by id desc limit ?, ?")) {
        ps.setInt(1, (pageNo - 1) * pageSize);
        ps.setInt(2, pageSize);
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                User u = new User();
                u.setId(rs.getLong("id"));
                u.setUsername(rs.getString("username"));
                u.setCreateTime(rs.getTimestamp("create_time"));
                rows.add(u);
            }
        }
    } catch (SQLException e) { throw new RuntimeException(e); }

    return new PageResult<>(rows, total, pageNo, pageSize);
}`
        },
        {
          title: 'Servlet：页码归一化后转发',
          note: 'page 参数可能是 null、负数、abc，全部在这里兜住',
          code: `@WebServlet("/user")
public class UserServlet extends HttpServlet {
    private final UserService userService = new UserService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        req.setCharacterEncoding("UTF-8");
        resp.setContentType("text/html;charset=UTF-8");

        int pageNo = parseInt(req.getParameter("page"), 1);
        int pageSize = {{pageSize}};
        if (pageNo < 1) pageNo = 1;

        PageResult<User> pr = userService.page(pageNo, pageSize);
        req.setAttribute("pr", pr);
        req.getRequestDispatcher("/WEB-INF/jsp/list.jsp").forward(req, resp);
    }

    private int parseInt(String s, int def) {
        if (s == null || !s.matches("\\\\d+")) return def;
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return def; }
    }
}`
        },
        {
          title: '页面：表格 + 分页条',
          note: '上一页 / 下一页都要判断边界，别让用户点到 0 页',
          code: `<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt" %>

<table class="list">
  <thead><tr><th>ID</th><th>用户名</th><th>创建时间</th></tr></thead>
  <tbody>
    <c:forEach items="\${pr.rows}" var="u">
      <tr>
        <td>\${u.id}</td>
        <td><c:out value="\${u.username}"/></td>
        <td><fmt:formatDate value="\${u.createTime}" pattern="yyyy-MM-dd HH:mm"/></td>
      </tr>
    </c:forEach>
    <c:if test="\${empty pr.rows}">
      <tr><td colspan="3" class="empty">暂无数据</td></tr>
    </c:if>
  </tbody>
</table>

<div class="pager">
  共 \${pr.total} 条 · 第 \${pr.pageNo}/\${pr.pages} 页
  <c:if test="\${pr.pageNo > 1}">
    <a href="\${pageContext.request.contextPath}/user?page=\${pr.pageNo - 1}">上一页</a>
  </c:if>
  <c:if test="\${pr.pageNo < pr.pages}">
    <a href="\${pageContext.request.contextPath}/user?page=\${pr.pageNo + 1}">下一页</a>
  </c:if>
</div>`
        },
        {
          title: '导出：用同一套查询，直接写 Excel',
          note: '数据量大时改成分批查 + 边写边刷盘',
          code: `// GET /user?action=export
resp.setContentType("application/vnd.ms-excel;charset=UTF-8");
resp.setHeader("Content-Disposition",
    "attachment; filename=\\"" + URLEncoder.encode("用户列表.xls", "UTF-8") + "\\"");

try (PrintWriter w = resp.getWriter()) {
    w.println("<table border='1'>");
    w.println("<tr><th>ID</th><th>用户名</th><th>创建时间</th></tr>");
    for (User u : userService.listAll()) {
        w.println("<tr><td>" + u.getId() + "</td><td>" + esc(u.getUsername())
                + "</td><td>" + u.getCreateTime() + "</td></tr>");
    }
    w.println("</table>");
}

// esc()：& < > 必须转义，否则用户名里的 < 会把表格结构冲坏`
        }
      ],
      verify: [
        { cmd: '访问 /user?page=1', hope: '显示第一页 10 条，底部「第 1/N 页」' },
        { cmd: '访问 /user?page=abc', hope: '不报错，回到第 1 页' },
        { cmd: '访问 /user?page=99999', hope: '回到第 1 页或空列表提示，不抛异常' },
        { cmd: '访问 /user?action=export', hope: '浏览器弹下载框，Excel 里中文不乱码' },
        { cmd: '把 pageSize 改成 1000 再试', hope: '响应明显变慢 —— 这就是 limit 要给固定值的原因' }
      ],
      pitfalls: [
        'count 的 where 条件和明细的 where 条件写成不一样，总页数永远对不上。',
        '页码直接用 Integer.parseInt(request.getParameter("page"))，参数缺失就 NumberFormatException，页面 500。',
        '分页链接用绝对路径 /user，部署在 /demo 下就 404 —— 必须带 pageContext.request.contextPath。',
        '导出时忘了转义 < & >，用户名里一个小于号就能让整个 Excel 结构错位。',
        '导出把全表数据一次读进 List，几十万行直接 OOM。改成分批查（每次 5000）边写边输出。'
      ]
    }
  );
})(window.__JW);
