# -*- coding: utf-8 -*-
"""
从 logo.png 生成全平台应用图标。

logo.png 是设计稿本身：深色圆角方块 + 书本 + `</>`。
本脚本只做「工程化」，不重画：原图四角是白底，直接缩会带一圈白边，
所以要先把圆角方块抠出来、换成透明遮罩，再按各平台规格重采样。

输出（与旧版脚本一致，路径不变）：
  build/icon.ico            Windows，256 → 16 多尺寸
  build/icon.png            1024 主图（托盘 / 文档 / 商店）
  build/android/*.png       Android 各密度 launcher
  android/app/src/main/res/ 原生图标 + 自适应图标前景 + 启动图 + 自适应背景色
"""
import os
import sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
LOGO = os.path.join(ROOT, 'logo.png')
os.makedirs(BUILD, exist_ok=True)

# 圆角半径占边长的比例。原图实测：沿顶边下探 40px 时横向内缩 101px，
# 解圆的方程得 r≈231.5 / 边长 1092 → 21.2%。
CORNER = 0.212

# 启动图底色，与 assets/styles.css 的 --bg / --bg-2 同色，切换不闪白
BG_TOP = (12, 15, 21)
BG_BOT = (9, 11, 16)


def vgradient(w, h, top, bot):
    """竖向渐变底"""
    img = Image.new('RGB', (1, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.point((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h), Image.BILINEAR)


def rounded_mask(size, radius, inset=0):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [inset, inset, size - 1 - inset, size - 1 - inset],
        radius=max(1, radius - inset), fill=255)
    return m


def circle_mask(size):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
    return m


def crop_art(im):
    """裁到深色圆角方块的外接矩形。原图四周留白，且白底 252 左右，很好判。"""
    W, H = im.size
    px = im.load()

    def dark(x, y):
        r, g, b = px[x, y][:3]
        return (r * 299 + g * 587 + b * 114) / 1000 < 120

    xs = [x for x in range(W) if dark(x, H // 2)]
    ys = [y for y in range(H) if dark(W // 2, y)]
    if not xs or not ys:
        raise SystemExit('[icon] logo.png 里没找到深色圆角方块，检查一下图是不是被裁过')
    # 各往里收 1px：最外圈是抗锯齿的过渡像素，留着会在图标边上泛白
    return im.crop((xs[0] + 1, ys[0] + 1, xs[-1], ys[-1]))


def build_master():
    """1024 透明底主图：圆角方块本体。4 倍超采样出遮罩，边缘才干净。"""
    art = crop_art(Image.open(LOGO).convert('RGB'))
    # 原图外接框不是严格正方形（1092×1101），先拉成正方形，0.8% 的形变肉眼无感
    S = 4096
    big = art.resize((S, S), Image.LANCZOS)
    # inset 10/4096 ≈ 1024 下的 2.5px：原图白底的抗锯齿会留一圈浅色描边，
    # 放在深色背景上看就是一道灰弧，遮罩往里收一点正好切掉
    big.putalpha(rounded_mask(S, int(S * CORNER), inset=int(S * 0.0025)))
    return big.resize((1024, 1024), Image.LANCZOS)


def build_bleed():
    """四角补满，得到「铺满整张」的方图。

    Android 自适应图标的前景层要铺满 108dp：拿带圆角的方块直接铺，
    四角是透明的，启动器的背景会从角上透出来，接缝一眼就看见。

    补法是低分辨率上反复「模糊 + 把已知区钉回原值」，等价于解拉普拉斯方程，
    透明角会顺着周围真实的底色长出来 —— 比按上下边缘插值准，因为这张图的
    底色不光上下有渐变，左右也有，只按一个方向补会在接缝处对不上。
    """
    n = 128
    rgb = MASTER.convert('RGB').resize((n, n), Image.LANCZOS)
    known = MASTER.getchannel('A').resize((n, n), Image.LANCZOS) \
        .point(lambda v: 255 if v > 200 else 0)
    cur = rgb
    # 球差一样的收敛速度：半径 4、200 轮，角上取到的色和同高度真实底色差 1 个色阶
    for _ in range(200):
        cur = Image.composite(cur, cur.filter(ImageFilter.GaussianBlur(4)), known)
    bg = cur.resize((MASTER.width, MASTER.height), Image.LANCZOS).convert('RGBA')
    return Image.alpha_composite(bg, MASTER)


def corner_color(im):
    """补出来的四角平均色，当 Android 自适应图标的背景色。"""
    W, H = im.size
    k = max(2, int(W * 0.04))
    acc = [0, 0, 0]
    n = 0
    for cx in (k, W - k * 2):
        for cy in (k, H - k * 2):
            for x in range(cx, cx + k):
                for y in range(cy, cy + k):
                    p = im.getpixel((x, y))
                    acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]
                    n += 1
    return tuple(v // max(1, n) for v in acc)


def sharpen(im, amount=90, contrast=1.0):
    """小尺寸重采样后线条会糊，锐化 + 提对比（只动 RGB，别碰 alpha，否则边缘发黑）。"""
    r, g, b, a = im.split()
    rgb = Image.merge('RGB', (r, g, b)).filter(
        ImageFilter.UnsharpMask(radius=0.6, percent=amount, threshold=0))
    if contrast != 1.0:
        rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    return Image.merge('RGBA', rgb.split() + (a,))


def make_icon(size):
    out = MASTER.resize((size, size), Image.LANCZOS)
    # 这图是细线条，缩到 24 以下就只剩灰糊 —— 小尺寸得多给点对比才看得出是本书
    if size <= 24:
        return sharpen(out, 320, 1.4)
    if size <= 48:
        return sharpen(out, 180, 1.15)
    if size <= 64:
        return sharpen(out, 90, 1.0)
    return out


def make_bleed(size):
    return BLEED.resize((size, size), Image.LANCZOS)


def make_round(size):
    ic = BLEED.resize((size, size), Image.LANCZOS)
    ic.putalpha(circle_mask(size))
    return ic


def make_splash(size):
    """启动图：深色底 + 居中图标，和应用首屏同色，衔接不闪白。"""
    S = size * 2
    base = vgradient(S, S, BG_TOP, BG_BOT).convert('RGBA')
    icon = make_icon(int(S * 0.28))
    off = (S - icon.width) // 2
    base.paste(icon, (off, off), icon)
    return base.resize((size, size), Image.LANCZOS)


MASTER = None
BLEED = None


def main():
    global MASTER, BLEED
    if not os.path.exists(LOGO):
        raise SystemExit('[icon] 缺少 logo.png：' + LOGO)
    MASTER = build_master()
    BLEED = build_bleed()

    # Windows 图标：从 256 到 16 全尺寸
    sizes = [256, 128, 64, 48, 40, 32, 24, 16]
    frames = [make_icon(s) for s in sizes]
    ico = os.path.join(BUILD, 'icon.ico')
    frames[0].save(ico, format='ICO', sizes=[(s, s) for s in sizes])
    print('[icon] ' + ico + '  (' + ', '.join(str(s) for s in sizes) + ')')

    # 主图（托盘 / Android / 文档用）
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
        make_round(px).save(os.path.join(sub, 'ic_launcher_round.png'))
        print('[icon] android/' + dens + ' ' + str(px) + 'px')

    # 如果已经用 Capacitor 生成了 Android 工程，直接铺进去
    andr = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(andr):
        print('[icon] 未发现 android/ 工程，跳过原生图标')
        return

    # 前景层按 108dp 的整数倍出图：mdpi 108 / xxxhdpi 432
    dens_px = [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216),
               ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]
    for dens, launcher_px, fg_px in dens_px:
        sub = os.path.join(andr, 'mipmap-' + dens)
        os.makedirs(sub, exist_ok=True)
        make_icon(launcher_px).save(os.path.join(sub, 'ic_launcher.png'))
        make_round(launcher_px).save(os.path.join(sub, 'ic_launcher_round.png'))
        make_bleed(fg_px).save(os.path.join(sub, 'ic_launcher_foreground.png'))
        print('[icon] android mipmap-' + dens + ' (launcher ' + str(launcher_px)
              + ' / foreground ' + str(fg_px) + ')')

    # 自适应背景色跟图标底色对齐（前景已经铺满，实际只在个别启动器的
    # 视差动画里露出来，但配错了会闪一条别色边）
    mid = corner_color(BLEED)
    xml = os.path.join(andr, 'values', 'ic_launcher_background.xml')
    if os.path.isdir(os.path.dirname(xml)):
        with open(xml, 'w', encoding='utf-8', newline='\n') as f:
            f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                    '    <color name="ic_launcher_background">#%02X%02X%02X</color>\n'
                    '</resources>\n' % mid)
        print('[icon] 自适应背景色 #%02X%02X%02X' % mid)

    # 启动图（Capacitor 默认用 drawable*/splash.png）
    for d in sorted(os.listdir(andr)):
        if not d.startswith('drawable'):
            continue
        p = os.path.join(andr, d, 'splash.png')
        if not os.path.exists(p):
            continue
        try:
            w, h = Image.open(p).size
        except Exception:
            w = h = 480
        make_splash(max(w, h)).resize((w, h), Image.LANCZOS).save(p)
        print('[icon] splash ' + d + ' ' + str(w) + 'x' + str(h))


if __name__ == '__main__':
    main()
