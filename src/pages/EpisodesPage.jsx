import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import EpisodesList from '@/components/episodes/EpisodesList';
import EpisodesPageHeader from '@/components/episodes/EpisodesPageHeader';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import FilterAndSearchControls from '@/components/episodes/FilterAndSearchControls';
import EmptyState from '@/components/episodes/EmptyState';
import offlineDataService from '@/lib/offlineDataService';
import { useTelegram } from '@/contexts/TelegramContext';

const EpisodesPage = ({ currentLanguage }) => {
  const { user, isReady } = useTelegram();
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [episodeQuestionsCount, setEpisodeQuestionsCount] = useState({});

  const handleLanguageChange = (langCode) => {
    localStorage.setItem('podcastLang', langCode);
    window.location.reload();
  };

  const [availableYears, setAvailableYears] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [updateTimestamp, setUpdateTimestamp] = useState(null);

  const showManageButton = isReady && user && user.username === 'de_paz';

  const monthLabels = [
    "january", "february", "march", "april", "may", "june", 
    "july", "august", "september", "october", "november", "december"
  ];


  const fetchEpisodesAndData = useCallback(async () => {
    console.log('🚀 fetchEpisodesAndData started');
    console.log('🌐 navigator.onLine:', navigator.onLine);
    setLoading(true);
    setError(null);
    
    try {
      // Инициализируем офлайн сервис только если он еще не инициализирован
      if (!offlineDataService.db && !offlineDataService.useFallback) {
        console.log('🔧 Initializing offline service...');
        await offlineDataService.init();
        console.log('✅ Offline service initialized');
      }
      
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
      
      // Сохраняем данные в офлайн кеш
      if (episodesData) {
        for (const episode of episodesData) {
          await offlineDataService.saveEpisode(episode);
        }
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
        
        // Сортируем вопросы по времени внутри каждой группы
        Object.keys(questionsByEpisode).forEach(episodeSlug => {
          Object.keys(questionsByEpisode[episodeSlug]).forEach(lang => {
            questionsByEpisode[episodeSlug][lang].sort((a, b) => (a.time || 0) - (b.time || 0));
          });
        });
        
        // Сохраняем вопросы в офлайн кеш
        for (const [episodeSlug, langs] of Object.entries(questionsByEpisode)) {
          for (const [lang, questions] of Object.entries(langs)) {
            await offlineDataService.saveQuestions(questions, episodeSlug, lang);
          }
        }
      }

      // Загружаем и сохраняем транскрипты для всех эпизодов
      console.log('🔄 Загружаем транскрипты для кеширования...');
      for (const episode of episodesData) {
        for (const lang of ['ru', 'es', 'en', 'de', 'fr', 'pl']) {
          try {
            const { data: transcriptData, error: transcriptError } = await supabase
              .from('transcripts')
              .select('id, episode_slug, lang, status, created_at, updated_at, edited_transcript_data')
              .eq('episode_slug', episode.slug)
              .eq('lang', lang)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!transcriptError && transcriptData) {
              // Извлекаем данные из edited_transcript_data
              const editedData = transcriptData.edited_transcript_data || {};
              
              const transcriptForCache = {
                id: transcriptData.id,
                episode_slug: transcriptData.episode_slug || episode.slug,
                lang: transcriptData.lang || lang,
                utterances: Array.isArray(editedData.utterances) ? editedData.utterances : [],
                words: Array.isArray(editedData.words) ? editedData.words : [],
                text: editedData.text || '',
                status: transcriptData.status || 'completed',
                created_at: transcriptData.created_at || new Date().toISOString(),
                updated_at: transcriptData.updated_at || new Date().toISOString(),
                edited_transcript_data: transcriptData.edited_transcript_data
              };

              await offlineDataService.saveTranscript(transcriptForCache);
              console.log(`💾 Транскрипт сохранен в кеш: ${episode.slug} (${lang})`);
            }
          } catch (transcriptErr) {
            console.warn(`⚠️ Ошибка загрузки транскрипта для ${episode.slug} (${lang}):`, transcriptErr);
          }
        }
      }
      
      setAllQuestions(questionsData || []);
      
      const langFilteredEpisodes = episodesData.filter(ep => 
        ep.lang === currentLanguage || ep.lang === 'all'
      );
      
      const counts = {};
      const years = new Set();
      langFilteredEpisodes.forEach(ep => {
        if (ep.date) {
          years.add(new Date(ep.date).getFullYear().toString());
        }
        counts[ep.slug] = counts[ep.slug] || {};
        ['ru', 'es', 'en', 'de', 'fr', 'pl'].forEach(lang => {
           counts[ep.slug][lang] = (questionsData || []).filter(q => 
             q.episode_slug === ep.slug && 
             q.lang === lang && 
             (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
           ).length;
        });
      });
      
      setAvailableYears(Array.from(years).sort((a,b) => Number(b) - Number(a)));
      setEpisodeQuestionsCount(counts);
      setEpisodes(langFilteredEpisodes);
      setUpdateTimestamp(Date.now());

    } catch (err) {
      console.warn('❌ Ошибка загрузки с сервера:', err);
      console.log('🌐 navigator.onLine:', navigator.onLine);
      console.log('🔍 Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      
      // Проверяем, является ли ошибка сетевой (отсутствие интернета)
      const isNetworkError = err.message?.includes('Failed to fetch') || 
                            err.message?.includes('NetworkError') ||
                            err.message?.includes('Network request failed') ||
                            err.message?.includes('ERR_INTERNET_DISCONNECTED') ||
                            err.message?.includes('ERR_NETWORK_CHANGED') ||
                            err.name === 'TypeError' && err.message?.includes('fetch') ||
                            !navigator.onLine;
      
      // Дополнительная проверка - пробуем сделать простой запрос
      let isActuallyOffline = isNetworkError;
      if (isNetworkError) {
        try {
          // Пробуем сделать простой запрос к интернету
          await fetch('https://www.google.com/favicon.ico', { 
            method: 'HEAD', 
            mode: 'no-cors',
            cache: 'no-cache'
          });
          isActuallyOffline = false; // Интернет есть, это не офлайн ошибка
        } catch (networkTestErr) {
          isActuallyOffline = true; // Интернет действительно недоступен
          console.log('Проверка интернета: недоступен', networkTestErr);
        }
      }
      
      console.log('🔍 Network error analysis:', {
        isNetworkError,
        isActuallyOffline,
        navigatorOnLine: navigator.onLine,
        errorMessage: err.message,
        errorName: err.name
      });
      
      // Принудительно проверяем офлайн режим
      const forceOfflineCheck = !navigator.onLine || isActuallyOffline;
      console.log('🔍 Force offline check:', forceOfflineCheck);
      
      if (forceOfflineCheck) {
        console.log('📱 Приложение в офлайн режиме, загружаем из кеша...');
        console.warn('Сетевая ошибка, пытаемся загрузить из кеша:', err);
        
        try {
          console.log('🔄 Загружаем эпизоды из офлайн кеша...');
          // Пытаемся загрузить данные из офлайн кеша
          const cachedEpisodes = await offlineDataService.getAllEpisodes();
          console.log('📦 Кешированные эпизоды:', cachedEpisodes.length, cachedEpisodes);
          
          if (cachedEpisodes && cachedEpisodes.length > 0) {
            const langFilteredEpisodes = cachedEpisodes.filter(ep => 
              ep.lang === currentLanguage || ep.lang === 'all'
            );
            
            console.log('🔄 Загружаем вопросы из офлайн кеша для', langFilteredEpisodes.length, 'эпизодов...');
            // Загружаем вопросы из кеша
            const allCachedQuestions = [];
            for (const episode of langFilteredEpisodes) {
              for (const lang of ['ru', 'es', 'en', 'de', 'fr', 'pl']) {
                const questions = await offlineDataService.getQuestions(episode.slug, lang);
                if (questions.length > 0) {
                  console.log(`📝 Найдены вопросы для ${episode.slug} (${lang}):`, questions.length);
                }
                allCachedQuestions.push(...questions);
              }
            }
            console.log('📝 Всего загружено вопросов из кеша:', allCachedQuestions.length);
            
            setAllQuestions(allCachedQuestions);
            
            const counts = {};
            const years = new Set();
            langFilteredEpisodes.forEach(ep => {
              if (ep.date) {
                years.add(new Date(ep.date).getFullYear().toString());
              }
              counts[ep.slug] = counts[ep.slug] || {};
              ['ru', 'es', 'en', 'de', 'fr', 'pl'].forEach(lang => {
                 counts[ep.slug][lang] = allCachedQuestions.filter(q => 
                   q.episode_slug === ep.slug && 
                   q.lang === lang && 
                   (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
                 ).length;
              });
            });
            
            setAvailableYears(Array.from(years).sort((a,b) => Number(b) - Number(a)));
            setEpisodeQuestionsCount(counts);
            setEpisodes(langFilteredEpisodes);
            setUpdateTimestamp(Date.now());

            console.log('✅ Офлайн данные успешно загружены:', {
              episodes: langFilteredEpisodes.length,
              questions: allCachedQuestions.length,
              years: years.size
            });
            
            // Показываем предупреждение о работе в офлайн режиме
            setError(getLocaleString('offlineMode', currentLanguage));
          } else {
            console.log('❌ Кеш пустой или недоступен');
            console.log('🔍 Проверяем состояние кеша...');
            
            // Проверяем, есть ли вообще данные в кеше
            try {
              const testEpisodes = await offlineDataService.getAllEpisodes();
              console.log('🔍 Test episodes from cache:', testEpisodes);
              
              if (!testEpisodes || testEpisodes.length === 0) {
                setError('Кеш пустой. Сначала загрузите эпизоды в онлайн режиме, затем переключитесь в офлайн.');
              } else {
                setError(`Найдено ${testEpisodes.length} эпизодов в кеше, но они не отображаются. Ошибка: ${err.message}`);
              }
            } catch (cacheTestErr) {
              console.error('❌ Ошибка при проверке кеша:', cacheTestErr);
              setError(`Ошибка доступа к кешу: ${cacheTestErr.message}`);
            }
          }
        } catch (cacheErr) {
          console.error('❌ Ошибка загрузки из кеша:', cacheErr);
          setError(`Ошибка загрузки данных: ${err.message}. Кеш недоступен: ${cacheErr.message}`);
        }
      } else {
        // Не сетевая ошибка - показываем обычное сообщение об ошибке
        setError(getLocaleString('errorFetchingEpisodes', currentLanguage, { errorMessage: err.message }));
      }
    } finally {
      setLoading(false);
    }
  }, [currentLanguage]);

  useEffect(() => {
    const fetchAndSetupSubscription = async () => {
      await fetchEpisodesAndData();
      
      const channel = supabase
        .channel('episodes-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'episodes' }, fetchEpisodesAndData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, fetchEpisodesAndData)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = fetchAndSetupSubscription();
    return () => {
      if (cleanup) cleanup.then(fn => fn());
    };
  }, [currentLanguage, fetchEpisodesAndData]);

  // Автоматическая загрузка из кеша при офлайн режиме
  useEffect(() => {
    const loadFromCacheIfOffline = async () => {
      if (!navigator.onLine) {
        console.log('🔄 Автоматическая загрузка из кеша (офлайн режим)...');
        try {
          // Инициализируем офлайн сервис только если он еще не инициализирован
          if (!offlineDataService.db && !offlineDataService.useFallback) {
            await offlineDataService.init();
          }
          const cachedEpisodes = await offlineDataService.getAllEpisodes();
          console.log('📦 Автоматически загружены эпизоды из кеша:', cachedEpisodes.length);
          
          if (cachedEpisodes && cachedEpisodes.length > 0) {
            const langFilteredEpisodes = cachedEpisodes.filter(ep => 
              ep.lang === currentLanguage || ep.lang === 'all'
            );
            
            // Загружаем вопросы из кеша
            const allCachedQuestions = [];
            for (const episode of langFilteredEpisodes) {
              // Only load questions for current language or episode's specific language
              const effectiveLang = episode.lang === 'all' ? currentLanguage : episode.lang;
              const questions = await offlineDataService.getQuestions(episode.slug, effectiveLang);
              if (questions.length > 0) {
                allCachedQuestions.push(...questions);
              }
            }
            
            setAllQuestions(allCachedQuestions);
            
            const counts = {};
            const years = new Set();
            langFilteredEpisodes.forEach(ep => {
              if (ep.date) {
                years.add(new Date(ep.date).getFullYear().toString());
              }
              counts[ep.slug] = counts[ep.slug] || {};
              ['ru', 'es', 'en', 'de', 'fr', 'pl'].forEach(lang => {
                 counts[ep.slug][lang] = allCachedQuestions.filter(q => 
                   q.episode_slug === ep.slug && 
                   q.lang === lang && 
                   (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
                 ).length;
              });
            });
            
            setAvailableYears(Array.from(years).sort((a,b) => Number(b) - Number(a)));
            setEpisodeQuestionsCount(counts);
            setEpisodes(langFilteredEpisodes);
            setUpdateTimestamp(Date.now());
            setError(null);

            console.log('✅ Автоматически загружены офлайн данные:', {
              episodes: langFilteredEpisodes.length,
              questions: allCachedQuestions.length,
              years: years.size
            });
          }
        } catch (err) {
          console.error('❌ Ошибка автоматической загрузки из кеша:', err);
        }
      }
    };

    loadFromCacheIfOffline();
  }, [currentLanguage]);

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

  // Compute questions that should be displayed for current language and filtered episodes.
  // This creates a new array when currentLanguage, episodes or allQuestions change so
  // downstream memoized components receive updated props and re-render correctly.
  const displayedQuestions = useMemo(() => {
    if (!allQuestions || allQuestions.length === 0) return [];

    // Build a set of visible episode slugs to limit filtering cost
    const visibleSlugs = new Set(filteredEpisodes.map(ep => ep.slug));

    return allQuestions.filter(q => {
      if (!visibleSlugs.has(q.episode_slug)) return false;
      const ep = episodes.find(e => e.slug === q.episode_slug);
      if (!ep) return false;
      const effectiveLang = ep.lang === 'all' ? currentLanguage : ep.lang;
      return q.lang === effectiveLang;
    });
  }, [allQuestions, filteredEpisodes, episodes, currentLanguage]);


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
    <div className="relative min-h-screen">
      {showManageButton && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => navigate('/manage')}
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-300 py-2 px-3 rounded-lg text-sm whitespace-nowrap"
          >
            {getLocaleString('manageAndUploadTitle', currentLanguage)}
          </button>
        </div>
      )}

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
          <EpisodesList
            episodes={filteredEpisodes}
            currentLanguage={currentLanguage}
            episodeQuestionsCount={episodeQuestionsCount}
            allQuestions={displayedQuestions}
            updateTimestamp={updateTimestamp}
          />
        )}
      </div>
    </div>
  );
};

export default EpisodesPage;
