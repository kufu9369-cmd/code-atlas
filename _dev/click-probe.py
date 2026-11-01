"""在窗口客户区里点一下某个坐标，然后截窗口。

用来验证「点得到 / 点不到」这类只能眼看的东西（比如系统画的窗口按钮
会不会把页面上的元素挡住）。坐标按客户区**物理像素**算，和真屏截图一致。

用法：python _dev/click-probe.py out.png 64 930
"""
import ctypes
import sys
import time
from ctypes import wintypes

from PIL import ImageGrab

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

u32 = ctypes.windll.user32
u32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
u32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
u32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
u32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
u32.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
u32.SetForegroundWindow.argtypes = [wintypes.HWND]
u32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                             ctypes.c_int, ctypes.c_int, ctypes.c_uint]
u32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]

WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)


def find(key):
    hits = []

    def cb(hwnd, _lp):
        if not u32.IsWindowVisible(hwnd):
            return True
        n = u32.GetWindowTextLengthW(hwnd)
        if n:
            buf = ctypes.create_unicode_buffer(n + 1)
            u32.GetWindowTextW(hwnd, buf, n + 1)
            r = wintypes.RECT()
            u32.GetWindowRect(hwnd, ctypes.byref(r))
            hits.append((hwnd, buf.value, (r.left, r.top, r.right, r.bottom)))
        return True

    u32.EnumWindows(WNDENUMPROC(cb), 0)
    hits.sort(key=lambda t: (t[2][2] - t[2][0]) * (t[2][3] - t[2][1]), reverse=True)
    return [h for h in hits if key in h[1]]


def main():
    out = sys.argv[1]
    cx, cy = int(sys.argv[2]), int(sys.argv[3])

    hits = find('码典')
    if not hits:
        print('没找到窗口')
        return 1
    hwnd = hits[0][0]

    u32.ShowWindow(hwnd, 9)            # SW_RESTORE，最小化的窗口先还原
    u32.SetWindowPos(hwnd, 0, 60, 40, 1860, 1040, 0x0040 | 0x0010)
    u32.SetForegroundWindow(hwnd)
    time.sleep(0.8)

    pt = wintypes.POINT(0, 0)
    if not u32.ClientToScreen(hwnd, ctypes.byref(pt)):
        print('ClientToScreen 失败')
        return 1

    sx, sy = pt.x + cx, pt.y + cy
    u32.SetCursorPos(sx, sy)
    time.sleep(0.25)
    u32.mouse_event(0x0002, 0, 0, 0, 0)   # LEFTDOWN
    time.sleep(0.06)
    u32.mouse_event(0x0004, 0, 0, 0, 0)   # LEFTUP
    time.sleep(1.0)

    r = wintypes.RECT()
    u32.GetWindowRect(hwnd, ctypes.byref(r))
    ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True).save(out)
    print('客户区原点', (pt.x, pt.y), '点了客户区', (cx, cy), '= 屏幕', (sx, sy))
    print('窗口矩形', (r.left, r.top, r.right, r.bottom), '已保存', out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
