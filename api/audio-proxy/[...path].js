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

  // Попробуем несколько разных прокси-серверов
  const proxyUrls = [
    `https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://cors-anywhere.herokuapp.com/https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://api.allorigins.win/raw?url=https://audio.alexbrin102.workers.dev/${filePath}`
  ];

  console.log('Audio proxy: Trying to fetch', filePath);
  
  for (let i = 0; i < proxyUrls.length; i++) {
    const targetUrl = proxyUrls[i];
    console.log(`Audio proxy: Attempt ${i + 1} - Fetching from`, targetUrl);
    
    try {
      // Получаем заголовки для Range запросов
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };
      
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
        console.log('Audio proxy: Range header', req.headers.range);
      }
      if (req.headers['if-range']) {
        headers['If-Range'] = req.headers['if-range'];
      }
      
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        timeout: 10000 // 10 секунд таймаут
      });

      console.log(`Audio proxy: Response status for attempt ${i + 1}:`, response.status);

      if (response.ok) {
        console.log(`Audio proxy: Success with attempt ${i + 1}`);
        
        // Устанавливаем CORS заголовки
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range');
        
        // Передаем заголовки от Cloudflare Worker
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
        
        // Передаем статус код
        res.status(response.status);
        
        // Используем простой подход - получаем данные и отправляем их
        console.log('Audio proxy: Fetching audio data');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log('Audio proxy: Sending buffer of size', buffer.length);
        
        // Отправляем данные
        res.send(buffer);
        return; // Успешно завершаем
      } else {
        console.log(`Audio proxy: Failed attempt ${i + 1} with status`, response.status);
      }
    } catch (error) {
      console.error(`Audio proxy: Error in attempt ${i + 1}:`, error.message);
      // Продолжаем к следующему прокси
    }
  }
  
  // Если все попытки не удались
  console.error('Audio proxy: All attempts failed');
  res.status(500).json({ 
    error: 'Failed to fetch audio from all proxy sources',
    details: 'All proxy attempts failed. This might be due to network blocking.'
  });
}

export const config = {
  api: {
    responseLimit: false,
  },
}; 