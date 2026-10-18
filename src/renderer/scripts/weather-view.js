/**
 * 天气面板渲染
 * ------------------------------------------------------------------
 * 数据来自主进程推送（weather:update），这里只负责「把数据变成界面」。
 * 包括：收起态顶栏、大温度、详情网格、12 小时曲线、三日预报。
 */

import { weatherIcon } from './icons.js';

const api = window.lingdao;

const el = {
  barTemp: document.getElementById('barTemp'),
  barCity: document.getElementById('barCity'),
  barWxIcon: document.getElementById('barWxIcon'),
  barWxIcon2: document.getElementById('barWxIcon2'),
  temp: document.getElementById('wxTemp'),
  text: document.getElementById('wxText'),
  range: document.getElementById('wxRange'),
  updated: document.getElementById('wxUpdated'),
  feels: document.getElementById('wxFeels'),
  hum: document.getElementById('wxHum'),
  wind: document.getElementById('wxWind'),
  vis: document.getElementById('wxVis'),
  chart: document.getElementById('wxChart'),
  chartLabels: document.getElementById('wxChartLabels'),
  days: document.getElementById('wxDays'),
};

let latest = null;

const pad = (n) => String(n).padStart(2, '0');
const weekName = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
};

/** 渲染整包数据 */
export function renderWeather(pack) {
  if (!pack?.now) return;
  latest = pack;
  const { now, daily, hourly, city } = pack;

  // ---- 顶栏 ----
  el.barTemp.textContent = `${Math.round(now.temp)}°`;
  el.barCity.textContent = city.name;
  const icon = weatherIcon(now.icon);
  el.barWxIcon.innerHTML = icon;
  el.barWxIcon2.innerHTML = icon;
  el.barWxIcon.style.display = '';
  el.barWxIcon2.style.display = '';

  // ---- 主体 ----
  el.temp.textContent = Math.round(now.temp);
  el.text.textContent = now.text;
  const today = daily[0];
  el.range.textContent = today ? `${today.tempMax}° / ${today.tempMin}°` : '';
  el.feels.innerHTML = `${Math.round(now.feelsLike)}<small>°</small>`;
  el.hum.innerHTML = `${now.humidity}<small>%</small>`;
  el.wind.textContent = `${now.windDir.replace('风', '')} ${now.windScale}级`;
  el.vis.innerHTML = `${now.vis}<small>km</small>`;

  const t = new Date(pack.updatedAt);
  el.updated.textContent = `${pad(t.getHours())}:${pad(t.getMinutes())} 更新`;

  renderChart(hourly);
  renderDays(daily);
}

