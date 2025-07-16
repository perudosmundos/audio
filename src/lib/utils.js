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
  
  // Если URL уже использует прокси, возвращаем как есть
  if (originalUrl.includes('/audio-proxy/') || originalUrl.includes('/audio-secondary-proxy/')) {
    return originalUrl;
  }
  
  // Устанавливаем прокси по умолчанию, если не установлен
  if (localStorage.getItem('useAudioProxy') === null) {
    localStorage.setItem('useAudioProxy', 'true');
  }
  
  // Проверяем, нужно ли использовать прокси (по умолчанию включен)
  const useProxy = localStorage.getItem('useAudioProxy') !== 'false';
  
  // Для Cloudflare R2 URL используем прокси в разработке и продакшене
  if (originalUrl.includes('audio.alexbrin102.workers.dev')) {
    const isDev = import.meta.env.DEV;
    if (useProxy) {
      // В продакшене используем API route для прокси
      if (!isDev) {
        return originalUrl.replace('https://audio.alexbrin102.workers.dev', '/api/audio-proxy');
      }
      // В разработке используем Vite прокси
      return originalUrl.replace('https://audio.alexbrin102.workers.dev', '/audio-proxy');
    }
  }
  
  if (originalUrl.includes('audio-secondary.alexbrin102.workers.dev')) {
    const isDev = import.meta.env.DEV;
    if (useProxy) {
      // В продакшене используем API route для прокси
      if (!isDev) {
        return originalUrl.replace('https://audio-secondary.alexbrin102.workers.dev', '/api/audio-secondary-proxy');
      }
      // В разработке используем Vite прокси
      return originalUrl.replace('https://audio-secondary.alexbrin102.workers.dev', '/audio-secondary-proxy');
    }
  }
  
  // Для других URL возвращаем как есть
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
  
  // Если это не Cloudflare URL, возвращаем как есть
  if (!originalUrl.includes('audio.alexbrin102.workers.dev') && 
      !originalUrl.includes('audio-secondary.alexbrin102.workers.dev')) {
    return originalUrl;
  }
  
  const isDev = import.meta.env.DEV;
  const useProxy = localStorage.getItem('useAudioProxy') !== 'false';
  
  if (!useProxy) {
    return originalUrl; // Возвращаем прямой URL
  }
  
  // Генерируем прокси URL
  let proxyUrl;
  if (originalUrl.includes('audio.alexbrin102.workers.dev')) {
    proxyUrl = isDev 
      ? originalUrl.replace('https://audio.alexbrin102.workers.dev', '/audio-proxy')
      : originalUrl.replace('https://audio.alexbrin102.workers.dev', '/api/audio-proxy');
  } else {
    proxyUrl = isDev 
      ? originalUrl.replace('https://audio-secondary.alexbrin102.workers.dev', '/audio-secondary-proxy')
      : originalUrl.replace('https://audio-secondary.alexbrin102.workers.dev', '/api/audio-secondary-proxy');
  }
  
  // В продакшене проверяем доступность прокси
  if (!isDev) {
    const proxyAvailable = await testProxyAvailability(proxyUrl);
    if (!proxyAvailable) {
      console.warn('Proxy not available, using direct URL');
      return originalUrl; // Fallback на прямой URL
    }
  }
  
  return proxyUrl;
};