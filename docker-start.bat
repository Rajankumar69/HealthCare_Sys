@echo off
echo ========================================================
echo Starting Healthcare System via Docker Compose...
echo ========================================================
echo.

:: 1. Pull latest images from Docker Hub if updated
echo Checking and pulling latest Docker images...
docker compose pull

:: 2. Start all containers in background
echo.
echo Starting all microservices and frontend...
docker compose up -d
echo.

:: 3. Show system status
echo ========================================================
echo System Status:
echo ========================================================
docker compose ps
echo.
echo Application URLs:
echo   - Frontend:            http://localhost:4200
echo   - ApiGateway:          http://localhost:5000
echo   - AuthService:         http://localhost:5010
echo   - HealthcareService:   http://localhost:5020
echo   - GlobalSearchService: http://localhost:5030
echo.
echo Use "docker-stop.bat" to stop all containers.
echo Use "run-tunnel.bat" to share a public link with anyone.
echo ========================================================
pause
