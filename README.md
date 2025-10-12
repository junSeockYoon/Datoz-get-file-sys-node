# 밀링 작업 로그 자동 전송 시스템

여러 형식의 밀링 작업 로그를 읽어서 API로 자동 전송하는 프로그램입니다.

## 📋 지원 형식

1. **DWX-52D JSON 파일**: Roland DWX-52D 장비의 JSON 작업 로그
2. **CAMeleon CS od-log 파일**: CAMeleon CS 시스템의 날짜별 텍스트 로그

## 📁 프로젝트 구조

```
get-file-sys/
├── config/
│   └── config.js              # 설정 파일 (디렉토리 경로, API URL, 필터 날짜 등)
├── processor/
│   ├── apiService.js          # API 호출 전용 모듈
│   └── odLogProcessor.js      # od-log 파일 처리 전용 모듈
├── logging/
│   └── logger.js              # 로그 파일 관리 모듈
├── logs/                      # 로그 파일 저장 디렉토리 (자동 생성)
│   ├── log_YYYY-MM-DD.txt     # 일별 로그 파일
│   └── errors/                # 오류 로그 전용 폴더
│       └── error_YYYY-MM-DD.txt  # 일별 오류 로그
├── server.js                  # 메인 프로그램 (파일 처리 통합)
├── raspberry_pi_setup.sh      # 라즈베리 파이 자동 설정 스크립트
├── run_once.sh                # 1회 실행 스크립트 (라즈베리 파이용)
├── package.json               # 프로젝트 의존성
├── .gitignore                 # Git 제외 파일 목록
└── README.md                  # 사용 설명서
```

## ✨ 주요 기능

1. **📅 날짜 필터링**: 설정된 날짜(기본: 2025년 10월 1일) 이후 생성된 파일만 처리
2. **🔍 스마트 중복 체크**: API에서 기존 주문 리스트를 조회하여 이미 전송된 주문은 자동으로 건너뜀
3. **🔄 자동 업데이트**: "작업중" 상태의 주문이 완료되면 자동으로 업데이트
4. **🌐 한글 인코딩 복원**: euc-jp로 잘못 인코딩된 한글 이름을 자동으로 복원
5. **📊 리포트 생성**: 작업 정보를 보기 좋은 형식으로 로그 파일에 저장
6. **📝 일별 로그 관리**: 날짜별로 로그 파일이 자동 생성 (예: `log_2025-10-12.txt`)
7. **⚡ 성능 최적화**: 중복 파일은 API 호출 없이 즉시 건너뛰어 처리 시간 대폭 단축

## 🚀 설치 방법

### Windows / Linux / macOS

```bash
npm install
```

### 라즈베리 파이 (자동 설정)

```bash
chmod +x raspberry_pi_setup.sh
./raspberry_pi_setup.sh
```

위 스크립트는 다음 작업을 자동으로 수행합니다:
- Node.js 설치 (없는 경우)
- npm 패키지 설치
- 30분마다 자동 실행되는 cron 작업 등록
- 로그 디렉토리 생성

## ⚙️ 설정 방법

`config/config.js` 파일에서 다음 항목을 수정하세요:

```javascript
module.exports = {
    // 모니터링할 대상 디렉토리
    targetDirectory: '/home/datoz/Public/shared',        // DWX-52D JSON 파일
    targetDirectory2: '/home/datoz/Public/shared-old',   // CAMeleon CS od-log 파일
    
    // API 설정
    apiListUrl: 'http://43.200.154.128/api/order/external/list',     // 주문 리스트 조회 (GET)
    apiUrl: 'http://43.200.154.128/api/order/external/create',       // 주문 생성 (POST)
    apiUpdateUrl: 'http://43.200.154.128/api/order/external/update', // 주문 업데이트 (POST)
    
    // 서버 포트
    port: 3000,
    
    // 로그 설정
    logLevel: 'info',        // 'debug', 'info', 'warn', 'error'
    includeEmojis: true,
    
    // 파일 필터 설정
    // ⭐ 이 날짜 이후에 생성된 파일만 처리합니다
    filterDate: '2025-10-01', // YYYY-MM-DD 형식
};
```

### 주요 설정 항목

- **targetDirectory**: DWX-52D JSON 파일들이 저장된 폴더 경로
- **targetDirectory2**: CAMeleon CS od-log 파일들이 저장된 폴더 경로
- **apiListUrl**: 주문 리스트 조회 API URL (GET)
- **apiUrl**: 주문 생성 API URL (POST)
- **apiUpdateUrl**: 주문 업데이트 API URL (POST)
- **filterDate**: 파일 필터링 기준 날짜 (이 날짜 이후 생성된 파일만 처리)

