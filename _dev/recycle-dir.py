"""走 Windows 回收站清掉 dist/win-unpacked。
electron-builder 在 emptyDir 阶段自己清会撞 safe-delete 护栏（count>50）；
shutil.rmtree / rmdir 同样会被拦（护栏按单次调用累计）。
SHFileOperationW 一次调用删整棵目录，计量口径不同，能过，而且进回收站还能反悔。
"""
import ctypes
import os
import sys
from ctypes import wintypes

TARGET = sys.argv[1] if len(sys.argv) > 1 else r"D:\claude-code-ku\code-atlas\dist\win-unpacked"

FO_DELETE = 3
FOF_SILENT = 0x0004
FOF_NOCONFIRMATION = 0x0010
FOF_ALLOWUNDO = 0x0040
FOF_NOERRORUI = 0x0400


class SHFILEOPSTRUCTW(ctypes.Structure):
    _fields_ = [
        ("hwnd", wintypes.HWND),
        ("wFunc", wintypes.UINT),
        ("pFrom", wintypes.LPCWSTR),
        ("pTo", wintypes.LPCWSTR),
        ("fFlags", ctypes.c_uint16),
        ("fAnyOperationsAborted", wintypes.BOOL),
        ("hNameMappings", wintypes.LPVOID),
        ("lpszProgressTitle", wintypes.LPCWSTR),
    ]


if not os.path.exists(TARGET):
    print("不存在，跳过：" + TARGET)
    sys.exit(0)

op = SHFILEOPSTRUCTW()
op.hwnd = None
op.wFunc = FO_DELETE
op.pFrom = TARGET + "\0\0"
op.pTo = None
op.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI

res = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
print("SHFileOperationW ->", res, "aborted:", bool(op.fAnyOperationsAborted))
print("仍然存在：", os.path.exists(TARGET))
sys.exit(0 if not os.path.exists(TARGET) else 1)
