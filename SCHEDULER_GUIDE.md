# 자동 실행 설정 가이드

DWX-52D 밀링 작업 로그를 30분마다 자동으로 처리하는 방법입니다.

---

## 📌 Windows PC

### 방법 1: 무한 루프 스크립트 (가장 간단) ✅ 권장

1. **`run_scheduler.bat` 더블클릭**
2. 창이 열리고 30분마다 자동 실행됩니다
3. 중지하려면 창을 닫으세요

**장점:**
- 설정 불필요
- 즉시 시작
- 언제든지 중지 가능

**단점:**
- PC 재시작 시 수동으로 다시 실행해야 함
- 창이 항상 열려있어야 함

---

### 방법 2: Windows 작업 스케줄러 (백그라운드 실행)

1. **`setup_task_scheduler.bat` 우클릭**
2. **"관리자 권한으로 실행"** 선택
3. 완료!

**장점:**
- PC 재시작 후에도 자동 실행
- 백그라운드 실행 (창 안 뜸)
- Windows 시작 시 자동 시작 가능

**단점:**
- 관리자 권한 필요
- 설정이 복잡

#### 작업 관리 명령어

```cmd
# 작업 삭제
schtasks /Delete /TN "DWX52D_LogProcessor" /F

# 작업 수동 실행
schtasks /Run /TN "DWX52D_LogProcessor"

# 작업 중지
schtasks /End /TN "DWX52D_LogProcessor"

# 작업 확인
schtasks /Query /TN "DWX52D_LogProcessor"
```

#### GUI로 관리하기

1. `Win + R` → `taskschd.msc` 입력
2. "DWX52D_LogProcessor" 작업 찾기
3. 우클릭 → 속성/실행/삭제 등

---

### 방법 3: 수동 실행

- **`run_once.bat` 더블클릭** - 1회만 실행

---

## 🍓 라즈베리 파이

### 1. 프로젝트 복사

```bash
# 라즈베리 파이로 프로젝트 복사 (방법 1: USB)
# Windows에서 프로젝트 폴더를 USB에 복사 후
# 라즈베리 파이에서:
cp -r /media/usb/get-file-sys ~/

# 또는 (방법 2: Git)
git clone <repository-url>
cd get-file-sys
```

### 2. Node.js 설치 (필요시)

```bash
# Node.js 설치 확인
node --version

# 없으면 설치
sudo apt-get update
sudo apt-get install nodejs npm
```

### 3. 패키지 설치

```bash
cd ~/get-file-sys
npm install
```

### 4. 자동 실행 설정

```bash
# 실행 권한 부여
chmod +x raspberry_pi_setup.sh

# 설정 스크립트 실행
./raspberry_pi_setup.sh
```

### 5. 관리 명령어

```bash
# cron 작업 확인
crontab -l

# 로그 확인 (실시간)
tail -f ~/get-file-sys/scheduler.log

# 수동 실행
~/get-file-sys/run_job.sh

# cron 작업 수정/삭제
crontab -e
```

---

## 📊 실행 주기

| 설정 | 실행 시간 |
|------|----------|
| `*/30 * * * *` | 매 30분마다 (00:00, 00:30, 01:00, ...) |
| `0 * * * *` | 매 시간 정각 (00:00, 01:00, 02:00, ...) |
| `0 */2 * * *` | 2시간마다 (00:00, 02:00, 04:00, ...) |
| `0 9,17 * * *` | 매일 9시, 17시 |

### 주기 변경 방법

#### Windows (작업 스케줄러)
```cmd
# 20분마다
schtasks /Change /TN "DWX52D_LogProcessor" /RI 20

# 1시간마다
schtasks /Change /TN "DWX52D_LogProcessor" /RI 60
```

#### 라즈베리 파이
```bash
# cron 수정
crontab -e

# 예시:
# */20 * * * * ~/get-file-sys/run_job.sh  # 20분마다
# 0 * * * * ~/get-file-sys/run_job.sh     # 1시간마다
```

---

## 🔍 로그 확인

### Windows
- **프로그램 로그**: `logs/log_YYYY-MM-DD.txt`
- **에러 로그**: `logs/errors/error_YYYY-MM-DD.txt`
- **스케줄러 로그**: `scheduler.log` (작업 스케줄러 사용 시)

### 라즈베리 파이
- **프로그램 로그**: `logs/log_YYYY-MM-DD.txt`
- **스케줄러 로그**: `scheduler.log`

```bash
# 최근 로그 확인
tail -100 ~/get-file-sys/logs/log_$(date +%Y-%m-%d).txt

# 스케줄러 로그 확인
tail -100 ~/get-file-sys/scheduler.log
```

---

## ⚠️ 문제 해결

### Windows

**문제: 작업 스케줄러가 실행 안 됨**
```cmd
# 작업 상태 확인
schtasks /Query /TN "DWX52D_LogProcessor" /V /FO LIST

# 수동으로 실행해보기
schtasks /Run /TN "DWX52D_LogProcessor"
```

**문제: 경로 오류**
- `setup_task_scheduler.bat`에서 경로가 잘못 설정되었을 수 있음
- 작업 스케줄러 GUI에서 "시작 위치" 확인

### 라즈베리 파이

**문제: cron이 실행 안 됨**
```bash
# cron 서비스 확인
sudo systemctl status cron

# cron 로그 확인
grep CRON /var/log/syslog

# 스크립트 권한 확인
ls -la ~/get-file-sys/run_job.sh
```

**문제: Node.js를 못 찾음**
```bash
# Node.js 경로 확인
which node

# run_job.sh에서 절대 경로 사용
# 예: /usr/bin/node server.js
```

---

## 📁 파일 설명

| 파일 | 용도 | 플랫폼 |
|------|------|--------|
| `run_scheduler.bat` | 30분마다 무한 실행 (화면 출력) | Windows |
| `run_once.bat` | 1회 수동 실행 (화면 출력 + pause) | Windows |
| `run_task.bat` | 작업 스케줄러용 (로그 파일에 기록) | Windows |
| `setup_task_scheduler.bat` | 작업 스케줄러 자동 등록 | Windows |
| `raspberry_pi_setup.sh` | cron 자동 설정 | 라즈베리 파이 |
| `run_job.sh` | cron 실행 스크립트 (자동 생성됨) | 라즈베리 파이 |

---

## 💡 권장 설정

### 테스트 환경 (PC)
→ **`run_once.bat`** 사용

### 개발 환경 (PC)
→ **`run_scheduler.bat`** 사용 (필요할 때만)

### 운영 환경 (라즈베리 파이)
→ **`raspberry_pi_setup.sh`** 사용 (자동 실행)

---

## ✅ 체크리스트

### Windows PC 설정 완료 후
- [ ] `run_once.bat`로 정상 작동 확인
- [ ] 30분 후 자동 실행 확인
- [ ] 로그 파일 생성 확인 (`logs/`)

### 라즈베리 파이 설정 완료 후
- [ ] `npm install` 완료
- [ ] `./run_job.sh` 수동 실행 정상 작동
- [ ] `crontab -l`로 작업 등록 확인
- [ ] 30분 후 자동 실행 확인
- [ ] `scheduler.log` 생성 확인
