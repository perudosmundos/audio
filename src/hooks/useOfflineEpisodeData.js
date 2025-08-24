import { useState, useEffect, useCallback } from 'react';
import { getLocaleString } from '@/lib/locales';
import syncService from '@/lib/syncService';
import offlineDataService from '@/lib/offlineDataService';
import audioCacheService from '@/lib/audioCacheService';
import { getFullTextFromUtterances } from '@/hooks/transcript/transcriptProcessingUtils';

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
  const fetchEpisodeData = useCallback(async (slug) => {
    if (!slug) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await syncService.loadData('episode', { slug });
      
      if (result.data) {
        setEpisodeData(result.data);
        
        // Проверяем, есть ли аудио в кеше
        if (result.data.audio_url) {
          audioCacheService.updateLastAccessed(result.data.audio_url);
        }
        
        if (result.source === 'cache') {
          toast({
            title: getLocaleString('loadedFromCache', currentLanguage),
            description: getLocaleString('dataLoadedOffline', currentLanguage),
            className: "bg-yellow-600/80 border-yellow-500 text-white"
          });
        }
      } else {
        throw new Error('Episode not found');
      }
    } catch (error) {
      console.error('Error fetching episode data:', error);
      setError(error.message);
      
      if (isOfflineMode) {
        toast({
          title: getLocaleString('offlineDataUnavailable', currentLanguage),
          description: getLocaleString('episodeNotCached', currentLanguage),
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

      if (result.data) {
        const transcriptData = result.data;
        const finalData = transcriptData.edited_transcript_data;
        
        setTranscript({
          id: transcriptData.id,
          utterances: finalData?.utterances || [],
          words: finalData?.words || [],
          text: finalData?.text || getFullTextFromUtterances(finalData?.utterances || []),
          status: transcriptData.status
        });

        if (result.source === 'cache') {
          toast({
            title: getLocaleString('transcriptFromCache', currentLanguage),
            description: getLocaleString('transcriptLoadedOffline', currentLanguage),
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
          title: getLocaleString('transcriptUnavailableOffline', currentLanguage),
          description: getLocaleString('transcriptNotCached', currentLanguage),
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
      
      // Добавляем виртуальное введение, если его нет
      const hasIntro = fetchedQuestions.some(q => q.is_intro && q.time === 0);
      if (!hasIntro) {
        const introQuestion = {
          id: 'intro-virtual',
          time: 0,
          title: getLocaleString('introduction', langForQuestions),
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
          title: getLocaleString('questionsFromCache', currentLanguage),
          description: getLocaleString('questionsLoadedOffline', currentLanguage),
          className: "bg-green-600/80 border-green-500 text-white"
        });
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      setQuestions([]);
      
      if (isOfflineMode) {
        toast({
          title: getLocaleString('questionsUnavailableOffline', currentLanguage),
          description: getLocaleString('questionsNotCached', currentLanguage),
          variant: "destructive"
        });
      }
    } finally {
      setQuestionsLoading(false);
    }
  }, [currentLanguage, toast, isOfflineMode]);

  // Сохранение отредактированного транскрипта с поддержкой офлайн
  const saveEditedTranscript = useCallback(async (updatedTranscript) => {
    if (!transcript?.id) return;

    try {
      const transcriptData = {
        id: transcript.id,
        episode_slug: episodeSlug,
        lang: currentLanguage,
        utterances: updatedTranscript.utterances,
        words: updatedTranscript.words || transcript.words,
        text: updatedTranscript.utterances.map(u => u.text).join(' ')
      };

      await syncService.saveData('transcript', transcriptData, 'update');
      
      setTranscript(prev => ({
        ...prev,
        utterances: updatedTranscript.utterances,
        text: transcriptData.text
      }));

      if (isOfflineMode) {
        toast({
          title: getLocaleString('savedOffline', currentLanguage),
          description: getLocaleString('transcriptSavedOffline', currentLanguage),
          className: "bg-yellow-600/80 border-yellow-500 text-white"
        });
      } else {
        toast({
          title: getLocaleString('transcriptSaved', currentLanguage),
          description: getLocaleString('transcriptSavedSuccessfully', currentLanguage),
          className: "bg-green-600/80 border-green-500 text-white"
        });
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast({
        title: getLocaleString('saveError', currentLanguage),
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
    
    await Promise.all([
      fetchEpisodeData(episodeSlug),
      fetchTranscriptForEpisode(episodeSlug, langForTranscript),
      fetchQuestionsForEpisode(episodeSlug, currentLanguage)
    ]);
  }, [episodeSlug, episodeData?.lang, currentLanguage, fetchEpisodeData, fetchTranscriptForEpisode, fetchQuestionsForEpisode]);

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
    
    fetchTranscriptForEpisode(episodeSlug, langForTranscript);
    fetchQuestionsForEpisode(episodeSlug, currentLanguage);
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
