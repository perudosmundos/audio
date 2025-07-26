import { useState, useEffect, useCallback } from 'react';

// Локальные тестовые данные для разработки
const localEpisodesData = [
  {
    slug: "2025-01-29_ru",
    title: "", // Пустой title, будет сгенерирован из date
    lang: "ru",
    date: "2025-01-29",
    r2_object_key: "2025-01-29_ru",
    r2_bucket_name: "audio-files",
    audio_url: "https://audio.alexbrin102.workers.dev/2025-01-29_ru",
    duration: 1800,
    created_at: "2025-01-29T10:00:00Z",
    file_has_lang_suffix: true
  },
  {
    slug: "2025-01-29_es",
    title: "", // Пустой title, будет сгенерирован из date
    lang: "es",
    date: "2025-01-29",
    r2_object_key: "2025-01-29_es",
    r2_bucket_name: "audio-files",
    audio_url: "https://audio.alexbrin102.workers.dev/2025-01-29_es",
    duration: 1800,
    created_at: "2025-01-29T10:00:00Z",
    file_has_lang_suffix: true
  },
  {
    slug: "2025-01-28_ru",
    title: "", // Пустой title, будет сгенерирован из date
    lang: "ru",
    date: "2025-01-28",
    r2_object_key: "2025-01-28_ru",
    r2_bucket_name: "audio-files",
    audio_url: "https://audio.alexbrin102.workers.dev/2025-01-28_ru",
    duration: 1800,
    created_at: "2025-01-28T10:00:00Z",
    file_has_lang_suffix: true
  }
];

const localQuestionsData = [
  {
    id: 1,
    episode_slug: "2025-01-29_ru",
    title: "Введение в медитацию",
    lang: "ru",
    time: 0,
    is_intro: true,
    created_at: "2025-01-29T10:00:00Z"
  },
  {
    id: 2,
    episode_slug: "2025-01-29_ru",
    title: "Основные принципы осознанности",
    lang: "ru",
    time: 120,
    is_intro: false,
    created_at: "2025-01-29T10:05:00Z"
  },
  {
    id: 3,
    episode_slug: "2025-01-29_ru",
    title: "Техника дыхания",
    lang: "ru",
    time: 300,
    is_intro: false,
    created_at: "2025-01-29T10:10:00Z"
  },
  {
    id: 4,
    episode_slug: "2025-01-29_es",
    title: "Introducción a la meditación",
    lang: "es",
    time: 0,
    is_intro: true,
    created_at: "2025-01-29T10:00:00Z"
  },
  {
    id: 5,
    episode_slug: "2025-01-29_es",
    title: "Principios básicos de la atención plena",
    lang: "es",
    time: 120,
    is_intro: false,
    created_at: "2025-01-29T10:05:00Z"
  },
  {
    id: 6,
    episode_slug: "2025-01-28_ru",
    title: "Введение в практику",
    lang: "ru",
    time: 0,
    is_intro: true,
    created_at: "2025-01-28T10:00:00Z"
  },
  {
    id: 7,
    episode_slug: "2025-01-28_ru",
    title: "Работа с мыслями",
    lang: "ru",
    time: 180,
    is_intro: false,
    created_at: "2025-01-28T10:03:00Z"
  }
];

export const useLocalEpisodes = (currentLanguage) => {
  const [episodes, setEpisodes] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [episodeQuestionsCount, setEpisodeQuestionsCount] = useState({});

  const fetchEpisodesAndData = useCallback(async () => {
    console.log('useLocalEpisodes: Starting fetch for language:', currentLanguage);
    setLoading(true);
    setError(null);
    
    try {
      // Имитируем задержку сети
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Фильтруем эпизоды по языку
      const langFilteredEpisodes = localEpisodesData.filter(ep => 
        ep.lang === currentLanguage || ep.lang === 'all'
      );
      
      console.log('useLocalEpisodes: Filtered episodes:', langFilteredEpisodes.length);
      
      // Фильтруем вопросы по языку
      const langFilteredQuestions = localQuestionsData.filter(q => 
        q.lang === currentLanguage || q.lang === 'all'
      );
      
      console.log('useLocalEpisodes: Filtered questions:', langFilteredQuestions.length);
      
      setAllQuestions(langFilteredQuestions);
      
      // Подсчитываем количество вопросов для каждого эпизода
      const counts = {};
      const years = new Set();
      
      langFilteredEpisodes.forEach(ep => {
        if (ep.date) {
          years.add(new Date(ep.date).getFullYear().toString());
        }
        counts[ep.slug] = counts[ep.slug] || {};
        ['ru', 'es', 'en'].forEach(lang => {
           counts[ep.slug][lang] = langFilteredQuestions.filter(q => 
             q.episode_slug === ep.slug && q.lang === lang
           ).length;
        });
      });
      
      setEpisodeQuestionsCount(counts);
      setEpisodes(langFilteredEpisodes);
      
      console.log('useLocalEpisodes: Data loaded successfully');
      console.log('useLocalEpisodes: Episodes:', langFilteredEpisodes);
      console.log('useLocalEpisodes: Questions:', langFilteredQuestions);
      
    } catch (err) {
      console.error('useLocalEpisodes: Error:', err);
      setError(`Ошибка загрузки локальных данных: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentLanguage]);

  useEffect(() => {
    fetchEpisodesAndData();
  }, [fetchEpisodesAndData]);

  return {
    episodes,
    allQuestions,
    loading,
    error,
    episodeQuestionsCount,
    fetchEpisodesAndData
  };
}; 