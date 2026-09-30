@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ops\start-studio.ps1"
if errorlevel 1 pause
