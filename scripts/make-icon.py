# -*- coding: utf-8 -*-
"""
生成 CodeAtlas 应用图标。
设计对应应用的语义：深色底 + 靛蓝的「码」字 + 角落琥珀色块（代表可自主配置的区域）。
输出：
  build/icon.ico            Windows（多尺寸）
  build/icon.png            1024 主图（Android / 商店用）
  build/android/*.png       Android 各密度 launcher 图标
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
os.makedirs(BUILD, exist_ok=True)

# 与应用主题一致
BG_TOP = (18, 23, 34)
BG_BOT = (9, 12, 18)
IRIS = (124, 140, 255)
IRIS_HI = (158, 171, 255)
AMBER = (240, 178, 70)

FONTS = [
    r'C:\Windows\Fonts\msyhbd.ttc',
    r'C:\Windows\Fonts\msyh.ttc',
    r'C:\Windows\Fonts\simhei.ttf',
]


def pick_font(size):
    for p in FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def vgradient(w, h, top, bot):
    """竖向渐变底"""
    img = Image.new('RGB', (1, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.point((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h), Image.BILINEAR)


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def make_icon(size, with_text=True):
    S = size * 4  # 4 倍超采样，缩小后边缘干净
    base = vgradient(S, S, BG_TOP, BG_BOT).convert('RGBA')

    # 顶部一层淡淡的靛蓝光晕
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    steps = 28
    for i in range(steps):
        a = int(26 * (1 - i / steps))
        off = i * (S * 0.012)          # 按画布比例收缩，避免小尺寸时坐标反转
        gd.ellipse([-S * 0.35 + off, -S * 0.75 + off,
                    S * 1.35 - off, S * 0.42 - off],
                   fill=(124, 140, 255, a))
    base = Image.alpha_composite(base, glow)

    d = ImageDraw.Draw(base)

    # 外描边（很细的一道靛蓝，让图标在深色任务栏上也有边界）
    d.rounded_rectangle([1.5, 1.5, S - 2.5, S - 2.5], radius=S * 0.22,
                        outline=(124, 140, 255, 70), width=max(1, int(S * 0.008)))

    if with_text:
        font = pick_font(int(S * 0.52))
        txt = '码'
        box = d.textbbox((0, 0), txt, font=font)
        tw, th = box[2] - box[0], box[3] - box[1]
        x = (S - tw) / 2 - box[0] - S * 0.03    # 略向左，给右下角留位置
        y = (S - th) / 2 - box[1]
        d.text((x, y), txt, font=font, fill=(238, 241, 255, 255))

    # 右下角琥珀色块：隐喻「这一块可以自己改」
    pad = S * 0.14
    blk = S * 0.125
    bx, by = S - pad - blk, S - pad - blk
    d.rounded_rectangle([bx, by, bx + blk, by + blk], radius=blk * 0.3, fill=AMBER)

    out = base.resize((size, size), Image.LANCZOS)
    out.putalpha(rounded_mask(size, int(size * 0.22)))
    return out


def make_foreground(size):
    """Android 自适应图标的前景层：透明底，内容缩进安全区（约 62%），
       这样圆形 / 方形 / squircle 各种裁切下都不会被切到字。"""
    S = size * 4
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    font = pick_font(int(S * 0.52))
    txt = '码'
    box = d.textbbox((0, 0), txt, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    d.text(((S - tw) / 2 - box[0] - S * 0.03, (S - th) / 2 - box[1]), txt,
           font=font, fill=(238, 241, 255, 255))

    pad, blk = S * 0.14, S * 0.125
    bx, by = S - pad - blk, S - pad - blk
    d.rounded_rectangle([bx, by, bx + blk, by + blk], radius=blk * 0.3, fill=AMBER)

    inner = int(S * 0.62)
    small = canvas.resize((inner, inner), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(small, ((S - inner) // 2, (S - inner) // 2), small)
    return out.resize((size, size), Image.LANCZOS)


def make_splash(size):
    """启动图：深色底 + 居中图标，和应用首屏同色，衔接不闪白。"""
    S = size * 2
    base = vgradient(S, S, BG_TOP, BG_BOT).convert('RGBA')
    icon = make_icon(int(S * 0.28))
    off = (S - icon.width) // 2
    base.paste(icon, (off, off), icon)
    return base.resize((size, size), Image.LANCZOS)


def main():
    # Windows 图标：从 256 到 16 全尺寸
    sizes = [256, 128, 64, 48, 40, 32, 24, 16]
    frames = [make_icon(s, with_text=s >= 32) for s in sizes]
    ico = os.path.join(BUILD, 'icon.ico')
    frames[0].save(ico, format='ICO', sizes=[(s, s) for s in sizes])
    print('[icon] ' + ico + '  (' + ', '.join(str(s) for s in sizes) + ')')

    # 主图（Android / 文档用）
    png = os.path.join(BUILD, 'icon.png')
    make_icon(1024).save(png)
    print('[icon] ' + png)

    # Android launcher 各密度
    adir = os.path.join(BUILD, 'android')
    os.makedirs(adir, exist_ok=True)
    for dens, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        sub = os.path.join(adir, 'mipmap-' + dens)
        os.makedirs(sub, exist_ok=True)
        make_icon(px).save(os.path.join(sub, 'ic_launcher.png'))
        # 圆形图标（部分启动器会用）
        ic = make_icon(px)
        mask = Image.new('L', (px, px), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, px - 1, px - 1], fill=255)
        ic.putalpha(mask)
        ic.save(os.path.join(sub, 'ic_launcher_round.png'))
        print('[icon] android/' + dens + ' ' + str(px) + 'px')

    # 如果已经用 Capacitor 生成了 Android 工程，直接铺进去
    andr = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(andr):
        print('[icon] 未发现 android/ 工程，跳过原生图标')
        return

    dens_px = [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216),
               ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]
    for dens, launcher_px, fg_px in dens_px:
        sub = os.path.join(andr, 'mipmap-' + dens)
        os.makedirs(sub, exist_ok=True)
        make_icon(launcher_px).save(os.path.join(sub, 'ic_launcher.png'))
        ic = make_icon(launcher_px)
        m = Image.new('L', (launcher_px, launcher_px), 0)
        ImageDraw.Draw(m).ellipse([0, 0, launcher_px - 1, launcher_px - 1], fill=255)
        ic.putalpha(m)
        ic.save(os.path.join(sub, 'ic_launcher_round.png'))
        make_foreground(fg_px).save(os.path.join(sub, 'ic_launcher_foreground.png'))
        print('[icon] android mipmap-' + dens + ' (launcher ' + str(launcher_px)
              + ' / foreground ' + str(fg_px) + ')')

    # 启动图（Capacitor 默认用 drawable/splash.png）
    for d in ('drawable', 'drawable-land-hdpi', 'drawable-port-hdpi'):
        p = os.path.join(andr, d, 'splash.png')
        if os.path.exists(p):
            try:
                w, h = Image.open(p).size
            except Exception:
                w = h = 480
            make_splash(max(w, h)).resize((w, h), Image.LANCZOS).save(p)
            print('[icon] splash ' + d + ' ' + str(w) + 'x' + str(h))


if __name__ == '__main__':
    main()
