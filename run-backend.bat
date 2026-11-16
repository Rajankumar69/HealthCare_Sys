@echo off
echo ========================================================
echo Starting Healthcare Backend Microservices...
echo ========================================================
echo.
start "AuthService (Port 5010)" cmd /k "cd /d "%~dp0backend\AuthService" && dotnet run --no-build"
start "HealthcareService (Port 5020)" cmd /k "cd /d "%~dp0backend\HealthcareService" && dotnet run --no-build"
start "GlobalSearchService (Port 5030)" cmd /k "cd /d "%~dp0backend\GlobalSearchService" && dotnet run --no-build"
timeout /t 3 /nobreak >nul
start "ApiGateway (Port 5000)" cmd /k "cd /d "%~dp0backend\ApiGateway" && dotnet run --no-build"

echo.
echo [OK] Microservices launched in separate windows:
echo   - AuthService:         http://localhost:5010
echo   - HealthcareService:   http://localhost:5020
echo   - GlobalSearchService: http://localhost:5030
echo   - ApiGateway:          http://localhost:5000
echo.
