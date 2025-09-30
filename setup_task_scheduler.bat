@echo off
REM Windows 작업 스케줄러에 자동 작업 등록
REM 관리자 권한으로 실행해야 합니다

echo ========================================
echo Windows 작업 스케줄러 설정
echo ========================================
echo.

REM 현재 디렉토리 경로 가져오기
set CURRENT_DIR=%~dp0
set CURRENT_DIR=%CURRENT_DIR:~0,-1%

echo 작업 경로: %CURRENT_DIR%
echo.

REM 기존 작업 삭제 (있는 경우)
schtasks /Delete /TN "DWX52D_LogProcessor" /F 2>nul

REM 30분마다 실행되는 작업 생성
schtasks /Create ^
    /TN "DWX52D_LogProcessor" ^
    /TR "\"%CURRENT_DIR%\run_task.bat\"" ^
    /SC MINUTE ^
    /MO 30 ^
    /ST 00:00 ^
    /F

if %errorlevel% equ 0 (
    echo.
    echo ✅ 성공! 30분마다 자동 실행되도록 설정되었습니다.
    echo.
    echo 📋 작업 확인:
    echo    - 작업 스케줄러 열기: taskschd.msc
    echo    - 작업 이름: DWX52D_LogProcessor
    echo.
    echo 🛠️  작업 관리:
    echo    - 삭제: schtasks /Delete /TN "DWX52D_LogProcessor" /F
    echo    - 실행: schtasks /Run /TN "DWX52D_LogProcessor"
    echo    - 중지: schtasks /End /TN "DWX52D_LogProcessor"
) else (
    echo.
    echo ❌ 실패! 관리자 권한으로 실행해주세요.
    echo    우클릭 → 관리자 권한으로 실행
)

echo.
pause