### 📅 날짜 필터 설정

`filterDate`를 수정하면 처리할 파일의 범위를 조정할 수 있습니다:

```javascript
filterDate: '2025-10-01',  // 2025년 10월 1일 이후 파일만 처리
filterDate: '2025-11-01',  // 2025년 11월 1일 이후 파일만 처리
filterDate: '2024-01-01',  // 2024년 1월 1일 이후 파일만 처리 (더 많은 파일)
```

## 💻 실행 방법

### 1. 모든 파일 처리 (기본값)

```bash
node server.js
# 또는
node server.js both
```

### 2. DWX-52D JSON 파일만 처리

```bash
node server.js dwx
```

### 3. od-log 파일만 처리

```bash
node server.js od
```

### 4. 라즈베리 파이에서 1회 실행

```bash
./run_once.sh
```

### 실행 모드 비교

| 모드 | 명령어 | 처리 대상 |
|------|--------|-----------|
| **모두** | `node server.js` 또는 `node server.js both` | DWX-52D JSON + od-log 파일 모두 |
| **DWX** | `node server.js dwx` | DWX-52D JSON 파일만 |
| **od-log** | `node server.js od` | CAMeleon CS od-log 파일만 |

## 🔄 API 연동 방식

### 스마트 처리 로직

프로그램은 DB 상태와 파일 데이터를 비교하여 자동으로 적절한 작업을 수행합니다.

| DB 상태 | 파일 상태 | 동작 | API | 설명 |
|---------|----------|------|-----|------|
| 없음 | 완료 | ✅ 생성 | CREATE | 신규 주문 |
| 없음 | 작업중 | ✅ 생성 | CREATE | 신규 주문 |
| 작업중 | 완료 | 🔄 업데이트 | UPDATE | 작업 완료됨 |
| 작업중 | 작업중 | ⏭️ 건너뛰기 | - | 변경 없음 |
| 완료 | 완료 | ⏭️ 건너뛰기 | - | 이미 처리됨 |
| 완료 | 작업중 | ⏭️ 건너뛰기 | - | DB가 최신 |

### 처리 흐름

```
1️⃣ 프로그램 시작
   → GET /api/order/external/list (전체 주문 목록 조회)
   → 메모리에 저장 (예: 100건)

2️⃣ 각 파일 처리
   파일 날짜 확인 → 필터 날짜(2025-10-01) 이후인가?
   → 아니오: 건너뛰기 (로그에 기록)
   → 예: 파일 읽기 계속
   
   파일 읽기 → 주문자: "이수경", 시작: "2025-10-22 10:16", 상태: "완료"
   → 메모리의 주문 목록에서 중복 검색
   
   ✅ 케이스 1: 일치하는 주문 없음
      → POST /api/order/external/create
      → 신규 생성 ✅
   
   ✅ 케이스 2: 일치하는 주문 있음 & DB 상태 "완료"
      → ⏭️ 건너뛰기 (중복, API 호출 없음)
   
   ✅ 케이스 3: 일치하는 주문 있음 & DB 상태 "작업중" & 파일 상태 "완료"
      → POST /api/order/external/update
      → "작업중" → "완료"로 업데이트 🔄

3️⃣ 모든 파일 처리 완료
   → 최종 결과 요약 출력
```

### API 전송 데이터 형식

#### DWX-52D JSON 파일

```json
{
  "equipmentModel": "DWX-52D",
  "orderer": "이수경",
  "workStartTime": "2025-10-22 10:16:00",
  "workEndTime": "2025-10-22 10:43:00",
  "totalWorkTime": 27,
  "result": "완료",
  "error": null
}
```

#### CAMeleon CS od-log 파일

```json
{
  "equipmentModel": "CAMeleon CS",
  "orderer": "작업파일명.nc",
  "workStartTime": "2025-10-15 09:14:36",
  "workEndTime": "2025-10-15 10:08:23",
  "totalWorkTime": 54,
  "result": "완료"
}
```

**주요 차이점:**
- DWX-52D: 주문자가 STL 파일명에서 추출된 이름
- od-log: 주문자가 작업 파일명(.nc 파일)

### API 응답 구조 (필수!)

`create` API는 반드시 다음 형식으로 응답해야 합니다:

```json
{
  "success": true,
  "message": "주문이 성공적으로 생성되었습니다.",
  "data": {
    "orderer": "이수경",
    "workStartTime": "2025-10-22T10:16:00.000+09:00",
    "result": "완료",
    "orderCode": "ORD-2025-0001"
  }
}
```

