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

  const targetUrl = `https://audio-secondary.alexbrin102.workers.dev/${filePath}`;
  
  console.log('Audio secondary proxy: Fetching from', targetUrl);
  
  try {
    // Получаем заголовки для Range запросов
    const headers = {
      'User-Agent': 'DosMundosPodcast/1.0'
    };
    
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
      console.log('Audio secondary proxy: Range header', req.headers.range);
    }
    if (req.headers['if-range']) {
      headers['If-Range'] = req.headers['if-range'];
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      timeout: 15000 // 15 секунд таймаут
    });

    console.log('Audio secondary proxy: Response status', response.status);
    console.log('Audio secondary proxy: Response headers', Object.fromEntries(response.headers.entries()));

    if (!response.ok && response.status !== 206) {
      console.error('Audio secondary proxy: Failed to fetch', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch audio: ${response.statusText}` 
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
    
    // Стримим данные вместо загрузки в память
    console.log('Audio secondary proxy: Streaming audio data');
    
    // Получаем readable stream и пайпим его в response
    const stream = response.body;
    if (stream) {
      stream.pipe(res);
    } else {
      // Fallback для случаев, когда stream недоступен
      console.log('Audio secondary proxy: Stream not available, using buffer fallback');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log('Audio secondary proxy: Sending buffer of size', buffer.length);
      res.send(buffer);
    }
    
  } catch (error) {
    console.error('Audio secondary proxy error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
}; 