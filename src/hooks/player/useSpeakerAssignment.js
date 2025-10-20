import { useState, useCallback } from 'react';
import { useToast as useShadcnToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import { useEditorAuth } from '@/contexts/EditorAuthContext';
import { saveEditToHistory } from '@/services/editHistoryService';

const useSpeakerAssignment = (episodeData, onTranscriptUpdate, toastInstance, currentLanguage, fetchTranscriptForEpisode, episodeSlug, langForContent) => {
  const defaultToastHook = useShadcnToast();
  const { toast } = toastInstance || defaultToastHook;
  const { editor, isAuthenticated, openAuthModal } = useEditorAuth();

  const [isSpeakerAssignmentDialogOpen, setIsSpeakerAssignmentDialogOpen] = useState(false);
  const [segmentForSpeakerAssignment, setSegmentForSpeakerAssignment] = useState(null);

  const handleOpenSpeakerAssignmentDialog = useCallback((segment) => {
    // Check authentication before opening speaker assignment dialog
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    setSegmentForSpeakerAssignment(segment);
    setIsSpeakerAssignmentDialogOpen(true);
  }, [isAuthenticated, openAuthModal]);

  const handleCloseSpeakerAssignmentDialog = useCallback(() => {
    setIsSpeakerAssignmentDialogOpen(false);
    setSegmentForSpeakerAssignment(null);
  }, []);

  const handleSaveSpeakerAssignment = useCallback(async (targetSegment, oldSpeakerId, newSpeakerId, isGlobalRename = false) => {
    // Check authentication
    if (!isAuthenticated) {
      openAuthModal();
      handleCloseSpeakerAssignmentDialog();
      return;
    }
    
    if (!episodeData || !episodeData.transcript || !episodeData.transcript.utterances || !onTranscriptUpdate) {
      if (toast) {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorSavingSpeakerAssignment', currentLanguage), variant: "destructive" });
      } else {
        console.error("Toast function is not available in useSpeakerAssignment");
      }
      return;
    }
    
    let hasChanged = false;
    const targetSegmentIdentifier = targetSegment.id || targetSegment.start;
    const affectedSegments = []; // Track all affected segments for history

    const updatedUtterances = episodeData.transcript.utterances.map(utt => {
      let currentUttSpeaker = utt.speaker !== null && utt.speaker !== undefined ? String(utt.speaker) : null;
      let newUtt = { ...utt };
      const uttIdentifier = utt.id || utt.start;

      if (isGlobalRename && oldSpeakerId !== undefined && oldSpeakerId !== null && currentUttSpeaker === String(oldSpeakerId)) {
        // Глобальное переименование: меняем всех с таким же именем спикера
        if (currentUttSpeaker !== String(newSpeakerId)) {
          newUtt.speaker = newSpeakerId;
          hasChanged = true;
          affectedSegments.push(uttIdentifier);
        }
      } else if (!isGlobalRename && targetSegment && uttIdentifier === targetSegmentIdentifier) {
        // Локальное изменение: меняем только целевой сегмент
        if (currentUttSpeaker !== String(newSpeakerId)) {
          newUtt.speaker = newSpeakerId;
          hasChanged = true;
          affectedSegments.push(uttIdentifier);
        }
      }
      return newUtt;
    });

    if (!hasChanged) {
      if (toast) {
        toast({ title: getLocaleString('speakerAssignedTitle', currentLanguage), description: "No changes detected for speaker assignment.", className: "bg-yellow-600/80 border-yellow-500 text-white" });
      }
      handleCloseSpeakerAssignmentDialog();
      return;
    }


    const newTranscriptData = { ...episodeData.transcript, utterances: updatedUtterances };
    
    try {
      await onTranscriptUpdate(newTranscriptData, `Assigned speaker ${newSpeakerId} (was ${oldSpeakerId}) for segment starting at ${targetSegment?.start}`);
      
      // Save to edit history
      if (editor && episodeSlug) {
        try {
          const actionType = isGlobalRename ? 'RenameSpeakerGlobally' : 'ReassignSpeaker';
          const segmentId = targetSegment.id || targetSegment.start;
          
          await saveEditToHistory({
            editorId: editor.id,
            editorEmail: editor.email,
            editorName: editor.name,
            editType: 'transcript',
            targetType: 'speaker',
            targetId: `${episodeSlug}_speaker_${segmentId}`,
            contentBefore: `Speaker: ${oldSpeakerId || 'None'}`,
            contentAfter: `Speaker: ${newSpeakerId || 'None'}`,
            filePath: null,
            metadata: {
              episodeSlug: episodeSlug,
              segmentId: segmentId,
              action: actionType,
              oldSpeaker: oldSpeakerId,
              newSpeaker: newSpeakerId,
              isGlobalRename: isGlobalRename,
              affectedSegmentsCount: affectedSegments.length,
              affectedSegmentIds: affectedSegments.slice(0, 10), // First 10 for reference
              segmentStart: targetSegment.start,
              segmentEnd: targetSegment.end,
              timestamp: new Date().toISOString()
            }
          });
          console.log(`[useSpeakerAssignment] ${actionType} saved to history (${affectedSegments.length} segments affected)`);
        } catch (historyError) {
          console.error('[useSpeakerAssignment] Failed to save edit history:', historyError);
          // Don't fail the whole operation if history save fails
        }
      }
      
      if (toast) {
        toast({ title: getLocaleString('speakerAssignedTitle', currentLanguage), description: getLocaleString('speakerAssignedDesc', currentLanguage, { newSpeaker: newSpeakerId }), className: "bg-green-600/80 border-green-500 text-white" });
      }
      
      if (fetchTranscriptForEpisode && episodeSlug && langForContent) {
        await fetchTranscriptForEpisode(episodeSlug, langForContent); 
      }

    } catch (error) {
       console.error("Error saving speaker assignment:", error);
       if (toast) {
         toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorSavingSpeakerAssignment', currentLanguage), variant: "destructive" });
       }
    }
    
    handleCloseSpeakerAssignmentDialog();
  }, [episodeData, onTranscriptUpdate, toast, currentLanguage, handleCloseSpeakerAssignmentDialog, fetchTranscriptForEpisode, episodeSlug, langForContent, isAuthenticated, editor]);

  return {
    isSpeakerAssignmentDialogOpen,
    segmentForSpeakerAssignment,
    handleOpenSpeakerAssignmentDialog,
    handleSaveSpeakerAssignment,
    handleCloseSpeakerAssignmentDialog,
  };
};

export default useSpeakerAssignment;