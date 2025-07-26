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

  // Прямой доступ к Cloudflare Workers
  const targetUrl = `https://audio.alexbrin102.workers.dev/${filePath}`;
  
  console.log('Direct audio: Fetching from', targetUrl);
  
  try {
    // Получаем заголовки для Range запросов
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'audio/*,*/*;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };
    
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
      console.log('Direct audio: Range header', req.headers.range);
    }
    if (req.headers['if-range']) {
      headers['If-Range'] = req.headers['if-range'];
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      timeout: 20000 // 20 секунд таймаут
    });

    console.log('Direct audio: Response status', response.status);
    console.log('Direct audio: Response headers', Object.fromEntries(response.headers.entries()));

    if (!response.ok && response.status !== 206) {
      console.error('Direct audio: Failed to fetch', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch audio: ${response.statusText}`,
        details: 'Direct access failed, try using proxy'
      });
    }

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
    
    // Передаем статус код
    res.status(response.status);
    
    // Стримим данные
    console.log('Direct audio: Streaming audio data');
    
    const stream = response.body;
    if (stream) {
      stream.pipe(res);
    } else {
      // Fallback для случаев, когда stream недоступен
      console.log('Direct audio: Stream not available, using buffer fallback');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log('Direct audio: Sending buffer of size', buffer.length);
      res.send(buffer);
    }
    
  } catch (error) {
    console.error('Direct audio error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      suggestion: 'Try using proxy endpoint instead'
    });
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
}; 