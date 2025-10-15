const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { sendToAPI, getInitialCompletedOrders } = require('./apiService');
const logger = require('../logging/logger');

// 날짜 형식 변환 함수 (2019 / 03 / 27)- 09 : 14 : 36 → 한국 시간 문자열)
function parseOdLogDateTime(dateStr, timeStr) {
    // 날짜: "2019 / 03 / 27", 시간: "09 : 14 : 36"
    const dateParts = dateStr.trim().split(/\s*\/\s*/);
    const timeParts = timeStr.trim().split(/\s*:\s*/);
    
    const year = dateParts[0];
    const month = dateParts[1].padStart(2, '0');
    const day = dateParts[2].padStart(2, '0');
    const hour = timeParts[0].padStart(2, '0');
    const minute = timeParts[1].padStart(2, '0');
    const second = timeParts[2].padStart(2, '0');
    
    // od-log 파일의 시간은 이미 한국 현지 시간이므로 그대로 사용
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// 작업 시간 계산 (분 단위)
function calculateWorkTimeInMinutes(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    return Math.round(diffMs / 1000 / 60); // 밀리초 → 초 → 분
}

// od-log 파일에서 작업 정보 추출
function parseOdLogFile(filePath, fileDate) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        const jobs = [];
        let currentJob = null;
        
        for (const line of lines) {
            // FIle Open :파일명.nc - 새 작업 시작
            if (line.includes('FIle Open :')) {
                // 이전 작업이 있고 시작 시간만 있으면 (WORK END 없음) → 작업중
                if (currentJob && currentJob.startTime && !currentJob.endTime) {
                    jobs.push({...currentJob});
                }
                
                const match = line.match(/FIle Open :(.+?)\.nc/);
                if (match) {
                    currentJob = {
                        filename: match[1].trim() + '.nc',
                        startTime: null,
                        endTime: null
                    };
                }
            }
            
            // Auto START - 작업 시작 시간
            if (line.includes('Auto START :') && currentJob) {
                const match = line.match(/Auto START : \((.+?)\)- (.+)/);
                if (match) {
                    currentJob.startTime = parseOdLogDateTime(match[1], match[2]);
                }
            }
            
            // WORK END - 작업 종료 시간
            if (line.includes('WORK END :') && currentJob && currentJob.startTime) {
                const match = line.match(/WORK END : \((.+?)\)- (.+)/);
                if (match) {
                    currentJob.endTime = parseOdLogDateTime(match[1], match[2]);
                    
                    // 작업 완료된 경우 추가
                    if (currentJob.startTime && currentJob.endTime) {
                        jobs.push({...currentJob});
                    }
                    
                    currentJob = null; // 다음 작업을 위해 초기화
                }
            }
        }
        
        // 파일 끝에 도달했는데 currentJob이 남아있으면 (작업중)
        if (currentJob && currentJob.startTime && !currentJob.endTime) {
            jobs.push({...currentJob});
        }
        
        return jobs;
        
    } catch (error) {
        logger.error(`파일 읽기 실패 (${filePath}): ${error.message}`);
        return [];
    }
}

// API 전송용 데이터 구성
function prepareApiPayload(job) {
    // endTime이 있으면 완료, 없으면 작업중
    const isCompleted = job.endTime !== null;
    const totalWorkTime = isCompleted ? calculateWorkTimeInMinutes(job.startTime, job.endTime) : null;
    
    return {
        equipmentModel: 'CAMeleon CS',
        orderer: job.filename, // 파일명을 주문자로 사용
        workStartTime: job.startTime,
        workEndTime: job.endTime,
        totalWorkTime: totalWorkTime,
        result: isCompleted ? '완료' : '작업중'
    };
}

