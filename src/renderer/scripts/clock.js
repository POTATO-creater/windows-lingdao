/**
 * 时钟
 * ------------------------------------------------------------------
 * 顶栏时间每秒刷新；只在「闹钟页且展开」时显示秒，其余时候保持安静
 * （信息按需出现，是苹果克制的信息层级做法）。
 */

const barTime = document.getElementById('barTime');
const barSec = document.getElementById('barSec');
const alNow = document.getElementById('alNow');

const pad = (n) => String(n).padStart(2, '0');

let lastMinute = -1;
const listeners = new Set();

/** 每分钟变化时触发（给需要「按分钟」响应的模块用，如闹钟列表） */
export function onMinute(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function tick() {
  const d = new Date();
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  barTime.textContent = `${hh}:${mm}`;
  barSec.textContent = ss;
  if (alNow) alNow.innerHTML = `<span>${hh}:${mm}</span><small>现在</small>`;

  if (d.getMinutes() !== lastMinute) {
    lastMinute = d.getMinutes();
    listeners.forEach((cb) => cb(d));
  }
  // 对齐到下一个整秒，避免累积漂移
  setTimeout(tick, 1000 - (Date.now() % 1000));
}

export function startClock() {
  tick();
}
