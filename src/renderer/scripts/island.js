/**
 * 灵动岛形变与交互
 * ------------------------------------------------------------------
 * 负责三件事：
 *   1. 收起 / 展开的尺寸形变（弹簧驱动 CSS 变量，可随时打断）
 *   2. 顶栏拖拽移动窗口（4px 阈值区分「点击」与「拖拽」）
 *   3. 分段控制器（天气 / 闹钟 / 设置）的切换
 *
 * 与主进程的配合：窗口尺寸永远比胶囊大 20px（四周各 10px 留给投影），
 * 展开时先进窗口、再播形变；收起时先播形变、再收窗口。
 */

import { createSpring } from './spring.js';

const api = window.lingdao;

// 胶囊逻辑尺寸（窗口尺寸 = 这里 + 20）
const SIZE = {
  collapsed: { w: 300, h: 64, r: 32 },
  expanded: { w: 404, h: 600, r: 40 },
};

// 每个标签页内容高度不同，卡片刚好包住内容 —— 这才是「灵动」的核心。
// 下面两个是兜底值，真实高度运行时由 measureHeight() 量出来。
const TAB_HEIGHT = { weather: 600, alarm: 560, settings: 500 };
const WIN_PAD = 20; // 窗口比胶囊大 20px（四周各 10px 留投影）
const BAR_H = 64;
const BODY_PAD = { top: 2, bottom: 22 };
const MAX_H = 640;

let expandedH = TAB_HEIGHT.weather;
let morphTimer = null;

/**
 * 量出内容真实高度。
 * 注意：要量的是滚动容器而不是 panel —— 分段控制器在 panel 外面，
 * 只量 panel 会少算 30 多像素。scrollHeight 会包含当前显示面板的全部内容。
 */
function measureHeight() {
  // 滚动容器默认 height:100%，scrollHeight 不会小于可视高度，量不出「变小」。
  // 临时切成 auto，让它按内容塌下来再读，读完立刻还原（同一帧内完成，不会闪烁）。
  const prev = scrollEl.style.height;
  scrollEl.style.height = 'auto';
  const contentH = scrollEl.scrollHeight;
  scrollEl.style.height = prev;
  return Math.min(MAX_H, Math.round(contentH + BAR_H + BODY_PAD.top + BODY_PAD.bottom));
}

/**
 * 内容变化（数据到达、表单展开、删除条目）时重新测量。
 * 用 ResizeObserver 而不是在每个业务模块里手动通知，避免耦合。
 */
let remeasureTimer = null;
function scheduleRemeasure() {
  clearTimeout(remeasureTimer);
  remeasureTimer = setTimeout(() => {
    if (state !== 'expanded') return;
    const target = measureHeight();
    if (Math.abs(target - expandedH) > 4) {
      expandedH = target;
      morphHeight(target);
    }
    // 展开态的高度也要让主进程知道，下次展开才能一次到位
    api.setSize({ width: SIZE.expanded.w + WIN_PAD, height: target + WIN_PAD });
  }, 80);
}

const appEl = document.getElementById('app');
const islandEl = document.getElementById('island');
const barEl = document.getElementById('bar');
const scrollEl = document.getElementById('scrollArea');

let state = 'collapsed';
let w = SIZE.collapsed.w;
let h = SIZE.collapsed.h;

// 形变弹簧：阻尼 0.82 / 响应 0.34 —— 比默认稍弹，因为这是「有动量的展开」
const SPRING = { damping: 0.82, response: 0.34 };

const springW = createSpring({
  value: w,
  ...SPRING,
  restDelta: 0.15,
  onUpdate: (v) => {
    w = v;
    paint();
  },
});

const springH = createSpring({
  value: h,
  ...SPRING,
  restDelta: 0.15,
  onUpdate: (v) => {
    h = v;
    paint();
  },
});

/** 每帧把尺寸写进 CSS 变量 */
function paint() {
  islandEl.style.setProperty('--iw', `${w.toFixed(2)}px`);
  islandEl.style.setProperty('--ih', `${h.toFixed(2)}px`);
  // 圆角随宽度线性过渡：32 → 40，避免展开瞬间圆角突变
  const t = (w - SIZE.collapsed.w) / (SIZE.expanded.w - SIZE.collapsed.w);
  islandEl.style.setProperty('--ir', `${(SIZE.collapsed.r + t * (SIZE.expanded.r - SIZE.collapsed.r)).toFixed(2)}px`);
}

// ---------------- 展开 / 收起 ----------------

export function expand() {
  if (state === 'expanded') return;
  state = 'expanded';
  api.setMode('expanded');
  // 等两帧：让主进程先把窗口放大，否则形变内容会被窗口硬裁
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      appEl.dataset.state = 'expanded';
      springW.to(SIZE.expanded.w);
      springH.to(expandedH);
    });
  });
}

export function collapse() {
  if (state === 'collapsed') return;
  state = 'collapsed';
  appEl.dataset.state = 'collapsed';
  springW.to(SIZE.collapsed.w);
  springH.to(SIZE.collapsed.h);
  // 主进程内部会等 420ms 再缩窗口，与上面动画同时结束
  api.setMode('collapsed');
}

export function toggle() {
  state === 'expanded' ? collapse() : expand();
}

export function isExpanded() {
  return state === 'expanded';
}

// ---------------- 顶栏：点击展开 + 拖拽移动 ----------------

