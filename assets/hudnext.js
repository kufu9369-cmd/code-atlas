/* ============================================================
   码典 · 「下一步」面板
   ------------------------------------------------------------
   只在桌面端的悬浮窗里生效（index.html?hud=1 且存在 window.DESKTOP）。

   它回答一个问题：在 eNSP 里配到一半卡住了，下一句该敲什么？

   数据从哪来：
   eNSP 的 CLI 是它自己画的控件，Electron 读不到。所以走剪贴板 ——
   用户在 eNSP 里选中几行，按 Ctrl+Alt+Z（主进程会替他按 Ctrl+C），这里读剪贴板做匹配。
   面板开着的时候主进程会轮询剪贴板，剪一次就自动刷新一次，
   不用每次都按键。

   匹配全在 assets/nextstep.js 里（纯函数，命令行能测）。
   这个文件只负责：显示、复制、切换、键盘。
   ============================================================ */
(function () {
  'use strict';

  if (document.documentElement.getAttribute('data-hud') !== '1') return;

  var D = window.DESKTOP;
  if (!D || !D.hud) return;

  var NEXT = window.NEXT;
  if (!NEXT) { console.error('[next] 缺少 assets/nextstep.js'); return; }

  var shell = document.getElementById('hudShell');
  var pane = document.getElementById('nextPane');
  var input = document.getElementById('nxInput');
  var body = document.getElementById('nxBody');
  var hint = document.getElementById('nxHint');
  if (!pane || !body || !input) return;

  var open = false;
  var manual = false;      // 用户手动改过输入框：剪贴板变化不覆盖他的输入
  var lastResult = null;
  var lastText = '';

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 1400);
  }

  function copy(text) {
    var s = String(text || '');
    if (!s) return;
    Promise.resolve(D.clip.write(s)).then(function () {
      toast('已复制：' + (s.split('\n')[0].slice(0, 28) + (s.indexOf('\n') >= 0 ? ' …' : '')));
    }).catch(function () { toast('复制失败'); });
  }

  /* ---------- 渲染：结果区 ---------- */

  function cmdRow(s, i) {
    var note = s.note
      ? esc(s.note)
      : (i === 0 ? '接着上一条，还在同一视图里' : '');
    return '<div class="nx-line">'
      + '<code>' + esc(s.c) + '</code>'
      + (note ? '<span>' + note + '</span>' : '')
      + (s.who ? '<b class="nx-who">' + esc(s.who) + '</b>' : '')
      + '</div>';
  }

  function partsHTML(parts) {
    if (!parts || !parts.length) return '';
    return parts.map(function (p) {
      /* 只有一段且没写设备名时，标「整段」比标「通用」清楚：
         用户看到的是一份可以整段粘进去的配置，不是「通用设备」这种东西。 */
      var who = (parts.length === 1 && p.who === '通用') ? '整段' : p.who;
      return '<div class="nx-part">'
        + '<div class="nx-part-h"><b>' + esc(who) + '</b>'
        + '<button class="nx-mini" data-copy="' + esc(p.code) + '">复制这 ' + p.code.split('\n').length + ' 条</button></div>'
        + '<pre>' + esc(p.code) + '</pre></div>';
    }).join('');
  }

  function resultHTML(r) {
    var h = '';

    /* 识别到的东西 */
    var bits = [];
    if (r.viewLabel) {
      bits.push('<span class="nx-tag nx-tag-v">' + esc(r.viewLabel)
        + (r.ctx ? ' · ' + esc(r.ctx) : '') + '</span>');
    }
    if (r.ok && r.recipe) {
      bits.push('<span class="nx-tag nx-tag-s">' + esc(r.recipe.title) + '</span>');
      if (r.total) {
        bits.push('<span class="nx-step">' + (r.whole ? '从头看' : (r.idx + 1) + ' / ' + r.total + ' 步') + '</span>');
      }
    }
    if (r.cmds && r.cmds.length) {
      bits.push('<span class="nx-cmds">认出 ' + r.cmds.length + ' 条命令</span>');
    }
    if (bits.length) h += '<div class="nx-meta">' + bits.join('') + '</div>';

    if (!r.ok) return h + noMatchHTML(r);

    var rec = r.recipe;

    if (r.done) {
      h += '<div class="nx-done">这条主线已经走完了。'
        + '<code>' + esc((r.verify && r.verify[0] ? r.verify[0].cmd : 'display current-configuration')) + '</code>'
        + ' 看一眼，然后 <code>save</code>。</div>';
    } else if (r.next.length) {
      var n0 = r.next[0];
      h += '<div class="nx-now">'
        + '<div class="nx-lab">' + (r.whole ? '第一条' : '下一步')
        + (n0.who ? '<span class="nx-who2">' + esc(n0.who) + '</span>' : '') + '</div>'
        + '<code class="nx-cmd">' + esc(n0.c) + '</code>'
        + (n0.note ? '<div class="nx-note">' + esc(n0.note) + '</div>' : '')
        + '<div class="nx-act">'
        + '<button class="nx-copy" data-copy="' + esc(n0.c) + '">复制这一条</button>'
        + '<button class="nx-mini" data-nx="recopy">连上下文一起复制</button>'
        + '</div></div>';
    }

    if (r.rest && r.rest.length > 1) {
      h += '<div class="nx-sec"><div class="nx-sub">随后</div>'
        + r.rest.slice(1, 5).map(function (s, i) { return cmdRow(s, i + 1); }).join('')
        + (r.rest.length > 5 ? '<div class="nx-more">还有 ' + (r.rest.length - 5) + ' 条，看下面的整段</div>' : '')
        + '</div>';
    }

    if (rec.scene) {
      h += '<div class="nx-scene">' + esc(rec.scene) + '</div>';
    }

    var all = r.parts.reduce(function (n, p) { return n + p.code.split('\n').length; }, 0);
    h += '<details class="nx-all"><summary>整段配置（' + all + ' 条，可直接粘进设备）</summary>'
      + partsHTML(r.parts) + '</details>';

    if (r.pitfalls && r.pitfalls.length) {
      h += '<div class="nx-sec nx-pit"><div class="nx-sub">最容易错在这</div><ul>'
        + r.pitfalls.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('')
        + '</ul></div>';
    }

    if (r.verify && r.verify.length) {
      h += '<div class="nx-sec"><div class="nx-sub">配完拿这个验</div>'
        + r.verify.map(function (v) {
          return '<div class="nx-line"><code>' + esc(v.cmd) + '</code>'
            + (v.hope ? '<span>' + esc(v.hope) + '</span>' : '') + '</div>';
        }).join('') + '</div>';
    }

    if (r.alt && r.alt.length) {
      h += '<div class="nx-sec"><div class="nx-sub">不是这个场景？</div><div class="nx-alts">'
        + r.alt.map(function (a) {
          return '<button class="nx-alt" data-pick="' + esc(a.id) + '">'
            + esc(a.title) + '<i>' + (a.idx + 1) + '/' + a.total + '</i></button>';
        }).join('') + '</div></div>';
    }

    h += libHTML();
    return h;
  }

  function noMatchHTML(r) {
    var h = '<div class="nx-none">';

    if (r.reason === 'empty') {
      h += '<b>卡住了？把刚敲的几行丢进来</b>'
        + '<p>在 eNSP 控制台里拖动选中几行 → 直接按 <code>Ctrl+Alt+Z</code>，'
        + '复制这一步会替你按（不用先 Ctrl+C），这里会认到你走到第几步、下一句该敲什么。'
        + '也可以直接粘进上面的框里。</p>'
        + '<p class="nx-fine">带不带 <code>&lt;Huawei&gt;</code> 提示符都行；日志、报错、display 的输出会被自动过滤掉。</p>';
    } else if (r.reason === 'unparsed') {
      h += '<b>这段里没认出命令</b>'
        + '<p>粘进来的内容里没有 VRP 命令（' + (r.dropped || 0) + ' 行被当成回显丢掉了）。'
        + '试着把「提示符 + 你敲的那行」一起复制，例如 <code>[SW1]vlan batch 10 20</code>。</p>';
    } else {
      h += '<b>没认出这是什么配置</b>'
        + '<p>可能是命令太少，或者这个场景还没收录。看看下面这些：</p>';
    }

    if (r.cmdHelp) {
      h += '<div class="nx-help"><div class="nx-sub">你敲的这条</div>'
        + '<code>' + esc(r.cmdHelp.key) + '</code>'
        + (r.cmdHelp.p ? '<p>' + esc(r.cmdHelp.p) + '</p>' : '')
        + (r.cmdHelp.eg ? '<pre>' + esc(r.cmdHelp.eg) + '</pre>' : '')
        + '</div>';
    }

    if (r.related && r.related.length) {
      h += '<div class="nx-sec"><div class="nx-sub">相关片段</div>'
        + r.related.map(function (x) {
          return '<button class="nx-alt" data-snip="' + esc(x.id) + '">' + esc(x.title)
            + '<i>' + esc(x.catName) + '</i></button>';
        }).join('') + '</div>';
    }

    h += libHTML(true);
    return h + '</div>';
  }

  /* 全部剧本：没匹配上时的兜底，也是「当手册翻」的入口。
     openNow 为真时默认展开 —— 空状态和没匹配上时如果不展开，
     下面就是一大片空白，用户也不知道这里有 42 条主线可翻。 */
  function libHTML(openNow) {
    var all = NEXT.list();
    if (!all.length) return '';
    var byLevel = { '入门': [], '进阶': [], '高级': [], '综合': [] };
    all.forEach(function (r) {
      (byLevel[r.level] || byLevel['进阶']).push(r);
    });
    var h = '<details class="nx-lib"' + (openNow ? ' open' : '')
      + '><summary>全部剧本（' + all.length + ' 条主线，点开看完整步骤）</summary>';
    ['入门', '进阶', '高级', '综合'].forEach(function (lv) {
      if (!byLevel[lv].length) return;
      h += '<div class="nx-sub nx-lv">' + lv + '</div><div class="nx-alts">'
        + byLevel[lv].map(function (r) {
          return '<button class="nx-alt" data-pick="' + esc(r.id) + '" title="' + esc(r.scene) + '">'
            + esc(r.title) + '<i>' + r.steps + ' 步</i></button>';
        }).join('') + '</div>';
    });
    return h + '</details>';
  }

  /* ---------- 匹配与显示 ---------- */

  function show(r) {
    lastResult = r;
    body.innerHTML = resultHTML(r);
    body.scrollTop = 0;
  }

  function run(text, onlyId) {
    lastText = text || '';
    show(onlyId ? (NEXT.match(text, onlyId) || NEXT.openRecipe(onlyId) || { ok: false, reason: 'nomatch', cmds: [] })
      : NEXT.match(text || ''));
  }

  function openPane(text) {
    if (!open) {
      open = true;
      shell.setAttribute('data-nx', '1');
      pane.hidden = false;
      if (D.clip && D.clip.watch) D.clip.watch(true);
    }
    if (text !== undefined && text !== null && text !== '') {
      input.value = text;
      manual = false;
      run(text);
    } else if (!lastResult) {
      run(input.value || '');
    }
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 40);
  }

  function closePane() {
    if (!open) return;
    open = false;
    shell.removeAttribute('data-nx');
    pane.hidden = true;
    if (D.clip && D.clip.watch) D.clip.watch(false);
  }

  function grab() {
    return Promise.resolve(D.clip.read()).then(function (t) {
      var text = String(t || '').trim();
      if (!text) {
        openPane('');
        hint.textContent = '剪贴板是空的 —— 去 eNSP 里选中几行，按 Ctrl+Alt+Z 就好（复制会自动按）';
        return;
      }
      openPane(text);
      hint.textContent = '已从剪贴板读到 ' + text.split('\n').length + ' 行';
    }).catch(function () { openPane(''); });
  }

  /* ---------- 事件 ---------- */

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var c = t.closest('[data-copy]');
    if (c) { copy(c.getAttribute('data-copy')); return; }

    var n = t.closest('[data-nx]');
    if (n) {
      var act = n.getAttribute('data-nx');
      if (act === 'close') closePane();
      else if (act === 'grab') grab();
      else if (act === 'recopy' && lastResult && lastResult.ok && lastResult.next.length) {
        /* 连上下文复制：把「剩余步骤」整段带走，粘贴到记事本里当小抄 */
        copy(lastResult.next.map(function (s) { return s.c; }).join('\n'));
      }
      return;
    }

    var p = t.closest('[data-pick]');
    if (p) {
      var id = p.getAttribute('data-pick');
      var r = openRecipeView(id);
      if (r) show(r);
      return;
    }

    var s = t.closest('[data-snip]');
    if (s) {
      /* 相关片段：收起面板再跳过去，别让用户在两套界面上打转 */
      closePane();
      if (window.CodeAtlas && window.CodeAtlas.gotoSnippet) {
        window.CodeAtlas.gotoSnippet(s.getAttribute('data-snip'));
      }
    }
  });

  function openRecipeView(id) {
    var r = NEXT.openRecipe(id);
    if (!r) return null;
    /* 保留输入框里已有的命令，这样点候选再点回来还能接着匹配 */
    return r;
  }

  input.addEventListener('input', function () {
    manual = true;
    run(input.value);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      run(input.value);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closePane(); }
  });

  /* 主进程按热键 → 已经替用户 Ctrl+C 过了，直接带着内容弹面板。
     p.hint 由主进程生成，说清楚「这一行是从哪读到」或者「为什么读不到」，
     不然用户只会看到一片空白，不知道是没选中还是功能坏了。 */
  if (typeof D.onGrab === 'function') {
    D.onGrab(function (p) {
      var text = p && p.text ? String(p.text).trim() : '';
      if (text) {
        openPane(text);
        hint.textContent = (p && p.hint) || ('已从剪贴板读到 ' + text.split('\n').length + ' 行');
      } else {
        openPane('');
        if (p && p.hint) hint.textContent = p.hint;
      }
    });
  }

  /* 面板开着时剪贴板变了就自动重新匹配 —— 用户在 eNSP 里剪一次，这边立刻更新 */
  if (D.clip && D.clip.onChange) {
    D.clip.onChange(function (text) {
      if (!open || manual) return;
      var t = String(text || '').trim();
      if (!t) return;
      input.value = t;
      run(t);
      hint.textContent = '剪贴板更新了（' + t.split('\n').length + ' 行）';
    });
  }

  /* 顶部横条的「下一步」按钮 */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-hud="next"]') : null;
    if (b) grab();
  });

  /* ---------- 给自动化回归留的入口 ---------- */
  if (window.CodeAtlas) {
    window.CodeAtlas.next = {
      open: openPane,
      close: closePane,
      grab: grab,
      set: function (t) { openPane(t); return lastResult; },
      pick: function (id) { var r = openRecipeView(id); if (r) show(r); return r; },
      result: function () { return lastResult; },
      isOpen: function () { return open; },
      lib: function () { return NEXT.list(); }
    };
  }
})();
