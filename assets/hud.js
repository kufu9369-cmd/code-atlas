/* ============================================================
   CodeAtlas · 悬浮窗交互
   ------------------------------------------------------------
   只在桌面端的悬浮窗（index.html?hud=1）里生效。
   网页版 / 安卓版没有 window.DESKTOP，整段直接 return，什么也不做。

   这里负责四件事：
   1. 顶部那条横条的按钮：切尺寸 / 回主窗口 / 隐藏
   2. 右下角三个握把拖动改大小（无边框窗口没有系统边框可拖）
   3. 把主进程给的透明度写到 --hud-a 上
   4. 把上面这些方法挂到 window.CodeAtlas.hud，方便自动化回归

   注意：拖动条本身用的是 CSS 的 -webkit-app-region: drag，那部分是
   Chromium 原生实现的，不需要（也没法）用 JS 接管。
   ============================================================ */

(function () {
  'use strict';

  if (document.documentElement.getAttribute('data-hud') !== '1') return;

  var D = window.DESKTOP;
  if (!D || !D.hud) return;      // 网页 / 安卓：没有桥，收工

  /* ---------- 轻提示（复用页面里的 #toast） ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1400);
  }

  /* ---------- 透明度 ---------- */
  function applyAlpha(a) {
    a = Number(a);
    if (!(a > 0.3 && a <= 1)) return;
    document.documentElement.style.setProperty('--hud-a', String(a));
  }

  /* ---------- 尺寸档位 ---------- */
  var PRESETS = [[420, 560], [520, 700], [680, 900]];
  var cur = { w: 520, h: 700 };

  function rememberBounds(s) {
    if (s && s.bounds && s.bounds.width > 0) {
      cur.w = s.bounds.width;
      cur.h = s.bounds.height;
    }
  }

  function cycleSize() {
    /* 找下一个比当前更宽的档位，已经是最大就回到最小 */
    var next = null;
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i][0] > cur.w + 24) { next = PRESETS[i]; break; }
    }
    if (!next) next = PRESETS[0];
    cur.w = next[0]; cur.h = next[1];
    D.hud.setSize(next[0], next[1]);
    toast('悬浮窗 ' + next[0] + ' × ' + next[1]);
  }

  /* ---------- 顶部按钮 ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-hud]') : null;
    if (!b) return;
    var act = b.getAttribute('data-hud');
    if (act === 'hide') D.hud.hide();
    else if (act === 'main') D.hud.backToMain();
    else if (act === 'size') cycleSize();
  });

  /* ---------- 右下角握把：拖动改大小 ----------
     页面只报「往哪个方向拖了多少像素」，
     真正算尺寸、夹住最小宽度的是主进程（hud:grip）。
     这样即使事件在窗口外丢了几个，也不会算出负数尺寸。 */
  var grips = document.querySelectorAll('.hud-grip');
  Array.prototype.forEach.call(grips, function (el) {
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      var g = el.getAttribute('data-grip') || 'se';
      var id = e.pointerId;
      var sx = e.screenX;
      var sy = e.screenY;

      D.hud.grip('start', g);
      try { el.setPointerCapture(id); } catch (err) {}

      function onMove(ev) {
        D.hud.grip('move', g, ev.screenX - sx, ev.screenY - sy);
      }
      function onUp() {
        D.hud.grip('end', g);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        try { el.releasePointerCapture(id); } catch (err) {}
        D.hud.state().then(rememberBounds).catch(function () {});
      }

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
  });

  /* ---------- 启动：读一次主进程的状态 ---------- */
  applyAlpha(0.92);
  D.hud.state().then(function (s) {
    if (!s) return;
    applyAlpha(s.alpha);
    rememberBounds(s);
    /* 热键注册不上是静默失败里最坑的一种：用户按了没反应，又不知道原因。
       两个热键各自独立报，能用一个就够用户用。 */
    var miss = [];
    if (s.hotkeyOk === false) miss.push('悬浮窗 ' + (s.hotkey || 'Ctrl+Alt+X'));
    if (s.nextKeyOk === false) miss.push('抓下一步 ' + (s.nextKey || 'Ctrl+Alt+Z'));
    if (miss.length) {
      toast(miss.join(' / ') + ' 已被别的程序占用，先用托盘图标或菜单里的同名项');
    }
  }).catch(function () {});

  if (typeof D.onHudState === 'function') {
    D.onHudState(function (s) {
      if (!s) return;
      applyAlpha(s.alpha);
    });
  }

  /* ---------- 给自动化回归留的入口 ---------- */
  if (window.CodeAtlas) {
    window.CodeAtlas.hud = {
      show: function () { return D.hud.show(); },
      hide: function () { return D.hud.hide(); },
      cycle: cycleSize,
      setSize: function (w, h) { cur.w = w; cur.h = h; D.hud.setSize(w, h); return [w, h]; },
      setAlpha: function (a) { applyAlpha(a); D.hud.setAlpha(a); return a; },
      state: function () { return D.hud.state(); }
    };
  }
})();
