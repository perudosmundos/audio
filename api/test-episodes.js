// Простой тест для проверки эпизодов в базе данных
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = 'https://bqjqjqjqjqjqjqjqjqj.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxanFqcWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NzI5NzQsImV4cCI6MjA1MTU0ODk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

    // Получаем все эпизоды
    const response = await fetch(`${supabaseUrl}/rest/v1/episodes?select=*&order=created_at.desc&limit=20`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status} ${response.statusText}`);
    }

    const episodes = await response.json();

    res.status(200).json({
      totalEpisodes: episodes.length,
      episodes: episodes.map(ep => ({
        slug: ep.slug,
        title: ep.title,
        lang: ep.lang,
        date: ep.date,
        r2_object_key: ep.r2_object_key,
        r2_bucket_name: ep.r2_bucket_name,
        audio_url: ep.audio_url
      }))
    });

  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch episodes',
      details: error.message
    });
  }
} 