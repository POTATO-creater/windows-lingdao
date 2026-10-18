/**
 * 闹钟面板
 * ------------------------------------------------------------------
 * 列表渲染、新建表单、响铃覆盖层与铃声合成（WebAudio，无需音频文件）。
 */

import { UI } from './icons.js';

const api = window.lingdao;

const listEl = document.getElementById('alList');
const nextEl = document.getElementById('alNext');
const formHost = document.getElementById('alFormHost');
const ringEl = document.getElementById('ring');
const ringTime = document.getElementById('ringTime');
const ringLabel = document.getElementById('ringLabel');

const pad = (n) => String(n).padStart(2, '0');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

let alarms = [];
let next = null;
let ringing = null; // 当前响铃的闹钟

// ---------------- 列表 ----------------

/** 把 repeat 数组描述成自然语言 */
function describeRepeat(repeat) {
  if (!repeat.length) return '仅一次';
  if (repeat.length === 7) return '每天';
  const workdays = [1, 2, 3, 4, 5];
  if (repeat.length === 5 && workdays.every((d) => repeat.includes(d))) return '工作日';
  const weekend = [0, 6];
  if (repeat.length === 2 && weekend.every((d) => repeat.includes(d))) return '周末';
  return repeat.map((d) => `周${WEEK[d]}`).join(' ');
}

function renderList() {
  if (!alarms.length) {
    listEl.innerHTML = `
      <div class="al-empty">
        ${UI.bell}
        <div>还没有闹钟<br/>点下面的按钮建一个</div>
      </div>`;
  } else {
    // 按时间排序，让最近要响的排在最上面
    const sorted = [...alarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    listEl.innerHTML = sorted
      .map(
        (a) => `
        <div class="al-item ${a.enabled ? '' : 'is-off'}" data-id="${a.id}">
          <div class="al-item__main">
            <div class="al-item__time">${pad(a.hour)}:${pad(a.minute)}</div>
            <div class="al-item__meta">
              <span>${a.label || '闹钟'}</span>
              <i class="dot"></i>
              <span>${describeRepeat(a.repeat || [])}</span>
            </div>
          </div>
          <button class="al-item__del" data-action="del" title="删除">${UI.trash}</button>
          <div class="switch" role="switch" tabindex="0"
               aria-checked="${a.enabled}" data-action="toggle"></div>
        </div>`
      )
      .join('');
  }

  // 下一个闹钟提示
  if (next) {
    const d = new Date(next.at);
    const diff = next.at - Date.now();
    const mins = Math.round(diff / 60000);
    const when =
      mins < 60 ? `${mins} 分钟后` : mins < 60 * 24 ? `${Math.round(mins / 60)} 小时后` : `${Math.round(mins / 1440)} 天后`;
    nextEl.innerHTML = `下一个 <span style="color:var(--text-1)">${pad(d.getHours())}:${pad(d.getMinutes())}</span><br/>${when}`;
  } else {
    nextEl.textContent = alarms.length ? '已全部关闭' : '还没有闹钟';
  }

  // 收起态的小圆点
  updateBarChip();
}

function updateBarChip() {
  const chip = document.getElementById('barAlarm');
  const time = document.getElementById('barAlarmTime');
  if (!chip || !time) return;
  if (next) {
    chip.classList.remove('is-empty');
    const d = new Date(next.at);
    time.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } else {
    chip.classList.add('is-empty');
    time.textContent = '—';
  }
}

export async function refreshAlarms() {
  const res = await api.getAlarms();
  alarms = res.list;
  next = res.next;
  renderList();
}

// ---------------- 事件 ----------------

listEl.addEventListener('click', async (e) => {
  const item = e.target.closest('.al-item');
  if (!item) return;
  const id = item.dataset.id;

  if (e.target.closest('[data-action="del"]')) {
    item.classList.add('is-removing');
    setTimeout(async () => {
      const res = await api.removeAlarm(id);
      alarms = res.list;
      next = res.next;
      renderList();
    }, 180);
    return;
  }

  if (e.target.closest('[data-action="toggle"]')) {
    const alarm = alarms.find((a) => a.id === id);
    if (!alarm) return;
    const res = await api.updateAlarm(id, { enabled: !alarm.enabled });
    alarms = res.list;
    next = res.next;
    renderList();
  }
});

// ---------------- 新建表单 ----------------

let draft = null;

function openForm() {
  if (draft) return;
  const now = new Date();
  // 默认给「下一个整点」，比默认 00:00 更接近真实使用
  const h = (now.getHours() + 1) % 24;
  draft = { hour: h, minute: 0, label: '', repeat: [] };

  formHost.innerHTML = `
    <div class="al-form">
      <div class="al-form__time">
        <input class="al-form__field" id="fHour" type="number" min="0" max="23"
               value="${pad(draft.hour)}" inputmode="numeric" />
        <span class="al-form__colon">:</span>
        <input class="al-form__field" id="fMin" type="number" min="0" max="59"
               value="${pad(draft.minute)}" inputmode="numeric" />
      </div>
      <div class="al-form__row">
        <input class="al-form__input" id="fLabel" placeholder="标签（如 起床 / 喝水）" maxlength="12" />
      </div>
      <div class="al-week" id="fWeek">
        ${WEEK.map(
          (w, i) => `<button class="al-week__day" data-day="${i}">${w}</button>`
        ).join('')}
      </div>
      <div class="al-form__actions">
        <button class="btn btn--ghost" id="fCancel">取消</button>
        <button class="btn btn--primary" id="fSave">保存</button>
      </div>
    </div>`;

  const hourEl = document.getElementById('fHour');
  const minEl = document.getElementById('fMin');
  const labelEl = document.getElementById('fLabel');
  hourEl.focus();
  hourEl.select();

  // 输入自动补零 + 限制范围，失焦时纠正
  const clamp = (input, max) => {
    let v = parseInt(input.value, 10);
    if (Number.isNaN(v)) v = 0;
    v = Math.max(0, Math.min(max, v));
    input.value = pad(v);
    return v;
  };
  hourEl.addEventListener('blur', () => (draft.hour = clamp(hourEl, 23)));
  minEl.addEventListener('blur', () => (draft.minute = clamp(minEl, 59)));
  // 输入两位数字后自动跳到下一个输入框，符合手机闹钟的手感
  hourEl.addEventListener('input', () => {
    if (hourEl.value.length >= 2) minEl.focus();
  });

  document.getElementById('fWeek').addEventListener('click', (e) => {
    const btn = e.target.closest('.al-week__day');
    if (!btn) return;
    const day = Number(btn.dataset.day);
    btn.classList.toggle('is-on');
    draft.repeat = btn.classList.contains('is-on')
      ? [...draft.repeat, day].sort()
      : draft.repeat.filter((d) => d !== day);
  });

  document.getElementById('fCancel').addEventListener('click', closeForm);

  document.getElementById('fSave').addEventListener('click', async () => {
    draft.hour = clamp(hourEl, 23);
    draft.minute = clamp(minEl, 59);
    draft.label = labelEl.value.trim() || '闹钟';
    const res = await api.addAlarm(draft);
    alarms = res.list;
    next = res.next;
    closeForm();
    renderList();
    // 新加的那条做一个入场动画
    const first = listEl.querySelector('.al-item');
    first?.classList.add('is-entering');
  });

  // 回车即保存
  formHost.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('fSave')?.click();
    if (e.key === 'Escape') closeForm();
  });
}

