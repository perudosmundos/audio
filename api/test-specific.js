export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const testUrl = 'https://audio.alexbrin102.workers.dev/2025-02-19_RU.mp3';
  const fileName = '2025-02-19_RU.mp3';
  
  console.log('Test specific: Testing URL', testUrl);
  
  const results = {
    timestamp: new Date().toISOString(),
    originalUrl: testUrl,
    tests: {}
  };

  try {
    // Тест 1: Прямой доступ к оригинальной ссылке
    console.log('Test specific: Testing direct access to original URL');
    try {
      const directResponse = await fetch(testUrl, { 
        method: 'HEAD',
        timeout: 10000
      });
      
      results.tests.directOriginal = {
        available: directResponse.ok || directResponse.status === 206,
        status: directResponse.status,
        statusText: directResponse.statusText,
        headers: Object.fromEntries(directResponse.headers.entries())
      };
    } catch (error) {
      results.tests.directOriginal = {
        available: false,
        error: error.message
      };
    }

    // Тест 2: Прямой доступ через наш API
    console.log('Test specific: Testing direct API access');
    try {
      const directApiResponse = await fetch(`https://${req.headers.host}/api/direct-audio/${fileName}`, { 
        method: 'HEAD',
        timeout: 10000
      });
      
      results.tests.directAPI = {
        available: directApiResponse.ok || directApiResponse.status === 206,
        status: directApiResponse.status,
        statusText: directApiResponse.statusText,
        headers: Object.fromEntries(directApiResponse.headers.entries())
      };
    } catch (error) {
      results.tests.directAPI = {
        available: false,
        error: error.message
      };
    }

    // Тест 3: Прокси через наш API
    console.log('Test specific: Testing proxy API access');
    try {
      const proxyApiResponse = await fetch(`https://${req.headers.host}/api/audio-proxy/${fileName}`, { 
        method: 'HEAD',
        timeout: 10000
      });
      
      results.tests.proxyAPI = {
        available: proxyApiResponse.ok || proxyApiResponse.status === 206,
        status: proxyApiResponse.status,
        statusText: proxyApiResponse.statusText,
        headers: Object.fromEntries(proxyApiResponse.headers.entries())
      };
    } catch (error) {
      results.tests.proxyAPI = {
        available: false,
        error: error.message
      };
    }

    // Тест 4: Альтернативные прокси
    console.log('Test specific: Testing alternative proxies');
    const alternativeProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(testUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(testUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(testUrl)}`
    ];

    results.tests.alternativeProxies = {};

    for (let i = 0; i < alternativeProxies.length; i++) {
      const proxyUrl = alternativeProxies[i];
      const proxyName = ['allorigins', 'corsproxy', 'codetabs'][i];
      
      try {
        const proxyResponse = await fetch(proxyUrl, { 
          method: 'HEAD',
          timeout: 10000
        });
        
        results.tests.alternativeProxies[proxyName] = {
          available: proxyResponse.ok || proxyResponse.status === 206,
          status: proxyResponse.status,
          statusText: proxyResponse.statusText
        };
      } catch (error) {
        results.tests.alternativeProxies[proxyName] = {
          available: false,
          error: error.message
        };
      }
    }

    // Определяем лучший рабочий метод
    let bestMethod = null;
    if (results.tests.directOriginal.available) {
      bestMethod = 'directOriginal';
    } else if (results.tests.directAPI.available) {
      bestMethod = 'directAPI';
    } else if (results.tests.proxyAPI.available) {
      bestMethod = 'proxyAPI';
    } else {
      // Проверяем альтернативные прокси
      for (const [name, result] of Object.entries(results.tests.alternativeProxies)) {
        if (result.available) {
          bestMethod = `alternativeProxy_${name}`;
          break;
        }
      }
    }

    results.bestMethod = bestMethod;
    results.summary = {
      hasWorkingMethod: !!bestMethod,
      totalTests: Object.keys(results.tests).length,
      workingTests: Object.values(results.tests).filter(test => test.available).length
    };

    console.log('Test specific: Results', results);
    
    res.status(200).json(results);
    
  } catch (error) {
    console.error('Test specific: Error', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 