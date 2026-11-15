/* ============================================================
   码典 · 生成 assets/ensp/86-recipes-vrp.js（官方配置步骤）
   ------------------------------------------------------------
   来源：朋友做的 Hinstruction 里的 recipes.json —— 从华为 VRP 官方帮助文档
   抠出来的 160 条「某个特性的完整配置步骤」，每步都带一句为什么这么配。
   这部分内容对学习最有用的是「顺序」：先配什么、后配什么。

   但官方文档的命令是模板写法，带 <占位符> 和 [ 可选项 ]，粘不进设备；
   而码典的剧本有一条硬约定：steps[].c 必须能直接粘。
   所以这里做的事是「填 + 筛」：

   - 用 scripts/lib/fill-vrp.js 把占位符换成示例值（跟命令大全同一套规则）
   - 填不出来的步骤整条丢掉（宁可少一步，也不要给一句敲不通的）
   - 剩不到 3 步的剧本不收（两步的「配置」没有学习价值）
   - 步骤里的中文说明进 note，命令本身保持纯 ASCII

   用法：node scripts/build-vrp-recipes.js
        node scripts/build-vrp-recipes.js "D:/别的路径/.../data"
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { fillSyntax } = require('./lib/fill-vrp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'ensp', '86-recipes-vrp.js');
const SRC = process.argv[2] || 'C:/Users/10137/Desktop/Hinstruction/resources/app/data';

let raw;
try {
  raw = JSON.parse(fs.readFileSync(path.join(SRC, 'recipes.json'), 'utf8'));
} catch (e) {
  console.error('读不到 recipes.json：' + SRC);
  process.exit(0);
}

/* 已有的剧本标题，用来避免「同一个东西出现两次」 */
const existing = new Set();
const buf = [];
['80-recipes', '82-recipes-route', '84-recipes-sec'].forEach(f => {
  buf.push(fs.readFileSync(path.join(ROOT, 'assets', 'ensp', f + '.js'), 'utf8'));
});
const norm = s => String(s).toLowerCase().replace(/[\s\-_·、（）()]/g, '');
const all = buf.join('\n');
for (const m of all.matchAll(/title:\s*'([^']+)'/g)) existing.add(norm(m[1]));

/* 模块 → 标签 + 顺序（跟左轨里的学习顺序对齐） */
const MOD_TAG = {
  OSPF: ['ospf', '路由'], BGP: ['bgp', '路由'], 'IS-IS': ['isis', '路由']
};
const STAR_LV = { 1: '入门', 2: '进阶', 3: '综合' };

/* 官方文档只给步骤，不给「配完怎么验」。但验邻居这件事对三个协议是确定的，
   所以按模块给一条最小验证 —— 这不是编答案，是补上该有的那一句。
   「最容易错在哪」不补：那个真的要看现场，硬写一句不如不写
   （所以这些剧本标 origin:'official'，自检脚本对它跳过 pitfalls 检查）。 */
const MOD_VERIFY = {
  OSPF: [{ cmd: 'display ospf peer brief', hope: '邻居状态到 Full' }],
  BGP: [{ cmd: 'display bgp peer', hope: '邻居状态到 Established' }],
  'IS-IS': [{ cmd: 'display isis peer', hope: '邻居状态到 Up' }]
};

const out = [];
let drop = { placeholder: 0, short: 0, dup: 0, view: 0, merged: 0, empty: 0, broken: 0 };
const report = [];

/* 文档里有些步骤用中文写「或」给两种写法（ipv6 address <x> eui-64或ipv6 address <x>）。
   VRP 不认中文，取第一种就够 —— 第二种一般只是省略写法。 */
function cleanCmd(raw) {
  return String(raw || '').split(/\s*(?:或者|或|\|)\s*/)[0].trim();
}

/* 有些步骤只写了「ospf」「bgp」「isis」这种裸视图关键字（文档里进程号是可选的），
   照着敲会停在系统视图，后面的步骤全部错位。这里补一个默认进程号。 */
const VIEW_DEFAULT = {
  ospf: 'ospf 1', bgp: 'bgp 100', isis: 'isis 1', rip: 'rip 1',
  ospfv3: 'ospfv3 1', vlan: 'vlan 10', acl: 'acl 3000'
};
function fixBareView(c) {
  return VIEW_DEFAULT[c] || c;
}

