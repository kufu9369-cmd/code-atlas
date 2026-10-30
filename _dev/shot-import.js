/* ============================================================
   知识包导入的界面回归
   ------------------------------------------------------------
   不开可见窗口，注入脚本模拟用户操作后截图。
   注意：注入的脚本必须走和真实流程一样的
   normalize() → install() → apply()，
   直接拿原始 JSON 调 apply 是测不到东西的
   （原始 JSON 用的是 categories，apply 吃的是 normalize 之后的 cats）。

   用法：node _dev/shot-import.js
   ============================================================ */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* 默认跑开发目录的源码；设了 CODEATLAS_EXE 就跑打包成品（验证 asar 里是不是新代码） */
const PKG = process.env.CODEATLAS_EXE ? path.resolve(ROOT, process.env.CODEATLAS_EXE) : '';
const EXE = PKG || path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const OUT = path.join(ROOT, '_dev', '_shots');

/* 示例包原文（模拟用户"打开文件复制全文"） */
const EXAMPLE = fs.readFileSync(path.join(ROOT, 'examples', 'ospf-adv.pack.json'), 'utf-8');

/* 撞内置 id：ospf-vlink 在 assets/ensp/20-adv.js 里已经存在 */
const CLASH = JSON.stringify({
  id: 'clash-test', name: '撞车测试',
  categories: [{ id: 'clash-cat', name: 'C', items: [
    { id: 'ospf-vlink', title: '重名片段', desc: 'D', code: 'ls', vars: {} }] }]
});

/* 往 javaweb-servlet 续内容的实验包：没写 topic，靠分类推断专题 */
const LABPACK = {
  id: 'imp-lab-pack', name: '导入实验测试', version: '1.0',
  desc: '验证导入的实验落在 JavaWeb 专题',
  categories: [{ id: 'javaweb-servlet', name: 'Servlet', icon: 'code', short: 'Servlet', ext: 'java',
    items: [{ id: 'imp-snip-1', title: '取请求参数', desc: '导入进来的片段，验证能点开、变量能改',
      tags: ['导入', 'Servlet'], level: '入门',
      code: 'String name = request.getParameter("{{key}}");',
      vars: { key: { label: '参数名', value: 'name', hint: '表单字段名', desc: '要取的请求参数名，写错会拿到 null' } } }] }],
  labs: [{ id: 'imp-lab-topic', title: '导入的实验：会话登录', level: '入门', minutes: 15,
    goal: '验证导入的实验出现在 JavaWeb 专题里，而不是跑到网络工程去',
    scene: '这一条是用来测导入链路的，内容本身很朴素',
    plan: [{ dev: 'Tomcat', intf: '-', ip: 'localhost:8080', note: '本地跑' }],
    vars: { msg: { label: '提示语', value: '登录成功', desc: '返回给浏览器的文案' } },
    steps: [{ title: '写一个 Servlet', note: '取参数并存会话', code: 'resp.getWriter().print("{{msg}}");' }],
    verify: [{ cmd: 'curl localhost:8080/login', hope: '返回 200' }],
    pitfalls: ['忘了 setCharacterEncoding'] }],
  presets: [], flows: []
};

/* 全新分类（不属于任何专题）→ 侧栏应自动多出一个专题 */
const NEWTOPIC = {
  id: 'imp-new-pack', name: '新专题测试', version: '1.0',
  desc: '验证新分类会自动成为一个专题',
  categories: [{ id: 'imp-new-cat', name: 'Docker 常用', icon: 'layers', short: 'Docker', ext: 'sh',
    items: [{ id: 'imp-new-1', title: '清理悬空镜像', desc: '把没被引用的镜像层删掉',
      tags: ['Docker'], level: '入门', code: 'docker image prune -f', vars: {} }] }]
};

/* 在页面里走真实链路：normalize → install → apply */
function installScript(json, after) {
  return 'var n=window.PACKS.normalize(' + JSON.stringify(json) + ');'
    + 'if(!n.pack||n.errors.length){document.body.setAttribute("data-importerr",(n.errors||[]).join(" | "));}'
    + 'else{window.PACKS.install(n.pack);window.PACKS.apply(window.CODEATLAS,n.pack);}'
    + after + ';1';
}

