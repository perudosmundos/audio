import axios from 'axios';

const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

const getApiKey = () => {
  // Prefer server-side secret
  return process.env.ASSEMBLYAI_API_KEY || process.env.VITE_ASSEMBLYAI_API_KEY || '';
};

export default async function handler(req, res) {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: 'AssemblyAI API key is not configured on the server.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const id = (req.query.id || '').toString();
      if (!id) {
        res.status(400).json({ error: 'Missing transcript id' });
        return;
      }
      const response = await axios.get(`${ASSEMBLYAI_API_URL}/transcript/${encodeURIComponent(id)}`, {
        headers: { authorization: apiKey },
        timeout: 25000,
      });
      res.status(200).json(response.data);
      return;
    }

    if (req.method === 'POST') {
      // Proxy transcript submission
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body || !body.audio_url) {
        res.status(400).json({ error: 'Missing audio_url in body' });
        return;
      }
      const response = await axios.post(`${ASSEMBLYAI_API_URL}/transcript`, body, {
        headers: { authorization: apiKey, 'content-type': 'application/json' },
        timeout: 25000,
      });
      res.status(200).json(response.data);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message || 'Proxy error' };
    res.status(status).json(data);
  }
}



