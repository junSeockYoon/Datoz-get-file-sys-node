const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

// XML 파서 생성
const parser = new xml2js.Parser();

// 환자명에서 순수 이름만 추출 (a3참, a3.5참 등 제거)
function extractPatientName(fullName) {
    if (!fullName) return null;
    
    // 'a3'으로 시작하는 부분부터 끝까지 제거
    // 예: "임준우a3참" → "임준우"
    // 예: "김기영a3.5참" → "김기영"
    // 예: "김교철a3연스" → "김교철"
    const cleaned = fullName.replace(/a\d+(\.\d+)?.*$/i, '').trim();
    
    return cleaned || fullName; // 매칭 실패 시 원본 반환
}

// 폴더 수정 시간 가져오기 (마지막 작업 완료 시간)
function getFolderModificationTime(folderPath) {
    try {
        const stats = fs.statSync(folderPath);
        const date = stats.mtime; // 폴더 수정 시간 (마지막 작업 시간)
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        return null;
    }
}

// 유닉스 타임스탬프를 날짜 문자열로 변환
function unixToDateTime(unixTimestamp) {
    if (!unixTimestamp || unixTimestamp === '0') {
        return null;
    }
    
    const date = new Date(parseInt(unixTimestamp) * 1000); // 초 단위 → 밀리초
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 작업 시간 계산 (분 단위)
function calculateWorkTime(createDate, deliveryDate) {
    if (!createDate || !deliveryDate || createDate === '0' || deliveryDate === '0') {
        return null;
    }
    
    const start = parseInt(createDate);
    const end = parseInt(deliveryDate);
    
    // 시간 차이 계산 (분 단위)
    const diffMinutes = Math.floor((end - start) / 60);
    
    return diffMinutes > 0 ? diffMinutes : null;
}

// XML 폴더 처리
async function processXmlFolders(allOrders) {
    const targetDir = config.targetDirectory2;
    
    logger.blank();
    logger.section('XML 폴더 처리 (기기 2)');
    logger.info(`디렉토리: ${targetDir}`);
    
    try {
        const folders = fs.readdirSync(targetDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        if (folders.length === 0) {
            logger.warn('XML 폴더를 찾을 수 없습니다.');
            return { allOrders, stats: { created: 0, updated: 0, skipped: 0, failed: 0 } };
        }
        
        logger.success(`${folders.length}개의 폴더 발견`);
        logger.sectionEnd();
        
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < folders.length; i++) {
            const folderName = folders[i];
            const folderPath = path.join(targetDir, folderName);
            const xmlFilePath = path.join(folderPath, `${folderName}.xml`);
            
            logger.blank();
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.info(`📁 [${i + 1}/${folders.length}] ${folderName}`);
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            // XML 파일 존재 확인
            if (!fs.existsSync(xmlFilePath)) {
                logger.warn(`XML 파일을 찾을 수 없습니다: ${folderName}.xml`);
                failCount++;
                continue;
            }
            
            try {
                // XML 파일 읽기
                const xmlContent = fs.readFileSync(xmlFilePath, 'utf8');
                
                // XML 파싱
                const result = await parser.parseStringPromise(xmlContent);
                
                // 데이터 추출 (폴더 경로 전달)
                const orderData = extractOrderData(result, folderName, folderPath);
                
                if (!orderData) {
                    logger.error(`데이터 추출 실패: ${folderName}`);
                    failCount++;
                    continue;
                }
                
                // 리포트 출력
                printXmlReport(orderData);
                
                // API 전송
                logger.info(`🔍 현재 전체 주문: ${allOrders.length}건`);
                const apiResult = await sendXmlToAPI(orderData, allOrders);
                
                // allOrders 업데이트
                if (apiResult.allOrders) {
                    const beforeCount = allOrders.length;
                    allOrders = apiResult.allOrders;
                    const afterCount = allOrders.length;
                    
                    if (afterCount > beforeCount) {
                        logger.info(`📊 전체 주문 업데이트: ${beforeCount}건 → ${afterCount}건`);
                    }
                } else if (!apiResult.skipped && !apiResult.updated) {
                    logger.error(`⚠️  경고: API 응답에 주문 리스트가 없습니다!`);
                }
                
                // 결과 처리
                if (apiResult.success) {
                    if (apiResult.skipped) {
                        skippedCount++;
                        logger.info(`⏭️  건너뜀: ${folderName}`);
                    } else if (apiResult.updated) {
                        updatedCount++;
                        logger.success(`🔄 업데이트 완료: ${folderName}`);
                    } else if (apiResult.created) {
                        createdCount++;
                        logger.success(`✅ 생성 완료: ${folderName}`);
                    }
                } else {
                    failCount++;
                    logger.error(`❌ 처리 실패: ${folderName}`);
                }
                
                // API 부하 방지 (건너뛴 경우는 딜레이 없음)
                if (!apiResult.skipped) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } catch (error) {
                logger.error(`폴더 처리 중 오류 (${folderName}): ${error.message}`);
                failCount++;
            }
        }
        
        // 최종 요약
        logger.blank();
        logger.separator('═', 60);
        logger.info('📊 XML 처리 완료!');
        logger.separator('═', 60);
        logger.info(`✅ 신규 생성: ${createdCount}건`);
        logger.info(`🔄 업데이트: ${updatedCount}건 (작업중 → 완료)`);
        logger.info(`⏭️  건너뜀: ${skippedCount}건 (이미 완료)`);
        if (failCount > 0) {
            logger.error(`❌ 실패: ${failCount}건`);
        } else {
            logger.info(`❌ 실패: ${failCount}건`);
        }
        logger.info(`📁 총 폴더: ${folders.length}개`);
        logger.separator('═', 60);
        
        return {
            allOrders,
            stats: {
                created: createdCount,
                updated: updatedCount,
                skipped: skippedCount,
                failed: failCount
            }
        };
        
    } catch (error) {
        logger.error(`XML 디렉토리 읽기 실패: ${error.message}`);
        return { allOrders, stats: { created: 0, updated: 0, skipped: 0, failed: 0 } };
    }
}

// XML에서 주문 데이터 추출
function extractOrderData(xmlData, folderName, folderPath) {
    try {
        const mainObject = xmlData.DentalContainer?.Object?.[0];
        if (!mainObject) {
            return null;
        }
        
        // OrderList에서 Order 정보 추출
        const orderList = mainObject.Object?.find(obj => obj.$.name === 'OrderList');
        const orderItem = orderList?.List?.[0]?.Object?.[0];
        
        if (!orderItem) {
            return null;
        }
        
        // Property 값을 쉽게 찾기 위한 헬퍼 함수
        const getProperty = (name) => {
            const prop = orderItem.Property?.find(p => p.$.name === name);
            return prop?.$.value || null;
        };
        
        // ModelElementList에서 추가 정보 추출
        const modelElementList = mainObject.Object?.find(obj => obj.$.name === 'ModelElementList');
        const modelElement = modelElementList?.List?.[0]?.Object?.[0];
        
        const getModelProperty = (name) => {
            const prop = modelElement?.Property?.find(p => p.$.name === name);
            return prop?.$.value || null;
        };
        
        // 데이터 추출
        const patientFullName = getProperty('Patient_LastName');
        const patientName = extractPatientName(patientFullName); // a3참 등 제거
        const items = getProperty('Items') || getModelProperty('Items');
        const material = getProperty('CacheMaterialName') || getModelProperty('CacheMaterialName');
        
        // 시작 시간: CreateDate 우선, 없으면 CacheMaxScanDate 사용
        const createDate = getModelProperty('CreateDate') || getProperty('CacheMaxScanDate');
        
        // 종료 시간: 폴더 수정 시간 사용 (마지막 작업 완료 시간)
        // 주의: 개발 환경에서 폴더를 복사한 경우 복사 시간이 찍힘
        // 운영 환경(실제 기기)에서는 실제 작업 완료 시간이 정확하게 찍힘
        const folderModificationTime = getFolderModificationTime(folderPath);
        
        // 날짜 변환
        const startTime = unixToDateTime(createDate);
        const endTime = folderModificationTime; // 폴더 수정 시간 = 작업 완료 시간
        
        // 작업 시간 계산
        let workTime = null;
        if (startTime && endTime) {
            const start = new Date(startTime).getTime();
            const end = new Date(endTime).getTime();
            const diffMinutes = Math.floor((end - start) / (1000 * 60));
            workTime = diffMinutes > 0 ? diffMinutes : null;
        }
        
        // 작업 상태 판단
        let jobStatus;
        if (!endTime || endTime === null) {
            jobStatus = '작업중';
        } else {
            jobStatus = '완료';
        }
        
        return {
            orderer: patientName, // 순수 환자명만
            equipmentModel: 'XML-System', // XML 기기 이름 (필요시 수정)
            workStartTime: startTime,
            workEndTime: endTime,
            totalWorkTime: workTime,
            result: jobStatus,
            items: items,
            material: material,
            folderName: folderName
        };
        
    } catch (error) {
        logger.error(`데이터 추출 오류: ${error.message}`);
        return null;
    }
}

// XML 리포트 출력
function printXmlReport(data) {
    logger.blank();
    logger.title('XML 주문 정보');
    logger.blank();
    
    logger.section('기본 정보');
    logger.item('장비 모델', data.equipmentModel);
    logger.item('환자명', data.orderer);
    logger.item('폴더명', data.folderName);
    if (data.items) {
        logger.item('작업 항목', data.items);
    }
    if (data.material) {
        logger.item('재료', data.material);
    }
    logger.sectionEnd();
    
    logger.blank();
    logger.section('작업 시간');
    if (data.workStartTime) {
        logger.item('시작 시간', data.workStartTime);
    } else {
        logger.item('시작 시간', '정보 없음');
    }
    
    if (data.workEndTime) {
        logger.item('종료 시간', data.workEndTime);
    } else {
        logger.item('종료 시간', '정보 없음 (작업중)');
    }
    
    if (data.totalWorkTime) {
        logger.item('총 작업 시간', `${data.totalWorkTime}분`);
    } else {
        logger.item('총 작업 시간', '계산 불가');
    }
    logger.sectionEnd();
    
    logger.blank();
    logger.section('작업 결과');
    const statusIcon = data.result === '완료' ? '✅' : '🔄';
    logger.item('상태', `${data.result} ${statusIcon}`);
    logger.sectionEnd();
}

// 기존 주문 찾기 (주문자 + 작업시작일로)
function findExistingOrder(customerName, workStartTime, allOrders) {
    if (!allOrders || allOrders.length === 0) {
        return null;
    }
    
    const fileTime = new Date(workStartTime);
    
    return allOrders.find(order => {
        const isSameOrderer = order.orderer === customerName;
        if (!isSameOrderer) return false;
        
        const dbTime = new Date(order.workStartTime);
        const timeDiff = Math.abs(fileTime.getTime() - dbTime.getTime());
        const isSameTime = timeDiff < 60000; // 1분 이내
        
        return isSameOrderer && isSameTime;
    });
}

// XML 데이터를 API로 전송
async function sendXmlToAPI(xmlData, allOrders) {
    const customerName = xmlData.orderer;
    
    // API 요청 데이터 구성
    const payload = {
        equipmentModel: xmlData.equipmentModel,
        orderer: customerName,
        workStartTime: xmlData.workStartTime,
        workEndTime: xmlData.workEndTime,
        totalWorkTime: xmlData.totalWorkTime,
        result: xmlData.result
    };
    
    // 기존 주문 찾기
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
            allOrders: allOrders
        };
    }
    
    // 케이스 2: 기존 주문이 있고 "작업중" 상태인데, XML이 "완료"면 → UPDATE
    if (existingOrder && existingOrder.result === '작업중' && payload.result === '완료') {
        logger.info(`🔄 작업중 → 완료 업데이트 필요: ${customerName}`);
        
        try {
            logger.blank();
            logger.section('API 업데이트 (작업중 → 완료)');
            logger.item('주문자', customerName);
            logger.item('시작시간', payload.workStartTime);
            logger.blank();
            logger.info('│  🔄 UPDATE API 요청 중...');
            
            const response = await axios.post(config.apiUpdateUrl, {
                orderer: customerName,
                workStartTime: payload.workStartTime,
                result: payload.result,
                workEndTime: payload.workEndTime,
                totalWorkTime: payload.totalWorkTime
            }, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            logger.success(`업데이트 성공: ${response.data.message || 'OK'}`);
            
            if (response.data.data && response.data.data.orderCode) {
                logger.item('주문 코드', response.data.data.orderCode);
            }
            logger.sectionEnd();
            
            // allOrders에서 해당 주문의 상태 업데이트
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
                allOrders: updatedAllOrders
            };
            
        } catch (error) {
            logger.error(`UPDATE API 실패: ${error.message}`);
            return {
                success: false,
                error: error.message,
                allOrders: allOrders
            };
        }
    }
    
    // 케이스 3: 일치하는 주문 없음 → CREATE
    try {
        logger.blank();
        logger.section('API 전송 (신규 주문 생성)');
        logger.item('주문자', customerName);
        logger.item('장비', payload.equipmentModel);
        if (payload.totalWorkTime) {
            logger.item('작업시간', `${payload.totalWorkTime}분`);
        }
        logger.item('결과', payload.result);
        logger.blank();
        logger.info('│  🚀 CREATE API 요청 중...');
        
        const response = await axios.post(config.apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        logger.success(`API 전송 성공: ${response.data.message || 'OK'}`);
        
        const newOrder = response.data.data;
        if (newOrder && newOrder.orderCode) {
            logger.item('주문 코드', newOrder.orderCode);
        }
        
        logger.sectionEnd();
        
        // 새 주문을 allOrders에 추가
        const updatedAllOrders = [...allOrders];
        if (newOrder) {
            if (newOrder.result === '작업중') {
                updatedAllOrders.unshift(newOrder);
            } else {
                updatedAllOrders.push(newOrder);
            }
            logger.debug(`📊 새 주문 추가: ${customerName} (전체: ${updatedAllOrders.length}건)`);
        }
        
        return {
            success: true,
            created: true,
            response: response.data,
            allOrders: updatedAllOrders
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
            allOrders: allOrders
        };
    }
}

module.exports = {
    processXmlFolders,
    extractOrderData,
    unixToDateTime,
    calculateWorkTime
};
