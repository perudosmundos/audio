import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadCloud, Loader2, PlusCircle, ArrowLeft, Settings2, Trash2, Search, ShieldAlert, ListChecks, PenLine, Languages, HelpCircle, Star, Database } from 'lucide-react';
import { getLocaleString, getPluralizedLocaleString } from '@/lib/locales';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import r2Service from '@/lib/r2Service';
import useFileUploadManager from '@/hooks/useFileUploadManager';
import FileUploadItem from '@/components/uploader/FileUploadItem';
import OverwriteDialog from '@/components/uploader/OverwriteDialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatShortDate } from '@/lib/utils';
import assemblyAIService from '@/lib/assemblyAIService';
import { translateTextOpenAI, translateTranscriptFast, generateQuestionsOpenAI } from '@/lib/openAIService';
import { startPollingForItem } from '@/services/uploader/transcriptPoller';
import logger from '@/lib/logger';

const ApiKeyInlinePanel = () => {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('ASSEMBLYAI_API_KEY') || ''; } catch { return ''; }
  });
  return (
    <div className="mb-6 p-3 rounded-lg bg-slate-700/50 border border-slate-600">
      <label className="block text-xs text-slate-300 mb-1">AssemblyAI API Key</label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        onBlur={() => {
          try { localStorage.setItem('ASSEMBLYAI_API_KEY', apiKey.trim()); } catch {}
        }}
        placeholder="sk_..."
        className="w-full h-9 px-3 rounded bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">Ключ хранится локально в браузере</span>
        <Button
          size="sm"
          variant="secondary"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          onClick={() => {
            try { localStorage.setItem('ASSEMBLYAI_API_KEY', apiKey.trim()); } catch {}
          }}
        >Сохранить</Button>
      </div>
    </div>
  );
};

