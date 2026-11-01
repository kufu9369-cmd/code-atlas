/* ============================================================
   CodeAtlas · 桌面窗口（无标题栏）
   ------------------------------------------------------------
   主窗口不再有系统标题栏（见 electron/main.js 的 titleBarStyle: 'hidden'），
   换来的是「页面从窗口最顶上开始画」—— 界面上不用再重复第三遍程序名。

   页面这边必须配合两件事：
   1. 给 <html> 挂 data-desk="1"。styles.css 里所有「拖动区」规则都靠它开关，
      网页版 / 安卓版 / 悬浮窗都不会挂，所以那些规则一条都不生效。
   2. 把主题文字色报给右上角那三个系统窗口按钮（最小化 / 最大化 / 关闭）。
      按钮是系统画的，看不见我们的 CSS 变量：深色皮肤要浅色图标、浅色皮肤
      要深色图标，不同步的话换成浅色皮肤后按钮会糊在背景上。
   ============================================================ */

(function () {
  'use strict';

  var D = window.DESKTOP;
  if (!D || D.shell !== 'electron') return;

  /* 悬浮窗是另一个窗口，它自己有一条横条和按钮，不需要这套拖动区 */
  if (document.documentElement.getAttribute('data-hud') === '1') return;

  document.documentElement.setAttribute('data-desk', '1');

  function symbolColor() {
    var S = window.SKINS;
    var id = S && S.current ? S.current() : '';
    var c = id && S.MAP && S.MAP[id] ? S.MAP[id].p.tx : '';
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
      ? '#2A2A33' : '#E6E8F0';
  }

  function sync() {
    if (typeof D.setOverlay !== 'function') return;
    try { D.setOverlay(symbolColor()); } catch (e) {}
  }

  sync();
  window.addEventListener('skin:change', sync);
})();
