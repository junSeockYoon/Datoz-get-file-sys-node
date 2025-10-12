const fs = require('fs');
const path = require('path');
const config = require('./config/config');
const iconv = require('iconv-lite');
const { sendToAPI, getInitialCompletedOrders, checkApiHealth } = require('./processor/apiService');
const logger = require('./logging/logger');
const { processOdLogFiles } = require('./processor/odLogProcessor');

// 한글 인코딩 변환 함수
function decodeKoreanFilename(filename) {
    try {
        // 1단계: 잘못 인식된 일본어(euc-jp) 문자를 바이트로 변환
        const eucJpBuffer = iconv.encode(filename, 'euc-jp');
        
        // 2단계: 그 바이트를 한글(euc-kr)로 올바르게 디코딩
        const decoded = iconv.decode(eucJpBuffer, 'euc-kr');
        
        // 여전히 깨진 문자가 있으면 원본 반환
        if (decoded.includes('�') || decoded.includes('�')) {
            return filename;
        }
        return decoded;
    } catch (error) {
        // 변환 실패 시 원본 반환
        return filename;
    }
}

// 파일명에서 주문자 이름 추출 함수
function extractCustomerName(filename) {
    try {
        // 패턴: YYYYMMDD_HHMM_주문자이름aX타입_번호.stl
        const match = filename.match(/\d{8}_\d{4}_(.+?)a\d/);
        if (match && match[1]) {
            return decodeKoreanFilename(match[1]);
        }
        return '알 수 없음';
    } catch (error) {
        return '알 수 없음';
    }
}

// 시간 포맷팅 함수 (콘솔 출력용)
function formatDateTime(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    const period = hours < 12 ? '오전' : '오후';
    const displayHours = hours % 12 || 12;
    
    return `${year}년 ${month}월 ${day}일 ${period} ${displayHours}시 ${minutes}분`;
}

// 작업 시간 포맷팅 함수 (HH:MM:SS 형식을 분:초로 변환)
function formatDuration(workTime) {
    const parts = workTime.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2].split('.')[0]);
    
    const totalMinutes = hours * 60 + minutes;
    return `약 ${totalMinutes}분 ${seconds}초`;
}

// 리포트 출력 함수
function printReport(data) {
    const job = data.Jobs[0];
    const application = job.Applications[0];
    const material = job.Materials[0];
    
    // 주문자 이름 추출 및 한글 변환
    const customerName = extractCustomerName(application.StlFile);
    const decodedFilename = decodeKoreanFilename(application.StlFile);
    
    logger.title('DWX-52D 밀링 작업 리포트');
    
    // 장비 및 작업 정보
    logger.section('장비 및 작업 정보');
    logger.item('장비 모델', data.ModelName);
    logger.item('시리얼 번호', data.SerialNumber);
    logger.item('주문자', customerName);
    logger.item('작업 이름', job.Name);
    logger.item('작업 유형', `${application.ApplicationType} (${application.Count}개)`);
    logger.item('원본 파일', decodedFilename);
    logger.sectionEnd();
    
    // 작업 시간
    logger.section('작업 시간');
    logger.item('시작 시간', formatDateTime(job.StartTime));
    logger.item('종료 시간', formatDateTime(job.EndTime));
    logger.item('총 작업 시간', formatDuration(job.WorkTime));
    logger.sectionEnd();
    
    // 사용 재료
    logger.section('사용 재료');
    logger.item('재료 종류', material.Type);
    logger.item('재료 형태', material.Shape);
    logger.item('재료 크기', material.Size);
    logger.item('재료 사용률', `${material.MillingAreaPercent}%`);
    logger.sectionEnd();
    
    // 사용된 버(Bur) 상세
    logger.section('사용된 버(Bur) 상세');
    job.Burs.forEach((bur, index) => {
        logger.item(`버 #${bur.StockerNumber}`, `스토커 ${bur.StockerNumber}번 / 작업시간: ${formatDuration(bur.WorkTime)}`);
    });
    logger.sectionEnd();
    
    // 작업 결과
    logger.section('작업 결과');
    const isSuccess = job.JobResult === 1;
    const status = isSuccess ? '성공' : '실패';
    logger.item('상태', `${status} ${isSuccess ? '✅' : '❌'}`);
    const errorMsg = job.ErrorList.length > 0 ? job.ErrorList.join(', ') : '발견된 오류 없음';
    logger.item('오류', errorMsg);
    logger.sectionEnd();
    
    logger.blank();
}

