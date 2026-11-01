/* ============================================================
   导出为设备配置（.cfg / .sql / .py / .sh）

   为什么单独成文件：文件名、内容整形、扩展名三件事都是纯逻辑，
   放进 app.js 就只能靠点界面验证。这里只要给一份 steps + 取值函数，
   命令行就能直接断言（_dev/check-export.js），不用起 Electron。

   「文件模式」与「粘贴模式」的差别只有一处，但很关键：
   VRP 加载配置文件时会自己进系统视图，文件里再写一句 system-view
   在系统视图里不是命令；而粘到命令行时又必须先从用户视图进去。
   所以：复制 = 粘贴用（保留 system-view），导出 = 加载用（去掉它）。
   ============================================================ */
window.CFG = (function () {
  'use strict';

  var EXT = { ensp: 'cfg', linux: 'sh', mysql: 'sql', python: 'py', git: 'sh' };

  function extOf(cat) {
    return EXT[cat] || 'txt';
  }

  /* 标题比 id 好认，但 Windows / Android 都不接受这些字符 */
  function safeName(s) {
    return String(s == null ? '' : s)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48);
  }

  function fileName(title, who, cat) {
    var base = safeName(title) || 'codeatlas';
    var w = safeName(who);
    if (w) base += '-' + w;
    return base + '.' + extOf(cat);
  }

  /* 单独占一行的 system-view / sys */
  var SYSVIEW = /^\s*(system-view|sys)\s*$/i;

  /* 整形：
     - CRLF 统一成 LF
     - 文件模式下的 eNSP 内容去掉 system-view 行
     - 去掉首尾空行，中间连续空行压成一行（步骤之间本来就留了一行）
     - 行尾空白去掉，末尾补一个换行（文本文件都该以换行结尾） */
  function shape(text, opts) {
    opts = opts || {};
    var lines = String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n');

    if (opts.mode === 'file' && opts.cat === 'ensp') {
      lines = lines.filter(function (l) { return !SYSVIEW.test(l); });
    }
    if (opts.stripComment) {
      lines = lines.filter(function (l) { return !/^\s*#/.test(l); });
    }

    var out = [];
    lines.forEach(function (l) {
      var blank = !l.trim();
      if (blank && (!out.length || !out[out.length - 1].trim())) return;
      out.push(l.replace(/\s+$/, ''));
    });
    while (out.length && !out[out.length - 1].trim()) out.pop();

    return out.length ? out.join('\n') + '\n' : '';
  }

  /* o = {
       title, cat, who,
       steps: [{ code, who }],
       plain: function (code, index) -> 已经替换好变量的那一行/一段,
       mode: 'file' | 'paste'
     } */
  function build(o) {
    o = o || {};
    var steps = (o.steps || []).filter(function (s) { return !o.who || s.who === o.who; });
    var chunks = [];
    for (var i = 0; i < steps.length; i++) {
      var t = o.plain ? o.plain(steps[i].code, i) : steps[i].code;
      if (t && String(t).trim()) chunks.push(String(t));
    }
    return {
      name: fileName(o.title, o.who, o.cat),
      text: shape(chunks.join('\n\n'), { mode: o.mode || 'file', cat: o.cat })
    };
  }

  /* 保存：手机容器里 <a download> 不生效，交给 native.js 写文件 + 系统分享；
     桌面版与网页版走 Blob 下载。返回 Promise<boolean>。 */
  function save(name, text) {
    var data = String(text == null ? '' : text);
    if (!data) return Promise.resolve(false);

    if (window.NATIVE_SAVE) {
      return Promise.resolve(window.NATIVE_SAVE(name, data)).then(function (ok) {
        return !!ok;
      }).catch(function () { return false; });
    }

    try {
      var blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  return { extOf: extOf, fileName: fileName, shape: shape, build: build, save: save };
})();
