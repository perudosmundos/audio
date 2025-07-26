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
  
  // Проверяем, является ли URL Cloudflare Worker
  if (originalUrl.includes('alexbrin102.workers.dev')) {
    // Извлекаем путь файла из URL
    const url = new URL(originalUrl);
    const filePath = url.pathname.substring(1); // Убираем начальный слеш
    
    // Определяем какой прокси использовать
    const proxyPath = originalUrl.includes('audio-secondary.alexbrin102.workers.dev') 
      ? 'audio-secondary-proxy' 
      : 'audio-proxy';
    
    // В продакшене используем API роут, в разработке - Vite прокси
    if (import.meta.env.PROD) {
      return `${window.location.origin}/api/${proxyPath}/${filePath}`;
    } else {
      return `/api/${proxyPath}/${filePath}`;
    }
  }
  
  return originalUrl;
};

// Функция для проверки доступности прокси с таймаутом
export const testProxyAvailability = async (proxyUrl, timeout = 5000) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(proxyUrl, { 
      method: 'HEAD',
      signal: controller.signal,
      mode: 'cors'
    });
    
    clearTimeout(timeoutId);
    return response.ok || response.status === 206; // 206 для частичного контента
  } catch (error) {
    console.warn('Proxy test failed:', error.message);
    return false;
  }
};

// Функция для получения URL с улучшенным fallback
export const getAudioUrlWithFallback = async (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Проверяем, является ли URL Cloudflare Worker
  if (originalUrl.includes('alexbrin102.workers.dev')) {
    const proxiedUrl = getProxiedAudioUrl(originalUrl);
    
    console.log('Testing proxy availability for:', proxiedUrl);
    
    // Тестируем доступность прокси с коротким таймаутом
    const isProxyAvailable = await testProxyAvailability(proxiedUrl, 3000);
    
    if (isProxyAvailable) {
      console.log('Using proxied URL:', proxiedUrl);
      return proxiedUrl;
    } else {
      console.warn('Proxy not available, trying alternative approaches');
      
      // Попробуем альтернативные прокси напрямую
      const alternativeProxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
        `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(originalUrl)}`
      ];
      
      for (const altProxy of alternativeProxies) {
        try {
          const isAltAvailable = await testProxyAvailability(altProxy, 2000);
          if (isAltAvailable) {
            console.log('Using alternative proxy:', altProxy);
            return altProxy;
          }
        } catch (error) {
          console.warn('Alternative proxy test failed:', error.message);
        }
      }
      
      console.warn('All proxies failed, using direct URL (may not work in Russia)');
      return originalUrl;
    }
  }
  
  return originalUrl;
};