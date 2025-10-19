import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import { getFileNameWithoutExtension } from '@/lib/utils';
import { generateInitialItemData } from '@/services/uploader/fileDetailsExtractor';
import { processSingleItem as processSingleItemService } from '@/services/uploader/fileProcessor';
import { startPollingForItem as startPollingForItemService } from '@/services/uploader/transcriptPoller';
import { translateTextOpenAI } from '@/lib/openAIService';
import logger from '@/lib/logger';
import useEpisodePublishing from './useEpisodePublishing';
import conflictChecker from '@/lib/conflictChecker';


const useFileUploadManager = (currentLanguage) => {
  const [filesToProcess, setFilesToProcess] = useState([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [currentItemForOverwrite, setCurrentItemForOverwrite] = useState(null);
  const [conflictDialog, setConflictDialog] = useState({
    isOpen: false,
    fileItem: null,
    conflicts: null
  });
  
  const { toast } = useToast();
  const pollingIntervals = useRef({});
  const overwritePromiseResolve = useRef(null);
  const isDialogOpen = useRef(false);
  
  const { publishEpisode, isEpisodePublished } = useEpisodePublishing(currentLanguage);

  const updateItemState = useCallback((itemUniqueIdOrPredicate, updates) => {
    setFilesToProcess(prev => {
      if (typeof itemUniqueIdOrPredicate === 'function') {
        return prev.map(item => {
          const updateObject = itemUniqueIdOrPredicate(item.id);
          return { ...item, ...(updateObject || {}) };
        });
      }
      return prev.map(item => (item.id === itemUniqueIdOrPredicate ? { ...item, ...updates } : item));
    });
  }, []);

  const openOverwriteDialog = useCallback((itemData) => {
    isDialogOpen.current = true;
    setCurrentItemForOverwrite(itemData);
    setShowOverwriteDialog(true);
    return new Promise((resolve) => {
      overwritePromiseResolve.current = resolve;
    });
  }, []);

  const closeOverwriteDialog = () => {
    isDialogOpen.current = false;
    setShowOverwriteDialog(false);
    setCurrentItemForOverwrite(null);
  };

  const startPollingForItem = useCallback((itemData) => {
    startPollingForItemService(itemData, updateItemState, currentLanguage, toast, pollingIntervals);
  }, [updateItemState, currentLanguage, toast]);

  const handleTranslateTimings = useCallback(async (esItemId) => {
    logger.debug("🔄 Starting translation process for esItemId:", esItemId);
    
    const currentFiles = filesToProcess;
    const esItem = currentFiles.find(item => item.id === esItemId && item.lang === 'es');
    
    logger.debug("📝 ES Item found:", esItem ? "✅" : "❌");
    logger.debug("📄 ES timingsText length:", esItem?.timingsText?.length || 0);
    
    if (!esItem || !esItem.timingsText) {
      console.error("❌ No ES item or timingsText found");
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: "Нет текста таймингов для перевода.", variant: "destructive" });
      return;
    }

    // Check if timingsText has meaningful content (not just whitespace or very short)
    const trimmedText = esItem.timingsText.trim();
    if (trimmedText.length < 3) {
      logger.warn("⚠️ TimingsText too short, skipping translation:", trimmedText.length);
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: "Текст таймингов слишком короткий для перевода.", variant: "destructive" });
      return;
    }

    // Check if text looks like it contains timing information (basic format check)
    const hasTimingPattern = /\d{1,2}:\d{2}/.test(trimmedText) || /\d{1,2}\.\d{2}/.test(trimmedText);
    if (!hasTimingPattern) {
      logger.warn("⚠️ TimingsText doesn't appear to contain timing patterns");
    }

    const enItem = currentFiles.find(item => item.originalFileId === esItem.originalFileId && item.lang === 'en');
    logger.debug("📝 EN Item found:", enItem ? "✅" : "❌");
    
    if (!enItem) {
      logger.error("❌ No EN item found for originalFileId:", esItem.originalFileId);
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: "Не найден соответствующий английский элемент для сохранения перевода.", variant: "destructive" });
      return;
    }
    
    updateItemState(enItem.id, { isTranslatingTimings: true, timingsText: getLocaleString('timingsTranslating', currentLanguage) });

    try {
      logger.debug("🤖 Calling translateTextOpenAI with text length:", esItem.timingsText.length);
      const translatedText = await translateTextOpenAI(esItem.timingsText, 'en', currentLanguage);
      logger.debug("✅ Translation completed, result length:", translatedText?.length || 0);
      
      if (translatedText && translatedText.trim() !== '') {
        updateItemState(enItem.id, { timingsText: translatedText, isTranslatingTimings: false });
        toast({ title: getLocaleString('translateTimingsSuccessTitle', currentLanguage), description: getLocaleString('translateTimingsSuccessDesc', currentLanguage) });
        logger.debug("✅ Translation process completed successfully");
      } else {
        throw new Error("Перевод вернул пустой текст.");
      }
    } catch (error) {
      logger.error("❌ Error translating timings text:", error);
      logger.error("❌ Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 300)
      });
      
      // Determine error type and provide specific feedback
      let errorTitle = getLocaleString('translateTimingsErrorTitle', currentLanguage);
      let errorDescription = error.message;
      
      if (error.message.includes('API key')) {
        errorTitle = "🔑 Ошибка API Ключа";
        errorDescription = "DeepSeek API ключ недоступен или недействителен. Проверьте настройки сервера.";
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        errorTitle = "💳 Превышен Лимит";
        errorDescription = "Превышен лимит использования DeepSeek API. Попробуйте позже.";
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorTitle = "🌐 Сетевая Ошибка";
        errorDescription = "Проблема с подключением к DeepSeek. Проверьте интернет-соединение.";
      } else if (error.message.includes('timeout')) {
        errorTitle = "⏱️ Таймаут";
        errorDescription = "Запрос к DeepSeek занял слишком много времени. Попробуйте снова.";
      }
      
      updateItemState(enItem.id, { 
        timingsText: `❌ ${errorDescription}`, 
        isTranslatingTimings: false 
      });
      
      toast({ 
        title: errorTitle, 
        description: errorDescription, 
        variant: "destructive",
        duration: 8000  // Show error longer
      });
    }
  }, [filesToProcess, updateItemState, currentLanguage, toast]);

  // Automatic translation removed - now handled manually through UI buttons


  useEffect(() => {
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, []);

  const addFilesToQueue = useCallback(async (acceptedFiles) => {
    console.log('[addFilesToQueue] Called with files:', acceptedFiles.length);
    
    if (!acceptedFiles || acceptedFiles.length === 0) {
      console.warn('[addFilesToQueue] No files provided');
      return;
    }

    try {
      const newItemsPromises = acceptedFiles.flatMap(async (file) => {
        console.log('[addFilesToQueue] Processing file:', file.name);
        const nameWithoutExt = getFileNameWithoutExtension(file.name);
        const langSuffixMatch = nameWithoutExt.match(/_([RUruESesENen]{2})$/i);

        // Generate unique ID for file grouping (single-track files share same source)
        const fileGroupId = `${file.name}_${file.lastModified}`;

        if (langSuffixMatch) {
          const lang = langSuffixMatch[1].toLowerCase();
          console.log('[addFilesToQueue] File has language suffix:', lang);
          // Only create the specific language version that matches the file suffix
          const item = await generateInitialItemData(file, lang, currentLanguage, toast);
          return [{ ...item, fileGroupId }];
        } else {
          console.log('[addFilesToQueue] File without language suffix, creating ES and RU versions');
          // For files without language suffixes, create ES and RU versions
          // Both share the same file and will use the same R2 upload
          const esData = await generateInitialItemData(file, 'es', currentLanguage, toast);
          const ruData = await generateInitialItemData(file, 'ru', currentLanguage, toast);

          return [
            { ...esData, fileGroupId, isSingleTrackFile: true },
            { ...ruData, fileGroupId, isSingleTrackFile: true }
          ];
        }
      });

      const newItemsArrays = await Promise.all(newItemsPromises);
      const newItemsFlat = newItemsArrays.flat();
      console.log('[addFilesToQueue] Adding items to queue:', newItemsFlat.length);
      
      // Проверяем конфликты для каждого элемента
      const itemsWithConflicts = [];
      for (const item of newItemsFlat) {
        if (item) {
          try {
            const conflicts = await conflictChecker.checkFileConflicts(item);
            if (conflicts.hasFileConflict || conflicts.hasDBConflict) {
              itemsWithConflicts.push({ item, conflicts });
            }
          } catch (error) {
            console.warn('Error checking conflicts for', item.episodeSlug, error);
          }
        }
      }

      // Если есть конфликты, показываем диалог
      if (itemsWithConflicts.length > 0) {
        const firstConflict = itemsWithConflicts[0];
        setConflictDialog({
          isOpen: true,
          fileItem: firstConflict.item,
          conflicts: firstConflict.conflicts
        });
        return; // Не добавляем в очередь пока не решим конфликт
      }
      
      setFilesToProcess(prev => {
        const updated = [...prev, ...newItemsFlat.filter(item => item !== null)];
        console.log('[addFilesToQueue] Queue updated, total items:', updated.length);
        return updated;
      });

      toast({
        title: '✅ Файлы добавлены',
        description: `Добавлено ${newItemsFlat.length} элементов в очередь`,
        duration: 3000
      });
    } catch (error) {
      console.error('[addFilesToQueue] Error:', error);
      toast({
        title: '❌ Ошибка добавления файлов',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
    }
  }, [currentLanguage, toast]);

  const processSingleItem = useCallback(async (itemData, forceOverwrite = false, overwriteOptions = null) => {
    // Если у элемента есть настройки замены, используем их
    const finalOverwriteOptions = itemData.overwriteSettings || overwriteOptions;
    
    return processSingleItemService({
        itemData,
        forceOverwrite: forceOverwrite || (finalOverwriteOptions && Object.values(finalOverwriteOptions).some(Boolean)),
        updateItemState,
        currentLanguage,
        toast,
        openOverwriteDialog,
        pollingIntervalsRef: pollingIntervals,
        getAllItems: () => filesToProcess,
        overwriteOptions: finalOverwriteOptions,
    });
  }, [updateItemState, currentLanguage, toast, openOverwriteDialog, filesToProcess]);


  const handleProcessAllFiles = useCallback(async () => {
    if (isDialogOpen.current) return;
    setIsProcessingAll(true);
    
    let encounteredDialogInThisRun = false;

    for (const item of filesToProcess) {
      if (isDialogOpen.current) {
        encounteredDialogInThisRun = true;
        break; 
      }
      if (!item.uploadComplete && !item.uploadError && !item.isUploading) { 
        const result = await processSingleItem(item);
        if (!result.success && result.requiresDialog) {
            encounteredDialogInThisRun = true;
            break; 
        }
      }
    }
    
    if (!encounteredDialogInThisRun) {
        setIsProcessingAll(false);
        const allProcessedSuccessfully = filesToProcess.every(f => f.uploadComplete || f.uploadError);
        const someFailed = filesToProcess.some(f => f.uploadError);

        if (filesToProcess.length > 0) {
            if (allProcessedSuccessfully && !someFailed) {
                 toast({ title: getLocaleString('allFilesProcessedTitle', currentLanguage), description: getLocaleString('allFilesProcessedDesc', currentLanguage), duration: 5000 });
            } else if (someFailed) {
                 toast({ title: getLocaleString('processingErrorsTitle', currentLanguage), description: getLocaleString('processingErrorsDesc', currentLanguage), variant: "destructive", duration: 7000 });
            }
        }
    }
  }, [filesToProcess, processSingleItem, currentLanguage, toast]);


  const handleTimingsChange = (itemUniqueId, newText) => {
    setFilesToProcess(prev => {
        return prev.map(item => item.id === itemUniqueId ? { ...item, timingsText: newText, translationTriggered: false } : item);
    });
  };


  const handleTitleChange = (itemUniqueId, newTitle) => {
     setFilesToProcess(prev => prev.map(item => item.id === itemUniqueId ? { ...item, episodeTitle: newTitle } : item));
  };


  
  const handleRemoveItem = (itemIdToRemove) => {
     setFilesToProcess(prev => {
        const itemToRemove = prev.find(item => item.id === itemIdToRemove);
        if (itemToRemove && pollingIntervals.current[itemToRemove.id]) {
            clearInterval(pollingIntervals.current[itemToRemove.id]);
            delete pollingIntervals.current[itemToRemove.id];
        }
        return prev.filter(item => item.id !== itemIdToRemove);
     });
  };

  const confirmOverwrite = async (options) => {
    const resolvePromise = overwritePromiseResolve.current;
    closeOverwriteDialog();
    if (typeof resolvePromise === 'function') {
      overwritePromiseResolve.current = null;
      resolvePromise(options || true);
    }
  };

  const cancelOverwrite = () => {
    const resolvePromise = overwritePromiseResolve.current;
    closeOverwriteDialog();
    if (resolvePromise && typeof resolvePromise === 'function') {
      overwritePromiseResolve.current = null;
      resolvePromise(false);
    }
  };

  // Функции для обработки конфликтов
  const handleConflictConfirm = useCallback((overwriteSettings) => {
    // Добавляем файл в очередь с настройками замены
    const item = conflictDialog.fileItem;
    if (item) {
      setFilesToProcess(prev => [...prev, { ...item, overwriteSettings }]);
      
      toast({
        title: '✅ Файл добавлен с заменой',
        description: `Файл ${item.file.name} добавлен в очередь с настройками замены`,
        duration: 3000
      });
    }
    
    setConflictDialog({ isOpen: false, fileItem: null, conflicts: null });
  }, [conflictDialog.fileItem, toast]);

  const handleConflictCancel = useCallback(() => {
    setConflictDialog({ isOpen: false, fileItem: null, conflicts: null });
    
    toast({
      title: '❌ Загрузка отменена',
      description: 'Файл не был добавлен в очередь из-за конфликтов',
      variant: 'destructive',
      duration: 3000
    });
  }, [toast]);

  return {
    filesToProcess,
    isProcessingAll,
    showOverwriteDialog,
    currentItemForOverwrite,
    conflictDialog,
    addFilesToQueue,
    updateItemState,
    processSingleItem,
    handleProcessAllFiles,
    handleTimingsChange,
    handleTitleChange,
    handleRemoveItem,
    confirmOverwrite,
    cancelOverwrite,
    handleConflictConfirm,
    handleConflictCancel,
    handleTranslateTimings,
    publishEpisode,
    isEpisodePublished,
  };
};

export default useFileUploadManager;
