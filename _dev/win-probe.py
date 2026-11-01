"""抓一张「带系统窗口边框」的真屏截图，看清楚标题栏到底还在不在。

capturePage() 只能拍到网页内容，拍不到系统画的标题栏 / 窗口按钮，
所以验证「去掉标题栏」这类改动必须走真屏。

用法：
    python _dev/win-probe.py out.png [关键词]

流程：找到标题里带关键词的可见窗口 → 挪到固定位置 → 真屏截一块 → 存 png。
"""
import ctypes
import sys
import time
from ctypes import wintypes

from PIL import ImageGrab

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)   # PER_MONITOR_AWARE_V2
except Exception:
    pass

u32 = ctypes.windll.user32
u32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
u32.GetWindowTextLengthW.argtypes = [wintypes.HWND]

WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)


def titles():
    out = []

    def cb(hwnd, _lp):
        if not u32.IsWindowVisible(hwnd):
            return True
        n = u32.GetWindowTextLengthW(hwnd)
        if n:
            buf = ctypes.create_unicode_buffer(n + 1)
            u32.GetWindowTextW(hwnd, buf, n + 1)
            r = wintypes.RECT()
            u32.GetWindowRect(hwnd, ctypes.byref(r))
            out.append((hwnd, buf.value, (r.left, r.top, r.right, r.bottom)))
        return True

    u32.EnumWindows(WNDENUMPROC(cb), 0)
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '_dev/_shots/win-probe.png'
    key = sys.argv[2] if len(sys.argv) > 2 else '码典'

    hits = [t for t in titles() if key.lower() in t[1].lower()]
    if not hits:
        print('没找到标题含', key, '的窗口，现有窗口：')
        for _, t, r in titles():
            print('   ', repr(t), r)
        return 1

    hwnd, title, rect = hits[0]
    print('窗口', hex(hwnd), repr(title), rect)

    X, Y, W, H = 60, 40, 1860, 1040
    u32.SetWindowPos(hwnd, 0, X, Y, W, H, 0x0040 | 0x0010)   # SHOWWINDOW|NOACTIVATE
    time.sleep(1.2)

    # 客户区（不含标题栏）也打出来：和窗口矩形一比就知道标题栏占了多少
    rc = wintypes.RECT()
    u32.GetClientRect(hwnd, ctypes.byref(rc))
    pt = wintypes.POINT(0, 0)
    u32.ClientToScreen(hwnd, ctypes.byref(pt))
    print('客户区在屏幕上的位置', (pt.x, pt.y), '尺寸', (rc.right, rc.bottom))

    r = wintypes.RECT()
    u32.GetWindowRect(hwnd, ctypes.byref(r))
    img = ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True)
    img.save(out)
    print('已保存', out, img.size)
    return 0


if __name__ == '__main__':
    sys.exit(main())
