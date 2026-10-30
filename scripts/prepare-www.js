/* ============================================================
   生成 www/ —— Capacitor 打包用的纯静态资源目录
   为什么要有这一步：Capacitor 的 webDir 会被整个塞进 APK，
   如果直接指向项目根目录，node_modules / dist / _dev 也会一起进去。
   所以这里显式列出「应用真正需要的文件」，其余一概不复制。
   ============================================================ */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'www');

/* 要复制的内容（相对项目根目录） */
const COPY = ['index.html', 'assets', 'examples'];

function rmrf(p) {
  if (fs.rmSync) fs.rmSync(p, { recursive: true, force: true });
  else if (fs.existsSync(p)) fs.rmdirSync(p, { recursive: true });
}

function main() {
  if (fs.existsSync(OUT)) rmrf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  for (const rel of COPY) {
    const from = path.join(ROOT, rel);
    if (!fs.existsSync(from)) {
      console.warn('[prepare-www] 跳过（不存在）:' + rel);
      continue;
    }
    const to = path.join(OUT, rel);
    fs.cpSync(from, to, { recursive: true });
  }

  /* 统计，便于确认没漏文件 */
  let files = 0, bytes = 0;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else { files++; bytes += fs.statSync(p).size; }
    }
  })(OUT);

  /* 必须存在的关键文件自检 */
  const need = ['index.html', 'assets/data.js', 'assets/app.js', 'assets/packs.js', 'assets/native.js', 'assets/styles.css'];
  const missing = need.filter(f => !fs.existsSync(path.join(OUT, f)));

  console.log('[prepare-www] ' + files + ' 个文件 / ' + Math.round(bytes / 1024) + ' KB -> www/');
  if (missing.length) {
    console.error('[prepare-www] 缺少关键文件: ' + missing.join(', '));
    process.exit(1);
  }
  console.log('[prepare-www] 关键文件齐全 ✓');
}

main();
