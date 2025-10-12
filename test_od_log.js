// od-log 테스트 스크립트 - 최신 5개 파일만 처리
const { processOdLogFiles } = require('./odLogProcessor');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 od-log 테스트 모드');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('최신 5개 파일만 처리하여 중복 체크 로직을 확인합니다.\n');

// 최신 5개 파일만 처리
processOdLogFiles(5).then(() => {
    console.log('\n✅ 테스트 완료!\n');
    console.log('💡 팁:');
    console.log('  - logs/ 폴더에서 상세 로그를 확인하세요');
    console.log('  - 중복 체크 과정이 자세히 기록됩니다');
    console.log('  - 같은 파일을 다시 실행하면 "건너뜀"으로 표시되어야 합니다\n');
}).catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
});

