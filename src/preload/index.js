/**
 * 预加载脚本（安全桥）
 * ------------------------------------------------------------------
 * 页面里拿不到 Node，只能通过 window.lingdao 调用这些白名单方法。
 * 想给界面加新能力：在这里加方法 + 在 main/ipc.js 加通道。
 */

const { contextBridge, ipcRenderer } = require('electron');

/** 订阅主进程推送，返回取消订阅函数 */
function on(channel, cb) {
  const handler = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('lingdao', {
  // ---- 窗口 ----
  setMode: (mode) => ipcRenderer.send('window:mode', mode),
  hide: () => ipcRenderer.send('window:hide'),
  setSize: (size) => ipcRenderer.send('window:size', size),
  dragStart: (cursor) => ipcRenderer.send('window:drag-start', cursor),
  dragMove: (cursor) => ipcRenderer.send('window:drag-move', cursor),
  dragEnd: () => ipcRenderer.send('window:drag-end'),

  // ---- 天气 ----
  getWeather: (opts) => ipcRenderer.invoke('weather:get', opts),
  searchCity: (kw) => ipcRenderer.invoke('weather:search', kw),
  setCity: (city) => ipcRenderer.invoke('weather:set-city', city),
  onWeatherUpdate: (cb) => on('weather:update', cb),

  // ---- 闹钟 ----
  getAlarms: () => ipcRenderer.invoke('alarm:list'),
  addAlarm: (payload) => ipcRenderer.invoke('alarm:add', payload),
  removeAlarm: (id) => ipcRenderer.invoke('alarm:remove', id),
  updateAlarm: (id, patch) => ipcRenderer.invoke('alarm:update', { id, patch }),
  snoozeAlarm: (id) => ipcRenderer.send('alarm:snooze', id),
  onAlarmFire: (cb) => on('alarm:fire', cb),

  // ---- 应用 ----
  getSettings: () => ipcRenderer.invoke('app:settings'),
  setTheme: (t) => ipcRenderer.invoke('app:set-theme', t),
  setSound: (s) => ipcRenderer.invoke('app:set-sound', s),
  setAutoLaunch: (e) => ipcRenderer.invoke('app:set-auto-launch', e),
  quit: () => ipcRenderer.send('app:quit'),

  // ---- 主进程事件 ----
  onThemeChanged: (cb) => on('app:theme-changed', cb),
  onBlur: (cb) => on('island:blur', cb),
});
