// Простая версия для локального тестирования
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  
  if (!slug) {
    return res.status(400).json({ error: 'Slug parameter is required' });
  }

  try {
    // Тестовые данные
    const testEpisodes = [
      {
        slug: "2025-01-29_ru",
        title: "Медитация 29 января",
        lang: "ru",
        date: "2025-01-29",
        r2_object_key: "2025-01-29_ru",
        r2_bucket_name: "audio-files",
        audio_url: "https://audio.alexbrin102.workers.dev/2025-01-29_ru"
      },
      {
        slug: "2025-01-29_es",
        title: "Meditación 29 de enero",
        lang: "es",
        date: "2025-01-29",
        r2_object_key: "2025-01-29_es",
        r2_bucket_name: "audio-files",
        audio_url: "https://audio.alexbrin102.workers.dev/2025-01-29_es"
      },
      {
        slug: "2025-01-28_ru",
        title: "Медитация 28 января",
        lang: "ru",
        date: "2025-01-28",
        r2_object_key: "2025-01-28_ru",
        r2_bucket_name: "audio-files",
        audio_url: "https://audio.alexbrin102.workers.dev/2025-01-28_ru"
      }
    ];

    // Ищем точное совпадение
    const exactEpisode = testEpisodes.find(ep => ep.slug === slug);
    
    // Ищем похожие эпизоды
    const similarEpisodes = testEpisodes.filter(ep => 
      ep.slug.toLowerCase().includes(slug.toLowerCase()) && ep.slug !== slug
    );
    
    // Ищем эпизоды с той же датой
    const datePart = slug.split('_')[0];
    const dateEpisodes = testEpisodes.filter(ep => 
      ep.slug.startsWith(datePart) && ep.slug !== slug
    );

    res.status(200).json({
      requestedSlug: slug,
      exactMatch: exactEpisode,
      similarEpisodes,
      episodesWithSameDate: dateEpisodes,
      allEpisodes: exactEpisode ? [exactEpisode] : similarEpisodes,
      note: "Это тестовые данные. В продакшене здесь будет реальный поиск в базе данных."
    });

  } catch (error) {
    console.error('Error checking episode:', error);
    res.status(500).json({ 
      error: 'Failed to check episode',
      details: error.message
    });
  }
} 