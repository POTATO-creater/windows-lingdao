/**
 * 系统托盘
 * ------------------------------------------------------------------
 * 菜单：显示/隐藏、立即刷新天气、主题、开机自启、退出。
 * 图标来自 ./icon.js 内联的 data URL，不依赖外部 png 文件。
 */

const { Tray, Menu, nativeImage, app } = require('electron');
const { TRAY_ICON_DATAURL } = require('./icon');

let tray = null;

function createTray({ store, weather, win, onRefresh, onQuit }) {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATAURL).resize({ width: 18, height: 18 });
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('灵动岛');

  const rebuild = () => {
    const theme = store.get('theme');
    const menu = Menu.buildFromTemplate([
      {
        label: win.getWindow()?.isVisible() ? '隐藏灵动岛' : '显示灵动岛',
        click: () => {
          win.toggleVisible();
          rebuild();
        },
      },
      { label: '刷新天气', click: () => onRefresh() },
      { type: 'separator' },
      {
        label: '外观',
        submenu: [
          { label: '跟随系统', type: 'radio', checked: theme === 'system', click: () => setTheme('system') },
          { label: '深色', type: 'radio', checked: theme === 'dark', click: () => setTheme('dark') },
          { label: '浅色', type: 'radio', checked: theme === 'light', click: () => setTheme('light') },
        ],
      },
      {
        label: '开机自动启动',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, path: process.execPath });
        },
      },
      { type: 'separator' },
      { label: '退出', click: onQuit },
    ]);
    tray.setContextMenu(menu);
  };

  const setTheme = (theme) => {
    store.set('theme', theme);
    win.getWindow()?.webContents.send('app:theme-changed', theme);
    rebuild();
  };

  tray.on('click', () => {
    win.toggleVisible();
    rebuild();
  });

  rebuild();
  return { tray, rebuild };
}

function destroyTray() {
  if (tray) tray.destroy();
  tray = null;
}

module.exports = { createTray, destroyTray };
