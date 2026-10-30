/* ============================================================
   码典 · JavaWeb 命令 / API 词条（服务搜索，不进高亮）
   ------------------------------------------------------------
   key 用「对象.方法」的完整写法：搜 "request get" 和 "getParameter"
   都能命中同一条，因为分词后每个词都落在同一个字段里。
   ============================================================ */
(function (J) {
  'use strict';

  var C = J.cmd;

  /* ---------------- Servlet 注解 ---------------- */
  C['@WebServlet'] = { p: 'Servlet 3.0 起的注解，替代 web.xml 的 servlet + servlet-mapping。urlPatterns 支持精确、前缀（/user/*）、扩展名（*.do）三种写法。', eg: '@WebServlet(urlPatterns = {"/user/*"}, loadOnStartup = 1)' };
  C['@WebFilter'] = { p: '过滤器注解，urlPatterns="/*" 表示拦所有请求。多个过滤器之间的顺序注解无法保证，依赖顺序时改用 web.xml。', eg: '@WebFilter(filterName = "auth", urlPatterns = {"/*"})' };
  C['@WebListener'] = { p: '监听器注解，配合 ServletContextListener 做应用启动初始化和关闭释放。', eg: '@WebListener public class AppListener implements ServletContextListener' };
  C['@MultipartConfig'] = { p: '开启 multipart 解析，不配它 req.getPart 会抛 IllegalStateException。maxFileSize 是单文件上限，单位字节。', eg: '@MultipartConfig(maxFileSize = 10485760, maxRequestSize = 52428800)' };

  /* ---------------- 请求 ---------------- */
  C['request.getParameter'] = { p: '取单个请求参数，同名多个时只返回第一个。取不到返回 null，不是空字符串。', eg: 'String name = request.getParameter("username");' };
  C['request.getParameterValues'] = { p: '取同名参数的数组，复选框、多选下拉必须用它。', eg: 'String[] ids = request.getParameterValues("roleIds");' };
  C['request.setAttribute'] = { p: '往 request 域放数据，只在一次请求内有效，转发到 JSP 后能取到；重定向会丢。', eg: 'request.setAttribute("userList", list);' };
  C['request.getRequestDispatcher'] = { p: '拿到转发器，forward 是服务器内部跳转，地址栏不变、request 域保留。', eg: 'request.getRequestDispatcher("/WEB-INF/jsp/list.jsp").forward(req, resp);' };
  C['request.setCharacterEncoding'] = { p: '设置请求体编码，必须在第一次取参数之前调用，否则无效。对 GET 的 URL 参数无效。', eg: 'request.setCharacterEncoding("UTF-8");' };
  C['request.getSession'] = { p: '拿会话。getSession() 没有就新建，getSession(false) 没有则返回 null，做登录校验必须用后者。', eg: 'HttpSession session = request.getSession(false);' };
  C['request.getContextPath'] = { p: '返回应用上下文路径（如 /demo，部署在 ROOT 下是空串）。拼接站内链接必须带上它。', eg: 'resp.sendRedirect(request.getContextPath() + "/user?action=list");' };
  C['request.getHeader'] = { p: '读请求头，判断 Ajax 请求常看 X-Requested-With 是否为 XMLHttpRequest。', eg: 'String xhr = request.getHeader("X-Requested-With");' };
  C['request.getPathInfo'] = { p: '拿 /* 映射之后的剩余路径，/api/user/12 下返回 /12，用来做 REST 风格的路径参数。', eg: 'String path = request.getPathInfo(); // "/12"' };

  /* ---------------- 响应 ---------------- */
  C['response.setContentType'] = { p: '设置响应类型和字符集。漏掉 charset=UTF-8，浏览器按 ISO-8859-1 解析就是乱码。', eg: 'resp.setContentType("application/json;charset=UTF-8");' };
  C['response.sendRedirect'] = { p: '重定向，返回 302 让浏览器重新请求。地址栏会变，request 域丢失；站内路径要带 contextPath。', eg: 'resp.sendRedirect(req.getContextPath() + "/login.jsp");' };
  C['response.sendError'] = { p: '直接返回错误状态码，可带提示信息，会触发 web.xml 里对应的错误页。', eg: 'resp.sendError(404, "未知的 action");' };
  C['response.setHeader'] = { p: '设置响应头，下载时用 Content-Disposition，跨域时用 Access-Control-Allow-Origin。', eg: 'resp.setHeader("Content-Disposition", "attachment; filename=a.xlsx");' };
  C['response.getWriter'] = { p: '拿字符输出流，写文本 / JSON。和 getOutputStream 不能同时使用，混用会抛 IllegalStateException。', eg: 'resp.getWriter().write("{\\"ok\\":true}");' };

  /* ---------------- 会话 ---------------- */
  C['session.setAttribute'] = { p: '把对象放进会话，登录成功后存用户，全站可读。集群部署时要注意 Session 不共享。', eg: 'session.setAttribute("loginUser", user);' };
  C['session.invalidate'] = { p: '销毁整个会话，退出登录用。销毁后原 session 对象不可再用。', eg: 'request.getSession().invalidate();' };
  C['session.changeSessionId'] = { p: '换一个新的 Session ID，防会话固定攻击（Servlet 3.1+）。登录成功时调用。', eg: 'request.changeSessionId();' };
  C['session.setMaxInactiveInterval'] = { p: '设置会话超时，单位秒。0 或负数表示永不过期，别这么干。', eg: 'session.setMaxInactiveInterval(30 * 60);' };
  C['cookie.setMaxAge'] = { p: '设置 Cookie 存活秒数。0 表示立即删除，-1（默认）表示关闭浏览器即失效。', eg: 'cookie.setMaxAge(7 * 24 * 60 * 60);' };
  C['cookie.setHttpOnly'] = { p: '禁止 JS 通过 document.cookie 读取，降低 XSS 偷令牌的风险。', eg: 'cookie.setHttpOnly(true);' };
  C['cookie.setPath'] = { p: '设置 Cookie 生效路径。删除时必须和生产时用同一个 Path，否则删不掉。', eg: 'cookie.setPath("/");' };

  /* ---------------- Filter ---------------- */
  C['chain.doFilter'] = { p: '放行请求给下一个过滤器或目标资源。不放行就直接返回响应，等于拦死。', eg: 'chain.doFilter(request, response);' };

  /* ---------------- JDBC ---------------- */
  C['Class.forName'] = { p: '加载 JDBC 驱动类。JDBC 4.0 起可省略（SPI 自动加载），但老驱动和某些容器必须显式写。', eg: 'Class.forName("com.mysql.cj.jdbc.Driver");' };
  C['DriverManager.getConnection'] = { p: '直接建物理连接，没有池化。除了练习代码，业务里应该用 DataSource。', eg: 'Connection conn = DriverManager.getConnection(url, user, pwd);' };
  C['conn.prepareStatement'] = { p: '创建预编译语句，SQL 里用 ? 占位。这是防 SQL 注入的关键，拼字符串永远不安全。', eg: 'PreparedStatement ps = conn.prepareStatement("select * from t_user where id = ?");' };
  C['ps.setString'] = { p: '给第 n 个占位符赋值，索引从 1 开始（不是 0，这是最常见的 off-by-one）。', eg: 'ps.setString(1, username);' };
  C['ps.executeQuery'] = { p: '执行查询，返回 ResultSet。只能用于 select，对 update 用它会抛异常。', eg: 'ResultSet rs = ps.executeQuery();' };
  C['ps.executeUpdate'] = { p: '执行 insert / update / delete，返回受影响行数。行数为 0 通常表示条件没匹配到数据。', eg: 'int n = ps.executeUpdate();' };
  C['ps.addBatch'] = { p: '把当前参数组合加入批处理队列，还没发给数据库。配合 executeBatch 和关闭自动提交才有效。', eg: 'ps.addBatch();' };
  C['ps.executeBatch'] = { p: '一次性把队列里的语句发给数据库，返回每条影响行数。失败抛 BatchUpdateException，必须整体回滚。', eg: 'ps.executeBatch();' };
  C['ps.getGeneratedKeys'] = { p: '取插入后生成的自增主键，前提是 prepareStatement 时传了 RETURN_GENERATED_KEYS。', eg: 'ResultSet keys = ps.getGeneratedKeys(); keys.next(); long id = keys.getLong(1);' };
  C['conn.setAutoCommit'] = { p: '关闭自动提交开始事务。用完（commit / rollback 之后）必须恢复 true，否则连接回池后一直是手动提交状态。', eg: 'conn.setAutoCommit(false);' };
  C['conn.commit'] = { p: '提交事务，业务全部成功后才调。', eg: 'conn.commit();' };
  C['conn.rollback'] = { p: '回滚事务，放在 catch 里。吞异常不 rollback 会导致数据半截写入。', eg: 'conn.rollback();' };

  /* ---------------- JSP / JSTL ---------------- */
  C['@taglib'] = { p: '引入标签库，JSTL core 的 uri 是 http://java.sun.com/jsp/jstl/core，前缀习惯用 c。', eg: '<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>' };
  C['c:forEach'] = { p: '循环标签，items 接集合，var 是当前元素，varStatus 能拿到 index / count / first / last。', eg: '<c:forEach items="${userList}" var="u" varStatus="s">...</c:forEach>' };
  C['c:if'] = { p: '条件标签，test 为 true 才输出标签体。没有 else，要分支用 c:choose。', eg: '<c:if test="${not empty userList}">...</c:if>' };
  C['c:choose'] = { p: '多分支标签，配合 c:when / c:otherwise，等价于 if-else if-else。', eg: '<c:choose><c:when test="${u.status==1}">启用</c:when><c:otherwise>停用</c:otherwise></c:choose>' };
  C['c:out'] = { p: '输出并转义 HTML，默认 escapeXml=true，是防 XSS 最省事的写法。', eg: '<c:out value="${u.username}" default="匿名"/>' };
  C['fmt:formatDate'] = { p: '格式化日期，value 接 java.util.Date，pattern 写 yyyy-MM-dd HH:mm。', eg: '<fmt:formatDate value="${u.createTime}" pattern="yyyy-MM-dd"/>' };
  C['jsp:include'] = { p: '运行期包含另一个页面，各自编译，互不共享变量；<%@ include %> 是编译期把源码抄进来，能共享变量。', eg: '<jsp:include page="/common/header.jsp"/>' };
  C['pageContext.request.contextPath'] = { p: 'EL 里拿应用上下文路径，拼站内链接用它，等价于 request.getContextPath()。', eg: '<a href="${pageContext.request.contextPath}/user?action=list">列表</a>' };

  /* ---------------- 构建 ---------------- */
  C['mvn clean package'] = { p: '清空 target 并打包，war 项目产物在 target/xxx.war。加 -DskipTests 跳过测试。', eg: 'mvn clean package -DskipTests' };
  C['mvn dependency:tree'] = { p: '打印依赖树，排查「同一个类有多个版本」「日志绑定冲突」「provided 写错」的第一条命令。', eg: 'mvn dependency:tree -Dincludes=javax.servlet' };
  C['keytool -genkeypair'] = { p: 'JDK 自带工具，生成 HTTPS 用的 keystore。自签证书只能用于内网测试。', eg: 'keytool -genkeypair -alias tomcat -keyalg RSA -keystore tomcat.p12 -storetype PKCS12' };

  J.cmdSrc.java = [
    '@WebServlet', '@WebFilter', '@WebListener', '@MultipartConfig',
    'request.getParameter', 'request.getParameterValues', 'request.setAttribute',
    'request.getRequestDispatcher', 'request.setCharacterEncoding', 'request.getSession',
    'request.getContextPath', 'request.getHeader', 'request.getPathInfo',
    'response.setContentType', 'response.sendRedirect', 'response.sendError',
    'response.setHeader', 'response.getWriter',
    'session.setAttribute', 'session.invalidate', 'session.changeSessionId',
    'session.setMaxInactiveInterval', 'cookie.setMaxAge', 'cookie.setHttpOnly', 'cookie.setPath',
    'chain.doFilter',
    'Class.forName', 'DriverManager.getConnection', 'conn.prepareStatement', 'ps.setString',
    'ps.executeQuery', 'ps.executeUpdate', 'ps.addBatch', 'ps.executeBatch',
    'ps.getGeneratedKeys', 'conn.setAutoCommit', 'conn.commit', 'conn.rollback',
    '@taglib', 'c:forEach', 'c:if', 'c:choose', 'c:out', 'fmt:formatDate', 'jsp:include',
    'pageContext.request.contextPath',
    'mvn clean package', 'mvn dependency:tree', 'keytool -genkeypair'
  ];
})(window.__JW);
