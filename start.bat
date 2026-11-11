@echo off
title Universal Video Downloader
cd /d "%~dp0"
echo ==============================================
echo   تشغيل منزّل الفيديوهات (Video Downloader)
echo ==============================================
echo.
echo جاري فتح المتصفح وتشغيل الخادم...
start http://localhost:3000
node dev.js
pause
