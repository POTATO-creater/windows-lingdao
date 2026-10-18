/**
 * 主进程入口
 * ------------------------------------------------------------------
 * 装配顺序：单实例锁 → 存储 → 服务 → 窗口 → 托盘 → IPC → 定时任务。
 * 这个文件只负责「把各模块接起来」，业务逻辑都在 services/ 与 window.js。
 */

const { app, Notification, nativeTheme } = require('electron');
const { Store } = require('./services/store');
const { WeatherService } = require('./services/weather');
const { AlarmService } = require('./services/alarm');
const win = require('./window');
const tray = require('./tray');
const { registerIpc } = require('./ipc');
const { QWEATHER } = require('./config');

// 单实例：重复启动时把已有窗口叫出来
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = win.getWindow();
    if (w) {
      w.showInactive();
      w.setAlwaysOnTop(true, 'floating');
    }
  });
}

let store;
let weather;
let alarms;
let refreshTimer;

app.whenReady().then(async () => {
  store = new Store();
  weather = new WeatherService(store);
  alarms = new AlarmService(store, onAlarmFire);

  win.createWindow({ store });
  registerIpc({ store, weather, alarms, onQuit: quit });
  tray.createTray({
    store,
    weather,
    win,
    onRefresh: () => pushWeather({ force: true }),
    onQuit: quit,
  });

  applyTheme(store.get('theme'));

  // 首次拉取天气 + 定时刷新
  pushWeather({ force: true });
  refreshTimer = setInterval(() => pushWeather({ force: true }), QWEATHER.refreshInterval);

  alarms.start();

  // 窗口就绪后补推一次（renderer 可能比网络快）
  win.getWindow()?.webContents.once('did-finish-load', () => {
    applyTheme(store.get('theme'));
  });
});

// 托盘常驻：窗口被关掉也不退出进程（不注册默认的 app.quit）
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  if (refreshTimer) clearInterval(refreshTimer);
  alarms?.stop();
  store?.flush();
});

/**
 * 拉取并推送天气到界面。
 * 失败时把错误也推过去，界面显示「连接失败」而不是空白。
 */
async function pushWeather(opts) {
  const w = win.getWindow();
  if (!w || w.isDestroyed()) return;
  try {
    const data = await weather.fetchAll(opts);
    w.webContents.send('weather:update', { ok: true, data });
  } catch (err) {
    w.webContents.send('weather:update', { ok: false, error: err.message });
    // 失败后 1 分钟快速重试一次
    setTimeout(() => pushWeather({ force: true }), QWEATHER.retryInterval);
  }
}

/** 闹钟触发：展开胶囊 + 通知界面 + 系统通知 */
function onAlarmFire(alarm) {
  const w = win.getWindow();
  if (!w || w.isDestroyed()) return;
  w.showInactive();
  w.setAlwaysOnTop(true, 'floating');
  win.setMode('expanded', { store });
  w.webContents.send('alarm:fire', alarm);

  if (Notification.isSupported()) {
    const n = new Notification({
      title: alarm.label || '闹钟',
      body: `${String(alarm.hour).padStart(2, '0')}:${String(alarm.minute).padStart(2, '0')} 到了`,
      silent: true, // 铃声由界面统一播放，避免双响
    });
    n.on('click', () => {
      w.show();
      w.focus();
    });
    n.show();
  }
}

/** 主题：system 时跟随 Windows 深浅色 */
function applyTheme(theme) {
  const effective =
    theme === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : theme;
  win.getWindow()?.webContents.send('app:theme-changed', theme, effective);
}

nativeTheme.on('updated', () => {
  if (store?.get('theme') === 'system') applyTheme('system');
});

function quit() {
  store?.flush();
  app.exit(0);
}
