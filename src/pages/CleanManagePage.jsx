import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadCloud, Loader2, PlusCircle, ArrowLeft, Settings2, Trash2, Search, ShieldAlert, ListChecks, PenLine, Languages, HelpCircle, Star, Database, FileAudio2 } from 'lucide-react';
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

/**
 * Clean Manage Page for Episode Management
 * 
 * Workflow:
 * 1. Spanish (ES) - Original audio, needs transcription and question generation
 * 2. Russian (RU) - Translated audio, needs transcription  
 * 3. English (EN) - Translated from Spanish, both transcript and questions
 */
const CleanManagePage = ({ currentLanguage }) => {
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
    <div className="container mx-auto p-4 max-w-6xl bg-slate-800/70 rounded-xl shadow-2xl border border-slate-700/50">
      <Button 
        variant="outline" 
        onClick={() => navigate('/episodes')} 
        className="mb-6 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodes', currentLanguage)}
      </Button>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Управление Эпизодами
          </h1>
          <p className="text-slate-400 mt-1">
            Загрузка аудио и управление языковыми версиями
          </p>
        </div>
      </div>

      {/* File Upload Section */}
      <FileUploadSection 
        currentLanguage={currentLanguage}
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        open={open}
        filesToProcess={filesToProcess}
        isProcessingAll={isProcessingAll}
        handleRemoveItem={handleRemoveItem}
        handleTitleChange={handleTitleChange}
        handleTimingsChange={handleTimingsChange}
        handleProcessAllFiles={handleProcessAllFiles}
      />

      <OverwriteDialog 
        isOpen={showOverwriteDialog}
        onOpenChange={() => {}} 
        onConfirm={confirmOverwrite}
        onCancel={cancelOverwrite}
        slug={currentItemForOverwrite?.episodeSlug || ''}
        currentLanguage={currentLanguage}
      />

      {/* Episode Management Section */}
      <EpisodeManagementSection currentLanguage={currentLanguage} />
    </div>
  );
};

/**
 * File Upload Section Component
 */
const FileUploadSection = ({ 
  currentLanguage, 
  getRootProps, 
  getInputProps, 
  isDragActive, 
  open, 
  filesToProcess, 
  isProcessingAll, 
  handleRemoveItem, 
  handleTitleChange, 
  handleTimingsChange, 
  handleProcessAllFiles 
}) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-purple-300 mb-4 flex items-center">
        <UploadCloud className="mr-2 h-5 w-5"/> Загрузка Аудио Файлов
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Поддерживаются аудио файлы: MP3, WAV, M4A, AAC, OGG, FLAC
        <br/>
        <span className="text-xs text-slate-500">
          Имена файлов могут содержать суффиксы языка: _es, _ru, _en
        </span>
      </p>
      
      <div {...getRootProps({ className: `p-6 border-2 border-dashed rounded-lg text-center cursor-pointer mb-6 ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}` })}>
        <input {...getInputProps()} style={{ display: 'none' }} />
        <FileAudio2 className="mx-auto h-12 w-12 text-slate-400 mb-2" />
        {isDragActive ? (
          <p className="text-purple-300 text-lg font-medium">Отпустите файлы сюда!</p>
        ) : (
          <p className="text-slate-300 text-lg font-medium">Перетащите аудио файлы или нажмите для выбора</p>
        )}
        <Button 
          type="button" 
          onClick={open} 
          variant="ghost" 
          className="mt-3 text-purple-400 hover:text-purple-300 focus-visible:ring-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
        >
          Выбрать файлы
        </Button>
      </div>

      {/* Upload Queue */}
      {filesToProcess.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold text-slate-300">
            В очереди: {filesToProcess.length} файлов
          </h3>
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

      {/* Process All Button */}
      <div className="flex items-center justify-between">
        <Button 
          onClick={open} 
          variant="outline"
          className="border-purple-500 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 focus-visible:ring-purple-500"
          disabled={isProcessingAll}
        >
          <PlusCircle className="mr-2 h-5 w-5" />
          Добавить файлы
        </Button>
        <Button 
          onClick={handleProcessAllFiles} 
          disabled={isProcessingAll || filesToProcess.length === 0 || filesToProcess.every(fd => fd.isUploading || fd.uploadComplete || fd.uploadError)} 
          className="bg-green-600 hover:bg-green-700 text-lg px-6 py-2 text-white"
        >
          {isProcessingAll ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Обработка...
            </>
          ) : (
            <>Начать загрузку</>
          )}
        </Button>
      </div>
    </div>
  );
};

