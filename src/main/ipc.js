/**
 * IPC 通道注册
 * ------------------------------------------------------------------
 * 渲染进程与主进程之间唯一的通信入口，所有通道集中在这里，
 * 方便审计「界面能做什么」。
 *
 * 通道命名约定：<域>:<动作>，域包括 window / weather / alarm / app
 */

const { ipcMain, app, shell, screen } = require('electron');
const win = require('./window');
const { VERSION } = require('./config');

function registerIpc({ store, weather, alarms, onQuit }) {
  // ---------- window ----------
  ipcMain.on('window:mode', (_e, mode) => win.setMode(mode, { store }));

  ipcMain.on('window:drag-start', (_e, cursor) => {
    // 用主进程的屏幕坐标做基准，避免 DPI 缩放误差累积
    win.dragStart(screen.getCursorScreenPoint());
  });
  ipcMain.on('window:drag-move', (_e, cursor) => {
    win.dragMove(screen.getCursorScreenPoint());
  });
  ipcMain.on('window:drag-end', () => win.dragEnd(store));

  ipcMain.on('window:size', (_e, { width, height }) => {
    win.setExpandedSize(Math.round(width), Math.round(height));
  });

  ipcMain.on('window:hide', () => win.getWindow()?.hide());

  // ---------- weather ----------
  ipcMain.handle('weather:get', async (_e, opts) => {
    try {
      return { ok: true, data: await weather.fetchAll(opts) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('weather:search', async (_e, keyword) => {
    try {
      return { ok: true, data: await weather.searchCity(keyword) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('weather:set-city', async (_e, city) => {
    store.set('city', city);
    try {
      const data = await weather.fetchAll({ force: true });
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ---------- alarm ----------
  ipcMain.handle('alarm:list', () => {
    const next = alarms.next();
    return { list: alarms.list(), next };
  });

  ipcMain.handle('alarm:add', (_e, payload) => {
    alarms.add(payload);
    return { list: alarms.list(), next: alarms.next() };
  });

  ipcMain.handle('alarm:remove', (_e, id) => {
    alarms.remove(id);
    return { list: alarms.list(), next: alarms.next() };
  });

  ipcMain.handle('alarm:update', (_e, { id, patch }) => {
    alarms.update(id, patch);
    return { list: alarms.list(), next: alarms.next() };
  });

  ipcMain.on('alarm:snooze', (_e, id) => alarms.snooze(id));
  ipcMain.on('alarm:ack', () => {}); // 界面已接管，主进程无需处理

  // ---------- app ----------
  ipcMain.handle('app:settings', () => ({
    theme: store.get('theme'),
    sound: store.get('sound'),
    autoLaunch: app.getLoginItemSettings().openAtLogin,
    version: VERSION,
  }));

  ipcMain.handle('app:set-theme', (_e, theme) => {
    store.set('theme', theme);
    return theme;
  });

  ipcMain.handle('app:set-sound', (_e, sound) => {
    store.set('sound', !!sound);
    return !!sound;
  });

  ipcMain.handle('app:set-auto-launch', (_e, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: process.execPath });
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.on('app:open-external', (_e, url) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });

  ipcMain.on('app:quit', () => onQuit());
}

module.exports = { registerIpc };
