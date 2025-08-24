const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD;

const getDebugEnabled = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_DEBUG !== 'undefined') {
      return String(import.meta.env.VITE_DEBUG).toLowerCase() === 'true';
    }
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem('DEBUG');
      if (val != null) return String(val).toLowerCase() === 'true';
    }
  } catch (_) {}
  return !isProd; // default: debug in development
};

let debugEnabled = getDebugEnabled();

export const setDebug = (enabled) => {
  debugEnabled = Boolean(enabled);
};

const safeCall = (fn, ...args) => {
  try {
    // eslint-disable-next-line no-console
    fn(...args);
  } catch (_) {}
};

const logger = {
  debug: (...args) => {
    if (!debugEnabled) return;
    safeCall(console.debug || console.log, ...args);
  },
  info: (...args) => {
    safeCall(console.info || console.log, ...args);
  },
  warn: (...args) => {
    safeCall(console.warn, ...args);
  },
  error: (...args) => {
    safeCall(console.error, ...args);
  },
};

export default logger;


