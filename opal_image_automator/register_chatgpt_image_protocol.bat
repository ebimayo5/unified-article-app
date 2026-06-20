@echo off
set "EXE=%~dp0dist\OpalSingleImageFormAutomator.exe"
if not exist "%EXE%" (
  echo EXE not found: %EXE%
  pause
  exit /b 1
)
reg add "HKCU\Software\Classes\chatgptimage" /ve /d "URL:ChatGPT Image Generator Protocol" /f >nul
reg add "HKCU\Software\Classes\chatgptimage" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\chatgptimage\shell\open\command" /ve /d "\"%EXE%\"" /f >nul
echo Registered chatgptimage://run
pause
