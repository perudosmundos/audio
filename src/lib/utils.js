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
    const isSecondary = originalUrl.includes('audio-secondary.alexbrin102.workers.dev');
    const proxyPath = isSecondary ? 'audio-secondary-proxy' : 'audio-proxy';
    
    // В продакшене используем API роут, в разработке - Vite прокси
    if (import.meta.env.PROD) {
      return `${window.location.origin}/api/${proxyPath}/${filePath}`;
    } else {
      return `/api/${proxyPath}/${filePath}`;
    }
  }
  
  return originalUrl;
};

// Функция для проверки доступности прокси с улучшенной логикой
export const testProxyAvailability = async (proxyUrl) => {
  try {
    console.log('Testing proxy availability:', proxyUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
    
    const response = await fetch(proxyUrl, { 
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    const isAvailable = response.ok || response.status === 206;
    console.log('Proxy test result:', { url: proxyUrl, status: response.status, available: isAvailable });
    
    return isAvailable;
  } catch (error) {
    console.warn('Proxy test failed:', { url: proxyUrl, error: error.message });
    return false;
  }
};

// Функция для получения URL с улучшенным fallback
export const getAudioUrlWithFallback = async (originalUrl) => {
  if (!originalUrl) return originalUrl;
  
  // Проверяем, является ли URL Cloudflare Worker
  if (originalUrl.includes('alexbrin102.workers.dev')) {
    const proxiedUrl = getProxiedAudioUrl(originalUrl);
    
    // Тестируем доступность прокси
    const isProxyAvailable = await testProxyAvailability(proxiedUrl);
    
    if (isProxyAvailable) {
      console.log('Using proxied URL:', proxiedUrl);
      return proxiedUrl;
    } else {
      console.warn('Proxy not available, trying direct URL with additional headers');
      
      // Попробуем прямой URL с дополнительными заголовками
      try {
        const testResponse = await fetch(originalUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'audio/*, */*',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        if (testResponse.ok || testResponse.status === 206) {
          console.log('Direct URL is accessible, using it');
          return originalUrl;
        }
      } catch (error) {
        console.warn('Direct URL test failed:', error.message);
      }
      
      // Если ничего не работает, возвращаем проксированный URL в надежде, что он заработает
      console.warn('All tests failed, using proxied URL as fallback');
      return proxiedUrl;
    }
  }
  
  return originalUrl;
};

// Новая функция для диагностики аудио URL
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
    
    // Тест 2: Прокси доступ (если это Cloudflare Worker)
    if (url.includes('alexbrin102.workers.dev')) {
      const proxiedUrl = getProxiedAudioUrl(url);
      console.log('Testing proxy access to:', proxiedUrl);
      
      const proxyTest = await testProxyAvailability(proxiedUrl);
      results.tests.proxy = {
        accessible: proxyTest,
        proxiedUrl: proxiedUrl
      };
    }
    
    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
};