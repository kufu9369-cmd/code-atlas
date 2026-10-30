/* ============================================================
   码典 · JavaWeb · JSP / 视图（5 条）
   ------------------------------------------------------------
   这块是"旧版"内容：新项目基本都前后端分离了，但只要还在维护
   5 年前的后台系统，JSP + EL + JSTL 就是绕不开的。
   ============================================================ */
(function (J) {
  'use strict';

  J.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'jw-jsp-basic',
      cat: 'javaweb-jsp',
      title: 'JSP 三件套：指令、脚本、表达式',
      desc: '看懂老 JSP 靠这三样，再顺手记住九个内置对象都是什么。',
      tags: ['JSP', '语法', '维护老项目'],
      device: 'Tomcat 8/9 · JSP 2.3',
      level: '入门',
      code: `<%@ page language="java" contentType="text/html; charset={{charset}}"
         pageEncoding="{{charset}}" import="java.util.*, com.demo.entity.User" %>
<%-- 注释：客户端看不到，HTML 注释 <!-- --> 会发给浏览器 --%>

<%
    // 脚本片段：写 Java 逻辑，最终会进 _jspService 方法里
    String title = (String) request.getAttribute("title");
    if (title == null) title = "{{defaultTitle}}";
    List<User> list = (List<User>) request.getAttribute("userList");
%>

<!DOCTYPE html>
<html>
<head><meta charset="{{charset}}"><title><%=title%></title></head>
<body>
  <h1><%= title %></h1>          <%-- 表达式：输出变量，不带分号 --%>

  <% if (list == null || list.isEmpty()) { %>
      <p>暂无数据</p>
  <% } else { %>
      <p>共 <%= list.size() %> 条</p>
  <% } %>

  <%-- 九个内置对象：
       request / response / session / application / out
       pageContext / page / config / exception --%>
</body>
</html>`,
      vars: {
        charset: { label: '编码', value: 'UTF-8', type: 'text', hint: 'UTF-8', desc: 'pageEncoding 决定这个文件怎么读，contentType 决定浏览器怎么解。两个不一致必乱码。' },
        defaultTitle: { label: '默认标题', value: '用户列表', hint: '兜底文案', desc: 'request 域取不到时显示它，避免页面出现 null。' }
      },
      docs: {
        secs: [
          { h: '三种语法别记混', ul: [
            '<%@ %> 指令：page、include、taglib，配置性质，不产生输出',
            '<% %> 脚本：任意 Java 代码，最终进 _jspService 方法',
            '<%= %> 表达式：输出一个值，结尾不加分号'
          ] },
          { h: '为什么 JSP 里能不 new 出 request', p: 'JSP 编译成 Servlet 后，request、response 这些是 _jspService 的入参，session、application 是方法里取出来的局部变量，所以能直接用。它们叫「内置对象」。' },
          { h: 'include 指令和 include 动作的区别', p: '<%@ include file="a.jsp" %> 是编译期把文件内容抄进来，变量能共用，改一个要重编；<jsp:include page="a.jsp"/> 是运行期单独请求再插入结果，互不影响。头部页脚用前者，动态内容用后者。' }
        ],
        src: { n: 'Jakarta Pages 规范', u: 'https://jakarta.ee/specifications/pages/' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'jw-jstl',
      cat: 'javaweb-jsp',
      title: 'EL + JSTL：页面里不写 Java 代码',
      desc: '用 c:forEach / c:if / c:choose 代替脚本片段，页面只负责显示。',
      tags: ['JSTL', 'EL', '标签库'],
      device: 'Tomcat 9 · JSTL 1.2（jstl.jar + standard.jar）',
      level: '进阶',
      code: `<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt" %>

<%-- 遍历：varStatus 里有 index / count / first / last --%>
<table>
  <c:forEach items="\${userList}" var="u" varStatus="s">
    <tr class="\${s.index % 2 == 0 ? 'odd' : 'even'}">
      <td>\${s.count}</td>
      <td>\${u.username}</td>
      <td><fmt:formatDate value="\${u.createTime}" pattern="yyyy-MM-dd HH:mm"/></td>
      <td>
        <c:choose>
          <c:when test="\${u.status == 1}"><span class="on">启用</span></c:when>
          <c:otherwise><span class="off">停用</span></c:otherwise>
        </c:choose>
      </td>
    </tr>
  </c:forEach>
</table>

<%-- 空值判断：empty 同时管 null 和空集合 --%>
<c:if test="\${empty userList}"><p>暂无数据</p></c:if>

<%-- 输出带转义，防 XSS；c:out 默认 escapeXml=true --%>
<p>欢迎，<c:out value="\${sessionScope.{{sessionKey}}.username}" default="游客"/></p>

<%-- 分页链接拼参数 --%>
<c:url var="next" value="/user">
  <c:param name="action" value="list"/>
  <c:param name="page" value="\${page + 1}"/>
</c:url>
<a href="\${next}">下一页</a>`,
      vars: {
        sessionKey: { label: 'Session 键名', value: 'loginUser', hint: '全项目统一', desc: 'EL 取 session 里的对象：${sessionScope.loginUser}，键名要和登录时写的一致。' }
      },
      docs: {
        secs: [
          { h: 'EL 的取值顺序', p: '不带作用域前缀时按 page → request → session → application 依次找，找到就停。同名对象在多处存在时，必须先写前缀（requestScope.xxx），否则拿到的可能不是你以为的那个。' },
          { h: '为什么 ${} 显示不出来', ul: [
            'web.xml 版本低于 2.4，EL 默认关闭，需 isELIgnored="false"',
            '页面本身被当成静态资源返回了（路径没经过 JSP 引擎）',
            'Tomcat 里 EL 表达式原样输出，多半是 jsp-api 和容器版本冲突'
          ] },
          { h: '别用 ${} 直接拼 HTML', p: 'EL 输出不转义，用户昵称里塞一段 script 就能执行（存储型 XSS）。要显示用户输入一律用 c:out，或者先在后台做 HTML 转义。' }
        ],
        src: { n: 'Jakarta Standard Tag Library', u: 'https://jakarta.ee/specifications/tags/' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'jw-jsp-form',
      cat: 'javaweb-jsp',
      title: '表单回填：编辑页不用重新选一遍',
      desc: '编辑场景把原值填回输入框、单选、复选和下拉，用户只改要改的。',
      tags: ['表单', '回填', '编辑页'],
      device: 'Tomcat 9 · JSP 2.3',
      level: '进阶',
      code: `<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>

<form action="\${pageContext.request.contextPath}/user" method="post">
  <input type="hidden" name="action" value="save">
  <input type="hidden" name="id" value="\${user.id}">

  <%-- 文本框：注意引号，值里出现双引号会截断 --%>
  <input type="text" name="username" value="<c:out value='\${user.username}'/>">

  <%-- 单选：选中项加 checked --%>
  <label><input type="radio" name="sex" value="1"
    <c:if test="\${user.sex == 1}">checked</c:if>> 男</label>
  <label><input type="radio" name="sex" value="2"
    <c:if test="\${user.sex == 2}">checked</c:if>> 女</label>

  <%-- 复选：值在集合里就选中 --%>
  <c:forEach items="\${allRoles}" var="r">
    <label><input type="checkbox" name="roleIds" value="\${r.id}"
      <c:if test="\${user.roleIds.contains(r.id)}">checked</c:if>> \${r.name}</label>
  </c:forEach>

  <%-- 下拉：用三元表达式标 selected --%>
  <select name="deptId">
    <option value="">请选择</option>
    <c:forEach items="\${deptList}" var="d">
      <option value="\${d.id}" \${user.deptId == d.id ? 'selected' : ''}>\${d.name}</option>
    </c:forEach>
  </select>

  <button type="submit">保存</button>
</form>`,
      vars: {},
      docs: {
        secs: [
          { h: 'value 里为什么用单引号包 c:out', p: 'HTML 属性用双引号，如果写成 value="<c:out value="${x}"/>"，标签属性里又出现双引号，解析器会提前结束属性。写成 value="<c:out value=\'${x}\'/>" 才能正确嵌套。' },
          { h: '回填的数据从哪来', p: '编辑页通常是「查一条 → 放 request 域 → 转发到 JSP」。如果回填后为空，先确认是用 forward 而不是 sendRedirect（重定向换新请求，request 域就没了）。' },
          { h: '复选框一定要用数组接', p: '后端用 getParameterValues("roleIds")，用 getParameter 只会拿到第一个值。这条每年都有人踩。' }
        ],
        src: { n: 'Jakarta Pages 规范 · 表达式语言', u: 'https://jakarta.ee/specifications/pages/' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'jw-upload',
      cat: 'javaweb-jsp',
      title: '文件上传：Servlet 3.0 的 Part 写法',
      desc: '不引第三方包，注解里开 multipart-config，用 Part 直接落盘。',
      tags: ['上传', 'Part', 'multipart'],
      device: 'Tomcat 8/9 · Servlet 3.1+',
      level: '进阶',
      code: `@WebServlet(urlPatterns = {"/upload"})
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024,        // 超过 1MB 先写临时文件
    maxFileSize = {{maxFileSize}}L,          // 单文件上限
    maxRequestSize = 50L * 1024 * 1024      // 整个请求上限
)
public class UploadServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        Part part = req.getPart("file");            // 名字和 <input name="file"> 对应
        String submitted = part.getSubmittedFileName();

        // ① 只取扩展名，文件名必须自己生成，绝不能用客户端给的名字
        String ext = submitted.substring(submitted.lastIndexOf('.'));
        String name = UUID.randomUUID().toString().replace("-", "") + ext;

        // ② 存到应用外的目录，别放在部署目录里（重新发布就没了）
        File dir = new File("{{saveDir}}");
        if (!dir.exists()) dir.mkdirs();
        part.write(new File(dir, name).getAbsolutePath());

        resp.setContentType("application/json;charset=UTF-8");
        resp.getWriter().write("{\\"ok\\":true,\\"name\\":\\"" + name + "\\"}");
    }
}`,
      vars: {
        maxFileSize: {
          label: '单文件上限（字节）', value: '10485760',
          hint: '10MB = 10485760',
          desc: '超过就抛 IllegalStateException，前端只会看到 500，最好在 Filter 里捕获后返回友好提示。'
        },
        saveDir: {
          label: '保存目录', value: 'D:/upload',
          hint: '绝对路径',
          desc: '放在应用部署目录里，重新发布 war 时会被一起删掉。生产环境单独挂一个数据盘目录。'
        }
      },
      docs: {
        secs: [
          { h: '为什么必须自己重命名', p: '客户端文件名可以带 ../ 做目录穿越，也可以起个 .jsp 后直接执行。只有「随机名 + 白名单扩展名」才安全。' },
          { h: '上传大小超了报什么错', p: '抛 IllegalStateException: FileSizeLimitExceededException，默认页面是 500。要么在 Servlet 里 try-catch 后 forward 到提示页，要么配置 <error-page> 单独处理这个异常。' },
          { h: '老写法 Commos-fileupload', p: 'Servlet 3.0 之前用 commons-fileupload + commons-io：DiskFileItemFactory → ServletFileUpload → parseRequest。老项目里见到 new DiskFileItemFactory() 就是这套。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · MultipartConfig', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'jw-download',
      cat: 'javaweb-jsp',
      title: '文件下载：中文文件名不乱码',
      desc: '设置 Content-Disposition，中文名走 URL 编码，强制浏览器弹下载框。',
      tags: ['下载', '中文文件名', '响应头'],
      device: 'Tomcat 8/9 · Servlet 3.1+',
      level: '进阶',
      code: `protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

    String id = req.getParameter("id");
    File file = fileService.getFile(id);            // 只按 id 取，不拼用户传的路径
    if (!file.exists()) { resp.sendError(404); return; }

    String fileName = "{{fileName}}.xlsx";
    // ① 中文文件名必须 URL 编码，否则 Firefox / Chrome 会显示乱码
    String encoded = URLEncoder.encode(fileName, "UTF-8").replace("+", "%20");

    resp.setContentType("application/octet-stream");
    resp.setHeader("Content-Disposition",
        "attachment; filename=\\"" + encoded + "\\"; filename*=UTF-8''" + encoded);
    resp.setContentLengthLong(file.length());

    // ② 边读边写，别一次性读进内存（大文件会 OOM）
    try (InputStream in = new FileInputStream(file);
         OutputStream out = resp.getOutputStream()) {
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
    }
}`,
      vars: {
        fileName: {
          label: '下载文件名', value: '用户导出',
          hint: '不要带扩展名以外的特殊字符',
          desc: '文件名里有中文、空格、括号都要编码。带扩展名，否则浏览器不知道用什么打开。'
        }
      },
      docs: {
        secs: [
          { h: 'attachment 和 inline 的区别', ul: [
            'attachment：强制下载，弹保存框',
            'inline：能显示就显示（PDF、图片），不能显示才下载',
            '不写：由浏览器按 Content-Type 猜，行为不可控'
          ] },
          { h: '中文名的两套写法', p: 'filename= 是给老浏览器的，filename*=UTF-8\'\' 是 RFC 5987 的标准写法。两个都写、都放编码后的值，兼容性最好。' },
          { h: '不能直接给文件路径', p: '下载接口如果接受 path 参数，用户传 ../../WEB-INF/web.xml 就能把配置文件下走（任意文件读取）。只接受业务 id，路径由服务端自己拼。' }
        ],
        src: { n: 'MDN · Content-Disposition', u: 'https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Content-Disposition' }
      }
    }
  );

  J.kw = J.kw.concat([
    'page', 'taglib', 'jsp', 'forEach', 'items', 'var', 'varStatus', 'choose', 'when',
    'otherwise', 'out', 'sessionScope', 'requestScope', 'applicationScope', 'param'
  ]);
})(window.__JW);
