/* ============================================================
   CodeAtlas · 预加载桥（主进程 <-> 页面）
   ------------------------------------------------------------
   原来页面和主进程之间只有单向通道（主进程 executeJavaScript 往页面里塞脚本），
   页面想反过来通知主进程（比如「用户拖了悬浮窗的右下角」）没有任何办法。
   悬浮窗需要频繁的双向通信，所以补上这一层。

   contextIsolation 保持开启，只把下面这几个明确的方法挂到 window.DESKTOP，
   不暴露 ipcRenderer 本体，页面拿不到任意通道。
   网页版 / 安卓版没有这个对象，assets/hud.js 会整段跳过。
   ============================================================ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('DESKTOP', {
  /* 仅用于让页面知道「我在桌面壳里」，网页版没有这个对象 */
  shell: 'electron',

  hud: {
    /* 显示 / 隐藏切换，返回切换后的可见状态 */
    toggle: () => ipcRenderer.invoke('hud:toggle'),
    show: () => ipcRenderer.invoke('hud:show'),
    hide: () => ipcRenderer.invoke('hud:hide'),
    /* 退出悬浮模式，把主窗口叫回来 */
    backToMain: () => ipcRenderer.invoke('hud:back-to-main'),
    state: () => ipcRenderer.invoke('hud:state'),
    /* 透明度 0.5 ~ 1 */
    setAlpha: (v) => ipcRenderer.send('hud:alpha', Number(v)),
    /* 尺寸：给预设值用 */
    setSize: (w, h) => ipcRenderer.send('hud:size', Number(w), Number(h)),
    /* 拖动缩放：start / move / end 三个阶段，主进程负责夹紧边界 */
    grip: (phase, grip, dx, dy) => ipcRenderer.send('hud:grip', {
      phase: String(phase), grip: String(grip || ''), dx: Number(dx) || 0, dy: Number(dy) || 0
    }),
    /* 「抓下一步」：把悬浮窗叫出来切到下一步面板，顺便把剪贴板内容带过来 */
    grab: () => ipcRenderer.invoke('hud:grab')
  },

  /* 剪贴板：eNSP 的控制台内容只能走剪贴板。按热键时那一下 Ctrl+C 由主进程
     （electron/copysel.js）代按，页面这边只负责读；主进程没有剪贴板变化事件，
     只能轮询，watch(true) 才会开始轮。 */
  clip: {
    read: () => ipcRenderer.invoke('clip:read'),
    /* 复制「下一步」的命令要用。走主进程而不是 navigator.clipboard：
       app:// 自定义协议下 navigator.clipboard 不一定算安全上下文。 */
    write: (t) => ipcRenderer.invoke('clip:write', String(t || '')),
    watch: (on) => ipcRenderer.send('clip:watch', !!on),
    onChange: (fn) => {
      const h = (_e, t) => { try { fn(t); } catch (err) {} };
      ipcRenderer.on('clip:changed', h);
      return () => ipcRenderer.removeListener('clip:changed', h);
    }
  },

  /* 主进程按热键时推过来的「抓下一步」信号（自带剪贴板内容） */
  onGrab: (fn) => {
    const h = (_e, p) => { try { fn(p); } catch (err) {} };
    ipcRenderer.on('next:grab', h);
    return () => ipcRenderer.removeListener('next:grab', h);
  },

  /* 页面里「窗口」按钮用得到 */
  showMain: () => ipcRenderer.invoke('app:show-main'),
  quit: () => ipcRenderer.send('app:quit'),

  /* 主进程主动推送的状态（透明度变化等） */
  onHudState: (fn) => {
    const h = (_e, s) => { try { fn(s); } catch (e) {} };
    ipcRenderer.on('hud:state', h);
    return () => ipcRenderer.removeListener('hud:state', h);
  }
});
