@echo off
echo ========================================
echo   Local Work Hub
echo ========================================
echo.
echo Starting...
echo Access: http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo ========================================

set "WIN_DIR=%~dp0"

for /f "usebackq delims=" %%i in (`wsl wslpath "%WIN_DIR%"`) do set "WSL_DIR=%%i"

echo WSL path: %WSL_DIR%

wsl -d Ubuntu-22.04 bash -lc "cd '%WSL_DIR%' && ./start.sh"

pause