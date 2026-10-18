# 项目地图 · MAP

> 这份文档回答三个问题：**每个文件干什么**、**改一处会连带影响哪里**、**想做某个改动该动哪个文件**。
> 改代码前先扫一眼第 3 节，能省掉大半调试时间。

---

## 1. 整体结构

```
Electron 主进程（Node 环境）              渲染进程（浏览器环境，沙箱）
┌──────────────────────────┐            ┌───────────────────────────┐
│ index.js  装配 + 定时任务  │            │ app.js     入口装配        │
│ window.js 窗口/形变/拖拽   │◄── IPC ──► │ island.js  形变与交互      │
│ tray.js   托盘菜单         │            │ weather-view / alarm-view │
│ ipc.js    通道白名单       │◄── 推送 ── │ clock / icons / spring    │
│ services/ 天气·闹钟·存储   │            │ styles/   5 个样式文件     │
└──────────────────────────┘            └───────────────────────────┘
             ▲                                        ▲
             └──────── preload/index.js（安全桥）──────┘
```

**关键约束**：渲染进程拿不到 Node，只能调用 `preload/index.js` 里白名单暴露的方法。想给界面加能力 = 改 `ipc.js` + `preload/index.js` 两个文件。

---

## 2. 文件清单

### 主进程 `src/main/`

| 文件 | 职责 | 改它会怎样 |
| --- | --- | --- |
| `index.js` | 启动装配：单实例锁、创建窗口/托盘、启动定时任务、闹钟触发时展开窗口并推通知 | 改装配顺序或增删启动任务；**不要在别的文件里重复 `app.whenReady`** |
| `config.js` | 所有常量的唯一来源：API Key、默认城市、窗口尺寸、刷新频率 | 改窗口尺寸必须同步 `island.js` 的 `SIZE`（见第 4 节） |
| `window.js` | 创建无边框透明窗口、以顶部中心为锚点缩放、展开/收起时序、拖拽、位置记忆 | 改窗口行为都在这；`setMode` 里 420ms 延时是配合收起动画的，别乱改 |
| `tray.js` | 托盘图标与右键菜单（显示隐藏、刷新、主题、自启、退出） | 加菜单项在这里 |
| `ipc.js` | 全部 IPC 通道，按 `域:动作` 命名 | 新增能力先在这里加通道，再去 preload 暴露 |
| `services/weather.js` | 和风天气请求、gzip 解压、字段归一化、10 分钟缓存、城市搜索 | 换天气数据源只改这里，返回结构保持不变界面就不用动 |
| `services/alarm.js` | 每秒 tick，判断「到点没」，维护贪睡队列，计算下一个闹钟 | 提醒方式（响铃/动画）不在这里，这里只负责「什么时候响」 |
| `services/store.js` | `config.json` 读写，300ms 防抖落盘 | 加新的持久化字段直接 `store.set('xxx', v)`，不用改文件 |

> 存储位置：Windows 下是 `%APPDATA%/LingDao/config.json`。删掉这个文件等于恢复出厂设置。

### 预加载 `src/preload/`

| 文件 | 职责 |
| --- | --- |
| `index.js` | 用 `contextBridge` 暴露 `window.lingdao`。分四组：窗口 / 天气 / 闹钟 / 应用。每个方法一行，看名字就知道调哪个通道 |

### 渲染进程 `src/renderer/`

**脚本 `scripts/`**

