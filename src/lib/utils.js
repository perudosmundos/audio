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

// Функция для преобразования аудио URL через прокси (для обхода CORS)
export const getProxiedAudioUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Временно отключаем прокси для тестирования
  console.log('Utils: Using direct URL (proxy disabled for testing):', originalUrl);
  return originalUrl;
};

// Функция для проверки доступности прокси
export const testProxyAvailability = async (proxyUrl) => {
  try {
    const response = await fetch(proxyUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn('Proxy test failed:', error);
    return false;
  }
};

// Функция для получения URL с fallback
export const getAudioUrlWithFallback = async (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Временно отключаем прокси для тестирования
  console.log('Utils: Using direct URL with fallback (proxy disabled for testing):', originalUrl);
  return originalUrl;
};