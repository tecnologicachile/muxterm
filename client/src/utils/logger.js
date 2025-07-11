const LOG_LEVELS = {
  none: 0,
  error: 1,
  info: 2,
  debug: 3
};

const currentLevel = LOG_LEVELS[import.meta.env.VITE_LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.error;

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
  },
  
  group: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.group(...args);
    }
  },
  
  groupEnd: () => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.groupEnd();
    }
  }
};

export default logger;