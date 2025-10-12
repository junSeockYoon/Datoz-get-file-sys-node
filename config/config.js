module.exports = {
    // 모니터링할 대상 디렉토리 - 여기만 수정하면 됩니다!
    targetDirectory: '/home/datoz/Public/shared',
    targetDirectory2: '/home/datoz/Public/shared-old',
    
    // API 설정
    apiListUrl: 'http://43.200.154.128/api/order/external/list',     // 주문 리스트 조회 (GET)
    apiUrl: 'http://43.200.154.128/api/order/external/create',       // 주문 생성 (POST)
    apiUpdateUrl: 'http://43.200.154.128/api/order/external/update', // 주문 업데이트 (POST)
    
    // 서버 포트
    port: 3000,
    
    // 로그 설정
    logLevel: 'debug', // 'debug', 'info', 'warn', 'error' (필터링 디버깅용으로 debug로 변경)
    includeEmojis: true,
    
    // 파일 필터 설정
    // 이 날짜 이후에 생성된 파일만 처리합니다
    filterDate: '2025-10-01', // YYYY-MM-DD 형식
};