#!/usr/bin/env python3
"""
图标生成器
==================================================================
仓库里不存二进制图标 —— 需要一个命令就能重新画出来。

用法：
    python3 tools/make-icons.py            生成 build/icon.png、build/icon.ico、src/assets/tray.png
    python3 tools/make-icons.py --base64   额外打印托盘图标的 data URL（用于更新 src/main/icon.js）

依赖：pip install pillow
图形：深空灰竖向渐变圆角方块 + 一条白色正弦波（灵动岛的「流动」意象）
"""

import base64
import math
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("需要 Pillow：pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 配色：从深灰渐变到浅灰，接近 macOS 图标的明暗过渡
TOP = (34, 36, 42)
BOTTOM = (126, 134, 146)


def draw_icon(size: int, rounded: bool = True, wave: bool = True) -> Image.Image:
    """画一张 size×size 的图标（内部 4 倍超采样后缩小，边缘更干净）"""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 竖向渐变
    for y in range(S):
        t = y / S
        c = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (S, y)], fill=c)

    # 圆角遮罩
    if rounded:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.26), fill=255)
        img.putalpha(mask)

    # 正弦波：3.2 个周期，高度 10%
    if wave:
        d2 = ImageDraw.Draw(img)
        cy = S / 2
        pts = [(i, cy + math.sin(i / S * math.pi * 3.2) * S * 0.10) for i in range(0, S, 2)]
        d2.line(pts, fill=(255, 255, 255, 235), width=max(2, int(S * 0.055)), joint="curve")

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "src", "assets"), exist_ok=True)

    app_png = os.path.join(ROOT, "build", "icon.png")
    app_ico = os.path.join(ROOT, "build", "icon.ico")
    tray_png = os.path.join(ROOT, "src", "assets", "tray.png")

    big = draw_icon(256, rounded=False)
    big.save(app_png)
    big.save(app_ico, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    tray = draw_icon(32, rounded=True)
    tray.save(tray_png)

    print(f"✓ {app_png}")
    print(f"✓ {app_ico}")
    print(f"✓ {tray_png}")

    if "--base64" in sys.argv:
        with open(tray_png, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        print("\n把下面这串替换进 src/main/icon.js 的 TRAY_ICON_DATAURL：\n")
        print("data:image/png;base64," + b64)


if __name__ == "__main__":
    main()
