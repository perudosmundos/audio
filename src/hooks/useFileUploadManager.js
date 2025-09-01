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


const useFileUploadManager = (currentLanguage) => {
  const [filesToProcess, setFilesToProcess] = useState([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [currentItemForOverwrite, setCurrentItemForOverwrite] = useState(null);
  
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

  useEffect(() => {
    filesToProcess.forEach(item => {
      if (item.lang === 'es' && item.timingsText && !item.translationTriggered) {
        const enItem = filesToProcess.find(i => i.originalFileId === item.originalFileId && i.lang === 'en');
        if (enItem) {
          updateItemState(item.id, { translationTriggered: true });
          handleTranslateTimings(item.id);
        }
      }
    });
  }, [filesToProcess, handleTranslateTimings, updateItemState]);


  useEffect(() => {
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, []);

  const addFilesToQueue = useCallback(async (acceptedFiles) => {
    const newItemsPromises = acceptedFiles.flatMap(async (file) => {
      const nameWithoutExt = getFileNameWithoutExtension(file.name);
      const langSuffixMatch = nameWithoutExt.match(/_([RUruESesENen]{2})$/i);
      
      if (langSuffixMatch) {
        const lang = langSuffixMatch[1].toLowerCase();
        if (lang === 'es') {
           return Promise.all([
            generateInitialItemData(file, 'es', currentLanguage, toast),
            generateInitialItemData(file, 'en', currentLanguage, toast, 'es') 
          ]);
        }
        return [await generateInitialItemData(file, lang, currentLanguage, toast)];
      } else {
        const esDataPromise = generateInitialItemData(file, 'es', currentLanguage, toast);
        const ruDataPromise = generateInitialItemData(file, 'ru', currentLanguage, toast);
        
        const esData = await esDataPromise;
        const enDataPromise = generateInitialItemData(file, 'en', currentLanguage, toast, 'es', esData?.timingsText);
        
        return Promise.all([ruDataPromise, esDataPromise, enDataPromise]);
      }
    });

    const newItemsArrays = await Promise.all(newItemsPromises);
    const newItemsFlat = newItemsArrays.flat();
    setFilesToProcess(prev => [...prev, ...newItemsFlat.filter(item => item !== null)]);
  }, [currentLanguage, toast]);

  const processSingleItem = useCallback(async (itemData, forceOverwrite = false, overwriteOptions = null) => {
    return processSingleItemService({
        itemData,
        forceOverwrite,
        updateItemState,
        currentLanguage,
        toast,
        openOverwriteDialog,
        pollingIntervalsRef: pollingIntervals,
        getAllItems: () => filesToProcess,
        overwriteOptions,
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
        const updatedFiles = prev.map(item => item.id === itemUniqueId ? { ...item, timingsText: newText, translationTriggered: false } : item);
        const changedItem = updatedFiles.find(item => item.id === itemUniqueId);

        if (changedItem && changedItem.lang === 'es' && newText.trim()) {
            const enItem = updatedFiles.find(item => item.originalFileId === changedItem.originalFileId && item.lang === 'en');
            if (enItem) {
                handleTranslateTimings(changedItem.id);
            }
        }
        return updatedFiles;
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

  return {
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
    publishEpisode,
    isEpisodePublished,
  };
};

export default useFileUploadManager;