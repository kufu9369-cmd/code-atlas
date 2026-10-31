# ============================================================
#  check-hud-alpha.py —— 悬浮窗「真透明」的硬校验
#
#  为什么要单独一个脚本：
#  `html[data-hud="1"] { background: transparent }` 写得再对，
#  只要中间任何一层（#listPane 的 backdrop-filter、皮肤的 background-image、
#  body 的 radial-gradient）兜住底色，卡片外面就会变成一块不透明的黑/白。
#  肉眼看截图看不出来 —— 一张深色卡片铺在白底上，和真的透明长得一模一样。
#  所以直接读 PNG 的 alpha 通道：
#    四角 alpha 必须 ≈ 0，
#    卡片内部 alpha 必须 = --hud-a × 255 附近（默认 0.92 → 235），
#    卡片底色必须等于这套皮肤的 --bg（换肤有没有跟到透明卡片上，全靠这条）。
#
#  采样用「众数」而不是「中心点」：窗口小的时候中心点很容易落在某张卡片、
#  某条分割线或者滚动条上，会读出个既不是皮肤色也不像错的中间值，
#  然后让人怀疑半天是皮肤没生效。占面积最大的一定是卡片底色。
#
#  用法（需要 Pillow，用带依赖的 venv 解释器）：
#    "C:\Users\10137\.workbuddy\binaries\python\envs\default\Scripts\python.exe" \
#        _dev/check-hud-alpha.py
# ============================================================
import glob
import os
import sys
from collections import Counter

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, '_shots')

# 每张图期望的卡片底色（与 assets/styles.css 里对应皮肤的 --bg 一致）
EXPECT = {
    'skin_hud_nord.png':  (0x24, 0x29, 0x33),
    'skin_hud_jade.png':  (0x0E, 0x15, 0x12),
    'skin_hud_sepia.png': (0xF5, 0xEF, 0xE3),
    'skin_hud_min.png':   (0x07, 0x0B, 0x09),
}

# 圆角那一两个像素的抗锯齿会留下 140 左右的半透明点，单看峰值会误判。
# 看平均：真的被兜了底色时，整个角块都是 235 上下，平均必然远远超标。
# 16 这条线不是随手定的：卡片圆角 12 CSS px，150% 缩放下半径 18 物理像素，
# 6×6 角块刚好整块落在圆弧外面（再大就会切进卡片），此时均值实测 4~12。
CORNER_OK = 16
ALPHA_LO, ALPHA_HI = 170, 255   # --hud-a 被夹在 .72 ~ 1.00
COLOR_TOL = 14      # 色值容差（PNG 量化 + 滚动条等细微叠加）


def probe(path, want_rgb):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()

    print('\n%s  %dx%d' % (os.path.basename(path), w, h))
    bad = []

    # ---- 1. 四角必须是透明的（卡片圆角之外没有任何底色） ----
    for name, box in (
        ('左上', (0, 0, 6, 6)),
        ('右上', (w - 6, 0, w, 6)),
        ('左下', (0, h - 6, 6, h)),
        ('右下', (w - 6, h - 6, w, h)),
    ):
        raw = im.crop(box).tobytes()
        vals = raw[3::4]
        avg = sum(vals) / float(len(vals))
        peak = max(vals)
        good = avg <= CORNER_OK
        print('  %s 角 %s  alpha 均值 %.1f / 峰值 %d' % ('\u2713' if good else '\u00d7', name, avg, peak))
        if not good:
            bad.append('%s角的 alpha 均值 %.0f（应 < %d）—— 卡片外面被某层兜住了底色'
                       % (name, avg, CORNER_OK))

    # ---- 2. 必须存在真正的透明像素 ----
    raw_all = im.tobytes()
    transparent = raw_all[3::4].count(0)
    if transparent >= 20:
        print('  \u2713 真透明像素 %d 个（圆角外确实透出下层）' % transparent)
    else:
        bad.append('全图 alpha=0 的像素只有 %d 个，卡片外沿没有真正透明' % transparent)

    # ---- 3. 卡片底色 = 不透明像素的众数 ----
    small = im.resize((max(1, w // 3), max(1, h // 3)))
    buf = small.tobytes()
    opaque = [tuple(buf[i:i + 4]) for i in range(0, len(buf), 4) if buf[i + 3] > 150]
    if not opaque:
        bad.append('整张图没有不透明像素，卡片没画出来')
        return bad
    top = Counter(opaque).most_common(1)[0][0]
    a = top[3]
    print('  \u2713 卡片底色 rgb%s alpha=%d（%.0f%%）' % (top[:3], a, a / 255.0 * 100))

    if not (ALPHA_LO <= a <= ALPHA_HI):
        bad.append('卡片 alpha=%d，不在 %d~%d（--hud-a 没生效，或某层又叠了不透明底）'
                   % (a, ALPHA_LO, ALPHA_HI))

    if want_rgb:
        diff = max(abs(top[i] - want_rgb[i]) for i in range(3))
        if diff <= COLOR_TOL:
            print('  \u2713 卡片底色 ≈ 皮肤 --bg rgb%s' % (want_rgb,))
        else:
            bad.append('卡片底色 rgb%s 与皮肤 --bg rgb%s 差 %d —— 换肤没跟到透明卡片上'
                       % (top[:3], want_rgb, diff))

    return bad


def main():
    if not os.path.isdir(SHOTS):
        print('找不到 %s，先跑 node _dev/shot-skins.js' % SHOTS)
        return 1

    files = sorted(glob.glob(os.path.join(SHOTS, 'skin_hud_*.png')))
    if not files:
        print('没有 skin_hud_*.png，先跑 node _dev/shot-skins.js')
        return 1

    fails = []
    for f in files:
        fails += probe(f, EXPECT.get(os.path.basename(f)))

    print('\n' + ('\u2717 %d 项待修' % len(fails) if fails else '\u2713 透明全部合格'))
    for i, m in enumerate(fails):
        print('  %d. %s' % (i + 1, m))
    print('')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
