@echo off
echo ========================================
echo   Local Work Hub - Build
echo ========================================
echo.
echo Building production assets...
echo Run this after code changes, then start daily use with "start.bat".
echo ========================================

cd /d "%~dp0"

call npm.cmd run build
if errorlevel 1 goto :error

echo.
echo Build completed successfully.
echo You can now run: start.bat

goto :end

:error
echo.
echo Build failed. Please check the error above.

:end

pause
