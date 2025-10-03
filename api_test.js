#!/usr/bin/env node

/**
 * API 연결 상태 테스트 스크립트
 * DWX-52D 로그 처리 시스템의 API 연결 상태를 확인합니다.
 * 
 * 사용법:
 * node api_test.js
 */

const { checkApiHealth } = require('./apiService');
const logger = require('./logger');

async function testApiConnection() {
    console.log('========================================');
    console.log('🔍 DWX-52D API 연결 상태 테스트');
    console.log('========================================');
    console.log('');
    console.log('시작 시간:', new Date().toLocaleString('ko-KR'));
    console.log('');
    
    try {
        // API 상태 확인 실행
        const results = await checkApiHealth(logger);
        
        console.log('');
        console.log('========================================');
        console.log('📊 테스트 완료');
        console.log('========================================');
        
        // 결과 요약
        const successCount = Object.values(results).filter(r => r.status === 'success').length;
        const totalCount = Object.keys(results).length;
        
        if (successCount === totalCount) {
            console.log('✅ 모든 API 연결 정상');
        } else {
            console.log(`⚠️  ${successCount}/${totalCount} API 연결 성공`);
        }
        
        console.log('');
        console.log('종료 시간:', new Date().toLocaleString('ko-KR'));
        console.log('로그 파일:', logger.getCurrentLogFile());
        console.log('');
        
    } catch (error) {
        console.error('❌ 테스트 실행 중 오류:', error.message);
        process.exit(1);
    }
}

// 스크립트 실행
testApiConnection();