| 文件 | 职责 | 依赖关系 |
| --- | --- | --- |
| `app.js` | 入口：注入图标、订阅主进程推送、绑定设置项、暴露调试接口 `__island` | 依赖下面所有模块 |
| `island.js` | **核心**：展开/收起形变、每页高度自适应、顶栏拖拽（4px 阈值区分点击）、分段控制器、Esc 收起 | 依赖 `spring.js` |
| `spring.js` | 弹簧引擎。输入 `damping` + `response`，输出逐帧数值。支持中途改目标（可打断） | 无依赖，可单独复用 |
| `weather-view.js` | 把天气数据画成界面：顶栏温度、大温度、四格详情、24 小时曲线（Catmull-Rom 平滑）、三日预报、城市搜索 | 依赖 `icons.js` |
| `alarm-view.js` | 闹钟列表渲染、新建表单、快捷加钟、响铃覆盖层、WebAudio 合成铃声 | 依赖 `icons.js` |
| `clock.js` | 每秒更新顶栏时间；对外提供 `onMinute(cb)` 让别的模块按分钟响应 | 无依赖 |
| `icons.js` | 全部内联 SVG（天气图标按和风 icon 码映射）+ 界面图标 | 无依赖 |

**样式 `styles/`**（按加载顺序，后面的可以覆盖前面的）

| 文件 | 管什么 | 常改的地方 |
| --- | --- | --- |
| `tokens.css` | 设计令牌：颜色、材质、字号、动效曲线，深/浅两套主题 | **换配色只改这里**；`--iw/--ih/--ir` 由 JS 每帧写入，别手动加 transition |
| `base.css` | 重置、通用控件（圆形按钮 / 分段控制器 / iOS 开关 / 滚动条）、无障碍减弱动效 | 加通用组件放这里 |
| `island.css` | 胶囊本体：玻璃层、高光层、顶栏布局、内容区显隐、hover/拖拽/响铃状态 | 改胶囊结构或顶栏布局 |
| `weather.css` | 天气面板：大温度、四格网格、曲线、三日预报、城市搜索浮层 | 改天气页排版 |
| `alarm.css` | 闹钟面板、新建表单、响铃覆盖层、设置行 | 改闹钟页排版 |

**页面**

| 文件 | 说明 |
| --- | --- |
| `index.html` | 一次性写死骨架（顶栏 + 三个面板 + 响铃层），内容由 JS 填。图标用 `<span class="ico" data-icon="gear">` 占位，`app.js` 启动时统一注入 |

### 开发工具 `tools/`（不参与打包）

| 文件 | 用途 |
| --- | --- |
| `shot.js` | 无头截图：`xvfb-run -a npx electron --no-sandbox tools/shot.js`，输出五种状态到 `.preview/` |
| `compose.py` | 把截图合成到模拟壁纸上，方便看玻璃质感 |
| `make-icons.py` | 重新生成 `build/icon.*` 与托盘图标（仓库不存二进制） |

---

## 3. 「我想改 X」速查

| 想做的事 | 改哪里 |
| --- | --- |
| 换 API Key / 换默认城市 | `src/main/config.js` |
| 改天气刷新频率 | `src/main/config.js` → `QWEATHER.refreshInterval` |
| 让胶囊更宽 / 更高 | `config.js` 的 `WINDOW` **和** `island.js` 的 `SIZE`，两处一起改 |
| 换主题色 | `styles/tokens.css` 的 `--accent` |
| 换玻璃深浅 | `tokens.css` 的 `--glass-1 / --glass-2`（alpha 越高越不透） |
| 调整展开动画手感 | `island.js` 的 `SPRING = { damping, response }`；越小越快，`damping < 1` 有回弹 |
| 改收起态显示什么 | `index.html` 的 `.bar` 区块 + `island.css` 的 `.bar__*` |
| 加第四个标签页 | `index.html` 加 `.segmented__item` 和 `.panel`；`island.js` 的 `TAB_HEIGHT` 加兜底值，高度会自动测量 |
| 加新的天气字段 | `services/weather.js` 的 `normalizeNow` 加字段 → `weather-view.js` 渲染 |
| 改闹钟响铃音 | `alarm-view.js` 的 `playPattern()`（WebAudio 合成，不用音频文件） |
| 加托盘菜单项 | `tray.js` 的 `buildFromTemplate` |
| 改开机自启默认值 | `tray.js` / `ipc.js` 里的 `setLoginItemSettings` |