`list` API (GET) 응답:

```json
{
  "success": true,
  "data": [
    {
      "orderer": "이수경",
      "workStartTime": "2025-10-22T10:16:00.000+09:00",
      "result": "완료",
      "orderCode": "ORD-2025-0001"
    },
    {
      "orderer": "김상배",
      "workStartTime": "2025-10-24T09:24:00.000+09:00",
      "result": "작업중",
      "orderCode": "ORD-2025-0002"
    }
  ]
}
```

### 필드 설명

- **equipmentModel**: 장비 모델명 (예: DWX-52D, CAMeleon CS)
- **orderer**: 주문자 이름 (한글로 자동 변환)
- **workStartTime**: 작업 시작 시간 (yyyy-MM-dd HH:mm:ss)
- **workEndTime**: 작업 종료 시간 (yyyy-MM-dd HH:mm:ss, 작업중이면 null)
- **totalWorkTime**: 총 작업 시간 (분 단위, 작업중이면 null)
- **result**: 작업 결과 ("완료" 또는 "작업중")
- **error**: 오류 메시지 (오류가 있을 경우)

## 📊 실행 결과

### 시나리오 1: 첫 실행 (모든 파일 신규)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 처리 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 신규 생성: 16건
🔄 업데이트: 0건 (작업중 → 완료)
⏭️  건너뜀: 0건 (이미 완료)
❌ 실패: 0건
📁 총 파일: 16개
📋 DB: 완료 16건, 작업중 0건 (전체 16건)

📝 로그 파일: C:\Users\yoon\Desktop\work\get-file-sys\logs\log_2025-10-12.txt
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 시나리오 2: 재실행 (모두 이미 완료됨) ⚡

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 처리 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 신규 생성: 0건
🔄 업데이트: 0건
⏭️  건너뜀: 16건 (이미 완료)  ← 모두 건너뜀!
❌ 실패: 0건
📁 총 파일: 16개
📋 DB: 완료 16건, 작업중 0건 (전체 16건)
⚡ 절약된 시간: 약 8초
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 시나리오 3: 혼합 (신규 + 업데이트 + 완료)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 처리 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 신규 생성: 3건          ← 새로운 주문
🔄 업데이트: 5건 (작업중 → 완료)  ← DB에 "작업중"이던 것 → "완료"로
⏭️  건너뜀: 8건 (이미 완료)      ← DB에 이미 "완료"로 있음
❌ 실패: 0건
📁 총 파일: 16개
📋 DB: 완료 21건, 작업중 0건 (전체 21건)
⚡ 절약된 시간: 약 4초
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 시나리오 4: 날짜 필터링 적용

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 처리 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
전체 JSON 파일: 150개 발견
📅 필터 통과: 45개 파일 (105개 제외됨)  ← 오래된 파일 제외

✅ 신규 생성: 12건
🔄 업데이트: 3건
⏭️  건너뜀: 30건
❌ 실패: 0건
📁 처리한 파일: 45개
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📝 로그 관리

### 로그 파일 위치

- **일반 로그**: `logs/log_YYYY-MM-DD.txt`
- **오류 로그**: `logs/errors/error_YYYY-MM-DD.txt`

### 로그 파일 예시 (logs/log_2025-10-12.txt)

```
[15:38:42] ℹ️ 🔍 스캔 디렉토리: /home/datoz/Public/shared
[15:38:42] ℹ️ 📅 필터 조건: 2025. 10. 1. 이후 생성된 파일만 처리
[15:38:42] ℹ️ ════════════════════════════════════════════════════════════

[15:38:42] ℹ️ 🔍 전체 주문 목록 조회 중...
[15:38:42] ✅ 전체 주문 100건 조회 완료 (234ms)
[15:38:42] ℹ️    📊 완료: 85건, 작업중: 15건

[15:38:42] ℹ️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[15:38:42] ℹ️ 📄 [1/16] DWINDEX_20251012103813-v3.json
[15:38:42] ℹ️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋 DWX-52D 밀링 작업 리포트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[15:38:42] ℹ️ ┌─ 장비 및 작업 정보
[15:38:42] ℹ️ │  • 장비 모델: DWX-52D
[15:38:42] ℹ️ │  • 시리얼 번호: KGE3279
[15:38:42] ℹ️ │  • 주문자: 김상배
[15:38:42] ℹ️ │  • 작업 이름: Job_2025-10-12_09-53-48...
[15:38:42] ℹ️ │  • 작업 유형: Full Contour Bridge (2개)
[15:38:42] ℹ️ │  • 원본 파일: 20251012_0922_김상배a3.5삼_0.stl
[15:38:42] ℹ️ └─────────────────────────

[15:38:42] ℹ️ ┌─ API 전송 (신규 주문 생성)
[15:38:42] ℹ️ │  • 주문자: 김상배
[15:38:42] ℹ️ │  • 장비: DWX-52D
[15:38:42] ℹ️ │  • 작업시간: 35분
[15:38:42] ℹ️ │  • 결과: 완료
[15:38:42] ℹ️ │
[15:38:42] ℹ️ │  🚀 CREATE API 요청 중...
[15:38:42] ✅ API 전송 성공: 주문이 성공적으로 생성되었습니다. (156ms)
[15:38:42] ℹ️ │  • 주문 코드: ORD-2025-0065
[15:38:42] ℹ️ └─────────────────────────
```

