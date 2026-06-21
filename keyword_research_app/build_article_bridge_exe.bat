@echo off
setlocal
set "PYTHON_CMD=%PYTHON_EXE%"
if "%PYTHON_CMD%"=="" set "PYTHON_CMD=python"
if not exist "%PYTHON_CMD%" (
  for /f "delims=" %%i in ('where "%PYTHON_CMD%" 2^>nul') do (
    set "PYTHON_CMD=%%i"
    goto python_found
  )
)
:python_found
if not exist "%PYTHON_CMD%" set "PYTHON_CMD=C:\Users\ebima\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

"%PYTHON_CMD%" -m PyInstaller --clean --onefile --console --name ArticleBridge ^
  --additional-hooks-dir hooks ^
  --collect-submodules selenium.webdriver ^
  --collect-submodules selenium.webdriver.chrome ^
  --collect-submodules selenium.webdriver.common ^
  article_bridge.py
if errorlevel 1 exit /b 1

if not exist dist\data mkdir dist\data
xcopy /E /I /Y data dist\data
if errorlevel 1 exit /b 1

if not exist dist\article_bridge_config.json copy /Y article_bridge_config.json dist\article_bridge_config.json
copy /Y ARTICLE_BRIDGE_README.md dist\ARTICLE_BRIDGE_README.md
echo.
echo Build completed: dist\ArticleBridge.exe
