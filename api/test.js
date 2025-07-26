export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  console.log('Audio test: Testing URL', url);

  const results = {
    originalUrl: url,
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Тест 1: Прямой доступ
    console.log('Audio test: Testing direct access');
    try {
      const directResponse = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'audio/*, */*'
        },
        timeout: 10000
      });

      results.tests.direct = {
        accessible: directResponse.ok || directResponse.status === 206,
        status: directResponse.status,
        statusText: directResponse.statusText,
        headers: Object.fromEntries(directResponse.headers.entries())
      };
    } catch (error) {
      results.tests.direct = {
        accessible: false,
        error: error.message
      };
    }

    // Тест 2: Range запрос
    if (results.tests.direct.accessible) {
      console.log('Audio test: Testing Range request');
      try {
        const rangeResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'audio/*, */*',
            'Range': 'bytes=0-1023'
          },
          timeout: 10000
        });

        results.tests.range = {
          supported: rangeResponse.status === 206,
          status: rangeResponse.status,
          statusText: rangeResponse.statusText,
          contentRange: rangeResponse.headers.get('content-range'),
          contentLength: rangeResponse.headers.get('content-length')
        };
      } catch (error) {
        results.tests.range = {
          supported: false,
          error: error.message
        };
      }
    }

    // Тест 3: Прокси доступ (если это Cloudflare Worker)
    if (url.includes('alexbrin102.workers.dev')) {
      console.log('Audio test: Testing proxy access');
      
      const urlObj = new URL(url);
      const filePath = urlObj.pathname.substring(1);
      const isSecondary = url.includes('audio-secondary.alexbrin102.workers.dev');
      const proxyPath = isSecondary ? 'audio-secondary-proxy' : 'audio-proxy';
      
      const proxyUrl = `${req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000'}/api/${proxyPath}/${filePath}`;
      
      try {
        const proxyResponse = await fetch(proxyUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });

        results.tests.proxy = {
          accessible: proxyResponse.ok || proxyResponse.status === 206,
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          proxiedUrl: proxyUrl
        };
      } catch (error) {
        results.tests.proxy = {
          accessible: false,
          error: error.message,
          proxiedUrl: proxyUrl
        };
      }
    }

    // Тест 4: CORS заголовки
    if (results.tests.direct.accessible) {
      results.tests.cors = {
        hasCorsHeaders: !!results.tests.direct.headers['access-control-allow-origin'],
        corsOrigin: results.tests.direct.headers['access-control-allow-origin'],
        hasRangeHeaders: !!results.tests.direct.headers['accept-ranges']
      };
    }

    // Общий результат
    results.summary = {
      directAccess: results.tests.direct.accessible,
      rangeSupport: results.tests.range?.supported || false,
      proxyAccess: results.tests.proxy?.accessible || false,
      corsEnabled: results.tests.cors?.hasCorsHeaders || false
    };

    console.log('Audio test: Results', results);
    res.status(200).json(results);

  } catch (error) {
    console.error('Audio test: Error during testing', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      originalUrl: url
    });
  }
} 