import React, { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import logService from '@/lib/logService';
import syncService from '@/lib/syncService';

const useOfflineSegmentEditing = (
  utterances, 
  onSaveEditedSegment, 
  audioRef, 
  currentLanguage,
  user,
  episodeSlug
) => {
  const [editingSegment, setEditingSegment] = useState(null);
  const [editedText, setEditedText] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogProps, setConfirmDialogProps] = useState({});
  const [textareaRef, setTextareaRef] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(!syncService.getNetworkStatus().isOnline);
  const initialAudioState = useRef({ isPlaying: false, currentTime: 0 });
  const { toast } = useToast();

  // Подписка на изменения сетевого состояния
  React.useEffect(() => {
    const unsubscribe = syncService.onNetworkChange((isOnline) => {
      setIsOfflineMode(!isOnline);
    });

    return unsubscribe;
  }, []);

  const handleEditSegment = useCallback((segmentToEdit) => {
    if (audioRef?.current) {
      initialAudioState.current = {
        isPlaying: !audioRef.current.paused,
        currentTime: audioRef.current.currentTime,
      };
    }
    setEditingSegment(segmentToEdit);
    setEditedText(segmentToEdit ? segmentToEdit.text : '');
  }, [audioRef]);

  const restoreAudioState = useCallback(() => {
    if (audioRef?.current && initialAudioState.current.isPlaying && audioRef.current.paused) {
      audioRef.current.currentTime = initialAudioState.current.currentTime;
      audioRef.current.play().catch(e => console.error("Error restoring audio play state:", e));
    } else if (audioRef?.current) {
      audioRef.current.currentTime = initialAudioState.current.currentTime;
    }
  }, [audioRef]);

  const handleSaveCurrentSegmentEdit = useCallback(async () => {
    if (!editingSegment || isSaving) return;
    
    setIsSaving(true);
    try {
      const updatedSegment = { ...editingSegment, text: editedText };
      const newUtterances = utterances.map(utt =>
        (utt.id || utt.start) === (editingSegment.id || editingSegment.start) ? updatedSegment : utt
      );
      const originalSegment = utterances.find(utt => (utt.id || utt.start) === (editingSegment.id || editingSegment.start));
      
      // Сохраняем изменения через офлайн-совместимый метод
      await onSaveEditedSegment(newUtterances, 'update', originalSegment, updatedSegment);
      
      setEditingSegment(null);
      
      // Показываем соответствующее уведомление в зависимости от режима
      if (isOfflineMode) {
        toast({
          title: getLocaleString('savedOffline', currentLanguage),
          description: getLocaleString('segmentSavedOffline', currentLanguage) || 'Изменения сохранены локально и будут синхронизированы при подключении к интернету',
          className: "bg-yellow-600/80 border-yellow-500 text-white"
        });
      } else {
        toast({
          title: getLocaleString('transcriptSegmentUpdatedTitle', currentLanguage),
          description: getLocaleString('transcriptSegmentUpdatedDesc', currentLanguage),
          className: "bg-green-600/80 border-green-500 text-white"
        });
      }
      
      restoreAudioState();
      
      // Логируем изменение
      if (user && originalSegment) {
        const logData = {
          user_id: user.id,
          episode_slug: episodeSlug,
          action: 'segment_edit',
          original_text: originalSegment.text,
          new_text: editedText,
          segment_start: originalSegment.start,
          segment_end: originalSegment.end,
          offline_mode: isOfflineMode
        };
        
        try {
          await logService.log(logData);
        } catch (logError) {
          console.warn('Failed to log segment edit:', logError);
        }
      }
    } catch (error) {
      console.error("Failed to save segment:", error);
      
      const errorMessage = isOfflineMode 
        ? getLocaleString('offlineSaveError', currentLanguage) || 'Ошибка сохранения в офлайн режиме'
        : getLocaleString('saveError', currentLanguage) || 'Ошибка сохранения';
      
      toast({ 
        title: errorMessage, 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  }, [editingSegment, isSaving, editedText, utterances, onSaveEditedSegment, toast, currentLanguage, restoreAudioState, user, episodeSlug, isOfflineMode]);

  const handleCancelEdit = useCallback(() => {
    setEditingSegment(null);
    restoreAudioState();
  }, [restoreAudioState]);

  const executeAction = useCallback((action) => {
    switch (action) {
      case 'save':
        handleSaveCurrentSegmentEdit();
        break;
      case 'cancel':
        handleCancelEdit();
        break;
      default:
        console.warn('Unknown action:', action);
    }
  }, [handleSaveCurrentSegmentEdit, handleCancelEdit]);

  const showConfirmationDialog = useCallback((title, message, onConfirm, onCancel) => {
    setConfirmDialogProps({
      title,
      message,
      onConfirm,
      onCancel: onCancel || (() => setShowConfirmDialog(false))
    });
    setShowConfirmDialog(true);
  }, []);

  const handleSplitSegment = useCallback((segment, splitPosition) => {
    if (!segment || splitPosition <= 0) return;

    const text = segment.text;
    const beforeText = text.substring(0, splitPosition).trim();
    const afterText = text.substring(splitPosition).trim();

    if (!beforeText || !afterText) {
      toast({
        title: getLocaleString('splitError', currentLanguage) || 'Ошибка разделения',
        description: getLocaleString('splitErrorDesc', currentLanguage) || 'Нельзя создать пустые сегменты',
        variant: "destructive"
      });
      return;
    }

    const segmentDuration = segment.end - segment.start;
    const splitRatio = splitPosition / text.length;
    const splitTime = segment.start + (segmentDuration * splitRatio);

    const beforeSegment = {
      ...segment,
      text: beforeText,
      end: Math.round(splitTime)
    };

    const afterSegment = {
      ...segment,
      id: segment.id ? `${segment.id}_split` : undefined,
      text: afterText,
      start: Math.round(splitTime)
    };

    const segmentIndex = utterances.findIndex(utt => 
      (utt.id || utt.start) === (segment.id || segment.start)
    );

    if (segmentIndex === -1) return;

    const newUtterances = [
      ...utterances.slice(0, segmentIndex),
      beforeSegment,
      afterSegment,
      ...utterances.slice(segmentIndex + 1)
    ];

    showConfirmationDialog(
      getLocaleString('confirmSplit', currentLanguage) || 'Подтвердить разделение',
      isOfflineMode 
        ? (getLocaleString('confirmSplitOffline', currentLanguage) || 'Разделить сегмент? Изменения будут сохранены локально.')
        : (getLocaleString('confirmSplitOnline', currentLanguage) || 'Разделить сегмент?'),
      async () => {
        try {
          await onSaveEditedSegment(newUtterances, 'split', segment, [beforeSegment, afterSegment]);
          setEditingSegment(null);
          setShowConfirmDialog(false);
          
          const successMessage = isOfflineMode
            ? getLocaleString('segmentSplitOffline', currentLanguage) || 'Сегмент разделен (офлайн)'
            : getLocaleString('segmentSplit', currentLanguage) || 'Сегмент разделен';
          
          toast({
            title: successMessage,
            className: isOfflineMode 
              ? "bg-yellow-600/80 border-yellow-500 text-white"
              : "bg-green-600/80 border-green-500 text-white"
          });
        } catch (error) {
          console.error('Failed to split segment:', error);
          toast({
            title: getLocaleString('splitError', currentLanguage) || 'Ошибка разделения',
            description: error.message,
            variant: "destructive"
          });
        }
      }
    );
  }, [utterances, onSaveEditedSegment, showConfirmationDialog, toast, currentLanguage, isOfflineMode]);

  const handleMergeWithNext = useCallback((segment) => {
    const currentIndex = utterances.findIndex(utt => 
      (utt.id || utt.start) === (segment.id || segment.start)
    );
    
    if (currentIndex === -1 || currentIndex >= utterances.length - 1) {
      toast({
        title: getLocaleString('mergeError', currentLanguage) || 'Ошибка объединения',
        description: getLocaleString('mergeErrorDesc', currentLanguage) || 'Нет следующего сегмента для объединения',
        variant: "destructive"
      });
      return;
    }

    const nextSegment = utterances[currentIndex + 1];
    const mergedSegment = {
      ...segment,
      text: `${segment.text} ${nextSegment.text}`,
      end: nextSegment.end
    };

    const newUtterances = [
      ...utterances.slice(0, currentIndex),
      mergedSegment,
      ...utterances.slice(currentIndex + 2)
    ];

    showConfirmationDialog(
      getLocaleString('confirmMerge', currentLanguage) || 'Подтвердить объединение',
      isOfflineMode
        ? (getLocaleString('confirmMergeOffline', currentLanguage) || 'Объединить с следующим сегментом? Изменения будут сохранены локально.')
        : (getLocaleString('confirmMergeOnline', currentLanguage) || 'Объединить с следующим сегментом?'),
      async () => {
        try {
          await onSaveEditedSegment(newUtterances, 'merge', [segment, nextSegment], mergedSegment);
          setEditingSegment(null);
          setShowConfirmDialog(false);
          
          const successMessage = isOfflineMode
            ? getLocaleString('segmentMergedOffline', currentLanguage) || 'Сегменты объединены (офлайн)'
            : getLocaleString('segmentMerged', currentLanguage) || 'Сегменты объединены';
          
          toast({
            title: successMessage,
            className: isOfflineMode 
              ? "bg-yellow-600/80 border-yellow-500 text-white"
              : "bg-green-600/80 border-green-500 text-white"
          });
        } catch (error) {
          console.error('Failed to merge segments:', error);
          toast({
            title: getLocaleString('mergeError', currentLanguage) || 'Ошибка объединения',
            description: error.message,
            variant: "destructive"
          });
        }
      }
    );
  }, [utterances, onSaveEditedSegment, showConfirmationDialog, toast, currentLanguage, isOfflineMode]);

  const handleDeleteSegment = useCallback((segment) => {
    const newUtterances = utterances.filter(utt => 
      (utt.id || utt.start) !== (segment.id || segment.start)
    );

    showConfirmationDialog(
      getLocaleString('confirmDelete', currentLanguage) || 'Подтвердить удаление',
      isOfflineMode
        ? (getLocaleString('confirmDeleteOffline', currentLanguage) || 'Удалить сегмент? Изменения будут сохранены локально.')
        : (getLocaleString('confirmDeleteOnline', currentLanguage) || 'Удалить сегмент?'),
      async () => {
        try {
          await onSaveEditedSegment(newUtterances, 'delete', segment, null);
          setEditingSegment(null);
          setShowConfirmDialog(false);
          
          const successMessage = isOfflineMode
            ? getLocaleString('segmentDeletedOffline', currentLanguage) || 'Сегмент удален (офлайн)'
            : getLocaleString('segmentDeleted', currentLanguage) || 'Сегмент удален';
          
          toast({
            title: successMessage,
            className: isOfflineMode 
              ? "bg-yellow-600/80 border-yellow-500 text-white"
              : "bg-green-600/80 border-green-500 text-white"
          });
        } catch (error) {
          console.error('Failed to delete segment:', error);
          toast({
            title: getLocaleString('deleteError', currentLanguage) || 'Ошибка удаления',
            description: error.message,
            variant: "destructive"
          });
        }
      }
    );
  }, [utterances, onSaveEditedSegment, showConfirmationDialog, toast, currentLanguage, isOfflineMode]);

  return {
    // Состояние редактирования
    editingSegment,
    editedText,
    setEditedText,
    isSaving,
    isOfflineMode,
    
    // Диалог подтверждения
    showConfirmDialog,
    confirmDialogProps,
    setShowConfirmDialog,
    
    // Ссылка на textarea
    textareaRef,
    setTextareaRef,
    
    // Основные методы
    handleEditSegment,
    handleSaveCurrentSegmentEdit,
    handleCancelEdit,
    executeAction,
    
    // Методы манипуляции сегментами
    handleSplitSegment,
    handleMergeWithNext,
    handleDeleteSegment,
    
    // Утилиты
    showConfirmationDialog,
    restoreAudioState
  };
};

export default useOfflineSegmentEditing;
