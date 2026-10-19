@echo off
chcp 65001 > nul
title Rockstar 2.0 (Supabase & .EXE Launcher Integrated)

echo ========================================================
echo   Запуск Rockstar 2.0 Web Server & Supabase System
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Проверка зависимостей...
if not exist "node_modules" (
    echo Установка модулей npm...
    call npm install
)

echo [2/2] Запуск сервера на порту 3000...
start "" "http://localhost:3000"
node server.js

pause
