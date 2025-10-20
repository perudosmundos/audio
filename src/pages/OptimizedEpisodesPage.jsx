import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import OptimizedEpisodesList from '@/components/episodes/OptimizedEpisodesList';
import EpisodesPageHeader from '@/components/episodes/EpisodesPageHeader';
import FilterAndSearchControls from '@/components/episodes/FilterAndSearchControls';
import EmptyState from '@/components/episodes/EmptyState';
import optimizedCacheService from '@/lib/optimizedCacheService';

const OptimizedEpisodesPage = ({ currentLanguage }) => {
  const [episodes, setEpisodes] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const visibleEpisodesRef = useRef(new Set()); // Отслеживаем видимые эпизоды
  const hasInitializedCache = useRef(false);
  const lastBackgroundRefresh = useRef(0); // Время последнего фонового обновления

  // Инициализация кэша
  useEffect(() => {
    const initializeCache = async () => {
      if (!hasInitializedCache.current) {
        await optimizedCacheService.init();
        hasInitializedCache.current = true;
      }
    };
    initializeCache();
  }, []);

  // Отслеживание видимых эпизодов для приоритетной загрузки
  const handleEpisodeVisibility = useCallback((episodeSlugs) => {
    visibleEpisodesRef.current = new Set(episodeSlugs);
    
    // Если есть загруженные эпизоды, запускаем приоритетную загрузку для видимых
    if (episodes.length > 0) {
      const visibleEpisodes = episodes.filter(ep => episodeSlugs.includes(ep.slug));
      optimizedCacheService.priorityLoad(episodes, currentLanguage, visibleEpisodes);
    }
  }, [episodes, currentLanguage]);

  // Оптимизированная загрузка эпизодов и данных
  const fetchEpisodesAndData = useCallback(async () => {
    console.log('🚀 Optimized fetchEpisodesAndData started');
    setLoading(true);
    setError(null);

    try {
      // Сначала пытаемся загрузить из кэша с таймаутом
      const cachedEpisodes = await Promise.race([
        optimizedCacheService.smartGet('episodes', 'all'),
        new Promise(resolve => setTimeout(() => resolve(null), 2000)) // 2 секунды таймаут
      ]);

      if (cachedEpisodes && cachedEpisodes.length > 0) {
        console.log('📦 Using cached episodes:', cachedEpisodes.length);
        await processEpisodesData(cachedEpisodes, true);

        // Загружаем свежие данные в фоне только если страница активна
        if (!document.hidden) {
          loadFreshDataInBackground();
        }
        return;
      }

      // Если кэша нет или он устарел, загружаем свежие данные
      await loadFreshData();
    } catch (err) {
      console.error('❌ Error in fetchEpisodesAndData:', err);
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [currentLanguage]);

  // Загрузка свежих данных
  const loadFreshData = async () => {
    try {
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select('slug, title, lang, audio_url, duration, date, created_at, file_has_lang_suffix, r2_object_key, r2_bucket_name')
        .order('date', { ascending: false });

      if (episodesError) throw episodesError;
      
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('episode_slug, id, title, lang'); 
      
      if (questionsError) throw questionsError;
      
      // Сохраняем в кэш с приоритетом
      if (episodesData) {
        for (const episode of episodesData) {
          await optimizedCacheService.smartCache('episodes', episode.slug, episode, 'critical');
        }
        // Сохраняем полный список эпизодов
        await optimizedCacheService.smartCache('episodes', 'all', episodesData, 'critical');
      }
      
      if (questionsData) {
        // Группируем вопросы по эпизодам и языкам
        const questionsByEpisode = {};
        questionsData.forEach(q => {
          if (!questionsByEpisode[q.episode_slug]) {
            questionsByEpisode[q.episode_slug] = {};
          }
          if (!questionsByEpisode[q.episode_slug][q.lang]) {
            questionsByEpisode[q.episode_slug][q.lang] = [];
          }
          questionsByEpisode[q.episode_slug][q.lang].push(q);
        });
        
        // Сохраняем вопросы в кэш
        for (const [episodeSlug, langs] of Object.entries(questionsByEpisode)) {
          for (const [lang, questions] of Object.entries(langs)) {
            await optimizedCacheService.smartCache('questions', `${episodeSlug}:${lang}`, { questions, episodeSlug, lang }, 'high');
          }
        }
      }

      await processEpisodesData(episodesData, false, questionsData);
      
      // Запускаем фоновую загрузку транскриптов для популярных эпизодов
      startBackgroundTranscriptLoading(episodesData);
      
    } catch (err) {
      console.error('Error in loadFreshData:', err);
      throw err;
    }
  };

  // Фоновая загрузка свежих данных
  const loadFreshDataInBackground = async () => {
    try {
      // Ограничиваем частоту фоновых обновлений (не чаще чем раз в 5 минут)
      const now = Date.now();
      if (now - lastBackgroundRefresh.current < 5 * 60 * 1000) {
        console.debug('⏳ Background refresh skipped - too frequent');
        return;
      }
      lastBackgroundRefresh.current = now;

      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select('slug, title, lang, audio_url, duration, date, created_at, file_has_lang_suffix, r2_object_key, r2_bucket_name')
        .order('date', { ascending: false });

      if (!episodesError && episodesData) {
        // Обновляем кэш в фоне
        for (const episode of episodesData) {
          await optimizedCacheService.smartCache('episodes', episode.slug, episode, 'normal');
        }
        await optimizedCacheService.smartCache('episodes', 'all', episodesData, 'normal');

        console.log('🔄 Background data refresh completed');
      }
    } catch (err) {
      console.debug('Background refresh failed:', err);
    }
  };

  // Фоновая загрузка транскриптов
  const startBackgroundTranscriptLoading = async (episodesData) => {
    // Берем только последние 5 эпизодов для фоновой загрузки
    const recentEpisodes = episodesData.slice(0, 5);
    
    for (const episode of recentEpisodes) {
      for (const lang of ['ru', 'es', 'en']) {
        optimizedCacheService.addToBackgroundQueue('transcript', `${episode.slug}:${lang}`, 'low');
      }
    }
  };

  // Обработка данных эпизодов
  const processEpisodesData = async (episodesData, fromCache = false, questionsData = null) => {
    const langFilteredEpisodes = episodesData.filter(ep => 
      ep.lang === currentLanguage || ep.lang === 'all'
    );
    
    // Загружаем вопросы из кэша или из переданных данных
    let finalQuestionsData = questionsData;
    if (!finalQuestionsData && fromCache) {
      finalQuestionsData = [];
      // Загружаем вопросы из кэша для отфильтрованных эпизодов
      for (const episode of langFilteredEpisodes) {
        for (const lang of ['ru', 'es', 'en']) {
          const cachedQuestions = await optimizedCacheService.smartGet('questions', `${episode.slug}:${lang}`, false);
          if (cachedQuestions && cachedQuestions.questions) {
            finalQuestionsData.push(...cachedQuestions.questions);
          }
        }
      }
    }

    const counts = {};
    const years = new Set();
    langFilteredEpisodes.forEach(ep => {
      if (ep.date) {
        years.add(new Date(ep.date).getFullYear().toString());
      }
      counts[ep.slug] = counts[ep.slug] || {};
      ['ru', 'es', 'en'].forEach(lang => {
         counts[ep.slug][lang] = (finalQuestionsData || []).filter(q => 
           q.episode_slug === ep.slug && 
           q.lang === lang && 
           (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
         ).length;
      });
    });
    
    setAvailableYears(Array.from(years).sort((a,b) => Number(b) - Number(a)));
    setEpisodeQuestionsCount(counts);
    setEpisodes(langFilteredEpisodes);
    setAllQuestions(finalQuestionsData || []);

    // Запускаем приоритетную загрузку для видимых эпизодов
    if (visibleEpisodesRef.current.size > 0) {
      const visibleEpisodes = langFilteredEpisodes.filter(ep => 
        visibleEpisodesRef.current.has(ep.slug)
      );
      optimizedCacheService.priorityLoad(langFilteredEpisodes, currentLanguage, visibleEpisodes);
    }

    console.log('✅ Data processed:', {
      episodes: langFilteredEpisodes.length,
      questions: (finalQuestionsData || []).length,
      fromCache
    });
  };

  // Обработка ошибок
  const handleError = (err) => {
    console.warn('❌ Error loading data:', err);
    
    const isNetworkError = err.message?.includes('Failed to fetch') || 
                          err.message?.includes('NetworkError') ||
                          !navigator.onLine;
    
    if (isNetworkError) {
      setError(getLocaleString('offlineMode', currentLanguage));
    } else {
      setError(getLocaleString('errorFetchingEpisodes', currentLanguage, { errorMessage: err.message }));
    }
  };

  // Основной эффект загрузки
  useEffect(() => {
    fetchEpisodesAndData();
    
    const channel = supabase
      .channel('episodes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'episodes' }, fetchEpisodesAndData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, fetchEpisodesAndData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentLanguage]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <p className="mt-4 text-lg">{getLocaleString('loadingEpisodes', currentLanguage)}</p>
      </div>
    );
  }

  if (error) {
    const isOfflineMode = error.includes('офлайн режиме') || error.includes('offline mode') || error.includes('sin conexión');
    
    return (
      <div className={`text-center p-8 rounded-lg shadow-xl max-w-2xl mx-auto ${
        isOfflineMode ? 'bg-yellow-700/30' : 'bg-red-700/30'
      }`}>
        <h2 className="text-xl font-bold mb-2">
          {isOfflineMode 
            ? getLocaleString('offlineModeTitle', currentLanguage)
            : getLocaleString('errorLoadingData', currentLanguage)
          }
        </h2>
        <p className="max-w-md mx-auto">{error}</p>
        {!isOfflineMode && (
          <Button onClick={fetchEpisodesAndData} className="mt-4 bg-blue-500 hover:bg-blue-600">
            {getLocaleString('tryAgain', currentLanguage)}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-2xl">
      <EpisodesPageHeader 
        currentLanguage={currentLanguage}
        onLanguageChange={(langCode) => {
          localStorage.setItem('podcastLang', langCode);
          window.location.reload();
        }}
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

      {(loading || filteredEpisodes.length === 0) ? (
        <EmptyState currentLanguage={currentLanguage} isLoading={loading} />
      ) : (
        <OptimizedEpisodesList 
          episodes={filteredEpisodes} 
          currentLanguage={currentLanguage} 
          episodeQuestionsCount={episodeQuestionsCount}
          allQuestions={allQuestions}
          onEpisodeVisibilityChange={handleEpisodeVisibility}
        />
      )}
    </div>
  );
};

export default OptimizedEpisodesPage;