### 로그 레벨과 아이콘

| 레벨 | 아이콘 | 용도 | 에러 폴더 저장 |
|------|--------|------|----------------|
| **INFO** | ℹ️ | 일반 정보 | ❌ |
| **SUCCESS** | ✅ | 성공 메시지 | ❌ |
| **ERROR** | ❌ | 오류 메시지 | ✅ (자동 저장) |
| **WARN** | ⚠️ | 경고 메시지 | ❌ |
| **DEBUG** | 🔍 | 디버그 메시지 | ❌ |

## 🍓 라즈베리 파이 설정

### 자동 설정 (권장)

```bash
chmod +x raspberry_pi_setup.sh
./raspberry_pi_setup.sh
```

### 수동 설정

1. **Node.js 설치** (없는 경우)
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **프로젝트 설정**
   ```bash
   cd /home/datoz/get-file-sys
   npm install
   ```

3. **cron 작업 등록** (30분마다 자동 실행)
   ```bash
   crontab -e
   ```
   
   다음 줄 추가:
   ```
   */30 * * * * cd /home/datoz/get-file-sys && /usr/bin/node server.js >> /home/datoz/get-file-sys/logs/cron.log 2>&1
   ```

4. **1회 실행 테스트**
   ```bash
   ./run_once.sh
   ```

### cron 작업 확인

```bash
# cron 작업 목록 확인
crontab -l

# cron 로그 확인
tail -f logs/cron.log
```

## ⚡ 성능 분석

### 파일 개수별 예상 처리 시간

#### 첫 실행 (모든 파일 전송)

| 파일 개수 | 예상 시간 | 비고 |
|----------|----------|------|
| 16개 | 8초 | 테스트 환경 |
| 100개 | 55초 | 소규모 |
| 1,000개 | 9분 | 중규모 |
| 5,000개 | 46분 | 대규모 |
| 10,000개 | 92분 | 초대규모 |

#### 재실행 (95% 중복 시나리오) - 날짜 필터 적용 시

| 파일 개수 | 필터 통과 | 중복 건수 | 예상 시간 | 성능 향상 |
|----------|----------|----------|-----------|-----------|
| 100개 | 20개 | 18개 | **2초** | 27배 빠름 ⚡⚡⚡ |
| 1,000개 | 200개 | 190개 | **15초** | 36배 빠름 ⚡⚡⚡ |
| 5,000개 | 1,000개 | 950개 | **2분** | 23배 빠름 ⚡⚡⚡ |
| 10,000개 | 2,000개 | 1,900개 | **5분** | 18배 빠름 ⚡⚡⚡ |

### 핵심 최적화

1. **📅 날짜 필터링**: 설정된 날짜 이후 파일만 처리 (대부분의 오래된 파일 제외)
2. **🔍 스마트 중복 체크**: 메모리에 주문 목록을 저장하여 중복 확인 (API 호출 불필요)
3. **⏭️ 빠른 건너뛰기**: 중복 파일은 딜레이 없이 즉시 건너뜀
4. **📊 절약 시간 표시**: 얼마나 빨라졌는지 실시간 확인

### 실제 사용 시나리오

```
상황: 매일 새 파일 10-20개만 추가됨

┌─ 날짜 필터 미적용 (filterDate 비활성화)
│  전체 10,000개 파일 스캔 → 중복 체크 → 92분 소요
│
└─ 날짜 필터 적용 (filterDate: '2025-10-01')
   최근 1,000개 파일만 스캔 → 중복 체크 → 2분 소요 ✨
   
   → 90분 절약! (46배 빠름) ⚡⚡⚡
```

## 🔧 모듈 설명

### `server.js`
- 메인 프로그램
- 파일 처리 흐름 제어
- JSON 파일 읽기 및 파싱
- 한글 인코딩 변환
- 리포트 생성

