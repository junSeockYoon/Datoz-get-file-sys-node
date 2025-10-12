@echo off
chcp 65001 >nul
echo.
echo ================================
echo   DWX-52D JSON 파일 처리 시작
echo ================================
echo.

node server.js dwx

echo.
echo 처리 완료!
pause

