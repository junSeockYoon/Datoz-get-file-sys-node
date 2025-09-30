@echo off
REM DWX-52D 밀링 작업 로그 처리 - 작업 스케줄러용
REM pause 없이 실행되고 자동으로 종료됩니다

REM 배치 파일이 있는 디렉토리로 이동
cd /d %~dp0

REM 로그 파일에 실행 시간 기록
echo ======================================== >> scheduler.log
echo 실행 시간: %date% %time% >> scheduler.log
echo 프로젝트 경로: %CD% >> scheduler.log
echo. >> scheduler.log

REM Node.js 스크립트 실행
node server.js >> scheduler.log 2>&1

REM 완료 시간 기록
echo. >> scheduler.log
echo 완료 시간: %date% %time% >> scheduler.log
echo ======================================== >> scheduler.log
echo. >> scheduler.log
