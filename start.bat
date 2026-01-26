@echo off
REM The 586 Dynasty - Development Server Startup Script
REM Double-click this file or run from command prompt to start both servers

echo.
echo ======================================
echo   The 586 Dynasty - Dev Servers
echo ======================================
echo.

REM Kill existing node processes
echo Cleaning up existing processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Start backend in a new window
echo Starting Backend API (port 3000)...
start "586 Backend" cmd /k "cd /d %~dp0backend && npm run dev"

REM Wait for backend to initialize
timeout /t 3 /nobreak >nul

REM Start mobile in a new window
echo Starting Mobile/Web App (port 8082)...
start "586 Mobile" cmd /k "cd /d %~dp0mobile && npx expo start --web --port 8082"

echo.
echo ======================================
echo   Servers Starting...
echo ======================================
echo.
echo   Backend API: http://localhost:3000
echo   Mobile/Web:  http://localhost:8082
echo.
echo Close this window or the server windows to stop.
echo.
pause
