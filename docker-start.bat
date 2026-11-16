@echo off
echo ========================================================
echo Starting Healthcare System via Docker Compose...
echo ========================================================
echo.
docker compose up --build -d
echo.
echo ========================================================
echo System status:
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
echo Use "docker compose logs -f" to view real-time logs.
echo Use "docker compose down" to stop all containers.
pause
