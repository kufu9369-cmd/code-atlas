# -*- coding: utf-8 -*-
"""
对打包后的桌面成品做自动化截图回归。
原理：启动 CodeAtlas.exe，通过 CODEATLAS_SHOT 让它把自己渲染好的界面存成 PNG 后退出。
窗口被挪到屏幕外，不影响正在用电脑的人。
"""
import subprocess
import os
import sys

EXE = r'D:\claude-code-ku\code-atlas\dist\win-unpacked\CodeAtlas.exe'
OUT = r'D:\claude-code-ku\code-atlas\_dev\_shots'

CASES = [
    # (截图名, 要执行的导航脚本)。首页不需要额外脚本，这里必须传 None，
    # 早先误把中文说明写在这一位，导致 '首页片段' 被当 JS 执行、每次 HOME 都失败。
    ('shot_home',      None),
    ('shot_labs',      'CodeAtlas.gotoView("labs"); 1'),
    ('shot_lab_detail', 'CodeAtlas.gotoLab("lab-mstp-instance"); 1'),
    ('shot_presets',   'CodeAtlas.gotoPreset("preset-l3-office"); 1'),
    ('shot_flows',     'CodeAtlas.gotoFlow(CodeAtlas.D.flows[0].id); 1'),
    ('shot_packs',     'document.querySelector(".foot-btn").click(); 1'),
    ('shot_light',     'CodeAtlas.applyTheme("light", true); CodeAtlas.gotoLab("lab-dhcp-relay"); 1'),
    ('shot_search',    'var q=document.getElementById("q"); q.value="ospf"; q.dispatchEvent(new Event("input",{bubbles:true})); 1'),
]


def run(name, js):
    env = {k: v for k, v in os.environ.items()
           if not k.upper().startswith(('ELECTRON', 'WORKBUDDY'))}
    env['CODEATLAS_SHOT'] = os.path.join(OUT, name + '.png')
    if js:
        env['CODEATLAS_SHOT_JS'] = js
    try:
        p = subprocess.run([EXE], env=env, cwd=os.path.dirname(EXE), timeout=45,
                           capture_output=True)
        ok = os.path.exists(env['CODEATLAS_SHOT'])
        size = os.path.getsize(env['CODEATLAS_SHOT']) if ok else 0
        print('  %-16s %s  %d KB' % (name, 'OK ' if ok else 'FAIL', size // 1024))
        return ok
    except subprocess.TimeoutExpired:
        print('  %-16s TIMEOUT' % name)
        return False


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    good = 0
    for name, js in CASES:
        if only and name not in only:
            continue
        print('◆ ' + name)
        if run(name, js):
            good += 1
    print('\n完成 %d 张' % good)
