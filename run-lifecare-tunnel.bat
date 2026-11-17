@echo off
echo ========================================================
echo       Starting Life Care Custom Portal URL
echo ========================================================
echo.
echo Target URL: https://lifecare-portal.loca.lt
echo.
echo Retrieving your tunnel security IP/Password...
for /f "delims=" %%I in ('curl -s https://loca.lt/mytunnelpassword') do set TUNNEL_PWD=%%I
echo.
echo --------------------------------------------------------
echo NOTE: If the browser asks for a "Tunnel Password",
echo enter this IP: %TUNNEL_PWD%
echo --------------------------------------------------------
echo.
echo Starting tunnel...
npx localtunnel --port 4200 --subdomain lifecare-portal
pause
