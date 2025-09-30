const fs = require('fs');
const path = require('path');

// 로그 디렉토리 경로
const LOG_DIR = path.join(__dirname, 'logs');
const ERROR_LOG_DIR = path.join(LOG_DIR, 'errors');

// 로그 디렉토리 생성
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

if (!fs.existsSync(ERROR_LOG_DIR)) {
    fs.mkdirSync(ERROR_LOG_DIR, { recursive: true });
}

// 현재 날짜를 YYYY-MM-DD 형식으로 반환
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 현재 시간을 HH:MM:SS 형식으로 반환
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// 로그 파일 경로 가져오기 (일별)
function getLogFilePath() {
    const dateStr = getCurrentDate();
    return path.join(LOG_DIR, `log_${dateStr}.txt`);
}

// 에러 로그 파일 경로 가져오기 (일별)
function getErrorLogFilePath() {
    const dateStr = getCurrentDate();
    return path.join(ERROR_LOG_DIR, `error_${dateStr}.txt`);
}

// 로그 파일에 메시지 쓰기 (간결한 형식)
function writeLog(message, level = 'INFO') {
    const logFilePath = getLogFilePath();
    const timestamp = getCurrentTime();
    
    // 레벨별 아이콘
    const icons = {
        'INFO': 'ℹ️',
        'SUCCESS': '✅',
        'ERROR': '❌',
        'WARN': '⚠️',
        'DEBUG': '🔍'
    };
    
    const icon = icons[level] || 'ℹ️';
    const logMessage = `[${timestamp}] ${icon} ${message}\n`;
    
    try {
        fs.appendFileSync(logFilePath, logMessage, 'utf8');
        
        // ERROR 레벨은 에러 로그 파일에도 기록
        if (level === 'ERROR') {
            const errorLogPath = getErrorLogFilePath();
            fs.appendFileSync(errorLogPath, logMessage, 'utf8');
        }
    } catch (error) {
        console.error('로그 파일 쓰기 실패:', error.message);
    }
}

// 여러 줄 로그 작성
function writeMultiLineLog(lines, level = 'INFO') {
    lines.forEach(line => writeLog(line, level));
}

// 구분선 추가 (더 깔끔하게)
function writeSeparator(char = '━', length = 60) {
    const logFilePath = getLogFilePath();
    const separator = char.repeat(length) + '\n';
    
    try {
        fs.appendFileSync(logFilePath, separator, 'utf8');
    } catch (error) {
        console.error('로그 파일 쓰기 실패:', error.message);
    }
}

// 큰 제목 추가
function writeTitle(title) {
    const logFilePath = getLogFilePath();
    const line = '━'.repeat(60);
    const titleText = `\n${line}\n  📋 ${title}\n${line}\n\n`;
    
    try {
        fs.appendFileSync(logFilePath, titleText, 'utf8');
    } catch (error) {
        console.error('로그 파일 쓰기 실패:', error.message);
    }
}

// 로거 함수들
const logger = {
    // 일반 정보 로그
    info: (message) => {
        writeLog(message, 'INFO');
    },
    
    // 성공 로그
    success: (message) => {
        writeLog(message, 'SUCCESS');
    },
    
    // 에러 로그
    error: (message) => {
        writeLog(message, 'ERROR');
    },
    
    // 경고 로그
    warn: (message) => {
        writeLog(message, 'WARN');
    },
    
    // 디버그 로그
    debug: (message) => {
        writeLog(message, 'DEBUG');
    },
    
    // 여러 줄 로그
    multiLine: (lines, level = 'INFO') => {
        writeMultiLineLog(lines, level);
    },
    
    // 구분선
    separator: (char = '━', length = 60) => {
        writeSeparator(char, length);
    },
    
    // 제목
    title: (title) => {
        writeTitle(title);
    },
    
    // 빈 줄
    blank: () => {
        const logFilePath = getLogFilePath();
        try {
            fs.appendFileSync(logFilePath, '\n', 'utf8');
        } catch (error) {
            console.error('로그 파일 쓰기 실패:', error.message);
        }
    },
    
    // JSON 객체 로그 (들여쓰기)
    json: (obj, label = '') => {
        if (label) {
            logger.info(`📦 ${label}:`);
        }
        const jsonStr = JSON.stringify(obj, null, 2);
        const lines = jsonStr.split('\n');
        lines.forEach(line => {
            logger.info(`   ${line}`);
        });
    },
    
    // 섹션 시작
    section: (title) => {
        logger.blank();
        logger.info(`┌─ ${title}`);
    },
    
    // 섹션 종료
    sectionEnd: () => {
        logger.info(`└─────────────────────────`);
    },
    
    // 항목 (들여쓰기)
    item: (key, value) => {
        logger.info(`│  • ${key}: ${value}`);
    },
    
    // 로그 디렉토리 경로 반환
    getLogDir: () => LOG_DIR,
    
    // 오늘 로그 파일 경로 반환
    getCurrentLogFile: () => getLogFilePath()
};

module.exports = logger;
