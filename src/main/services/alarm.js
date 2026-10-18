/**
 * 闹钟调度服务
 * ------------------------------------------------------------------
 * 只做「时间到了没有」的判断，不负责响铃。命中后通过 onFire 回调
 * 交给 index.js 转发给界面，界面负责动画、声音和系统通知。
 *
 * 数据结构（存在 config.alarms）：
 *   {
 *     id: string,
 *     hour: 0-23, minute: 0-59,
 *     label: '起床',
 *     repeat: [1,2,3,4,5],   // 0=周日 … 6=周六；空数组表示只响一次
 *     enabled: boolean,
 *     lastFiredKey: '2026-10-17 07:30'
 *   }
 */

const { ALARM } = require('../config');

const pad = (n) => String(n).padStart(2, '0');

/** 生成唯一 id */
function makeId() {
  return `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

class AlarmService {
  constructor(store, onFire) {
    this.store = store;
    this.onFire = onFire;
    this.timer = null;
    this.snoozes = []; // [{ alarm, fireAt }]
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  list() {
    return this.store.get('alarms') || [];
  }

  save(list) {
    this.store.set('alarms', list);
    return list;
  }

  /** 新增，返回新建的闹钟 */
  add({ hour, minute, label = '闹钟', repeat = [] }) {
    const alarm = {
      id: makeId(),
      hour: Number(hour),
      minute: Number(minute),
      label,
      repeat: repeat.slice().sort(),
      enabled: true,
      lastFiredKey: null,
    };
    this.save([...this.list(), alarm]);
    return alarm;
  }

  remove(id) {
    return this.save(this.list().filter((a) => a.id !== id));
  }

  update(id, patch) {
    return this.save(this.list().map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  /** 贪睡：N 分钟后再响 */
  snooze(id) {
    const alarm = this.list().find((a) => a.id === id);
    if (!alarm) return;
    this.snoozes.push({
      alarm,
      fireAt: Date.now() + ALARM.snoozeMinutes * 60 * 1000,
    });
  }

  tick() {
    const now = new Date();
    const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;

    // 1) 普通闹钟
    for (const alarm of this.list()) {
      if (!alarm.enabled) continue;
      if (alarm.hour !== now.getHours() || alarm.minute !== now.getMinutes()) continue;
      if (alarm.lastFiredKey === key) continue;
      // 重复规则：空数组表示仅一次（日期不重复判断，响过即关闭）
      if (alarm.repeat.length && !alarm.repeat.includes(now.getDay())) continue;

      this.update(alarm.id, {
        lastFiredKey: key,
        // 一次性闹钟响过自动关闭；重复闹钟保持开启
        enabled: alarm.repeat.length > 0,
      });
      this.onFire({ ...alarm, firedAt: Date.now(), isSnooze: false });
    }

    // 2) 贪睡中的闹钟
    const due = this.snoozes.filter((s) => s.fireAt <= Date.now());
    if (due.length) {
      this.snoozes = this.snoozes.filter((s) => s.fireAt > Date.now());
      for (const s of due) this.onFire({ ...s.alarm, firedAt: Date.now(), isSnooze: true });
    }
  }

  /** 下一个要响的闹钟（用于收起态显示小圆点），返回 { alarm, at } */
  next() {
    const now = new Date();
    let best = null;
    for (const alarm of this.list()) {
      if (!alarm.enabled) continue;
      for (let d = 0; d < 8; d++) {
        const cand = new Date(now);
        cand.setDate(now.getDate() + d);
        cand.setHours(alarm.hour, alarm.minute, 0, 0);
        if (cand <= now) continue;
        if (alarm.repeat.length && !alarm.repeat.includes(cand.getDay())) continue;
        if (!best || cand < best.at) best = { alarm, at: cand.getTime() };
        break;
      }
    }
    if (this.snoozes.length) {
      const s = this.snoozes.reduce((a, b) => (a.fireAt < b.fireAt ? a : b));
      if (!best || s.fireAt < best.at) best = { alarm: s.alarm, at: s.fireAt };
    }
    return best;
  }
}

module.exports = { AlarmService, makeId };
