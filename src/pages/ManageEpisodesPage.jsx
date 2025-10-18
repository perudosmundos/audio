import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadCloud, Loader2, PlusCircle, ArrowLeft, Settings2, Trash2, Search, ShieldAlert, ListChecks, FileAudio2, Key, PenLine, Languages, HelpCircle, Star, Database } from 'lucide-react';
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
import timeOldService from '@/lib/timeOldService';
import logger from '@/lib/logger';
import LanguageCard from '@/components/manage/LanguageCard';

/**
 * Enhanced Manage Page for Episode Management
 * 
 * Workflow:
 * 1. Spanish (ES) - Original audio, needs transcription and question generation
 * 2. Russian (RU) - Translated audio, needs transcription  
 * 3. English (EN) - Translated from Spanish, both transcript and questions
 */
const ManageEpisodesPage = ({ currentLanguage }) => {
  const navigate = useNavigate();
  const {
    filesToProcess,
    isProcessingAll,
    showOverwriteDialog,
    currentItemForOverwrite,
    handleProcessAllFiles,
    handleTimingsChange,
    handleTitleChange,
    handleRemoveItem,
    confirmOverwrite,
    cancelOverwrite,
    handleTranslateTimings,
    addFilesToQueue,
  } = useFileUploadManager(currentLanguage);


  const onDrop = useCallback((acceptedFiles) => {
    if (typeof addFilesToQueue === 'function') {
      addFilesToQueue(acceptedFiles);
    }
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
            {getLocaleString('manageEpisodesTitle', currentLanguage)}
          </h1>
          <p className="text-slate-400 mt-1">
            {getLocaleString('manageEpisodesDescription', currentLanguage)}
          </p>
        </div>
      </div>

      {/* AssemblyAI API Key Section */}
      <AssemblyAIKeySection currentLanguage={currentLanguage} />

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
        handleTranslateTimings={handleTranslateTimings}
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
 * AssemblyAI API Key Input Section
 */
const AssemblyAIKeySection = ({ currentLanguage }) => {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('ASSEMBLYAI_API_KEY') || ''; } catch { return ''; }
  });
  const [showKey, setShowKey] = useState(false);
  const { toast } = useToast();

  const saveApiKey = () => {
    try {
      localStorage.setItem('ASSEMBLYAI_API_KEY', apiKey.trim());
      toast({ 
        title: getLocaleString('apiKeySaved', currentLanguage),
        description: getLocaleString('apiKeySavedDescription', currentLanguage)
      });
    } catch (error) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage),
        description: getLocaleString('apiKeySaveError', currentLanguage),
        variant: 'destructive'
      });
    }
  };

  const clearApiKey = () => {
    try {
      localStorage.removeItem('ASSEMBLYAI_API_KEY');
      setApiKey('');
      toast({ 
        title: getLocaleString('apiKeyCleared', currentLanguage),
        description: getLocaleString('apiKeyClearedDescription', currentLanguage)
      });
    } catch (error) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage),
        description: getLocaleString('apiKeyClearError', currentLanguage),
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="mb-8 p-4 rounded-lg bg-slate-700/50 border border-slate-600">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-purple-300 flex items-center">
          <Key className="mr-2 h-5 w-5" />
          {getLocaleString('assemblyAiApiKey', currentLanguage)}
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowKey(!showKey)}
          className="bg-slate-600 hover:bg-slate-500 border-slate-500 text-slate-300"
        >
          {showKey ? getLocaleString('hide', currentLanguage) : getLocaleString('show', currentLanguage)}
        </Button>
      </div>
      
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          {getLocaleString('assemblyAiApiKeyDescription', currentLanguage)}
        </p>
        
        <input
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={getLocaleString('assemblyAiApiKeyPlaceholder', currentLanguage)}
          className="w-full h-11 px-4 rounded bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
            onClick={saveApiKey}
            disabled={!apiKey.trim()}
          >
            {getLocaleString('save', currentLanguage)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-slate-600 hover:bg-slate-500 border-slate-500 text-slate-300 flex-1"
            onClick={clearApiKey}
            disabled={!apiKey}
          >
            {getLocaleString('clear', currentLanguage)}
          </Button>
        </div>
        
        <p className="text-xs text-slate-500 mt-2">
          {getLocaleString('apiKeyStoredLocally', currentLanguage)}
        </p>
      </div>
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
  handleProcessAllFiles,
  handleTranslateTimings
}) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-purple-300 mb-4 flex items-center">
        <UploadCloud className="mr-2 h-5 w-5"/> {getLocaleString('uploadAudioFiles', currentLanguage)}
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        {getLocaleString('supportedAudioFormats', currentLanguage)}
        <br/>
        <span className="text-xs text-slate-500">
          {getLocaleString('filenameLanguageSuffixes', currentLanguage)}
        </span>
      </p>
      
      <div {...getRootProps({ className: `p-6 border-2 border-dashed rounded-lg text-center cursor-pointer mb-6 ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}` })}>
        <input {...getInputProps()} style={{ display: 'none' }} />
        <FileAudio2 className="mx-auto h-12 w-12 text-slate-400 mb-2" />
        {isDragActive ? (
          <p className="text-purple-300 text-lg font-medium">{getLocaleString('dropFilesHere', currentLanguage)}</p>
        ) : (
          <p className="text-slate-300 text-lg font-medium">{getLocaleString('dragOrClickToUpload', currentLanguage)}</p>
        )}
        <Button 
          type="button" 
          onClick={open} 
          variant="ghost" 
          className="mt-3 text-purple-400 hover:text-purple-300 focus-visible:ring-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
        >
          {getLocaleString('selectFiles', currentLanguage)}
        </Button>
      </div>

      {/* Upload Queue */}
      {filesToProcess.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold text-slate-300">
            {getPluralizedLocaleString('filesInQueue', currentLanguage, filesToProcess.length)}
          </h3>
          {filesToProcess.map((itemData) => (
            <FileUploadItem
              key={itemData.id}
              itemData={itemData}
              onTimingsChange={handleTimingsChange}
              onTitleChange={handleTitleChange}
              onRemove={handleRemoveItem}
              onTranslateTimings={handleTranslateTimings}
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
          {getLocaleString('addFiles', currentLanguage)}
        </Button>
        <Button 
          onClick={handleProcessAllFiles} 
          disabled={isProcessingAll || filesToProcess.length === 0 || filesToProcess.every(fd => fd.isUploading || fd.uploadComplete || fd.uploadError)} 
          className="bg-green-600 hover:bg-green-700 text-lg px-6 py-2 text-white"
        >
          {isProcessingAll ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {getLocaleString('processing', currentLanguage)}
            </>
          ) : (
            <>{getLocaleString('startUpload', currentLanguage)}</>
          )}
        </Button>
      </div>
    </div>
  );
};

// Helper function to format duration in H:MM:SS format
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
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

      // Get questions count - fix the query to properly count questions per episode and language
      const { data: questionsData } = await supabase
        .from('questions')
        .select('episode_slug, lang')
        .in('episode_slug', episodeSlugs);

      console.log('Questions data fetched:', questionsData);
      console.log('Episode slugs:', episodeSlugs);
      console.log('Episodes data:', data);

      const episodesWithData = data.map(episode => {
        const transcript = transcriptsData?.find(t => t.episode_slug === episode.slug && t.lang === episode.lang);
        
        // Count questions for this specific episode slug and language
        const questionsCount = questionsData?.filter(q => 
          q.episode_slug === episode.slug && q.lang === episode.lang
        ).length || 0;
        
        console.log(`Episode ${episode.slug} (${episode.lang}): ${questionsCount} questions`);
        
        return {
          ...episode,
          transcript,
          questionsCount
        };
      });

      setEpisodes(episodesWithData || []);
    } catch (error) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: getLocaleString('errorFetchingEpisodes', currentLanguage, { errorMessage: error.message }), 
        variant: 'destructive' 
      });
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, [currentLanguage, toast]);

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

  // Group episodes by date extracted from filename for proper file matching
  const groupedEpisodes = episodes.reduce((groups, episode) => {
    // Extract date from slug for proper grouping (e.g., "2024-11-13_ru" -> "2024-11-13")
    let dateKey = 'unknown';

    // Try to extract date from slug first (most reliable for file matching)
    const slugDateMatch = episode.slug.match(/^(\d{4}-\d{2}-\d{2})_/);
    if (slugDateMatch) {
      dateKey = slugDateMatch[1];
    } else if (episode.date) {
      // Fallback to episode.date if slug doesn't contain date
      dateKey = episode.date;
    }

    if (!groups[dateKey]) {
      groups[dateKey] = {
        ru: [],  // Array for Russian files (each gets own group)
        es_en: [], // Array for Spanish and English files (combined group)
        combined: [] // Array for files without language suffixes (all in one group)
      };
    }

    // Check if file has language suffix
    if (!episode.file_has_lang_suffix) {
      // Files without language suffixes go to combined group
      groups[dateKey].combined.push(episode);
    } else {
      // Files with language suffixes go to appropriate groups
      if (episode.lang === 'ru') {
        groups[dateKey].ru.push(episode);
      } else if (episode.lang === 'es' || episode.lang === 'en') {
        groups[dateKey].es_en.push(episode);
      }
    }

    return groups;
  }, {});

  const sortedGroups = Object.entries(groupedEpisodes)
    .sort(([dateA], [dateB]) => {
      if (dateA === 'unknown') return 1;
      if (dateB === 'unknown') return -1;
      return new Date(dateB) - new Date(dateA);
    });

  const filteredGroups = sortedGroups.filter(([date, baseSlugGroups]) => {
    const prefix = getLocaleString('meditationTitlePrefix', currentLanguage);
    let datePart = '';
    if (date !== 'unknown') datePart = formatShortDate(date, currentLanguage);
    const episodeComputedTitle = datePart ? `${prefix} ${datePart}` : prefix;
    
    const titleMatch = episodeComputedTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const baseSlugMatch = Object.keys(baseSlugGroups).some(baseSlug => 
      baseSlug.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return titleMatch || baseSlugMatch;
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

  // State for delete transcript confirmation
  const [showDeleteTranscriptDialog, setShowDeleteTranscriptDialog] = useState(false);
  const [episodeToDeleteTranscript, setEpisodeToDeleteTranscript] = useState(null);

  // Функции для работы с SRT и AI
  const handleDownloadSRT = async (episode) => {
    try {
      if (!episode.transcript?.edited_transcript_data) {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: getLocaleString('transcriptRequired', currentLanguage),
          variant: 'destructive'
        });
        return;
      }

      // Генерируем SRT файл из транскрипта
      const srtContent = generateSRTContent(episode.transcript.edited_transcript_data);
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${episode.slug}_${episode.lang}.srt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: getLocaleString('downloadStartedTitle', currentLanguage),
        description: 'SRT файл загружается'
      });
    } catch (error) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Ошибка создания SRT файла: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const handleProcessWithAI = async (episode) => {
    try {
      if (!episode.transcript?.edited_transcript_data) {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: getLocaleString('transcriptRequired', currentLanguage),
          variant: 'destructive'
        });
        return;
      }

      // Используем существующий перевод через ИИ для обработки текста
      toast({
        title: getLocaleString('processWithAI', currentLanguage),
        description: 'Обработка текста через ИИ начата'
      });

      // Здесь можно добавить дополнительную обработку текста через ИИ
      // Например, улучшение транскрипции, генерацию вопросов и т.д.

    } catch (error) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Ошибка обработки через ИИ: ${error.message}`,
        variant: 'destructive'
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

  // Core functionality functions
  const handleStartTranscription = async (episode) => {
    if (!episode.audio_url && !episode.r2_object_key) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('audioFileNotAvailable', currentLanguage), variant: 'destructive' });
      return;
    }

    // If transcript exists and is completed, ask for confirmation to delete first
    if (episode.transcript && episode.transcript.status === 'completed') {
      setEpisodeToDeleteTranscript(episode);
      setShowDeleteTranscriptDialog(true);
      return;
    }

    if (episode.transcript && episode.transcript.status === 'processing') {
      toast({ title: getLocaleString('transcriptionAlreadyStarted', currentLanguage), description: getLocaleString('transcriptionInProgress', currentLanguage), variant: 'info' });
      return;
    }

    await startTranscriptionProcess(episode);
  };

  // Function to handle smart file upload for missing language versions
  const handleSmartFileUpload = async (baseSlug, targetLanguage) => {
    try {
      // Create a file input element with directory selection
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.webkitdirectory = true; // Enable folder selection
      input.multiple = true;
      
      input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        // Expected filename pattern
        const expectedPattern = `${baseSlug}_${targetLanguage.toUpperCase()}.mp3`;
        
        // Find matching file in the selected folder
        const matchingFile = files.find(file => 
          file.name.toLowerCase().includes(`${baseSlug}_${targetLanguage.toUpperCase()}`.toLowerCase()) ||
          file.name.toLowerCase().includes(`${baseSlug}_${targetLanguage}`.toLowerCase())
        );

        if (!matchingFile) {
          toast({ 
            title: getLocaleString('fileNotFound', currentLanguage), 
            description: getLocaleString('fileNotFoundInFolder', currentLanguage, { expectedFilename: expectedPattern }), 
            variant: 'destructive' 
          });
          return;
        }

        // Create a new FileList-like object with only the matching file
        // This ensures only the matching file gets processed
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(matchingFile);
        
        // Add only the matching file to upload queue
        addFilesToQueue([matchingFile]);
        
        toast({ 
          title: getLocaleString('fileFoundAndAdded', currentLanguage), 
          description: getLocaleString('fileWillBeUploaded', currentLanguage, { filename: matchingFile.name }) 
        });
      };
      
      input.click();
    } catch (error) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: `${getLocaleString('fileUploadError', currentLanguage)}: ${error.message}`, 
        variant: 'destructive' 
      });
    }
  };

  const startTranscriptionProcess = async (episode) => {
    setTranscribingEpisodes(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));
    setTranscriptionProgress(prev => ({
      ...prev,
      [`${episode.slug}-${episode.lang}`]: { message: getLocaleString('startingTranscription', currentLanguage), status: 'starting' }
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
        throw new Error(getLocaleString('audioUrlNotAvailable', currentLanguage));
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
      if (!transcriptId) throw new Error(getLocaleString('assemblyAiNoJobId', currentLanguage));

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
              [`${episode.slug}-${episode.lang}`]: { message: getLocaleString('transcriptionCompleted', currentLanguage), status: 'completed' }
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
              [`${episode.slug}-${episode.lang}`]: { message: `${getLocaleString('error', currentLanguage)}: ${updates.transcriptionError || getLocaleString('unknownError', currentLanguage)}`, status: 'error' }
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

      toast({ title: getLocaleString('transcriptionStarted', currentLanguage), description: `${episode.slug} (${episode.lang.toUpperCase()})` });

    } catch (error) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `${getLocaleString('transcriptionStartError', currentLanguage)}: ${error.message}`, variant: 'destructive' });
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

  const confirmDeleteTranscript = async () => {
    if (!episodeToDeleteTranscript) return;
    
    try {
      // Delete transcript from database
      await supabase
        .from('transcripts')
        .delete()
        .eq('episode_slug', episodeToDeleteTranscript.slug)
        .eq('lang', episodeToDeleteTranscript.lang);

      // Update local state
      setEpisodes(prev => prev.map(ep => 
        ep.slug === episodeToDeleteTranscript.slug && ep.lang === episodeToDeleteTranscript.lang 
          ? { ...ep, transcript: null }
          : ep
      ));

      toast({ 
        title: getLocaleString('transcriptDeleted', currentLanguage), 
        description: `${episodeToDeleteTranscript.slug} (${episodeToDeleteTranscript.lang.toUpperCase()})` 
      });

      // Now start transcription
      await startTranscriptionProcess(episodeToDeleteTranscript);

    } catch (error) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: `Error deleting transcript: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setShowDeleteTranscriptDialog(false);
      setEpisodeToDeleteTranscript(null);
    }
  };

  // State to track available timings data for each episode
  const [availableTimingsData, setAvailableTimingsData] = useState({});

  // Function to check if timings data is available for an episode
  const checkTimingsDataAvailable = async (episode) => {
    try {
      const hasTimingsData = await timeOldService.hasTimingsData(episode.slug, episode.lang);

      setAvailableTimingsData(prev => ({
        ...prev,
        [`${episode.slug}-${episode.lang}`]: hasTimingsData
      }));

      return hasTimingsData;
    } catch (error) {
      console.error('Error checking timings data:', error);
      return false;
    }
  };

  // Check timings data when episodes are loaded
  useEffect(() => {
    if (episodes.length > 0) {
      episodes.forEach(episode => {
        if (episode.questionsCount === 0) {
          checkTimingsDataAvailable(episode);
        }
      });
    }
  }, [episodes]);

  const handleLoadQuestionsFromDB = async (episode) => {
    setLoadingQuestionsFromDB(prev => new Set(prev).add(`${episode.slug}-${episode.lang}`));

    try {
      // Используем сервис timeOldService для извлечения вопросов
      const questions = await timeOldService.loadQuestionsFromTimeOld(episode.slug, episode.lang);

      // Обновляем локальное состояние
      setEpisodes(prev => prev.map(ep =>
        ep.slug === episode.slug && ep.lang === episode.lang
          ? { ...ep, questionsCount: questions.length }
          : ep
      ));

      // Обновляем данные о доступности таймингов
      setAvailableTimingsData(prev => ({
        ...prev,
        [`${episode.slug}-${episode.lang}`]: false
      }));

      toast({
        title: getLocaleString('questionsLoaded', currentLanguage),
        description: getPluralizedLocaleString('questionsLoadedFromDB', currentLanguage, questions.length)
      });

    } catch (error) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `${getLocaleString('questionsLoadError', currentLanguage)}: ${error.message}`,
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

  const handleAutoGenerateQuestions = async (episode) => {
    if (!episode.transcript || episode.transcript.status !== 'completed') {
      toast({ title: getLocaleString('transcriptRequired', currentLanguage), description: getLocaleString('transcriptRequiredDescription', currentLanguage), variant: 'warning' });
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
        throw new Error(getLocaleString('transcriptDataNotFound', currentLanguage));
      }

      const questions = await generateQuestionsOpenAI(transcriptData.edited_transcript_data, episode.lang, currentLanguage);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error(getLocaleString('questionsGenerationFailed', currentLanguage));
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

      toast({ title: getLocaleString('questionsGenerated', currentLanguage), description: getPluralizedLocaleString('questionsGeneratedForEpisode', currentLanguage, questions.length, { episodeSlug: episode.slug, lang: episode.lang.toUpperCase() }) });

    } catch (error) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `${getLocaleString('questionsGenerationError', currentLanguage)}: ${error.message}`, variant: 'destructive' });
    } finally {
      setProcessingQuestionsEpisodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${episode.slug}-${episode.lang}`);
        return newSet;
      });
    }
  };

  const handleTranslateTranscriptFromSpanishForEnglish = async (englishEpisode, baseSlug) => {
    setTransferringTextEpisodes(prev => new Set(prev).add(`${englishEpisode?.slug || baseSlug}-en`));

    try {
      // Find Spanish episode - more flexible search
      let spanishEpisode = null;

      // First try exact match with lowercase suffix
      const esSlug = `${baseSlug}_es`;
      const { data } = await supabase
        .from('episodes')
        .select('slug, title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
        .eq('slug', esSlug)
        .eq('lang', 'es')
        .maybeSingle();
      spanishEpisode = data || null;

      if (!spanishEpisode) {
        // Try case-insensitive search for Spanish episodes with similar base slug
        const { data: altData } = await supabase
          .from('episodes')
          .select('slug, title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
          .ilike('slug', `${baseSlug}%`)
          .eq('lang', 'es')
          .limit(1)
          .maybeSingle();
        spanishEpisode = altData || null;
      }

      if (!spanishEpisode) {
        // Try to find any Spanish episode that contains the base slug (for files like "Pepe_15.10.25.ES")
        const { data: fuzzyData } = await supabase
          .from('episodes')
          .select('slug, title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
          .ilike('slug', `%${baseSlug}%`)
          .eq('lang', 'es')
          .limit(1)
          .maybeSingle();
        spanishEpisode = fuzzyData || null;
      }
      
      if (!spanishEpisode) {
        throw new Error(getLocaleString('spanishEpisodeNotFound', currentLanguage));
      }

      // Get Spanish transcript
      const { data: transcriptData } = await supabase
        .from('transcripts')
        .select('status, edited_transcript_data')
        .eq('episode_slug', spanishEpisode.slug)
        .eq('lang', 'es')
        .maybeSingle();
        
      if (!transcriptData || transcriptData.status !== 'completed') {
        throw new Error(getLocaleString('spanishTranscriptNotReady', currentLanguage));
      }
      
      if (!transcriptData.edited_transcript_data) {
        throw new Error(getLocaleString('spanishTranscriptTextNotFound', currentLanguage));
      }

      // Translate transcript
      const translatedTranscriptData = await translateTranscriptFast(
        transcriptData.edited_transcript_data, 
        'en', 
        currentLanguage,
        (progress, total, message) => {
          setTranslationProgress(prev => ({
            ...prev,
            [baseSlug]: { progress, total, message }
          }));
        }
      );
      
      if (!translatedTranscriptData || !translatedTranscriptData.utterances) {
        throw new Error(getLocaleString('transcriptTranslationFailed', currentLanguage));
      }

      // Ensure English episode exists
      const enSlug = `${baseSlug}_en`;
      const { data: existingEn } = await supabase
        .from('episodes')
        .select('slug')
        .eq('slug', enSlug)
        .eq('lang', 'en')
        .maybeSingle();
        
      if (!existingEn) {
        const payload = {
          slug: enSlug,
          title: spanishEpisode.title,
          lang: 'en',
          date: spanishEpisode.date,
          audio_url: spanishEpisode.audio_url,
          r2_object_key: spanishEpisode.r2_object_key,
          r2_bucket_name: spanishEpisode.r2_bucket_name,
          duration: spanishEpisode.duration,
          file_has_lang_suffix: true,
        };
        await supabase.from('episodes').insert(payload);
      }

      // Save English transcript
      await supabase.from('transcripts').upsert({
        episode_slug: enSlug,
        lang: 'en',
        status: 'completed',
        edited_transcript_data: translatedTranscriptData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'episode_slug,lang' });

      toast({ title: getLocaleString('transcriptTranslated', currentLanguage), description: getLocaleString('enTranscriptCreated', currentLanguage, { episodeSlug: enSlug }) });

      // Refresh episodes to show the new English version
      fetchEpisodes();
    } catch (error) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `${getLocaleString('transcriptTranslationError', currentLanguage)}: ${error.message}`, variant: 'destructive' });
    } finally {
      setTransferringTextEpisodes(prev => { const s = new Set(prev); s.delete(`${englishEpisode?.slug || baseSlug}-en`); return s; });
      setTranslationProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[baseSlug];
        return newProgress;
      });
    }
  };

  const handleTranslateQuestionsToEnglish = async (baseSlug, sourceLang) => {
    const srcLabel = sourceLang === 'ru' ? getLocaleString('russian', currentLanguage) : getLocaleString('spanish', currentLanguage);
    const srcSlug = `${baseSlug}_${sourceLang}`;
    const enSlug = `${baseSlug}_en`;
    
    setTransferringQuestionsEpisodes(prev => new Set(prev).add(`${enSlug}-en-${sourceLang}`));
    
    try {
      const { data: sourceEpisode } = await supabase
        .from('episodes')
        .select('slug')
        .eq('slug', srcSlug)
        .eq('lang', sourceLang)
        .maybeSingle();
        
      if (!sourceEpisode) {
        throw new Error(getLocaleString('sourceEpisodeNotFound', currentLanguage, { language: srcLabel }));
      }

      const { data: questionsData } = await supabase
        .from('questions')
        .select('title, time')
        .eq('episode_slug', srcSlug)
        .eq('lang', sourceLang)
        .order('time');
        
      if (!questionsData || questionsData.length === 0) {
        throw new Error(getLocaleString('questionsNotFoundForTranslation', currentLanguage));
      }

      const validatedQuestionsData = questionsData.map((q, i) => ({
        title: q.title || `${getLocaleString('question', currentLanguage)} ${i + 1}`,
        time: Number.isFinite(q.time) ? q.time : i * 10
      }));

      const translatedQuestions = await Promise.all(validatedQuestionsData.map(async (q) => {
        const prompt = `${getLocaleString('translateQuestionPrompt', currentLanguage, { sourceLanguage: srcLabel, questionTitle: q.title })}`;
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
        .eq('slug', enSlug)
        .eq('lang', 'en')
        .maybeSingle();
        
      if (!enEpisodeExists) {
        const { data: baseEp } = await supabase
          .from('episodes')
          .select('slug, title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
          .eq('slug', srcSlug)
          .maybeSingle();
          
        const payload = {
          slug: enSlug,
          title: baseEp?.title || '',
          lang: 'en',
          date: baseEp?.date || null,
          audio_url: baseEp?.audio_url || null,
          r2_object_key: baseEp?.r2_object_key || null,
          r2_bucket_name: baseEp?.r2_bucket_name || null,
          duration: baseEp?.duration || 0,
          file_has_lang_suffix: true,
        };
        await supabase.from('episodes').insert(payload);
      }

      // Save translated questions
      await supabase.from('questions').delete().eq('episode_slug', enSlug).eq('lang', 'en');
      
      const toInsert = translatedQuestions.map((q, i) => ({
        episode_slug: enSlug,
        lang: 'en',
        title: q.title,
        time: Number.isFinite(q.time) ? q.time : i * 10
      }));
      
      await supabase.from('questions').insert(toInsert);

      setEpisodes(prev => prev.map(ep => 
        ep.slug === enSlug && ep.lang === 'en' 
          ? { ...ep, questionsCount: toInsert.length }
          : ep
      ));

      setTranslatedQuestions(prev => new Set(prev).add(`${enSlug}-en-${sourceLang}`));

      toast({ title: getLocaleString('questionsTranslated', currentLanguage), description: getPluralizedLocaleString('questionsTranslatedCreated', currentLanguage, toInsert.length) });
      
    } catch (error) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `${getLocaleString('questionsTranslationError', currentLanguage)}: ${error.message}`, variant: 'destructive' });
    } finally {
      setTransferringQuestionsEpisodes(prev => { const s = new Set(prev); s.delete(`${enSlug}-en-${sourceLang}`); return s; });
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
          title: getLocaleString('errorGeneric', currentLanguage), 
          description: `${getLocaleString('episodeDeleteError', currentLanguage, { episodeTitle: episode.title || episode.slug })}: ${error.message}`, 
          variant: 'destructive' 
        });
      }
    }
    
    if (successCount > 0) {
      toast({ 
        title: getLocaleString('episodesDeleted', currentLanguage), 
        description: getPluralizedLocaleString('episodesDeletedSuccessfully', currentLanguage, successCount)
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
        title: getLocaleString('questionsDeleted', currentLanguage), 
        description: getLocaleString('allQuestionsDeletedForEpisode', currentLanguage, { episodeTitle: episodeToDeleteQuestions.title || episodeToDeleteQuestions.slug }) 
      });
      
      setEpisodes(prev => prev.map(ep =>
        ep.slug === slug && ep.lang === lang
          ? { ...ep, questionsCount: 0 }
          : ep
      ));

    } catch (error) {
      toast({ 
        title: getLocaleString('errorGeneric', currentLanguage), 
        description: `${getLocaleString('questionsDeleteError', currentLanguage)}: ${error.message}`, 
        variant: 'destructive' 
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteQuestionsDialog(false);
      setEpisodeToDeleteQuestions(null);
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString || dateString === 'unknown') return getLocaleString('dateNotSpecified', currentLanguage);

    // Если дата уже в формате DD.MM.YY, возвращаем как есть
    if (typeof dateString === 'string' && /^\d{2}\.\d{2}\.\d{2}$/.test(dateString)) {
      return dateString;
    }

    try {
      // For YYYY-MM-DD format, parse directly without timezone conversion
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
        return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(-2)}`;
      }

      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string in formatDateForDisplay:', dateString);
        return dateString; // Возвращаем оригинал при ошибке
      }

      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString(); // Convert to string before slice
      return `${day}.${month}.${year.slice(-2)}`;
    } catch (error) {
      console.warn('Error formatting date:', error, 'Input:', dateString);
      return dateString;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  // Helper function to get episode actions based on current state
  const getEpisodeActions = (episode, baseSlug) => {
    const isTranscribing = transcribingEpisodes.has(`${episode.slug}-${episode.lang}`);
    const hasAudio = episode.audio_url || episode.r2_object_key;
    const transcriptCompleted = episode.transcript?.status === 'completed';
    const transcriptProcessing = episode.transcript?.status === 'processing';

    // Check if Spanish version exists and has completed transcript
    const spanishEpisode = episodes.find(ep =>
      ep.slug.startsWith(baseSlug) && ep.lang === 'es' && ep.transcript?.status === 'completed'
    );

    // Check if Russian version exists and has questions
    const russianEpisode = episodes.find(ep =>
      ep.slug.startsWith(baseSlug) && ep.lang === 'ru' && ep.questionsCount > 0
    );

    if (episode.lang === 'en') {
      // English episode actions - improved logic
      if (!transcriptCompleted) {
        // Show translation button only if Spanish transcript is available
        if (spanishEpisode) {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTranslateTranscriptFromSpanishForEnglish(episode, baseSlug)}
              disabled={transferringTextEpisodes.has(`${episode.slug || baseSlug}-en`)}
              className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
              title={getLocaleString('translateTranscriptFromSpanish', currentLanguage)}
            >
              <Languages className="h-3 w-3 mr-1" />
              {transferringTextEpisodes.has(`${episode.slug || baseSlug}-en`) ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'ES→EN'
              )}
            </Button>
          );
        } else {
          return (
            <div className="text-xs text-slate-400 text-center">
              {getLocaleString('spanishTranscriptRequired', currentLanguage)}
            </div>
          );
        }
      } else if (episode.questionsCount === 0) {
        // Show question translation buttons based on available sources
        const hasSpanishQuestions = spanishEpisode && spanishEpisode.questionsCount > 0;
        const hasRussianQuestions = russianEpisode && russianEpisode.questionsCount > 0;

        if (hasSpanishQuestions || hasRussianQuestions) {
          return (
            <div className="flex flex-col gap-1">
              {hasSpanishQuestions && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTranslateQuestionsToEnglish(baseSlug, 'es')}
                  disabled={transferringQuestionsEpisodes.has(`${episode.slug}-en-es`)}
                  className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
                  title={getLocaleString('translateQuestionsFromSpanish', currentLanguage)}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  {transferringQuestionsEpisodes.has(`${episode.slug}-en-es`) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'ES→EN'
                  )}
                </Button>
              )}
              {hasRussianQuestions && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTranslateQuestionsToEnglish(baseSlug, 'ru')}
                  disabled={transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`)}
                  className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
                  title={getLocaleString('translateQuestionsFromRussian', currentLanguage)}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  {transferringQuestionsEpisodes.has(`${episode.slug}-en-ru`) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'RU→EN'
                  )}
                </Button>
              )}
            </div>
          );
        } else {
          return (
            <div className="text-xs text-slate-400 text-center">
              {getLocaleString('questionsNotFound', currentLanguage)}
            </div>
          );
        }
      } else {
        // English version with transcript and questions - show retranslate option
        return (
          <div className="space-y-2">
            {/* Retranslate transcript button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTranslateTranscriptFromSpanishForEnglish(episode, baseSlug)}
              disabled={transferringTextEpisodes.has(`${episode.slug || baseSlug}-en`)}
              className="w-full h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
              title={getLocaleString('retranslateTranscript', currentLanguage)}
            >
              <Languages className="h-3 w-3 mr-1" />
              {transferringTextEpisodes.has(`${episode.slug || baseSlug}-en`) ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                getLocaleString('retranslate', currentLanguage)
              )}
            </Button>

            {/* Question management */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteAllQuestions(episode)}
                className="h-8 px-2 text-xs bg-orange-600/20 border-orange-500 text-orange-300 hover:bg-orange-600/40 hover:text-orange-200 flex-1"
                title={getLocaleString('deleteAllQuestions', currentLanguage)}
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                {getLocaleString('manage', currentLanguage)} ({episode.questionsCount})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTranslateQuestionsToEnglish(baseSlug, 'es')}
                disabled={transferringQuestionsEpisodes.has(`${episode.slug}-en-es`)}
                className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200 flex-1"
                title={getLocaleString('translateQuestionsFromSpanish', currentLanguage)}
              >
                <HelpCircle className="h-3 w-3 mr-1" />
                {transferringQuestionsEpisodes.has(`${episode.slug}-en-es`) ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'ES→EN'
                )}
              </Button>
            </div>
          </div>
        );
      }
    } else {
      // Spanish/Russian episode actions with interactive transcription
      if (isTranscribing || transcriptProcessing) {
        return (
          <div className="text-xs text-purple-300 flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            {getLocaleString('starting', currentLanguage)}...
          </div>
        );
      } else if (!transcriptCompleted) {
        // No transcript yet - show transcription button
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStartTranscription(episode)}
            disabled={!hasAudio}
            className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
          >
            <PenLine className="h-3 w-3 mr-1" />
            {getLocaleString('transcribe', currentLanguage)} {episode.lang.toUpperCase()}
          </Button>
        );
      } else {
        // Transcript completed - show retranscribe button and question management
        return (
          <div className="space-y-2">
            {/* Retranscribe button with delete confirmation */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStartTranscription(episode)}
              disabled={!hasAudio}
              className="w-full h-8 px-2 text-xs bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/40 hover:text-red-200"
              title={getLocaleString('deleteAndRetranscribe', currentLanguage)}
            >
              <PenLine className="h-3 w-3 mr-1" />
              {getLocaleString('deleteAndRetranscribe', currentLanguage)}
            </Button>

            {/* Question management when transcript is completed */}
            {episode.questionsCount === 0 ? (
              <div className="flex gap-1">
                {/* Check if timings data is available for this episode - only show if data exists */}
                {availableTimingsData[`${episode.slug}-${episode.lang}`] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoadQuestionsFromDB(episode)}
                    disabled={loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`)}
                    className="h-8 px-2 text-xs bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/40 hover:text-blue-200 flex-1"
                    title={getLocaleString('loadQuestionsFromDB', currentLanguage)}
                  >
                    <Database className="h-3 w-3 mr-1" />
                    {loadingQuestionsFromDB.has(`${episode.slug}-${episode.lang}`) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      getLocaleString('fromDB', currentLanguage)
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAutoGenerateQuestions(episode)}
                  disabled={processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`)}
                  className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200 flex-1"
                  title={getLocaleString('autoGenerateQuestions', currentLanguage)}
                >
                  <Star className="h-3 w-3 mr-1" />
                  {processingQuestionsEpisodes.has(`${episode.slug}-${episode.lang}`) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    getLocaleString('recognize', currentLanguage)
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteAllQuestions(episode)}
                  className="h-8 px-2 text-xs bg-orange-600/20 border-orange-500 text-orange-300 hover:bg-orange-600/40 hover:text-orange-200 flex-1"
                  title={getLocaleString('deleteAllQuestions', currentLanguage)}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  {getLocaleString('manage', currentLanguage)} ({episode.questionsCount})
                </Button>
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-purple-300 mb-4 flex items-center">
        <Settings2 className="mr-2 h-5 w-5"/>
        {getLocaleString('episodeManagement', currentLanguage)}
      </h2>
      
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Input 
            type="text"
            placeholder={getLocaleString('searchEpisodes', currentLanguage)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700/80 border-slate-600 focus:border-purple-500 text-white placeholder-slate-400 h-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        </div>
        <Button onClick={fetchEpisodes} variant="outline" className="h-10 border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300 hover:text-white" disabled={loading}>
          <Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {getLocaleString('refresh', currentLanguage)}
        </Button>
        <Button onClick={handleSelectAll} variant="outline" className="h-10 border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300 hover:text-white" disabled={episodes.length === 0}>
           <ListChecks className="mr-2 h-4 w-4"/> {getLocaleString('selectAll', currentLanguage)} ({numSelected})
        </Button>
        <Button onClick={handleDeleteSelectedClick} variant="destructive" className="h-10" disabled={numSelected === 0 || isDeleting}>
          <Trash2 className="mr-2 h-4 w-4"/> {getLocaleString('delete', currentLanguage)} ({numSelected})
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <p className="text-center text-slate-400 py-10">{getLocaleString('noEpisodesFound', currentLanguage)}</p>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(([date, baseSlugGroups]) => (
            <div key={date} className="bg-slate-700/60 rounded-lg border border-slate-600 overflow-hidden">
              <div className="p-3 bg-slate-600/50 border-b border-slate-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-purple-200">
                        {date === 'unknown' ? getLocaleString('meditationTitlePrefix', currentLanguage) : `${getLocaleString('meditationTitlePrefix', currentLanguage)} ${formatDateForDisplay(date)}`}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">
                        {Object.values(baseSlugGroups || {}).filter(Boolean).length} {getLocaleString('episodes', currentLanguage)}
                      </span>
                    </div>
                  </div>
              </div>
              
              <div className="p-2">
                {/* Determine layout based on file types */}
                {(() => {
                  const hasLanguageSuffixFiles = (baseSlugGroups.ru && baseSlugGroups.ru.length > 0) || 
                                               (baseSlugGroups.es_en && baseSlugGroups.es_en.length > 0);
                  const hasCombinedFiles = baseSlugGroups.combined && baseSlugGroups.combined.length > 0;
                  
                  // If we have files with language suffixes, show two-group layout
                  if (hasLanguageSuffixFiles) {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Group 1: Russian Version */}
                        <div className="space-y-2">
                          {baseSlugGroups.ru && baseSlugGroups.ru.length > 0 ? (
                            baseSlugGroups.ru.map((ruEpisode) => (
                              <div key={`${ruEpisode.slug}-${ruEpisode.lang}`} className="p-2 bg-slate-600/30 rounded-lg border border-slate-500">
                                <h4 className="text-sm font-medium text-purple-200 mb-2 cursor-pointer hover:text-purple-300" 
                                    onClick={() => window.open(ruEpisode.audio_url || ruEpisode.r2_object_key, '_blank')}>
                                  {ruEpisode.r2_object_key || ruEpisode.slug}
                                </h4>
                                
                                <EpisodeLanguageCard
                                  episode={ruEpisode}
                                  language="ru"
                                  baseSlug={date}
                                  currentLanguage={currentLanguage}
                                  selectedEpisodes={selectedEpisodes}
                                  handleSelectEpisode={handleSelectEpisode}
                                  handleDeleteClick={handleDeleteClick}
                                  getEpisodeActions={getEpisodeActions}
                                  languageEpisodes={baseSlugGroups}
                                  handleSmartFileUpload={handleSmartFileUpload}
                                  episodes={episodes}
                                  onDownloadSRT={handleDownloadSRT}
                                  onProcessWithAI={handleProcessWithAI}
                                />
                              </div>
                            ))
                          ) : (
                            // Show inactive cell for Russian if it doesn't exist
                            <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600 border-dashed">
                              <div className="text-center">
                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-600/70 text-blue-100 mb-2 inline-block">
                                  RU
                                </span>
                                <p className="text-slate-500 text-sm mb-3">
                                  {getLocaleString('noFileUploaded', currentLanguage)}
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full h-7 text-xs bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/40 hover:text-green-200"
                                  onClick={() => handleSmartFileUpload(date, 'ru')}
                                >
                                  <UploadCloud className="h-3 w-3 mr-1" />
                                  {getLocaleString('uploadAudioFiles', currentLanguage)}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Group 2: Spanish and English Versions (combined) */}
                        <div className="space-y-2">
                          {baseSlugGroups.es_en && baseSlugGroups.es_en.length > 0 ? (
                            <div className="p-2 bg-slate-600/30 rounded-lg border border-slate-500">
                              {/* Find Spanish episode for the header */}
                              {(() => {
                                const spanishEpisode = baseSlugGroups.es_en.find(ep => ep.lang === 'es');
                                const headerEpisode = spanishEpisode || baseSlugGroups.es_en[0];
                                return (
                                  <h4 className="text-sm font-medium text-purple-200 mb-2 cursor-pointer hover:text-purple-300" 
                                      onClick={() => window.open(headerEpisode.audio_url || headerEpisode.r2_object_key, '_blank')}>
                                    {headerEpisode.r2_object_key || headerEpisode.slug}
                                  </h4>
                                );
                              })()}
                              
                              {/* Two-column grid for ES and EN */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {/* Spanish Version */}
                                <EpisodeLanguageCard
                                  episode={baseSlugGroups.es_en.find(ep => ep.lang === 'es') || null}
                                  language="es"
                                  baseSlug={date}
                                  currentLanguage={currentLanguage}
                                  selectedEpisodes={selectedEpisodes}
                                  handleSelectEpisode={handleSelectEpisode}
                                  handleDeleteClick={handleDeleteClick}
                                  getEpisodeActions={getEpisodeActions}
                                  languageEpisodes={baseSlugGroups}
                                  handleSmartFileUpload={handleSmartFileUpload}
                                  episodes={episodes}
                                />

                                {/* English Version */}
                                <EpisodeLanguageCard
                                  episode={baseSlugGroups.es_en.find(ep => ep.lang === 'en') || null}
                                  language="en"
                                  baseSlug={date}
                                  currentLanguage={currentLanguage}
                                  selectedEpisodes={selectedEpisodes}
                                  handleSelectEpisode={handleSelectEpisode}
                                  handleDeleteClick={handleDeleteClick}
                                  getEpisodeActions={getEpisodeActions}
                                  languageEpisodes={baseSlugGroups}
                                  handleSmartFileUpload={handleSmartFileUpload}
                                  episodes={episodes}
                                  episodes={episodes}
                                />
                              </div>
                            </div>
                          ) : (
                            // Show inactive cells for Spanish and English if they don't exist
                            <div className="p-2 bg-slate-600/30 rounded-lg border border-slate-500">
                              <h4 className="text-sm font-medium text-purple-200 mb-2">
                                ES & EN Group
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {/* Spanish inactive cell */}
                                <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600 border-dashed">
                                  <div className="text-center">
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-600/70 text-green-100 mb-2 inline-block">
                                      ES
                                    </span>
                                    <p className="text-slate-500 text-sm mb-3">
                                      {getLocaleString('noFileUploaded', currentLanguage)}
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full h-7 text-xs bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/40 hover:text-green-200"
                                      onClick={() => handleSmartFileUpload(date, 'es')}
                                    >
                                      <UploadCloud className="h-3 w-3 mr-1" />
                                      {getLocaleString('uploadAudioFiles', currentLanguage)}
                                    </Button>
                                  </div>
                                </div>
                                
            {/* English inactive cell */}
            <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600 border-dashed">
              <div className="text-center">
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-600/70 text-purple-100 mb-2 inline-block">
                  EN
                </span>
                <p className="text-slate-500 text-sm mb-3">
                  {getLocaleString('noFileUploaded', currentLanguage)}
                </p>
                {/* Smart suggestions for English - show create button if Spanish exists with transcript */}
                {(() => {
                  // Find Spanish episode more broadly across all groups
                  const spanishEpisode = episodes.find(ep =>
                    ep.slug.startsWith(date) && ep.lang === 'es' && ep.transcript?.status === 'completed'
                  );

                  if (spanishEpisode) {
                    return (
                      <div className="space-y-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200 mb-1"
                          onClick={() => {
                            const englishEpisode = { slug: `${date}_en`, lang: 'en' };
                            handleTranslateTranscriptFromSpanishForEnglish(englishEpisode, date);
                          }}
                        >
                          <Languages className="h-3 w-3 mr-1" />
                          {getLocaleString('createEnglishVersion', currentLanguage)}
                        </Button>
                        <div className="text-xs text-slate-400">
                          {getLocaleString('fromSpanishTranscript', currentLanguage)}
                        </div>
                      </div>
                    );
                  } else {
                    // Check if Spanish version exists but without transcript
                    const spanishEpisodeNoTranscript = episodes.find(ep =>
                      ep.slug.startsWith(date) && ep.lang === 'es'
                    );

                    if (spanishEpisodeNoTranscript) {
                      return (
                        <div className="text-xs text-slate-500 mb-1">
                          {getLocaleString('spanishTranscriptRequired', currentLanguage)}
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-xs text-slate-500 mb-1">
                          {getLocaleString('spanishVersionRequired', currentLanguage)}
                        </div>
                      );
                    }
                  }
                })()}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/40 hover:text-green-200"
                  onClick={() => handleSmartFileUpload(date, 'en')}
                >
                  <UploadCloud className="h-3 w-3 mr-1" />
                  {getLocaleString('uploadAudioFiles', currentLanguage)}
                </Button>
              </div>
            </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } else if (hasCombinedFiles) {
                    // If we only have combined files (no language suffixes), show single group with three columns
                    return (
                      <div className="p-2 bg-slate-600/30 rounded-lg border border-slate-500">
                        {/* Use the first episode for the header */}
                        {(() => {
                          const headerEpisode = baseSlugGroups.combined[0];
                          return (
                            <h4 className="text-sm font-medium text-purple-200 mb-2 cursor-pointer hover:text-purple-300" 
                                onClick={() => window.open(headerEpisode.audio_url || headerEpisode.r2_object_key, '_blank')}>
                              {headerEpisode.r2_object_key || headerEpisode.slug}
                            </h4>
                          );
                        })()}
                        
                        {/* Three-column grid for RU, ES, EN */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {/* Russian Version */}
                          <EpisodeLanguageCard
                            episode={baseSlugGroups.combined.find(ep => ep.lang === 'ru') || null}
                            language="ru"
                            baseSlug={date}
                            currentLanguage={currentLanguage}
                            selectedEpisodes={selectedEpisodes}
                            handleSelectEpisode={handleSelectEpisode}
                            handleDeleteClick={handleDeleteClick}
                            getEpisodeActions={getEpisodeActions}
                            languageEpisodes={baseSlugGroups}
                            handleSmartFileUpload={handleSmartFileUpload}
                            episodes={episodes}
                          />

                          {/* Spanish Version */}
                          <EpisodeLanguageCard
                            episode={baseSlugGroups.combined.find(ep => ep.lang === 'es') || null}
                            language="es"
                            baseSlug={date}
                            currentLanguage={currentLanguage}
                            selectedEpisodes={selectedEpisodes}
                            handleSelectEpisode={handleSelectEpisode}
                            handleDeleteClick={handleDeleteClick}
                            getEpisodeActions={getEpisodeActions}
                            languageEpisodes={baseSlugGroups}
                            handleSmartFileUpload={handleSmartFileUpload}
                            episodes={episodes}
                          />

                          {/* English Version */}
                          <EpisodeLanguageCard
                            episode={baseSlugGroups.combined.find(ep => ep.lang === 'en') || null}
                            language="en"
                            baseSlug={date}
                            currentLanguage={currentLanguage}
                            selectedEpisodes={selectedEpisodes}
                            handleSelectEpisode={handleSelectEpisode}
                            handleDeleteClick={handleDeleteClick}
                            getEpisodeActions={getEpisodeActions}
                            languageEpisodes={baseSlugGroups}
                            handleSmartFileUpload={handleSmartFileUpload}
                            episodes={episodes}
                            episodes={episodes}
                          />
                        </div>
                      </div>
                    );
                  } else {
                    // No files at all - show empty state
                    return (
                      <div className="p-4 text-center text-slate-500">
                        <FileAudio2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>{getLocaleString('noFilesForEpisode', currentLanguage)}</p>
                      </div>
                    );
                  }
                })()}
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
                <ShieldAlert className="h-6 w-6 mr-2" />{getLocaleString('confirmDeleteTitle', currentLanguage)}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                { episodesToDelete.length === 1 
                    ? getLocaleString('confirmDeleteEpisodeMessage', currentLanguage, { episodeTitle: episodesToDelete[0].title || episodesToDelete[0].slug })
                    : getLocaleString('confirmDeleteEpisodesMessage', currentLanguage, { count: episodesToDelete.length })
                }
                <br/><span className="font-semibold text-yellow-400 mt-2 block">{getLocaleString('actionIrreversible', currentLanguage)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>
                {getLocaleString('cancel', currentLanguage)}
              </AlertDialogCancel>
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
              <AlertDialogTitle className="text-orange-400 flex items-center">
                <HelpCircle className="h-6 w-6 mr-2" />{getLocaleString('deleteAllQuestionsTitle', currentLanguage)}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                {getLocaleString('confirmDeleteAllQuestionsMessage', currentLanguage, { episodeTitle: episodeToDeleteQuestions?.title || episodeToDeleteQuestions?.slug, lang: episodeToDeleteQuestions?.lang })}
                <br/><span className="font-semibold text-yellow-400 mt-2 block">{getLocaleString('actionIrreversible', currentLanguage)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteQuestionsDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>
                {getLocaleString('cancel', currentLanguage)}
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteAllQuestions} className="bg-orange-600 hover:bg-orange-700" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HelpCircle className="h-4 w-4 mr-2" />}
                {isDeleting ? getLocaleString('deleting', currentLanguage) : getLocaleString('deleteAllQuestionsConfirm', currentLanguage)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showDeleteTranscriptDialog && (
        <AlertDialog open={showDeleteTranscriptDialog} onOpenChange={setShowDeleteTranscriptDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-yellow-400 flex items-center">
                <PenLine className="h-6 w-6 mr-2" />Delete Transcript?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                Are you sure you want to delete the transcript for episode "{episodeToDeleteTranscript?.slug}" ({episodeToDeleteTranscript?.lang.toUpperCase()})? 
                The transcript will be deleted and transcription will start again.
                <br/><span className="font-semibold text-yellow-400 mt-2 block">{getLocaleString('actionIrreversible', currentLanguage)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteTranscriptDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500">
                {getLocaleString('cancel', currentLanguage)}
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteTranscript} className="bg-yellow-600 hover:bg-yellow-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete & Retranscribe
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

/**
 * Episode Language Card Component
 */
const EpisodeLanguageCard = ({
  episode,
  language,
  baseSlug,
  currentLanguage,
  selectedEpisodes,
  handleSelectEpisode,
  handleDeleteClick,
  getEpisodeActions,
  languageEpisodes,
  handleSmartFileUpload,
  episodes,
  onDownloadSRT,
  onProcessWithAI
}) => {
  const navigate = useNavigate();

  const langColors = {
    es: 'bg-green-600 text-green-100',
    ru: 'bg-blue-600 text-blue-100',
    en: 'bg-purple-600 text-purple-100'
  };

  const hasEpisode = episode !== null;

  // Get smart suggestions for missing languages
  const getSmartSuggestions = () => {
    if (hasEpisode) return null;

    const suggestions = [];

    // Always show upload button for Spanish and Russian languages
    if (language === 'es' || language === 'ru') {
      suggestions.push({
        type: 'upload',
        text: getLocaleString('uploadAudioFiles', currentLanguage),
        icon: <UploadCloud className="h-3 w-3 mr-1" />,
        action: 'upload'
      });
    }

    // Smart logic for English version
    if (language === 'en') {
      // Find Spanish episode more broadly across all episodes for this date
      const spanishEpisode = episodes.find(ep =>
        ep.slug.startsWith(baseSlug) && ep.lang === 'es' && ep.transcript?.status === 'completed'
      );

      // Check if Spanish version exists and has completed transcript
      if (spanishEpisode) {
        suggestions.push({
          type: 'translate',
          text: getLocaleString('createEnglishVersion', currentLanguage),
          icon: <Languages className="h-3 w-3 mr-1" />,
          action: 'translate_from_es'
        });
      } else {
        // Check if Spanish version exists but transcript is not ready
        const spanishEpisodeNoTranscript = episodes.find(ep =>
          ep.slug.startsWith(baseSlug) && ep.lang === 'es'
        );

        if (spanishEpisodeNoTranscript) {
          if (spanishEpisodeNoTranscript.transcript?.status === 'processing') {
            suggestions.push({
              type: 'wait',
              text: getLocaleString('spanishTranscriptInProgress', currentLanguage),
              icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
              action: 'wait_for_spanish'
            });
          } else {
            suggestions.push({
              type: 'transcribe_spanish',
              text: getLocaleString('transcribeSpanishFirst', currentLanguage),
              icon: <PenLine className="h-3 w-3 mr-1" />,
              action: 'transcribe_spanish_first'
            });
          }
        } else {
          suggestions.push({
            type: 'need_spanish',
            text: getLocaleString('spanishVersionRequired', currentLanguage),
            icon: <UploadCloud className="h-3 w-3 mr-1" />,
            action: 'need_spanish_first'
          });
        }
      }

      // Also check for Russian questions translation if Russian exists and has questions
      const russianEpisode = episodes.find(ep =>
        ep.slug.startsWith(baseSlug) && ep.lang === 'ru' && ep.questionsCount > 0
      );
      if (russianEpisode) {
        suggestions.push({
          type: 'translate',
          text: getLocaleString('translateQuestionsFromRussian', currentLanguage),
          icon: <Languages className="h-3 w-3 mr-1" />,
          action: 'translate_from_ru'
        });
      }
    }

    return suggestions;
  };

  const suggestions = getSmartSuggestions();

  return (
    <div className={`p-3 rounded-lg border ${
      hasEpisode
        ? 'bg-slate-600/40 border-slate-500'
        : 'bg-slate-700/30 border-slate-600 border-dashed'
    }`}>
      {hasEpisode ? (
        <div className="space-y-2">
          {/* Clickable slug on the same line as language badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${langColors[language]}`}>
                {language.toUpperCase()}
              </span>
              <div className="flex items-center gap-1">
                <div
                  className="text-xs text-purple-300 truncate cursor-pointer hover:text-purple-200 hover:underline max-w-[100px]"
                  title={`Open episode: ${episode.slug}`}
                  onClick={() => navigate(`/episode/${episode.slug}?lang=${episode.lang}`)}
                >
                  {episode.slug}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/episode/${episode.slug}?lang=${episode.lang}`, '_blank');
                  }}
                  className="h-5 w-5 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                  title={getLocaleString('openInNewWindow', currentLanguage)}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Checkbox
                id={`select-${episode.slug}-${episode.lang}`}
                checked={!!selectedEpisodes[`${episode.slug}-${episode.lang}`]}
                onCheckedChange={() => handleSelectEpisode(episode.slug, episode.lang)}
                className="border-slate-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteClick(episode)}
                className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                title={getLocaleString('delete', currentLanguage)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-1">
            {episode.transcript && episode.transcript.status !== 'completed' && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                episode.transcript.status === 'processing' ? 'bg-yellow-600 text-yellow-100' :
                episode.transcript.status === 'error' ? 'bg-red-600 text-red-100' :
                'bg-gray-600 text-gray-100'
              }`}>
                {episode.transcript.status === 'processing' ? getLocaleString('processing', currentLanguage) :
                 episode.transcript.status === 'error' ? getLocaleString('error', currentLanguage) :
                 getLocaleString('notStarted', currentLanguage)}
              </span>
            )}

            {episode.duration && episode.duration > 0 && (
              <span className="text-xs text-slate-400">
                {formatDuration(episode.duration)}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2">
            {React.cloneElement(getEpisodeActions(episode, baseSlug), {
              onDownloadSRT,
              onProcessWithAI
            })}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="mb-2">
            <FileAudio2 className="mx-auto h-6 w-6 text-slate-500 opacity-70" />
          </div>
          <p className="text-slate-500 text-sm mb-3">
            {getLocaleString('noFileUploaded', currentLanguage)}
          </p>

          {/* Smart suggestions */}
          {suggestions && suggestions.length > 0 && (
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant="outline"
                  className={`w-full h-7 text-xs ${
                    suggestion.type === 'upload'
                      ? 'bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/40 hover:text-green-200'
                      : 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200'
                  }`}
                  onClick={() => {
                    if (suggestion.action === 'translate_from_es') {
                      // Handle translation from Spanish
                      // TODO: Implement handleTranslateTranscriptFromSpanishForEnglish
                      console.warn('Translation from Spanish not yet implemented');
                    } else if (suggestion.action === 'translate_from_ru') {
                      // Handle translation from Russian
                      // TODO: Implement handleTranslateQuestionsToEnglish
                      console.warn('Translation from Russian not yet implemented');
                    } else {
                      // Handle upload using smart file upload
                      handleSmartFileUpload(baseSlug, language);
                    }
                  }}
                >
                  {suggestion.icon}
                  {suggestion.text}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManageEpisodesPage;
