export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const testUrl = 'https://audio.alexbrin102.workers.dev/test.mp3';
  const results = {};

  // Список прокси для тестирования
  const proxies = [
    {
      name: 'Direct Cloudflare Worker',
      url: testUrl,
      type: 'direct'
    },
    {
      name: 'API AllOrigins',
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(testUrl)}`,
      type: 'cors-proxy'
    },
    {
      name: 'CorsProxy.io',
      url: `https://corsproxy.io/?${encodeURIComponent(testUrl)}`,
      type: 'cors-proxy'
    },
    {
      name: 'ThingProxy',
      url: `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(testUrl)}`,
      type: 'cors-proxy'
    },
    {
      name: 'CORS Anywhere',
      url: `https://cors-anywhere.herokuapp.com/${testUrl}`,
      type: 'cors-proxy'
    },
    {
      name: 'CodeTabs Proxy',
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(testUrl)}`,
      type: 'cors-proxy'
    }
  ];

  console.log('Testing proxy availability...');

  for (const proxy of proxies) {
    try {
      const startTime = Date.now();
      
      const response = await fetch(proxy.url, {
        method: 'HEAD',
        timeout: 5000,
        signal: AbortSignal.timeout(5000)
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      results[proxy.name] = {
        available: response.ok || response.status === 206,
        status: response.status,
        responseTime: responseTime,
        type: proxy.type,
        headers: {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length'),
          'accept-ranges': response.headers.get('accept-ranges'),
          'access-control-allow-origin': response.headers.get('access-control-allow-origin')
        }
      };
      
      console.log(`${proxy.name}: ${results[proxy.name].available ? 'OK' : 'FAIL'} (${responseTime}ms)`);
      
    } catch (error) {
      results[proxy.name] = {
        available: false,
        error: error.message,
        type: proxy.type,
        responseTime: null
      };
      
      console.log(`${proxy.name}: FAIL - ${error.message}`);
    }
  }

  // Подсчитываем статистику
  const availableProxies = Object.values(results).filter(r => r.available);
  const totalProxies = proxies.length;
  
  const summary = {
    total: totalProxies,
    available: availableProxies.length,
    successRate: Math.round((availableProxies.length / totalProxies) * 100),
    bestProxy: availableProxies.length > 0 
      ? availableProxies.reduce((best, current) => 
          current.responseTime < best.responseTime ? current : best
        )
      : null
  };

  res.status(200).json({
    timestamp: new Date().toISOString(),
    summary,
    results
  });
} 