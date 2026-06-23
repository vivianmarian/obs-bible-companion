@echo off
:: ============================================================
:: OBS Bible Companion — Windows Startup Script
::
:: Double-click this file to start the RelayServer.
:: Keep this window open while using OBS and Companion.
:: Close it when your service is finished.
:: ============================================================

title OBS Bible Companion — RelayServer

echo.
echo  ==========================================
echo   OBS Bible Companion — RelayServer
echo  ==========================================
echo.

:: Move to the repo root (same folder as this script).
cd /d "%~dp0"

:: Check Node.js is installed.
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js was not found.
    echo  Please install Node.js from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

:: Check node_modules exists — remind operator to run npm install if not.
if not exist "node_modules" (
    echo  ERROR: Dependencies are not installed.
    echo  Please open a terminal in this folder and run:
    echo.
    echo      npm install
    echo.
    echo  Then close this window and double-click start.bat again.
    echo.
    pause
    exit /b 1
)

echo  Starting RelayServer on port 8765...
echo  Leave this window open during your service.
echo  Press Ctrl+C to stop.
echo.

npm run start:relay --workspace=project-b

:: If the server exits unexpectedly, pause so the operator can read the error.
echo.
echo  RelayServer stopped. Press any key to close this window.
pause >nul