import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const formatTime = (seconds, showHours = false) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (showHours || hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatFullTime = (seconds, showHours = false) => {
  return formatTime(seconds, showHours);
};

export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

export const getFileNameWithoutExtension = (filename) => {
  return filename.replace(/\.[^/.]+$/, '');
};

export const formatShortDate = (dateString, language = 'ru') => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return language === 'ru' ? 'Вчера' : language === 'es' ? 'Ayer' : 'Yesterday';
  } else if (diffDays === 2) {
    return language === 'ru' ? 'Позавчера' : language === 'es' ? 'Anteayer' : 'Day before yesterday';
  } else if (diffDays <= 7) {
    return language === 'ru' ? `${diffDays} дней назад` : language === 'es' ? `Hace ${diffDays} días` : `${diffDays} days ago`;
  }
  
  const options = { 
    day: 'numeric', 
    month: 'long' 
  };
  
  if (language === 'ru') {
    options.locale = 'ru-RU';
  } else if (language === 'es') {
    options.locale = 'es-ES';
  } else {
    options.locale = 'en-US';
  }
  
  return date.toLocaleDateString(options.locale, options);
};

// Функция для получения проксированного аудио URL
export const getProxiedAudioUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Если это Cloudflare Worker URL, используем прокси для обхода блокировки в России
  if (originalUrl.includes('alexbrin102.workers.dev')) {
    const urlObj = new URL(originalUrl);
    const filename = urlObj.pathname.substring(1); // Убираем начальный слеш
    const proxiedUrl = `/api/audio-proxy/${filename}`;
    console.log('Using proxied audio URL (Russia bypass):', proxiedUrl);
    return proxiedUrl;
  }
  
  // Для других URL используем прямой доступ
  console.log('Using direct audio URL:', originalUrl);
  return originalUrl;
};

// Функция для получения URL с fallback
export const getAudioUrlWithFallback = async (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Всегда используем прокси для Cloudflare Worker в России
  return getProxiedAudioUrl(originalUrl);
};

// Функция для получения рабочего URL
export const getWorkingAudioUrl = async (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  console.log('Getting working audio URL for:', originalUrl);
  
  // Всегда используем прокси для Cloudflare Worker в России
  return getProxiedAudioUrl(originalUrl);
};

// Упрощенная функция для диагностики аудио URL
export const diagnoseAudioUrl = async (url) => {
  if (!url) return { error: 'No URL provided' };
  
  const results = {
    originalUrl: url,
    tests: {}
  };
  
  try {
    // Простая проверка URL без CORS-запросов
    console.log('Diagnosing audio URL:', url);
    
    // Проверяем, что URL валидный
    const urlObj = new URL(url);
    results.tests.urlValidation = {
      valid: true,
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname
    };
    
    // Не делаем HEAD запрос, чтобы избежать CORS ошибок
    results.tests.direct = {
      accessible: true, // Предполагаем, что доступен
      status: 'skipped', // Пропускаем проверку из-за CORS
      note: 'CORS check skipped to avoid browser restrictions'
    };
    
    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
};