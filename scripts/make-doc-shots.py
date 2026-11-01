# -*- coding: utf-8 -*-
"""重新生成 README 里用的那几张界面截图（docs/screenshots/）。

为什么要有这个脚本：`docs/screenshots/*.png` 是手工截的，界面一改（比如去掉
标题栏和品牌块）图就跟不上，而 README 里还挂着旧图 —— 读者看到的是个已经不存在的界面。
这里把每张图的「窗口尺寸 + 皮肤 + 打开哪一页」写成固定配方，改完界面跑一次就行。

用法：python scripts/make-doc-shots.py [名字...]
    不给名字就全跑。
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXE = os.path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
OUT = os.path.join(ROOT, 'docs', 'screenshots')
TMP = os.path.join(ROOT, '_dev', '_shots')

# (文件名, 窗口 DIP 尺寸, 注入脚本)。屏幕是 150%，截出来正好是像素尺寸 ×1.5。
CASES = [
    ('home',        '1352x849', 'CodeAtlas.gotoSnippet("vlan-create"); 1'),
    ('mobile-lab',  '533x600',  'CodeAtlas.gotoLab(CodeAtlas.D.labs[0].id); 1'),
    ('narrow',      '430x720',  'CodeAtlas.gotoSnippet("vlan-create"); 1'),
    ('task',        '1440x1100', 'CodeAtlas.gotoPreset("preset-l3-office"); 1'),
    ('skins',       '1440x900', 'document.querySelector("[data-skin-open]").click(); 1'),
    ('skin-nord',   '1440x900', 'window.SKINS.apply("nord", true); CodeAtlas.gotoSnippet("vlan-create"); 1'),
]


def run(name, size, js):
    env = {k: v for k, v in os.environ.items()
           if not k.upper().startswith(('ELECTRON', 'WORKBUDDY'))}
    shot = os.path.join(TMP, '_doc_' + name + '.png')
    env['CODEATLAS_SHOT'] = shot
    env['CODEATLAS_SHOT_SIZE'] = size
    if js:
        env['CODEATLAS_SHOT_JS'] = js
    ud = os.path.join(TMP, '_ud_doc_' + name)
    try:
        subprocess.run([EXE, '.', '--user-data-dir=' + ud], env=env, cwd=ROOT,
                       timeout=60, capture_output=True)
    except subprocess.TimeoutExpired:
        print('  %-12s TIMEOUT' % name)
        return False
    if not os.path.exists(shot):
        print('  %-12s FAIL（没有生成截图）' % name)
        return False
    dst = os.path.join(OUT, name + '.png')
    os.replace(shot, dst)
    print('  %-12s OK  %d KB' % (name, os.path.getsize(dst) // 1024))
    return True


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    only = sys.argv[1:]
    good = 0
    total = 0
    for name, size, js in CASES:
        if only and name not in only:
            continue
        total += 1
        if run(name, size, js):
            good += 1
    print('\n完成 %d / %d 张' % (good, total))
