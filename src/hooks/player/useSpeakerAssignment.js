import { useState, useCallback } from 'react';
import { useToast as useShadcnToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';

const useSpeakerAssignment = (episodeData, onTranscriptUpdate, toastInstance, currentLanguage, fetchTranscriptForEpisode, episodeSlug, langForContent) => {
  const defaultToastHook = useShadcnToast();
  const { toast } = toastInstance || defaultToastHook;

  const [isSpeakerAssignmentDialogOpen, setIsSpeakerAssignmentDialogOpen] = useState(false);
  const [segmentForSpeakerAssignment, setSegmentForSpeakerAssignment] = useState(null);

  const handleOpenSpeakerAssignmentDialog = useCallback((segment) => {
    setSegmentForSpeakerAssignment(segment);
    setIsSpeakerAssignmentDialogOpen(true);
  }, []);

  const handleCloseSpeakerAssignmentDialog = useCallback(() => {
    setIsSpeakerAssignmentDialogOpen(false);
    setSegmentForSpeakerAssignment(null);
  }, []);

  const handleSaveSpeakerAssignment = useCallback(async (targetSegment, oldSpeakerId, newSpeakerId) => {
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

    const updatedUtterances = episodeData.transcript.utterances.map(utt => {
      let currentUttSpeaker = utt.speaker !== null && utt.speaker !== undefined ? String(utt.speaker) : null;
      let newUtt = { ...utt };
      const uttIdentifier = utt.id || utt.start;

      if (targetSegment && uttIdentifier === targetSegmentIdentifier) {
        if (currentUttSpeaker !== String(newSpeakerId)) {
          newUtt.speaker = newSpeakerId;
          hasChanged = true;
        }
      } else if (oldSpeakerId !== undefined && oldSpeakerId !== null && currentUttSpeaker === String(oldSpeakerId)) {
         if (currentUttSpeaker !== String(newSpeakerId)) {
           newUtt.speaker = newSpeakerId;
           hasChanged = true;
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
  }, [episodeData, onTranscriptUpdate, toast, currentLanguage, handleCloseSpeakerAssignmentDialog, fetchTranscriptForEpisode, episodeSlug, langForContent]);

  return {
    isSpeakerAssignmentDialogOpen,
    segmentForSpeakerAssignment,
    handleOpenSpeakerAssignmentDialog,
    handleSaveSpeakerAssignment,
    handleCloseSpeakerAssignmentDialog,
  };
};

export default useSpeakerAssignment;