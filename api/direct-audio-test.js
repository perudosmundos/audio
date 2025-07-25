export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { file } = req.query;
  
  if (!file) {
    return res.status(400).json({ error: 'File parameter is required' });
  }

  // Тестируем прямые URL без прокси
  const testUrls = [
    `https://audio.alexbrin102.workers.dev/${file}`,
    `https://audio-secondary.alexbrin102.workers.dev/${file}`,
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
      headers: null,
      contentType: null
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
      result.contentType = response.headers.get('content-type');

      if (response.status === 200 || response.status === 206) {
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

  res.status(200).json({
    timestamp: new Date().toISOString(),
    file,
    results,
    summary: {
      working: results.filter(r => r.success).length,
      total: results.length
    }
  });
} 