/* ============================================================
   CodeAtlas · 原生容器适配层
   只在手机原生容器（Capacitor）里生效；用浏览器或桌面版打开时，
   整个文件除了一个 isNativePlatform() 判断之外什么也不做。

   负责三件网页做不到的事：
   1. 状态栏与会话：颜色跟随主题，内容不压在状态栏下方
   2. Android 物理返回键：先关弹层 → 再退详情页 → 最后才退出应用
   3. 导出知识包：写进缓存目录后调系统分享（WebView 里 <a download> 无效）
   ============================================================ */

(function () {
  'use strict';

  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return;

  var P = Cap.Plugins || {};
  var StatusBar = P.StatusBar || null;
  var AppPlugin = P.App || null;
  var Filesystem = P.Filesystem || null;
  var Share = P.Share || null;

  function quiet(p) {
    if (p && typeof p.catch === 'function') p.catch(function () {});
    return p;
  }

  /* ---------------- 轻提示（复用页面已有的 #toast） ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  /* ---------------- 状态栏 ---------------- */
  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function paintStatusBar() {
    if (!StatusBar) return;
    var light = isLight();
    quiet(StatusBar.setOverlaysWebView({ overlay: false }));
    /* DARK = 浅色字（配深色背景）；LIGHT = 深色字（配浅色背景） */
    quiet(StatusBar.setStyle({ style: light ? 'LIGHT' : 'DARK' }));
    quiet(StatusBar.setBackgroundColor({ color: light ? '#F4F6F9' : '#090B10' }));
  }

  function watchTheme() {
    var mo = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].attributeName === 'data-theme') { paintStatusBar(); return; }
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ---------------- 返回键 ---------------- */
  var exitStamp = 0;

  /* 返回 true 表示「这一下被页面消费了」，不再往上退 */
  function handleBack() {
    var CA = window.CodeAtlas;

    /* 1. 知识包弹层 */
    var dlg = document.getElementById('packDlg');
    if (dlg && dlg.classList.contains('on')) {
      if (CA && CA.closePacks) CA.closePacks(); else dlg.classList.remove('on');
      return true;
    }

    /* 2. 官方解答抽屉 */
    if (document.body.classList.contains('docs-open')) {
      if (CA && CA.closeDocs) CA.closeDocs();
      return true;
    }

    /* 3. 变量编辑器气泡 */
    var pop = document.getElementById('popover');
    if (pop && pop.classList.contains('on')) {
      if (CA && CA.closePop) CA.closePop();
      return true;
    }

    /* 4. 全屏详情页 → 回到列表 */
    if (document.body.classList.contains('detail')) {
      document.body.classList.remove('detail');
      /* 详情页的 hash 一并清掉，避免刷新后又被弹回详情 */
      if (location.hash && location.hash.indexOf('/') > 0) {
        var base = location.hash.split('/')[0];
        try { history.replaceState(null, '', base); } catch (e) { location.hash = base; }
      }
      return true;
    }

    return false;
  }

  function bindBack() {
    if (!AppPlugin || !AppPlugin.addListener) return;
    AppPlugin.addListener('backButton', function () {
      if (handleBack()) return;

      /* 已经在首页：两次返回才退出，防误触 */
      var now = Date.now();
      if (now - exitStamp < 2000) {
        if (AppPlugin.exitApp) AppPlugin.exitApp();
        return;
      }
      exitStamp = now;
      toast('再按一次返回键退出');
    });
  }

  /* ---------------- 导出：写文件 + 系统分享 ---------------- */
  if (Filesystem && Share) {
    window.NATIVE_SAVE = function (filename, text) {
      return Filesystem.writeFile({
        path: filename,
        data: text,
        directory: 'CACHE',
        encoding: 'utf8'
      })
        .then(function () {
          return Filesystem.getUri({ path: filename, directory: 'CACHE' });
        })
        .then(function (res) {
          return Share.share({
            title: filename,
            url: res.uri,
            dialogTitle: '导出知识包'
          });
        })
        .then(function () { return true; });
    };
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    paintStatusBar();
    watchTheme();
    bindBack();

    /* 原生容器里没有「刷新」按钮，长按标题栏等于刷新不直观；
       这里换掉 Android WebView 默认的长按选中菜单干扰 */
    document.addEventListener('contextmenu', function (e) {
      var t = e.target;
      /* 代码块和输入框保留系统菜单（要能选中复制） */
      if (t.closest && (t.closest('.code') || t.closest('input') || t.closest('textarea'))) return;
      e.preventDefault();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
