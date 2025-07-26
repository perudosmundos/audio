export default async function handler(req, res) {
  // Обработка OPTIONS запросов для CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range, If-None-Match, Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
    return;
  }

  const { path } = req.query;
  const filePath = Array.isArray(path) ? path.join('/') : path;
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  // Расширенный список прокси-серверов для вторичного аудио
  const proxyUrls = [
    // Прямой доступ к вторичному Cloudflare Worker
    `https://audio-secondary.alexbrin102.workers.dev/${filePath}`,
    
    // Надежные CORS прокси
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://audio-secondary.alexbrin102.workers.dev/${filePath}`)}`,
    `https://corsproxy.io/?${encodeURIComponent(`https://audio-secondary.alexbrin102.workers.dev/${filePath}`)}`,
    `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(`https://audio-secondary.alexbrin102.workers.dev/${filePath}`)}`,
    
    // Альтернативные прокси
    `https://cors-anywhere.herokuapp.com/https://audio-secondary.alexbrin102.workers.dev/${filePath}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://audio-secondary.alexbrin102.workers.dev/${filePath}`)}`,
  ];
  
  console.log('Audio secondary proxy: Trying to fetch', filePath);
  
  for (let i = 0; i < proxyUrls.length; i++) {
    const targetUrl = proxyUrls[i];
    console.log(`Audio secondary proxy: Attempt ${i + 1} - Fetching from`, targetUrl);
    
    try {
      // Улучшенные заголовки для разных прокси
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/*, */*',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Origin': 'https://audio-secondary.alexbrin102.workers.dev'
      };
      
      // Добавляем Range заголовки для поддержки перемотки
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
        console.log('Audio secondary proxy: Range header', req.headers.range);
      }
      if (req.headers['if-range']) {
        headers['If-Range'] = req.headers['if-range'];
      }
      if (req.headers['if-none-match']) {
        headers['If-None-Match'] = req.headers['if-none-match'];
      }
      
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        timeout: 15000, // Увеличиваем таймаут до 15 секунд
        signal: AbortSignal.timeout(15000) // Дополнительный таймаут
      });

      console.log(`Audio secondary proxy: Response status for attempt ${i + 1}:`, response.status);

      if (response.ok || response.status === 206) { // 206 для частичного контента
        console.log(`Audio secondary proxy: Success with attempt ${i + 1}`);
        
        // Устанавливаем CORS заголовки
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range, If-None-Match, Origin, X-Requested-With, Content-Type, Accept');
        res.setHeader('Access-Control-Max-Age', '86400');
        
        // Передаем важные заголовки от Cloudflare Worker
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
        
        // Для HEAD запросов не отправляем тело
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        
        // Используем потоковую передачу для больших файлов
        if (response.body) {
          console.log('Audio secondary proxy: Streaming response');
          response.body.pipe(res);
          return;
        } else {
          // Fallback для старых окружений
          console.log('Audio secondary proxy: Fetching audio data as buffer');
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          console.log('Audio secondary proxy: Sending buffer of size', buffer.length);
          res.send(buffer);
          return;
        }
      } else {
        console.log(`Audio secondary proxy: Failed attempt ${i + 1} with status`, response.status);
      }
    } catch (error) {
      console.error(`Audio secondary proxy: Error in attempt ${i + 1}:`, error.message);
      // Продолжаем к следующему прокси
    }
  }
  
  // Если все попытки не удались
  console.error('Audio secondary proxy: All attempts failed');
  res.status(500).json({ 
    error: 'Failed to fetch audio from all secondary proxy sources',
    details: 'All secondary proxy attempts failed. This might be due to network blocking or proxy unavailability.',
    suggestions: [
      'Try refreshing the page',
      'Check your internet connection',
      'Try using a VPN if available'
    ]
  });
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: false, // Отключаем парсинг тела для потоковой передачи
  },
}; 