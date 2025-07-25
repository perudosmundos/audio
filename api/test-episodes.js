// Простая версия для локального тестирования
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Возвращаем тестовые данные
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

    res.status(200).json({
      totalEpisodes: testEpisodes.length,
      episodes: testEpisodes,
      note: "Это тестовые данные. В продакшене здесь будет реальный список из базы данных."
    });

  } catch (error) {
    console.error('Error in test-episodes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch episodes',
      details: error.message
    });
  }
} 