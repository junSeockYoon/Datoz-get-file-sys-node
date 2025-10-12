@echo off
chcp 65001 >nul
echo.
echo ================================
echo   od-log 파일 처리 시작
echo ================================
echo.

node server.js od

echo.
echo 처리 완료!
pause

