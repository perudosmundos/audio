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

  // Прямой доступ к Bunny.net CDN
  const targetUrl = `https://dosmundos-audio.b-cdn.net/${filePath}`;
  
  console.log('Bunny audio: Fetching from', targetUrl);
  
  try {
    // Получаем заголовки для Range запросов
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'audio/*,*/*;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive'
    };
    
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
      console.log('Bunny audio: Range header', req.headers.range);
    }
    if (req.headers['if-range']) {
      headers['If-Range'] = req.headers['if-range'];
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(20000)
    });

    console.log('Bunny audio: Response status', response.status);
    console.log('Bunny audio: Response headers', Object.fromEntries(response.headers.entries()));

    if (!response.ok && response.status !== 206) {
      console.error('Bunny audio: Failed to fetch', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch audio: ${response.statusText}`,
        details: 'Bunny.net CDN access failed'
      });
    }

    // Устанавливаем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, If-Range');
    
    // Передаем заголовки от Bunny.net CDN
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
    console.log('Bunny audio: Streaming audio data');
    
    const stream = response.body;
    if (stream) {
      stream.pipe(res);
    } else {
      // Fallback для случаев, когда stream недоступен
      console.log('Bunny audio: Stream not available, using buffer fallback');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log('Bunny audio: Sending buffer of size', buffer.length);
      res.send(buffer);
    }
    
  } catch (error) {
    console.error('Bunny audio error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      suggestion: 'Try accessing Bunny.net CDN directly'
    });
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
}; 