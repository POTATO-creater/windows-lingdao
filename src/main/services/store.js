/**
 * 本地持久化存储
 * ------------------------------------------------------------------
 * 用一个 JSON 文件保存：城市、闹钟列表、窗口位置、主题偏好。
 * 文件路径：%APPDATA%/LingDao/config.json（Windows）
 * 写盘做了 300ms 防抖，避免频繁 IO。
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  city: null, // { id, name, adm1 }
  alarms: [], // [{ id, hour, minute, label, repeat:[0-6], enabled, lastFired }]
  position: null, // { x, y }
  theme: 'system', // 'system' | 'dark' | 'light'
  sound: true,
};

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'config.json');
    this.data = this._read();
    this._timer = null;
  }

  _read() {
    try {
      const raw = fs.readFileSync(this.file, 'utf-8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  get(key) {
    return key ? this.data[key] : this.data;
  }

  set(key, value) {
    this.data[key] = value;
    this._scheduleFlush();
    return value;
  }

  patch(partial) {
    Object.assign(this.data, partial);
    this._scheduleFlush();
    return this.data;
  }

  _scheduleFlush() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[store] 写入失败', err);
    }
  }
}

module.exports = { Store, DEFAULTS };