function closeForm() {
  draft = null;
  formHost.innerHTML = '';
}

document.getElementById('btnAddAlarm')?.addEventListener('click', openForm);

// 快捷加钟：从「现在」往后推 N 分钟，建一个一次性闹钟（番茄钟 / 小睡场景）
document.getElementById('alQuick')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-min]');
  if (!btn) return;
  const mins = Number(btn.dataset.min);
  const at = new Date(Date.now() + mins * 60 * 1000);
  const res = await api.addAlarm({
    hour: at.getHours(),
    minute: at.getMinutes(),
    label: mins >= 60 ? `${mins / 60} 小时后` : `${mins} 分钟后`,
    repeat: [],
  });
  alarms = res.list;
  next = res.next;
  renderList();
  const last = listEl.querySelector('.al-item');
  last?.classList.add('is-entering');
});

// ---------------- 响铃 ----------------

let audioCtx = null;
let ringTimer = null;
let soundEnabled = true;

export function setSoundEnabled(v) {
  soundEnabled = !!v;
}

/** 用 WebAudio 合成一段 iOS 风格的提示音：两个音交替，带指数衰减 */
function playPing(freq = 880, when = 0, dur = 0.42) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.16, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 一次「叮咚」：三音上行，像 iOS 的 Radar */
function playPattern() {
  playPing(1046.5, 0, 0.5);
  playPing(1318.5, 0.16, 0.5);
  playPing(1568, 0.32, 0.7);
}

export function showRing(alarm) {
  ringing = alarm;
  ringTime.textContent = `${pad(alarm.hour)}:${pad(alarm.minute)}`;
  ringLabel.textContent = alarm.label || '闹钟';
  ringEl.classList.add('is-on');
  document.getElementById('island').classList.add('is-ringing');

  if (soundEnabled) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      playPattern();
      clearInterval(ringTimer);
      ringTimer = setInterval(playPattern, 1900);
    } catch (err) {
      console.warn('音频不可用', err);
    }
  }

  // 60 秒无操作自动停止，避免一直响
  clearTimeout(showRing._t);
  showRing._t = setTimeout(() => hideRing(), 60 * 1000);
}

export function hideRing() {
  ringing = null;
  ringEl.classList.remove('is-on');
  document.getElementById('island').classList.remove('is-ringing');
  clearInterval(ringTimer);
  ringTimer = null;
  clearTimeout(showRing._t);
}

document.getElementById('btnStop')?.addEventListener('click', () => hideRing());

document.getElementById('btnSnooze')?.addEventListener('click', () => {
  if (ringing) api.snoozeAlarm(ringing.id);
  hideRing();
  setTimeout(refreshAlarms, 120);
});

export function initAlarmUi() {
  refreshAlarms();
}