### `processor/apiService.js`
- API 호출 전용 모듈
- 주문 생성 (CREATE)
- 주문 업데이트 (UPDATE)
- 주문 목록 조회 (LIST)
- 중복 체크 로직
- 날짜/시간 포맷팅
- 에러 처리

### `processor/odLogProcessor.js`
- od-log 파일 처리 전용 모듈
- 텍스트 파싱
- 작업 시간 계산
- API 전송 데이터 구성

### `logging/logger.js`
- 로그 파일 관리 모듈
- 일별 로그 파일 자동 생성
- 로그 레벨별 기록
- 타임스탬프 자동 추가
- 아이콘 자동 삽입
- 섹션 박스 형태 지원
- **오류 로그 자동 분리**

### `config/config.js`
- 설정 관리
- 디렉토리 경로
- API 엔드포인트 URL
- **날짜 필터 설정**

## 🛠️ 문제 해결

### API 연결 실패

**증상**: `❌ 주문 목록 조회 실패: ECONNREFUSED`

**해결 방법**:
1. API 서버가 실행 중인지 확인
2. `config/config.js`의 API URL이 올바른지 확인
3. 방화벽이 연결을 차단하지 않는지 확인
4. 네트워크 연결 상태 확인

```bash
# API 서버 연결 테스트
curl http://43.200.154.128/api/order/external/list
```

### 한글이 깨져서 표시되는 경우

**증상**: 주문자 이름이 `���`, `鸞몄긽諛�` 같이 표시됨

**해결 방법**:
- 이 프로그램은 자동으로 euc-jp → euc-kr 변환을 시도합니다
- 여전히 깨진다면 원본 JSON 파일의 인코딩을 확인하세요
- 로그 파일은 UTF-8로 저장되므로 UTF-8 지원 에디터로 열어야 합니다 (VS Code 권장)

### 파일을 찾을 수 없는 경우

**증상**: `❌ JSON 파일을 찾을 수 없습니다.`

**해결 방법**:
1. `config/config.js`의 `targetDirectory` 경로가 올바른지 확인
2. 해당 폴더에 `.json` 파일이 있는지 확인
3. 폴더 접근 권한 확인 (읽기 권한 필요)

```bash
# 폴더 내용 확인
ls -la /home/datoz/Public/shared
```

### 날짜 필터로 모든 파일이 제외되는 경우

**증상**: `📅 2025. 10. 1. 이후 생성된 파일이 없습니다.`

**해결 방법**:
1. `config/config.js`의 `filterDate`를 더 이전 날짜로 변경
2. 파일의 생성/수정 날짜 확인

```bash
# 파일 날짜 확인
ls -lt /home/datoz/Public/shared/*.json | head
```

### 라즈베리 파이에서 cron이 실행되지 않는 경우

**증상**: cron 작업이 등록되었지만 실행되지 않음

**해결 방법**:
1. cron 로그 확인: `cat logs/cron.log`
2. cron 서비스 상태 확인: `sudo systemctl status cron`
3. cron 작업 재등록: `crontab -e`
4. Node.js 경로 확인: `which node`

## 📚 개발자 가이드

### logger 모듈 사용법

```javascript
const logger = require('./logging/logger');

// 기본 로그
logger.info('정보 메시지');       // ℹ️
logger.success('성공 메시지');    // ✅
logger.error('에러 메시지');      // ❌
logger.warn('경고 메시지');       // ⚠️
logger.debug('디버그 메시지');    // 🔍

// 섹션 박스
logger.section('장비 정보');
logger.item('모델명', 'DWX-52D');
logger.item('주문자', '김상배');
logger.sectionEnd();

// 구분선
logger.separator('═', 60);
logger.separator('━', 60);

// JSON 객체
logger.json({ equipmentModel: 'DWX-52D' }, '전송 데이터');

// 현재 로그 파일 경로
const logFile = logger.getCurrentLogFile();
```

### apiService 모듈 사용법

```javascript
const { sendToAPI, getInitialCompletedOrders } = require('./processor/apiService');
const logger = require('./logging/logger');

// 초기 주문 목록 가져오기
const result = await getInitialCompletedOrders(logger);
let allOrders = result.allOrders || [];

// API로 데이터 전송
const apiResult = await sendToAPI(jsonData, extractCustomerName, logger, allOrders);

if (apiResult.success) {
    allOrders = apiResult.allOrders; // 업데이트된 주문 목록
}
```

## 📄 라이센스

MIT License

## 👨‍💻 개발자

yoon

## 📞 문의

문제가 발생하거나 기능 제안이 있으시면 이슈를 등록해주세요.
