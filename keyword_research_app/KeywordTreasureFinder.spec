# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = ['tkinter', 'tkinter.filedialog', 'tkinter.messagebox', 'tkinter.ttk', '_tkinter']
hiddenimports += collect_submodules('selenium.webdriver')
hiddenimports += collect_submodules('selenium.webdriver.chrome')
hiddenimports += collect_submodules('selenium.webdriver.common')


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[('C:\\Users\\ebima\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\DLLs\\_tkinter.pyd', '.'), ('C:\\Users\\ebima\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\DLLs\\tcl86t.dll', '.'), ('C:\\Users\\ebima\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\DLLs\\tk86t.dll', '.')],
    datas=[('C:\\Users\\ebima\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\tcl\\tcl8.6', '_tcl_data'), ('C:\\Users\\ebima\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\tcl\\tk8.6', '_tk_data')],
    hiddenimports=hiddenimports,
    hookspath=['hooks'],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='KeywordTreasureFinder',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
