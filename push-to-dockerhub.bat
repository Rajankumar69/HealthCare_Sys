@echo off
setlocal

echo ========================================================
echo   Auto-Pushing All Healthcare Images to Docker Hub
echo ========================================================
echo.

:: Hardcoded Username & Tag
set DOCKER_USER=rajan69106
set TAG=latest

echo Target Account: https://hub.docker.com/u/%DOCKER_USER%
echo Image Tag:      %TAG%
echo.

:: Step 1: Ensure Docker Login
echo Checking Docker login status...
docker login -u %DOCKER_USER%
if errorlevel 1 (
    echo.
    echo [ERROR] Docker login failed! Please check credentials.
    pause
    exit /b %errorlevel%
)

:: Step 2: Build all 5 images automatically
echo.
echo ========================================================
echo 1/2: Building all 5 Docker Images...
echo ========================================================
docker compose build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b %errorlevel%
)

:: Step 3: Push all 5 images automatically
echo.
echo ========================================================
echo 2/2: Uploading all 5 images to Docker Hub...
echo ========================================================
docker compose push
if errorlevel 1 (
    echo.
    echo [ERROR] Upload failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo [SUCCESS] All 5 images uploaded successfully!
echo ========================================================
echo 1. %DOCKER_USER%/healthcare-authservice:%TAG%
echo 2. %DOCKER_USER%/healthcare-healthcareservice:%TAG%
echo 3. %DOCKER_USER%/healthcare-globalsearchservice:%TAG%
echo 4. %DOCKER_USER%/healthcare-apigateway:%TAG%
echo 5. %DOCKER_USER%/healthcare-frontend:%TAG%
echo ========================================================
pause
