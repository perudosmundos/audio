export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, episodeData, audioFileUrl } = req.body;

    if (!accessToken || !episodeData || !audioFileUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // First, we need to create a show (podcast) if it doesn't exist
    // Note: Spotify doesn't have a direct API for podcast uploads
    // We'll use their Web API to create a show and then provide instructions

    // Check if user has any shows
    const showsResponse = await fetch('https://api.spotify.com/v1/me/shows', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!showsResponse.ok) {
      return res.status(400).json({ 
        error: 'Failed to fetch shows',
        details: 'Spotify requires manual show creation first'
      });
    }

    const showsData = await showsResponse.json();

    // For now, return instructions since Spotify doesn't support direct podcast uploads
    res.status(200).json({
      success: true,
      message: 'Spotify requires manual setup for podcast shows',
      instructions: [
        '1. Go to https://podcasters.spotify.com/',
        '2. Create a new show (podcast)',
        '3. Add your RSS feed or upload episodes manually',
        '4. Your episodes will automatically appear in Spotify'
      ],
      shows: showsData.shows || [],
      episodeData: episodeData
    });

  } catch (error) {
    console.error('Spotify upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
