/**
 * 和风天气服务
 * ------------------------------------------------------------------
 * 职责：只负责「发请求 + 归一化数据 + 缓存」，不碰界面。
 * 全部请求在主进程发出，API Key 不会出现在页面里。
 *
 * 使用到的接口：
 *   /geo/v2/city/lookup  城市搜索
 *   /v7/weather/now      实时天气
 *   /v7/weather/3d       三日预报
 *   /v7/weather/24h      逐小时（展开态的时间轴）
 */

const https = require('https');
const zlib = require('zlib');
const { QWEATHER, DEFAULT_CITY } = require('../config');

/** 轻量 GET，内置 gzip 解压 + 超时 */
function getJSON(pathname, { timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const url = `https://${QWEATHER.host}${pathname}`;
    const req = https.get(
      url,
      { headers: { 'Accept-Encoding': 'gzip, deflate' }, timeout },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let buf = Buffer.concat(chunks);
          const enc = res.headers['content-encoding'];
          try {
            if (enc === 'gzip') buf = zlib.gunzipSync(buf);
            else if (enc === 'deflate') buf = zlib.inflateSync(buf);
            resolve(JSON.parse(buf.toString('utf-8')));
          } catch (err) {
            reject(new Error(`解析响应失败: ${err.message}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}

class WeatherService {
  constructor(store) {
    this.store = store;
    this.cache = null;
    this.cacheAt = 0;
    this.inflight = null;
    this.cityCache = new Map(); // 城市搜索结果缓存（5 分钟）
  }

  get city() {
    return this.store.get('city') || DEFAULT_CITY;
  }

  /** 搜索城市，返回 [{ id, name, adm1, adm2 }] */
  async searchCity(keyword) {
    const key = keyword.trim();
    if (!key) return [];
    const hit = this.cityCache.get(key);
    if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.list;

    const data = await getJSON(
      `/geo/v2/city/lookup?location=${encodeURIComponent(key)}&number=8&key=${QWEATHER.key}`
    );
    if (data.code !== '200' || !Array.isArray(data.location)) return [];
    const list = data.location.map((c) => ({
      id: c.id,
      name: c.name,
      adm1: c.adm1,
      adm2: c.adm2,
    }));
    this.cityCache.set(key, { at: Date.now(), list });
    return list;
  }

  /** 拉取完整天气包（实时 + 三日 + 24 小时），带缓存 */
  async fetchAll({ force = false } = {}) {
    const fresh = Date.now() - this.cacheAt < QWEATHER.refreshInterval;
    if (!force && fresh && this.cache) return this.cache;
    if (this.inflight) return this.inflight;

    const city = this.city;
    const q = `location=${city.id}&key=${QWEATHER.key}`;

    this.inflight = (async () => {
      const [now, daily, hourly] = await Promise.all([
        getJSON(`/v7/weather/now?${q}`),
        getJSON(`/v7/weather/3d?${q}`),
        getJSON(`/v7/weather/24h?${q}`).catch(() => null), // 逐小时失败不影响主功能
      ]);
      if (now.code !== '200') throw new Error(`天气接口返回 ${now.code}`);

      const pack = {
        city,
        updatedAt: Date.now(),
        now: normalizeNow(now.now),
        daily: (daily.daily || []).map(normalizeDaily),
        hourly: (hourly?.hourly || []).slice(0, 12).map(normalizeHourly),
      };
      this.cache = pack;
      this.cacheAt = Date.now();
      return pack;
    })();

    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }
}

// ---- 归一化：把和风字段转成前端友好的结构 ----

function normalizeNow(n = {}) {
  return {
    temp: Number(n.temp),
    feelsLike: Number(n.feelsLike),
    text: n.text,
    icon: n.icon,
    windDir: n.windDir,
    windScale: n.windScale,
    humidity: Number(n.humidity),
    pressure: Number(n.pressure),
    vis: Number(n.vis),
    precip: Number(n.precip),
    obsTime: n.obsTime,
  };
}

function normalizeDaily(d = {}) {
  return {
    date: d.fxDate,
    tempMax: Number(d.tempMax),
    tempMin: Number(d.tempMin),
    textDay: d.textDay,
    iconDay: d.iconDay,
    textNight: d.textNight,
    iconNight: d.iconNight,
    sunrise: d.sunrise,
    sunset: d.sunset,
    precip: Number(d.precip),
    uvIndex: Number(d.uvIndex),
  };
}

function normalizeHourly(h = {}) {
  return {
    time: h.fxTime,
    temp: Number(h.temp),
    text: h.text,
    icon: h.icon,
    pop: Number(h.pop),
  };
}

module.exports = { WeatherService };
