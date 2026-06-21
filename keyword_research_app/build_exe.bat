@echo off
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
for %%i in ("%PYTHON_CMD%") do set "PYROOT=%%~dpi"
if "%PYROOT:~-1%"=="\" set "PYROOT=%PYROOT:~0,-1%"

"%PYTHON_CMD%" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1
if "%PYROOT%"=="" exit /b 1
"%PYTHON_CMD%" -m PyInstaller --clean --onefile --windowed --name KeywordTreasureFinder ^
  --additional-hooks-dir hooks ^
  --collect-submodules selenium.webdriver ^
  --collect-submodules selenium.webdriver.chrome ^
  --collect-submodules selenium.webdriver.common ^
  --hidden-import tkinter ^
  --hidden-import tkinter.filedialog ^
  --hidden-import tkinter.messagebox ^
  --hidden-import tkinter.ttk ^
  --hidden-import _tkinter ^
  --add-binary "%PYROOT%\DLLs\_tkinter.pyd;." ^
  --add-binary "%PYROOT%\DLLs\tcl86t.dll;." ^
  --add-binary "%PYROOT%\DLLs\tk86t.dll;." ^
  --add-data "%PYROOT%\tcl\tcl8.6;_tcl_data" ^
  --add-data "%PYROOT%\tcl\tk8.6;_tk_data" ^
  main.py
if errorlevel 1 exit /b 1
if not exist dist\output mkdir dist\output
if not exist dist\logs mkdir dist\logs
copy /Y config.json dist\config.json
if errorlevel 1 exit /b 1
xcopy /E /I /Y data dist\data
if errorlevel 1 exit /b 1
xcopy /E /I /Y sample dist\sample
if errorlevel 1 exit /b 1
if not exist dist\keyword_input.xlsx if exist keyword_input.xlsx copy /Y keyword_input.xlsx dist\keyword_input.xlsx
echo.
echo Build completed: dist\KeywordTreasureFinder.exe