/**
 * Episode Management Section Component
 */
const EpisodeManagementSection = ({ currentLanguage }) => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEpisodes, setSelectedEpisodes] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [episodesToDelete, setEpisodesToDelete] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteQuestionsDialog, setShowDeleteQuestionsDialog] = useState(false);
  const [episodeToDeleteQuestions, setEpisodeToDeleteQuestions] = useState(null);
  
  // Loading states for various operations
  const [transcribingEpisodes, setTranscribingEpisodes] = useState(new Set());
  const [processingQuestionsEpisodes, setProcessingQuestionsEpisodes] = useState(new Set());
  const [transferringTextEpisodes, setTransferringTextEpisodes] = useState(new Set());
  const [transferringQuestionsEpisodes, setTransferringQuestionsEpisodes] = useState(new Set());
  const [loadingQuestionsFromDB, setLoadingQuestionsFromDB] = useState(new Set());
  
  const [translationProgress, setTranslationProgress] = useState({});
  const [transcriptionProgress, setTranscriptionProgress] = useState({});
  const [questionsTranslationProgress, setQuestionsTranslationProgress] = useState({});
  const [translatedQuestions, setTranslatedQuestions] = useState(new Set());
  
  const pollingIntervalsRef = useRef({});
  const { toast } = useToast();

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    try {
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

      if (error) throw error;

      // Get transcript statuses
      const episodeSlugs = [...new Set(data.map(ep => ep.slug))];
      const { data: transcriptsData } = await supabase
        .from('transcripts')
        .select('episode_slug, lang, status, assemblyai_transcript_id')
        .in('episode_slug', episodeSlugs);

      // Get questions count
      const { data: questionsData } = await supabase
        .from('questions')
        .select('episode_slug, lang')
        .in('episode_slug', episodeSlugs);

      const episodesWithData = data.map(episode => {
        const transcript = transcriptsData?.find(t => t.episode_slug === episode.slug && t.lang === episode.lang);
        const questionsCount = questionsData?.filter(q => q.episode_slug === episode.slug && q.lang === episode.lang).length || 0;
        
        return {
          ...episode,
          transcript,
          questionsCount
        };
      });

      setEpisodes(episodesWithData || []);
    } catch (error) {
      toast({ 
        title: 'Ошибка', 
        description: `Ошибка загрузки эпизодов: ${error.message}`, 
        variant: 'destructive' 
      });
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  // Cleanup polling intervals
  useEffect(() => {
    return () => {
      Object.values(pollingIntervalsRef.current).forEach(intervalId => {
        if (intervalId) clearInterval(intervalId);
      });
    };
  }, []);

  // Group episodes by date and file
  const groupedEpisodes = episodes.reduce((groups, episode) => {
    const dateKey = episode.date || 'unknown';
    if (!groups[dateKey]) {
      groups[dateKey] = {};
    }
    
    const fileName = episode.r2_object_key || episode.slug;
    if (!groups[dateKey][fileName]) {
      groups[dateKey][fileName] = [];
    }
    groups[dateKey][fileName].push(episode);
    return groups;
  }, {});

  const sortedGroups = Object.entries(groupedEpisodes)
    .sort(([dateA], [dateB]) => {
      if (dateA === 'unknown') return 1;
      if (dateB === 'unknown') return -1;
      return new Date(dateB) - new Date(dateA);
    });

  const filteredGroups = sortedGroups.filter(([date, fileNameGroups]) => {
    const prefix = 'Медитация';
    let datePart = '';
    if (date !== 'unknown') datePart = formatShortDate(date, currentLanguage);
    const episodeComputedTitle = datePart ? `${prefix} ${datePart}` : prefix;
    
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

  // Core functionality functions
  const handleStartTranscription = async (episode) => {
    if (!episode.audio_url && !episode.r2_object_key) {
      toast({ title: 'Ошибка', description: 'Аудиофайл недоступен для распознавания', variant: 'destructive' });
      return;
    }

    if (episode.transcript && episode.transcript.status === 'processing') {
      toast({ title: 'Транскрипция уже запущена', description: 'Дождитесь завершения текущего процесса', variant: 'info' });
      return;
    }

    if (episode.transcript && episode.transcript.status === 'completed') {
      toast({ title: 'Транскрипция уже готова', description: 'Текст уже распознан', variant: 'info' });
      return;
    }

    setTranscribingEpisodes(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));
    setTranscriptionProgress(prev => ({
      ...prev,
      [`${episode.slug}-${episode.lang}`]: { message: 'Запуск распознавания...', status: 'starting' }
    }));

    try {
      let audioUrl = episode.audio_url;
      if (!audioUrl && episode.r2_object_key) {
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

      const job = await assemblyAIService.submitTranscription(
        audioUrl, 
        episode.lang === 'all' ? 'es' : episode.lang,
        episode.slug,
        currentLanguage,
        episode.lang
      );

      const transcriptId = job?.id;
      const jobStatus = job?.status || 'processing';
      if (!transcriptId) throw new Error('AssemblyAI не вернул идентификатор задания');

      // Save to database
      const transcriptPayload = {
        episode_slug: episode.slug,
        lang: episode.lang,
        assemblyai_transcript_id: transcriptId,
        status: jobStatus
      };

      await supabase.from('transcripts').upsert(transcriptPayload, { onConflict: 'episode_slug,lang' });

      // Update local state
      setEpisodes(prev => prev.map(ep => 
        ep.slug === episode.slug && ep.lang === episode.lang 
          ? { ...ep, transcript: { ...ep.transcript, status: jobStatus, assemblyai_transcript_id: transcriptId } }
          : ep
      ));

      // Start polling
      const itemData = {
        id: `${episode.slug}-${episode.lang}`,
        episodeSlug: episode.slug,
        lang: episode.lang,
        episodeTitle: episode.title,
        transcriptionStatus: jobStatus,
        assemblyai_transcript_id: transcriptId
      };

      startPollingForItem(
        itemData,
        (itemId, updates) => {
          setEpisodes(prev => prev.map(ep => 
            ep.slug === episode.slug && ep.lang === episode.lang 
              ? { ...ep, transcript: { ...ep.transcript, ...updates } }
              : ep
          ));
          
          if (updates.status === 'completed') {
            setTranscriptionProgress(prev => ({
              ...prev,
              [`${episode.slug}-${episode.lang}`]: { message: 'Распознавание завершено!', status: 'completed' }
            }));
            setTimeout(() => {
              setTranscriptionProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[`${episode.slug}-${episode.lang}`];
                return newProgress;
              });
            }, 8000);
          } else if (updates.status === 'error') {
            setTranscriptionProgress(prev => ({
              ...prev,
              [`${episode.slug}-${episode.lang}`]: { message: `Ошибка: ${updates.transcriptionError || 'Неизвестная ошибка'}`, status: 'error' }
            }));
            setTimeout(() => {
              setTranscriptionProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[`${episode.slug}-${episode.lang}`];
                return newProgress;
              });
            }, 12000);
          }
        },
        currentLanguage,
        toast,
        pollingIntervalsRef
      );

      toast({ title: 'Распознавание запущено', description: `Эпизод ${episode.slug} (${episode.lang})` });

    } catch (error) {
      toast({ title: 'Ошибка', description: `Ошибка запуска распознавания: ${error.message}`, variant: 'destructive' });
    } finally {
      setTranscribingEpisodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${episode.slug}-${episode.lang}`);
        return newSet;
      });
      setTimeout(() => {
        setTranscriptionProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[`${episode.slug}-${episode.lang}`];
          return newProgress;
        });
      }, 6000);
    }
  };

  const handleLoadQuestionsFromDB = async (episode) => {
    setLoadingQuestionsFromDB(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));

    try {
      const { data: questionsData } = await supabase
        .from('questions')
        .select('title, time')
        .eq('episode_slug', episode.slug)
        .eq('lang', episode.lang)
        .order('time');

      if (!questionsData || questionsData.length === 0) {
        toast({ title: 'Вопросы не найдены', description: 'Вопросы для этого эпизода отсутствуют в базе данных', variant: 'info' });
        return;
      }

      setEpisodes(prev => prev.map(ep => 
        ep.slug === episode.slug && ep.lang === episode.lang 
          ? { ...ep, questionsCount: questionsData.length }
          : ep
      ));
      
      toast({ title: 'Вопросы загружены', description: `Загружено ${questionsData.length} вопросов из базы данных` });
      
    } catch (error) {
      toast({ title: 'Ошибка', description: `Ошибка загрузки вопросов: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoadingQuestionsFromDB(prev => {
        const s = new Set(prev);
        s.delete(`${episode.slug}-${episode.lang}`);
        return s;
      });
    }
  };

  const handleAutoGenerateQuestions = async (episode) => {
    if (!episode.transcript || episode.transcript.status !== 'completed') {
      toast({ title: 'Требуется транскрипция', description: 'Сначала нужно распознать текст эпизода', variant: 'warning' });
      return;
    }

    setProcessingQuestionsEpisodes(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));

    try {
      const { data: transcriptData } = await supabase
        .from('transcripts')
        .select('edited_transcript_data')
        .eq('episode_slug', episode.slug)
        .eq('lang', episode.lang)
        .single();

      if (!transcriptData || !transcriptData.edited_transcript_data) {
        throw new Error('Данные транскрипции не найдены');
      }

      const questions = await generateQuestionsOpenAI(transcriptData.edited_transcript_data, episode.lang, currentLanguage);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Не удалось сгенерировать вопросы');
      }

      // Save questions to database
      await supabase.from('questions').delete().eq('episode_slug', episode.slug).eq('lang', episode.lang);
      
      const questionsToInsert = questions.map((q, index) => ({
        episode_slug: episode.slug,
        lang: episode.lang,
        title: q.title,
        time: Number(q.time ?? 0)
      }));

      await supabase.from('questions').insert(questionsToInsert);

      setEpisodes(prev => prev.map(ep => 
        ep.slug === episode.slug && ep.lang === episode.lang
          ? { ...ep, questionsCount: questions.length }
          : ep
      ));

      toast({ title: 'Вопросы сгенерированы', description: `Создано ${questions.length} вопросов для эпизода ${episode.slug} (${episode.lang})` });

    } catch (error) {
      toast({ title: 'Ошибка', description: `Ошибка генерации вопросов: ${error.message}`, variant: 'destructive' });
    } finally {
      setProcessingQuestionsEpisodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${episode.slug}-${episode.lang}`);
        return newSet;
      });
    }
  };

  const handleTranslateTranscriptFromSpanishForEnglish = async (englishEpisode) => {
    setTransferringTextEpisodes(prev => new Set(prev).add(`${englishEpisode.slug}-en`));
    
    try {
      // Find Spanish episode
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
        throw new Error('Испанский эпизод не найден');
      }

      // Get Spanish transcript
      const { data: transcriptData } = await supabase
        .from('transcripts')
        .select('status, edited_transcript_data')
        .eq('episode_slug', spanishEpisode.slug)
        .eq('lang', 'es')
        .maybeSingle();
        
      if (!transcriptData || transcriptData.status !== 'completed') {
        throw new Error('Испанская транскрипция не готова');
      }
      
      if (!transcriptData.edited_transcript_data) {
        throw new Error('Текст испанской транскрипции не найден');
      }

      // Translate transcript
      const translatedTranscriptData = await translateTranscriptFast(
        transcriptData.edited_transcript_data, 
        'en', 
        currentLanguage,
        (progress, total, message) => {
          setTranslationProgress(prev => ({
            ...prev,
            [englishEpisode.slug]: { progress, total, message }
          }));
        }
      );
      
      if (!translatedTranscriptData || !translatedTranscriptData.utterances) {
        throw new Error('Не удалось перевести транскрипт');
      }

      // Ensure English episode exists
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
        await supabase.from('episodes').insert(payload);
      }

      // Save English transcript
      await supabase.from('transcripts').upsert({
        episode_slug: englishEpisode.slug,
        lang: 'en',
        status: 'completed',
        edited_transcript_data: translatedTranscriptData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'episode_slug,lang' });

      toast({ title: 'Транскрипт переведен', description: `EN транскрипт для ${englishEpisode.slug} создан` });

      setEpisodes(prev => prev.map(ep => 
        ep.slug === englishEpisode.slug && ep.lang === 'en' 
          ? { ...ep, transcript: { status: 'completed' } }
          : ep
      ));
    } catch (error) {
      toast({ title: 'Ошибка', description: `Ошибка перевода транскрипта: ${error.message}`, variant: 'destructive' });
    } finally {
      setTransferringTextEpisodes(prev => { const s = new Set(prev); s.delete(`${englishEpisode.slug}-en`); return s; });
      setTranslationProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[englishEpisode.slug];
        return newProgress;
      });
    }
  };

  const handleTranslateQuestionsToEnglish = async (englishEpisode, sourceLang) => {
    const srcLabel = sourceLang === 'ru' ? 'русского' : 'испанского';
    setTransferringQuestionsEpisodes(prev => new Set(prev).add(`${englishEpisode.slug}-en-${sourceLang}`));
    
    try {
      const { data: sourceEpisode } = await supabase
        .from('episodes')
        .select('slug')
        .eq('r2_object_key', englishEpisode.r2_object_key)
        .eq('lang', sourceLang)
        .maybeSingle();
        
      if (!sourceEpisode) {
        throw new Error(`Эпизод ${srcLabel} языка не найден`);
      }

      const { data: questionsData } = await supabase
        .from('questions')
        .select('title, time')
        .eq('episode_slug', sourceEpisode.slug)
        .eq('lang', sourceLang)
        .order('time');
        
      if (!questionsData || questionsData.length === 0) {
        throw new Error('Вопросы не найдены');
      }

      const validatedQuestionsData = questionsData.map((q, i) => ({
        title: q.title || `Вопрос ${i + 1}`,
        time: Number.isFinite(q.time) ? q.time : i * 10
      }));

      const translatedQuestions = await Promise.all(validatedQuestionsData.map(async (q) => {
        const prompt = `Переведи следующий заголовок вопроса с ${srcLabel} на английский язык. Верни только переведенный текст без кавычек и дополнительных символов: "${q.title}"`;
        const translatedTitle = await translateTextOpenAI(prompt, 'en', currentLanguage);
        return {
          title: translatedTitle.trim(),
          time: q.time
        };
      }));

      // Ensure English episode exists
      const { data: enEpisodeExists } = await supabase
        .from('episodes')
        .select('slug')
        .eq('slug', englishEpisode.slug)
        .eq('lang', 'en')
        .maybeSingle();
        
      if (!enEpisodeExists) {
        const { data: baseEp } = await supabase
          .from('episodes')
          .select('slug, title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
          .eq('slug', sourceEpisode.slug)
          .maybeSingle();
          
        const payload = {
          slug: englishEpisode.slug,
          title: englishEpisode.title || '',
          lang: 'en',
          date: baseEp?.date || englishEpisode.date,
          audio_url: baseEp?.audio_url || englishEpisode.audio_url,
          r2_object_key: baseEp?.r2_object_key || englishEpisode.r2_object_key,
          r2_bucket_name: baseEp?.r2_bucket_name || englishEpisode.r2_bucket_name,
          duration: baseEp?.duration || englishEpisode.duration,
          file_has_lang_suffix: baseEp?.file_has_lang_suffix || englishEpisode.file_has_lang_suffix,
        };
        await supabase.from('episodes').insert(payload);
      }

      // Save translated questions
      await supabase.from('questions').delete().eq('episode_slug', englishEpisode.slug).eq('lang', 'en');
      
      const toInsert = translatedQuestions.map((q, i) => ({
        episode_slug: englishEpisode.slug,
        lang: 'en',
        title: q.title,
        time: Number.isFinite(q.time) ? q.time : i * 10
      }));
      
      await supabase.from('questions').insert(toInsert);

      setEpisodes(prev => prev.map(ep => 
        ep.slug === englishEpisode.slug && ep.lang === 'en' 
          ? { ...ep, questionsCount: toInsert.length }
          : ep
      ));

      setTranslatedQuestions(prev => new Set(prev).add(`${englishEpisode.slug}-en-${sourceLang}`));

      toast({ title: 'Вопросы переведены', description: `Создано ${toInsert.length} вопросов (EN)` });
      
    } catch (error) {
      toast({ title: 'Ошибка', description: `Ошибка перевода вопросов: ${error.message}`, variant: 'destructive' });
    } finally {
      setTransferringQuestionsEpisodes(prev => { const s = new Set(prev); s.delete(`${englishEpisode.slug}-en-${sourceLang}`); return s; });
    }
  };

  const confirmDelete = async () => {
    if (episodesToDelete.length === 0) return;
    setIsDeleting(true);

    let successCount = 0;

    for (const episode of episodesToDelete) {
      try {
        const { slug, lang, r2_object_key, r2_bucket_name } = episode;
        
        // Delete questions for specific language
        await supabase.from('questions').delete().eq('episode_slug', slug).eq('lang', lang);
        // Delete transcripts for specific language  
        await supabase.from('transcripts').delete().eq('episode_slug', slug).eq('lang', lang);
        // Delete episode for specific language
        await supabase.from('episodes').delete().eq('slug', slug).eq('lang', lang);
        
        successCount++;
      } catch (error) {
        toast({ 
          title: 'Ошибка', 
          description: `Ошибка удаления эпизода ${episode.title || episode.slug}: ${error.message}`, 
          variant: 'destructive' 
        });
      }
    }
    
    if (successCount > 0) {
      toast({ 
        title: 'Успешно удалено', 
        description: `${successCount} эпизодов удалено успешно.`
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
      await supabase.from('questions').delete().eq('episode_slug', slug).eq('lang', lang);
      
      toast({ 
        title: 'Вопросы удалены', 
        description: `Все вопросы для эпизода ${episodeToDeleteQuestions.title || episodeToDeleteQuestions.slug} удалены` 
      });
      
      setEpisodes(prev => prev.map(ep =>
        ep.slug === slug && ep.lang === lang
          ? { ...ep, questionsCount: 0 }
          : ep
      ));

    } catch (error) {
      toast({ 
        title: 'Ошибка', 
        description: `Ошибка при удалении вопросов: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteQuestionsDialog(false);
      setEpisodeToDeleteQuestions(null);
    }
  };

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
      <h2 className="text-xl font-bold text-purple-300 mb-4 flex items-center">
        <Settings2 className="mr-2 h-5 w-5"/>
        Управление Эпизодами
      </h2>
      
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
          Обновить
        </Button>
        <Button onClick={handleSelectAll} variant="outline" className="h-10 border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300 hover:text-white" disabled={episodes.length === 0}>
           <ListChecks className="mr-2 h-4 w-4"/> Выбрать все ({numSelected})
        </Button>
        <Button onClick={handleDeleteSelectedClick} variant="destructive" className="h-10" disabled={numSelected === 0 || isDeleting}>
          <Trash2 className="mr-2 h-4 w-4"/> Удалить ({numSelected})
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <p className="text-center text-slate-400 py-10">Эпизоды не найдены</p>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(([date, fileNameGroups]) => (
            <div key={date} className="bg-slate-700/60 rounded-lg border border-slate-600 overflow-hidden">
              <div className="p-3 bg-slate-600/50 border-b border-slate-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-purple-200">
                      {date === 'unknown' ? 'Медитация' : `Медитация ${formatDateForDisplay(date)}`}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">
                      {Object.values(fileNameGroups).reduce((total, episodes) => total + episodes.length, 0)} эпизодов
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-2">
                {Object.entries(fileNameGroups).map(([fileName, episodes]) => (
                  <div key={fileName} className="mb-3 last:mb-0">
                    <div className="p-2 bg-slate-600/30 rounded-lg border border-slate-500">
                      <h4 className="text-sm font-medium text-purple-200 mb-2">
                        Файл: {fileName}
                      </h4>
                      <div className="space-y-2">
                        {episodes
                          .sort((a, b) => {
                            const langOrder = { 'ru': 0, 'es': 1, 'en': 2 };
                            return (langOrder[a.lang] || 3) - (langOrder[b.lang] || 3);
                          })
                          .map(episode => {
                            const isTranscribing = transcribingEpisodes.has(`${episode.slug}-${episode.lang}`);
                            const hasAudio = episode.audio_url || episode.r2_object_key;
                            
                            return (
                              <div key={`${episode.slug}-${episode.lang}`} className="flex items-center gap-3 p-3 rounded bg-slate-600/20 border border-slate-500">
                                <Checkbox
                                  id={`select-${episode.slug}-${episode.lang}`}
                                  checked={!!selectedEpisodes[`${episode.slug}-${episode.lang}`]}
                                  onCheckedChange={() => handleSelectEpisode(episode.slug, episode.lang)}
                                  className="border-slate-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                />
                                
                                <div className="flex-grow min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      episode.lang === 'es' ? 'bg-green-600/70 text-green-100' :
                                      episode.lang === 'ru' ? 'bg-blue-600/70 text-blue-100' :
                                      episode.lang === 'en' ? 'bg-purple-600/70 text-purple-100' :
                                      'bg-gray-600/70 text-gray-100'
                                    }`}>
                                      {episode.lang.toUpperCase()}
                                    </span>
                                    
                                    {episode.transcript && (
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        episode.transcript.status === 'completed' ? 'bg-green-600/70 text-green-100' :
                                        episode.transcript.status === 'processing' ? 'bg-yellow-600/70 text-yellow-100' :
                                        episode.transcript.status === 'error' ? 'bg-red-600/70 text-red-100' :
                                        'bg-gray-600/70 text-gray-100'
                                      }`}>
                                        {episode.transcript.status === 'completed' ? 'Готов' :
                                         episode.transcript.status === 'processing' ? 'Обработка' :
                                         episode.transcript.status === 'error' ? 'Ошибка' :
                                         'Не запущен'}
                                      </span>
                                    )}
                                    
                                    {episode.questionsCount > 0 && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-orange-600/70 text-orange-100">
                                        <HelpCircle className="inline h-3 w-3 mr-1" />
                                        {episode.questionsCount}
                                      </span>
                                    )}
                                    
                                    {episode.duration && episode.duration > 0 && (
                                      <span className="text-xs text-slate-400">
                                        {Math.floor(episode.duration / 60)}:{(episode.duration % 60).toString().padStart(2, '0')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1 min-w-0">
                                  {/* Spanish/Russian: Transcription and Question Management */}
                                  {episode.lang !== 'en' && (
                                    <div className="flex flex-col gap-1">
                                      {/* Transcription Button */}
                                      {!isTranscribing && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleStartTranscription(episode)}
                                          disabled={!hasAudio || (episode.transcript && episode.transcript.status === 'processing')}
                                          className={`h-8 px-2 text-xs ${
                                            episode.transcript && episode.transcript.status === 'completed' 
                                              ? 'bg-green-600/20 border-green-500 text-green-300' 
                                              : hasAudio
                                                ? 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200'
                                                : 'bg-gray-600/20 border-gray-500 text-gray-400'
                                          }`}
                                        >
                                          <PenLine className="h-3 w-3 mr-1" />
                                          Распознать {episode.lang.toUpperCase()}
                                        </Button>
                                      )}
                                      
                                      {isTranscribing && (
                                        <div className="text-xs text-purple-300 flex items-center">
                                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                          Запуск...
                                        </div>
                                      )}
                                      
                                      {/* Question Management (only when transcript is completed) */}
                                      {episode.transcript?.status === 'completed' && (
                                        <div className="flex gap-1">
                                          {episode.questionsCount === 0 ? (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleLoadQuestionsFromDB(episode)}
                                                disabled={loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`)}
                                                className="h-8 px-2 text-xs bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/40 hover:text-blue-200"
                                                title="Загрузить вопросы из базы данных"
                                              >
                                                <Database className="h-3 w-3 mr-1" />
                                                Из БД
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleAutoGenerateQuestions(episode)}
                                                disabled={processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`)}
                                                className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
                                                title="Автоматически сгенерировать вопросы через ИИ"
                                              >
                                                <Star className="h-3 w-3 mr-1" />
                                                Распознать
                                              </Button>
                                            </>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleDeleteAllQuestions(episode)}
                                              className="h-8 px-2 text-xs bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/40 hover:text-red-200"
                                              title="Удалить все вопросы"
                                            >
                                              <Trash2 className="h-3 w-3 mr-1" />
                                              Удалить ({episode.questionsCount})
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* English: Translation Management */}
                                  {episode.lang === 'en' && (
                                    <div className="flex flex-col gap-1">
                                      {/* Transcript Translation */}
                                      {!episode.transcript?.status === 'completed' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleTranslateTranscriptFromSpanishForEnglish(episode)}
                                          disabled={transferringTextEpisodes.has(`${episode.slug}-en`)}
                                          className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
                                          title="Перевести транскрипт с испанского"
                                        >
                                          <Languages className="h-3 w-3 mr-1" />
                                          Перевод ES→EN
                                        </Button>
                                      )}
                                      
                                      {/* Question Translation (only when transcript is completed) */}
                                      {episode.transcript?.status === 'completed' && (
                                        <div className="flex flex-col gap-1">
                                          {episode.questionsCount === 0 ? (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleTranslateQuestionsToEnglish(episode, 'es')}
                                                disabled={transferringQuestionsEpisodes.has(`${episode.slug}-en-es`)}
                                                className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
                                                title="Перевести вопросы с испанского"
                                              >
                                                <HelpCircle className="h-3 w-3 mr-1" />
                                                Вопросы ES→EN
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleTranslateQuestionsToEnglish(episode, 'ru')}
                                                disabled={transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`)}
                                                className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
                                                title="Перевести вопросы с русского"
                                              >
                                                <HelpCircle className="h-3 w-3 mr-1" />
                                                Вопросы RU→EN
                                              </Button>
                                            </>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleDeleteAllQuestions(episode)}
                                              className="h-8 px-2 text-xs bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/40 hover:text-red-200"
                                              title="Удалить переведенные вопросы"
                                            >
                                              <Trash2 className="h-3 w-3 mr-1" />
                                              Удалить ({episode.questionsCount})
                                            </Button>
                                          )}
                                        </div>
                                      )}
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
          ))}
        </div>
      )}

      {/* Dialogs */}
      {showDeleteDialog && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400 flex items-center">
                <ShieldAlert className="h-6 w-6 mr-2" />Подтверждение удаления
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                { episodesToDelete.length === 1 
                    ? `Вы уверены, что хотите удалить эпизод "${episodesToDelete[0].title || episodesToDelete[0].slug}" (${episodesToDelete[0].lang})?`
                    : `Вы уверены, что хотите удалить ${episodesToDelete.length} выбранных эпизодов?`
                }
                <br/><span className="font-semibold text-yellow-400 mt-2 block">Это действие нельзя отменить</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {isDeleting ? 'Удаление...' : 'Удалить'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showDeleteQuestionsDialog && (
        <AlertDialog open={showDeleteQuestionsDialog} onOpenChange={setShowDeleteQuestionsDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-orange-400 flex items-center">
                <HelpCircle className="h-6 w-6 mr-2" />Удалить все вопросы
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                Вы уверены, что хотите удалить все вопросы для эпизода "{episodeToDeleteQuestions?.title || episodeToDeleteQuestions?.slug}" ({episodeToDeleteQuestions?.lang})?
                <br/><span className="font-semibold text-yellow-400 mt-2 block">Это действие нельзя отменить</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteQuestionsDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>
                Отмена
              </AlertDialogCancel>
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

/**
 * AssemblyAI API Key Input Panel
 */
const ApiKeyInlinePanel = ({ currentLanguage }) => {
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
export default CleanManagePage;
