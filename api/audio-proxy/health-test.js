export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Range');
    res.status(200).end();
    return;
  }

  // Простая проверка здоровья - пытаемся подключиться к Cloudflare Worker
  try {
    const testUrl = 'https://audio.alexbrin102.workers.dev/health-test';
    
    const response = await fetch(testUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });

    // Считаем успешным если статус 200, 404 (файл не найден, но сервер работает) или 206
    if (response.ok || response.status === 404 || response.status === 206) {
      res.status(200).json({ 
        status: 'healthy', 
        message: 'Primary proxy is working',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'unhealthy', 
        message: `Primary proxy returned status ${response.status}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      message: `Primary proxy error: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
} 