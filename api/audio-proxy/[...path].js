export default async function handler(req, res) {
  // Добавляем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { path } = req.query;
  if (!path || path.length === 0) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }

  const filename = Array.isArray(path) ? path.join('/') : path;
  const audioUrl = `https://audio.alexbrin102.workers.dev/${filename}`;

  console.log('Audio proxy: Fetching from', audioUrl);

  try {
    const response = await fetch(audioUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/*, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'If-None-Match': req.headers['if-none-match'] || '',
        ...(req.headers.range && { 'Range': req.headers.range })
      }
    });

    if (!response.ok && response.status !== 206) {
      console.error('Audio proxy: Error response from Cloudflare Worker:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Failed to fetch audio: ${response.status} ${response.statusText}`,
        url: audioUrl
      });
    }

    // Проверяем Content-Type
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('audio/') && !contentType.includes('application/octet-stream')) {
      console.error('Audio proxy: Invalid content type:', contentType);
      return res.status(500).json({ 
        error: 'Invalid content type received from audio source',
        contentType,
        url: audioUrl
      });
    }

    // Передаем заголовки от Cloudflare Worker
    res.setHeader('Content-Type', contentType || 'audio/mpeg');
    res.setHeader('Content-Length', response.headers.get('content-length') || '');
    res.setHeader('Accept-Ranges', response.headers.get('accept-ranges') || 'bytes');
    
    if (response.headers.get('content-range')) {
      res.setHeader('Content-Range', response.headers.get('content-range'));
    }

    // Устанавливаем статус
    res.status(response.status);

    // Стримим ответ
    if (response.body) {
      response.body.pipe(res);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }

  } catch (error) {
    console.error('Audio proxy: Fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch audio file',
      details: error.message,
      url: audioUrl
    });
  }
} 