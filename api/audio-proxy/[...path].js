export default async function handler(req, res) {
  // Обработка OPTIONS запросов для CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range');
    res.status(200).end();
    return;
  }

  const { path } = req.query;
  const filePath = Array.isArray(path) ? path.join('/') : path;
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  // Расширенный список прокси-серверов для обхода блокировки
  const proxyUrls = [
    // Основные Cloudflare Workers
    `https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://audio-secondary.alexbrin102.workers.dev/${filePath}`,
    
    // Публичные CORS прокси
    `https://cors-anywhere.herokuapp.com/https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://api.allorigins.win/raw?url=https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://corsproxy.io/?https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://thingproxy.freeboard.io/fetch/https://audio.alexbrin102.workers.dev/${filePath}`,
    
    // Альтернативные прокси
    `https://api.codetabs.com/v1/proxy?quest=https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://cors.bridged.cc/https://audio.alexbrin102.workers.dev/${filePath}`,
    
    // Резервные варианты
    `https://cors-anywhere.herokuapp.com/https://audio-secondary.alexbrin102.workers.dev/${filePath}`,
    `https://api.allorigins.win/raw?url=https://audio-secondary.alexbrin102.workers.dev/${filePath}`,
  ];

  console.log('Audio proxy: Trying to fetch', filePath);
  
  for (let i = 0; i < proxyUrls.length; i++) {
    const targetUrl = proxyUrls[i];
    console.log(`Audio proxy: Attempt ${i + 1} - Fetching from`, targetUrl);
    
    try {
      // Улучшенные заголовки для обхода блокировки
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
        console.log('Audio proxy: Range header', req.headers.range);
      }
      if (req.headers['if-range']) {
        headers['If-Range'] = req.headers['if-range'];
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд таймаут
      
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      console.log(`Audio proxy: Response status for attempt ${i + 1}:`, response.status);
      console.log(`Audio proxy: Response headers for attempt ${i + 1}:`, Object.fromEntries(response.headers.entries()));

      if (response.ok || response.status === 206) {
        console.log(`Audio proxy: Success with attempt ${i + 1}`);
        
        // Устанавливаем CORS заголовки
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range');
        
        // Передаем важные заголовки от прокси
        const contentType = response.headers.get('content-type');
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
        
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        }
        
        const acceptRanges = response.headers.get('accept-ranges');
        if (acceptRanges) {
          res.setHeader('Accept-Ranges', acceptRanges);
        }
        
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          res.setHeader('Content-Range', contentRange);
        }
        
        const lastModified = response.headers.get('last-modified');
        if (lastModified) {
          res.setHeader('Last-Modified', lastModified);
        }
        
        const etag = response.headers.get('etag');
        if (etag) {
          res.setHeader('ETag', etag);
        }
        
        // Передаем статус код
        res.status(response.status);
        
        // Для больших файлов используем стриминг
        if (contentLength && parseInt(contentLength) > 1024 * 1024) { // Больше 1MB
          console.log('Audio proxy: Streaming large file');
          response.body.pipe(res);
        } else {
          // Для маленьких файлов получаем данные и отправляем их
          console.log('Audio proxy: Fetching audio data');
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          console.log('Audio proxy: Sending buffer of size', buffer.length);
          res.send(buffer);
        }
        
        return; // Успешно завершаем
      } else {
        console.log(`Audio proxy: Failed attempt ${i + 1} with status`, response.status);
        if (response.status === 403 || response.status === 429) {
          console.log(`Audio proxy: Rate limited or blocked, trying next proxy`);
        }
      }
    } catch (error) {
      console.error(`Audio proxy: Error in attempt ${i + 1}:`, error.message);
      if (error.name === 'AbortError') {
        console.log(`Audio proxy: Request timeout for attempt ${i + 1}`);
      }
      // Продолжаем к следующему прокси
    }
  }
  
  // Если все попытки не удались
  console.error('Audio proxy: All attempts failed');
  res.status(500).json({ 
    error: 'Failed to fetch audio from all proxy sources',
    details: 'All proxy attempts failed. This might be due to network blocking or proxy unavailability.',
    suggestions: [
      'Try refreshing the page',
      'Check your internet connection',
      'The audio file might be temporarily unavailable'
    ]
  });
}

export const config = {
  api: {
    responseLimit: false,
  },
}; 