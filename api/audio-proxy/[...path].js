import { Readable } from 'stream';

export default async function handler(req, res) {
  // Обработка OPTIONS запросов для CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range');
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
    `https://api.allorigins.win/raw?url=https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://corsproxy.io/?https://audio.alexbrin102.workers.dev/${filePath}`,
    `https://api.codetabs.com/v1/proxy?quest=https://audio.alexbrin102.workers.dev/${filePath}`
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
        timeout: 15000 // 15 секунд таймаут
      });

      console.log(`Audio proxy: Response status for attempt ${i + 1}:`, response.status);

      if (response.ok || response.status === 206) {
        console.log(`Audio proxy: Success with attempt ${i + 1}`);
        
        // Устанавливаем CORS заголовки
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range');
        
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
        
        // Для HEAD запроса не передаем тело
        if (req.method === 'HEAD') {
          res.status(response.status).end();
          return;
        }

        // Передаем статус код
        res.status(response.status);

        // Стримим данные вместо загрузки в память
        console.log('Audio proxy: Streaming audio data');

        // Получаем readable stream и пайпим его в response
        const stream = response.body;
        try {
          if (stream && typeof Readable.fromWeb === 'function') {
            Readable.fromWeb(stream).pipe(res);
            return;
          } else if (stream && typeof stream.pipe === 'function') {
            stream.pipe(res);
            return;
          } else {
            // Fallback для случаев, когда stream недоступен
            console.log('Audio proxy: Stream not available, using buffer fallback');
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            console.log('Audio proxy: Sending buffer of size', buffer.length);
            res.send(buffer);
            return;
          }
        } catch (e) {
          console.error('Audio proxy: Streaming failed, falling back to buffer', e.message);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          res.send(buffer);
          return;
        }
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