const seenTitle = new Set();
raw.forEach((r, idx) => {
  const title = String(r.t || '').trim();
  if (!title) return;
  const steps = [];
  (r.steps || []).forEach(s => {
    const c = fixBareView(fillSyntax(cleanCmd(s.c)));
    if (!c) { drop.placeholder++; return; }
    /* 命令必须是纯 ASCII：带中文的模板拼出来的句子粘过去只会报错 */
    if (/[^\x20-\x7e]/.test(c)) { drop.placeholder++; return; }
    /* 第一句就 quit 的没意义（说明文档默认你已经在某个视图里了） */
    if (!steps.length && /^(quit|return)$/i.test(c)) return;
    /* 光秃秃的 shutdown：文档里它指「关闭对等体组」，离开上下文就没法敲 */
    if (/^(undo\s+)?shutdown$/i.test(c)) return;
    steps.push({ c, note: String(s.d || '').replace(/^（可选）/, '可选：').trim() });
  });
  if (steps.length < 3) { drop.short++; return; }

  /* 文档排版产物：一段「请从下面几种方式里选一种」会写成
        ospf 1 / quit / ospf 1 / filter-policy ...
     中间那个 quit 加重新进视图完全是排版造成的，留着会让剧本多两步废话，
     还会让「下一步」在 quit 之后指回同一个视图。顺手把连续的重复命令也并掉。 */
  for (let i = 1; i < steps.length - 1; i++) {
    if (/^(quit|return)$/i.test(steps[i].c) && steps[i - 1].c === steps[i + 1].c) {
      steps.splice(i, 1);
      i--;
    }
  }

  /* 同一个毛病但长一辈：quit 前后各重复两三条
        ospf 1 / area 0 / quit / ospf 1 / area 0 / filter ...
     把 quit 和它后面那段重复整个删掉，前面的留着。 */
  for (let i = 1; i < steps.length - 1; i++) {
    if (!/^(quit|return)$/i.test(steps[i].c)) continue;
    for (let k = 3; k >= 2; k--) {
      if (i - k < 0 || i + k >= steps.length) continue;
      const before = steps.slice(i - k, i).map((s) => s.c).join('|');
      const after = steps.slice(i + 1, i + 1 + k).map((s) => s.c).join('|');
      if (before === after) { steps.splice(i, k + 1); i--; break; }
    }
  }

  /* 另一种排版产物：一行里把两种写法粘在一起
        filter ip-prefix T1 export filter ip-prefix T1 import
     前半和后半是同一个命令的两个方向。这种粘到设备上一句都敲不通，
     而「该留哪个方向」只有写文档的人知道 —— 整条丢，不猜。 */
  const dupHead = (c) => {
    const w = c.split(/\s+/);
    if (w.length < 6) return false;
    for (let k = 2; k <= w.length - 4; k++) {
      if (w.slice(0, 2).join(' ') === w.slice(k, k + 2).join(' ')) return true;
    }
    return false;
  };
  for (let i = steps.length - 1; i >= 0; i--) {
    if (dupHead(steps[i].c)) { steps.splice(i, 1); drop.merged++; }
  }

  for (let i = steps.length - 1; i > 0; i--) {
    if (steps[i].c === steps[i - 1].c) steps.splice(i, 1);
  }
  if (steps.length < 3) { drop.short++; return; }

  /* 清完排版产物后只剩「进视图」的，等于什么都没配。
     《OSPF对区域内的LSA进行过滤》原文把两种写法并排放，两种都被上面的规则当成
     重复删掉，只剩 system-view / ospf 1 / area 0 —— 留着用户照着敲什么也配不出来。

     白名单要写得**窄**：`ospf trans-delay 1`、`acl name T1 basic` 这种开头像进视图、
     其实是配置命令的，一律算「有内容」。宁可多留几条弱剧本，也不能把能用的删掉。 */
  const ENTER_CMD = new RegExp('^(system-view|quit|return|save'
    + '|display\\b|reset\\b|ping\\b|tracert\\b'
    + '|interface\\s+\\S+(\\s+\\S+)?$'
    + '|vlan\\s+\\d+$'
    + '|ospf\\s+\\d+$'
    + '|ospfv3\\s+\\d+$'
    + '|isis\\s+\\d+$'
    + '|bgp\\s+\\d+$'
    + '|rip\\s+\\d+$'
    + '|acl\\s+\\d+$'
    + '|area\\s+[\\d.]+$'
    + '|mpls$'
    + '|aaa$'
    + '|ip\\s+vpn-instance\\s+\\S+$'
    + '|ip\\s+pool\\s+\\S+$'
    + '|pim$'
    + '|user-interface\\s+vty\\s+\\d+(\\s+\\d+)?)$', 'i');
  const hasReal = steps.some((s) => !ENTER_CMD.test(s.c.trim()));
  if (!hasReal) {
    drop.empty++;
    if (process.env.SHOW_DROP) console.log('  [空] ' + title + ' → ' + steps.map((s) => s.c).join(' / '));
    return;
  }

  /* 官方文档《使能OSPF》这一节的步骤是断的：它把「配全局 router id」和「进 OSPF 进程」
     写成并列的两件事，省掉了 `ospf 1`，于是后面的 `description T1` / `area 0`
     全落在系统视图里。照着敲第二条就报错，而该在哪补 `ospf 1` 只有写文档的人知道 ——
     这条不收。（check-recipes 的视图链检查会重新发现这类问题，不怕漏。） */
  if (title === '使能OSPF' && steps.some((s) => /^description\s/i.test(s.c))) {
    drop.broken++;
    return;
  }

  /* 首步不是 system-view 的，补一句：否则照着粘第一条就报错 */
  if (!/^system-view$/.test(steps[0].c) && !/^(display|save|ping)/.test(steps[0].c)) {
    steps.unshift({ c: 'system-view', note: '先进入系统视图，后面所有配置都在这里面' });
  }

  const id = 'rec-vrp-' + String(r.m || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    + '-' + String(idx + 1).padStart(3, '0');
  if (existing.has(norm(title)) || seenTitle.has(norm(title))) { drop.dup++; return; }
  seenTitle.add(norm(title));

  out.push({
    id,
    title,
    scene: '华为官方配置步骤（' + (r.m || '') + '）。占位符已填成示例值，按自己的拓扑改地址和接口号。',
    level: STAR_LV[r.star] || '入门',
    tags: (MOD_TAG[r.m] || [String(r.m || '').toLowerCase()]).concat(['官方']),
    steps,
    verify: MOD_VERIFY[r.m] || [],
    origin: 'official',
    src: r.src || ''
  });
  report.push([r.m, title, steps.length]);
});

/* ---------- 输出 ---------- */
const body = out.map(r => {
  const steps = r.steps.map(s =>
    '        { c: ' + JSON.stringify(s.c) + ', note: ' + JSON.stringify(s.note) + ' }'
  ).join(',\n');
  return '    {\n'
    + '      id: ' + JSON.stringify(r.id) + ',\n'
    + '      title: ' + JSON.stringify(r.title) + ',\n'
    + '      scene: ' + JSON.stringify(r.scene) + ',\n'
    + '      level: ' + JSON.stringify(r.level) + ',\n'
    + '      tags: ' + JSON.stringify(r.tags) + ',\n'
    + '      topic: \'net\',\n'
    + '      steps: [\n' + steps + '\n      ],\n'
    + '      verify: ' + JSON.stringify(r.verify).replace(/"cmd"/g, 'cmd').replace(/"hope"/g, 'hope') + ',\n'
    + '      origin: \'official\'\n'
    + '    }';
}).join(',\n');

const head = `/* ============================================================
   码典 · 官方配置步骤（自动生成，别手改）
   ------------------------------------------------------------
   来源：华为 VRP 官方帮助文档的「配置指南」，经 Hinstruction 整理成 ${raw.length} 条。
   生成：node scripts/build-vrp-recipes.js
   收录：${out.length} 条（占位符填不出来 / 步骤太少的已剔除）
   约定跟其他剧本完全一样：steps[].c 能直接粘进设备，steps[].note 说为什么这么配。
   改内容 → 改 scripts/build-vrp-recipes.js，别在这里手改。
   ============================================================ */
(function (E) {
  'use strict';

  E.recipes.push(
${body}
  );
})(window.__ENSP);
`;

fs.writeFileSync(OUT, head, 'utf8');
console.log('原始 ' + raw.length + ' 条 → 收录 ' + out.length + ' 条');
console.log('剔除：占位符填不出 ' + drop.placeholder + ' 步，步骤不足 ' + drop.short
  + ' 条，跟现有剧本重名 ' + drop.dup + ' 条'
  + (drop.merged ? '，一行粘了两种写法 ' + drop.merged + ' 步' : '')
  + (drop.empty ? '，清完只剩进视图 ' + drop.empty + ' 条' : '')
  + (drop.broken ? '，官方步骤断链 ' + drop.broken + ' 条' : ''));
console.log('写出 ' + path.relative(ROOT, OUT) + ' · '
  + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
const byMod = {};
out.forEach(r => { byMod[r.tags[0]] = (byMod[r.tags[0]] || 0) + 1; });
console.log('模块分布：' + Object.entries(byMod).map(([k, v]) => k + ' ' + v).join(' / '));
console.log('样例：');
out.slice(0, 3).forEach(r => {
  console.log('  ' + r.title + '（' + r.steps.length + ' 步）');
  r.steps.slice(0, 4).forEach(s => console.log('    ' + s.c + '   # ' + s.note));
});
