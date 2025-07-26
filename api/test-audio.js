export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    console.log('Test audio: Testing URL', url);
    
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 10000
    });

    const isAvailable = response.ok || response.status === 206;
    
    const result = {
      url,
      available: isAvailable,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString()
    };

    console.log('Test audio: Result', result);
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Test audio: Error testing URL', error);
    
    res.status(500).json({
      url,
      available: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 