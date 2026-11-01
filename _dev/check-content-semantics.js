/* 内容语义回归：结构检查抓不到的“命令能敲、结果不对”。
   这些用例对应真实踩过的坑：ACL 协议、WLAN DHCP、BGP 下一跳、
   MPLS CE、IPv6 双栈、静态路由掩码、Python 默认值、任务参数一致性。
   用法：node _dev/check-content-semantics.js */
'use strict';

global.window = {};
global.localStorage = { getItem: function () { return null; }, setItem: function () {} };
require('../assets/data.js');
['00-base', '10-basic', '20-adv', '30-pro', '40-labs', '50-presets-flows',
  '60-cmd', '70-cmd-query', '80-recipes', '82-recipes-route', '84-recipes-sec', '99-merge'
].forEach(function (f) { require('../assets/ensp/' + f + '.js'); });

const D = window.CODEATLAS;
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; fails.push(name + (detail ? ' → ' + detail : '')); console.log('  FAIL  ' + name + (detail ? ' → ' + detail : '')); }
}
function lab(id) { return (D.labs || []).find(function (l) { return l.id === id; }); }
function codeOf(x) { return (x.steps || []).map(function (s) { return s.code || ''; }).join('\n'); }
function allCode(x) { return codeOf(x) + '\n' + (x.verify || []).map(function (v) { return v.cmd + ' ' + (v.hope || ''); }).join('\n'); }

console.log('\n=== ACL：验证流量必须命中放行规则 ===');
{
  const l = lab('lab-acl-control');
  const text = allCode(l);
  ok('门户验证改为 HTTP，而不是被 deny 的 ICMP', /浏览器访问[\s\S]*192\.168\.30\.10[\s\S]*能打开/.test(text));
  ok('明确说明 ping 门户不通', /PC2 ping 192\.168\.30\.10[\s\S]*不通/.test(text));
}

console.log('\n=== WLAN：隧道转发的业务 DHCP 在 AC ===');
{
  const l = lab('lab-wlan-basic');
  const c = codeOf(l);
  ok('AC 建了业务 VLANIF 并启用接口地址池', /interface Vlanif\{\{svcVlan\}\}[\s\S]*ip address 192\.168\.200\.254[\s\S]*dhcp select interface/.test(c));
  ok('验证终端网关可达', /PC1 ping 192\.168\.200\.254/.test(allCode(l)));
}

console.log('\n=== BGP / MPLS / IPv6 ===');
{
  const bgp = codeOf(lab('lab-bgp-ebgp'));
  ok('RR 给 iBGP 对等体配置 next-hop-local', /peer 10\.0\.2\.2 next-hop-local/.test(bgp));

  const mpls = lab('lab-mpls-vpn');
  const mc = codeOf(mpls);
  ok('MPLS 有 CE1 与 CE2 的完整步骤', /sysname CE1/.test(mc) && /sysname CE2/.test(mc));
  ok('MPLS 两站点使用不同业务网段', /192\.168\.1\.0/.test(mc) && /192\.168\.2\.0/.test(mc) && !/192\.168\.1\.2\b/.test(mc));
  ok('MPLS 端到端验证带源地址', /ping -a 192\.168\.1\.1 192\.168\.2\.1/.test(allCode(mpls)));

  const v6 = codeOf(lab('lab-ipv6-dual'));
  ok('IPv6 双栈实验同时配置 IPv4 地址', /ip address 192\.168\.10\.1 255\.255\.255\.0/.test(v6) && /ip address 10\.0\.0\.2 255\.255\.255\.252/.test(v6));
  ok('IPv4 侧运行 OSPFv2，IPv6 侧运行 OSPFv3', /ospf 1 router-id/.test(v6) && /ospfv3 1 area/.test(v6));
  ok('双栈验证同时覆盖 IPv4 与 IPv6', /ping 192\.168\.100\.1/.test(allCode(lab('lab-ipv6-dual'))) && /ping 2001:db8:100::1/.test(allCode(lab('lab-ipv6-dual'))));
}

console.log('\n=== 静态路由 / Python / 示例包 ===');
{
  const rec = (D.recipes || []).find(function (r) { return r.id === 'rec-static-float'; });
  const c = rec.steps.map(function (s) { return s.c; }).join('\n');
  ok('浮动静态路由统一使用完整掩码', /192\.168\.20\.0 255\.255\.255\.0/.test(c) && !/192\.168\.20\.0 24\b/.test(c));

  const py = D.categories.reduce(function (a, c) { return a.concat(c.items || []); }, [])
    .find(function (it) { return it.id === 'json-config'; });
  ok('Python JSON 配置不再直接赋值小写 true', /json\.loads\(r"""\{\{value\}\}"""\)/.test(py.code) && !/\{\{value\}\}/.test(py.code.replace(/json\.loads\(r"""\{\{value\}\}"""\)/g, '')));

  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', 'ospf-adv.pack.json'), 'utf-8'));
  const packCode = (pack.labs || []).map(function (l) { return codeOf(l); }).join('\n');
  ok('示例知识包 OSPF 使用反掩码', !/network \d+\.\d+\.\d+\.0 255\.255\.255\.0/.test(packCode)
    && /network 10\.0\.12\.0 0\.0\.0\.255/.test(packCode));
}

console.log('\n=== 任务参数：一处修改贯穿所有设备 ===');
{
  const p = (D.presets || []).find(function (x) { return x.id === 'preset-l3-office'; });
  ok('任务存在 12 步 / 3 设备 / 5 项验证', p && p.task && p.task.steps.length === 12
    && p.task.devices.length === 3 && p.task.verify.length === 5);
  const taskCode = p.task.steps.map(function (s) { return s.code; }).join('\n');
  ok('任务步骤不再硬编码默认网关', !/192\.168\.10\.1/.test(taskCode) && !/192\.168\.10\.0/.test(taskCode));
  ok('SW1 / AR1 / PC1 都有步骤', ['SW1', 'AR1', 'PC1'].every(function (d) {
    return p.task.steps.some(function (s) { return s.who === d; });
  }));
  ok('任务同时包含默认路由和 NAT', /ip route-static 0\.0\.0\.0 0\.0\.0\.0/.test(taskCode) && /nat outbound 2000/.test(taskCode));
}

console.log('\n=== 汇总 ===');
console.log('通过 ' + pass + ' / 失败 ' + fail);
if (fails.length) {
  console.log('失败项：');
  fails.forEach(function (f) { console.log('  - ' + f); });
}
process.exitCode = fail ? 1 : 0;
