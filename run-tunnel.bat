@echo off
echo ========================================================
echo Starting Cloudflare Tunnel (100%% Free Public HTTPS URL)
echo ========================================================
echo.
echo Connecting Healthcare System to Cloudflare Edge...
echo Look for your public URL (ending in .trycloudflare.com) below!
echo.
docker run --rm -it --network healthcare-system_default cloudflare/cloudflared:latest tunnel --protocol http2 --url http://frontend:80
pause
