@echo off
REM DWX-52D 밀링 작업 로그 처리 - 30분마다 자동 실행
REM 이 스크립트는 무한 루프로 30분마다 node server.js를 실행합니다

REM 배치 파일이 있는 디렉토리로 이동
cd /d %~dp0

echo ========================================
echo DWX-52D 자동 로그 처리 시작
echo ========================================
echo 프로젝트 경로: %CD%
echo.

:loop
echo [%date% %time%] 작업 시작...
node server.js

echo.
echo [%date% %time%] 작업 완료. 30분 후 다시 실행됩니다.
echo ========================================
echo.

REM 30분 = 1800초
timeout /t 1800 /nobreak

goto loop
