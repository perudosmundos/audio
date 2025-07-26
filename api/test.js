export default async function handler(req, res) {
  // Добавляем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Accept-Ranges');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    console.log('Testing URL:', url);
    
    // Тест 1: Прямой доступ
    const directResponse = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const results = {
      originalUrl: url,
      tests: {
        direct: {
          accessible: directResponse.ok || directResponse.status === 206,
          status: directResponse.status,
          statusText: directResponse.statusText,
          headers: Object.fromEntries(directResponse.headers.entries())
        }
      }
    };

    // Тест 2: Range запрос
    try {
      const rangeResponse = await fetch(url, {
        method: 'HEAD',
        headers: {
          'Range': 'bytes=0-1023',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      results.tests.range = {
        supported: rangeResponse.status === 206,
        status: rangeResponse.status,
        statusText: rangeResponse.statusText,
        headers: Object.fromEntries(rangeResponse.headers.entries())
      };
    } catch (rangeError) {
      results.tests.range = {
        supported: false,
        error: rangeError.message
      };
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error testing URL:', error);
    res.status(500).json({ 
      error: error.message,
      originalUrl: url 
    });
  }
} 