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

// Упрощенная функция для прямого воспроизведения без прокси
export const getDirectAudioUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Просто возвращаем оригинальный URL без прокси
  console.log('Using direct audio URL:', originalUrl);
  return originalUrl;
};

// Упрощенная функция для получения URL (без прокси)
export const getAudioUrlWithFallback = async (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Просто возвращаем оригинальный URL
  console.log('Using direct audio URL (fallback):', originalUrl);
  return originalUrl;
};

// Упрощенная функция для получения рабочего URL
export const getWorkingAudioUrl = async (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  console.log('Getting direct working audio URL for:', originalUrl);
  
  // Просто возвращаем оригинальный URL
  return originalUrl;
};

// Упрощенная функция для диагностики аудио URL
export const diagnoseAudioUrl = async (url) => {
  if (!url) return { error: 'No URL provided' };
  
  const results = {
    originalUrl: url,
    tests: {}
  };
  
  try {
    // Тест 1: Прямой доступ
    console.log('Testing direct access to:', url);
    const directTest = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    results.tests.direct = {
      accessible: directTest.ok || directTest.status === 206,
      status: directTest.status,
      statusText: directTest.statusText,
      headers: Object.fromEntries(directTest.headers.entries())
    };
    
    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
};