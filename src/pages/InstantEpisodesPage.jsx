import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import EpisodesList from '@/components/episodes/EpisodesList';
import EpisodesPageHeader from '@/components/episodes/EpisodesPageHeader';
import FilterAndSearchControls from '@/components/episodes/FilterAndSearchControls';
import EmptyState from '@/components/episodes/EmptyState';
import cacheIntegration from '@/lib/cacheIntegration';

const InstantEpisodesPage = ({ currentLanguage, onLanguageChange }) => {
  const [episodes, setEpisodes] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [loading, setLoading] = useState(false); // Только для индикатора обновления
  const [error, setError] = useState(null);
  const [episodeQuestionsCount, setEpisodeQuestionsCount] = useState({});

  const [availableYears, setAvailableYears] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const monthLabels = [
    "january", "february", "march", "april", "may", "june", 
    "july", "august", "september", "october", "november", "december"
  ];

  const hasInitialized = useRef(false);

  // Обработка данных эпизодов
  const processEpisodesData = useCallback(async (episodesData, fromCache = false, questionsData = null) => {
    const langFilteredEpisodes = episodesData.filter(ep => 
      ep.lang === currentLanguage || ep.lang === 'all'
    );
    
    // Если вопросы не переданы и данные из кэша, загружаем вопросы в фоне
    if (!questionsData && fromCache) {
      // Сразу показываем эпизоды без вопросов
      const counts = {};
      const years = new Set();
      langFilteredEpisodes.forEach(ep => {
        if (ep.date) {
          years.add(new Date(ep.date).getFullYear().toString());
        }
        counts[ep.slug] = counts[ep.slug] || {};
        ['ru', 'es', 'en', 'de', 'fr', 'pl'].forEach(lang => {
          counts[ep.slug][lang] = 0; // Временно 0, обновим позже
        });
      });
      
      setAvailableYears(Array.from(years).sort((a,b) => Number(b) - Number(a)));
      setEpisodeQuestionsCount(counts);
      setEpisodes(langFilteredEpisodes);
      setAllQuestions([]);

      // Загружаем вопросы в фоне
      loadQuestionsInBackground(langFilteredEpisodes);
      
      console.log('✅ Data processed instantly (episodes only):', {
        episodes: langFilteredEpisodes.length,
        fromCache
      });
      return;
    }

    // Если вопросы переданы, обрабатываем полные данные
    const counts = {};
    const years = new Set();
    langFilteredEpisodes.forEach(ep => {
      if (ep.date) {
        years.add(new Date(ep.date).getFullYear().toString());
      }
      counts[ep.slug] = counts[ep.slug] || {};
      ['ru', 'es', 'en', 'de', 'fr', 'pl'].forEach(lang => {
         const episodeQuestions = (questionsData || []).filter(q => 
           q.episode_slug === ep.slug && 
           q.lang === lang && 
           (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
         );
         // Сортируем вопросы по времени
         episodeQuestions.sort((a, b) => (a.time || 0) - (b.time || 0));
         counts[ep.slug][lang] = episodeQuestions.length;
      });
    });
    
    setAvailableYears(Array.from(years).sort((a,b) => Number(b) - Number(a)));
    setEpisodeQuestionsCount(counts);
    setEpisodes(langFilteredEpisodes);
    setAllQuestions(questionsData || []);

    console.log('✅ Data processed instantly (full):', {
      episodes: langFilteredEpisodes.length,
      questions: (questionsData || []).length,
      fromCache
    });
  }, [currentLanguage]);

  // Загрузка свежих данных
  const loadFreshData = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select('slug, title, lang, audio_url, duration, date, created_at, file_has_lang_suffix, r2_object_key, r2_bucket_name')
        .order('date', { ascending: false });

      if (episodesError) throw episodesError;
      
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('episode_slug, id, title, lang, time')
        .order('time', { ascending: true }); 
      
      if (questionsError) throw questionsError;

      // Сохраняем в кэш
      await cacheIntegration.saveEpisodesPageData(episodesData, questionsData);

      await processEpisodesData(episodesData, false, questionsData);
      
    } catch (err) {
      console.error('❌ Error loading fresh data:', err);
      setError(getLocaleString('errorFetchingEpisodes', currentLanguage, { errorMessage: err.message }));
    } finally {
      setLoading(false);
    }
  }, [currentLanguage]);

  // Фоновая загрузка свежих данных
  const loadFreshDataInBackground = useCallback(async () => {
    try {
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select('slug, title, lang, audio_url, duration, date, created_at, file_has_lang_suffix, r2_object_key, r2_bucket_name')
        .order('date', { ascending: false });

      if (!episodesError && episodesData) {
        const { data: questionsData } = await supabase
          .from('questions')
          .select('episode_slug, id, title, lang, time')
          .order('time', { ascending: true });

        // Обновляем кэш в фоне
        await cacheIntegration.saveEpisodesPageData(episodesData, questionsData);
        
        // Обновляем UI если данные изменились
        if (episodesData.length !== episodes.length) {
          await processEpisodesData(episodesData, false, questionsData);
        }
        
        console.log('🔄 Background data refresh completed');
      }
    } catch (err) {
      console.debug('Background refresh failed:', err);
    }
  }, [currentLanguage]);

  // Фоновая загрузка вопросов
  const loadQuestionsInBackground = async (episodesList) => {
    try {
      const allQuestions = [];
      
      for (const episode of episodesList) {
        for (const lang of ['ru', 'es', 'en', 'de', 'fr', 'pl']) {
          const cachedQuestions = await cacheIntegration.loadPlayerPageData(episode.slug, currentLanguage);
          if (cachedQuestions.questions) {
            allQuestions.push(...cachedQuestions.questions);
          }
        }
      }
      
      // Обновляем счетчики вопросов
      updateQuestionsCount(episodesList, allQuestions);
      setAllQuestions(allQuestions);
      
      console.log('✅ Background questions loaded:', allQuestions.length);
    } catch (err) {
      console.debug('Background questions loading failed:', err);
    }
  };

  // Обновление счетчика вопросов
  const updateQuestionsCount = (episodesList, questionsList) => {
    const counts = {};
    episodesList.forEach(ep => {
      counts[ep.slug] = counts[ep.slug] || {};
      ['ru', 'es', 'en', 'de', 'fr', 'pl'].forEach(lang => {
         const episodeQuestions = (questionsList || []).filter(q => 
           q.episode_slug === ep.slug && 
           q.lang === lang && 
           (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
         );
         // Сортируем вопросы по времени
         episodeQuestions.sort((a, b) => (a.time || 0) - (b.time || 0));
         counts[ep.slug][lang] = episodeQuestions.length;
      });
    });
    setEpisodeQuestionsCount(counts);
  };

  // Мгновенная загрузка данных - сначала показываем интерфейс, потом подгружаем данные
  const loadDataInstantly = useCallback(async () => {
    console.log('🚀 Instant loading started - showing UI immediately');
    
    try {
      // Сначала пытаемся загрузить из кэша мгновенно
      const cachedData = await cacheIntegration.loadEpisodesPageData(currentLanguage);
      
      if (cachedData && cachedData.episodes.length > 0) {
        console.log('📦 Using cached data instantly:', cachedData.episodes.length);
        await processEpisodesData(cachedData.episodes, true);
        
        // Загружаем свежие данные в фоне
        loadFreshDataInBackground();
        return;
      }

      // Если кэша нет, показываем пустой интерфейс и загружаем в фоне
      console.log('🔄 No cache found, loading fresh data in background');
      loadFreshData();
      
    } catch (err) {
      console.error('❌ Error in instant loading:', err);
      // Не показываем ошибку пользователю - просто логируем
    }
  }, [currentLanguage, loadFreshData, loadFreshDataInBackground, processEpisodesData]);

  // Основной эффект загрузки - запускается один раз
  useEffect(() => {
    if (!hasInitialized.current) {
      loadDataInstantly();
      hasInitialized.current = true;
    }

    const channel = supabase
      .channel('episodes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'episodes' }, () => {
        // Используем стабильную функцию для избежания бесконечных ререндеров
        loadFreshDataInBackground();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => {
        // Используем стабильную функцию для избежания бесконечных ререндеров
        loadFreshDataInBackground();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDataInstantly, loadFreshDataInBackground]);

  // Фильтрация по месяцам
  useEffect(() => {
    if (selectedYear) {
      const months = new Set();
      episodes.forEach(ep => {
        if (ep.date && new Date(ep.date).getFullYear().toString() === selectedYear) {
          months.add(new Date(ep.date).getMonth());
        }
      });
      const sortedMonths = Array.from(months).sort((a,b) => a - b);
      setAvailableMonths(sortedMonths.map(m => ({ value: (m + 1).toString(), labelKey: monthLabels[m] })));
    } else {
      setAvailableMonths([]);
      setSelectedMonth(null);
    }
  }, [selectedYear, episodes, monthLabels]);
  
  const handleResetFilters = () => {
    setSelectedYear(null);
    setSelectedMonth(null);
  };

  const filteredEpisodes = useMemo(() => {
    let tempEpisodes = episodes;

    if (selectedYear) {
      tempEpisodes = tempEpisodes.filter(ep => ep.date && new Date(ep.date).getFullYear().toString() === selectedYear);
      if (selectedMonth) {
        tempEpisodes = tempEpisodes.filter(ep => ep.date && (new Date(ep.date).getMonth() + 1).toString() === selectedMonth);
      }
    }
    
    return tempEpisodes;
  }, [episodes, selectedYear, selectedMonth]);

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-2xl">
      <EpisodesPageHeader 
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
      />
      
      <FilterAndSearchControls
        years={availableYears}
        months={availableMonths}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        currentLanguage={currentLanguage}
        onResetFilters={handleResetFilters}
      />

      {/* Показываем состояние загрузки или пустое состояние */}
      {(loading || filteredEpisodes.length === 0) ? (
        <EmptyState currentLanguage={currentLanguage} isLoading={loading} />
      ) : (
        <EpisodesList 
          episodes={filteredEpisodes} 
          currentLanguage={currentLanguage} 
          episodeQuestionsCount={episodeQuestionsCount}
          allQuestions={allQuestions}
        />
      )}
    </div>
  );
};

export default InstantEpisodesPage;
