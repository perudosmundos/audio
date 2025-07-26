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
    console.log('Testing audio URL:', url);
    
    // Тест 1: HEAD запрос для проверки доступности
    const headResponse = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const results = {
      url: url,
      headTest: {
        status: headResponse.status,
        statusText: headResponse.statusText,
        contentType: headResponse.headers.get('content-type'),
        contentLength: headResponse.headers.get('content-length'),
        acceptRanges: headResponse.headers.get('accept-ranges'),
        corsHeaders: {
          'access-control-allow-origin': headResponse.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': headResponse.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': headResponse.headers.get('access-control-allow-headers')
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
      
      results.rangeTest = {
        status: rangeResponse.status,
        statusText: rangeResponse.statusText,
        contentRange: rangeResponse.headers.get('content-range'),
        contentLength: rangeResponse.headers.get('content-length')
      };
    } catch (rangeError) {
      results.rangeTest = {
        error: rangeError.message
      };
    }

    // Тест 3: Попытка получить первые байты файла
    try {
      const bytesResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-1023',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (bytesResponse.ok || bytesResponse.status === 206) {
        const buffer = await bytesResponse.arrayBuffer();
        const firstBytes = new Uint8Array(buffer.slice(0, 16));
        results.bytesTest = {
          success: true,
          firstBytes: Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' '),
          isMP3: firstBytes[0] === 0x49 && firstBytes[1] === 0x44 && firstBytes[2] === 0x33, // ID3
          bufferSize: buffer.byteLength
        };
      } else {
        results.bytesTest = {
          success: false,
          status: bytesResponse.status,
          statusText: bytesResponse.statusText
        };
      }
    } catch (bytesError) {
      results.bytesTest = {
        error: bytesError.message
      };
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Error testing audio URL:', error);
    res.status(500).json({ 
      error: error.message,
      url: url 
    });
  }
} 