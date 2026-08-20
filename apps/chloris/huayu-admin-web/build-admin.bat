@echo off
setlocal
cd /d %~dp0
call npm ci --include=dev
if errorlevel 1 exit /b %errorlevel%
call npm run build
if errorlevel 1 exit /b %errorlevel%
echo.
echo Chloris admin build completed.
pause
