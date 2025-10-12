@echo off
chcp 65001 >nul
echo.
echo ================================
echo   모든 파일 처리 시작
echo   (DWX-52D + od-log)
echo ================================
echo.

node server.js both

echo.
echo 모든 처리 완료!
pause