// JSON 파일 읽기 및 처리
async function processJsonFiles() {
    const targetDir = config.targetDirectory;
    
    // 필터링 기준 날짜 (config에서 가져오기)
    const filterDate = new Date(config.filterDate + 'T00:00:00');
    
    logger.blank();
    logger.info(`🔍 스캔 디렉토리: ${targetDir}`);
    logger.info(`📅 필터 조건: ${filterDate.toLocaleDateString('ko-KR')} 이후 생성된 파일만 처리`);
    logger.info(`📝 로그 파일: ${logger.getCurrentLogFile()}`);
    logger.separator('═', 60);
    
    // API 연결 상태 확인 (비활성화됨 - 테스트 데이터 생성 방지)
    // const apiHealthResults = await checkApiHealth(logger);
    
    // 초기 주문 리스트 가져오기 (GET API 사용)
    logger.blank();
    const initialResult = await getInitialCompletedOrders(logger);
    let allOrders = initialResult.allOrders || [];
    logger.separator('═', 60);
    
    try {
        const items = fs.readdirSync(targetDir);
        
        // JSON 파일 필터링 + 날짜 필터링
        const allJsonFiles = items.filter(item => item.endsWith('.json'));
        const jsonFiles = allJsonFiles.filter(filename => {
            try {
                const filePath = path.join(targetDir, filename);
                const stats = fs.statSync(filePath);
                // 파일 생성 시간(birthtime) 또는 수정 시간(mtime) 중 더 최근 것 사용
                const fileDate = stats.birthtime > stats.mtime ? stats.birthtime : stats.mtime;
                return fileDate >= filterDate;
            } catch (error) {
                logger.warn(`파일 정보 확인 실패: ${filename} - 필터에서 제외`);
                return false; // 오류 시 제외 (안전한 처리)
            }
        });
        
        if (allJsonFiles.length === 0) {
            logger.error('JSON 파일을 찾을 수 없습니다.');
            return;
        }
        
        if (jsonFiles.length === 0) {
            logger.warn(`전체 JSON 파일: ${allJsonFiles.length}개 발견`);
            logger.error(`📅 ${filterDate.toLocaleDateString('ko-KR')} 이후 생성된 파일이 없습니다.`);
            return;
        }
        
        logger.success(`전체 JSON 파일: ${allJsonFiles.length}개 발견`);
        logger.success(`📅 필터 통과: ${jsonFiles.length}개 파일 (${allJsonFiles.length - jsonFiles.length}개 제외됨)`);
        logger.blank();
        
        let createdCount = 0;    // 신규 생성
        let updatedCount = 0;    // 업데이트
        let skippedCount = 0;    // 건너뜀
        let failCount = 0;       // 실패
        
        for (let i = 0; i < jsonFiles.length; i++) {
            const filename = jsonFiles[i];
            const filePath = path.join(targetDir, filename);
            
            logger.blank();
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.info(`📄 [${i + 1}/${jsonFiles.length}] ${filename}`);
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            try {
                // UTF-8로 읽지 말고 바이너리로 읽어서 변환
                const buffer = fs.readFileSync(filePath);
                const fileContent = buffer.toString('utf8');
                const data = JSON.parse(fileContent);
                
                // 리포트 출력
                printReport(data);
                
                // API 전송 (allOrders 전달 및 업데이트)
                logger.info(`🔍 현재 전체 주문: ${allOrders.length}건`);
                const result = await sendToAPI(data, extractCustomerName, logger, allOrders);
                
                // allOrders 업데이트 (API 응답에서 받음)
                if (result.allOrders) {
                    const beforeCount = allOrders.length;
                    allOrders = result.allOrders;
                    const afterCount = allOrders.length;
                    
                    if (afterCount > beforeCount) {
                        logger.info(`📊 전체 주문 업데이트: ${beforeCount}건 → ${afterCount}건`);
                    }
                } else if (!result.skipped && !result.updated) {
                    logger.error(`⚠️  경고: API 응답에 주문 리스트가 없습니다!`);
                }
                
                if (result.success) {
                    if (result.skipped) {
                        skippedCount++;
                        logger.info(`⏭️  건너뜀: ${filename}`);
                    } else if (result.updated) {
                        updatedCount++;
                        logger.success(`🔄 업데이트 완료: ${filename}`);
                    } else if (result.created) {
                        createdCount++;
                        logger.success(`✅ 생성 완료: ${filename}`);
                    }
                } else {
                    failCount++;
                    logger.error(`❌ 처리 실패: ${filename}`);
                }
                
                // API 호출 사이에 약간의 딜레이 (서버 부하 방지, 중복은 딜레이 없음)
                if (!result.skipped) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } catch (error) {
                logger.error(`파일 처리 중 오류 (${filename}): ${error.message}`);
                failCount++;
            }
        }
        
        // 최종 결과 요약
        logger.blank();
        logger.separator('═', 60);
        logger.title('처리 완료');
        logger.blank();
        logger.success(`✅ 신규 생성: ${createdCount}건`);
        logger.success(`🔄 업데이트: ${updatedCount}건`);
        logger.info(`⏭️  건너뜀: ${skippedCount}건 (이미 완료됨)`);
        if (failCount > 0) {
            logger.error(`❌ 실패: ${failCount}건`);
            logger.warn(`오류 로그는 logs/errors/ 폴더를 확인하세요`);
        } else {
            logger.info(`❌ 실패: ${failCount}건`);
        }
        logger.info(`📁 총 파일: ${jsonFiles.length}개`);
        
        // 전체 주문을 완료/작업중으로 분리하여 표시
        const finalCompleted = allOrders.filter(o => o.result === '완료').length;
        const finalWorking = allOrders.filter(o => o.result === '작업중').length;
        logger.info(`📋 DB 주문: 완료 ${finalCompleted}건, 작업중 ${finalWorking}건 (전체 ${allOrders.length}건)`);
        
        // 성능 향상 정보
        if (skippedCount > 0) {
            const savedTime = Math.floor(skippedCount * 0.5); // 0.5초 = 500ms
            logger.info(`⚡ 절약된 시간: 약 ${savedTime}초 (중복 건너뛴 덕분)`);
        }
        
        logger.separator('═', 60);
        logger.blank();
        
        // 콘솔에도 간단히 출력
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 처리 완료!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ 신규 생성: ${createdCount}건`);
        console.log(`🔄 업데이트: ${updatedCount}건 (작업중 → 완료)`);
        console.log(`⏭️  건너뜀: ${skippedCount}건 (이미 완료)`);
        console.log(`❌ 실패: ${failCount}건`);
        console.log(`📁 총 파일: ${jsonFiles.length}개`);
        
        const finalCompleted2 = allOrders.filter(o => o.result === '완료').length;
        const finalWorking2 = allOrders.filter(o => o.result === '작업중').length;
        console.log(`📋 DB: 완료 ${finalCompleted2}건, 작업중 ${finalWorking2}건 (전체 ${allOrders.length}건)`);
        
        if (skippedCount > 0) {
            const savedTime = Math.floor(skippedCount * 0.5);
            console.log(`⚡ 절약된 시간: 약 ${savedTime}초`);
        }
        
        console.log(`\n📝 로그 파일: ${logger.getCurrentLogFile()}`);
        
        if (failCount > 0) {
            console.log(`⚠️  오류 로그: logs/errors/error_${new Date().toISOString().split('T')[0]}.txt`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
    } catch (error) {
        logger.error(`디렉토리 읽기 실패: ${error.message}`);
        console.error('❌ 디렉토리 읽기 실패:', error.message);
    }
}

// 메인 실행 함수
async function main() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 밀링 작업 로그 처리 시스템');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 명령줄 인자 확인
    const args = process.argv.slice(2);
    const mode = args[0] || 'both'; // 기본값: 'both'
    
    try {
        if (mode === 'dwx' || mode === '1') {
            // DWX-52D JSON 파일만 처리
            console.log('📁 모드: DWX-52D JSON 파일 처리\n');
            await processJsonFiles();
            
        } else if (mode === 'od' || mode === '2') {
            // od-log 파일만 처리
            console.log('📁 모드: od-log 파일 처리\n');
            await processOdLogFiles();
            
        } else if (mode === 'both' || mode === 'all' || mode === '3') {
            // 둘 다 처리
            console.log('📁 모드: 모든 파일 처리 (DWX-52D + od-log)\n');
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📂 1단계: DWX-52D JSON 파일 처리');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            await processJsonFiles();
            
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📂 2단계: od-log 파일 처리');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            await processOdLogFiles();
            
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ 모든 처리 완료!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
        } else {
            console.log('❌ 잘못된 모드입니다.\n');
            console.log('사용법:');
            console.log('  node server.js          - 모든 파일 처리 (기본값)');
            console.log('  node server.js dwx      - DWX-52D JSON 파일만 처리');
            console.log('  node server.js od       - od-log 파일만 처리');
            console.log('  node server.js both     - 모든 파일 처리\n');
            process.exit(1);
        }
        
    } catch (error) {
        logger.error(`프로그램 실행 중 오류 발생: ${error.message}`);
        console.error('❌ 프로그램 실행 중 오류 발생:', error);
        process.exit(1);
    }
}

// 프로그램 실행
main();