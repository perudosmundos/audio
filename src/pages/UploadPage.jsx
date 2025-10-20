import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { UploadCloud, Loader2, PlusCircle, ArrowLeft, TestTube, Key, RefreshCw } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import useFileUploadManager from '@/hooks/useFileUploadManager';
import UploadManageView from '@/components/uploader/UploadManageView';
import EmptyUploadState from '@/components/uploader/EmptyUploadState';
import OverwriteDialog from '@/components/uploader/OverwriteDialog';
import ConflictDialog from '@/components/uploader/ConflictDialog';
import UploadQueue from '@/components/uploader/UploadQueue';
import { testOpenAIConnection } from '@/lib/openAIService';
import { useToast } from '@/components/ui/use-toast';
import useTranslationManager from '@/hooks/useTranslationManager';
import timeOldService from '@/lib/timeOldService';
import { supabase } from '@/lib/supabaseClient';
import storageRouter from '@/lib/storageRouter';
import { startPollingForItem } from '@/services/uploader/transcriptPoller';

const UploadPage = ({ currentLanguage }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('ASSEMBLYAI_API_KEY') || '';
    } catch {
      return '';
    }
  });
  const [episodes, setEpisodes] = useState([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(true);

  const {
    filesToProcess,
    showOverwriteDialog,
    currentItemForOverwrite,
    conflictDialog,
    addFilesToQueue,
    updateItemState,
    processSingleItem,
    handleTitleChange,
    handleRemoveItem,
    confirmOverwrite,
    cancelOverwrite,
    handleConflictConfirm,
    handleConflictCancel,
  } = useFileUploadManager(currentLanguage);

  // Translation manager
  const {
    translateEpisode,
    batchTranslateFromLanguage,
    translatingFrom,
    translationProgress
  } = useTranslationManager(currentLanguage, toast, episodes, setEpisodes);

  // Слушаем обновления эпизодов после перевода
  useEffect(() => {
    const handleEpisodeUpdate = (event) => {
      const { slug, lang, episode } = event.detail;
      
      console.log('[UploadPage] Episode updated after translation:', { slug, lang });
      
      // Обновляем список эпизодов
      setEpisodes(prev => {
        const filtered = prev.filter(e => !(e.slug === slug && e.lang === lang));
        return [...filtered, episode];
      });
    };

    window.addEventListener('episodeUpdated', handleEpisodeUpdate);
    
    return () => {
      window.removeEventListener('episodeUpdated', handleEpisodeUpdate);
    };
  }, []);

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingIntervalsRef.current).forEach(clearInterval);
    };
  }, []);

  // State for transcription
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingEpisode, setTranscribingEpisode] = useState(null);
  const pollingIntervalsRef = useRef({});

  // Real transcription function
  const handleStartTranscription = async (episode) => {
    // Use storageRouter to get correct audio URL based on storage_provider
    const audioUrl = storageRouter.getCorrectAudioUrl(episode);

    console.log('[Transcription] Episode data:', {
      slug: episode.slug,
      lang: episode.lang,
      storageProvider: episode.storage_provider,
      hostingerFileKey: episode.hostinger_file_key,
      r2ObjectKey: episode.r2_object_key,
      r2BucketName: episode.r2_bucket_name,
      finalAudioUrl: audioUrl
    });

    if (!audioUrl) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: 'URL аудиофайла не найден',
        variant: 'destructive'
      });
      return;
    }

    setIsTranscribing(true);
    setTranscribingEpisode(episode.id);

    try {
      // Импортируем функцию транскрипции
      const { startManualTranscription } = await import('@/services/uploader/fileProcessor');
      
      const result = await startManualTranscription({
        audioUrl,
        episodeSlug: episode.slug,
        lang: episode.lang,
        currentLanguage,
        toast
      });

      if (result.success) {
        toast({
          title: '✅ Транскрипция запущена',
          description: `Распознавание текста для ${episode.lang.toUpperCase()} начато`,
          duration: 5000
        });

        // Update local state
        setEpisodes(prev => prev.map(ep => 
          ep.id === episode.id 
            ? { ...ep, transcript: { ...ep.transcript, status: 'processing' } }
            : ep
        ));

        // Start standard polling
        const itemData = {
          id: `${episode.slug}-${episode.lang}`,
          episodeSlug: episode.slug,
          lang: episode.lang,
          episodeTitle: episode.title,
          transcriptionStatus: 'processing',
          assemblyai_transcript_id: result.transcriptId
        };

        startPollingForItem(
          itemData,
          (itemId, updates) => {
            setEpisodes(prev => prev.map(ep => 
              ep.id === episode.id 
                ? { ...ep, transcript: { ...ep.transcript, ...updates } }
                : ep
            ));
            
            if (updates.transcriptionStatus === 'completed') {
              toast({
                title: '✅ Транскрипция завершена',
                description: `Текст для ${episode.lang.toUpperCase()} готов`,
                duration: 5000
              });
            } else if (updates.transcriptionStatus === 'error') {
              toast({
                title: '❌ Ошибка транскрипции',
                description: updates.transcriptionError || 'Неизвестная ошибка',
                variant: 'destructive',
                duration: 8000
              });
            }
          },
          currentLanguage,
          toast,
          pollingIntervalsRef
        );
      } else {
        throw new Error(result.error || 'Неизвестная ошибка');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: '❌ Ошибка транскрипции',
        description: error.message,
        variant: 'destructive',
        duration: 8000
      });
    } finally {
      setIsTranscribing(false);
      setTranscribingEpisode(null);
    }
  };

  // Polling for transcription status
  const pollTranscriptStatus = async (episode) => {
    const maxAttempts = 60; // 5 минут с интервалом 5 секунд
    let attempts = 0;

    const poll = async () => {
      try {
        const { data: transcript, error } = await supabase
          .from('transcripts')
          .select('*')
          .eq('episode_slug', episode.slug)
          .eq('lang', episode.lang)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (transcript) {
          if (transcript.status === 'completed') {
            // Транскрипция завершена
            setEpisodes(prev => prev.map(ep => 
              ep.id === episode.id 
                ? { ...ep, transcript: { ...transcript, status: 'completed' } }
                : ep
            ));
            
            toast({
              title: '✅ Транскрипция завершена',
              description: `Текст для ${episode.lang.toUpperCase()} готов`,
              duration: 5000
            });
            return;
          } else if (transcript.status === 'error') {
            throw new Error('Ошибка транскрипции');
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Проверяем каждые 5 секунд
        } else {
          throw new Error('Таймаут транскрипции');
        }
      } catch (error) {
        console.error('Polling error:', error);
        setEpisodes(prev => prev.map(ep => 
          ep.id === episode.id 
            ? { ...ep, transcript: { ...ep.transcript, status: 'error' } }
            : ep
        ));
      }
    };

    poll();
  };

  const handleDeleteTranscript = async (episode) => {
    try {
      const { error } = await supabase
        .from('transcripts')
        .delete()
        .eq('episode_slug', episode.slug)
        .eq('lang', episode.lang);

      if (error) throw error;

      // Обновляем состояние
      setEpisodes(prev => prev.map(ep => 
        ep.id === episode.id 
          ? { ...ep, transcript: null }
          : ep
      ));

      toast({
        title: '✅ Транскрипт удален',
        description: 'Транскрипт успешно удален',
        duration: 3000
      });
    } catch (error) {
      console.error('Delete transcript error:', error);
      toast({
        title: '❌ Ошибка удаления',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteEpisode = async (episode) => {
    if (!episode?.id) {
      console.error('No episode ID provided for deletion');
      return;
    }

    try {
      // Определяем, является ли это переведенным эпизодом
      const isTranslatedEpisode = !['es', 'ru'].includes(episode.lang);
      
      if (isTranslatedEpisode) {
        // Для переведенных эпизодов удаляем только данные перевода
        // Удаляем транскрипт перевода
        const { error: transcriptError } = await supabase
          .from('transcripts')
          .delete()
          .eq('episode_slug', episode.slug)
          .eq('lang', episode.lang);

        if (transcriptError) throw transcriptError;

        // Удаляем вопросы перевода
        const { error: questionsError } = await supabase
          .from('questions')
          .delete()
          .eq('episode_slug', episode.slug)
          .eq('lang', episode.lang);

        if (questionsError) throw questionsError;

        // Удаляем сам эпизод перевода (но не оригинальный)
        const { error: episodeError } = await supabase
          .from('episodes')
          .delete()
          .eq('id', episode.id);

        if (episodeError) throw episodeError;

        // Обновляем локальное состояние
        setEpisodes(prev => prev.filter(ep => ep.id !== episode.id));

        toast({
          title: 'Перевод удален',
          description: `Перевод "${episode.title}" успешно удален`,
          duration: 3000,
        });

      } else {
        // Для оригинальных эпизодов (ES/RU) удаляем все
        const { error: episodeError } = await supabase
          .from('episodes')
          .delete()
          .eq('id', episode.id);

        if (episodeError) throw episodeError;

        // Удаляем все связанные транскрипты
        const { error: transcriptError } = await supabase
          .from('transcripts')
          .delete()
          .eq('episode_slug', episode.slug);

        if (transcriptError) throw transcriptError;

        // Удаляем все связанные вопросы
        const { error: questionsError } = await supabase
          .from('questions')
          .delete()
          .eq('episode_slug', episode.slug);

        if (questionsError) throw questionsError;

        // Обновляем локальное состояние
        setEpisodes(prev => prev.filter(ep => ep.id !== episode.id));

        toast({
          title: 'Эпизод удален',
          description: `Эпизод "${episode.title}" и все переводы успешно удалены`,
          duration: 3000,
        });
      }

    } catch (error) {
      console.error('Error deleting episode:', error);
      toast({
        title: 'Ошибка удаления',
        description: `Не удалось удалить: ${error.message}`,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleProcessWithAI = async (episode) => {
    console.log('Process with AI:', episode);
    
    try {
      toast({
        title: '🤖 Обработка через AI',
        description: `Обрабатываем ${episode.slug} через AI...`,
        duration: 3000
      });

      // Здесь должна быть логика обработки через AI
      // Пока что просто показываем сообщение
      toast({
        title: '⚠️ Функция в разработке',
        description: 'Обработка через AI будет добавлена в следующей версии',
        variant: 'default',
        duration: 5000
      });
    } catch (error) {
      console.error('Error processing with AI:', error);
      toast({
        title: '❌ Ошибка обработки',
        description: `Не удалось обработать через AI: ${error.message}`,
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  const handleLoadFromDB = async (episode) => {
    console.log('Load from DB:', episode);
    
    try {
      toast({
        title: '🔄 Загрузка вопросов из БД',
        description: `Загружаем вопросы для ${episode.episodeSlug}...`,
        duration: 3000
      });

      // Загружаем и сохраняем вопросы из timeOld
      const result = await timeOldService.loadAndSaveQuestionsForEpisode(episode);
      
      if (result.success) {
        toast({
          title: '✅ Вопросы загружены',
          description: result.message,
          duration: 5000
        });
      } else {
        toast({
          title: '⚠️ Вопросы не найдены',
          description: result.message,
          variant: 'default',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error loading questions from DB:', error);
      toast({
        title: '❌ Ошибка загрузки',
        description: `Не удалось загрузить вопросы: ${error.message}`,
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  const handleGenerateFromText = async (episode) => {
    console.log('Generate questions from text:', episode);
    
    try {
      toast({
        title: '🤖 Генерация вопросов',
        description: `Генерируем вопросы для ${episode.slug}...`,
        duration: 3000
      });

      // Здесь должна быть логика генерации вопросов через AI
      // Пока что просто показываем сообщение
      toast({
        title: '⚠️ Функция в разработке',
        description: 'Генерация вопросов через AI будет добавлена в следующей версии',
        variant: 'default',
        duration: 5000
      });
    } catch (error) {
      console.error('Error generating questions from text:', error);
      toast({
        title: '❌ Ошибка генерации',
        description: `Не удалось сгенерировать вопросы: ${error.message}`,
        variant: 'destructive',
        duration: 5000
      });
    }
  };

  // Функция загрузки файлов с настройками
  const [isUploadingQueue, setIsUploadingQueue] = useState(false);
  
  const handleStartUpload = async (fileSettings) => {
    setIsUploadingQueue(true);
    
    try {
      toast({
        title: '🚀 Загрузка началась',
        description: `Загружаем ${filesToProcess.length} файлов...`,
        duration: 3000
      });

      // Обрабатываем каждый файл в очереди
      for (const item of filesToProcess) {
        const settings = fileSettings[item.id] || {};
        
        // Для файлов без языкового суффикса проверяем настройки группы
        let shouldProcess = false;
        if (item.isSingleTrackFile && item.fileGroupId) {
          // Находим все элементы группы и проверяем настройки
          const groupItems = filesToProcess.filter(f => f.fileGroupId === item.fileGroupId);
          const groupSettings = groupItems.reduce((acc, groupItem) => {
            const itemSettings = fileSettings[groupItem.id] || {};
            // Преобразуем selectedVersion в processES/processRU
            const selectedVersion = itemSettings.selectedVersion || 'both';
            return {
              processES: acc.processES || selectedVersion === 'es' || selectedVersion === 'both',
              processRU: acc.processRU || selectedVersion === 'ru' || selectedVersion === 'both',
              autoTranscribe: acc.autoTranscribe || itemSettings.autoTranscribe,
              autoGenerateQuestions: acc.autoGenerateQuestions || itemSettings.autoGenerateQuestions,
              autoTranslate: acc.autoTranslate || itemSettings.autoTranslate
            };
          }, { processES: false, processRU: false, autoTranscribe: false, autoGenerateQuestions: false, autoTranslate: false });
          
          shouldProcess = groupSettings.processES || groupSettings.processRU;
        } else {
          // Для файлов с суффиксом проверяем обычные настройки
          const selectedVersion = settings.selectedVersion || 'both';
          shouldProcess = (selectedVersion === 'es' || selectedVersion === 'both') || (selectedVersion === 'ru' || selectedVersion === 'both');
        }
        
        // Пропускаем файлы, которые не нужно обрабатывать
        if (!shouldProcess) {
          console.log(`Skipping ${item.file.name} - no languages selected`);
          continue;
        }

        // Обновляем статус: начинается загрузка
        updateItemState(item.id, {
          isUploading: true,
          uploadProgress: 0,
          uploadError: null
        });

        try {
          // Загружаем файл через processSingleItem
          await processSingleItem(item, false, null);

          // Обновляем статус: загрузка завершена
          updateItemState(item.id, {
            isUploading: false,
            uploadProgress: 100,
            uploadComplete: true
          });

          // Получаем настройки для автоматических действий
          let autoSettings = settings;
          if (item.isSingleTrackFile && item.fileGroupId) {
            const groupItems = filesToProcess.filter(f => f.fileGroupId === item.fileGroupId);
            autoSettings = groupItems.reduce((acc, groupItem) => {
              const itemSettings = fileSettings[groupItem.id] || {};
              return {
                autoTranscribe: acc.autoTranscribe || itemSettings.autoTranscribe,
                autoGenerateQuestions: acc.autoGenerateQuestions || itemSettings.autoGenerateQuestions,
                autoLoadFromDB: acc.autoLoadFromDB || itemSettings.autoLoadFromDB,
                autoTranslate: acc.autoTranslate || itemSettings.autoTranslate
              };
            }, { autoTranscribe: false, autoGenerateQuestions: false, autoLoadFromDB: false, autoTranslate: false });
          } else {
            // Для файлов с суффиксом используем настройки напрямую
            autoSettings = {
              autoTranscribe: settings.autoTranscribe,
              autoGenerateQuestions: settings.autoGenerateQuestions,
              autoLoadFromDB: settings.autoLoadFromDB,
              autoTranslate: settings.autoTranslate
            };
          }

          // Если включена автоматическая транскрипция
          if (autoSettings.autoTranscribe) {
            updateItemState(item.id, {
              transcriptionStatus: 'Начинается транскрипция...'
            });
            
            // Транскрипция уже запускается автоматически в processSingleItem
            // Если нужно дождаться результата, можно добавить дополнительную логику
          }

          // Если включена автоматическая загрузка из БД
          if (autoSettings.autoLoadFromDB) {
            try {
              await handleLoadFromDB(item);
            } catch (error) {
              console.warn('Failed to load questions from DB for', item.episodeSlug, error);
            }
          }

          // Перезагружаем список эпизодов чтобы показать новый
          await loadEpisodes();

          // Если включен автоматический перевод
          if (autoSettings.autoTranslate) {
            // Найдем только что загруженный эпизод
            const uploadedEpisode = episodes.find(ep => 
              ep.slug === item.episodeSlug && ep.lang === item.lang
            );

            if (uploadedEpisode && uploadedEpisode.transcript?.status === 'completed') {
              updateItemState(item.id, {
                transcriptionStatus: 'Начинается перевод...'
              });

              // Переводим на все языки
              for (const targetLang of ['en', 'de', 'fr', 'pl']) {
                try {
                  await translateEpisode(uploadedEpisode, targetLang);
                } catch (err) {
                  console.error(`Translation to ${targetLang} failed:`, err);
                }
              }
            }
          }

          // Удаляем из очереди после успешной загрузки
          handleRemoveItem(item.id);

        } catch (error) {
          console.error(`Error uploading ${item.file.name}:`, error);
          updateItemState(item.id, {
            isUploading: false,
            uploadError: error.message
          });
        }
      }

      toast({
        title: '✅ Загрузка завершена',
        description: 'Все файлы успешно загружены',
        duration: 5000
      });
      
    } catch (error) {
      toast({
        title: '❌ Ошибка загрузки',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUploadingQueue(false);
    }
  };

  // Load episodes from database (optimized)
  const loadEpisodes = useCallback(async () => {
    setIsLoadingEpisodes(true);
    try {
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select(`
          id,
          slug,
          title,
          lang,
          date,
          audio_url,
          r2_object_key,
          r2_bucket_name,
          duration,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (episodesError) throw episodesError;

      const episodeSlugs = [...new Set(episodesData.map(e => e.slug))];

      const { data: transcriptsData, error: transcriptsError } = await supabase
        .from('transcripts')
        .select('id, episode_slug, lang, status, assemblyai_transcript_id, updated_at')
        .in('episode_slug', episodeSlugs);

      if (transcriptsError) throw transcriptsError;

      // Загружаем количество вопросов (используем fallback без RPC)
      let questionsCounts = {};
      
      // Используем fallback: загружаем все вопросы и считаем на клиенте
      const { data: questionsData } = await supabase
        .from('questions')
        .select('episode_slug, lang')
        .in('episode_slug', episodeSlugs);
      
      if (questionsData) {
        questionsData.forEach(q => {
          const key = `${q.episode_slug}-${q.lang}`;
          questionsCounts[key] = (questionsCounts[key] || 0) + 1;
        });
      }

      const episodesWithData = episodesData.map(episode => {
        const transcript = transcriptsData?.find(
          t => t.episode_slug === episode.slug && t.lang === episode.lang
        );
        const questionsCount = questionsCounts[`${episode.slug}-${episode.lang}`] || 0;

        return {
          ...episode,
          transcript: transcript || null,
          questionsCount,
        };
      });

      setEpisodes(episodesWithData);
    } catch (error) {
      console.error('Error loading episodes:', error);
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEpisodes(false);
    }
  }, [currentLanguage, toast]);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  const onDrop = useCallback((acceptedFiles) => {
    addFilesToQueue(acceptedFiles);
  }, [addFilesToQueue]);

  const handleTestOpenAI = async () => {
    setIsTestingOpenAI(true);
    try {
      const result = await testOpenAIConnection();
      if (result.success) {
        toast({
          title: "✅ DeepSeek Тест Успешен",
          description: `Все работает! Перевод: "${result.result}"`,
          duration: 5000
        });
      } else {
        let title = "❌ DeepSeek Тест Неудачен";
        let description = result.error;
        
        switch (result.step) {
          case "edge_function":
            title = "🌐 Проблема с Сервером";
            description = `${result.error}\n\nПроверьте подключение к интернету и статус сервера.`;
            break;
          case "api_key_missing":
            title = "🔑 API Ключ Отсутствует";
            description = `${result.error}\n\nОбратитесь к администратору для настройки API ключа.`;
            break;
          case "connection":
            title = "🌐 Сетевая Ошибка";
            description = `${result.error}\n\nПроверьте интернет-соединение и попробуйте позже.`;
            break;
          case "timeout":
            title = "⏱️ Таймаут";
            description = `${result.error}\n\nСервер не отвечает. Попробуйте позже.`;
            break;
        }
        
        toast({
          title,
          description,
          variant: "destructive",
          duration: 8000
        });
      }
    } catch (error) {
      toast({
        title: "❌ Неожиданная Ошибка",
        description: `Произошла неожиданная ошибка: ${error.message}`,
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setIsTestingOpenAI(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'] },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const handleSaveApiKey = () => {
    try {
      localStorage.setItem('ASSEMBLYAI_API_KEY', apiKey.trim());
      toast({
        title: "✅ API ключ сохранен",
        description: "Ключ AssemblyAI успешно сохранен в браузере",
        duration: 3000
      });
    } catch (error) {
      toast({
        title: "❌ Ошибка сохранения",
        description: "Не удалось сохранить API ключ",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  // Функция генерации SRT контента
  const generateSRTContent = (transcriptData) => {
    if (!transcriptData?.utterances) return '';

    return transcriptData.utterances.map((utterance, index) => {
      const startTime = formatTimeForSRT(utterance.start);
      const endTime = formatTimeForSRT(utterance.end);
      const text = utterance.text || '';

      return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
    }).join('\n');
  };

  const formatTimeForSRT = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  };

  // Обработчик скачивания SRT
  const handleDownloadSRTWrapper = async (episode) => {
    try {
      console.log('[SRT Download] Episode data:', episode);

      if (!episode.transcript || episode.transcript.status !== 'completed') {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: getLocaleString('transcriptRequired', currentLanguage),
          variant: 'destructive'
        });
        return;
      }

      let transcriptData = episode.transcript.edited_transcript_data;
      
      if (!transcriptData) {
        console.log('[SRT Download] Loading edited_transcript_data from database...');
        toast({
          title: 'Загрузка данных...',
          description: 'Загружаем данные транскрипции',
        });

        const { data: fullTranscript, error: transcriptError } = await supabase
          .from('transcripts')
          .select('edited_transcript_data')
          .eq('episode_slug', episode.slug)
          .eq('lang', episode.lang)
          .single();

        if (transcriptError || !fullTranscript?.edited_transcript_data) {
          toast({
            title: getLocaleString('errorGeneric', currentLanguage),
            description: 'Не удалось загрузить данные транскрипции',
            variant: 'destructive'
          });
          return;
        }

        transcriptData = fullTranscript.edited_transcript_data;
      }
      
      if (!transcriptData.utterances || !Array.isArray(transcriptData.utterances) || transcriptData.utterances.length === 0) {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: 'Данные транскрипции пусты или повреждены',
          variant: 'destructive'
        });
        return;
      }

      console.log('[SRT Download] Utterances count:', transcriptData.utterances.length);

      const srtContent = generateSRTContent(transcriptData);
      
      if (!srtContent || srtContent.trim().length === 0) {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: 'Не удалось сгенерировать SRT контент',
          variant: 'destructive'
        });
        return;
      }

      console.log('[SRT Download] Generated SRT length:', srtContent.length);

      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${episode.slug || 'transcript'}_${episode.lang || 'unknown'}.srt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: getLocaleString('downloadStartedTitle', currentLanguage),
        description: getLocaleString('srtDownloaded', currentLanguage)
      });
    } catch (error) {
      console.error('[SRT Download] Error:', error);
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Ошибка скачивания SRT: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl bg-slate-800/70 rounded-xl shadow-2xl border border-slate-700/50">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate('/episodes')} 
          className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodes', currentLanguage)}
        </Button>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={loadEpisodes}
            disabled={isLoadingEpisodes}
            variant="outline"
            size="sm"
            className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
            title={getLocaleString('refresh', currentLanguage)}
          >
            {isLoadingEpisodes ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {getLocaleString('refresh', currentLanguage)}
          </Button>
          <Button
            onClick={handleTestOpenAI}
            disabled={isTestingOpenAI}
            variant="outline"
            size="sm"
            className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
          >
            {isTestingOpenAI ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="mr-2 h-4 w-4" />
            )}
            Тест DeepSeek
          </Button>
          <Button
            onClick={() => setShowApiKeyInput((v) => !v)}
            variant="outline"
            size="sm"
            className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
          >
            <Key className="mr-2 h-4 w-4" />
            API AssemblyAI
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-purple-300 mb-2">
          {getLocaleString('uploadAudioFiles', currentLanguage)}
        </h1>
        <p className="text-sm text-slate-400">
          {getLocaleString('uploadAudioDescription', currentLanguage)}
        </p>
      </div>

      {/* AssemblyAI API Key Input */}
      {showApiKeyInput && (
        <div className="mb-6 p-4 rounded-lg bg-slate-700/50 border border-slate-600">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            AssemblyAI API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={handleSaveApiKey}
            placeholder="sk_..."
            className="w-full h-10 px-3 rounded bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Ключ хранится локально в браузере
            </span>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSaveApiKey}
            >
              Сохранить
            </Button>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div 
        {...getRootProps({ 
          className: `p-8 border-2 border-dashed rounded-lg text-center cursor-pointer mb-6 transition-colors ${
            isDragActive 
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-slate-600 hover:border-slate-500'
          }` 
        })}
      >
        <input {...getInputProps()} style={{ display: 'none' }} />
        <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-3" />
        {isDragActive ? (
          <p className="text-purple-300 text-lg font-medium">
            {getLocaleString('dropFilesHere', currentLanguage)}
          </p>
        ) : (
          <>
            <p className="text-slate-300 text-lg font-medium mb-2">
              {getLocaleString('dragOrClickUpload', currentLanguage)}
            </p>
            <Button 
              type="button" 
              onClick={open} 
              variant="ghost" 
              className="mt-2 text-purple-300 hover:text-purple-200"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {getLocaleString('selectFiles', currentLanguage)}
            </Button>
            <p className="text-xs text-slate-500 mt-3">
              {getLocaleString('supportedFormats', currentLanguage)}
            </p>
          </>
        )}
      </div>

      {/* Upload Queue */}
      <UploadQueue
        filesToProcess={filesToProcess}
        onRemoveItem={handleRemoveItem}
        onStartUpload={handleStartUpload}
        isUploading={isUploadingQueue}
        currentLanguage={currentLanguage}
        onLoadFromDB={handleLoadFromDB}
      />

      {/* Upload Manager View */}
      {isLoadingEpisodes ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <span className="ml-3 text-slate-400">{getLocaleString('loadingEpisodes', currentLanguage)}</span>
        </div>
      ) : (
        episodes.length > 0 && (
          <UploadManageView
            filesToProcess={filesToProcess}
            episodes={episodes}
            onRemoveItem={handleRemoveItem}
            onTitleChange={handleTitleChange}
            currentLanguage={currentLanguage}
            onStartTranscription={handleStartTranscription}
            onDeleteTranscript={handleDeleteTranscript}
            onDeleteEpisode={handleDeleteEpisode}
            onDownloadSRT={handleDownloadSRTWrapper}
            onProcessWithAI={handleProcessWithAI}
            onLoadFromDB={handleLoadFromDB}
            onGenerateFromText={handleGenerateFromText}
            translateEpisode={translateEpisode}
            batchTranslateFromLanguage={batchTranslateFromLanguage}
            translatingFrom={translatingFrom}
            translationProgress={translationProgress}
          isTranscribing={isTranscribing}
          loadingFromDB={false}
          generatingFromText={false}
          />
        )
      )}

      {/* Overwrite Dialog */}
      {showOverwriteDialog && (
        <OverwriteDialog
          isOpen={showOverwriteDialog}
          onOpenChange={() => {}}
          onConfirm={confirmOverwrite}
          onCancel={cancelOverwrite}
          slug={currentItemForOverwrite?.episodeSlug || ''}
          currentLanguage={currentLanguage}
        />
      )}

      {/* Conflict Dialog */}
      <ConflictDialog
        isOpen={conflictDialog.isOpen}
        onClose={handleConflictCancel}
        fileItem={conflictDialog.fileItem}
        conflicts={conflictDialog.conflicts}
        onConfirm={handleConflictConfirm}
        onCancel={handleConflictCancel}
      />
    </div>
  );
};

export default UploadPage;

