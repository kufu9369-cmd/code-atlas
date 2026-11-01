# -*- coding: utf-8 -*-
"""取 Windows 实际会画出来的文件图标，存成 PNG。
   SHGetFileInfoW 走的就是资源管理器那套（含图标缓存），所以它给什么，
   桌面上就是什么。和 build/icon.ico 一比就知道是「exe 里图标不对」
   还是「缓存没刷」。

   用法：python _dev/icon-probe.py 输出目录 [路径...]
"""
import ctypes, os, sys
from ctypes import wintypes
from PIL import Image

shell32 = ctypes.windll.shell32
user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

SHGFI_ICON = 0x000000100
SHGFI_LARGEICON = 0x000000000
SHGFI_SMALLICON = 0x000000001
SHGFI_USEFILEATTRIBUTES = 0x000000010


class SHFILEINFOW(ctypes.Structure):
    _fields_ = [
        ('hIcon', wintypes.HICON),
        ('iIcon', ctypes.c_int),
        ('dwAttributes', wintypes.DWORD),
        ('szDisplayName', wintypes.WCHAR * 260),
        ('szTypeName', wintypes.WCHAR * 80),
    ]


class ICONINFO(ctypes.Structure):
    _fields_ = [
        ('fIcon', wintypes.BOOL),
        ('xHotspot', wintypes.DWORD),
        ('yHotspot', wintypes.DWORD),
        ('hbmMask', wintypes.HBITMAP),
        ('hbmColor', wintypes.HBITMAP),
    ]


class BITMAP(ctypes.Structure):
    _fields_ = [
        ('bmType', wintypes.LONG), ('bmWidth', wintypes.LONG),
        ('bmHeight', wintypes.LONG), ('bmWidthBytes', wintypes.LONG),
        ('bmPlanes', wintypes.WORD), ('bmBitsPixel', wintypes.WORD),
        ('bmBits', wintypes.LPVOID),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', wintypes.DWORD), ('biWidth', wintypes.LONG),
        ('biHeight', wintypes.LONG), ('biPlanes', wintypes.WORD),
        ('biBitCount', wintypes.WORD), ('biCompression', wintypes.DWORD),
        ('biSizeImage', wintypes.DWORD), ('biXPelsPerMeter', wintypes.LONG),
        ('biYPelsPerMeter', wintypes.LONG), ('biClrUsed', wintypes.DWORD),
        ('biClrImportant', wintypes.DWORD),
    ]


def hicon_to_png(hicon, out):
    ii = ICONINFO()
    if not user32.GetIconInfo(hicon, ctypes.byref(ii)):
        raise OSError('GetIconInfo failed')
    bm = BITMAP()
    gdi32.GetObjectW(ii.hbmColor, ctypes.sizeof(bm), ctypes.byref(bm))
    w, h = bm.bmWidth, bm.bmHeight

    bi = BITMAPINFOHEADER()
    bi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.biWidth = w
    bi.biHeight = -h          # 负数 = 自上而下
    bi.biPlanes = 1
    bi.biBitCount = 32
    buf = ctypes.create_string_buffer(w * h * 4)
    hdc = user32.GetDC(None)
    gdi32.GetDIBits(hdc, ii.hbmColor, 0, h, buf, ctypes.byref(bi), 0)
    user32.ReleaseDC(None, hdc)

    im = Image.frombytes('RGBA', (w, h), buf.raw, 'raw', 'BGRA')
    im.save(out)
    if ii.hbmColor:
        gdi32.DeleteObject(ii.hbmColor)
    if ii.hbmMask:
        gdi32.DeleteObject(ii.hbmMask)
    return w, h


shell32.SHGetFileInfoW.argtypes = [
    ctypes.c_wchar_p, wintypes.DWORD, ctypes.POINTER(SHFILEINFOW),
    wintypes.UINT, wintypes.UINT]
shell32.SHGetFileInfoW.restype = ctypes.c_void_p
user32.DestroyIcon.argtypes = [wintypes.HICON]
user32.GetIconInfo.argtypes = [wintypes.HICON, ctypes.POINTER(ICONINFO)]
gdi32.GetObjectW.argtypes = [wintypes.HGDIOBJ, ctypes.c_int, ctypes.c_void_p]
user32.GetDC.argtypes = [wintypes.HWND]
user32.GetDC.restype = wintypes.HDC
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, wintypes.UINT,
                            wintypes.UINT, ctypes.c_void_p,
                            ctypes.POINTER(BITMAPINFOHEADER), wintypes.UINT]
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]


def probe(path, out, large=True):
    flags = SHGFI_ICON | (SHGFI_LARGEICON if large else SHGFI_SMALLICON)
    info = SHFILEINFOW()
    r = shell32.SHGetFileInfoW(path, 0, ctypes.byref(info),
                               ctypes.sizeof(info), flags)
    if not r or not info.hIcon:
        return None
    size = hicon_to_png(info.hIcon, out)
    user32.DestroyIcon(info.hIcon)
    return size


if __name__ == '__main__':
    outdir = sys.argv[1]
    paths = sys.argv[2:] or [r'D:\CodeAtlas\CodeAtlas.exe']
    os.makedirs(outdir, exist_ok=True)
    for p in paths:
        name = os.path.basename(p).replace('.', '_')
        for tag, large in (('big', True), ('small', False)):
            out = os.path.join(outdir, '%s_%s.png' % (name, tag))
            try:
                sz = probe(p, out, large)
                print('%-52s %-6s %s' % (p, tag, sz))
            except Exception as e:
                print('%-52s %-6s 失败 %s' % (p, tag, e))
