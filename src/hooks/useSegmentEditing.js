import React, { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import logService from '@/lib/logService';

const useSegmentEditing = (
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
  const initialAudioState = useRef({ isPlaying: false, currentTime: 0 });
  const { toast } = useToast();

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
      
      await onSaveEditedSegment(newUtterances, 'update', originalSegment, updatedSegment);
      
      setEditingSegment(null);
      toast({
        title: getLocaleString('transcriptSegmentUpdatedTitle', currentLanguage),
        description: getLocaleString('transcriptSegmentUpdatedDesc', currentLanguage),
        className: "bg-green-600/80 border-green-500 text-white"
      });
      restoreAudioState();
    } catch (error) {
      console.error("Failed to save segment:", error);
      toast({ title: "Save Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [editingSegment, isSaving, editedText, utterances, onSaveEditedSegment, toast, currentLanguage, restoreAudioState]);

  const handleCancelEdit = useCallback(() => {
    setEditingSegment(null);
    restoreAudioState();
  }, [restoreAudioState]);

  const executeAction = useCallback(async (actionType, segmentToModify, textContent, cursorPos) => {
    let newUtterances;
    const originalUtterances = JSON.parse(JSON.stringify(utterances)); 
    let logEntityId = segmentToModify.id || segmentToModify.start;
    let actionDetail = {};

    switch (actionType) {
      case 'Split':
        if (textareaRef?.current && textareaRef.current.selectionStart !== undefined) {
          cursorPos = textareaRef.current.selectionStart;
        } else if (cursorPos === undefined || cursorPos === null) {
          toast({ title: getLocaleString('errorSplittingSegment', currentLanguage), description: getLocaleString('cursorPositionRequired', currentLanguage), variant: 'destructive' });
          return;
        }
        const textBefore = textContent.substring(0, cursorPos).trim();
        const textAfter = textContent.substring(cursorPos).trim();
        if (!textBefore || !textAfter || !segmentToModify.words || segmentToModify.words.length === 0) {
          toast({ title: getLocaleString('errorSplittingSegment', currentLanguage), description: getLocaleString('cannotSplitEmpty', currentLanguage), variant: 'destructive' });
          return;
        }
        let splitWordIndex = -1;
        let cumulativeLength = 0;
        for (let i = 0; i < segmentToModify.words.length; i++) {
          cumulativeLength += segmentToModify.words[i].text.length + (i > 0 ? 1 : 0);
          if (cumulativeLength >= cursorPos) {
            splitWordIndex = i;
            break;
          }
        }
        if (splitWordIndex === -1 || splitWordIndex >= segmentToModify.words.length - 1) {
          toast({ title: getLocaleString('errorSplittingSegment', currentLanguage), description: getLocaleString('cannotSplitAtPosition', currentLanguage), variant: 'destructive' });
          return;
        }
        const wordsBefore = segmentToModify.words.slice(0, splitWordIndex + 1);
        const wordsAfter = segmentToModify.words.slice(splitWordIndex + 1);
        if (wordsBefore.length === 0 || wordsAfter.length === 0) {
          toast({ title: getLocaleString('errorSplittingSegment', currentLanguage), description: getLocaleString('cannotSplitIntoEmpty', currentLanguage), variant: 'destructive' });
          return;
        }
        const newSegment1 = { ...segmentToModify, text: textBefore, end: wordsBefore[wordsBefore.length - 1].end, words: wordsBefore, id: segmentToModify.id || `${segmentToModify.start}-split1-${Date.now()}` };
        const newSegment2 = { ...segmentToModify, start: wordsAfter[0].start, text: textAfter, words: wordsAfter, id: `${segmentToModify.start}-split2-${Date.now()}` };
        const segmentIndexInAllUtterances = utterances.findIndex(utt => (utt.id || utt.start) === (segmentToModify.id || segmentToModify.start));
        if (segmentIndexInAllUtterances === -1) return;
        newUtterances = [...utterances.slice(0, segmentIndexInAllUtterances), newSegment1, newSegment2, ...utterances.slice(segmentIndexInAllUtterances + 1)];
        actionDetail = { splitAt: cursorPos, segment1: newSegment1, segment2: newSegment2 };
        break;
      case 'Merge':
        const currentSegmentIndex = utterances.findIndex(utt => (utt.id || utt.start) === (segmentToModify.id || segmentToModify.start));
        if (currentSegmentIndex <= 0) {
          toast({ title: getLocaleString('errorMergingSegment', currentLanguage), description: getLocaleString('cannotMergeFirstSegment', currentLanguage), variant: 'destructive' });
          return;
        }
        const previousSegment = utterances[currentSegmentIndex - 1];
        const mergedText = `${previousSegment.text} ${segmentToModify.text}`.trim();
        const mergedWords = [...(previousSegment.words || []), ...(segmentToModify.words || [])].sort((a, b) => a.start - b.start);
        const mergedSegment = { ...previousSegment, text: mergedText, end: segmentToModify.end, words: mergedWords, id: previousSegment.id || `${previousSegment.start}-merged-${Date.now()}` };
        newUtterances = [...utterances.slice(0, currentSegmentIndex - 1), mergedSegment, ...utterances.slice(currentSegmentIndex + 1)];
        actionDetail = { mergedWith: previousSegment.id || previousSegment.start, resultingSegment: mergedSegment };
        break;
      case 'Delete':
        newUtterances = utterances.filter(utt => (utt.id || utt.start) !== (segmentToModify.id || segmentToModify.start));
        actionDetail = { deletedSegment: segmentToModify };
        break;
      default:
        return;
    }
    if (newUtterances) {
      await onSaveEditedSegment(newUtterances, actionType.toLowerCase(), segmentToModify, newUtterances.find(utt => utt.id === (actionDetail.resultingSegment?.id || actionDetail.segment1?.id) ) || null, originalUtterances);
      setEditingSegment(null);
      restoreAudioState();
    }
  }, [utterances, onSaveEditedSegment, toast, currentLanguage, restoreAudioState, textareaRef, user, episodeSlug]);

  const performActionWithConfirmation = useCallback((actionType, segmentToModify, textContent, cursorPos) => {
    const dontAskAgainKey = `confirm${actionType}SegmentDisabled`;
    const isDisabled = localStorage.getItem(dontAskAgainKey) === 'true';

    if (isDisabled) {
      executeAction(actionType, segmentToModify, textContent, cursorPos);
      return;
    }

    let titleKey, descriptionKey;
    switch (actionType) {
      case 'Split': titleKey = 'confirmSplitTitle'; descriptionKey = 'confirmSplitDescription'; break;
      case 'Merge': titleKey = 'confirmMergeTitle'; descriptionKey = 'confirmMergeDescription'; break;
      case 'Delete': titleKey = 'confirmDeleteSegmentTitle'; descriptionKey = 'confirmDeleteSegmentDescription'; break;
      default: return;
    }

    setConfirmDialogProps({
      title: getLocaleString(titleKey, currentLanguage),
      description: getLocaleString(descriptionKey, currentLanguage),
      onConfirm: () => {
        executeAction(actionType, segmentToModify, textContent, cursorPos);
        setShowConfirmDialog(false);
      },
      onCancel: () => setShowConfirmDialog(false),
      actionType
    });
    setShowConfirmDialog(true);
  }, [executeAction, currentLanguage]);

  return {
    editingSegment,
    setEditingSegment,
    editedText,
    setEditedText,
    showConfirmDialog,
    confirmDialogProps,
    textareaRef, 
    setTextareaRef,
    handleEditSegment,
    handleSaveCurrentSegmentEdit,
    handleCancelEdit,
    performActionWithConfirmation,
    setShowConfirmDialog,
    isSaving,
  };
};

export default useSegmentEditing;