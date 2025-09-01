export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { client_id, redirect_uri } = req.query;
    
    if (!client_id) {
      return res.status(400).json({ error: 'Missing client_id parameter' });
    }

    // Простая проверка формата Client ID
    if (!/^[a-zA-Z0-9]{32}$/.test(client_id)) {
      return res.status(400).json({ 
        error: 'Invalid client_id format. Expected 32 character alphanumeric string.',
        received: client_id,
        length: client_id.length
      });
    }

    // Формируем тестовый URL для проверки
    const testUrl = `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=code&redirect_uri=${encodeURIComponent(redirect_uri || 'https://dosmundos-podcast.vercel.app/spotify-upload')}&scope=user-read-private%20user-read-email`;

    res.status(200).json({
      success: true,
      message: 'Client ID format is valid',
      testUrl: testUrl,
      clientId: client_id,
      redirectUri: redirect_uri || 'https://dosmundos-podcast.vercel.app/spotify-upload'
    });

  } catch (error) {
    console.error('Spotify test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
