/**
 * 图标库（全部内联 SVG，零外部依赖）
 * ------------------------------------------------------------------
 * 统一规格：24×24 viewBox，1.7 线宽，圆头圆角，颜色继承 currentColor。
 * 天气图标按和风天气 icon 码映射，见 iconName()。
 */

const S = (body, { fill = 'none' } = {}) =>
  `<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

// ---- 天气 ----
const CLOUD_PATH =
  'M7 18h9.6a3.4 3.4 0 0 0 .3-6.78 5.6 5.6 0 0 0-10.7-1.1A3.9 3.9 0 0 0 7 18Z';

const WEATHER = {
  sun: S(
    '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 3.2v1.6M12 19.2v1.6M3.2 12h1.6M19.2 12h1.6M5.8 5.8l1.1 1.1M17.1 17.1l1.1 1.1M18.2 5.8l-1.1 1.1M6.9 17.1l-1.1 1.1"/>'
  ),
  moon: S('<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>'),
  partly: S(
    '<circle cx="8.4" cy="8.6" r="2.7"/>' +
      '<path d="M8.4 3.6v1.2M3.4 8.6h1.2M5.1 5.3l.85.85M11.7 5.3l-.85.85"/>' +
      '<path d="M10.2 19h7.4a2.9 2.9 0 0 0 .25-5.78 4.7 4.7 0 0 0-8.98-.92A3.3 3.3 0 0 0 10.2 19Z"/>'
  ),
  cloud: S(`<path d="${CLOUD_PATH}"/>`),
  rain: S(
    `<path d="${CLOUD_PATH}"/>` +
      '<path d="M9 20.4l-.9 1.8M12.6 20.4l-.9 1.8M16.2 20.4l-.9 1.8"/>'
  ),
  snow: S(
    `<path d="${CLOUD_PATH}"/>` +
      '<path d="M9.2 20.2v2M8.3 21.2h1.8M15.4 20.2v2M14.5 21.2h1.8"/>'
  ),
  thunder: S(
    `<path d="${CLOUD_PATH}"/>` +
      '<path d="M13.2 19.2l-2.6 3.4h3.1l-.7 2.2"/>'
  ),
  fog: S(
    '<path d="M5 9.5h11M8 13.5h11M5 17.5h9M12 21.2h6" opacity=".9"/>'
  ),
  unknown: S('<circle cx="12" cy="12" r="8.2"/><path d="M12 8.4v4.4M12 15.8v.1"/>'),
};

/** 和风天气 icon 码 → 图形名 */
export function iconName(code) {
  const c = Number(code);
  if (c === 100) return 'sun';
  if (c === 150) return 'moon';
  if ([101, 102, 103].includes(c)) return 'partly';
  if ([151, 152, 153].includes(c)) return 'partly';
  if (c === 104) return 'cloud';
  if ([302, 303, 304].includes(c)) return 'thunder';
  if (c >= 300 && c < 400) return 'rain';
  if (c >= 400 && c < 500) return 'snow';
  if (c >= 500 && c < 600) return 'fog';
  if (c === 900) return 'sun';
  if (c === 901) return 'snow';
  return 'unknown';
}

/** 取天气图标 SVG 字符串 */
export function weatherIcon(code) {
  return WEATHER[iconName(code)] || WEATHER.unknown;
}

// ---- 界面 ----
export const UI = {
  bell: S('<path d="M6.5 9.8a5.5 5.5 0 0 1 11 0c0 3.2.8 4.6 1.6 5.5H4.9c.8-.9 1.6-2.3 1.6-5.5Z"/><path d="M10 18.4a2 2 0 0 0 4 0"/>'),
  gear: S(
    '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.3 14.2a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.75 2.75l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.94 1.94 0 0 1-3.88 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.94 1.94 0 1 1-2.75-2.75l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.17a1.94 1.94 0 0 1 0-3.88h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.94 1.94 0 1 1 2.75-2.75l.06.06a1.6 1.6 0 0 0 1.77.32h.08a1.6 1.6 0 0 0 .97-1.47v-.17a1.94 1.94 0 0 1 3.88 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.75 2.75l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.94 1.94 0 0 1 0 3.88h-.09a1.6 1.6 0 0 0-1.47.97Z"/>'
  ),
  x: S('<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>'),
  trash: S('<path d="M5 7.5h14M9.5 7.5V5.6A1.1 1.1 0 0 1 10.6 4.5h2.8a1.1 1.1 0 0 1 1.1 1.1v1.9M7 7.5l.8 11.2a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7.5"/>'),
  plus: S('<path d="M12 5.5v13M5.5 12h13"/>'),
  search: S('<circle cx="11" cy="11" r="6.2"/><path d="M15.6 15.6l4 4"/>'),
  pin: S('<path d="M12 21.2s6.4-5.6 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15.6 12 21.2 12 21.2Z"/><circle cx="12" cy="10.6" r="2.3"/>'),
  refresh: S('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4.6V10h-5.4"/>'),
  volume: S('<path d="M11 5.5 6.6 9H4v6h2.6L11 18.5V5.5Z"/><path d="M15 9.2a3.9 3.9 0 0 1 0 5.6M17.6 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
  power: S('<path d="M12 4v7"/><path d="M7.3 7.3a7 7 0 1 0 9.4 0"/>'),
  sun2: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4"/>'),
  moon2: S('<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>'),
  auto: S('<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6v16.8" stroke-dasharray="2.4 2.6"/>'),
};
