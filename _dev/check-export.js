/* ============================================================
   导出配置（.cfg）回归
   ------------------------------------------------------------
   导出的东西是给设备看的，错了就是一堆报错，所以断言分三层：
   1. 纯逻辑：扩展名、文件名、换行与空行整形
   2. 模式差异：粘贴模式保留 system-view，文件模式去掉
      —— 差这一行，一个能粘、一个能加载，反过来两边都报错
   3. 真实内容：拿真的任务预设跑一遍，断言按设备切开、
      变量替换生效、不混进别的设备、不带「自主」角标

   用法：node _dev/check-export.js
   ============================================================ */
'use strict';

global.window = {};
global.localStorage = {
  _v: {},
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._v, k) ? this._v[k] : null; },
  setItem: function (k, v) { this._v[k] = String(v); }
};
require('../assets/data.js');
require('../assets/topics.js');
['00-base', '10-basic', '20-adv', '30-pro', '40-labs', '50-presets-flows',
  '60-cmd', '70-cmd-query', '80-recipes', '82-recipes-route', '84-recipes-sec',
  '86-recipes-vrp', '99-merge'
].forEach(function (f) { require('../assets/ensp/' + f + '.js'); });
require('../assets/exportcfg.js');

const CFG = window.CFG;
const D = window.CODEATLAS;

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++;
    fails.push(name + (extra ? '  → ' + extra : ''));
    console.log('  FAIL  ' + name + (extra ? '  → ' + extra : ''));
  }
}

console.log('\n=== 扩展名与文件名 ===');
ok('eNSP 导出 .cfg', CFG.extOf('ensp') === 'cfg');
ok('MySQL 导出 .sql', CFG.extOf('mysql') === 'sql');
ok('Python 导出 .py', CFG.extOf('python') === 'py');
ok('Linux / Git 导出 .sh', CFG.extOf('linux') === 'sh' && CFG.extOf('git') === 'sh');
ok('未知分类不瞎猜，落回 .txt', CFG.extOf('javaweb') === 'txt');
ok('中文标题原样保留',
  CFG.fileName('小型办公网三层互通', 'SW1', 'ensp') === '小型办公网三层互通-SW1.cfg',
  CFG.fileName('小型办公网三层互通', 'SW1', 'ensp'));
ok('Windows 不接受的字符被换掉',
  CFG.fileName('a/b:c*d?e"f<g>h|i', '', 'ensp') === 'a b c d e f g h i.cfg',
  CFG.fileName('a/b:c*d?e"f<g>h|i', '', 'ensp'));
ok('没有 who 就不拼后缀', CFG.fileName('办公网', '', 'ensp') === '办公网.cfg');
ok('空标题有兜底', CFG.fileName('', '', 'ensp') === 'codeatlas.cfg');
ok('超长标题被截断', CFG.fileName('长'.repeat(80), '', 'ensp').length <= 48 + 4);

console.log('\n=== 内容整形 ===');
ok('CRLF 归一成 LF', CFG.shape('a\r\nb\r\n', { cat: 'ensp' }) === 'a\nb\n');
ok('连续空行压成一行',
  CFG.shape('a\n\n\n\nb\n', { cat: 'ensp' }) === 'a\n\nb\n',
  JSON.stringify(CFG.shape('a\n\n\n\nb\n', { cat: 'ensp' })));
ok('首尾空行去掉', CFG.shape('\n\n a \n\n', { cat: 'ensp' }) === ' a\n', JSON.stringify(CFG.shape('\n\n a \n\n', { cat: 'ensp' })));
ok('行尾空白去掉', CFG.shape('a   \nb\t\n', { cat: 'ensp' }) === 'a\nb\n');
ok('末尾有且只有一个换行', /[^\n]\n$/.test(CFG.shape('a\nb\n\n\n', { cat: 'ensp' })));
ok('空内容返回空串', CFG.shape('', { cat: 'ensp' }) === '' && CFG.shape('\n\n', { cat: 'ensp' }) === '');

console.log('\n=== 粘贴模式 vs 文件模式 ===');
const SAMPLE = 'system-view\nsysname SW1\nvlan batch 10\n';
ok('粘贴模式保留 system-view', CFG.shape(SAMPLE, { mode: 'paste', cat: 'ensp' }).indexOf('system-view') === 0);
ok('文件模式去掉 system-view', CFG.shape(SAMPLE, { mode: 'file', cat: 'ensp' }).indexOf('system-view') < 0,
  JSON.stringify(CFG.shape(SAMPLE, { mode: 'file', cat: 'ensp' })));
ok('缩写 sys 也认', CFG.shape('sys\nsysname R1\n', { mode: 'file', cat: 'ensp' }) === 'sysname R1\n');
ok('只删独占一行的，不误伤 sysname',
  CFG.shape('sysname SW1\n', { mode: 'file', cat: 'ensp' }) === 'sysname SW1\n');
