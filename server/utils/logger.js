const LOG_LEVELS = {
  none: 0,
  error: 1,
  info: 2,
  debug: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.error;

const logger = {
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.info('[INFO]', ...args);
    }
  },
  
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error('[ERROR]', ...args);
    }
  }
};

module.exports = logger;