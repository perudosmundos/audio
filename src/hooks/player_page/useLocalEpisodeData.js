import { useState, useEffect, useCallback } from 'react';
import { getLocaleString } from '@/lib/locales';
import r2Service from '@/lib/r2Service';

// Локальные тестовые данные для разработки
const localEpisodeData = {
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
};

const localQuestionsData = [
  {
    id: 1,
    episode_slug: "2025-01-29_ru",
    title: "Введение",
    lang: "ru",
    time: 0,
    is_intro: true,
    created_at: "2025-01-29T10:00:00Z"
  },
  {
    id: 2,
    episode_slug: "2025-01-29_ru",
    title: "Основная медитация",
    lang: "ru",
    time: 60,
    is_intro: false,
    created_at: "2025-01-29T10:00:00Z"
  },
  {
    id: 3,
    episode_slug: "2025-01-29_ru",
    title: "Нужно ли читать книги по медитации?",
    lang: "ru",
    time: 300,
    is_intro: false,
    created_at: "2025-01-29T10:00:00Z"
  },
  {
    id: 4,
    episode_slug: "2025-01-29_ru",
    title: "Искусственный интеллект и медитация",
    lang: "ru",
    time: 600,
    is_intro: false,
    created_at: "2025-01-29T10:00:00Z"
  },
  {
    id: 5,
    episode_slug: "2025-01-29_ru",
    title: "Управление стрессом",
    lang: "ru",
    time: 900,
    is_intro: false,
    created_at: "2025-01-29T10:00:00Z"
  }
];

const localTranscriptData = {
  utterances: [
    {
      id: "1",
      start: 0,
      end: 60,
      text: "Добро пожаловать в медитацию 29 января. Сегодня мы будем практиковать осознанное дыхание.",
      speaker: "A"
    },
    {
      id: "2",
      start: 60,
      end: 120,
      text: "Начните с удобного положения. Закройте глаза и сделайте глубокий вдох.",
      speaker: "A"
    }
  ],
  status: "completed"
};

const useLocalEpisodeData = (episodeSlug, currentLanguage, toast) => {
  const [episodeData, setEpisodeData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionsUpdatedId, setQuestionsUpdatedId] = useState(Date.now());

  const fetchTranscriptForEpisode = useCallback(async (epSlug, langForTranscript) => {
    try {
      // Имитируем задержку сети
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (epSlug === "2025-01-29_ru" && langForTranscript === "ru") {
        setTranscript(localTranscriptData);
      } else {
        setTranscript(null);
      }
    } catch (err) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Error fetching transcript: ${err.message}`, variant: 'destructive' });
      setTranscript(null);
    }
  }, [currentLanguage, toast]);

  const fetchQuestionsForEpisode = useCallback(async (epSlug, langForQuestions) => {
    try {
      // Имитируем задержку сети
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (epSlug === "2025-01-29_ru" && langForQuestions === "ru") {
        let fetchedQuestions = localQuestionsData;
        const hasIntro = fetchedQuestions.some(q => q.is_intro && q.time === 0);

        if (!hasIntro) {
          const introQuestion = {
            id: 'intro-virtual', 
            time: 0,
            title: getLocaleString('introQuestion', langForQuestions),
            lang: langForQuestions,
            is_intro: true,
            is_full_transcript: false,
            episode_slug: epSlug,
            created_at: new Date().toISOString()
          };
          fetchedQuestions = [introQuestion, ...fetchedQuestions];
        }
        
        setQuestions(fetchedQuestions);
        setQuestionsUpdatedId(Date.now());
      } else {
        setQuestions([]);
      }
    } catch (err) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorFetchingQuestions', currentLanguage, {errorMessage: err.message}), variant: 'destructive' });
      setQuestions([]);
    }
  }, [currentLanguage, toast]);

  const fetchEpisodeDetails = useCallback(async () => {
    if (!episodeSlug) return;
    console.log('useLocalEpisodeData: Fetching episode details for', episodeSlug);
    setLoading(true);
    setError(null);
    
    try {
      // Имитируем задержку сети
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let episode = null;
      if (episodeSlug === "2025-01-29_ru") {
        episode = localEpisodeData;
      } else {
        console.warn('Episode not found:', episodeSlug);
        setError(getLocaleString('episodeNotFound', currentLanguage));
        setLoading(false);
        return;
      }
      
      console.log('useLocalEpisodeData: Episode data loaded', { 
        slug: episode.slug, 
        title: episode.title, 
        audio_url: episode.audio_url,
        r2_object_key: episode.r2_object_key,
        r2_bucket_name: episode.r2_bucket_name
      });
      
      let finalAudioUrl = await r2Service.getCompatibleUrl(
        episode.audio_url, 
        episode.r2_object_key, 
        episode.r2_bucket_name
      );
      console.log('useLocalEpisodeData: Generated compatible URL', finalAudioUrl);
      
      setEpisodeData({...episode, audio_url: finalAudioUrl});
      
      const langForContent = episode.lang === 'all' ? currentLanguage : episode.lang;
      await fetchQuestionsForEpisode(episode.slug, langForContent);
      await fetchTranscriptForEpisode(episode.slug, langForContent);

    } catch (err) {
      console.error('useLocalEpisodeData: Error fetching episode', err);
      setError(err.message);
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [episodeSlug, currentLanguage, toast, fetchQuestionsForEpisode, fetchTranscriptForEpisode]);

  useEffect(() => {
    fetchEpisodeDetails();
  }, [fetchEpisodeDetails]);
  
  useEffect(() => {
    if (episodeData && episodeData.lang === 'all') {
        fetchQuestionsForEpisode(episodeData.slug, currentLanguage);
        fetchTranscriptForEpisode(episodeData.slug, currentLanguage);
    }
  }, [currentLanguage, episodeData, fetchQuestionsForEpisode, fetchTranscriptForEpisode]);

  return {
    episodeData,
    questions,
    transcript,
    loading,
    error,
    questionsUpdatedId,
    fetchEpisodeDetails,
    fetchQuestionsForEpisode,
    fetchTranscriptForEpisode,
    setTranscript,
    setQuestions,
    setQuestionsUpdatedId
  };
};

export default useLocalEpisodeData; 