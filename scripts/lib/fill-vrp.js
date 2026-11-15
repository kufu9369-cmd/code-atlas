/* ============================================================
   把官方文档里的「命令模板」填成能直接敲的一行
   ------------------------------------------------------------
   华为文档的写法是这样的：
     interface <interface-type> <interface-number>
     ospf [ <process-id> | router-id <router-id> | vpn-instance <vpn-instance-name> ] *
     ospf dr-priority <priovalue>
   BNF 里的 [ ] 是可选项、{ | } 是必选其一、< > 是占位符。
   终端里粘不了这种写法，所以：

   1. 去掉 [ ... ]（可选就是可以不写，**注意嵌套**，要反复剥几轮）
   2. { a | b } 取第一个（VRP 手册里第一个通常就是最常用的）
   3. <x> 按名字猜一个像样的样例值
   4. 最后还残留 < > { } [ ] 的，说明这句填不出来 —— 返回空串，让调用方丢掉

   猜错了比不猜更坑（比如把 mask 猜成 wildcard），所以 sampleOf 的规则
   按「名字里出现哪个关键词」从具体到宽泛排，宽泛的兜底放最后。
   ============================================================ */
'use strict';

function sampleOf(name) {
  const n = String(name).toLowerCase();
  const has = (t) => n.indexOf(t) > -1;
  if (has('ipv6')) return '2001:db8::1';
  if (has('ip-address') || has('ipaddr') || has('ipv4') || has('ip ')) return '10.0.0.1';
  if (has('mask-length') || has('masklength') || has('prefix-length')) return '24';
  if (has('wildcard')) return '0.0.0.255';
  if (has('mask')) return '255.255.255.0';
  if (has('router-id')) return '1.1.1.1';
  if (has('as-number') || has('asnum')) return '100';
  /* 官方文档把接口名拆成两个占位符写：interface <interface-type> <interface-number>
     —— 必须分别给「类型」和「编号」，否则会填出 interface 1 1 这种废话。
     有的页面还写错成 <interface-type interface-number>（少了中间那个 >），
     一个占位符里塞两样，那就得一次给全，不然会掉成 interface GigabitEthernet。 */
  if (has('interface-type') && has('interface-number')) return 'GigabitEthernet 0/0/0';
  if (has('interface-type')) return 'GigabitEthernet';
  if (has('interface-number')) return '0/0/0';
  if (has('interface-name') || has('ifname')) return 'GigabitEthernet0/0/0';
  if (has('area-id') || has('area')) return '0';
  if (has('vlan')) return '10';
  if (has('mac')) return '00e0-fc12-3456';
  if (has('vpn-instance')) return 'VPN1';
  if (has('domain')) return 'huawei';
  if (has('username') || has('user-name')) return 'admin';
  if (has('password')) return 'Huawei@123';
  if (has('community')) return 'public';
  if (has('key')) return 'Huawei@123';
  if (has('name') || has('string') || has('text') || has('description') || has('str')) return 'T1';
  if (has('port')) return '80';
  if (has('cost')) return '10';
  if (has('priority')) return '100';
  if (has('time') || has('interval') || has('seconds')) return '30';
  if (has('ip-prefix')) return 'P1';
  if (has('acl')) return '3000';
  if (has('num') || has('number') || has('count') || has('id') || has('index') || has('value')) return '1';
  return '1';
}

/* 一行模板 → 能敲的一行；填不出来返回 '' */
function fillSyntax(syntax) {
  let s = String(syntax || '').split('\n')[0].trim();
  if (!s) return '';

  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\[[^[\]]*\]/g, ' ');
    if (next === s) break;
    s = next;
  }
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\{[^{}]*\}/g, (m) => m.slice(1, -1).split('|')[0]);
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[*+&]/g, ' ');
  s = s.replace(/<([^<>]+)>/g, (_, name) => sampleOf(name));
  s = s.replace(/\s+/g, ' ').trim();
  if (/[<>{}[\]]/.test(s)) return '';
  return s;
}

module.exports = { sampleOf, fillSyntax };
