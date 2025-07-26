import { useState, useEffect, useCallback } from 'react';

// Локальные тестовые данные для разработки
const localEpisodesData = [
  {
    slug: "2025-01-29_ru",
    title: "Медитация 29 января",
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
    title: "Meditación 29 de enero",
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
    title: "Медитация 28 января",
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
    title: "Введение",
    lang: "ru",
    time: 0,
    is_intro: true
  },
  {
    id: 2,
    episode_slug: "2025-01-29_ru",
    title: "Основная медитация",
    lang: "ru",
    time: 60,
    is_intro: false
  },
  {
    id: 3,
    episode_slug: "2025-01-29_es",
    title: "Introducción",
    lang: "es",
    time: 0,
    is_intro: true
  },
  {
    id: 4,
    episode_slug: "2025-01-29_es",
    title: "Meditación principal",
    lang: "es",
    time: 60,
    is_intro: false
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