/** 12 小时温度曲线 */
function renderChart(hourly) {
  if (!hourly?.length) {
    el.chart.innerHTML = '';
    el.chartLabels.innerHTML = '';
    return;
  }
  const W = 340;
  const H = 64;
  const PAD_T = 9;
  const PAD_B = 11;
  const n = hourly.length;
  const temps = hourly.map((h) => h.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(1, max - min);

  const pts = hourly.map((h, i) => {
    const x = (i / (n - 1)) * W;
    const y = PAD_T + (1 - (h.temp - min) / span) * (H - PAD_T - PAD_B);
    return [x, y];
  });

  // 平滑曲线：用 Catmull-Rom 转三次贝塞尔，比折线更接近 Apple 天气的手绘感
  const line = smoothPath(pts);
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  el.chart.innerHTML = `
    <defs>
      <linearGradient id="wxGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--chart-fill-a)"/>
        <stop offset="100%" stop-color="var(--chart-fill-b)"/>
      </linearGradient>
    </defs>
    <path class="wx-chart__area" d="${area}" fill="url(#wxGrad)"/>
    <path class="wx-chart__line" d="${line}"/>
    <circle class="wx-chart__dot" cx="${pts[0][0]}" cy="${pts[0][1]}" r="2.6"/>
  `;

  // 均匀取 5 个时间点，比按固定步长取更整齐
  const ticks = [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((n - 1) * 0.75), n - 1];
  el.chartLabels.innerHTML = ticks
    .map((i) => `<span>${hourly[i].time.slice(11, 13)}时</span>`)
    .join('');
}

/** Catmull-Rom → 贝塞尔平滑路径 */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** 三日预报 */
function renderDays(daily) {
  if (!daily?.length) {
    el.days.innerHTML = '';
    return;
  }
  // 温度条按整段的最高/最低做归一化，才能横向对比
  const allMax = Math.max(...daily.map((d) => d.tempMax));
  const allMin = Math.min(...daily.map((d) => d.tempMin));
  const span = Math.max(1, allMax - allMin);

  el.days.innerHTML = daily
    .map((d) => {
      const left = ((d.tempMin - allMin) / span) * 100;
      const width = ((d.tempMax - d.tempMin) / span) * 100;
      return `
        <div class="wx-day">
          <span class="wx-day__name">${weekName(d.date)}</span>
          <span class="wx-day__icon">${weatherIcon(d.iconDay)}</span>
          <span class="wx-day__text">${d.textDay}</span>
          <span class="wx-day__bar"><i style="left:${left.toFixed(1)}%;width:${Math.max(width, 6).toFixed(1)}%"></i></span>
          <span class="wx-day__range">${d.tempMax}° <span>${d.tempMin}°</span></span>
        </div>`;
    })
    .join('');
}

/** 出错态：不清空旧数据，只在更新时间处标红提示 */
export function renderWeatherError(msg) {
  if (!latest) {
    el.text.textContent = '连接失败';
    el.updated.textContent = msg || '请检查网络';
  } else {
    el.updated.textContent = `更新失败：${msg}`;
  }
}

/** 首次进入的加载态 */
export function renderWeatherLoading() {
  el.updated.textContent = '正在获取天气…';
}

// ---------------- 城市搜索 ----------------

const cityPanel = document.getElementById('cityPanel');
const cityInput = document.getElementById('cityInput');
const cityResults = document.getElementById('cityResults');

export function initWeatherUi() {
  document.getElementById('btnRefresh')?.addEventListener('click', async () => {
    el.updated.textContent = '正在刷新…';
    const res = await api.getWeather({ force: true });
    if (res.ok) renderWeather(res.data);
    else renderWeatherError(res.error);
  });

  document.getElementById('btnCity')?.addEventListener('click', () => {
    cityPanel.hidden = !cityPanel.hidden;
    if (!cityPanel.hidden) {
      cityInput.value = '';
      cityResults.innerHTML = '';
      cityInput.focus();
    }
  });

  document.getElementById('btnCityClose')?.addEventListener('click', () => {
    cityPanel.hidden = true;
  });

  let timer = null;
  cityInput?.addEventListener('input', () => {
    clearTimeout(timer);
    const kw = cityInput.value.trim();
    if (!kw) {
      cityResults.innerHTML = '';
      return;
    }
    // 输入防抖 320ms，避免每键一次请求
    timer = setTimeout(async () => {
      const res = await api.searchCity(kw);
      if (!res.ok || !res.data.length) {
        cityResults.innerHTML = `<div class="city-item"><span>没有找到「${kw}」</span></div>`;
        return;
      }
      cityResults.innerHTML = res.data
        .map(
          (c) =>
            `<button class="city-item" data-id="${c.id}" data-name="${c.name}">
               <span>${c.name}</span><em>${c.adm1 || ''} ${c.adm2 || ''}</em>
             </button>`
        )
        .join('');
    }, 320);
  });

  cityResults?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.city-item');
    if (!btn || !btn.dataset.id) return;
    const city = { id: btn.dataset.id, name: btn.dataset.name, adm1: '' };
    cityPanel.hidden = true;
    el.updated.textContent = '切换城市…';
    const res = await api.setCity(city);
    if (res.ok) renderWeather(res.data);
    else renderWeatherError(res.error);
  });
}