---

## 4. 联动改动（改 A 必须同步 B）

| A | B | 为什么 |
| --- | --- | --- |
| `config.js` `WINDOW.collapsed/expanded` | `island.js` `SIZE` | 窗口尺寸 = 胶囊尺寸 + 20px（四周各 10px 留投影），不同步会出现「内容被硬裁」或「透明区域挡住点击」 |
| `config.js` `WINDOW.collapseDelay` | `island.js` 里收起的弹簧时长 / `morphHeight` 的 380ms | 主进程靠这个延时等收起动画播完再回收窗口 |
| `index.html` 新增 `.panel` | 无需改代码 | `island.js` 用 ResizeObserver 自动测高，但 `TAB_HEIGHT` 建议加个兜底值 |
| 改 `--bar-h`（顶栏高） | `island.js` 的 `BAR_H` | 高度计算公式里用到了它 |
| 天气接口返回结构变化 | `weather-view.js` | 归一化在 `weather.js`，界面只认归一化后的字段 |

---

## 5. 数据流

**天气**
```
用户打开 / 每 10 分钟 / 手动刷新
   └─ main/index.js pushWeather()
        └─ weather.js fetchAll()  ← HTTPS + gzip + 10 分钟缓存
             └─ webContents.send('weather:update', { ok, data })
                  └─ app.js 订阅 → weather-view.js renderWeather()
```
失败时推 `{ ok:false, error }`，界面保留旧数据只把「更新时间」标红，不会白屏。

**闹钟**
```
alarm.js 每秒 tick
   ├─ 命中时间 + 星期匹配 + 本分钟没响过
   └─ onFire(alarm)
        └─ main/index.js：展开窗口 + 系统通知
             └─ renderer：alarm-view.js showRing()（脉冲 + WebAudio 铃声）
                  ├─ 停止 → hideRing()
                  └─ 稍后 → snoozeAlarm() → 主进程加入贪睡队列
```

**主题**
```
store.theme = 'system' | 'dark' | 'light'
   └─ nativeTheme 变化 / 托盘切换 → main applyTheme()
        └─ send('app:theme-changed', theme, effective)
             └─ app.js → document.documentElement.dataset.theme = effective
                  └─ tokens.css 里 [data-theme="light"] 整组变量生效
```

---

## 6. 调试

页面内调试接口（DevTools 控制台可用，打包后也在）：

```js
__island.expand()          // 展开
__island.collapse()        // 收起
__island.setTab('alarm')   // 切换面板：weather / alarm / settings
__island.theme('light')    // 强制主题
```

打开 DevTools：在项目根目录执行 `npx electron . --dev`，或在 `index.js` 里加 `win.webContents.openDevTools({ mode: 'detach' })`。

看不到窗口时按顺序排查：

1. 托盘图标是否还在（进程没死）
2. `config.json` 里 `position` 是否跑到了屏幕外 —— 删掉该字段会回到顶部居中
3. 天气一直失败 —— 检查 `config.js` 的 host 与 key，`curl` 直接测接口

---

## 7. 已知取舍

- **毛玻璃是「画」出来的**：透明窗口拿不到桌面内容做 `backdrop-filter`，所以玻璃质感由「半透明底色 + 顶部高光渐变 + 内描边 + 投影」合成。想要真模糊得改用 `backgroundMaterial: 'acrylic'`（Win11 22H2+），代价是没法做圆角外的自由形变。
- **展开时窗口先变大、再播形变**：多出来的那 300ms 里窗口比可见卡片大一圈，会挡住下方鼠标点击。换成「每帧改窗口尺寸」能解决但会掉帧，实测这个取舍更划算。
- **高度是量出来的，不是写死的**：切换面板时 `measureHeight()` 临时把滚动容器设为 `height:auto` 读一次内容高度，同一帧内还原。新增内容不需要手改高度。
