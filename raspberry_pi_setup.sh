#!/bin/bash
# 라즈베리 파이에서 30분마다 자동 실행 설정
# 사용법: chmod +x raspberry_pi_setup.sh && ./raspberry_pi_setup.sh

echo "========================================"
echo "라즈베리 파이 cron 설정"
echo "========================================"
echo ""

# 현재 디렉토리 경로
CURRENT_DIR=$(pwd)
PROJECT_DIR="$CURRENT_DIR"

echo "프로젝트 경로: $PROJECT_DIR"
echo ""

# Node.js 경로 확인
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo "❌ Node.js를 찾을 수 없습니다!"
    echo "   설치: sudo apt-get install nodejs npm"
    exit 1
fi

echo "✅ Node.js 경로: $NODE_PATH"
echo ""

# cron 작업 스크립트 생성
cat > run_job.sh << EOF
#!/bin/bash
# DWX-52D 로그 처리 스크립트
# cron에서 실행됨

# 프로젝트 디렉토리로 이동
cd "$PROJECT_DIR"

# 로그 파일에 실행 시간 기록
echo "----------------------------------------" >> scheduler.log
echo "실행 시간: \$(date '+%Y-%m-%d %H:%M:%S')" >> scheduler.log

# Node.js 스크립트 실행
$NODE_PATH server.js >> scheduler.log 2>&1

echo "완료 시간: \$(date '+%Y-%m-%d %H:%M:%S')" >> scheduler.log
echo "========================================" >> scheduler.log
echo "" >> scheduler.log
EOF

# 실행 권한 부여
chmod +x run_job.sh

echo "✅ 실행 스크립트 생성 완료: run_job.sh"
echo ""

# crontab에 추가할 내용
CRON_JOB="*/30 * * * * $PROJECT_DIR/run_job.sh"

# 기존 crontab 백업
crontab -l > crontab_backup.txt 2>/dev/null

# 기존에 같은 작업이 있는지 확인
if crontab -l 2>/dev/null | grep -q "run_job.sh"; then
    echo "⚠️  이미 cron 작업이 등록되어 있습니다."
    echo ""
    echo "현재 cron 작업:"
    crontab -l | grep "run_job.sh"
    echo ""
    read -p "기존 작업을 삭제하고 새로 등록하시겠습니까? (y/N): " answer
    if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
        echo "취소되었습니다."
        exit 0
    fi
    # 기존 작업 삭제
    crontab -l | grep -v "run_job.sh" | crontab -
fi

# 새 cron 작업 추가
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ cron 작업 등록 완료!"
echo ""
echo "========================================"
echo "📋 설정 정보"
echo "========================================"
echo "실행 주기: 30분마다"
echo "실행 스크립트: $PROJECT_DIR/run_job.sh"
echo "로그 파일: $PROJECT_DIR/scheduler.log"
echo ""
echo "🛠️  관리 명령어:"
echo "  - 작업 확인: crontab -l"
echo "  - 작업 삭제: crontab -e (해당 줄 삭제)"
echo "  - 로그 확인: tail -f $PROJECT_DIR/scheduler.log"
echo "  - 수동 실행: $PROJECT_DIR/run_job.sh"
echo ""
echo "✅ 설정 완료! 다음 30분 정각에 자동 실행됩니다."
echo "========================================"
