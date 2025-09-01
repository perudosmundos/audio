import { useState, useEffect, useCallback } from 'react';
import { getLocaleString } from '@/lib/locales';
import syncService from '@/lib/syncService';
import offlineDataService from '@/lib/offlineDataService';
import audioCacheService from '@/lib/audioCacheService';
import { getFullTextFromUtterances } from '@/hooks/transcript/transcriptProcessingUtils';
import { sanitizeTranscriptForSave, createSafeTranscriptId } from '@/lib/transcriptValidator';

const useOfflineEpisodeData = (episodeSlug, currentLanguage, toast) => {
  const [episodeData, setEpisodeData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questionsUpdatedId, setQuestionsUpdatedId] = useState(Date.now());
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Инициализация офлайн сервисов
  useEffect(() => {
    const initOfflineServices = async () => {
      try {
        await offlineDataService.init();
      } catch (error) {
        console.error('Failed to initialize offline services:', error);
      }
    };

    initOfflineServices();

    // Подписываемся на изменения сетевого состояния
    const unsubscribe = syncService.onNetworkChange((isOnline) => {
      setIsOfflineMode(!isOnline);
      
      if (isOnline && episodeSlug) {
        // При восстановлении соединения перезагружаем данные
        refreshAllData();
      }
    });

    // Устанавливаем начальное состояние
    setIsOfflineMode(!syncService.getNetworkStatus().isOnline);

    return unsubscribe;
  }, [episodeSlug]);

  // Загрузка данных эпизода с поддержкой офлайн
  const fetchEpisodeData = useCallback(async (epSlug) => {
    if (!epSlug) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await syncService.loadData('episode', { slug: epSlug });
      
      if (result.data && typeof result.data === 'object' && result.data.slug) {
        setEpisodeData(result.data);
        
        if (result.source === 'cache') {
          toast({
            title: getLocaleString('episodeFromCache', currentLanguage) || 'Episode from cache',
            description: getLocaleString('episodeLoadedOffline', currentLanguage) || 'Episode loaded from offline cache',
            className: "bg-green-600/80 border-green-500 text-white"
          });
        }
      } else {
        console.warn('Invalid episode data received:', result.data);
        setError(getLocaleString('invalidEpisodeData', currentLanguage) || 'Invalid episode data received');
      }
    } catch (error) {
      console.error('Error fetching episode data:', error);
      setError(getLocaleString('errorLoadingEpisode', currentLanguage) || 'Error loading episode data');
      
      if (isOfflineMode) {
        toast({
          title: getLocaleString('offlineDataUnavailable', currentLanguage) || 'Offline data unavailable',
          description: getLocaleString('episodeNotCached', currentLanguage) || 'Episode is not cached for offline use',
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [currentLanguage, toast, isOfflineMode]);

  // Загрузка транскрипта с поддержкой офлайн
  const fetchTranscriptForEpisode = useCallback(async (epSlug, langForTranscript) => {
    if (!epSlug) return;
    
    setTranscriptLoading(true);

    try {
      const result = await syncService.loadData('transcript', {
        episodeSlug: epSlug,
        lang: langForTranscript
      });

      if (result.data && typeof result.data === 'object') {
        const transcriptData = result.data;
        
        // Проверяем структуру данных транскрипта
        let utterances = [];
        let words = [];
        let text = '';
        
        if (transcriptData.edited_transcript_data && transcriptData.edited_transcript_data.utterances) {
          utterances = Array.isArray(transcriptData.edited_transcript_data.utterances) 
            ? transcriptData.edited_transcript_data.utterances 
            : [];
        } else if (transcriptData.utterances) {
          utterances = Array.isArray(transcriptData.utterances) 
            ? transcriptData.utterances 
            : [];
        }
        
        if (transcriptData.edited_transcript_data && transcriptData.edited_transcript_data.words) {
          words = Array.isArray(transcriptData.edited_transcript_data.words) 
            ? transcriptData.edited_transcript_data.words 
            : [];
        } else if (transcriptData.words) {
          words = Array.isArray(transcriptData.words) 
            ? transcriptData.words 
            : [];
        }
        
        if (transcriptData.edited_transcript_data && transcriptData.edited_transcript_data.text) {
          text = transcriptData.edited_transcript_data.text;
        } else if (transcriptData.text) {
          text = transcriptData.text;
        } else if (utterances.length > 0) {
          text = utterances.map(u => u.text || '').join(' ');
        }
        
        setTranscript({
          id: transcriptData.id,
          utterances: utterances,
          words: words,
          text: text,
          status: transcriptData.status || 'completed'
        });

        if (result.source === 'cache') {
          toast({
            title: getLocaleString('transcriptFromCache', currentLanguage) || 'Transcript from cache',
            description: getLocaleString('transcriptLoadedOffline', currentLanguage) || 'Transcript loaded from offline cache',
            className: "bg-blue-600/80 border-blue-500 text-white"
          });
        }
      } else {
        setTranscript(null);
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
      setTranscript(null);
      
      if (isOfflineMode) {
        toast({
          title: getLocaleString('transcriptUnavailableOffline', currentLanguage) || 'Transcript unavailable offline',
          description: getLocaleString('transcriptNotCached', currentLanguage) || 'Transcript is not cached for offline use',
          variant: "destructive"
        });
      }
    } finally {
      setTranscriptLoading(false);
    }
  }, [currentLanguage, toast, isOfflineMode]);

  // Загрузка вопросов с поддержкой офлайн
  const fetchQuestionsForEpisode = useCallback(async (epSlug, langForQuestions) => {
    if (!epSlug) return;
    
    setQuestionsLoading(true);

    try {
      const result = await syncService.loadData('questions', {
        episodeSlug: epSlug,
        lang: langForQuestions
      });

      let fetchedQuestions = result.data || [];
      
      // Убеждаемся, что fetchedQuestions - это массив
      if (!Array.isArray(fetchedQuestions)) {
        console.warn('Questions data is not an array:', fetchedQuestions);
        fetchedQuestions = [];
      }
      
      // Фильтруем некорректные вопросы
      fetchedQuestions = fetchedQuestions.filter(q => 
        q && typeof q === 'object' && 
        (q.id || q.time !== undefined) && 
        q.lang === langForQuestions
      );
      
      // Добавляем виртуальное введение, если его нет
      const hasIntro = fetchedQuestions.some(q => q.is_intro && q.time === 0);
      if (!hasIntro) {
        const introQuestion = {
          id: 'intro-virtual',
          time: 0,
          title: getLocaleString('introduction', langForQuestions) || 'Introduction',
          lang: langForQuestions,
          is_intro: true,
          episode_slug: epSlug,
          created_at: new Date().toISOString()
        };
        fetchedQuestions = [introQuestion, ...fetchedQuestions];
      }

      setQuestions(fetchedQuestions);

      if (result.source === 'cache') {
        toast({
          title: getLocaleString('questionsFromCache', currentLanguage) || 'Questions from cache',
          description: getLocaleString('questionsLoadedOffline', currentLanguage) || 'Questions loaded from offline cache',
          className: "bg-green-600/80 border-green-500 text-white"
        });
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      setQuestions([]);
      
      if (isOfflineMode) {
        toast({
          title: getLocaleString('questionsUnavailableOffline', currentLanguage) || 'Questions unavailable offline',
          description: getLocaleString('questionsNotCached', currentLanguage) || 'Questions are not cached for offline use',
          variant: "destructive"
        });
      }
    } finally {
      setQuestionsLoading(false);
    }
  }, [currentLanguage, toast, isOfflineMode]);

  // Сохранение отредактированного транскрипта с поддержкой офлайн
  const saveEditedTranscript = useCallback(async (updatedTranscript) => {
    if (!transcript?.id) {
      console.warn('Cannot save transcript: missing transcript ID');
      return;
    }

    // Проверяем и исправляем ID если необходимо
    const transcriptId = createSafeTranscriptId(transcript.id);
    if (transcriptId !== transcript.id) {
      console.warn('Transcript ID corrected from', transcript.id, 'to', transcriptId);
    }

    try {
      // Обрабатываем разные форматы входных данных
      let utterances, words, text;
      
      if (updatedTranscript.utterances) {
        // Если переданы utterances напрямую
        utterances = updatedTranscript.utterances;
        words = updatedTranscript.words || transcript.words || [];
        text = utterances.map(u => u.text).join(' ');
      } else if (Array.isArray(updatedTranscript)) {
        // Если передан массив utterances
        utterances = updatedTranscript;
        words = transcript.words || [];
        text = utterances.map(u => u.text).join(' ');
      } else {
        // Если передан объект с utterances
        utterances = updatedTranscript.utterances || [];
        words = updatedTranscript.words || transcript.words || [];
        text = updatedTranscript.text || utterances.map(u => u.text).join(' ');
      }

      const transcriptData = {
        id: transcriptId, // Используем проверенный числовой ID
        episode_slug: episodeSlug,
        lang: currentLanguage,
        utterances: utterances,
        words: words,
        text: text
      };

      // Валидируем и очищаем данные перед сохранением
      const sanitizedData = sanitizeTranscriptForSave(transcriptData);
      
      await syncService.saveData('transcript', sanitizedData, 'update');
      
      setTranscript(prev => ({
        ...prev,
        utterances: utterances,
        words: words,
        text: text
      }));

      if (isOfflineMode) {
        toast({
          title: getLocaleString('savedOffline', currentLanguage) || 'Сохранено офлайн',
          description: getLocaleString('transcriptSavedOffline', currentLanguage) || 'Изменения сохранены локально и будут синхронизированы при подключении к интернету',
          className: "bg-yellow-600/80 border-yellow-500 text-white"
        });
      } else {
        toast({
          title: getLocaleString('transcriptSaved', currentLanguage) || 'Транскрипт сохранен',
          description: getLocaleString('transcriptSavedSuccessfully', currentLanguage) || 'Изменения успешно сохранены',
          className: "bg-green-600/80 border-green-500 text-white"
        });
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast({
        title: getLocaleString('saveError', currentLanguage) || 'Ошибка сохранения',
        description: error.message,
        variant: "destructive"
      });
    }
  }, [transcript, episodeSlug, currentLanguage, isOfflineMode, toast]);

  // Сохранение вопросов с поддержкой офлайн
  const saveQuestions = useCallback(async (updatedQuestions, langForQuestions) => {
    try {
      // Фильтруем виртуальные вопросы
      const realQuestions = updatedQuestions.filter(q => 
        q.id !== 'intro-virtual' && q.id !== 'full-transcript-virtual'
      );

      const questionsData = {
        questions: realQuestions,
        episodeSlug,
        lang: langForQuestions
      };

      await syncService.saveData('questions', questionsData, 'update');
      
      setQuestions(updatedQuestions);
      setQuestionsUpdatedId(Date.now());

      if (isOfflineMode) {
        toast({
          title: getLocaleString('savedOffline', currentLanguage),
          description: getLocaleString('questionsSavedOffline', currentLanguage),
          className: "bg-yellow-600/80 border-yellow-500 text-white"
        });
      } else {
        toast({
          title: getLocaleString('questionsSaved', currentLanguage),
          description: getLocaleString('questionsSavedSuccessfully', currentLanguage),
          className: "bg-green-600/80 border-green-500 text-white"
        });
      }
    } catch (error) {
      console.error('Error saving questions:', error);
      toast({
        title: getLocaleString('saveError', currentLanguage),
        description: error.message,
        variant: "destructive"
      });
    }
  }, [episodeSlug, currentLanguage, isOfflineMode, toast]);

  // Обновление всех данных
  const refreshAllData = useCallback(async () => {
    if (!episodeSlug) return;

    const langForTranscript = episodeData?.lang === 'all' ? currentLanguage : episodeData?.lang || currentLanguage;
    
    try {
      await Promise.allSettled([
        fetchEpisodeData(episodeSlug),
        fetchTranscriptForEpisode(episodeSlug, langForTranscript),
        fetchQuestionsForEpisode(episodeSlug, currentLanguage)
      ]);
    } catch (error) {
      console.error('Error refreshing all data:', error);
      // Показываем уведомление об ошибке
      toast({
        title: getLocaleString('refreshError', currentLanguage) || 'Refresh error',
        description: getLocaleString('failedToRefreshData', currentLanguage) || 'Failed to refresh some data',
        variant: "destructive"
      });
    }
  }, [episodeSlug, episodeData?.lang, currentLanguage, fetchEpisodeData, fetchTranscriptForEpisode, fetchQuestionsForEpisode, toast]);

  // Предварительное кеширование аудио
  const preloadAudio = useCallback(async () => {
    if (!episodeData?.audio_url) return;

    try {
      const isAlreadyCached = await audioCacheService.isAudioCached(episodeData.audio_url);
      if (!isAlreadyCached) {
        await audioCacheService.preloadAudio(episodeData);
      }
    } catch (error) {
      console.error('Error preloading audio:', error);
    }
  }, [episodeData]);

  // Основная загрузка данных при изменении эпизода
  useEffect(() => {
    if (!episodeSlug) return;

    fetchEpisodeData(episodeSlug);
  }, [episodeSlug, fetchEpisodeData]);

  // Загрузка транскрипта и вопросов после получения данных эпизода
  useEffect(() => {
    if (!episodeData || !episodeSlug) return;

    const langForTranscript = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;
    
    // Загружаем данные с обработкой ошибок
    const loadData = async () => {
      try {
        await Promise.allSettled([
          fetchTranscriptForEpisode(episodeSlug, langForTranscript),
          fetchQuestionsForEpisode(episodeSlug, currentLanguage)
        ]);
      } catch (error) {
        console.error('Error loading transcript and questions:', error);
        // Не показываем toast здесь, так как отдельные методы уже показывают ошибки
      }
    };
    
    loadData();
  }, [episodeData, episodeSlug, currentLanguage, fetchTranscriptForEpisode, fetchQuestionsForEpisode]);

  return {
    // Данные
    episodeData,
    questions,
    transcript,
    
    // Состояния загрузки
    loading,
    questionsLoading,
    transcriptLoading,
    error,
    questionsUpdatedId,
    
    // Офлайн состояние
    isOfflineMode,
    
    // Методы сохранения
    saveEditedTranscript,
    saveQuestions,
    
    // Методы управления
    refreshAllData,
    preloadAudio,
    
    // Методы загрузки (для совместимости)
    fetchTranscriptForEpisode,
    fetchQuestionsForEpisode
  };
};

export default useOfflineEpisodeData;