// od-log 파일들 처리
async function processOdLogFiles(limit = null) {
    const targetDir = config.targetDirectory2;
    
    // 필터링 기준 날짜 (config에서 가져오기)
    const filterDateStr = config.filterDate.replace(/-/g, ''); // YYYY-MM-DD → YYYYMMDD
    
    logger.blank();
    logger.info(`🔍 od-log 스캔 디렉토리: ${targetDir}`);
    logger.info(`📅 필터 조건: ${filterDateStr.slice(0,4)}년 ${filterDateStr.slice(4,6)}월 ${filterDateStr.slice(6,8)}일 이후 파일만 처리`);
    if (limit) {
        logger.info(`📊 처리 제한: 최신 ${limit}개 파일만 처리`);
    }
    logger.separator('═', 60);
    
    // 초기 주문 리스트 가져오기
    logger.blank();
    const initialResult = await getInitialCompletedOrders(logger);
    let allOrders = initialResult.allOrders || [];
    logger.info(`📋 DB에서 가져온 주문: ${allOrders.length}건`);
    logger.separator('═', 60);
    
    try {
        if (!fs.existsSync(targetDir)) {
            logger.error(`디렉토리를 찾을 수 없습니다: ${targetDir}`);
            return;
        }
        
        const items = fs.readdirSync(targetDir);
        
        // 날짜 형식 파일만 필터 (YYYYMMDD) + 날짜 필터링
        const allLogFiles = items.filter(item => /^\d{8}$/.test(item));
        const logFiles = allLogFiles.filter(item => item >= filterDateStr);
        
        if (allLogFiles.length === 0) {
            logger.error('od-log 파일을 찾을 수 없습니다.');
            return;
        }
        
        if (logFiles.length === 0) {
            logger.warn(`전체 od-log 파일: ${allLogFiles.length}개 발견`);
            logger.error(`📅 ${filterDateStr.slice(0,4)}년 ${filterDateStr.slice(4,6)}월 ${filterDateStr.slice(6,8)}일 이후 파일이 없습니다.`);
            return;
        }
        
        // 날짜순 정렬 (최신 순)
        logFiles.sort().reverse();
        
        // 개수 제한 적용
        const filesToProcess = limit ? logFiles.slice(0, limit) : logFiles;
        
        logger.success(`전체 od-log 파일: ${allLogFiles.length}개 발견`);
        logger.success(`📅 필터 통과: ${logFiles.length}개 파일 (${allLogFiles.length - logFiles.length}개 제외됨)`);
        if (limit && filesToProcess.length < logFiles.length) {
            logger.info(`⚡ 처리 대상: 최신 ${filesToProcess.length}개 파일 (${logFiles.length - filesToProcess.length}개 생략)`);
        }
        logger.blank();
        
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let failCount = 0;
        let totalJobsProcessed = 0;
        
        for (let i = 0; i < filesToProcess.length; i++) {
            const filename = filesToProcess[i];
            const filePath = path.join(targetDir, filename);
            
            logger.blank();
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.info(`📄 [${i + 1}/${filesToProcess.length}] ${filename}`);
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            try {
                // 파일에서 작업 정보 추출
                const jobs = parseOdLogFile(filePath, filename);
                
                if (jobs.length === 0) {
                    logger.warn(`작업이 없습니다: ${filename}`);
                    continue;
                }
                
                const completedJobs = jobs.filter(j => j.endTime !== null);
                const workingJobs = jobs.filter(j => j.endTime === null);
                
                logger.info(`📋 ${jobs.length}개의 작업 발견 (완료: ${completedJobs.length}개, 작업중: ${workingJobs.length}개)`);
                logger.blank();
                
                // 각 작업을 API로 전송
                for (let j = 0; j < jobs.length; j++) {
                    const job = jobs[j];
                    totalJobsProcessed++;
                    
                    const isCompleted = job.endTime !== null;
                    
                    logger.info(`   [${j + 1}/${jobs.length}] ${job.filename}`);
                    logger.info(`   ⏱️  시작: ${job.startTime}`);
                    if (isCompleted) {
                        logger.info(`   ⏱️  종료: ${job.endTime}`);
                        logger.info(`   ⏱️  소요: ${calculateWorkTimeInMinutes(job.startTime, job.endTime)}분`);
                        logger.info(`   📊 상태: 완료 ✅`);
                    } else {
                        logger.info(`   ⏱️  종료: (진행중)`);
                        logger.info(`   📊 상태: 작업중 🔄`);
                    }
                    
                    // API 페이로드 준비
                    const payload = prepareApiPayload(job);
                    
                    // 간단한 API 전송 함수 (sendToAPI와 유사하지만 간소화)
                    const result = await sendOdLogToAPI(payload, logger, allOrders);
                    
                    // allOrders 업데이트
                    if (result.allOrders) {
                        allOrders = result.allOrders;
                    }
                    
                    if (result.success) {
                        if (result.skipped) {
                            skippedCount++;
                            logger.info(`   ⏭️  건너뜀 (이미 존재)`);
                        } else if (result.updated) {
                            updatedCount++;
                            logger.success(`   🔄 업데이트 완료`);
                        } else if (result.created) {
                            createdCount++;
                            logger.success(`   ✅ 생성 완료`);
                        }
                    } else {
                        failCount++;
                        logger.error(`   ❌ 처리 실패: ${result.error}`);
                    }
                    
                    logger.blank();
                    
                    // API 호출 사이 딜레이
                    if (!result.skipped) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
                
            } catch (error) {
                logger.error(`파일 처리 중 오류 (${filename}): ${error.message}`);
                failCount++;
            }
        }
        
        // 최종 결과 요약
        logger.blank();
        logger.separator('═', 60);
        logger.title('od-log 처리 완료');
        logger.blank();
        logger.success(`✅ 신규 생성: ${createdCount}건`);
        logger.success(`🔄 업데이트: ${updatedCount}건`);
        logger.info(`⏭️  건너뜀: ${skippedCount}건 (이미 완료됨)`);
        if (failCount > 0) {
            logger.error(`❌ 실패: ${failCount}건`);
        } else {
            logger.info(`❌ 실패: ${failCount}건`);
        }
        logger.info(`📁 처리한 파일: ${filesToProcess.length}개${limit ? ` (전체: ${logFiles.length}개)` : ''}`);
        logger.info(`📋 총 작업: ${totalJobsProcessed}건`);
        
        const finalCompleted = allOrders.filter(o => o.result === '완료').length;
        const finalWorking = allOrders.filter(o => o.result === '작업중').length;
        logger.info(`📋 DB 주문: 완료 ${finalCompleted}건, 작업중 ${finalWorking}건 (전체 ${allOrders.length}건)`);
        
        logger.separator('═', 60);
        logger.blank();
        
        // 콘솔 출력
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 od-log 처리 완료!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ 신규 생성: ${createdCount}건`);
        console.log(`🔄 업데이트: ${updatedCount}건`);
        console.log(`⏭️  건너뜀: ${skippedCount}건`);
        console.log(`❌ 실패: ${failCount}건`);
        console.log(`📁 처리한 파일: ${filesToProcess.length}개${limit ? ` (전체: ${logFiles.length}개)` : ''}`);
        console.log(`📋 총 작업: ${totalJobsProcessed}건`);
        console.log(`\n📝 로그 파일: ${logger.getCurrentLogFile()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
    } catch (error) {
        logger.error(`디렉토리 읽기 실패: ${error.message}`);
        console.error('❌ 디렉토리 읽기 실패:', error.message);
    }
}

// od-log 데이터를 API로 전송 (간소화 버전)
async function sendOdLogToAPI(payload, logger, allOrders = []) {
    const axios = require('axios');
    
    logger.info(`   🔍 중복 체크: 전체 주문 ${allOrders.length}건`);
    
    // 기존 주문 찾기
    const existingOrder = findExistingOdLogOrder(payload.orderer, payload.workStartTime, allOrders, logger);
    
    // 케이스 1: 기존 주문이 완료 상태면 건너뛰기
    if (existingOrder && existingOrder.result === '완료') {
        logger.info(`   ⏭️  중복: 이미 완료된 주문 (${existingOrder.orderCode || 'N/A'})`);
        return { 
            success: true, 
            skipped: true, 
            allOrders: allOrders 
        };
    }
    
    // 케이스 2: 기존 주문이 작업중이고, 파일도 작업중이면 건너뛰기
    if (existingOrder && existingOrder.result === '작업중' && payload.result === '작업중') {
        logger.info(`   ⏭️  중복: 작업중 상태 유지 (${existingOrder.orderCode || 'N/A'})`);
        return { 
            success: true, 
            skipped: true, 
            allOrders: allOrders 
        };
    }
    
    // 케이스 3: 기존 주문이 작업중이고, 파일이 완료면 업데이트
    if (existingOrder && existingOrder.result === '작업중' && payload.result === '완료') {
        logger.info(`   🔄 업데이트: 작업중 → 완료`);
        return await updateOdLogOrder(payload, logger, allOrders);
    }
    
    // 신규 주문 생성
    try {
        logger.info(`   🚀 신규 생성 시작...`);
        const startTime = Date.now();
        
        const response = await axios.post(config.apiUrl, payload, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CAMeleon-CS-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - startTime;
        logger.info(`   ✅ API 응답: ${responseTime}ms`);
        
        // API 응답 구조 확인
        const newOrder = response.data?.data;
        logger.debug(`   📦 응답 데이터: ${JSON.stringify(response.data)}`);
        
        const updatedAllOrders = [...allOrders];
        if (newOrder) {
            // 작업중/완료 상태에 따라 리스트 앞/뒤에 추가
            if (newOrder.result === '작업중') {
                updatedAllOrders.unshift(newOrder);
            } else {
                updatedAllOrders.push(newOrder);
            }
            logger.info(`   📊 주문 추가: ${allOrders.length}건 → ${updatedAllOrders.length}건`);
        } else {
            logger.warn(`   ⚠️  응답에 newOrder 없음`);
        }
        
        return { 
            success: true,
            created: true,
            response: response.data,
            allOrders: updatedAllOrders
        };
        
    } catch (error) {
        logger.error(`   ❌ API 오류: ${error.message}`);
        return { 
            success: false, 
            error: error.message,
            allOrders: allOrders
        };
    }
}

// 기존 od-log 주문 찾기
function findExistingOdLogOrder(orderer, workStartTime, allOrders, logger = null) {
    if (!allOrders || allOrders.length === 0) {
        if (logger) {
            logger.info(`   📋 DB 주문: 0건 (빈 상태)`);
        }
        return null;
    }
    
    const workStartTimeISO = workStartTime.includes('T') 
        ? workStartTime 
        : workStartTime.replace(' ', 'T');
    const fileTime = new Date(workStartTimeISO);
    
    if (logger) {
        logger.info(`   📋 검색 조건:`);
        logger.info(`      주문자: ${orderer}`);
        logger.info(`      시간: ${workStartTime}`);
        logger.info(`      시간(ISO): ${workStartTimeISO}`);
        logger.info(`      시간(Date): ${fileTime.toString()}`);
    }
    
    const found = allOrders.find((order, index) => {
        const isSameOrderer = order.orderer === orderer;
        
        if (!isSameOrderer) return false;
        
        const dbTime = new Date(order.workStartTime);
        const timeDiff = Math.abs(fileTime.getTime() - dbTime.getTime());
        
        // 1분 이내 또는 시간대 차이(UTC vs KST)면 같은 주문으로 판단
        const isExactlyOneHour = timeDiff === 3600000;  // 정확히 1시간 (DST)
        const isExactly9Hours = timeDiff === 32400000;  // 정확히 9시간 (KST-UTC)
        const isExactly8Hours = timeDiff === 28800000;  // 정확히 8시간 (KST-UTC, DST 적용시)
        const isSameTime = timeDiff < 60000 || isExactly9Hours || isExactly8Hours || isExactlyOneHour;
        
        if (logger) {
            logger.info(`   📌 [${index}] 주문자 일치: ${order.orderer}`);
            logger.info(`      DB 시간: ${order.workStartTime}`);
            logger.info(`      시간차: ${timeDiff}ms (${(timeDiff / 1000).toFixed(1)}초)`);
            if (isExactly9Hours) {
                logger.info(`      → 9시간 차이 (KST-UTC) ✅`);
            } else if (isExactly8Hours) {
                logger.info(`      → 8시간 차이 (KST-UTC, DST) ✅`);
            } else if (isExactlyOneHour) {
                logger.info(`      → 1시간 차이 (DST) ✅`);
            }
            logger.info(`      매칭: ${isSameTime ? 'YES ✅' : 'NO ❌'}`);
            logger.info(`      상태: ${order.result}`);
        }
        
        return isSameOrderer && isSameTime;
    });
    
    if (logger) {
        if (found) {
            logger.info(`   ✅ 중복 발견: ${found.orderCode || 'N/A'} (${found.result})`);
        } else {
            logger.info(`   ❌ 중복 없음: 신규 주문`);
        }
    }
    
    return found;
}

// od-log 주문 업데이트
async function updateOdLogOrder(payload, logger, allOrders) {
    const axios = require('axios');
    
    try {
        const updatePayload = {
            orderer: payload.orderer,
            workStartTime: payload.workStartTime,
            result: payload.result,
            workEndTime: payload.workEndTime,
            totalWorkTime: payload.totalWorkTime
        };
        
        logger.info(`   🔄 UPDATE API 요청 중...`);
        const startTime = Date.now();
        
        const response = await axios.post(config.apiUpdateUrl, updatePayload, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CAMeleon-CS-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - startTime;
        logger.info(`   ✅ 업데이트 성공: ${responseTime}ms`);
        
        // allOrders 업데이트
        const updatedAllOrders = allOrders.map(order => {
            if (order.orderer === payload.orderer && 
                Math.abs(new Date(order.workStartTime).getTime() - new Date(payload.workStartTime).getTime()) < 60000) {
                return {
                    ...order,
                    result: '완료',
                    workEndTime: payload.workEndTime,
                    totalWorkTime: payload.totalWorkTime
                };
            }
            return order;
        });
        
        logger.info(`   📊 주문 상태 업데이트: 작업중 → 완료`);
        
        return {
            success: true,
            updated: true,
            allOrders: updatedAllOrders
        };
        
    } catch (error) {
        logger.error(`   ❌ 업데이트 실패: ${error.message}`);
        return { 
            success: false, 
            error: error.message,
            allOrders: allOrders
        };
    }
}

module.exports = {
    processOdLogFiles,
    parseOdLogFile,
    prepareApiPayload
};