const ManageEpisodesList = ({ currentLanguage }) => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEpisodes, setSelectedEpisodes] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [episodesToDelete, setEpisodesToDelete] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteQuestionsDialog, setShowDeleteQuestionsDialog] = useState(false);
  const [episodeToDeleteQuestions, setEpisodeToDeleteQuestions] = useState(null);
  const [transcribingEpisodes, setTranscribingEpisodes] = useState(new Set());
  const [processingQuestionsEpisodes, setProcessingQuestionsEpisodes] = useState(new Set());
  const [translatingEpisodes, setTranslatingEpisodes] = useState(new Set());
  const [transferringTextEpisodes, setTransferringTextEpisodes] = useState(new Set());
  const [transferringQuestionsEpisodes, setTransferringQuestionsEpisodes] = useState(new Set());
  const [translationProgress, setTranslationProgress] = useState({});
  const [transcriptionProgress, setTranscriptionProgress] = useState({});
  const [loadingQuestionsFromDB, setLoadingQuestionsFromDB] = useState(new Set());
  const [failedTranscriptions, setFailedTranscriptions] = useState(new Set());
  const [translatedQuestions, setTranslatedQuestions] = useState(new Set()); // Отслеживание успешно переведенных вопросов
  const [questionsTranslationProgress, setQuestionsTranslationProgress] = useState({}); // Прогресс перевода вопросов
  const [pollingIntervalsRef] = useState({ current: {} });
  const { toast } = useToast();

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('episodes')
      .select(`
        slug, 
        title, 
        lang, 
        date, 
        r2_object_key, 
        r2_bucket_name, 
        file_has_lang_suffix, 
        audio_url,
        duration
      `)
      .order('date', { ascending: false });

    if (error) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorFetchingEpisodes', currentLanguage, { errorMessage: error.message }), variant: 'destructive' });
      setEpisodes([]);
    } else {
      // Получаем статусы транскрипций отдельным запросом
      const episodeSlugs = [...new Set(data.map(ep => ep.slug))];
      const { data: transcriptsData } = await supabase
        .from('transcripts')
        .select('episode_slug, lang, status, assemblyai_transcript_id')
        .in('episode_slug', episodeSlugs);

      // Получаем количество вопросов для каждого эпизода
      const { data: questionsData } = await supabase
        .from('questions')
        .select('episode_slug, lang')
        .in('episode_slug', episodeSlugs);

      // Объединяем данные
      const episodesWithData = data.map(episode => {
        const transcript = transcriptsData?.find(t => t.episode_slug === episode.slug && t.lang === episode.lang);
        const questionsCount = questionsData?.filter(q => q.episode_slug === episode.slug && q.lang === episode.lang).length || 0;
        
        return {
          ...episode,
          transcript,
          questionsCount
        };
      });

      // Автоматически загружаем вопросы из БД или генерируем их для эпизодов с готовыми транскриптами
      const episodesWithCompletedTranscripts = episodesWithData.filter(ep =>
        ep.transcript && ep.transcript.status === 'completed' && ep.questionsCount === 0
      );

      for (const episode of episodesWithCompletedTranscripts) {
        // Проверяем, есть ли вопросы в БД
        const { data: existingQuestions } = await supabase
          .from('questions')
          .select('title, time')
          .eq('episode_slug', episode.slug)
          .eq('lang', episode.lang);

        if (existingQuestions && existingQuestions.length > 0) {
          // Если вопросы есть в БД, обновляем счетчик
          setEpisodes(prev => prev.map(ep =>
            ep.slug === episode.slug && ep.lang === episode.lang
              ? { ...ep, questionsCount: existingQuestions.length }
              : ep
          ));
        } else {
          // Если вопросов нет в БД, запускаем автоматическую генерацию
          logger.info('[Auto Questions] Starting auto-generation for episode', { slug: episode.slug, lang: episode.lang });
          handleAutoGenerateQuestions(episode).catch(error => {
            logger.error('[Auto Questions] Auto-generation failed', { slug: episode.slug, lang: episode.lang, error: error.message });
          });
        }
      }

      setEpisodes(episodesWithData || []);
    }
    setLoading(false);
  }, [currentLanguage, toast]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  // Очистка polling интервалов при размонтировании
  useEffect(() => {
    return () => {
      // Очищаем все активные polling интервалы
      Object.values(pollingIntervalsRef.current).forEach(intervalId => {
        if (intervalId) clearInterval(intervalId);
      });
    };
  }, [pollingIntervalsRef]);

  // Периодическая проверка статуса транскрипции
  useEffect(() => {
    const checkTranscriptStatus = async () => {
      const processingEpisodes = episodes.filter(ep => 
        ep.transcript && ep.transcript.status === 'processing' && ep.transcript.assemblyai_transcript_id
      );

      if (processingEpisodes.length === 0) return;

      try {
        const episodeSlugs = [...new Set(processingEpisodes.map(ep => ep.slug))];
        
        // Получаем обновленные статусы транскрипций
        const { data: transcriptsData } = await supabase
          .from('transcripts')
          .select('episode_slug, lang, status, assemblyai_transcript_id')
          .in('episode_slug', episodeSlugs)
          .in('lang', processingEpisodes.map(ep => ep.lang));

        // Получаем обновленное количество вопросов
        const { data: questionsData } = await supabase
          .from('questions')
          .select('episode_slug, lang')
          .in('episode_slug', episodeSlugs);

        if (transcriptsData || questionsData) {
          setEpisodes(prev => prev.map(episode => {
            let updated = false;
            let updatedEpisode = { ...episode };

            // Обновляем статус транскрипции
            const updatedTranscript = transcriptsData?.find(t => 
              t.episode_slug === episode.slug && t.lang === episode.lang
            );
            if (updatedTranscript && updatedTranscript.status !== episode.transcript?.status) {
              updatedEpisode.transcript = updatedTranscript;
              updated = true;
              
              // Автоматически обновляем состояние кнопки распознавания
              if (updatedTranscript.status === 'completed') {
                setTranscriptionProgress(prev => ({
                  ...prev,
                  [`${episode.slug}-${episode.lang}`]: { 
                    message: 'Распознавание завершено!',
                    status: 'completed'
                  }
                }));
                
                // Очищаем прогресс через некоторое время
                setTimeout(() => {
                  setTranscriptionProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[`${episode.slug}-${episode.lang}`];
                    return newProgress;
                  });
                }, 15000); // Увеличиваем время до 15 секунд
              } else if (updatedTranscript.status === 'error') {
                setTranscriptionProgress(prev => ({
                  ...prev,
                  [`${episode.slug}-${episode.lang}`]: { 
                    message: 'Ошибка распознавания',
                    status: 'error'
                  }
                }));
                
                // Очищаем ошибку через некоторое время
                setTimeout(() => {
                  setTranscriptionProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[`${episode.slug}-${episode.lang}`];
                    return newProgress;
                  });
                }, 20000); // Увеличиваем время до 20 секунд
              }
            }

            // Обновляем количество вопросов
            const updatedQuestionsCount = questionsData?.filter(q => 
              q.episode_slug === episode.slug && q.lang === episode.lang
            ).length || 0;
            if (updatedQuestionsCount !== episode.questionsCount) {
              updatedEpisode.questionsCount = updatedQuestionsCount;
              updated = true;
            }

            return updated ? updatedEpisode : episode;
          }));
        }
      } catch (error) {
        console.warn('Error checking transcript status:', error);
      }
    };

    const interval = setInterval(checkTranscriptStatus, 5000); // Проверяем каждые 5 секунд для более быстрого обновления
    return () => clearInterval(interval);
  }, [episodes]);

  // Группировка эпизодов сначала по дате, затем по имени файла (r2_object_key)
  const groupedEpisodes = episodes.reduce((groups, episode) => {
    const dateKey = episode.date || 'unknown';
    if (!groups[dateKey]) {
      groups[dateKey] = {};
    }
    
    // Используем r2_object_key как имя файла, если его нет - используем slug
    const fileName = episode.r2_object_key || episode.slug;
    
    if (!groups[dateKey][fileName]) {
      groups[dateKey][fileName] = [];
    }
    groups[dateKey][fileName].push(episode);
    return groups;
  }, {});

  // Сортировка групп по дате (самая новая первая)
  const sortedGroups = Object.entries(groupedEpisodes)
    .sort(([dateA], [dateB]) => {
      if (dateA === 'unknown') return 1;
      if (dateB === 'unknown') return -1;
      return new Date(dateB) - new Date(dateA);
    });



  const filteredGroups = sortedGroups.filter(([date, fileNameGroups]) => {
    const prefix = getLocaleString('meditationTitlePrefix', currentLanguage);
    let datePart = '';
    if (date !== 'unknown') datePart = formatShortDate(date, currentLanguage);
    const episodeComputedTitle = datePart ? `${prefix} ${datePart}` : prefix;
    
    // Проверяем заголовок и все имена файлов в группе
    const titleMatch = episodeComputedTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const fileNameMatch = Object.keys(fileNameGroups).some(fileName => 
      fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return titleMatch || fileNameMatch;
  });



  const handleSelectEpisode = (slug, lang) => {
    const id = `${slug}-${lang}`;
    setSelectedEpisodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selectedEpisodes).every(Boolean) && Object.keys(selectedEpisodes).length === episodes.length && episodes.length > 0;
    const newSelectedEpisodes = {};
    if (!allSelected) {
      episodes.forEach(ep => {
        newSelectedEpisodes[`${ep.slug}-${ep.lang}`] = true;
      });
    }
    setSelectedEpisodes(newSelectedEpisodes);
  };

  const numSelected = Object.values(selectedEpisodes).filter(Boolean).length;

  const handleDeleteClick = (episode) => {
    setEpisodesToDelete([episode]);
    setShowDeleteDialog(true);
  };
  
  const handleDeleteAllQuestions = (episode) => {
    logger.info('[Delete All Questions] Dialog opened', { slug: episode.slug, lang: episode.lang, questionsCount: episode.questionsCount });
    setEpisodeToDeleteQuestions(episode);
    setShowDeleteQuestionsDialog(true);
  };
  
  const handleDeleteSelectedClick = () => {
    const toDelete = episodes.filter(ep => selectedEpisodes[`${ep.slug}-${ep.lang}`]);
    if (toDelete.length > 0) {
      setEpisodesToDelete(toDelete);
      setShowDeleteDialog(true);
    }
  };

  // Функция для запуска распознавания текста
  const handleStartTranscription = async (episode) => {
    if (!episode.audio_url && !episode.r2_object_key) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: 'Аудиофайл недоступен для распознавания', 
        variant: 'destructive' 
      });
      return;
    }

    // Проверяем, не запущена ли уже транскрипция
    if (episode.transcript && episode.transcript.status === 'processing') {
      toast({ 
        title: 'Транскрипция уже запущена', 
        description: 'Дождитесь завершения текущего процесса', 
        variant: 'info' 
      });
      return;
    }

    // Проверяем, не готова ли уже транскрипция
    if (episode.transcript && episode.transcript.status === 'completed') {
      toast({ 
        title: 'Транскрипция уже готова', 
        description: 'Текст уже распознан и готов к использованию', 
        variant: 'info' 
      });
      return;
    }

    setTranscribingEpisodes(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));
    
    // Обновляем прогресс распознавания
    setTranscriptionProgress(prev => ({
      ...prev,
      [`${episode.slug}-${episode.lang}`]: { 
        message: 'Подготовка к распознаванию...',
        status: 'preparing'
      }
    }));

    try {
      // Получаем URL аудиофайла
      setTranscriptionProgress(prev => ({
        ...prev,
        [`${episode.slug}-${episode.lang}`]: { 
          message: 'Получение аудиофайла...',
          status: 'getting_audio'
        }
      }));
      
      let audioUrl = episode.audio_url;
      if (!audioUrl && episode.r2_object_key) {
        // Если нет прямого URL, получаем из R2
        const { data: r2Data } = await supabase
          .from('episodes')
          .select('audio_url')
          .eq('slug', episode.slug)
          .eq('lang', episode.lang)
          .single();
        audioUrl = r2Data?.audio_url;
      }

      if (!audioUrl) {
        throw new Error('Не удалось получить URL аудиофайла');
      }

      // Запускаем распознавание
      setTranscriptionProgress(prev => ({
        ...prev,
        [`${episode.slug}-${episode.lang}`]: { 
          message: 'Отправка в AssemblyAI...',
          status: 'submitting'
        }
      }));
      
      const job = await assemblyAIService.submitTranscription(
        audioUrl, 
        episode.lang === 'all' ? 'es' : episode.lang,
        episode.slug,
        currentLanguage,
        episode.lang
      );

      const transcriptId = job?.id;
      const jobStatus = job?.status || 'processing';
      if (!transcriptId) throw new Error('AssemblyAI не вернул идентификатор задания (id)');

      // Обновляем прогресс - задание отправлено
      setTranscriptionProgress(prev => ({
        ...prev,
        [`${episode.slug}-${episode.lang}`]: { 
          message: 'Задание отправлено, ожидание обработки...',
          status: 'submitted'
        }
      }));

      // Сохраняем информацию о транскрипции в базу
      setTranscriptionProgress(prev => ({
        ...prev,
        [`${episode.slug}-${episode.lang}`]: { 
          message: 'Сохранение в базу данных...',
          status: 'saving_db'
        }
      }));
      
      const transcriptPayload = {
        episode_slug: episode.slug,
        lang: episode.lang,
        assemblyai_transcript_id: transcriptId,
        status: jobStatus
      };

      const { error: transcriptDbError } = await supabase
        .from('transcripts')
        .upsert(transcriptPayload, { onConflict: 'episode_slug,lang' });

      if (transcriptDbError) throw transcriptDbError;

      // Запускаем автоматический polling для отслеживания статуса
      const itemData = {
        id: `${episode.slug}-${episode.lang}`,
        episodeSlug: episode.slug,
        lang: episode.lang,
        episodeTitle: episode.title,
        transcriptionStatus: jobStatus,
        assemblyai_transcript_id: transcriptId
      };

      // Запускаем polling в фоне
      startPollingForItem(
        itemData,
        (itemId, updates) => {
          // Обновляем локальное состояние при изменении статуса
          setEpisodes(prev => prev.map(ep => 
            ep.slug === episode.slug && ep.lang === episode.lang 
              ? { ...ep, transcript: { ...ep.transcript, ...updates } }
              : ep
          ));
          
          // Обновляем прогресс распознавания
          if (updates.status === 'processing') {
            setTranscriptionProgress(prev => ({
              ...prev,
              [`${episode.slug}-${episode.lang}`]: { 
                message: 'Обработка аудио в AssemblyAI...',
                status: 'processing'
              }
            }));
          } else if (updates.status === 'completed') {
            setTranscriptionProgress(prev => ({
              ...prev,
              [`${episode.slug}-${episode.lang}`]: { 
                message: 'Распознавание завершено!',
                status: 'completed'
              }
            }));
            
                  // Автоматически очищаем прогресс через некоторое время
            setTimeout(() => {
              setTranscriptionProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[`${episode.slug}-${episode.lang}`];
                return newProgress;
              });
            }, 10000); // Очищаем через 10 секунд
          } else if (updates.status === 'error') {
            setTranscriptionProgress(prev => ({
              ...prev,
              [`${episode.slug}-${episode.lang}`]: { 
                message: `Ошибка: ${updates.transcriptionError || 'Неизвестная ошибка'}`,
                status: 'error'
              }
            }));
            
            // Очищаем ошибку через некоторое время
            setTimeout(() => {
              setTranscriptionProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[`${episode.slug}-${episode.lang}`];
                return newProgress;
              });
            }, 15000); // Очищаем через 15 секунд
          }
        },
        currentLanguage,
        toast,
        pollingIntervalsRef
      );

      toast({ 
        title: 'Распознавание запущено', 
        description: `Эпизод ${episode.slug} (${episode.lang})`, 
        variant: 'default' 
      });

      // Обновляем локальное состояние
      setEpisodes(prev => prev.map(ep => 
        ep.slug === episode.slug && ep.lang === episode.lang 
          ? { ...ep, transcript: { ...ep.transcript, status: jobStatus, assemblyai_transcript_id: transcriptId } }
          : ep
      ));

    } catch (error) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: `Ошибка запуска распознавания: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setTranscribingEpisodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${episode.slug}-${episode.lang}`);
        return newSet;
      });
      
      // Очищаем прогресс распознавания через некоторое время
      setTimeout(() => {
        setTranscriptionProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[`${episode.slug}-${episode.lang}`];
          return newProgress;
        });
      }, 8000); // Очищаем через 8 секунд
    }
  };

  // Загрузка вопросов из базы данных
  const handleLoadQuestionsFromDB = async (episode) => {
    logger.info('[Load Questions from DB] Start', { slug: episode.slug, lang: episode.lang });
    setLoadingQuestionsFromDB(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));

    try {
      // Проверяем, есть ли вопросы в БД
      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('title, time')
            .eq('episode_slug', episode.slug)
        .eq('lang', episode.lang)
        .order('time');

      if (qErr) throw qErr;

      if (!questionsData || questionsData.length === 0) {
        logger.warn('[Load Questions from DB] No questions found in DB, starting auto-generation', { slug: episode.slug, lang: episode.lang });
        // Если вопросов нет в БД, запускаем автоматическую генерацию
        await handleAutoGenerateQuestions(episode);
        return;
      }

      logger.info('[Load Questions from DB] Questions loaded', { slug: episode.slug, count: questionsData.length });
          
          // Обновляем локальное состояние
          setEpisodes(prev => prev.map(ep => 
            ep.slug === episode.slug && ep.lang === episode.lang 
          ? { ...ep, questionsCount: questionsData.length }
              : ep
          ));
          
          toast({ 
        title: 'Вопросы загружены',
        description: `Загружено ${questionsData.length} вопросов из базы данных`,
            variant: 'default' 
          });
          
    } catch (error) {
      logger.error('[Load Questions from DB] Failed', { slug: episode.slug, lang: episode.lang, error: error.message });
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Ошибка загрузки вопросов: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoadingQuestionsFromDB(prev => {
        const s = new Set(prev);
        s.delete(`${episode.slug}-${episode.lang}`);
        return s;
      });
    }
  };

  // Функция для автоматического распознавания вопросов через ИИ
  const handleAutoGenerateQuestions = async (episode) => {
    logger.info('[AI-Questions] Start generation', { slug: episode.slug, lang: episode.lang });
    if (!episode.transcript || episode.transcript.status !== 'completed') {
      logger.warn('[AI-Questions] Transcript not ready', { slug: episode.slug, lang: episode.lang, status: episode.transcript?.status });
      toast({ 
        title: 'Требуется транскрипция', 
        description: 'Сначала нужно распознать текст эпизода', 
        variant: 'warning' 
      });
      return;
    }

    setProcessingQuestionsEpisodes(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));

    try {
      // Получаем данные транскрипции
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .select('edited_transcript_data')
        .eq('episode_slug', episode.slug)
        .eq('lang', episode.lang)
        .single();

      if (transcriptError) throw transcriptError;

              const transcriptInfo = transcriptData.edited_transcript_data;
      if (!transcriptInfo) {
        throw new Error('Данные транскрипции не найдены');
      }

      logger.debug('[AI-Questions] Transcript data loaded', {
        slug: episode.slug, 
        lang: episode.lang, 
        hasText: !!transcriptInfo.text,
        utterancesCount: transcriptInfo.utterances?.length || 0
      });

      // Используем новую функцию для генерации вопросов через ИИ
      const questions = await generateQuestionsOpenAI(transcriptInfo, episode.lang, currentLanguage);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Не удалось сгенерировать вопросы');
      }
      
      // Логируем сгенерированные вопросы для отладки
      logger.info('[AI-Questions] Questions generated', {
        slug: episode.slug, 
        lang: episode.lang, 
        count: questions.length,
        questions: questions.map(q => ({ title: q.title, time: q.time }))
      });

      // Сохраняем вопросы в базу данных
      const questionsToInsert = questions.map((q, index) => ({
          episode_slug: episode.slug,
          lang: episode.lang,
        title: q.title,
        time: Number(q.time ?? 0)
      }));

      // Удаляем существующие вопросы только для конкретного языка
      await supabase
        .from('questions')
        .delete()
        .eq('episode_slug', episode.slug)
        .eq('lang', episode.lang);

      // Вставляем новые вопросы
      const { error: insertError } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (insertError) throw insertError;

      logger.info('[AI-Questions] Questions saved', {
        slug: episode.slug,
        lang: episode.lang,
        count: questionsToInsert.length
      });

      toast({ 
        title: 'Вопросы сгенерированы', 
        description: `Создано ${questions.length} вопросов для эпизода ${episode.slug} (${episode.lang})`, 
        variant: 'default' 
      });

      // Обновляем локальное состояние только для конкретного языка
      setEpisodes(prev => prev.map(ep => 
        ep.slug === episode.slug && ep.lang === episode.lang
          ? { ...ep, questionsCount: questions.length }
          : ep
      ));

    } catch (error) {
      logger.error('[AI-Questions] Generation failed', { slug: episode.slug, lang: episode.lang, error: error.message });
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: `Ошибка генерации вопросов: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setProcessingQuestionsEpisodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${episode.slug}-${episode.lang}`);
        return newSet;
      });
      logger.info('[AI-Questions] Finished', { slug: episode.slug, lang: episode.lang });
    }
  };

  // Перевод транскрипта ES -> EN для английской дорожки
  const handleTranslateTranscriptFromSpanishForEnglish = async (englishEpisode) => {
    logger.info('[Translate Transcript ES->EN] Start', { slug: englishEpisode.slug });
    setTransferringTextEpisodes(prev => new Set(prev).add(`${englishEpisode.slug}-en`));
    try {
      // Пытаемся найти испанский эпизод по r2_object_key, затем по slug
      let spanishEpisode = null;
      if (englishEpisode.r2_object_key) {
        const { data } = await supabase
          .from('episodes')
          .select('slug, title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
          .eq('r2_object_key', englishEpisode.r2_object_key)
          .eq('lang', 'es')
          .maybeSingle();
        spanishEpisode = data || null;
      }
      if (!spanishEpisode) {
        const esSlug = englishEpisode.slug.replace(/_en$/, '_es');
        const { data } = await supabase
          .from('episodes')
          .select('slug, title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
          .eq('slug', esSlug)
          .eq('lang', 'es')
          .maybeSingle();
        spanishEpisode = data || null;
      }
      if (!spanishEpisode) {
        logger.warn('[Translate Transcript ES->EN] Spanish episode not found', { slug: englishEpisode.slug });
        throw new Error('Испанский эпизод не найден');
      }

      // Читаем испанский текст
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .select('status, edited_transcript_data')
        .eq('episode_slug', spanishEpisode.slug)
        .eq('lang', 'es')
        .maybeSingle();
      if (transcriptError) throw transcriptError;
      if (!transcriptData || transcriptData.status !== 'completed') {
        logger.warn('[Translate Transcript ES->EN] Spanish transcript not ready', { spanishSlug: spanishEpisode.slug, status: transcriptData?.status });
        throw new Error('Испанская транскрипция не готова');
      }
      
      // Получаем данные транскрипта с сегментами
              const sourceTranscriptData = transcriptData.edited_transcript_data;
      if (!sourceTranscriptData) {
        logger.warn('[Translate Transcript ES->EN] Spanish transcript empty', { spanishSlug: spanishEpisode.slug });
        throw new Error('Текст испанской транскрипции не найден');
      }

      // Переводим транскрипт с сегментами на EN
      const translatedTranscriptData = await translateTranscriptFast(
        sourceTranscriptData, 
        'en', 
        currentLanguage,
        (progress, total, message) => {
          setTranslationProgress(prev => ({
            ...prev,
            [englishEpisode.slug]: { progress, total, message }
          }));
        }
      );
      logger.debug('[Translate Transcript ES->EN] Transcript translated', { slug: englishEpisode.slug, utterancesCount: translatedTranscriptData?.utterances?.length });
      if (!translatedTranscriptData || !translatedTranscriptData.utterances) throw new Error('Не удалось перевести транскрипт');

      // Гарантируем наличие EN эпизода
      const { data: existingEn } = await supabase
        .from('episodes')
        .select('slug')
        .eq('slug', englishEpisode.slug)
        .eq('lang', 'en')
        .maybeSingle();
      if (!existingEn) {
        const payload = {
          slug: englishEpisode.slug,
          title: spanishEpisode.title,
          lang: 'en',
          date: spanishEpisode.date,
          audio_url: spanishEpisode.audio_url,
          r2_object_key: spanishEpisode.r2_object_key,
          r2_bucket_name: spanishEpisode.r2_bucket_name,
          duration: spanishEpisode.duration,
          file_has_lang_suffix: spanishEpisode.file_has_lang_suffix,
        };
        const { error: createErr } = await supabase.from('episodes').insert(payload);
        if (createErr) console.warn('Create EN episode error:', createErr);
      }

      // Сохраняем EN транскрипт с переведенными сегментами
      const { error: upsertErr } = await supabase
        .from('transcripts')
        .upsert({
          episode_slug: englishEpisode.slug,
          lang: 'en',
          status: 'completed',
          edited_transcript_data: translatedTranscriptData,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'episode_slug,lang' });
      if (upsertErr) throw upsertErr;
      logger.info('[Translate Transcript ES->EN] Saved', { slug: englishEpisode.slug, utterancesCount: translatedTranscriptData.utterances.length });

      toast({ title: 'Транскрипт переведен', description: `EN транскрипт для ${englishEpisode.slug} создан с ${translatedTranscriptData.utterances.length} сегментами`, variant: 'default' });

      setEpisodes(prev => prev.map(ep => ep.slug === englishEpisode.slug && ep.lang === 'en' ? { ...ep, transcript: { status: 'completed' } } : ep));
    } catch (error) {
      logger.error('[Translate Transcript ES->EN] Failed', { slug: englishEpisode.slug, error: error.message });
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Ошибка перевода транскрипта: ${error.message}`, variant: 'destructive' });
    } finally {
      setTransferringTextEpisodes(prev => { const s = new Set(prev); s.delete(`${englishEpisode.slug}-en`); return s; });
      setTranslationProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[englishEpisode.slug];
        return newProgress;
      });
      logger.info('[Translate Transcript ES->EN] Finished', { slug: englishEpisode.slug });
    }
  };

  // Перевод вопросов (ES/RU) -> EN для английской дорожки
  const handleTranslateQuestionsToEnglish = async (englishEpisode, sourceLang) => {
    logger.info('[Translate Questions -> EN] Start', { targetSlug: englishEpisode.slug, sourceLang });
    const srcLabel = sourceLang === 'ru' ? 'русского' : 'испанского';
    setTransferringQuestionsEpisodes(prev => new Set(prev).add(`${englishEpisode.slug}-en-${sourceLang}`));
    
    // Устанавливаем прогресс перевода
    setQuestionsTranslationProgress(prev => ({
      ...prev,
      [`${englishEpisode.slug}-en-${sourceLang}`]: { 
        message: 'Подготовка к переводу вопросов...',
        status: 'preparing'
      }
    }));
    try {
      // Находим исходный эпизод по r2_object_key
      setQuestionsTranslationProgress(prev => ({
        ...prev,
        [`${englishEpisode.slug}-en-${sourceLang}`]: { 
          message: 'Поиск исходного эпизода...',
          status: 'searching'
        }
      }));
      
      const { data: sourceEpisode } = await supabase
        .from('episodes')
        .select('slug')
        .eq('r2_object_key', englishEpisode.r2_object_key)
        .eq('lang', sourceLang)
        .maybeSingle();
      if (!sourceEpisode) {
        logger.warn('[Translate Questions -> EN] Source episode not found', { targetSlug: englishEpisode.slug, sourceLang });
        throw new Error(`Эпизод ${srcLabel} языка не найден`);
      }

      // Загружаем вопросы из базы данных
      setQuestionsTranslationProgress(prev => ({
        ...prev,
        [`${englishEpisode.slug}-en-${sourceLang}`]: { 
          message: 'Загрузка вопросов из базы данных...',
          status: 'loading_questions'
        }
      }));
      
      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('title, time')
        .eq('episode_slug', sourceEpisode.slug)
        .eq('lang', sourceLang)
        .order('time');
      if (qErr) throw qErr;
      if (!questionsData || questionsData.length === 0) {
        logger.warn('[Translate Questions -> EN] No source questions', { sourceSlug: sourceEpisode.slug, sourceLang });
        throw new Error('Вопросы не найдены');
      }

      // Валидируем и исправляем данные исходных вопросов
      const validatedQuestionsData = questionsData.map((q, i) => ({
        title: q.title || `Вопрос ${i + 1}`,
        time: Number.isFinite(q.time) ? q.time : i * 10
      }));

      logger.debug('[Translate Questions -> EN] Source questions fetched and validated', { count: validatedQuestionsData.length });

      // Переводим вопросы на английский
      setQuestionsTranslationProgress(prev => ({
        ...prev,
        [`${englishEpisode.slug}-en-${sourceLang}`]: { 
          message: `Перевод ${validatedQuestionsData.length} вопросов через ИИ...`,
          status: 'translating'
        }
      }));
      
      const translatedQuestions = await Promise.all(validatedQuestionsData.map(async (q) => {
        // Переводим только заголовок вопроса, время оставляем неизменным
        const prompt = `Переведи следующий заголовок вопроса с ${srcLabel} на английский язык. Верни только переведенный текст без кавычек и дополнительных символов: "${q.title}"`;
        const translatedTitle = await translateTextOpenAI(prompt, 'en', currentLanguage);
        
        logger.debug('[Translate Questions -> EN] Question translation', {
          original: { title: q.title, time: q.time },
          translated: { title: translatedTitle.trim(), time: q.time }
        });
        
        return {
          title: translatedTitle.trim(),
          time: q.time // Сохраняем исходное время без изменений
        };
      }));

      // Обеспечиваем, что английский эпизод существует
      const { data: enEpisodeExists } = await supabase
        .from('episodes')
        .select('slug')
        .eq('slug', englishEpisode.slug)
        .eq('lang', 'en')
        .maybeSingle();
      if (!enEpisodeExists) {
        // Создаем на основе любого эпизода из группы (берем исходный)
        const baseEp = sourceEpisode;
        const payload = {
          slug: englishEpisode.slug,
          title: englishEpisode.title || '',
          lang: 'en',
          date: englishEpisode.date,
          audio_url: englishEpisode.audio_url,
          r2_object_key: englishEpisode.r2_object_key || baseEp.r2_object_key,
          r2_bucket_name: englishEpisode.r2_bucket_name,
          duration: englishEpisode.duration,
          file_has_lang_suffix: englishEpisode.file_has_lang_suffix,
        };
        await supabase.from('episodes').insert(payload);
      }

      // Сохраняем переведенные вопросы в базу данных
      setQuestionsTranslationProgress(prev => ({
        ...prev,
        [`${englishEpisode.slug}-en-${sourceLang}`]: { 
          message: 'Сохранение переведенных вопросов в базу данных...',
          status: 'saving'
        }
      }));
      
      // Заменяем существующие вопросы EN
      await supabase.from('questions').delete().eq('episode_slug', englishEpisode.slug).eq('lang', 'en');
      const toInsert = translatedQuestions.map((q, i) => ({
        episode_slug: englishEpisode.slug,
        lang: 'en',
        title: q.title,
        time: Number.isFinite(q.time) ? q.time : i * 10  // Если time не валидное число, используем индекс * 10
      }));
      const { error: insErr } = await supabase.from('questions').insert(toInsert);
      if (insErr) throw insErr;
      logger.info('[Translate Questions -> EN] Saved', { targetSlug: englishEpisode.slug, count: toInsert.length });

      setEpisodes(prev => prev.map(ep => ep.slug === englishEpisode.slug && ep.lang === 'en' ? { ...ep, questionsCount: toInsert.length } : ep));

      // Отмечаем, что перевод с этого языка выполнен
      setTranslatedQuestions(prev => new Set(prev).add(`${englishEpisode.slug}-en-${sourceLang}`));

      // Показываем статус "готово"
      setQuestionsTranslationProgress(prev => ({
        ...prev,
        [`${englishEpisode.slug}-en-${sourceLang}`]: { 
          message: 'Перевод вопросов завершен!',
          status: 'completed'
        }
      }));

      toast({ title: 'Вопросы переведены', description: `Создано ${toInsert.length} вопросов (EN)`, variant: 'default' });
      
      // Автоматически скрываем прогресс через некоторое время
      setTimeout(() => {
        setQuestionsTranslationProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[`${englishEpisode.slug}-en-${sourceLang}`];
          return newProgress;
        });
      }, 5000); // Скрываем через 5 секунд
    } catch (error) {
      logger.error('[Translate Questions -> EN] Failed', { targetSlug: englishEpisode.slug, sourceLang, error: error.message });
      
      // Показываем ошибку в прогрессе
      setQuestionsTranslationProgress(prev => ({
        ...prev,
        [`${englishEpisode.slug}-en-${sourceLang}`]: { 
          message: `Ошибка: ${error.message}`,
          status: 'error'
        }
      }));
      
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Ошибка перевода вопросов: ${error.message}`, variant: 'destructive' });
      
      // Скрываем ошибку через некоторое время
      setTimeout(() => {
        setQuestionsTranslationProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[`${englishEpisode.slug}-en-${sourceLang}`];
          return newProgress;
        });
      }, 8000); // Скрываем через 8 секунд
    } finally {
      setTransferringQuestionsEpisodes(prev => { const s = new Set(prev); s.delete(`${englishEpisode.slug}-en-${sourceLang}`); return s; });
      logger.info('[Translate Questions -> EN] Finished', { targetSlug: englishEpisode.slug, sourceLang });
    }
  };









  const confirmDelete = async () => {
    if (episodesToDelete.length === 0) return;
    setIsDeleting(true);

    let successCount = 0;
    let errorCount = 0;

    for (const episode of episodesToDelete) {
      try {
        const { slug, lang, r2_object_key, r2_bucket_name, title } = episode;
        
        // Удаляем вопросы только для конкретного языка
        const { error: questionsError } = await supabase
          .from('questions')
          .delete()
          .eq('episode_slug', slug)
          .eq('lang', lang);
        if (questionsError) throw new Error(getLocaleString('errorDeletingQuestions', currentLanguage, { errorMessage: questionsError.message }));

        // Удаляем транскрипции только для конкретного языка
        const { error: transcriptsError } = await supabase
          .from('transcripts')
          .delete()
          .eq('episode_slug', slug)
          .eq('lang', lang);
        if (transcriptsError) throw new Error(getLocaleString('errorDeletingTranscripts', currentLanguage, { errorMessage: transcriptsError.message }));
        
        // Удаляем файл из R2 только если это последний эпизод с таким slug
        const { data: remainingEpisodes } = await supabase
          .from('episodes')
          .select('slug')
          .eq('slug', slug);
        
        if (remainingEpisodes && remainingEpisodes.length === 1) {
          // Это последний эпизод с таким slug, удаляем файл
        if (r2_object_key && r2_bucket_name) {
          const deleteArchiveResult = await r2Service.deleteFile(r2_object_key, r2_bucket_name, currentLanguage);
          if (!deleteArchiveResult.success) {
             toast({ title: getLocaleString('warning', currentLanguage), description: getLocaleString('errorDeletingR2FilePartial', currentLanguage, {fileName: r2_object_key, errorMessage: deleteArchiveResult.error}), variant: 'destructive' });
          } else {
             toast({ title: getLocaleString('fileDeletedFromR2Title', currentLanguage), description: getLocaleString('fileDeletedFromR2Desc', currentLanguage, {fileName: r2_object_key}) });
              }
            }
          }

        // Удаляем эпизод только для конкретного языка
        const { error: episodeError } = await supabase
          .from('episodes')
          .delete()
          .eq('slug', slug)
          .eq('lang', lang);
        if (episodeError) throw new Error(getLocaleString('errorDeletingEpisodeDB', currentLanguage, { errorMessage: episodeError.message }));
        successCount++;
      } catch (error) {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `${getLocaleString('errorDeletingEpisodeDB', currentLanguage, {errorMessage: error.message})} (Episode: ${episode.title || episode.slug})`, variant: 'destructive' });
        errorCount++;
      }
    }
    
    if (successCount > 0) {
        toast({ title: getLocaleString('episodeDeletedTitle', currentLanguage), 
                description: `${successCount} ${getPluralizedLocaleString('episodeCount', currentLanguage, successCount, {count: successCount})} ${getLocaleString('deletedSuccessfully', currentLanguage) || 'deleted successfully'}.`
              });
    }

    fetchEpisodes();
    setSelectedEpisodes({});
    setIsDeleting(false);
    setShowDeleteDialog(false);
    setEpisodesToDelete([]);
  };

  const confirmDeleteAllQuestions = async () => {
    if (!episodeToDeleteQuestions) return;
    setIsDeleting(true);

    try {
      const { slug, lang } = episodeToDeleteQuestions;
      
      logger.info('[Delete All Questions] Starting', { slug, lang });

      // Удаляем все вопросы для эпизода
      const { error: questionsError } = await supabase
        .from('questions')
        .delete()
        .eq('episode_slug', slug)
        .eq('lang', lang);
      
      if (questionsError) {
        logger.error('[Delete All Questions] Database error', { slug, lang, error: questionsError.message });
        throw new Error(getLocaleString('errorDeletingQuestions', currentLanguage, { errorMessage: questionsError.message }));
      }

      logger.info('[Delete All Questions] Success', { slug, lang });

      toast({ 
        title: getLocaleString('questionsDeletedTitle', currentLanguage) || 'Вопросы удалены', 
        description: getLocaleString('questionsDeletedSuccess', currentLanguage) || `Все вопросы для эпизода ${episodeToDeleteQuestions.title || episodeToDeleteQuestions.slug} удалены` 
      });
      
      // Обновляем количество вопросов в текущем состоянии
      setEpisodes(prev => prev.map(ep =>
        ep.slug === slug && ep.lang === lang
          ? { ...ep, questionsCount: 0 }
          : ep
      ));

      // Очищаем состояние переведенных вопросов для этого эпизода
      setTranslatedQuestions(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${slug}-en-es`);
        newSet.delete(`${slug}-en-ru`);
        return newSet;
      });
    } catch (error) {
      console.error('Error deleting questions:', error);
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: getLocaleString('errorDeletingQuestions', currentLanguage, { errorMessage: error.message }) || `Ошибка при удалении вопросов: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteQuestionsDialog(false);
      setEpisodeToDeleteQuestions(null);
    }
  };
  
  const formatEpisodeTitle = (title, episodeDate, lang) => {
    const prefix = getLocaleString('meditationTitlePrefix', lang);
    let datePart = '';
    if (episodeDate) datePart = formatShortDate(episodeDate, lang);
    return datePart ? `${prefix} ${datePart}` : title || prefix;
  };

  // Функция для форматирования даты в формате DD.MM.YYYY
  const formatDateForDisplay = (dateString) => {
    if (!dateString || dateString === 'unknown') return 'Дата не указана';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}.${month}.${year}`;
    } catch (error) {
      return dateString;
    }
  };

  

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-purple-300 mb-2 flex items-center">
        <Settings2 className="mr-2 h-5 w-5"/>
        Список эпизодов
      </h2>
      <p className="text-sm text-slate-400 mb-4">Управляйте существующими эпизодами и их языковыми версиями</p>
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Input 
            type="text"
            placeholder="Поиск эпизодов..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700/80 border-slate-600 focus:border-purple-500 text-white placeholder-slate-400 h-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        </div>
        <Button onClick={fetchEpisodes} variant="outline" className="h-10 border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300 hover:text-white" disabled={loading}>
          <Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить список
        </Button>
        <Button onClick={handleSelectAll} variant="outline" className="h-10 border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300 hover:text-white" disabled={episodes.length === 0}>
           <ListChecks className="mr-2 h-4 w-4"/> {numSelected === episodes.length && episodes.length > 0 ? 'Снять выделение' : 'Выбрать все'} ({numSelected})
        </Button>
        <Button onClick={handleDeleteSelectedClick} variant="destructive" className="h-10" disabled={numSelected === 0 || isDeleting}>
          <Trash2 className="mr-2 h-4 w-4"/> Удалить выбранные ({numSelected})
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-purple-400" /></div>
      ) : filteredGroups.length === 0 ? (
        <p className="text-center text-slate-400 py-10">Эпизоды не найдены</p>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(([date, fileNameGroups]) => (
            <div key={date} className="bg-slate-700/60 rounded-lg border border-slate-600 overflow-hidden">
              {/* Заголовок группы */}
              <div className="p-2 bg-slate-600/50 border-b border-slate-500">
                <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-purple-200">
                        {date === 'unknown' ? 'Медитация' : `Медитация ${formatDateForDisplay(date)}`}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                      {Object.values(fileNameGroups).reduce((total, episodes) => total + episodes.length, 0)} {Object.values(fileNameGroups).reduce((total, episodes) => total + episodes.length, 0) === 1 ? 'эпизод' : Object.values(fileNameGroups).reduce((total, episodes) => total + episodes.length, 0) < 5 ? 'эпизода' : 'эпизодов'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {Object.keys(fileNameGroups).length} {Object.keys(fileNameGroups).length === 1 ? 'файл' : Object.keys(fileNameGroups).length < 5 ? 'файла' : 'файлов'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Список языковых версий */}
              <div className="p-1">
                <div className="space-y-0.5">
                  {Object.entries(fileNameGroups).map(([fileName, episodes]) => (
                    <div key={fileName} className="bg-slate-600/30 rounded-lg border border-slate-500">
                      <div className="p-1.5">
                            <h4 className="text-sm font-medium text-purple-200">
                              {fileName || 'Файл без имени'}
                            </h4>
                            <p className="text-xs text-slate-400">
                              {episodes.length} {episodes.length === 1 ? 'эпизод' : episodes.length < 5 ? 'эпизода' : 'эпизодов'}
                            </p>
                      </div>
                      <div className="p-1">
                        <div className="space-y-0.5">
                          {(function(){
                            const hasEs = episodes.some(e => e.lang === 'es');
                            const hasEn = episodes.some(e => e.lang === 'en');
                            let list = [...episodes];
                            if (hasEs && !hasEn) {
                              const es = episodes.find(e => e.lang === 'es');
                              list.push({
                                ...es,
                                slug: (es.slug || '').replace(/_es$/, '_en'),
                                lang: 'en',
                                transcript: { status: 'not_started' },
                                questionsCount: 0,
                                isPlaceholder: true,
                              });
                            }
                            return list;
                          })()
                            .sort((a, b) => {
                              // Сортировка в порядке: RU → ES → EN
                              const langOrder = { 'ru': 0, 'es': 1, 'en': 2 };
                              return (langOrder[a.lang] || 3) - (langOrder[b.lang] || 3);
                            })
                            .map(episode => {
                              const isTranscribing = transcribingEpisodes.has(`${episode.slug}-${episode.lang}`);
                              const hasAudio = episode.audio_url || episode.r2_object_key;
                              
                              return (
                                <div key={`${episode.slug}-${episode.lang}`} className={`flex items-center gap-2 p-1.5 rounded border ${episode.isPlaceholder ? 'border-dashed border-slate-500/70 bg-slate-600/10' : 'bg-slate-600/30 border-slate-500'}`}>
                                  <Checkbox
                                    id={`select-${episode.slug}-${episode.lang}`}
                                    checked={!!selectedEpisodes[`${episode.slug}-${episode.lang}`]}
                                    onCheckedChange={() => handleSelectEpisode(episode.slug, episode.lang)}
                                    className="border-slate-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                  />
                                  
                                  <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2">

                                      
                                      {/* Статус транскрипции */}
                                      {episode.transcript && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                          episode.transcript.status === 'completed' ? 'bg-green-600/70 text-green-100' :
                                          episode.transcript.status === 'processing' ? 'bg-yellow-600/70 text-yellow-100' :
                                          episode.transcript.status === 'error' ? 'bg-red-600/70 text-red-100' :
                                          'bg-gray-600/70 text-gray-100'
                                        }`}>
                                          {episode.transcript.status === 'completed' ? 'Готов' :
                                           episode.transcript.status === 'processing' ? 'Обраб.' :
                                           episode.transcript.status === 'error' ? 'Ошибка' :
                                           episode.transcript.status === 'not_started' ? 'Не запущ.' :
                                           episode.transcript.status}
                                        </span>
                                      )}
                                      
                                      {/* Количество вопросов */}
                                      {episode.questionsCount > 0 && (
                                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-600/70 text-orange-100">
                                            <HelpCircle className="inline h-3 w-3 mr-0.5" />
                                            {episode.questionsCount}
                                          </span>
                                      )}
                                      
                                      {/* Длительность */}
                                      {episode.duration && episode.duration > 0 && (
                                        <span className="text-xs text-slate-400">
                                          {Math.floor(episode.duration / 3600)}:{(Math.floor(episode.duration / 60) % 60).toString().padStart(2, '0')}:{(episode.duration % 60).toString().padStart(2, '0')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    {/* Кнопка распознавания текста (только для испанского и русского) */}
                                    {episode.lang !== 'en' && !episode.isPlaceholder && (
                                      <div className="flex flex-col items-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleStartTranscription(episode)}
                                        disabled={isTranscribing || !hasAudio || (episode.transcript && episode.transcript.status === 'processing')}
                                        className={`h-7 px-2 ${
                                            isTranscribing
                                              ? 'bg-purple-600/20 border-purple-500 text-purple-300 cursor-not-allowed'
                                              : episode.transcript && episode.transcript.status === 'completed' 
                                            ? 'bg-green-600/20 hover:bg-green-600/40 border-green-500 text-green-300 hover:text-green-200'
                                            : episode.transcript && episode.transcript.status === 'processing'
                                            ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300 cursor-not-allowed'
                                                  : hasAudio
                                                    ? 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500 text-purple-300 hover:text-purple-200'
                                                    : 'bg-gray-600/20 border-gray-500 text-gray-400 cursor-not-allowed'
                                        }`}
                                        title={
                                            isTranscribing
                                              ? 'Распознавание запущено...'
                                              : episode.transcript && episode.transcript.status === 'completed' 
                                            ? 'Транскрипция уже готова' 
                                            : episode.transcript && episode.transcript.status === 'processing'
                                                  ? 'Транскрипция уже обрабатывается в AssemblyAI'
                                            : hasAudio 
                                            ? 'Запустить распознавание текста' 
                                            : 'Аудиофайл недоступен'
                                        }
                                      >
                                        {isTranscribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
                                                                                    <span className="ml-1 text-xs">
                                            {isTranscribing
                                              ? 'Запущено...'
                                              : episode.transcript && episode.transcript.status === 'completed' 
                                                ? 'Готово' 
                                                : episode.transcript && episode.transcript.status === 'processing'
                                                  ? 'Ожидание...'
                                                  : episode.lang === 'ru' 
                                                    ? 'Распознать RU' 
                                                    : 'Распознать ES'
                                            }
                                          </span>
                                      </Button>
                                        {/* Статус распознавания */}
                                        {isTranscribing && (
                                          <div className="mt-1 text-xs text-purple-300">
                                            Запуск распознавания...
                                          </div>
                                        )}
                                        {episode.transcript && episode.transcript.status === 'processing' && !isTranscribing && (
                                          <div className="mt-1 text-xs text-yellow-300">
                                            Ожидание завершения в AssemblyAI...
                                          </div>
                                        )}
                                        {/* Прогресс распознавания - показываем всегда когда есть прогресс */}
                                        {transcriptionProgress[`${episode.slug}-${episode.lang}`] && (
                                          <div className="mt-1 text-xs text-purple-300">
                                            {transcriptionProgress[`${episode.slug}-${episode.lang}`].message}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Действия только для английской дорожки */}
                                    {episode.lang === 'en' && (
                                      <div className="flex flex-col items-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleTranslateTranscriptFromSpanishForEnglish(episode)}
                                          disabled={transferringTextEpisodes.has(`${episode.slug}-en`) || !episodes.some(ep => 
                                            ep.r2_object_key === episode.r2_object_key && 
                                            ep.lang === 'es' && 
                                            ep.transcript?.status === 'completed'
                                          )}
                                          className={`h-7 px-2 ${
                                            transferringTextEpisodes.has(`${episode.slug}-en`) 
                                              ? 'bg-purple-600/20 border-purple-500 text-purple-300 cursor-not-allowed'
                                              : episode.transcript && episode.transcript.status === 'completed'
                                                ? 'bg-green-600/20 border-green-500 text-green-300 cursor-not-allowed'
                                                : episodes.some(ep => 
                                                    ep.r2_object_key === episode.r2_object_key && 
                                                    ep.lang === 'es' && 
                                                    ep.transcript?.status === 'completed'
                                                  )
                                                    ? 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500 text-purple-300 hover:text-purple-200'
                                                    : 'bg-gray-600/20 border-gray-500 text-gray-400 cursor-not-allowed'
                                          }`}
                                          title={
                                            transferringTextEpisodes.has(`${episode.slug}-en`)
                                              ? 'Перевод в процессе...'
                                              : episode.transcript && episode.transcript.status === 'completed'
                                                ? 'Перевод уже выполнен'
                                                : episodes.some(ep => 
                                                    ep.r2_object_key === episode.r2_object_key && 
                                                    ep.lang === 'es' && 
                                                    ep.transcript?.status === 'completed'
                                                  )
                                                    ? 'Перевести с ES'
                                                    : 'Нет испанской транскрипции'
                                          }
                                      >
                                        {transferringTextEpisodes.has(`${episode.slug}-en`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                                          <span className="ml-1 text-xs">
                                            {episode.transcript && episode.transcript.status === 'completed' ? 'Переведено ✓' : 'Перевести с ES'}
                                          </span>
                                      </Button>
                                        {/* Прогресс перевода */}
                                        {translationProgress[episode.slug] && (
                                          <div className="mt-1 text-xs text-purple-300">
                                            {translationProgress[episode.slug].progress}% - {translationProgress[episode.slug].message}
                                          </div>
                                        )}
                                        
                                        {/* Статус завершенного перевода текста */}
                                        {!translationProgress[episode.slug] && episode.transcript && episode.transcript.status === 'completed' && (
                                          <div className="mt-1 text-xs text-green-300">
                                            Перевод текста завершен
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Кнопки для работы с вопросами (только для не английских версий) */}
                                    {episode.transcript && episode.transcript.status === 'completed' && episode.lang !== 'en' && (
                                      <div className="flex flex-col items-center gap-1">
                                        {episode.questionsCount > 0 ? (
                                          // Если вопросы есть - показываем кнопку удаления
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setEpisodeToDeleteQuestions(episode);
                                              setShowDeleteQuestionsDialog(true);
                                            }}
                                            className="h-7 px-2 bg-red-600/20 hover:bg-red-600/40 border-red-500 text-red-300 hover:text-red-200"
                                            title="Удалить все вопросы"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            <span className="ml-1 text-xs">Удалить ({episode.questionsCount})</span>
                                          </Button>
                                        ) : (
                                          // Если вопросов нет - показываем две кнопки
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleLoadQuestionsFromDB(episode)}
                                              disabled={loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`)}
                                              className={`h-7 px-2 ${
                                                loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`)
                                                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 cursor-not-allowed'
                                                  : 'bg-blue-600/20 hover:bg-blue-600/40 border-blue-500 text-blue-300 hover:text-blue-200'
                                              }`}
                                              title="Загрузить вопросы из базы данных"
                                            >
                                              {loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`) ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Database className="h-3 w-3" />
                                              )}
                                              <span className="ml-1 text-xs">
                                                {loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`)
                                                  ? 'Загрузка...'
                                                  : 'Загрузить из БД'
                                                }
                                              </span>
                                            </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAutoGenerateQuestions(episode)}
                                              disabled={processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`)}
                                              className={`h-7 px-2 ${
                                                processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`)
                                                  ? 'bg-purple-600/20 border-purple-500 text-purple-300 cursor-not-allowed'
                                                  : 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500 text-purple-300 hover:text-purple-200'
                                              }`}
                                        title="Автоматически сгенерировать вопросы через ИИ"
                                      >
                                        {processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`) ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Star className="h-3 w-3" />
                                        )}
                                              <span className="ml-1 text-xs">
                                                {processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`)
                                                  ? 'Генерация...'
                                                  : 'Распознать'
                                                }
                                              </span>
                                      </Button>
                                          </>
                                        )}

                                        {/* Статус загрузки из БД */}
                                        {loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`) && (
                                          <div className="mt-1 text-xs text-blue-300">
                                            Загрузка из БД...
                                          </div>
                                        )}

                                        {/* Статус генерации вопросов */}
                                        {processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`) && (
                                          <div className="mt-1 text-xs text-purple-300">
                                            Генерация вопросов...
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Кнопки вопросов на английской дорожке */}
                                    {episode.lang === 'en' && (
                                      <div className="flex flex-col items-center gap-1">
                                        {/* Кнопки перевода вопросов */}
                                        <div className="flex flex-col items-center gap-1">
                                          {/* Кнопка перевода с испанского */}
                                          {episode.lang === 'en' && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleTranslateQuestionsToEnglish(episode, 'es')}
                                              disabled={transferringQuestionsEpisodes.has(`${episode.slug}-en-es`)}
                                              className={`h-7 px-2 ${
                                                transferringQuestionsEpisodes.has(`${episode.slug}-en-es`)
                                                  ? 'bg-purple-600/20 border-purple-500 text-purple-300 cursor-not-allowed'
                                                  : translatedQuestions.has(`${episode.slug}-en-es`)
                                                    ? 'bg-green-600/20 border-green-500 text-green-300 cursor-not-allowed'
                                                    : 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500 text-purple-300 hover:text-purple-200'
                                              }`}
                                              title={
                                                transferringQuestionsEpisodes.has(`${episode.slug}-en-es`)
                                                  ? 'Перевод вопросов с ES в процессе...'
                                                  : translatedQuestions.has(`${episode.slug}-en-es`)
                                                    ? 'Вопросы с ES уже переведены'
                                                    : 'Перевести вопросы с испанского'
                                              }
                                            >
                                              {transferringQuestionsEpisodes.has(`${episode.slug}-en-es`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <HelpCircle className="h-3 w-3" />}
                                              <span className="ml-1 text-xs">
                                                {translatedQuestions.has(`${episode.slug}-en-es`) ? 'ES ✓' : 'Вопросы ES'}
                                              </span>
                                            </Button>
                                          )}

                                          {/* Кнопка перевода с русского */}
                                          {episode.lang === 'en' && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleTranslateQuestionsToEnglish(episode, 'ru')}
                                              disabled={transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`)}
                                              className={`h-7 px-2 ${
                                                transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`)
                                                  ? 'bg-purple-600/20 border-purple-500 text-purple-300 cursor-not-allowed'
                                                  : translatedQuestions.has(`${episode.slug}-en-ru`)
                                                    ? 'bg-green-600/20 border-green-500 text-green-300 cursor-not-allowed'
                                                    : 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500 text-purple-300 hover:text-purple-200'
                                              }`}
                                              title={
                                                transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`)
                                                  ? 'Перевод вопросов с RU в процессе...'
                                                  : translatedQuestions.has(`${episode.slug}-en-ru`)
                                                    ? 'Вопросы с RU уже переведены'
                                                    : 'Перевести вопросы с русского'
                                              }
                                            >
                                              {transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <HelpCircle className="h-3 w-3" />}
                                              <span className="ml-1 text-xs">
                                                {translatedQuestions.has(`${episode.slug}-en-ru`) ? 'RU ✓' : 'Вопросы RU'}
                                              </span>
                                            </Button>
                                          )}
                                        </div>

                                        {/* Кнопка удаления переведенных вопросов */}
                                        {episode.questionsCount > 0 && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setEpisodeToDeleteQuestions(episode);
                                              setShowDeleteQuestionsDialog(true);
                                            }}
                                            className="h-7 px-2 bg-red-600/20 hover:bg-red-600/40 border-red-500 text-red-300 hover:text-red-200"
                                            title="Удалить переведенные вопросы"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            <span className="ml-1 text-xs">Удалить ({episode.questionsCount})</span>
                                          </Button>
                                        )}

                                        {/* Статус перевода вопросов */}
                                        {(transferringQuestionsEpisodes.has(`${episode.slug}-en-es`) || transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`)) && (
                                          <div className="mt-1 text-xs text-purple-300">
                                            {questionsTranslationProgress[`${episode.slug}-en-es`]?.message || 
                                             questionsTranslationProgress[`${episode.slug}-en-ru`]?.message || 
                                             'Перевод вопросов...'}
                                          </div>
                                        )}
                                        
                                        {/* Статус завершенного перевода */}
                                        {!transferringQuestionsEpisodes.has(`${episode.slug}-en-es`) && 
                                         !transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`) && 
                                         (translatedQuestions.has(`${episode.slug}-en-es`) || translatedQuestions.has(`${episode.slug}-en-ru`)) && (
                                          <div className="mt-1 text-xs text-green-300">
                                            {translatedQuestions.has(`${episode.slug}-en-es`) && translatedQuestions.has(`${episode.slug}-en-ru`) 
                                              ? 'Переводы ES и RU завершены' 
                                              : translatedQuestions.has(`${episode.slug}-en-es`) 
                                                ? 'Перевод с ES завершен' 
                                                : 'Перевод с RU завершен'}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Кнопки управления */}
                                    {episode.isPlaceholder ? (
                                      <div className="flex flex-col items-center">
                                        {/* Placeholder эпизод - показываем информацию и кнопку создания */}
                                        <div className="text-xs text-slate-400 px-2 py-1 bg-slate-600/30 rounded mb-1">
                                          Создать EN версию
                                        </div>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleTranslateTranscriptFromSpanishForEnglish(episode)} 
                                        className="h-7 px-2 bg-green-600/20 hover:bg-green-600/40 border-green-500 text-green-300 hover:text-green-200" 
                                        disabled={transferringTextEpisodes.has(`${episode.slug}-en`)}
                                        title="Создать английскую версию"
                                      >
                                        {transferringTextEpisodes.has(`${episode.slug}-en`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
                                          <span className="ml-1 text-xs">Создать EN</span>
                                      </Button>
                                        {/* Статус создания */}
                                        {transferringTextEpisodes.has(`${episode.slug}-en`) && (
                                          <div className="mt-1 text-xs text-green-300">
                                            Создание EN версии...
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex gap-1">
                                        {/* Кнопка удаления эпизода */}
                                        <div className="flex flex-col items-center">
                                        <Button 
                                          variant="destructive" 
                                          size="sm" 
                                          onClick={() => handleDeleteClick(episode)} 
                                          className="h-7 px-2 bg-red-700 hover:bg-red-800 text-white shrink-0" 
                                          disabled={isDeleting}
                                            title="Удалить эпизод"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                            <span className="ml-1 text-xs">Удалить</span>
                                        </Button>
                                          {/* Статус удаления */}
                                          {isDeleting && (
                                            <div className="mt-1 text-xs text-red-300">
                                              Удаление...
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showDeleteDialog && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400 flex items-center"><ShieldAlert className="h-6 w-6 mr-2" />{getLocaleString('confirmDeleteTitle', currentLanguage)}</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                { episodesToDelete.length === 1 
                    ? getLocaleString('confirmDeleteEpisodeMessage', currentLanguage, { episodeTitle: formatEpisodeTitle(episodesToDelete[0].title, episodesToDelete[0].date, episodesToDelete[0].lang === 'all' ? currentLanguage : episodesToDelete[0].lang) })
                    : getLocaleString('confirmDeleteMultipleEpisodesMessage', currentLanguage, { count: episodesToDelete.length })
                }
                <br/><span className="font-semibold text-yellow-400 mt-2 block">{getLocaleString('actionIrreversible', currentLanguage)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>{getLocaleString('cancel', currentLanguage)}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {isDeleting ? getLocaleString('deleting', currentLanguage) : getLocaleString('deleteConfirm', currentLanguage)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {showDeleteQuestionsDialog && (
        <AlertDialog open={showDeleteQuestionsDialog} onOpenChange={setShowDeleteQuestionsDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-400 flex items-center"><HelpCircle className="h-6 w-6 mr-2" />Удалить все вопросы</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                Вы уверены, что хотите удалить все вопросы для эпизода "{episodeToDeleteQuestions?.title || episodeToDeleteQuestions?.slug}" ({episodeToDeleteQuestions?.lang})?
                <br/><span className="font-semibold text-yellow-400 mt-2 block">Это действие нельзя отменить</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteQuestionsDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteAllQuestions} className="bg-orange-600 hover:bg-orange-700" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HelpCircle className="h-4 w-4 mr-2" />}
                {isDeleting ? 'Удаление...' : 'Удалить все вопросы'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};


const ManagePage = ({ currentLanguage }) => {
  const navigate = useNavigate();
  const {
    filesToProcess,
    isProcessingAll,
    showOverwriteDialog,
    currentItemForOverwrite,
    addFilesToQueue,
    handleProcessAllFiles,
    handleTimingsChange,
    handleTitleChange,
    handleRemoveItem,
    confirmOverwrite,
    cancelOverwrite,
  } = useFileUploadManager(currentLanguage);

  const onDrop = useCallback((acceptedFiles) => {
    addFilesToQueue(acceptedFiles);
  }, [addFilesToQueue]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'] },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div className="container mx-auto p-4 max-w-4xl bg-slate-800/70 rounded-xl shadow-2xl border border-slate-700/50">
      <Button 
        variant="outline" 
        onClick={() => navigate('/episodes')} 
        className="mb-6 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodes', currentLanguage)}
      </Button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getLocaleString('manageEpisodes', currentLanguage)}
          </h1>
          <p className="text-slate-400 mt-1">
            Группировка по дате и файлам
          </p>
        </div>
      </div>
      <ApiKeyInlinePanel />

      <div {...getRootProps({ className: `p-6 border-2 border-dashed rounded-lg text-center cursor-pointer mb-6 ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}` })}>
        <input {...getInputProps()} style={{ display: 'none' }} />
        <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-2" />
        {isDragActive ? (
          <p className="text-purple-300 text-md">{getLocaleString('dropFilesHere', currentLanguage)}</p>
        ) : (
          <p className="text-slate-300 text-md">{getLocaleString('dragOrClickUpload', currentLanguage)}</p>
        )}
         <Button type="button" onClick={open} variant="ghost" className="mt-2 text-purple-400 hover:text-purple-300 focus-visible:ring-purple-400 bg-purple-500/10 hover:bg-purple-500/20">
            {getLocaleString('selectFiles', currentLanguage)}
        </Button>
        <p className="text-xs text-slate-500 mt-1">{getLocaleString('supportedFormats', currentLanguage)}</p>
      </div>

      {filesToProcess.length > 0 && (
        <div className="space-y-4 mb-6">
          {filesToProcess.map((itemData) => (
            <FileUploadItem 
              key={itemData.id}
              itemData={itemData}
              onTimingsChange={handleTimingsChange}
              onTitleChange={handleTitleChange}
              onRemove={handleRemoveItem}
              currentLanguage={currentLanguage}
            />
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between mt-8">
        <Button 
            onClick={open} 
            variant="outline"
            className="border-purple-500 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 focus-visible:ring-purple-500"
            disabled={isProcessingAll}
        >
            <PlusCircle className="mr-2 h-5 w-5" />
            {getLocaleString('addAnotherFile', currentLanguage)}
        </Button>
        <Button 
          onClick={handleProcessAllFiles} 
          disabled={isProcessingAll || filesToProcess.length === 0 || filesToProcess.every(fd => fd.isUploading || fd.uploadComplete || fd.uploadError)} 
          className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3 text-white"
        >
          {isProcessingAll ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {getLocaleString('processing', currentLanguage)}...
            </>
          ) : (
            <>{getLocaleString('startAllUploads', currentLanguage)}</>
          )}
        </Button>
      </div>

      <OverwriteDialog 
        isOpen={showOverwriteDialog}
        onOpenChange={() => {}} 
        onConfirm={confirmOverwrite}
        onCancel={cancelOverwrite}
        slug={currentItemForOverwrite?.episodeSlug || ''}
        currentLanguage={currentLanguage}
      />
      
      <ManageEpisodesList currentLanguage={currentLanguage} />
    </div>
  );
};

export default ManagePage;