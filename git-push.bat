@echo off
setlocal

echo ========================================================
echo        1-Click Auto Commit and Push to GitHub
echo ========================================================
echo.

set /p MSG="Enter commit message (or press Enter for 'Auto update'): "
if "%MSG%"=="" set MSG=Auto update application code

echo.
echo Staging changes...
git add .

echo Committing with message: "%MSG%"...
git commit -m "%MSG%"

echo.
echo Pushing to GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo [ERROR] Git push failed!
) else (
    echo.
    echo ========================================================
    echo [SUCCESS] Pushed to GitHub!
    echo GitHub Actions pipeline has been triggered automatically.
    echo Watch it live: https://github.com/Rajankumar69/HealthCare_Sys/actions
    echo ========================================================
)
pause