let drag = null;

barEl.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return; // 按钮上的按下不算拖拽
  drag = { x: e.screenX, y: e.screenY, moved: false };
  try {
    barEl.setPointerCapture(e.pointerId);
  } catch {}
  api.dragStart({ x: e.screenX, y: e.screenY });
});

barEl.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.screenX - drag.x;
  const dy = e.screenY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 4) {
    drag.moved = true;
    islandEl.classList.add('is-dragging');
  }
  if (drag.moved) api.dragMove({ x: e.screenX, y: e.screenY });
});

function endDrag(e) {
  if (!drag) return;
  const wasMoved = drag.moved;
  drag = null;
  islandEl.classList.remove('is-dragging');
  try {
    barEl.releasePointerCapture(e.pointerId);
  } catch {}
  api.dragEnd();
  // 没移动 → 当作一次点击
  if (!wasMoved) {
    if (state === 'collapsed') expand();
  }
}

barEl.addEventListener('pointerup', endDrag);
barEl.addEventListener('pointercancel', endDrag);

// hover 轻微膨胀
islandEl.addEventListener('pointerenter', () => islandEl.classList.add('is-hover'));
islandEl.addEventListener('pointerleave', () => islandEl.classList.remove('is-hover'));

// Esc 收起
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state === 'expanded') collapse();
});

// ---------------- 分段控制器 ----------------

const tabSeg = document.getElementById('tabSeg');
const segThumb = document.getElementById('segThumb');
const themeSeg = document.getElementById('themeSeg');
const themeThumb = document.getElementById('themeThumb');

/** 把滑块移到指定序号的选项上 */
function moveThumb(seg, thumb, index) {
  const items = seg.querySelectorAll('.segmented__item');
  const item = items[index];
  if (!item) return;
  thumb.style.width = `${item.offsetWidth}px`;
  thumb.style.transform = `translateX(${item.offsetLeft - 3}px)`;
}

export function setTab(tab) {
  appEl.dataset.tab = tab;
  const panels = document.querySelectorAll('.panel');
  panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === tab));

  const items = tabSeg.querySelectorAll('.segmented__item');
  items.forEach((it, i) => {
    const on = it.dataset.tab === tab;
    it.setAttribute('aria-selected', String(on));
    if (on) moveThumb(tabSeg, segThumb, i);
  });
  scrollEl.scrollTop = 0;

  // 等一帧：面板刚切换，布局还没落定
  requestAnimationFrame(() => {
    const targetH = measureHeight();
    if (state === 'expanded') morphHeight(targetH);
    expandedH = targetH;
  });
}

/**
 * 展开态下切换高度。
 * 变高 → 先撑开窗口再长高（多出来的区域透明，不影响观感）；
 * 变矮 → 先缩短，动画结束再收窗口（否则内容会被硬裁）。
 */
function morphHeight(targetH) {
  if (Math.abs(targetH - expandedH) < 1) return;
  const winW = SIZE.expanded.w + WIN_PAD;
  const winH = targetH + WIN_PAD;
  clearTimeout(morphTimer);

  if (targetH > h) {
    api.setSize({ width: winW, height: winH });
    springH.to(targetH);
  } else {
    springH.to(targetH);
    morphTimer = setTimeout(() => api.setSize({ width: winW, height: winH }), 380);
  }
}

tabSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented__item');
  if (btn) setTab(btn.dataset.tab);
});

export function syncThemeThumb(theme) {
  const items = themeSeg.querySelectorAll('.segmented__item');
  let idx = 0;
  items.forEach((it, i) => {
    const on = it.dataset.themeOpt === theme;
    it.setAttribute('aria-selected', String(on));
    if (on) idx = i;
  });
  moveThumb(themeSeg, themeThumb, idx);
}

themeSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented__item');
  if (!btn) return;
  const theme = btn.dataset.themeOpt;
  api.setTheme(theme);
  syncThemeThumb(theme);
});

// 窗口尺寸变化后只重算滑块位置。
// 注意：这里不能调 setTab —— 那会重播面板入场动画，展开时会闪。
function realignThumbs() {
  const active = tabSeg.querySelector('.segmented__item[aria-selected="true"]');
  if (active) {
    moveThumb(tabSeg, segThumb, [...tabSeg.querySelectorAll('.segmented__item')].indexOf(active));
  }
  const tActive = themeSeg.querySelector('.segmented__item[aria-selected="true"]');
  if (tActive) {
    moveThumb(themeSeg, themeThumb, [...themeSeg.querySelectorAll('.segmented__item')].indexOf(tActive));
  }
}
window.addEventListener('resize', realignThumbs);

export function initIsland() {
  paint();

  const ro = new ResizeObserver(() => scheduleRemeasure());
  document.querySelectorAll('.panel').forEach((p) => ro.observe(p));
  setTab('weather');
  // 字体加载完成后再摆滑块，避免宽度算错
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => setTab(appEl.dataset.tab || 'weather'));
  }
  api.onBlur(() => {
    if (state === 'expanded') collapse();
  });
  document.getElementById('btnCollapse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    collapse();
  });
  scrollEl.addEventListener('scroll', () => {
    scrollEl.classList.add('is-scrolling');
    clearTimeout(scrollEl._t);
    scrollEl._t = setTimeout(() => scrollEl.classList.remove('is-scrolling'), 700);
  });
}
