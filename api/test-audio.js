export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const testFile = '2025-01-22_ES.mp3';
  const directUrl = `https://audio.alexbrin102.workers.dev/${testFile}`;
  const proxiedUrl = `${req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000'}/api/audio-proxy/${testFile}`;

  try {
    // Тест 1: Прямой доступ к Cloudflare Worker
    console.log('Testing direct access to Cloudflare Worker...');
    const directResponse = await fetch(directUrl, { method: 'HEAD' });
    const directStatus = directResponse.status;
    const directHeaders = Object.fromEntries(directResponse.headers.entries());

    // Тест 2: Доступ через наш прокси
    console.log('Testing access through our proxy...');
    const proxyResponse = await fetch(proxiedUrl, { method: 'HEAD' });
    const proxyStatus = proxyResponse.status;
    const proxyHeaders = Object.fromEntries(proxyResponse.headers.entries());

    // Тест 3: Проверка CORS заголовков
    const corsHeaders = {
      'Access-Control-Allow-Origin': proxyHeaders['access-control-allow-origin'],
      'Access-Control-Allow-Methods': proxyHeaders['access-control-allow-methods'],
      'Access-Control-Allow-Headers': proxyHeaders['access-control-allow-headers'],
      'Content-Type': proxyHeaders['content-type'],
      'Accept-Ranges': proxyHeaders['accept-ranges']
    };

    res.status(200).json({
      timestamp: new Date().toISOString(),
      testFile,
      results: {
        direct: {
          url: directUrl,
          status: directStatus,
          headers: directHeaders,
          accessible: directStatus === 200 || directStatus === 206
        },
        proxy: {
          url: proxiedUrl,
          status: proxyStatus,
          headers: proxyHeaders,
          corsHeaders,
          accessible: proxyStatus === 200 || proxyStatus === 206
        }
      },
      summary: {
        directWorks: directStatus === 200 || directStatus === 206,
        proxyWorks: proxyStatus === 200 || proxyStatus === 206,
        corsSupported: !!corsHeaders['Access-Control-Allow-Origin'],
        rangeSupported: !!corsHeaders['Accept-Ranges']
      }
    });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      error: 'Test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 