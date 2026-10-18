/**
 * 开发用截图脚本（不参与打包）
 * ------------------------------------------------------------------
 * 用 xvfb 无头跑起来，分别截「收起态 / 展开态-天气 / 展开态-闹钟」三张图，
 * 用于在没有 Windows 机器时检查视觉。
 *
 * 运行：xvfb-run -s "-screen 0 1280x900x24" npx electron tools/shot.js
 */

const { app, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 用临时 userData，避免污染真实配置
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lingdao-shot-'));
app.setPath('userData', tmp);

const { Store } = require('../src/main/services/store');
const { WeatherService } = require('../src/main/services/weather');
const { AlarmService } = require('../src/main/services/alarm');
const win = require('../src/main/window');
const { registerIpc } = require('../src/main/ipc');

const OUT = path.join(__dirname, '../.preview');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(name) {
  const w = win.getWindow();
  const img = await w.capturePage();
  fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
  console.log('saved', name, w.getBounds());
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = process.env.SHOT_THEME || 'dark';
  const store = new Store();
  store.set('alarms', [
    { id: 'a1', hour: 7, minute: 30, label: '起床', repeat: [1, 2, 3, 4, 5], enabled: true, lastFiredKey: null },
    { id: 'a2', hour: 9, minute: 0, label: '喝水', repeat: [1, 3, 5], enabled: true, lastFiredKey: null },
    { id: 'a3', hour: 22, minute: 45, label: '洗漱准备睡觉', repeat: [], enabled: false, lastFiredKey: null },
  ]);
  const weather = new WeatherService(store);
  const alarms = new AlarmService(store, () => {});
  alarms.start();

  win.createWindow({ store });
  registerIpc({ store, weather, alarms, onQuit: () => app.exit(0) });

  const w = win.getWindow();
  // 下移窗口，让截图上方留出壁纸，网页裁切后卡片不会贴边
  w.setPosition(Math.round(w.getBounds().x), 60);
  w.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message}  (${sourceId}:${line})`);
  });
  w.webContents.on('preload-error', (_e, f, err) => console.log('[preload-error]', f, err));
  await new Promise((r) => w.webContents.once('did-finish-load', r));

  // 等首屏数据
  const data = await weather.fetchAll({ force: true }).catch(() => null);
  if (data) w.webContents.send('weather:update', { ok: true, data });

  await sleep(1400);
  await shoot('01-collapsed');

  // 展开
  await w.webContents.executeJavaScript('window.__island.expand()');
  await sleep(1100);
  await shoot('02-weather');

  // 闹钟页
  await w.webContents.executeJavaScript("window.__island.setTab('alarm')");
  await sleep(700);
  await shoot('03-alarm');

  // 设置页
  await w.webContents.executeJavaScript("window.__island.setTab('settings')");
  await sleep(700);
  await shoot('04-settings');

  // 浅色主题
  // 响铃覆盖层
  await w.webContents.executeJavaScript("window.__island.setTab('alarm')");
  await sleep(500);
  w.webContents.send('alarm:fire', { id: 'a1', hour: 7, minute: 30, label: '起床', repeat: [1,2,3,4,5] });
  await sleep(1200);
  await shoot('06-ring');

  nativeTheme.themeSource = 'light';
  await w.webContents.executeJavaScript("window.__island.setTab('weather')");
  await sleep(700);
  await w.webContents.executeJavaScript("window.__island.theme('light')");
  await sleep(800);
  await shoot('05-light');

  app.exit(0);
});
