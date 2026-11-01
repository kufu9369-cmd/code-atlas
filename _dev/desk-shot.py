# -*- coding: utf-8 -*-
"""把桌面露出来拍一张，看看快捷方式实际画成什么图标。
   思路：Win+D 显示桌面 → 全屏抓 → 再 Win+D 恢复。不改任何文件。
   用法：python _dev/desk-shot.py 输出.png
"""
import ctypes, sys, time
from ctypes import wintypes
from PIL import ImageGrab

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

u32 = ctypes.windll.user32
u32.keybd_event.argtypes = [wintypes.BYTE, wintypes.BYTE, wintypes.DWORD,
                            ctypes.POINTER(wintypes.ULONG)]
VK_LWIN, VK_D, KEYUP = 0x5B, 0x44, 0x0002


def tap_d():
    u32.keybd_event(VK_LWIN, 0, 0, None)
    u32.keybd_event(VK_D, 0, 0, None)
    time.sleep(0.06)
    u32.keybd_event(VK_D, 0, KEYUP, None)
    u32.keybd_event(VK_LWIN, 0, KEYUP, None)


out = sys.argv[1] if len(sys.argv) > 1 else '_dev/_shots/_desk.png'
tap_d()
time.sleep(1.2)
ImageGrab.grab(all_screens=True).save(out)
time.sleep(0.3)
tap_d()                      # 还原用户的窗口
print('saved', out)
