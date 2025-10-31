module.exports = {
    // 모니터링할 대상 디렉토리 - 여기만 수정하면 됩니다!
    targetDirectory: 'C:/Users/yoon/Desktop/log/job_log',
    targetDirectory2: 'C:/Users/yoon/Desktop/od-log',
    
    // API 설정
    // apiListUrl: 'http://43.200.154.128/api/order/external/list',     // 주문 리스트 조회 (GET)
    // apiUrl: 'http://43.200.154.128/api/order/external/create',       // 주문 생성 (POST)
    // apiUpdateUrl: 'http://43.200.154.128/api/order/external/update', // 주문 업데이트 (POST)
    
    // API 설정 - 로컬 테스트용
    apiListUrl: 'http://localhost:9090/api/order/external/list',     // 주문 리스트 조회 (GET)
    apiUrl: 'http://localhost:9090/api/order/external/create',       // 주문 생성 (POST)
    apiUpdateUrl: 'http://localhost:9090/api/order/external/update', // 주문 업데이트 (POST)
    
    // 서버 포트
    port: 3000,
    
    // 로그 설정
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
    includeEmojis: true,
    
    // 타임존 보정 (시간 단위). 운영(DB=Asia/Seoul)이면 0 사용 권장
    timezoneShiftHours: 0,
    
    // 파일 필터 설정
    // 이 날짜 이후에 생성된 파일만 처리합니다
    filterDate: '2025-09-20', // YYYY-MM-DD 형식
};