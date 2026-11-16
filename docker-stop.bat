@echo off
echo ========================================================
echo Stopping Healthcare System Containers...
echo ========================================================
echo.
docker compose down
echo.
echo All containers stopped and removed.
pause
