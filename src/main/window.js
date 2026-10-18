/**
 * 灵动岛窗口
 * ------------------------------------------------------------------
 * 关键设计：
 * 1. 窗口本身是「紧贴胶囊」的透明盒子，圆角之外没有多余区域，
 *    因此不需要 setIgnoreMouseEvents 穿透逻辑，点击 100% 准确。
 * 2. 展开/收起时窗口尺寸分两段处理：
 *    展开 → 先把窗口放大（此时内容还不可见），再播 CSS 形变；
 *    收起 → 先播 CSS 形变，动画结束后再回收窗口。
 *    视觉上完全连续，且避免了「每帧改窗口大小」导致的卡顿。
 * 3. 位置以「顶部中心」为锚点缩放，并记住用户拖动后的位置。
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { WINDOW } = require('./config');

let win = null;
let dragState = null;
let collapseTimer = null;

function createWindow({ store }) {
  const saved = store.get('position');
  const { x, y } = resolveInitialPosition(saved);

  win = new BrowserWindow({
    width: WINDOW.collapsed.width,
    height: WINDOW.collapsed.height,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.once('ready-to-show', () => {
    win.showInactive(); // 不抢焦点，避免打断用户当前输入
  });

  // 窗口失焦时通知界面收起（点桌面任意位置）
  win.on('blur', () => {
    win.webContents.send('island:blur');
  });

  win.on('closed', () => {
    win = null;
  });

  return win;
}

function resolveInitialPosition(saved) {
  const area = screen.getPrimaryDisplay().workArea;
  const w = WINDOW.collapsed.width;
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    // 校验是否还在可见屏幕内（防止换显示器后窗口跑丢）
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return saved.x >= a.x - w && saved.x <= a.x + a.width && saved.y >= a.y - 40 && saved.y <= a.y + a.height;
    });
    if (visible) return { x: Math.round(saved.x), y: Math.round(saved.y) };
  }
  return { x: Math.round(area.x + (area.width - w) / 2), y: area.y + WINDOW.topMargin };
}

/** 当前窗口是否已经处于展开尺寸 */
let expanded = false;
/** 记住上一次展开用的尺寸：不同标签页内容高度不同，收起再展开要回到原位 */
let lastExpanded = { width: WINDOW.expanded.width, height: WINDOW.expanded.height };

/**
 * 请求切换窗口尺寸。
 * @param {'expanded'|'collapsed'} mode
 */
function setMode(mode, { store } = {}) {
  if (!win) return;
  const target = mode === 'expanded' ? lastExpanded : WINDOW.collapsed;

  if (mode === 'expanded') {
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
    if (expanded) return;
    expanded = true;
    // 立即放大：此时展开动画还没开始，多出来的区域是透明的
    resizeAnchored(target.width, target.height);
  } else {
    if (!expanded) return;
    expanded = false;
    // 等收起动画播完再缩窗口，否则内容会被硬裁切
    collapseTimer = setTimeout(() => {
      resizeAnchored(target.width, target.height);
      collapseTimer = null;
      if (store) store.set('position', win.getBounds());
    }, WINDOW.collapseDelay);
  }
}

/**
 * 展开态下切换标签页时改变高度（内容多少不同，卡片应当刚好包住内容）
 * 由渲染进程在切换页签时调用。
 */
function setExpandedSize(width, height) {
  lastExpanded = { width, height };
  if (expanded) resizeAnchored(width, height);
}

/** 以顶部中心为锚点改变尺寸 */
function resizeAnchored(width, height) {
  if (!win) return;
  const b = win.getBounds();
  const x = Math.round(b.x + b.width / 2 - width / 2);
  win.setBounds({ x, y: b.y, width, height }, false);
}

// ---- 拖拽 ----

function dragStart(cursor) {
  if (!win) return;
  dragState = { cursor, bounds: win.getBounds() };
}

function dragMove(cursor) {
  if (!win || !dragState) return;
  const dx = cursor.x - dragState.cursor.x;
  const dy = cursor.y - dragState.cursor.y;
  win.setPosition(Math.round(dragState.bounds.x + dx), Math.round(dragState.bounds.y + dy), false);
}

function dragEnd(store) {
  if (!win || !dragState) return;
  dragState = null;
  if (store) store.set('position', win.getBounds());
}

function getWindow() {
  return win;
}

function toggleVisible() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else {
    win.showInactive();
    win.setAlwaysOnTop(true, 'floating');
  }
}

module.exports = {
  createWindow,
  getWindow,
  setMode,
  setExpandedSize,
  dragStart,
  dragMove,
  dragEnd,
  toggleVisible,
};
