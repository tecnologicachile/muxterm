// Universal logger that works in both Node.js and browser environments
const LOG_LEVELS = {
  none: 0,
  error: 1,
  info: 2,
  debug: 3
};

// Detect environment and get log level
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
let currentLevel;

if (isNode) {
  currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.error;
} else {
  // Browser environment - check for Vite env variable
  currentLevel = LOG_LEVELS.error; // Default for browser
}

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

// Export for CommonJS (Node.js)
module.exports = logger;