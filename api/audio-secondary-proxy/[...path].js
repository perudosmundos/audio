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

  const targetUrl = `https://audio-secondary.alexbrin102.workers.dev/${filePath}`;
  
  console.log('Audio secondary proxy: Fetching from', targetUrl);
  
  try {
    // Улучшенные заголовки для Range запросов
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'audio/*, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    };
    
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
      timeout: 15000 // Увеличиваем таймаут до 15 секунд
    });

    console.log('Audio secondary proxy: Response status', response.status);
    console.log('Audio secondary proxy: Response headers', Object.fromEntries(response.headers.entries()));

    if (!response.ok && response.status !== 206) {
      console.error('Audio secondary proxy: Failed to fetch', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch audio: ${response.statusText}` 
      });
    }

    // Проверяем Content-Type
    const contentType = response.headers.get('content-type');
    console.log('Audio secondary proxy: Content-Type', contentType);
    
    // Проверяем, что это действительно аудио файл
    if (contentType && !contentType.includes('audio/') && !contentType.includes('application/octet-stream')) {
      console.warn('Audio secondary proxy: Invalid Content-Type', contentType);
      
      // Если это HTML (ошибка), возвращаем ошибку
      if (contentType.includes('text/html')) {
        console.error('Audio secondary proxy: Got HTML response instead of audio');
        return res.status(500).json({ 
          error: 'Invalid response type',
          details: 'Received HTML instead of audio file'
        });
      }
    }

    // Устанавливаем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range');
    
    // Передаем важные заголовки от Cloudflare Worker
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
    
    const etag = response.headers.get('etag');
    if (etag) {
      res.setHeader('ETag', etag);
    }
    
    const lastModified = response.headers.get('last-modified');
    if (lastModified) {
      res.setHeader('Last-Modified', lastModified);
    }
    
    // Передаем статус код
    res.status(response.status);
    
    // Улучшенная обработка Range запросов
    if (req.headers.range && response.status === 206) {
      console.log('Audio secondary proxy: Handling Range request');
      // Для Range запросов используем потоковую передачу
      const reader = response.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (error) {
          console.error('Audio secondary proxy: Stream error:', error);
          res.end();
        }
      };
      pump();
      return;
    } else {
      // Для обычных запросов используем буферизацию
      console.log('Audio secondary proxy: Fetching audio data');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log('Audio secondary proxy: Sending buffer of size', buffer.length);
      
      // Проверяем, что буфер не пустой и не содержит HTML
      if (buffer.length === 0) {
        console.error('Audio secondary proxy: Empty buffer received');
        return res.status(500).json({ 
          error: 'Empty audio file',
          details: 'Received empty buffer from source'
        });
      }
      
      // Проверяем первые байты на HTML
      const firstBytes = buffer.slice(0, 100).toString('utf8').toLowerCase();
      if (firstBytes.includes('<!doctype') || firstBytes.includes('<html')) {
        console.error('Audio secondary proxy: HTML content detected in response');
        return res.status(500).json({ 
          error: 'Invalid response type',
          details: 'Received HTML content instead of audio file'
        });
      }
      
      res.send(buffer);
    }
    
  } catch (error) {
    console.error('Audio secondary proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      suggestions: [
        'Try refreshing the page',
        'Check your internet connection',
        'The audio file might be temporarily unavailable'
      ]
    });
  }
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: false,
  },
}; 