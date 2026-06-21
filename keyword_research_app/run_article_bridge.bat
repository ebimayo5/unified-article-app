@echo off
setlocal
set "APP_DIR=%~dp0"
set "PYTHON_CMD=%PYTHON_EXE%"
if "%PYTHON_CMD%"=="" set "PYTHON_CMD=python"
where "%PYTHON_CMD%" >nul 2>nul
if errorlevel 1 set "PYTHON_CMD=C:\Users\ebima\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%PYTHON_CMD%" (
  echo Python が見つかりません。
  echo Pythonをインストールするか、PYTHON_EXE に python.exe のパスを指定してください。
  pause
  exit /b 1
)
cd /d "%APP_DIR%"
"%PYTHON_CMD%" "%APP_DIR%article_bridge.py"
pause
