@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\.bin\vinext.cmd" (
  echo The project needs its packages installed first.
  echo Please open this folder in Codex and ask: "Run the M2GO schedule locally."
  pause
  exit /b 1
)

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"
call "node_modules\.bin\vinext.cmd" dev
endlocal

 