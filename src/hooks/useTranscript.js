import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import useTranscriptData from '@/hooks/transcript/useTranscriptData';
import useTranscriptAssemblyAI from '@/hooks/transcript/useTranscriptAssemblyAI';
import useTranscriptPlayerSync from '@/hooks/transcript/useTranscriptPlayerSync';
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import { processTranscriptData } from './transcript/transcriptProcessingUtils';

const useTranscript = (episodeSlug, episodeAudioUrl, episodeLang, currentLanguage, audioRef, externalTranscriptUtterances) => {
  const { toast } = useToast();
  
  const {
    transcript,
    setTranscript,
    transcriptDbId,
    setTranscriptDbId,
    isLoadingTranscript,
    setIsLoadingTranscript,
    transcriptError,
    setTranscriptError,
  } = useTranscriptData(externalTranscriptUtterances);

  const {
    isPollingTranscript,
    setIsPollingTranscript,
    transcriptionJobId,
    setTranscriptionJobId,
    pollingTimeoutRef,
    determineAssemblyLangForEpisode,
    pollTranscriptStatus,
    handleStartTranscription,
  } = useTranscriptAssemblyAI(
    episodeSlug, 
    episodeAudioUrl, 
    episodeLang, 
    currentLanguage, 
    toast, 
    setTranscript, 
    setTranscriptDbId, 
    setIsLoadingTranscript, 
    setTranscriptError,
    transcript,
    transcriptDbId
  );

  const {
    activeSegmentTime,
    setActiveSegmentTime,
    segmentPlaying,
    setSegmentPlaying,
  } = useTranscriptPlayerSync(audioRef, transcript);

  const fetchTranscript = useCallback(async () => {
    if (!episodeSlug) return;
    setIsLoadingTranscript(true);
    setTranscriptError(null);
    try {
      const transcriptLangForQuery = episodeLang === 'all' ? currentLanguage : episodeLang;
      
      const { data, error: fetchError } = await supabase
        .from('transcripts')
        .select('id, episode_slug, lang, assemblyai_transcript_id, status, transcript_data, edited_transcript_data')
        .eq('episode_slug', episodeSlug)
        .eq('lang', transcriptLangForQuery)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); 

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      if (data) {
        setTranscriptDbId(data.id);
        setTranscriptionJobId(data.assemblyai_transcript_id);
        
        const displayData = data.edited_transcript_data || data.transcript_data;
        setTranscript(displayData); // processTranscriptData is now inside useTranscriptData's setTranscript

        if (data.status === 'completed' && displayData) {
          // Already set by setTranscript
        } else if (data.status === 'processing' || data.status === 'queued') {
          toast({ title: getLocaleString('transcriptionInProgressTitle', currentLanguage), description: getLocaleString('transcriptionInProgressDescription', currentLanguage) });
          const assemblyLangForPolling = data.lang === 'ru' ? 'ru' : (data.lang === 'es' ? 'es' : determineAssemblyLangForEpisode());
          if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
          pollTranscriptStatus(data.assemblyai_transcript_id, data.id, assemblyLangForPolling);
        } else if (data.status === 'error') {
            const errorMessage = data.transcript_data?.error || getLocaleString('unknownError', currentLanguage);
            setTranscriptError(getLocaleString('transcriptionError', currentLanguage) + `: ${errorMessage}`);
            toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionError', currentLanguage) + `: ${errorMessage}`, variant: 'destructive' });
            setTranscript(null);
        } else {
          setTranscript(null); 
          setTranscriptError(getLocaleString('noTranscriptAvailableYet', currentLanguage));
        }
      } else {
        setTranscript(null);
        setTranscriptError(getLocaleString('noTranscriptAvailableYet', currentLanguage));
      }
    } catch (err) {
      if (err.code !== 'PGRST116') { 
        setTranscriptError(getLocaleString('errorFetchingTranscript', currentLanguage, { errorMessage: err.message }));
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: err.message, variant: 'destructive' });
      } else {
         setTranscript(null);
         setTranscriptError(getLocaleString('noTranscriptAvailableYet', currentLanguage));
      }
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [
      episodeSlug, 
      episodeLang, 
      currentLanguage, 
      setIsLoadingTranscript, 
      setTranscriptError, 
      setTranscriptDbId, 
      setTranscriptionJobId, 
      setTranscript, 
      toast, 
      determineAssemblyLangForEpisode, 
      pollTranscriptStatus,
      pollingTimeoutRef
    ]);

  useEffect(() => {
    if (!externalTranscriptUtterances) { // Only fetch if not provided externally (e.g. from PlayerPage)
        fetchTranscript();
    }
    return () => {
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
        }
    }
  }, [fetchTranscript, externalTranscriptUtterances]);


  const handleSaveEditedSegment = async (updatedUtterances) => {
    if (!transcript) return;
    // Автоматически разбиваем длинные сегменты
    const processedTranscript = processTranscriptData({ ...transcript, utterances: updatedUtterances, words: transcript.words });
    const newEditedTranscriptData = { 
      ...transcript, 
      utterances: processedTranscript.utterances,
      text: processedTranscript.utterances.map(u => u.text).join(' '),
      words: transcript.words || [] 
    };
    setTranscript(newEditedTranscriptData);
    try {
      const { error: updateError } = await supabase
        .from('transcripts')
        .update({ edited_transcript_data: newEditedTranscriptData })
        .eq('id', transcriptDbId);
      if (updateError) {
        console.error("Error updating segment in DB:", updateError);
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorUpdatingSegment', currentLanguage, { errorMessage: updateError.message }), variant: 'destructive' });
        fetchTranscript(); 
      } else {
        toast({ title: getLocaleString('transcriptSegmentUpdatedTitle', currentLanguage), description: getLocaleString('transcriptSegmentUpdatedDesc', currentLanguage), variant: "default" });
      }
    } catch (err) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorUpdatingSegment', currentLanguage, { errorMessage: err.message }), variant: 'destructive' });
      fetchTranscript(); 
    }
  };

  return {
    transcript,
    isLoadingTranscript,
    transcriptError,
    isPollingTranscript,
    fetchTranscript,
    handleStartTranscription,
    handleSaveEditedSegment,
    determineAssemblyLangForEpisode,
    activeSegmentTime,
    setActiveSegmentTime,
    segmentPlaying,
    setSegmentPlaying,
  };
};

export default useTranscript;