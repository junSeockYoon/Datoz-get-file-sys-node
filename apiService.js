const axios = require('axios');
const config = require('./config');

// 초기 주문 리스트 가져오기 (GET API 사용)
async function getInitialCompletedOrders(logger) {
    try {
        logger.info('🔍 전체 주문 목록 조회 중...');
        logger.info(`   API: ${config.apiListUrl}`);
        
        // GET API로 전체 주문 목록 조회
        const response = await axios.get(config.apiListUrl);
        
        if (!response.data.success) {
            logger.warn('주문 목록 조회 실패');
            return { success: false, allOrders: [] };
        }
        
        const allOrders = response.data.data || [];
        
        // result 필드로 완료/작업중 구분
        const completedOrders = allOrders.filter(o => o.result === '완료');
        const workingOrders = allOrders.filter(o => o.result === '작업중');
        
        logger.success(`전체 주문 ${allOrders.length}건 조회 완료`);
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
        logger.error(`주문 목록 조회 실패: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
            logger.error(`API 서버에 연결할 수 없습니다`);
            logger.warn(`서버가 ${config.apiListUrl}에서 실행 중인지 확인하세요`);
        } else if (error.response) {
            logger.error(`상태 코드: ${error.response.status}`);
            logger.error(`응답: ${JSON.stringify(error.response.data)}`);
        }
        
        logger.warn('빈 상태로 시작합니다 (중복 체크 불가)');
        return { success: false, allOrders: [] };
    }
}

// 기존 주문 찾기 (주문자 + 작업시작일로)
function findExistingOrder(customerName, workStartTime, allOrders) {
    if (!allOrders || allOrders.length === 0) {
        return null;
    }
    
    // workStartTime을 Date 객체로 변환 (UTC 고려)
    const fileTime = new Date(workStartTime);
    
    // 주문자 이름과 작업 시작 시간으로 검색
    return allOrders.find(order => {
        const isSameOrderer = order.orderer === customerName;
        
        if (!isSameOrderer) return false;
        
        // DB의 시간도 Date 객체로 변환
        const dbTime = new Date(order.workStartTime);
        
        // 시간 차이 계산 (밀리초)
        const timeDiff = Math.abs(fileTime.getTime() - dbTime.getTime());
        
        // 1분(60000ms) 이내면 같은 주문으로 판단
        const isSameTime = timeDiff < 60000;
        
        return isSameOrderer && isSameTime;
    });
}

// API 전송용 날짜 포맷팅 함수 (yyyy-MM-dd HH:mm:ss)
function formatDateTimeForAPI(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
        
        const response = await axios.post(config.apiUpdateUrl, updatePayload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        logger.success(`업데이트 성공: ${response.data.message || 'OK'}`);
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
    
    // API 요청 데이터 구성
    const payload = {
        equipmentModel: data.ModelName,
        orderer: customerName,
        workStartTime: formatDateTimeForAPI(job.StartTime),
        workEndTime: formatDateTimeForAPI(job.EndTime),
        totalWorkTime: convertWorkTimeToMinutes(job.WorkTime),
        result: job.JobResult === 1 ? '완료' : '실패'
    };
    
    // 오류가 있으면 추가
    if (job.ErrorList && job.ErrorList.length > 0) {
        payload.error = job.ErrorList.join(', ');
    }
    
    // 기존 주문 찾기 (completedOrders + workingOrders 합친 리스트에서)
    const existingOrder = findExistingOrder(customerName, payload.workStartTime, allOrders);
    
    if (!existingOrder) {
        logger.debug(`🔍 중복 체크: ${customerName} (${payload.workStartTime}) → 없음 (전체: ${allOrders.length}건)`);
    } else {
        logger.debug(`🔍 중복 체크: ${customerName} → 찾음! (상태: ${existingOrder.result})`);
    }
    
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
        
        const response = await axios.post(config.apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        logger.success(`API 전송 성공: ${response.data.message || 'OK'}`);
        
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
    convertWorkTimeToMinutes
};
