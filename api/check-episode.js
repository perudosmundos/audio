// Простая версия без импортов для совместимости с Vercel
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  
  if (!slug) {
    return res.status(400).json({ error: 'Slug parameter is required' });
  }

  try {
    // Используем fetch для запроса к Supabase
    const supabaseUrl = 'https://bqjqjqjqjqjqjqjqjqj.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxanFqcWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NzI5NzQsImV4cCI6MjA1MTU0ODk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

    // Ищем эпизод по точному slug
    const exactResponse = await fetch(`${supabaseUrl}/rest/v1/episodes?slug=eq.${encodeURIComponent(slug)}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const exactData = await exactResponse.json();
    const exactEpisode = exactData.length > 0 ? exactData[0] : null;

    // Если точного совпадения нет, ищем похожие
    let similarEpisodes = [];
    if (!exactEpisode) {
      const similarResponse = await fetch(`${supabaseUrl}/rest/v1/episodes?slug=ilike.%25${encodeURIComponent(slug)}%25&select=*&limit=10`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      similarEpisodes = await similarResponse.json();
    }

    // Получаем все эпизоды с похожей датой
    const datePart = slug.split('_')[0];
    const dateResponse = await fetch(`${supabaseUrl}/rest/v1/episodes?slug=ilike.${encodeURIComponent(datePart)}%25&select=*&limit=10`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    const dateEpisodes = await dateResponse.json();

    res.status(200).json({
      requestedSlug: slug,
      exactMatch: exactEpisode,
      similarEpisodes,
      episodesWithSameDate: dateEpisodes || [],
      allEpisodes: exactEpisode ? [exactEpisode] : similarEpisodes
    });

  } catch (error) {
    console.error('Error checking episode:', error);
    res.status(500).json({ 
      error: 'Failed to check episode',
      details: error.message
    });
  }
} 