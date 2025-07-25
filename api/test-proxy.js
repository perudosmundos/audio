export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const testUrls = [
    'https://audio.alexbrin102.workers.dev/test.mp3',
    'https://audio-secondary.alexbrin102.workers.dev/test.mp3',
    'https://cors-anywhere.herokuapp.com/https://audio.alexbrin102.workers.dev/test.mp3',
    'https://api.allorigins.win/raw?url=https://audio.alexbrin102.workers.dev/test.mp3',
    'https://corsproxy.io/?https://audio.alexbrin102.workers.dev/test.mp3',
    'https://thingproxy.freeboard.io/fetch/https://audio.alexbrin102.workers.dev/test.mp3',
    'https://api.codetabs.com/v1/proxy?quest=https://audio.alexbrin102.workers.dev/test.mp3',
    'https://cors.bridged.cc/https://audio.alexbrin102.workers.dev/test.mp3'
  ];

  const results = [];

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    const result = {
      url,
      index: i,
      success: false,
      status: null,
      error: null,
      responseTime: null,
      headers: null
    };

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);
      const endTime = Date.now();

      result.responseTime = endTime - startTime;
      result.status = response.status;
      result.headers = Object.fromEntries(response.headers.entries());

      // Считаем успешным если статус 200, 404 (файл не найден, но сервер работает) или 206
      if (response.status === 200 || response.status === 404 || response.status === 206) {
        result.success = true;
      } else if (response.status === 403 || response.status === 429) {
        result.error = `Blocked/Rate limited (${response.status})`;
      } else {
        result.error = `HTTP ${response.status}`;
      }

    } catch (error) {
      result.error = error.message;
      if (error.name === 'AbortError') {
        result.error = 'Timeout (10s)';
      }
    }

    results.push(result);
  }

  // Анализ результатов
  const workingProxies = results.filter(r => r.success);
  const blockedProxies = results.filter(r => !r.success && r.status === 403);
  const timeoutProxies = results.filter(r => r.error && r.error.includes('Timeout'));

  const analysis = {
    total: results.length,
    working: workingProxies.length,
    blocked: blockedProxies.length,
    timeouts: timeoutProxies.length,
    recommendations: []
  };

  if (workingProxies.length === 0) {
    analysis.recommendations.push('All proxies are blocked or unavailable. Consider using a VPN or alternative hosting.');
  } else if (workingProxies.length < 3) {
    analysis.recommendations.push('Limited proxy availability. Some proxies may be rate-limited.');
  } else {
    analysis.recommendations.push('Good proxy availability. Multiple working proxies found.');
  }

  if (blockedProxies.length > 0) {
    analysis.recommendations.push(`${blockedProxies.length} proxies are blocked (403). This may indicate regional blocking.`);
  }

  if (timeoutProxies.length > 0) {
    analysis.recommendations.push(`${timeoutProxies.length} proxies are timing out. Network connectivity issues may exist.`);
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    results,
    analysis,
    summary: {
      workingProxies: workingProxies.map(r => r.url),
      fastestProxy: workingProxies.length > 0 ? 
        workingProxies.reduce((fastest, current) => 
          current.responseTime < fastest.responseTime ? current : fastest
        ).url : null
    }
  });
} 