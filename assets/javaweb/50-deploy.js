/* ============================================================
   码典 · JavaWeb · 构建 / 部署（5 条）
   ============================================================ */
(function (J) {
  'use strict';

  J.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'jw-maven-war',
      cat: 'javaweb-deploy',
      title: 'Maven 打 war 包：pom 最小可用配置',
      desc: '打包方式写 war，finalName 决定访问路径，依赖用 provided 别打进包里。',
      tags: ['Maven', 'war', '打包'],
      device: 'Maven 3.6+ · JDK 8',
      level: '入门',
      code: `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.demo</groupId>
  <artifactId>{{artifactId}}</artifactId>
  <version>1.0.0</version>
  <packaging>war</packaging>       <!-- 关键：不打这个标签默认是 jar -->

  <properties>
    <maven.compiler.source>1.8</maven.compiler.source>
    <maven.compiler.target>1.8</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>

  <dependencies>
    <!-- servlet-api 由 Tomcat 提供，必须 provided，否则运行时类冲突 -->
    <dependency>
      <groupId>javax.servlet</groupId>
      <artifactId>javax.servlet-api</artifactId>
      <version>3.1.0</version>
      <scope>provided</scope>
    </dependency>
  </dependencies>

  <build>
    <finalName>{{finalName}}</finalName>   <!-- 访问路径就是 /finalName -->
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-war-plugin</artifactId>
        <version>3.3.2</version>
      </plugin>
    </plugins>
  </build>
</project>

<!-- 打包：mvn clean package -DskipTests -->`,
      vars: {
        artifactId: { label: 'artifactId', value: 'demo-web', hint: '小写中划线', desc: '产物默认叫 demo-web-1.0.0.war，改了 finalName 可以固定名字。' },
        finalName: { label: 'war 文件名', value: 'demo', hint: '不要含中文和空格', desc: 'Tomcat 用文件名当 context path，叫 demo.war 就访问 /demo。' }
      },
      docs: {
        secs: [
          { h: 'provided 是什么意思', p: '编译时需要，打包时不放进 WEB-INF/lib，运行时由容器提供。servlet-api、jsp-api 必须 provided，否则 Tomcat 启动会因为类加载冲突报 ClassCastException 或 NoSuchMethodError。' },
          { h: 'war 里到底有什么', ul: [
            'WEB-INF/classes：编译后的 class 和 resources 下的配置文件',
            'WEB-INF/lib：第三方 jar',
            'WEB-INF/web.xml：部署描述符',
            '页面文件（JSP/HTML）在根目录，能被浏览器直接访问'
          ] },
          { h: '中文编译乱码', p: 'sourceEncoding 和编译器 encoding 都要设 UTF-8。只设一个时，代码里的中文字符串会变成乱码进 class 文件，运行时才暴露，排查很费时。' }
        ],
        src: { n: 'Apache Maven War Plugin', u: 'https://maven.apache.org/plugins/maven-war-plugin/' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'jw-tomcat',
      cat: 'javaweb-deploy',
      title: 'Tomcat 部署：三种方式与端口改法',
      desc: 'war 丢 webapps 是最快的；context.xml 适合改路径；端口和编码在 Connector 上。',
      tags: ['Tomcat', '部署', '端口'],
      device: 'Tomcat 8.5 / 9.0',
      level: '入门',
      code: `# ---------- 方式一：丢 war（最省事，会自动解压） ----------
cp target/demo.war $CATALINA_HOME/webapps/
# 启动后访问 http://localhost:8080/demo/
# 想直接 / 访问：把 war 改名 ROOT.war，先删掉原来的 ROOT 目录

# ---------- 方式二：指定外部目录（不改 war） ----------
# conf/Catalina/localhost/demo.xml
<Context docBase="{{docBase}}" reloadable="false" />

# ---------- 方式三：IDE 里配 Artifact，只在开发用 ----------

# ---------- 端口 / 编码：conf/server.xml ----------
<Connector port="{{port}}" protocol="HTTP/1.1"
           connectionTimeout="20000"
           URIEncoding="UTF-8"
           redirectPort="8443" />

# ---------- 启动 / 停止 ----------
bin/startup.sh        # Windows: bin\\startup.bat
bin/shutdown.sh
tail -f logs/catalina.out      # Windows 看 logs\\catalina.YYYY-MM-DD.log

# ---------- 内存不够（默认给得很少） ----------
# bin/setenv.sh（Windows 是 setenv.bat）
export CATALINA_OPTS="-Xms512m -Xmx1024m"`,
      vars: {
        docBase: { label: '应用目录', value: 'D:/apps/demo', hint: '绝对路径', desc: 'war 解压后的目录，或源码里的 webapp 目录。Windows 路径用正斜杠或双反斜杠。' },
        port: { label: 'HTTP 端口', value: '8080', type: 'int', min: 1, max: 65535, hint: '80 / 8080', desc: '改完要重启。端口被占用换一个，或者改用 Nginx 反代到 8080。' }
      },
      docs: {
        secs: [
          { h: '部署后 404 怎么查', ul: [
            '看 logs/catalina 日志有没有 Deployment of web application archive 失败',
            '访问 /demo/ 而不是 /demo（少了斜杠会 302 再 404）',
            'war 名和 context path 不一致：demo-1.0.0.war 的路径是 /demo-1.0.0',
            'web.xml 里 url-pattern 写错了，日志不会有任何提示'
          ] },
          { h: '热部署能关就关', p: 'reloadable="true" 会一直扫描 class 变化，CPU 占用明显，而且改了 JSP 之外的东西经常热不起来。开发用 IDE 部署，生产保持 false。' },
          { h: 'Tomcat 9 还在用 javax', p: 'Tomcat 10 起包名从 javax.servlet 换成 jakarta.servlet，所有 import 都要改。老项目别升 10，除非真的想重构一遍。' }
        ],
        src: { n: 'Apache Tomcat 9 官方文档', u: 'https://tomcat.apache.org/tomcat-9.0-doc/' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'jw-log',
      cat: 'javaweb-deploy',
      title: '日志：slf4j + logback 一份配置',
      desc: '代码里只用 slf4j 门面，logback.xml 控制级别、文件滚动和格式。',
      tags: ['日志', 'logback', 'slf4j'],
      device: 'slf4j 1.7 · logback 1.2',
      level: '进阶',
      code: `<!-- ---------- src/main/resources/logback.xml ---------- -->
<configuration>
  <property name="LOG_DIR" value="\${catalina.base}/logs/demo"/>

  <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <file>\${LOG_DIR}/app.log</file>
    <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
      <fileNamePattern>\${LOG_DIR}/app.%d{yyyy-MM-dd}.log</fileNamePattern>
      <maxHistory>{{maxHistory}}</maxHistory>          <!-- 保留天数 -->
    </rollingPolicy>
    <encoder>
      <pattern>%d{HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n</pattern>
      <charset>UTF-8</charset>
    </encoder>
  </appender>

  <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
    <encoder><pattern>%d{HH:mm:ss} %highlight(%-5level) %msg%n</pattern></encoder>
  </appender>

  <logger name="com.demo.dao" level="{{daoLevel}}"/>   <!-- 只开 DAO 的 SQL -->
  <root level="INFO">
    <appender-ref ref="FILE"/>
    <appender-ref ref="CONSOLE"/>
  </root>
</configuration>

// ---------- 代码里 ----------
private static final Logger log = LoggerFactory.getLogger(UserServlet.class);
log.info("查询用户 kw={}", keyword);      // 用占位符，别用字符串拼接
log.error("保存失败 id={}", id, e);        // 最后一个参数是异常，会打出完整堆栈`,
      vars: {
        maxHistory: { label: '保留天数', value: '30', type: 'int', min: 1, max: 365, hint: '天', desc: '磁盘有限就别留太多。日志文件按天滚动，老文件自动删。' },
        daoLevel: { label: 'DAO 日志级别', value: 'DEBUG', hint: 'DEBUG 才输出 SQL', desc: 'MyBatis / 手写 DAO 打 SQL 都在 DEBUG 级别，平时关掉免得日志爆炸。' }
      },
      docs: {
        secs: [
          { h: '为什么用 {} 占位符', p: 'log.info("id=" + id) 无论级别开不开都会执行字符串拼接，循环里就是性能黑洞。{} 只在真正输出时才替换，还能避免日志注入。' },
          { h: '日志写在应用目录里会被删', p: '部署在 webapps 下的应用，重新发布 war 时目录会被整体替换，日志跟着没了。生产用 ${catalina.base}/logs 或外部目录。' },
          { h: '依赖冲突导致日志不输出', p: 'classpath 里同时有 log4j、logback、slf4j-simple 时，绑定会随机选一个。用 mvn dependency:tree 查 slf4j 的多个实现，只留一个。' }
        ],
        src: { n: 'Logback 官方手册', u: 'https://logback.qos.ch/manual/' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'jw-errorpage',
      cat: 'javaweb-deploy',
      title: '错误页：404 和 500 都不吐堆栈给用户',
      desc: '按状态码和异常类型分别配错误页，异常信息只进日志。',
      tags: ['错误页', '异常', '安全'],
      device: 'Tomcat 9 · Servlet 3.1+',
      level: '进阶',
      code: `<!-- ---------- web.xml：按状态码 ---------- -->
<error-page>
  <error-code>404</error-code>
  <location>/WEB-INF/jsp/error/404.jsp</location>
</error-page>
<error-page>
  <error-code>500</error-code>
  <location>/WEB-INF/jsp/error/500.jsp</location>
</error-page>

<!-- 按异常类型（比状态码更精准） -->
<error-page>
  <exception-type>java.lang.Throwable</exception-type>
  <location>/WEB-INF/jsp/error/500.jsp</location>
</error-page>

<%-- ---------- 500.jsp：isErrorPage="true" 才能拿到 exception ---------- --%>
<%@ page contentType="text/html;charset=UTF-8" isErrorPage="true" %>
<%
    // 堆栈只写日志，页面只给用户一句人话
    if (exception != null) {
        org.slf4j.LoggerFactory.getLogger("error").error("页面异常", exception);
    }
    response.setStatus(500);
%>
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>出错了</title></head>
<body>
  <h1>页面出了点问题</h1>
  <p>请稍后重试，或联系管理员。错误编号：<%= request.getAttribute("javax.servlet.error.request_uri") %></p>
</body></html>`,
      vars: {},
      docs: {
        secs: [
          { h: '为什么错误页放在 WEB-INF 下', p: '用户直接访问 /WEB-INF/jsp/error/500.jsp 是 404，只有容器内部转发才能进来。放外面会被当成普通页面访问，反而暴露更多信息。' },
          { h: '异常页一定要设 isErrorPage', p: '不写 isErrorPage="true"，内置对象 exception 就是 null，取堆栈会 NPE，错误页自己又报错，用户看到的是 Tomcat 默认的堆栈页。' },
          { h: '别把堆栈响应给浏览器', p: '堆栈里含类名、SQL、文件路径，是最常见的信息泄露。生产环境必须关掉错误页的异常输出，同时确认 Tomcat 的showServerInfo 之类信息不暴露。' }
        ],
        src: { n: 'Jakarta Servlet 规范 · 错误处理', u: 'https://jakarta.ee/specifications/servlet/6.0/' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'jw-https',
      cat: 'javaweb-deploy',
      title: 'Tomcat 开 HTTPS：生成证书并配 Connector',
      desc: 'keytool 自签证书本地够用，配 8443 端口，再把 8080 请求转过去。',
      tags: ['HTTPS', '证书', '安全'],
      device: 'Tomcat 9 · JDK 8 keytool',
      level: '综合',
      code: `# ---------- ① 生成 keystore（自签，内网测试用） ----------
keytool -genkeypair -alias tomcat -keyalg RSA -keysize 2048 \\
        -storetype PKCS12 -keystore {{keystore}} -validity 3650 \\
        -dname "CN=localhost, OU=dev, O=demo, L=SH, C=CN" \\
        -storepass {{storePass}}

# ---------- ② conf/server.xml ----------
<Connector port="8443" protocol="org.apache.coyote.http11.Http11NioProtocol"
           maxThreads="200" SSLEnabled="true">
  <SSLHostConfig>
    <Certificate certificateKeystoreFile="{{keystore}}"
                 certificateKeystorePassword="{{storePass}}"
                 type="RSA" />
  </SSLHostConfig>
</Connector>

# ---------- ③ 8080 自动跳 8443（conf/web.xml 末尾） ----------
<security-constraint>
  <web-resource-collection>
    <web-resource-name>all</web-resource-name>
    <url-pattern>/*</url-pattern>
  </web-resource-collection>
  <user-data-constraint>
    <transport-guarantee>CONFIDENTIAL</transport-guarantee>
  </user-data-constraint>
</security-constraint>`,
      vars: {
        keystore: { label: 'keystore 路径', value: 'D:/tomcat/conf/tomcat.p12', hint: '别放在 webapps 里', desc: '证书文件放应用目录里会被发布覆盖；生产环境权限要收紧。' },
        storePass: { label: 'keystore 密码', value: 'changeit', hint: '别用默认值', desc: '容器密码明文写在 server.xml 里，注意文件权限；生产建议用正式的 PFX 证书。' }
      },
      docs: {
        secs: [
          { h: '正式证书怎么配', p: '把 CA 签发的 PFX/JKS 放进 conf，Certificate 里配 certificateKeystoreFile 和密码即可；用 PEM 时改成 certificateFile + certificateKeyFile 两个属性。' },
          { h: '前端还在报混合内容', p: '页面走 HTTPS 了，但里面的图片、js、接口还是 http://，浏览器会拦。要么改相对协议 //host/x，要么全站改 https。' },
          { h: '内网真的需要 HTTPS 吗', p: '需要。密码和 Cookie 在 HTTP 下是明文传输的，同网段抓包就能拿到。至少给登录接口加 HTTPS。' }
        ],
        src: { n: 'Apache Tomcat 9 · SSL/TLS 配置', u: 'https://tomcat.apache.org/tomcat-9.0-doc/ssl-howto.html' }
      }
    }
  );

  J.kw = J.kw.concat([
    'Tomcat', 'Connector', 'port', 'protocol', 'keystore', 'SSLEnabled', 'war',
    'maven', 'package', 'webapps', 'server', 'xml', 'context', 'logback', 'slf4j'
  ]);
})(window.__JW);