ok('非 eNSP 内容不做这层处理',
  CFG.shape('system-view\n', { mode: 'file', cat: 'python' }) === 'system-view\n');

console.log('\n=== build：真实任务按设备切 ===');
const P = D.presets.find(function (x) { return x.id === 'preset-l3-office'; });
ok('任务预设存在', !!P && !!P.task);

/* 模拟 app.js 的取值：把 {{var}} 换成 localStorage 或默认值 */
const vals = { vlanId: '30' };
function plainFor(p, code) {
  return String(code).replace(/\{\{([A-Za-z0-9_]+)\}\}/g, function (_, n) {
    if (n in vals) return vals[n];
    const def = (p.task.env || {})[n];
    return def ? def.value : '';
  });
}

const sw1 = CFG.build({
  title: P.title, cat: 'ensp', who: 'SW1', mode: 'file',
  steps: P.task.steps,
  plain: function (code) { return plainFor(P, code); }
});
ok('文件名带上设备', /-SW1\.cfg$/.test(sw1.name), sw1.name);
ok('SW1 的内容不含 system-view', sw1.text.indexOf('system-view') < 0);
ok('SW1 的内容不含 AR1 的命令', sw1.text.indexOf('sysname AR1') < 0);
ok('SW1 自己的命令在', /sysname SW1/.test(sw1.text));
ok('改过的参数生效（vlan 30）', /vlan 30|vlan batch 30/.test(sw1.text), sw1.text.slice(0, 80));
ok('没有漏替换的 {{ }}', sw1.text.indexOf('{{') < 0);
ok('不带「自主」角标', sw1.text.indexOf('自主') < 0);
ok('文件末尾有换行', /\n$/.test(sw1.text));

const all = CFG.build({
  title: P.title, cat: 'ensp', mode: 'paste',
  steps: P.task.steps,
  plain: function (code) { return plainFor(P, code); }
});
ok('不给 who 就是整份', /sysname SW1/.test(all.text) && /sysname AR1/.test(all.text));
ok('粘贴模式保留 system-view', all.text.indexOf('system-view') >= 0);
ok('没有 who 的文件名不加后缀', /^.+\.cfg$/.test(all.name) && all.name.indexOf('-SW1') < 0, all.name);

console.log('\n=== build：普通预设 / 实验 / 片段 ===');
const pre = D.presets.find(function (x) { return !x.task && D.categories.every(function (c) {
  return !c.items.some(function (i) { return i.id === x.steps[0].ref; });
}) === false; });
ok('至少有一个非任务预设', !!pre, '（找不到就跳过下面两条）');

const lab = D.labs[0];
const labOut = CFG.build({
  title: lab.title, cat: 'ensp', mode: 'file',
  steps: lab.steps || [],
  plain: function (code) {
    return String(code).replace(/\{\{([A-Za-z0-9_]+)\}\}/g, function (_, n) {
      const d = (lab.vars || {})[n];
      return d ? d.value : '';
    });
  }
});
ok('实验导出不是空的', labOut.text.length > 20, labOut.name);
ok('实验导出不带 {{ }}', labOut.text.indexOf('{{') < 0);
ok('实验文件名是 .cfg', /\.cfg$/.test(labOut.name), labOut.name);

const r = (D.recipes || [])[0];
if (r) {
  /* 剧本的字段叫 c（command），不是 code；who 只有部分步骤有 */
  const steps = r.steps.map(function (s) { return { code: s.c, who: s.who }; });
  const who0 = (r.steps[0] || {}).who;
  const recOut = CFG.build({
    title: r.title, cat: 'ensp', mode: 'file', who: who0,
    steps: steps,
    plain: function (code) { return code; }
  });
  ok('剧本能导出', recOut.text.length > 30, recOut.name + ' / ' + recOut.text.length);
  ok('剧本导出不带 {{ }}', recOut.text.indexOf('{{') < 0);
  ok('剧本导出不带 system-view', recOut.text.indexOf('system-view') < 0);
  if (who0) {
    const others = r.steps.map(function (s) { return s.who; })
      .filter(function (w) { return w && w !== who0; });
    if (others.length) {
      ok('剧本按设备切开，不混别人的命令',
        new RegExp('sysname ' + others[0]).test(recOut.text) === false,
        '排除 ' + others[0]);
    }
  }
}

console.log('\n=== 汇总 ===');
console.log('通过 ' + pass + ' / 失败 ' + fail);
if (fail) {
  console.log('\n失败项：');
  fails.forEach(function (f) { console.log('  - ' + f); });
  process.exitCode = 1;
}
