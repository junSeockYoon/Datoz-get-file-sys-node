@echo off
REM DWX-52D 밀링 작업 로그 처리 - 1회 실행
REM 테스트용 또는 수동 실행용

REM 배치 파일이 있는 디렉토리로 이동
cd /d %~dp0

echo ========================================
echo DWX-52D 로그 처리 실행
echo ========================================
echo.
echo 프로젝트 경로: %CD%
echo 시작 시간: %date% %time%
echo.

node server.js

echo.
echo 완료 시간: %date% %time%
echo ========================================
echo.
pause
