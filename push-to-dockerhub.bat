@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   Auto-Pushing All Healthcare Images to Docker Hub
echo ========================================================
echo.

:: Load settings from .env file if it exists
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%A in (.env) do (
        set %%A=%%B
    )
)

if "%DOCKER_USER%"=="" set DOCKER_USER=rajan69106
if "%TAG%"=="" set TAG=latest

echo Target Account: https://hub.docker.com/u/%DOCKER_USER%
echo Image Tag:      %TAG%
echo.

:: Step 1: Login to Docker Hub
echo Logging into Docker Hub...
if not "%DOCKER_TOKEN%"=="" (
    echo %DOCKER_TOKEN% | docker login -u %DOCKER_USER% --password-stdin
) else (
    docker login -u %DOCKER_USER%
)

if errorlevel 1 (
    echo.
    echo [ERROR] Docker login failed!
    pause
    exit /b %errorlevel%
)

:: Step 2: Build all 5 images
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

:: Step 3: Push all 5 images
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
echo [SUCCESS] All 5 images uploaded successfully to Docker Hub!
echo ========================================================
echo 1. %DOCKER_USER%/healthcare-authservice:%TAG%
echo 2. %DOCKER_USER%/healthcare-healthcareservice:%TAG%
echo 3. %DOCKER_USER%/healthcare-globalsearchservice:%TAG%
echo 4. %DOCKER_USER%/healthcare-apigateway:%TAG%
echo 5. %DOCKER_USER%/healthcare-frontend:%TAG%
echo ========================================================
pause
