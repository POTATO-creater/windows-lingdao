"""把截图合成到模拟壁纸上，生成预览图（开发用，不参与打包）"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import sys, os

W, H = 1440, 900
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def wallpaper(dark=True):
    img = Image.new('RGB', (W, H)); d = ImageDraw.Draw(img)
    top = (24, 30, 52) if dark else (196, 212, 234)
    bot = (78, 58, 86) if dark else (240, 228, 216)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * (t ** 0.85)) for i in range(3)))
    g = Image.new('RGB', (W, H), (0, 0, 0)); gd = ImageDraw.Draw(g)
    gd.ellipse([W * .52, -300, W * 1.08, 460], fill=(150, 96, 52) if dark else (255, 236, 206))
    gd.ellipse([-260, H * .3, W * .42, H * 1.1], fill=(26, 54, 88) if dark else (255, 250, 242))
    return ImageChops.add(img, g.filter(ImageFilter.GaussianBlur(190)))

def compose(shot, out, dark=True):
    bg = wallpaper(dark).convert('RGBA')
    im = Image.open(os.path.join(BASE, '.preview', f'{shot}.png')).convert('RGBA')
    x = (W - im.width) // 2; y = 6
    sh = Image.new('RGBA', (im.width + 100, im.height + 100), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([50, 50, 50 + im.width, 50 + im.height], radius=46, fill=(0, 0, 0, 150))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(16)), (x - 50, y - 42))
    bg.alpha_composite(im, (x, y))
    bg.convert('RGB').save(os.path.join(BASE, '.preview', f'desk-{out}.jpg'), quality=93)

if __name__ == '__main__':
    for a, b, d in [('01-collapsed', 'collapsed', 1), ('02-weather', 'weather', 1),
                    ('03-alarm', 'alarm', 1), ('04-settings', 'settings', 1), ('05-light', 'light', 0)]:
        compose(a, b, bool(d))
    print('composed')
