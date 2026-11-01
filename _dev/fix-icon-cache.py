# -*- coding: utf-8 -*-
"""重建 Windows 图标缓存。

现象：exe 里的图标资源已经换了，但资源管理器还画着旧图标 ——
图标缓存是按路径存的，不比对文件时间，重装也照样用旧的那一份。

做法（可回退）：关掉 explorer → 把 iconcache_*.db / thumbcache_*.db
挪到备份目录（不删）→ 重新拉起 explorer。想还原就把备份挪回去。

用法：python _dev/fix-icon-cache.py [--dry]
"""
import glob
import os
import shutil
import subprocess
import sys
import time

EXP = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Windows\Explorer')
BAK = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Windows\Explorer\_iconcache_bak')
DRY = '--dry' in sys.argv


def explorer_pids():
    out = subprocess.run(['tasklist', '/fi', 'imagename eq explorer.exe', '/fo', 'csv', '/nh'],
                         capture_output=True, text=True, errors='replace').stdout
    return [l.split(',')[0].strip('"') for l in out.splitlines() if l.startswith('"')]


def main():
    files = sorted(glob.glob(os.path.join(EXP, 'iconcache_*.db'))
                   + glob.glob(os.path.join(EXP, 'thumbcache_*.db')))
    print('待处理 %d 个缓存文件，合计 %.1f MB'
          % (len(files), sum(os.path.getsize(f) for f in files) / 1048576))
    if DRY:
        for f in files:
            print('  ', os.path.basename(f))
        return

    print('关 explorer …（pid %s）' % ','.join(explorer_pids() or ['-']))
    subprocess.run(['taskkill', '/f', '/im', 'explorer.exe'], capture_output=True)
    for _ in range(20):
        if not explorer_pids():
            break
        time.sleep(0.25)

    os.makedirs(BAK, exist_ok=True)
    moved = 0
    for f in files:
        try:
            shutil.move(f, os.path.join(BAK, os.path.basename(f)))
            moved += 1
        except OSError as e:
            print('  跳过 %s：%s' % (os.path.basename(f), e))
    print('已挪走 %d 个，备份在 %s' % (moved, BAK))

    subprocess.Popen(['explorer.exe'])
    time.sleep(2.5)
    print('explorer 已重启，pid %s' % ','.join(explorer_pids() or ['未起来']))


if __name__ == '__main__':
    main()
