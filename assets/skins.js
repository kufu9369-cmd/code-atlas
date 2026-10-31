/* ============================================================
   码典 CodeAtlas — 皮肤包
   ------------------------------------------------------------
   一套皮肤在 styles.css 里对应一个 html[data-skin="xxx"] 块，
   这里只负责「有哪些皮肤 / 现在是哪套 / 怎么切」。

   单独成文件的理由和 search.js 一样：要在命令行里验。
   `node _dev/check-skins.js` 会拿这份 LIST 去核对 CSS 里是不是
   真的存在对应选择器、变量有没有写全、--hud-rgb 跟 --bg 是否一致
   —— 这几样全靠肉眼看是看不出来的。
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'codeatlas.skin.v1';
  var OLD_KEY = 'codeatlas.theme.v1';

  /* p.* 只给面板里的迷你预览用（不参与任何布局），
     所以这里写的是「代表性的五个色」，不是完整变量表。 */
  var LIST = [
    { id: 'midnight', name: '深空', desc: '靛蓝夜色 · 默认', mode: 'dark',
      p: { bg: '#090B10', rail: '#141924', line: '#1E2533', iris: '#7C8CFF', tx: '#E8EBF2' } },
    { id: 'daylight', name: '日间', desc: '白纸黑字，正午的办公室', mode: 'light',
      p: { bg: '#F4F6F9', rail: '#F7F9FB', line: '#E5E8EE', iris: '#4453CC', tx: '#12161D' } },
    { id: 'nord', name: '极光', desc: 'Nord 冷灰蓝，久看不闷', mode: 'dark',
      p: { bg: '#242933', rail: '#2E3440', line: '#3B4252', iris: '#88C0D0', tx: '#ECEFF4' } },
    { id: 'void', name: '极夜', desc: '纯黑 OLED，只剩结构线', mode: 'dark',
      p: { bg: '#000000', rail: '#0A0B0D', line: '#181B20', iris: '#C3CCD9', tx: '#ECEEF2' } },
    { id: 'terminal', name: '终端', desc: '黑底荧光绿，等宽字主场', mode: 'dark',
      p: { bg: '#070B09', rail: '#0D1410', line: '#1A2A21', iris: '#35E08A', tx: '#D5F3E1' } },
    { id: 'jade', name: '墨玉', desc: '墨绿灰底，玉青一点就够', mode: 'dark',
      p: { bg: '#0E1512', rail: '#131C18', line: '#22302A', iris: '#6FD6B4', tx: '#E3F0EA' } },
    { id: 'sepia', name: '暖砂', desc: '米黄纸感，夜里不刺眼', mode: 'light',
      p: { bg: '#F5EFE3', rail: '#FBF6EC', line: '#E4D9C6', iris: '#2C6B70', tx: '#2B2419' } },
    { id: 'sakura', name: '樱雾', desc: '淡粉紫，浅色里偏柔的一档', mode: 'light',
      p: { bg: '#FBF4F7', rail: '#FFFFFF', line: '#F0E2E8', iris: '#A8467A', tx: '#241B21' } }
  ];

  var MAP = {};
  for (var i = 0; i < LIST.length; i++) MAP[LIST[i].id] = LIST[i];

  /* 旧版本只存 dark / light 两个值，升级上来的要能落到对应皮肤上。
     注意 'light' 不能直接当 id 用 —— 皮肤 id 里没有叫 light 的。 */
  function normalize(v) {
    v = String(v == null ? '' : v).trim();
    if (MAP[v]) return v;
    if (v === 'light') return 'daylight';
    if (v === 'dark') return 'midnight';
    return '';
  }

  function stored() {
    try { return normalize(localStorage.getItem(KEY)); } catch (e) { return ''; }
  }

  function systemPrefersLight() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    } catch (e) { return false; }
  }

  /* 没存过就按系统来；存过就一直用存的（不再跟系统飘） */
  function detect() {
    var s = stored();
    if (s) return s;
    try {
      if (!localStorage.getItem(KEY)) {
        var old = normalize(localStorage.getItem(OLD_KEY));
        if (old) return old;
      }
    } catch (e) {}
    return systemPrefersLight() ? 'daylight' : 'midnight';
  }

  var CUR = 'midnight';

  function apply(id, save) {
    var s = MAP[normalize(id)] || MAP.midnight;
    CUR = s.id;

    var root = document.documentElement;
    root.setAttribute('data-skin', s.id);
    /* data-theme 留着：安卓的状态栏着色和旧样式都还认这个属性。
       light / dark 由皮肤自己声明，不靠 id 猜。 */
    root.setAttribute('data-theme', s.mode);

    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', s.p.bg);

    if (save) { try { localStorage.setItem(KEY, s.id); } catch (e) {} }

    try {
      window.dispatchEvent(new CustomEvent('skin:change', { detail: { id: s.id, skin: s } }));
    } catch (e) {}
    return s;
  }

  function current() { return CUR; }

  /* 面板里那张迷你预览的内联样式 */
  function previewStyle(s) {
    var p = (s && s.p) || {};
    return '--p-bg:' + p.bg + ';--p-rail:' + p.rail + ';--p-line:' + p.line +
           ';--p-iris:' + p.iris + ';--p-tx:' + p.tx;
  }

  /* 主窗口换肤后，已经开着的悬浮窗（另一个 BrowserWindow，同一个 origin）
     收得到 storage 事件，跟着一起变 —— 不用把悬浮窗关掉重开。
     save=false：别把收到的事件再写回去，否则两个窗口会互相触发。 */
  try {
    window.addEventListener('storage', function (e) {
      if (!e || e.key !== KEY) return;
      var id = normalize(e.newValue);
      if (id && id !== CUR) apply(id, false);
    });
  } catch (e) {}

  /* 用户从没手选过，就跟着系统深浅色走（macOS / Windows 定时切换深色时有用） */
  try {
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: light)');
      var onSys = function () {
        if (stored()) return;               // 手选过就不再自动切
        apply(systemPrefersLight() ? 'daylight' : 'midnight', false);
      };
      if (mq.addEventListener) mq.addEventListener('change', onSys);
      else if (mq.addListener) mq.addListener(onSys);
    }
  } catch (e) {}

  window.SKINS = {
    KEY: KEY,
    OLD_KEY: OLD_KEY,
    LIST: LIST,
    MAP: MAP,
    normalize: normalize,
    detect: detect,
    apply: apply,
    current: current,
    stored: stored,
    previewStyle: previewStyle
  };
})();