const CASES = [
  /* 1. 粘示例包 → 校验 → 应显示"校验通过" */
  ['imp_check',
    'CodeAtlas.openPacks("import");'
    + 'document.getElementById("packText").value=' + JSON.stringify(EXAMPLE) + ';'
    + 'document.querySelector(\'[data-act="packcheck"]\').click();1'],

  /* 2. 冲突守卫：撞内置 id → 应挡住、不给"确认导入" */
  ['imp_clash',
    'CodeAtlas.openPacks("import");'
    + 'document.getElementById("packText").value=' + JSON.stringify(CLASH) + ';'
    + 'document.querySelector(\'[data-act="packcheck"]\').click();1'],

  /* 3. 语法错误的提示是否中文可读 */
  ['imp_badsyntax',
    'CodeAtlas.openPacks("import");'
    + 'document.getElementById("packText").value=' + JSON.stringify('{ "id": "x", "name": "X", }') + ';'
    + 'document.querySelector(\'[data-act="packcheck"]\').click();1'],

  /* 4. 导入实验 → 应出现在 JavaWeb 专题 */
  ['imp_lab', installScript(JSON.stringify(LABPACK), 'CodeAtlas.gotoLab("imp-lab-topic")')],

  /* 5. 导入新分类 → 侧栏多出第 5 个专题，列表能看到条目
        gotoTopic 没对外暴露，用 gotoView('cat', <分类id>) 等价（会按分类反查专题） */
  ['imp_newtopic', installScript(JSON.stringify(NEWTOPIC), 'CodeAtlas.gotoView("cat","imp-new-cat")')],

  /* 6. 已装页签：两条包记录都在 */
  ['imp_installed',
    'var a=window.PACKS.normalize(' + JSON.stringify(JSON.stringify(LABPACK)) + ');'
    + 'var b=window.PACKS.normalize(' + JSON.stringify(JSON.stringify(NEWTOPIC)) + ');'
    + 'window.PACKS.install(a.pack);window.PACKS.install(b.pack);'
    + 'window.PACKS.apply(window.CODEATLAS,a.pack);'
    + 'CodeAtlas.openPacks("installed");1'],

  /* 7. 导入后的片段能不能点开、变量面板对不对 */
  ['imp_snippet', installScript(JSON.stringify(LABPACK), 'CodeAtlas.gotoSnippet("imp-snip-1")')],

  /* 8. 真实用户路径：粘 JSON → 校验 → 确认导入 → 页面自动刷新。
        这条必须走 doPackInstall()，因为它内部会 location.reload()；
        刷新能不能带着数据回来，是「导入成功」的最终判据。 */
  ['imp_reload',
    'CodeAtlas.openPacks("import");'
    + 'document.getElementById("packText").value=' + JSON.stringify(JSON.stringify(NEWTOPIC)) + ';'
    + 'document.querySelector(\'[data-act="packcheck"]\').click();'
    + 'var btn=document.querySelector(\'[data-act="packinstall"]\');'
    + 'if(btn){btn.click();}else{document.title="NO-BUTTON";}1'],

  /* 9. 工具条：粘贴 / 清空 / 字数（空框时的样子） */
  ['imp_tools', 'CodeAtlas.openPacks("import");1'],

  /* 10. 粘贴按钮：真往系统剪贴板写一段，再点粘贴，断言内容进到了框里。
        桌面版走主进程桥（window.DESKTOP.clip），这是用户实际用的那条路。 */
  ['imp_paste',
    'CodeAtlas.openPacks("import");'
    + 'window.DESKTOP.clip.write(' + JSON.stringify('{"id":"paste-demo","name":"从剪贴板粘进来的包"}') + ').then(function(){'
    + 'document.querySelector(\'[data-act="packpaste"]\').click();'
    + 'return new Promise(function(r){ setTimeout(function(){'
    + 'var t=document.getElementById("packText");'
    + 'var c=document.getElementById("packCount");'
    + 'r("PASTE len="+t.value.length+" has="+(t.value.indexOf("paste-demo")>=0)+" count="+JSON.stringify(c.textContent));'
    + '},900); }); });'],

  /* 11. 清空：塞 30 行进去，点一下清空，断言值和字数都归零 */
  ['imp_clear',
    'CodeAtlas.openPacks("import");'
    + 'var t=document.getElementById("packText");'
    + 't.value=new Array(30).fill("这一行是占位内容，用来验证一键清空").join("\\n");'
    + 't.dispatchEvent(new Event("input"));'
    + 'var before=t.value.length;'
    + 'var cntBefore=document.getElementById("packCount").textContent;'
    + 'document.querySelector(\'[data-act="packclear"]\').click();'
    + '("CLEAR before="+before+" after="+t.value.length+" cntBefore="+JSON.stringify(cntBefore)'
    + '+" cntAfter="+JSON.stringify(document.getElementById("packCount").textContent))']
];

function run(name, js, ud) {
  return new Promise(resolve => {
    const env = {};
    Object.keys(process.env).forEach(k => {
      if (/^(ELECTRON|WORKBUDDY)/i.test(k)) return;
      env[k] = process.env[k];
    });
    env.CODEATLAS_SHOT = path.join(OUT, name + '.png');
    env.CODEATLAS_SHOT_JS = js;
    const p = spawn(EXE, ['.', '--user-data-dir=' + ud], { cwd: ROOT, env, stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill(); } catch (e) {} }, 30000);
    p.on('exit', () => {
      clearTimeout(t);
      const f = env.CODEATLAS_SHOT;
      const ok = fs.existsSync(f);
      console.log((ok ? 'OK  ' : 'FAIL') + ' ' + name + '  '
        + (ok ? Math.round(fs.statSync(f).size / 1024) + ' KB' : ''));
      resolve(ok);
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  /* 每次跑用全新的 userData 目录：干净起点，又不用删旧目录
     （批量删目录会撞 safe-delete 护栏，为这个走回收站不值得）。 */
  const ud = path.join(OUT, '_ud_imp_' + Date.now());
  for (const [n, js] of CASES) await run(n, js, ud);
})();
