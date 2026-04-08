@echo off
setlocal

:: ─────────────────────────────────────────────────────
::  F1 Intelligence — Local Dev Launcher
::  Run as Administrator to ensure clean port release.
:: ─────────────────────────────────────────────────────

set BACKEND_PORT=8010
set FRONTEND_PORT=5173
set PROJECT_DIR=D:\Projects\F1\f1-intelligence
set VENV_PYTHON=D:\Projects\F1\.venv\Scripts\python.exe
set VENV_UVICORN=D:\Projects\F1\.venv\Scripts\uvicorn.exe
set NODE_NPM=npm.cmd

echo.
echo  ==========================================
echo   F1 Intelligence Platform — Starting Up
echo  ==========================================
echo.

:: ── Step 1: Kill existing servers ────────────────────

echo [1/4] Killing existing Python processes...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM python3.exe /T >nul 2>&1
taskkill /F /IM uvicorn.exe /T >nul 2>&1
echo       Done.

echo [2/4] Killing existing Node / Vite processes...
taskkill /F /IM node.exe /T >nul 2>&1
echo       Done.

:: Brief pause to let ports release
timeout /t 2 /nobreak >nul

:: ── Step 2: Start backend ────────────────────────────

echo [3/4] Starting backend on port %BACKEND_PORT%...
start "F1 Backend (port %BACKEND_PORT%)" cmd /k ^
  "cd /d %PROJECT_DIR% && %VENV_UVICORN% backend.api.main:app --host 127.0.0.1 --port %BACKEND_PORT%"

:: Wait for backend to be ready (poll health endpoint)
echo       Waiting for backend...
:wait_backend
timeout /t 1 /nobreak >nul
curl -s "http://127.0.0.1:%BACKEND_PORT%/health" | find "ok" >nul 2>&1
if errorlevel 1 goto wait_backend
echo       Backend ready.

:: ── Step 3: Start frontend ───────────────────────────

echo [4/4] Starting frontend on port %FRONTEND_PORT%...
start "F1 Frontend (port %FRONTEND_PORT%)" cmd /k ^
  "cd /d %PROJECT_DIR%\frontend && %NODE_NPM% run dev"

:: Wait a moment then open browser
timeout /t 3 /nobreak >nul
echo.
echo  ==========================================
echo   All services started.
echo.
echo   Backend : http://127.0.0.1:%BACKEND_PORT%
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo  ==========================================
echo.

start "" "http://localhost:%FRONTEND_PORT%"

echo  Both terminal windows will stay open.
echo  Close them or press Ctrl+C to stop each service.
echo.
pause
