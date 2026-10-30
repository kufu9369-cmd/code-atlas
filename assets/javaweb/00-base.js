/* ============================================================
   码典 · JavaWeb 专题（分片收集器）
   ------------------------------------------------------------
   和 eNSP 一样按主题拆片，最后由 99-merge.js 一次性合并：

     10-servlet.js  请求响应 / 转发重定向 / Session / Cookie / Filter
     20-jsp.js      JSP、EL+JSTL、表单回填、上传下载
     30-jdbc.js     连接、防注入、事务、连接池、分页、批处理
     40-mvc.js      三层结构、BaseServlet、JSON 响应、跨域
     50-deploy.js   Maven 打包、Tomcat 部署、日志、错误页、HTTPS
     60-labs.js     实训（没有拓扑，验证改成「打开什么、看到什么」）
     70-presets-flows.js  整套代码 + 排错工作流
     80-cmd.js      命令 / API 词条（服务搜索，不进高亮）

   合并规则见 assets/topics.js：分类不存在就建，片段按 id 去重，
   重复执行结果不变。
   ============================================================ */
window.__JW = window.__JW || {
  topic: 'javaweb',
  cats: [
    {
      id: 'javaweb-servlet', name: 'Servlet / 会话',
      sub: '请求响应、转发重定向、Session、Cookie、Filter',
      icon: 'code', short: 'Servlet', ext: 'java'
    },
    {
      id: 'javaweb-jsp', name: 'JSP / 视图',
      sub: '老项目维护必备：JSP 指令、EL+JSTL、上传下载',
      icon: 'layers', short: 'JSP', ext: 'jsp'
    },
    {
      id: 'javaweb-jdbc', name: 'JDBC / 数据库',
      sub: '连接、防注入、事务、连接池、分页、批处理',
      icon: 'db', short: 'JDBC', ext: 'java'
    },
    {
      id: 'javaweb-mvc', name: 'MVC / 接口',
      sub: '三层结构、统一响应、JSON、CORS',
      icon: 'branch', short: 'MVC', ext: 'java'
    },
    {
      id: 'javaweb-deploy', name: '构建 / 部署',
      sub: 'Maven war、Tomcat、日志、错误页、HTTPS',
      icon: 'pack', short: '部署', ext: 'xml'
    }
  ],
  items: [],
  labs: [],
  presets: [],
  flows: [],
  cmd: {},
  cmdSrc: {},
  kw: []
};
