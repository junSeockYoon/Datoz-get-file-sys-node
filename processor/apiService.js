const axios = require('axios');
const config = require('../config/config');

// API 연결 상태 확인 함수
async function checkApiHealth(logger) {
    const healthCheckResults = {
        listApi: { status: 'unknown', responseTime: 0, error: null },
        createApi: { status: 'unknown', responseTime: 0, error: null },
        updateApi: { status: 'unknown', responseTime: 0, error: null }
    };
    
    logger.blank();
    logger.separator('═', 60);
    logger.title('🔍 API 연결 상태 확인');
    logger.blank();
    
    // 1. LIST API 확인
    logger.info('📋 LIST API 확인 중...');
    const listStartTime = Date.now();

    try {
        const response = await axios.get(config.apiListUrl, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DWX-52D-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - listStartTime;
        healthCheckResults.listApi = {
            status: 'success',
            responseTime: responseTime,
            statusCode: response.status,
            dataCount: response.data?.data?.length || 0
        };
        
        logger.success(`✅ LIST API: 연결 성공 (${responseTime}ms)`);
        logger.info(`   📊 응답: ${response.status} | 데이터: ${healthCheckResults.listApi.dataCount}건`);
        
    } catch (error) {
        const responseTime = Date.now() - listStartTime;
        healthCheckResults.listApi = {
            status: 'error',
            responseTime: responseTime,
            error: error.message,
            statusCode: error.response?.status || 'N/A'
        };
        
        logger.error(`❌ LIST API: 연결 실패 (${responseTime}ms)`);
        logger.error(`   🔍 오류: ${error.message}`);
        if (error.response) {
            logger.error(`   📊 상태코드: ${error.response.status}`);
        }
    }
    
    // 2. CREATE API 확인 (테스트 요청)
    logger.info('📝 CREATE API 확인 중...');
    const createStartTime = Date.now();

    try {
        // 테스트용 더미 데이터
        const testPayload = {
            equipmentModel: 'TEST-DWX-52D',
            orderer: 'API_HEALTH_CHECK',
            workStartTime: '2025-01-01 00:00:00',
            workEndTime: null,
            totalWorkTime: null,
            result: '작업중'
        };
        
        const response = await axios.post(config.apiUrl, testPayload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DWX-52D-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - createStartTime;
        healthCheckResults.createApi = {
            status: 'success',
            responseTime: responseTime,
            statusCode: response.status
        };
        
        logger.success(`✅ CREATE API: 연결 성공 (${responseTime}ms)`);
        logger.info(`   📊 응답: ${response.status}`);
        
    } catch (error) {
        const responseTime = Date.now() - createStartTime;
        healthCheckResults.createApi = {
            status: 'error',
            responseTime: responseTime,
            error: error.message,
            statusCode: error.response?.status || 'N/A'
        };
        
        logger.error(`❌ CREATE API: 연결 실패 (${responseTime}ms)`);
        logger.error(`   🔍 오류: ${error.message}`);
        if (error.response) {
            logger.error(`   📊 상태코드: ${error.response.status}`);
        }
    }
    
    // 3. UPDATE API 확인 (테스트 요청)
    logger.info('🔄 UPDATE API 확인 중...');
    const updateStartTime = Date.now();

    try {
        // 테스트용 더미 데이터
        const testUpdatePayload = {
            orderer: 'API_HEALTH_CHECK',
            workStartTime: '2025-01-01 00:00:00',
            result: '완료',
            workEndTime: '2025-01-01 01:00:00',
            totalWorkTime: 60
        };
        
        const response = await axios.post(config.apiUpdateUrl, testUpdatePayload, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DWX-52D-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - updateStartTime;
        healthCheckResults.updateApi = {
            status: 'success',
            responseTime: responseTime,
            statusCode: response.status
        };
        
        logger.success(`✅ UPDATE API: 연결 성공 (${responseTime}ms)`);
        logger.info(`   📊 응답: ${response.status}`);
        
    } catch (error) {
        const responseTime = Date.now() - updateStartTime;
        healthCheckResults.updateApi = {
            status: 'error',
            responseTime: responseTime,
            error: error.message,
            statusCode: error.response?.status || 'N/A'
        };
        
        logger.error(`❌ UPDATE API: 연결 실패 (${responseTime}ms)`);
        logger.error(`   🔍 오류: ${error.message}`);
        if (error.response) {
            logger.error(`   📊 상태코드: ${error.response.status}`);
        }
    }
    
    // 4. API 상태 요약
    logger.blank();
    logger.section('📊 API 상태 요약');
    
    const successCount = Object.values(healthCheckResults).filter(r => r.status === 'success').length;
    const errorCount = Object.values(healthCheckResults).filter(r => r.status === 'error').length;
    
    if (successCount === 3) {
        logger.success(`✅ 모든 API 연결 정상 (3/3)`);
        logger.info(`   📈 평균 응답시간: ${Math.round((healthCheckResults.listApi.responseTime + healthCheckResults.createApi.responseTime + healthCheckResults.updateApi.responseTime) / 3)}ms`);
    } else if (successCount > 0) {
        logger.warn(`⚠️  부분 연결 (${successCount}/3 성공)`);
        logger.error(`❌ 실패: ${errorCount}개 API`);
    } else {
        logger.error(`❌ 모든 API 연결 실패 (0/3)`);
        logger.warn(`   🔧 네트워크 연결 및 서버 상태를 확인하세요`);
    }
    
    // 각 API별 상세 상태
    logger.info('│');
    logger.info('│  📋 상세 상태:');
    Object.entries(healthCheckResults).forEach(([apiName, result]) => {
        const statusIcon = result.status === 'success' ? '✅' : '❌';
        const apiDisplayName = apiName === 'listApi' ? 'LIST' : apiName === 'createApi' ? 'CREATE' : 'UPDATE';
        logger.info(`│     ${statusIcon} ${apiDisplayName}: ${result.responseTime}ms ${result.statusCode ? `(${result.statusCode})` : ''}`);
    });
    
    logger.sectionEnd();
    logger.separator('═', 60);
    logger.blank();
    
    return healthCheckResults;
}

// 초기 주문 리스트 가져오기 (GET API 사용)
async function getInitialCompletedOrders(logger) {
    logger.info('🔍 전체 주문 목록 조회 중...');
    logger.info(`   API: ${config.apiListUrl}`);
    
    // 응답 시간 측정 시작
    const startTime = Date.now();

    try {
        // GET API로 전체 주문 목록 조회
        const response = await axios.get(config.apiListUrl, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DWX-52D-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (!response.data.success) {
            logger.warn('주문 목록 조회 실패');
            return { success: false, allOrders: [] };
        }
        
        const allOrders = response.data.data || [];
        
        // result 필드로 완료/작업중 구분
        const completedOrders = allOrders.filter(o => o.result === '완료');
        const workingOrders = allOrders.filter(o => o.result === '작업중');
        
        logger.success(`전체 주문 ${allOrders.length}건 조회 완료 (${responseTime}ms)`);
        logger.info(`   📊 완료: ${completedOrders.length}건, 작업중: ${workingOrders.length}건`);
        
        // 작업중 주문 목록 표시
        if (workingOrders.length > 0) {
            logger.info(`   🔄 작업중 주문:`);
            workingOrders.slice(0, 5).forEach(order => {
                const time = new Date(order.workStartTime).toLocaleString('ko-KR');
                logger.info(`      - ${order.orderer} (${time})`);
            });
            if (workingOrders.length > 5) {
                logger.info(`      ... 외 ${workingOrders.length - 5}건`);
            }
        }
        
        // ⭐ 작업중 주문을 먼저 검색하도록 workingOrders를 앞에 배치
        const sortedOrders = [...workingOrders, ...completedOrders];
        
        return { success: true, allOrders: sortedOrders };
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error(`주문 목록 조회 실패: ${error.message} (${responseTime}ms)`);
        
        // 상세한 오류 정보 로깅
        logger.error(`🔍 오류 상세 정보:`);
        
        if (error.code === 'ECONNREFUSED') {
            logger.error(`   📡 연결 거부: API 서버에 연결할 수 없습니다`);
            logger.warn(`   🔧 서버가 ${config.apiListUrl}에서 실행 중인지 확인하세요`);
            logger.warn(`   🌐 네트워크 연결 상태를 확인하세요`);
        } else if (error.code === 'ENOTFOUND') {
            logger.error(`   🌐 DNS 오류: 호스트를 찾을 수 없습니다`);
            logger.warn(`   🔧 ${config.apiListUrl}의 도메인/IP가 올바른지 확인하세요`);
        } else if (error.code === 'ETIMEDOUT') {
            logger.error(`   ⏱️  타임아웃: 서버 응답 시간 초과 (${responseTime}ms)`);
            logger.warn(`   🔧 서버가 과부하 상태이거나 네트워크가 느릴 수 있습니다`);
        } else if (error.response) {
            logger.error(`   📊 HTTP 상태 코드: ${error.response.status}`);
            logger.error(`   📋 응답 헤더: ${JSON.stringify(error.response.headers)}`);
            logger.error(`   📄 응답 본문: ${JSON.stringify(error.response.data)}`);
            
            // HTTP 상태 코드별 추가 정보
            if (error.response.status === 401) {
                logger.warn(`   🔐 인증 오류: API 키나 인증 정보를 확인하세요`);
            } else if (error.response.status === 403) {
                logger.warn(`   🚫 권한 오류: 해당 API에 접근 권한이 없습니다`);
            } else if (error.response.status === 404) {
                logger.warn(`   🔍 API 엔드포인트를 찾을 수 없습니다`);
            } else if (error.response.status >= 500) {
                logger.warn(`   🔧 서버 내부 오류: API 서버에 문제가 있습니다`);
            }
        } else {
            logger.error(`   🔍 기타 오류: ${error.message}`);
            logger.error(`   📋 오류 코드: ${error.code || 'N/A'}`);
        }
        
        logger.warn('빈 상태로 시작합니다 (중복 체크 불가)');
        return { success: false, allOrders: [] };
    }
}

// 기존 주문 찾기 (주문자 + 작업시작일로)
function findExistingOrder(customerName, workStartTime, allOrders, logger = null) {
    if (!allOrders || allOrders.length === 0) {
        return null;
    }
    
    // workStartTime은 한국 시간 문자열 (예: "2025-07-08 16:49:56")
    // DB에서 받은 시간도 한국 시간으로 해석해서 비교
    const parseToLocalDate = (dateTimeStr) => {
        const [datePart, timePart] = dateTimeStr.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, second);
    };
    const fileTime = parseToLocalDate(workStartTime);
    
    if (logger) {
        logger.debug(`🔍 중복 체크 시작:`);
        logger.debug(`   파일 주문자: ${customerName}`);
        logger.debug(`   파일 시간(문자열): ${workStartTime}`);
        logger.debug(`   파일 시간(Date): ${fileTime.toString()}`);
        logger.debug(`   파일 시간(타임스탬프): ${fileTime.getTime()}`);
        logger.debug(`   DB 주문 수: ${allOrders.length}건`);
    }
    
    // 주문자 이름과 작업 시작 시간으로 검색
    const found = allOrders.find((order, index) => {
        const isSameOrderer = order.orderer === customerName;
        
        if (!isSameOrderer) return false;
        
        // DB의 시간도 Date 객체로 변환
        const dbTime = new Date(order.workStartTime);
        
        // 시간 차이 계산 (밀리초)
        const timeDiff = Math.abs(fileTime.getTime() - dbTime.getTime());
        
        // 1분(60000ms) 이내 또는 정확히 9시간 차이(시간대 문제)면 같은 주문으로 판단
        const isExactlyOneHour = timeDiff === 3600000;  // 정확히 1시간 (DST 등)
        const isExactly9Hours = timeDiff === 32400000;  // 정확히 9시간 (KST-UTC)
        const isSameTime = timeDiff < 60000 || isExactly9Hours || isExactlyOneHour;
        
        if (logger && isSameOrderer) {
            logger.debug(`   [${index}] DB 주문자: ${order.orderer}`);
            logger.debug(`       DB 시간(문자열): ${order.workStartTime}`);
            logger.debug(`       DB 시간(Date): ${dbTime.toString()}`);
            logger.debug(`       DB 시간(타임스탬프): ${dbTime.getTime()}`);
            logger.debug(`       시간 차이: ${timeDiff}ms (${(timeDiff / 1000).toFixed(1)}초)`);
            if (isExactly9Hours) {
                logger.debug(`       → 9시간 차이 (시간대 불일치) ✅`);
            } else if (isExactlyOneHour) {
                logger.debug(`       → 1시간 차이 (DST) ✅`);
            }
            logger.debug(`       매칭: ${isSameTime ? 'YES ✅' : 'NO ❌'}`);
        }
        
        return isSameOrderer && isSameTime;
    });
    
    if (logger) {
        logger.debug(`   결과: ${found ? '중복 발견 ✅' : '중복 없음 ❌'}`);
    }
    
    return found;
}

// API 전송용 날짜 포맷팅 함수 (yyyy-MM-dd HH:mm:ss) - 한국 시간 그대로 사용
// JSON 파일: "2025-07-08T16:49:56.1314638+09:00" (KST)
// → API 전송: "2025-07-08 16:49:56" (KST 그대로)
function formatDateTimeForAPI(dateString) {
    // ISO 문자열에서 시간대 정보를 제거하고 로컬 시간으로 파싱 → 전송 전 9시간 역보정(-9h)
    const cleanDateString = dateString.replace(/[+-]\d{2}:\d{2}$/, '').replace('T', ' ');
    const [datePart, timePart] = cleanDateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    // 타임존 보정: config.timezoneShiftHours 적용 (운영 DB=KST면 0 권장)
    const hoursOffset = (config.timezoneShiftHours || 0);
    date.setHours(date.getHours() + hoursOffset);

    const yearStr = date.getFullYear();
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const hoursStr = String(date.getHours()).padStart(2, '0');
    const minutesStr = String(date.getMinutes()).padStart(2, '0');
    const secondsStr = String(date.getSeconds()).padStart(2, '0');

    return `${yearStr}-${monthStr}-${dayStr} ${hoursStr}:${minutesStr}:${secondsStr}`;
}

// 작업 시간을 분으로 변환 (API 전송용)
function convertWorkTimeToMinutes(workTime) {
    const parts = workTime.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 60 + minutes;
}

// UPDATE API 호출 함수
async function updateOrder(customerName, workStartTime, payload, logger) {
    try {
        logger.blank();
        logger.section('API 업데이트 (작업중 → 완료)');
        logger.item('주문자', customerName);
        logger.item('작업시작', workStartTime);
        logger.item('새 상태', payload.result);
        logger.info('│');
        logger.info('│  📦 업데이트 데이터:');
        
        const updatePayload = {
            orderer: customerName,
            workStartTime: workStartTime,
            result: payload.result,
            workEndTime: payload.workEndTime,
            totalWorkTime: payload.totalWorkTime
        };
        
        if (payload.error) {
            updatePayload.error = payload.error;
        }
        
        logger.json(updatePayload);
        logger.info('│');
        logger.info('│  🔄 UPDATE API 요청 중...');
        
        // 응답 시간 측정 시작
        const startTime = Date.now();
        
        const response = await axios.post(config.apiUpdateUrl, updatePayload, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DWX-52D-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        logger.success(`업데이트 성공: ${response.data.message || 'OK'} (${responseTime}ms)`);
        if (response.data.data && response.data.data.orderCode) {
            logger.item('주문 코드', response.data.data.orderCode);
        }
        logger.sectionEnd();
        
        return { success: true, updated: true, response: response.data };
        
    } catch (error) {
        logger.error(`업데이트 실패: ${error.message}`);
        if (error.response) {
            logger.error(`상태 코드: ${error.response.status}`);
            logger.error(`응답 메시지: ${JSON.stringify(error.response.data)}`);
        }
        logger.sectionEnd();
        
        return { success: false, error: error.message };
    }
}

// API로 데이터 전송 함수
async function sendToAPI(data, extractCustomerName, logger, allOrders = []) {
    const job = data.Jobs[0];
    const application = job.Applications[0];
    
    // 주문자 이름 추출 및 한글 변환
    const customerName = extractCustomerName(application.StlFile);
    
    // 작업 상태 판단
    let jobStatus;
    if (!job.EndTime || job.EndTime === null) {
        // EndTime이 없으면 작업중
        jobStatus = '작업중';
    } else if (job.JobResult === 1) {
        // EndTime이 있고 JobResult가 1이면 완료
        jobStatus = '완료';
    } else {
        // EndTime이 있지만 JobResult가 1이 아니면 실패
        jobStatus = '실패';
    }
    
    // API 요청 데이터 구성
    const payload = {
        equipmentModel: data.ModelName,
        orderer: customerName,
        workStartTime: formatDateTimeForAPI(job.StartTime),
        workEndTime: job.EndTime ? formatDateTimeForAPI(job.EndTime) : null,
        totalWorkTime: job.EndTime ? convertWorkTimeToMinutes(job.WorkTime) : null,
        result: jobStatus
    };
    
    // 오류가 있으면 추가
    if (job.ErrorList && job.ErrorList.length > 0) {
        payload.error = job.ErrorList.join(', ');
    }
    
    // 기존 주문 찾기 (completedOrders + workingOrders 합친 리스트에서)
    const existingOrder = findExistingOrder(customerName, payload.workStartTime, allOrders, logger);
    
    // 케이스 1: 기존 주문이 있고 "완료" 상태면 → 건너뛰기
    if (existingOrder && existingOrder.result === '완료') {
        logger.warn(`⏭️  이미 완료된 주문 건너뛰기: ${customerName} (${payload.workStartTime})`);
        return { 
            success: true, 
            skipped: true, 
            message: '이미 완료된 주문입니다.',
            allOrders: allOrders // 기존 리스트 그대로 반환
        };
    }
    
    // 케이스 2: 기존 주문이 있고 "작업중" 상태인데, 파일이 "완료"면 → UPDATE API 호출
    if (existingOrder && existingOrder.result === '작업중' && payload.result === '완료') {
        logger.info(`🔄 작업중 → 완료 업데이트 필요: ${customerName}`);
        const updateResult = await updateOrder(customerName, payload.workStartTime, payload, logger);
        
        if (updateResult.success) {
            // allOrders에서 해당 주문의 상태를 "완료"로 업데이트
            const updatedAllOrders = allOrders.map(order => {
                if (order.orderer === customerName && 
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
            
            logger.debug(`📊 allOrders 내부 업데이트: ${customerName} (작업중 → 완료)`);
            
            return {
                success: true,
                updated: true,
                message: '주문이 완료로 업데이트되었습니다.',
                allOrders: updatedAllOrders // 업데이트된 리스트 반환
            };
        } else {
            return {
                success: false,
                error: updateResult.error,
                allOrders: allOrders
            };
        }
    }
    
    // 케이스 3: 일치하는 주문 없음 → CREATE API 호출
    try {
        logger.blank();
        logger.section('API 전송 (신규 주문 생성)');
        logger.item('주문자', customerName);
        logger.item('장비', payload.equipmentModel);
        logger.item('작업시간', `${payload.totalWorkTime}분`);
        logger.item('결과', payload.result);
        logger.info('│');
        logger.info('│  📦 전송 데이터:');
        logger.json(payload);
        logger.info('│');
        logger.info('│  🚀 CREATE API 요청 중...');
        
        // 응답 시간 측정 시작
        const startTime = Date.now();
        
        const response = await axios.post(config.apiUrl, payload, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DWX-52D-LogProcessor/1.0'
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        logger.success(`API 전송 성공: ${response.data.message || 'OK'} (${responseTime}ms)`);
        
        // 응답에서 새 주문 정보 추출
        const newOrder = response.data.data;
        
        if (newOrder && newOrder.orderCode) {
            logger.item('주문 코드', newOrder.orderCode);
        }
        
        logger.sectionEnd();
        
        // 새 주문을 allOrders에 추가
        // ⭐ 작업중 주문은 앞에, 완료 주문은 뒤에 추가
        const updatedAllOrders = [...allOrders];
        if (newOrder) {
            if (newOrder.result === '작업중') {
                updatedAllOrders.unshift(newOrder);  // 앞에 추가
            } else {
                updatedAllOrders.push(newOrder);     // 뒤에 추가
            }
            logger.debug(`📊 새 주문 추가: ${customerName} (전체: ${updatedAllOrders.length}건)`);
        }
        
        return { 
            success: true,
            created: true,
            response: response.data,
            allOrders: updatedAllOrders // 업데이트된 리스트 반환
        };
        
    } catch (error) {
        logger.error(`API 전송 실패: ${error.message}`);
        if (error.response) {
            logger.error(`상태 코드: ${error.response.status}`);
            logger.error(`응답 메시지: ${JSON.stringify(error.response.data)}`);
        } else if (error.code === 'ECONNREFUSED') {
            logger.error(`원인: API 서버에 연결할 수 없습니다`);
            logger.warn(`서버가 ${config.apiUrl}에서 실행 중인지 확인하세요`);
        }
        logger.sectionEnd();
        
        return { 
            success: false, 
            error: error.message,
            allOrders: allOrders // 기존 리스트 유지
        };
    }
}

module.exports = {
    sendToAPI,
    updateOrder,
    getInitialCompletedOrders,
    findExistingOrder,
    formatDateTimeForAPI,
    convertWorkTimeToMinutes,
    checkApiHealth
};
