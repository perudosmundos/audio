import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import { getFileNameWithoutExtension } from '@/lib/utils';
import { generateInitialItemData } from '@/services/uploader/fileDetailsExtractor';
import { processSingleItem as processSingleItemService } from '@/services/uploader/fileProcessor';
import { startPollingForItem as startPollingForItemService } from '@/services/uploader/transcriptPoller';
import { translateTextOpenAI } from '@/lib/openAIService';


const useFileUploadManager = (currentLanguage) => {
  const [filesToProcess, setFilesToProcess] = useState([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [currentItemForOverwrite, setCurrentItemForOverwrite] = useState(null);
  
  const { toast } = useToast();
  const pollingIntervals = useRef({});
  const overwritePromiseResolve = useRef(null);
  const isDialogOpen = useRef(false);

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
    overwritePromiseResolve.current = null;
  };

  const startPollingForItem = useCallback((itemData) => {
    startPollingForItemService(itemData, updateItemState, currentLanguage, toast, pollingIntervals);
  }, [updateItemState, currentLanguage, toast]);

  const handleTranslateTimings = useCallback(async (esItemId) => {
    const currentFiles = filesToProcess;
    const esItem = currentFiles.find(item => item.id === esItemId && item.lang === 'es');
    if (!esItem || !esItem.timingsText) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: "Нет текста таймингов для перевода.", variant: "destructive" });
      return;
    }

    const enItem = currentFiles.find(item => item.originalFileId === esItem.originalFileId && item.lang === 'en');
    if (!enItem) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: "Не найден соответствующий английский элемент для сохранения перевода.", variant: "destructive" });
      return;
    }
    
    updateItemState(enItem.id, { isTranslatingTimings: true, timingsText: getLocaleString('timingsTranslating', currentLanguage) });

    try {
      const translatedText = await translateTextOpenAI(esItem.timingsText, 'en');
      if (translatedText) {
        updateItemState(enItem.id, { timingsText: translatedText, isTranslatingTimings: false });
        toast({ title: getLocaleString('translateTimingsSuccessTitle', currentLanguage), description: getLocaleString('translateTimingsSuccessDesc', currentLanguage) });
      } else {
        throw new Error("Перевод вернул пустой текст.");
      }
    } catch (error) {
      console.error("Error translating timings text:", error);
      updateItemState(enItem.id, { timingsText: getLocaleString('translateTimingsErrorDesc', currentLanguage, { errorMessage: '' }), isTranslatingTimings: false });
      toast({ title: getLocaleString('translateTimingsErrorTitle', currentLanguage), description: getLocaleString('translateTimingsErrorDesc', currentLanguage, { errorMessage: error.message }), variant: "destructive" });
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

  const processSingleItem = useCallback(async (itemData, forceOverwrite = false) => {
    return processSingleItemService({
        itemData,
        forceOverwrite,
        updateItemState,
        currentLanguage,
        toast,
        openOverwriteDialog,
        pollingIntervalsRef: pollingIntervals,
        getAllItems: () => filesToProcess 
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

  const confirmOverwrite = async () => {
    const itemToProcess = currentItemForOverwrite;
    const resolvePromise = overwritePromiseResolve.current;
    
    closeOverwriteDialog();

    if (itemToProcess && resolvePromise) {
      updateItemState(itemToProcess.id, { uploadError: null, isUploading: true, uploadProgress: 0, uploadComplete: false, transcriptionStatus: null, transcriptionError: null }); 
      const result = await processSingleItem(itemToProcess, true);
      if (typeof resolvePromise === 'function') {
        resolvePromise(result.success);
      }
      
      if (isProcessingAll) {
         setIsProcessingAll(false); 
         handleProcessAllFiles(); 
      }
    } else if (isProcessingAll) {
        setIsProcessingAll(false); 
    }
  };

  const cancelOverwrite = () => {
    const itemToCancel = currentItemForOverwrite;
    const resolvePromise = overwritePromiseResolve.current;

    closeOverwriteDialog();

    if (itemToCancel) {
      updateItemState(itemToCancel.id, { isUploading: false, uploadError: getLocaleString('uploadCancelledEpisodeExists', currentLanguage) });
    }
    if (resolvePromise && typeof resolvePromise === 'function') {
        resolvePromise(false);
    }
    
    if (isProcessingAll) {
        setIsProcessingAll(false);
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
  };
};

export default useFileUploadManager;