@echo off
setlocal
cd /d "%~dp0"
set "PYTHON=C:\Users\ebima\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

"%PYTHON%" -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --onefile ^
  --collect-submodules selenium.webdriver ^
  --name OpalSingleImageFormAutomator ^
  opal_single_image_form.py

if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

copy /Y opal_single_image_config.json dist\opal_single_image_config.json >nul 2>nul
if exist style_instruction.txt copy /Y style_instruction.txt dist\style_instruction.txt >nul 2>nul

echo Build complete: dist\OpalSingleImageFormAutomator.exe
pause
