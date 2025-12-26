/**
 * 간단한 로거 유틸리티
 */

const logLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
}

const colors = {
  ERROR: '\x1b[31m', // 빨간색
  WARN: '\x1b[33m', // 노란색
  INFO: '\x1b[36m', // 청록색
  DEBUG: '\x1b[90m', // 회색
  RESET: '\x1b[0m'
}

const logger = {
  error: (message, ...args) => {
    console.error(`${colors.ERROR}[${logLevels.ERROR}]${colors.RESET} ${new Date().toISOString()} - ${message}`, ...args)
  },
  
  warn: (message, ...args) => {
    console.warn(`${colors.WARN}[${logLevels.WARN}]${colors.RESET} ${new Date().toISOString()} - ${message}`, ...args)
  },
  
  info: (message, ...args) => {
    console.info(`${colors.INFO}[${logLevels.INFO}]${colors.RESET} ${new Date().toISOString()} - ${message}`, ...args)
  },
  
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.DEBUG}[${logLevels.DEBUG}]${colors.RESET} ${new Date().toISOString()} - ${message}`, ...args)
    }
  }
}

export default logger

