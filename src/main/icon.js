/**
 * 内置图标
 * ------------------------------------------------------------------
 * 托盘图标以 base64 内联在代码里，而不是读 png 文件。
 * 原因：少一个资源依赖 —— clone 下来就能跑，打包也不会因为漏拷 assets 变成空白托盘。
 *
 * 想换成自己的图标：
 *   1. 准备一张 32×32 的 PNG
 *   2. python3 tools/make-icons.py --base64   （会打印新的 data URL）
 *   3. 整体替换下面的字符串
 */

const TRAY_ICON_DATAURL =
  'data:image/png;base64,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';
module.exports = { TRAY_ICON_DATAURL };
