/**
 * 全局配置常量
 * ------------------------------------------------------------------
 * 改这里会影响：天气请求地址、默认城市、窗口各状态尺寸、刷新频率。
 * 注意：窗口尺寸改动后，renderer/styles/tokens.css 里的
 *      --w-collapsed / --w-expanded 需要同步（见 MAP.md「联动改动」）。
 */

// 打包后 app.getVersion() 才是本应用版本，开发环境返回 Electron 版本，
// 所以统一从 package.json 读，保证界面显示一致。
const pkg = require('../../package.json');

module.exports = {
  VERSION: pkg.version,

  // ---- 和风天气 ----
  QWEATHER: {
    // 专属 API Host（不带协议），正式版走 HTTPS
    host: 'mv3qqub97g.re.qweatherapi.com',
    // 开发密钥：只在主进程使用，不会下发到渲染进程
    key: '0a7859a0137048bca8d537394e6ffe70',
    // 实时天气刷新间隔（毫秒）
    refreshInterval: 10 * 60 * 1000,
    // 网络失败后的重试间隔
    retryInterval: 60 * 1000,
  },

  // ---- 默认城市（可在界面里搜索替换）----
  DEFAULT_CITY: {
    id: '101010100',
    name: '北京',
    adm1: '北京市',
  },

  // ---- 窗口 ----
  WINDOW: {
    // 窗口尺寸 = 胶囊尺寸 + 四周各 10px（留给投影）。
    // 改这里必须同步 renderer/scripts/island.js 里的 SIZE 常量。
    collapsed: { width: 320, height: 84 },
    expanded: { width: 424, height: 620 },
    // 距离屏幕顶部的默认间距
    topMargin: 10,
    // 展开动画时长（毫秒），用于等待收起动画播完再回收窗口
    collapseDelay: 420,
  },

  // ---- 闹钟 ----
  ALARM: {
    // 贪睡时长（分钟）
    snoozeMinutes: 9,
    // 到点铃响持续时长（毫秒），超时自动静音
    ringTimeout: 60 * 1000,
  },
};
