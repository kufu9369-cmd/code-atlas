/* ============================================================
   码典 · JavaWeb · JDBC / 数据库（7 条）
   ============================================================ */
(function (J) {
  'use strict';

  J.items.push(
    /* ---------------- 1 ---------------- */
    {
      id: 'jw-jdbc-six',
      cat: 'javaweb-jdbc',
      title: 'JDBC 六步：从加载驱动到关闭资源',
      desc: '标准写法一遍过，用 try-with-resources 保证连接一定关得掉。',
      tags: ['JDBC', '入门', '资源释放'],
      device: 'JDK 8 · MySQL 8.0 驱动',
      level: '入门',
      code: `// ① 加载驱动（JDBC 4.0 起可省略，但老驱动必须有）
Class.forName("com.mysql.cj.jdbc.Driver");

// ② 建连接。useSSL / serverTimezone 不写，MySQL 8 会连不上或时间差 8 小时
String url = "jdbc:mysql://{{host}}:{{port}}/{{dbName}}"
           + "?useUnicode=true&characterEncoding={{charset}}"
           + "&useSSL=false&serverTimezone=Asia/Shanghai";

// ③④⑤⑥ 写在 try-with-resources 里，异常时也会自动关，顺序是反的
try (Connection conn = DriverManager.getConnection(url, "{{user}}", "{{password}}");
     PreparedStatement ps = conn.prepareStatement(
             "select id, username, create_time from t_user where status = ?");
     ResultSet rs = ps.executeQuery()) {

    ps.setInt(1, 1);                       // 参数从 1 开始，不是 0
    List<User> list = new ArrayList<>();
    while (rs.next()) {
        User u = new User();
        u.setId(rs.getLong("id"));
        u.setUsername(rs.getString("username"));
        u.setCreateTime(rs.getTimestamp("create_time"));
        list.add(u);
    }

} catch (SQLException e) {
    // 别吞异常，至少打日志带上 SQL 和参数
    throw new RuntimeException("查询用户失败", e);
}`,
      vars: {
        host: { label: '主机', value: '127.0.0.1', hint: 'IP 或域名', desc: '本机写 127.0.0.1，别写 localhost —— 某些环境会走 IPv6 解析导致连接被拒。' },
        port: { label: '端口', value: '3306', type: 'int', min: 1, max: 65535, hint: '默认 3306', desc: '容器化部署时经常改成 3307、13306，连不上先看端口。' },
        dbName: { label: '库名', value: 'demo', hint: '已存在的库', desc: '库不存在报 Unknown database，不是密码错。' },
        charset: { label: '编码', value: 'UTF-8', hint: 'UTF-8', desc: '和建库时的字符集一致，否则中文存进去变问号。' },
        user: { label: '用户名', value: 'root', hint: '建议专用账号', desc: '生产别用 root，最小权限原则。' },
        password: { label: '密码', value: '123456', hint: '别提交到 Git', desc: '真实密码放配置文件或环境变量，别硬编码。' }
      },
      docs: {
        secs: [
          { h: '六步是哪六步', ul: [
            '加载驱动 Class.forName',
            '获取连接 DriverManager / DataSource',
            '创建 Statement / PreparedStatement',
            '设置参数、执行 SQL',
            '处理结果集 ResultSet',
            '关闭资源（先 rs 再 ps 再 conn）'
          ] },
          { h: '为什么时间总是差 8 小时', p: 'MySQL 8 的驱动默认按 UTC 解释时间，连接串不写 serverTimezone=Asia/Shanghai，取出来的 Date 就少了 8 小时。写 URL 时一起带上，别在代码里手动加。' },
          { h: 'DriverManager 和 DataSource 的区别', p: 'DriverManager 每次 getConnection 都新建物理连接，高并发下开销巨大；DataSource（连接池）复用连接。除了写练习代码，业务里一律用连接池。' }
        ],
        src: { n: 'Oracle JDBC 官方文档', u: 'https://docs.oracle.com/javase/8/docs/api/java/sql/package-summary.html' }
      }
    },

    /* ---------------- 2 ---------------- */
    {
      id: 'jw-prepared',
      cat: 'javaweb-jdbc',
      title: 'PreparedStatement：防注入 + 类型安全',
      desc: '拼接字符串的 SQL 是 SQL 注入的入口，换成占位符一次解决。',
      tags: ['SQL 注入', 'PreparedStatement', '安全'],
      device: 'JDK 8 · 任意 JDBC 驱动',
      level: '入门',
      code: `// ✗ 绝对不要这样写：用户输入 ' or '1'='1 就能登录任何账号
// String sql = "select * from t_user where username='" + name + "' and password='" + pwd + "'";

// ✓ 占位符 + setXxx
String sql = "select id, username, password from t_user "
           + "where username = ? and status = ?";
try (Connection conn = DataSourceUtil.getConnection();
     PreparedStatement ps = conn.prepareStatement(sql)) {

    ps.setString(1, name);       // 值里的引号会被当成数据，不再拼进 SQL
    ps.setInt(2, 1);

    try (ResultSet rs = ps.executeQuery()) {
        if (rs.next()) {
            // 密码比较用哈希，不要明文比
            String stored = rs.getString("password");
            if (PasswordUtil.matches(rawPassword, stored)) {   // BCrypt / PBKDF2
                return toUser(rs);
            }
        }
    }
}

// LIKE 查询：通配符要拼在参数里，不能拼在 SQL 里
ps = conn.prepareStatement("select id from t_user where username like ?");
ps.setString(1, "%" + keyword + "%");

// IN 查询：有几个值就拼几个问号
ps = conn.prepareStatement("select id from t_user where id in (" + marks(ids.size()) + ")");
for (int i = 0; i < ids.size(); i++) ps.setLong(i + 1, ids.get(i));`,
      vars: {},
      docs: {
        secs: [
          { h: '预编译到底防住了什么', p: '占位符的值在 SQL 解析之后才作为数据传入，值里的引号、分号不会被当成语法。所以 or 1=1、drop table 这类都变成了普通字符串。' },
          { h: 'LIKE 和 IN 为什么特殊', p: 'LIKE 的 % 是值的一部分，要放进参数里；IN 的个数是变的，占位符个数也得跟着变。这两处是"看起来用了 PreparedStatement 其实还在拼接"的重灾区。' },
          { h: '排序字段被注入', p: 'order by ? 不合法，字段名没法参数化。只能把前端传的字段名和允许的字符串数组做比对，命中才拼，否则用默认值。' }
        ],
        src: { n: 'MySQL 官方 · SQL 注入防护', u: 'https://dev.mysql.com/doc/refman/8.0/en/security.html' }
      }
    },

    /* ---------------- 3 ---------------- */
    {
      id: 'jw-tx',
      cat: 'javaweb-jdbc',
      title: 'JDBC 事务：要么全成功，要么全回滚',
      desc: '关自动提交、业务全在 try 里、catch 里 rollback，最后一定要恢复。',
      tags: ['事务', '回滚', '一致性'],
      device: 'JDK 8 · InnoDB',
      level: '进阶',
      code: `Connection conn = null;
try {
    conn = DataSourceUtil.getConnection();
    conn.setAutoCommit(false);              // ① 关掉自动提交，事务开始

    // ② 同一批业务必须用同一个 Connection，换连接就不是同一个事务了
    accountDao.minus(conn, fromId, amount);
    accountDao.plus(conn, toId, amount);
    logDao.insert(conn, "转账 " + amount);

    conn.commit();                          // ③ 全成功才提交
} catch (Exception e) {
    if (conn != null) {
        try { conn.rollback(); } catch (SQLException ignore) { }
    }
    throw new RuntimeException("转账失败，已回滚", e);
} finally {
    if (conn != null) {
        try { conn.setAutoCommit(true); } catch (SQLException ignore) { }
        try { conn.close(); } catch (SQLException ignore) { }   // 还回池里
    }
}`,
      vars: {
        fromId: { label: '转出账户', value: '1001', hint: '主键', desc: '扣款方。示例用固定值，实际从请求参数取。' },
        toId: { label: '转入账户', value: '1002', hint: '主键', desc: '入款方。和转出方不能是同一条记录（那等于没转）。' },
        amount: { label: '金额', value: '100.00', hint: '两位小数', desc: '金额用 BigDecimal，不要用 double —— 浮点误差在钱上就是事故。' }
      },
      docs: {
        secs: [
          { h: '三个最常见的坑', ul: [
            '每个 DAO 方法自己 getConnection：两个连接属于两个事务，第一个回滚了第二个照常提交',
            'catch 里吞掉异常不 rollback：连接还回池里时事务状态没清，下一个请求可能带着脏状态',
            '忘了恢复 setAutoCommit(true)：连接回池后仍然是手动提交模式，后续业务永远不提交'
          ] },
          { h: '连接池下的"假事务"', p: '从池里拿到的连接是复用的，如果上一次归还前没 commit/rollback，事务可能一直挂着。所以 commit、rollback、setAutoCommit(true) 三件事必须成对出现，放在 finally 里。' },
          { h: '隔离级别要不要改', p: '默认 REPEATABLE READ 能防脏读和不可重复读。只有遇到"同一事务里两次查结果一样导致超卖"这类问题时，才考虑用 select ... for update 加行锁，而不是盲目改隔离级别。' }
        ],
        src: { n: 'MySQL 官方 · InnoDB 事务模型', u: 'https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-model.html' }
      }
    },

    /* ---------------- 4 ---------------- */
    {
      id: 'jw-druid',
      cat: 'javaweb-jdbc',
      title: 'Druid 连接池：配置文件 + 初始化',
      desc: 'druid.properties 一套参数，Listener 里建一次，全应用共用。',
      tags: ['连接池', 'Druid', '性能'],
      device: 'Druid 1.2.x · JDK 8',
      level: '进阶',
      code: `# ---------- druid.properties ----------
driverClassName=com.mysql.cj.jdbc.Driver
url=jdbc:mysql://{{host}}:3306/{{dbName}}?useUnicode=true&characterEncoding=UTF-8&useSSL=false&serverTimezone=Asia/Shanghai
username={{user}}
password={{password}}

initialSize=5
minIdle=5
maxActive={{maxActive}}
maxWait=3000
validationQuery=select 1
testWhileIdle=true
testOnBorrow=false
testOnReturn=false

# ---------- 初始化（应用启动时执行一次） ----------
Properties p = new Properties();
try (InputStream in = DruidUtil.class.getClassLoader()
        .getResourceAsStream("druid.properties")) {
    p.load(in);
}
DataSource ds = DruidDataSourceFactory.createDataSource(p);

// ---------- 取连接 ----------
try (Connection conn = ds.getConnection()) {
    // 用完 close() 是归还给池，不是真的关闭
}`,
      vars: {
        host: { label: '主机', value: '127.0.0.1', hint: 'IP', desc: '主从架构时这里填 VIP 或代理地址。' },
        dbName: { label: '库名', value: 'demo', hint: '库名', desc: '连接池建好后再换库要重建，别运行时切。' },
        user: { label: '账号', value: 'root', hint: '专用账号', desc: '给连接池单独开一个账号，方便统计慢查询来源。' },
        password: { label: '密码', value: '123456', hint: '别写进代码', desc: '生产用环境变量或配置中心注入。' },
        maxActive: {
          label: '最大连接数', value: '20', type: 'int', min: 1, max: 500,
          hint: '别超过数据库上限',
          desc: '经验值：单库 20–50。算上多台应用实例，总数要小于 MySQL 的 max_connections。'
        }
      },
      docs: {
        secs: [
          { h: '四个必须理解的参数', ul: [
            'initialSize：启动就建这么多，避免第一个请求慢',
            'maxActive：上限，超过就等 maxWait 毫秒，然后抛异常',
            'maxWait：等不到连接时的超时，设太大接口会长时间挂住',
            'validationQuery：拿连接前探活，防止拿到已被数据库断掉的死连接'
          ] },
          { h: '为什么 maxActive 不是越大越好', p: '连接数超过数据库处理能力后，只会增加上下文切换和锁等待，吞吐反而下降。压测时看的是「连接池等待时间」，不是把池子开大。' },
          { h: '连接池泄漏怎么发现', p: 'Druid 自带监控，配 stat-view-servlet 后访问 /druid 就能看活跃连接数。活跃数只涨不落，就是有地方拿了连接没 close。' }
        ],
        src: { n: 'Alibaba Druid 官方 Wiki', u: 'https://github.com/alibaba/druid/wiki' }
      }
    },

    /* ---------------- 5 ---------------- */
    {
      id: 'jw-page',
      cat: 'javaweb-jdbc',
      title: '分页查询：一条 count + 一条 limit',
      desc: '先查总数算总页数，再取当前页数据，顺带处理页码越界。',
      tags: ['分页', 'limit', '列表页'],
      device: 'MySQL 5.7/8.0 · JDK 8',
      level: '进阶',
      code: `public PageResult<User> page(int pageNo, int pageSize) {
    if (pageNo < 1) pageNo = 1;

    // ① 总数：用来算总页数，也用来判断是否越界
    int total = 0;
    try (Connection conn = ds.getConnection();
         PreparedStatement ps = conn.prepareStatement("select count(*) from t_user where status = ?")) {
        ps.setInt(1, 1);
        try (ResultSet rs = ps.executeQuery()) {
            if (rs.next()) total = rs.getInt(1);
        }
    }

    int pages = (total + pageSize - 1) / pageSize;      // 向上取整
    if (pages > 0 && pageNo > pages) pageNo = pages;    // 越界回到最后一页

    // ② 明细：limit 的偏移量 = (页码 - 1) * 每页条数
    List<User> list = new ArrayList<>();
    String sql = "select id, username, create_time from t_user where status = ? "
               + "order by id desc limit ?, ?";
    try (Connection conn = ds.getConnection();
         PreparedStatement ps = conn.prepareStatement(sql)) {
        ps.setInt(1, 1);
        ps.setInt(2, (pageNo - 1) * pageSize);
        ps.setInt(3, pageSize);
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(toUser(rs));
        }
    }

    return new PageResult<>(list, total, pageNo, pageSize, pages);
}`,
      vars: {
        pageSize: {
          label: '每页条数', value: '10', type: 'int', min: 1, max: 200,
          hint: '10 / 20 / 50',
          desc: '固定值比让用户随便填更好：limit 100000 这种请求会直接拖垮数据库。'
        }
      },
      docs: {
        secs: [
          { h: '深分页为什么会慢', p: 'limit 100000, 10 需要先扫过前 10 万行再丢掉。数据量大时改成「记住上一页最后一条的 id，where id > ? order by id limit 10」，也就是游标分页。' },
          { h: '总数要不要每次都查', p: 'count(*) 在大表上很贵。常见做法：只查第一页时取总数并缓存，翻页只取明细；或者前端只做「下一页」不给总页数。' },
          { h: '页码参数必须校验', p: '用户可以把 page 改成 -1、999999 或 abc。负数会抛异常，超大页码返回空列表看起来像 bug。统一在入口处归一化。' }
        ],
        src: { n: 'MySQL 官方 · SELECT 优化', u: 'https://dev.mysql.com/doc/refman/8.0/en/select-optimization.html' }
      }
    },

    /* ---------------- 6 ---------------- */
    {
      id: 'jw-batch',
      cat: 'javaweb-jdbc',
      title: '批量插入：一千条从 30 秒降到 1 秒',
      desc: 'addBatch + executeBatch，同时记得关掉自动提交。',
      tags: ['批处理', '性能', '导入'],
      device: 'MySQL 8.0 · JDK 8',
      level: '进阶',
      code: `String sql = "insert into t_user (username, password, create_time) values (?, ?, now())";
Connection conn = ds.getConnection();
try {
    conn.setAutoCommit(false);                       // ① 批量操作必须关自动提交

    try (PreparedStatement ps = conn.prepareStatement(sql)) {
        int i = 0;
        for (User u : users) {
            ps.setString(1, u.getUsername());
            ps.setString(2, u.getPassword());
            ps.addBatch();                           // ② 只是攒着，还没发

            if (++i % {{batchSize}} == 0) {
                ps.executeBatch();                   // ③ 攒够一批发一次
                ps.clearBatch();
            }
        }
        ps.executeBatch();                           // ④ 发剩下的
    }
    conn.commit();
} catch (Exception e) {
    conn.rollback();
    throw new RuntimeException("批量导入失败", e);
} finally {
    conn.setAutoCommit(true);
    conn.close();
}

// MySQL 连接串再加 rewriteBatchedStatements=true，
// 驱动会把多条 insert 合成一条 insert ... values (...),(...)，快一个数量级`,
      vars: {
        batchSize: {
          label: '每批条数', value: '500', type: 'int', min: 10, max: 5000,
          hint: '500–1000',
          desc: '一次攒太多会占满驱动内存，也容易触发 max_allowed_packet；太少则网络往返次数多。'
        }
      },
      docs: {
        secs: [
          { h: 'addBatch 为什么没变快', p: '不关自动提交、连接串不加 rewriteBatchedStatements，驱动其实是循环发单条 insert，只是换了个 API 写法，性能提升很有限。两个条件都要满足。' },
          { h: 'max_allowed_packet 报错', p: '一批数据太大超过 MySQL 的单包上限就会报 PacketTooBigException。把 batchSize 调小，或让 DBA 调大 max_allowed_packet。' },
          { h: '批量里有一条失败怎么办', p: 'executeBatch 抛 BatchUpdateException，同一批里已经成功的语句不会自动回滚，必须整个事务 rollback。所以批量写永远配事务。' }
        ],
        src: { n: 'MySQL 官方 · 批量加载优化', u: 'https://dev.mysql.com/doc/refman/8.0/en/optimizing-innodb-bulk-data-loading.html' }
      }
    },

    /* ---------------- 7 ---------------- */
    {
      id: 'jw-generated-key',
      cat: 'javaweb-jdbc',
      title: '插入后拿自增主键',
      desc: '主从表一起写时，子表需要刚插入的父表 id，用 RETURN_GENERATED_KEYS 取。',
      tags: ['主键', '自增', '主从表'],
      device: 'MySQL 8.0 · JDK 8',
      level: '进阶',
      code: `String sql = "insert into t_order (order_no, amount, create_time) values (?, ?, now())";
long orderId;

try (Connection conn = ds.getConnection();
     PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {

    ps.setString(1, orderNo);
    ps.setBigDecimal(2, amount);
    ps.executeUpdate();

    try (ResultSet keys = ps.getGeneratedKeys()) {
        if (keys.next()) orderId = keys.getLong(1);
        else throw new RuntimeException("没拿到主键，检查表是不是自增");
    }
}

// 拿到 orderId 再写明细，一个事务里完成
insertItems(orderId, items);`,
      vars: {},
      docs: {
        secs: [
          { h: '为什么不用 select last_insert_id()', p: '它依赖当前连接，换一个连接就查不到；高并发下更容易串号。getGeneratedKeys 绑定在这一次执行上，才是正确做法。' },
          { h: '批量插入能不能拿主键', p: '可以，executeBatch 之后 getGeneratedKeys 返回多行，但只有部分驱动（MySQL 支持）完整实现。要逐条对应时，建议还是一条条插。' },
          { h: '主键不是自增的情况', p: 'UUID、雪花 ID 是应用侧生成的，插入前就知道，不需要回查。只有数据库自增或序列才需要 RETURN_GENERATED_KEYS。' }
        ],
        src: { n: 'Oracle JDBC · 获取自动生成的主键', u: 'https://docs.oracle.com/javase/8/docs/api/java/sql/Statement.html' }
      }
    }
  );

  J.kw = J.kw.concat([
    'Connection', 'PreparedStatement', 'ResultSet', 'Statement', 'SQLException',
    'DriverManager', 'DataSource', 'commit', 'rollback', 'setAutoCommit',
    'addBatch', 'executeBatch', 'executeQuery', 'executeUpdate', 'prepareStatement'
  ]);
})(window.__JW);
