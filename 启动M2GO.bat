@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "M2GO_SECRET_FILE=%LOCALAPPDATA%\M2GO\manager.env"
if exist "%M2GO_SECRET_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%M2GO_SECRET_FILE%") do set "%%A=%%B"
)
echo.
echo 正在启动 M2GO 每周班表...
echo 启动后请保持这个窗口开启；关闭窗口即可停止。
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"
call node_modules\.bin\vinext.cmd dev
echo.
echo M2GO 已停止。
pause
