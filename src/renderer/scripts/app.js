/**
 * 渲染层装配入口
 * ------------------------------------------------------------------
 * 只做三件事：注入图标、接主进程推送、绑定设置项。
 * 具体业务在 island / weather-view / alarm-view 里。
 */

import { UI } from './icons.js';
import { initIsland, setTab, syncThemeThumb, expand, collapse } from './island.js';
import { startClock, onMinute } from './clock.js';
import {
  renderWeather,
  renderWeatherError,
  renderWeatherLoading,
  initWeatherUi,
} from './weather-view.js';
import { initAlarmUi, refreshAlarms, showRing, setSoundEnabled } from './alarm-view.js';

const api = window.lingdao;

// ---------------- 图标注入 ----------------
function injectIcons() {
  document.querySelectorAll('.ico[data-icon]').forEach((node) => {
    const svg = UI[node.dataset.icon];
    if (svg) node.innerHTML = svg;
  });
}

// ---------------- 主题 ----------------
function applyTheme(effective) {
  document.documentElement.dataset.theme = effective === 'light' ? 'light' : 'dark';
}

function initTheme() {
  // 主进程还没推之前，先用系统偏好兜底，避免闪一下深色
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  applyTheme(mq.matches ? 'light' : 'dark');

  api.onThemeChanged((theme, effective) => {
    applyTheme(effective);
    syncThemeThumb(theme);
  });
}

// ---------------- 设置 ----------------
async function initSettings() {
  const settings = await api.getSettings();
  setSoundEnabled(settings.sound);
  syncThemeThumb(settings.theme || 'system');

  const swSound = document.getElementById('swSound');
  const swAuto = document.getElementById('swAuto');
  swSound?.setAttribute('aria-checked', String(!!settings.sound));
  swAuto?.setAttribute('aria-checked', String(!!settings.autoLaunch));

  const bindSwitch = (el, initial, onChange) => {
    if (!el) return;
    let on = initial;
    const toggle = () => {
      on = !on;
      el.setAttribute('aria-checked', String(on));
      onChange(on);
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  };

  bindSwitch(swSound, !!settings.sound, async (on) => {
    await api.setSound(on);
    setSoundEnabled(on);
  });

  bindSwitch(swAuto, !!settings.autoLaunch, (on) => api.setAutoLaunch(on));

  document.getElementById('btnQuit')?.addEventListener('click', () => api.quit());
  document.getElementById('appVersion').textContent = `v${settings.version}`;
}

// ---------------- 主进程推送 ----------------
function bindPush() {
  api.onWeatherUpdate((res) => {
    if (res.ok) renderWeather(res.data);
    else renderWeatherError(res.error);
  });

  api.onAlarmFire((alarm) => {
    // 主进程已经帮忙展开了窗口，这里直接响铃
    expand();
    setTab('alarm');
    showRing(alarm);
  });
}

// ---------------- 启动 ----------------
async function boot() {
  injectIcons();
  initTheme();
  initIsland();
  bindPush();
  initWeatherUi();
  initAlarmUi();
  startClock();
  initSettings();

  renderWeatherLoading();

  // 每分钟校正一次「下一个闹钟」的倒计时文案
  onMinute(() => refreshAlarms());

  // 主动拉一次，覆盖「窗口比网络先就绪」的情况
  const res = await api.getWeather();
  if (res.ok) renderWeather(res.data);
  else if (res.error) renderWeatherError(res.error);
}

boot();

// 调试出口：方便截图脚本和后续自己加功能时手动调度
// 用法（DevTools 控制台）：__island.expand() / __island.setTab('alarm')
window.__island = {
  expand,
  collapse,
  setTab,
  theme: (mode) => applyTheme(mode),
};
