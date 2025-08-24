import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import useTranscriptData from '@/hooks/transcript/useTranscriptData';
import useTranscriptAssemblyAI from '@/hooks/transcript/useTranscriptAssemblyAI';
import useTranscriptPlayerSync from '@/hooks/transcript/useTranscriptPlayerSync';
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import { processTranscriptData, buildEditedTranscriptData } from './transcript/transcriptProcessingUtils';
import logger from '@/lib/logger';

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

  // For large transcripts: wait for compact edited data instead of processing full payload immediately
  const finalizeRetryRef = useRef({ retries: 0, timeoutId: null });

  const fetchTranscript = useCallback(async () => {
    if (!episodeSlug) return;
    setIsLoadingTranscript(true);
    setTranscriptError(null);
    try {
      logger.debug('[useTranscript] Fetching transcript from DB', { episodeSlug, episodeLang, currentLanguage });
      const transcriptLangForQuery = episodeLang === 'all' ? currentLanguage : episodeLang;
      
      const { data, error: fetchError } = await supabase
        .from('transcripts')
        .select('id, episode_slug, lang, assemblyai_transcript_id, status, edited_transcript_data')
        .eq('episode_slug', episodeSlug)
        .eq('lang', transcriptLangForQuery)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); 

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      if (data) {
        logger.debug('[useTranscript] Transcript row found', { id: data.id, status: data.status, hasEdited: !!data.edited_transcript_data });
        setTranscriptDbId(data.id);
        setTranscriptionJobId(data.assemblyai_transcript_id);
        
        // Используем только edited_transcript_data
        const displayData = data.edited_transcript_data;

        if (data.status === 'completed') {
          if (hasCompact && displayData) {
            setTranscript(displayData);
            // Clear any pending finalize retries
            if (finalizeRetryRef.current.timeoutId) {
              clearTimeout(finalizeRetryRef.current.timeoutId);
              finalizeRetryRef.current.timeoutId = null;
            }
            finalizeRetryRef.current.retries = 0;
          } else if (displayData) {
            // Avoid processing huge raw payloads in UI; wait briefly for compact save to finish
            toast({ title: getLocaleString('transcriptionCompletedTitle', currentLanguage), description: getLocaleString('finalizingTranscriptData', currentLanguage) });
            logger.debug('[useTranscript] Completed without compact yet, scheduling refetch', { retries: finalizeRetryRef.current.retries });
            if (finalizeRetryRef.current.retries < 5) {
              const retryDelayMs = 1500 + finalizeRetryRef.current.retries * 500;
              finalizeRetryRef.current.retries += 1;
              if (finalizeRetryRef.current.timeoutId) clearTimeout(finalizeRetryRef.current.timeoutId);
              finalizeRetryRef.current.timeoutId = setTimeout(() => {
                fetchTranscript();
              }, retryDelayMs);
            } else {
              // As a fallback after retries, set minimal transcript to avoid total stall
              setTranscript({ utterances: Array.isArray(displayData?.utterances) ? displayData.utterances.map(u => ({ start: u.start, end: u.end, text: u.text, id: u.id, speaker: u.speaker })) : [], words: [] });
              logger.warn('[useTranscript] Fallback minimal transcript applied');
            }
          } else {
            setTranscript(null);
          }
        } else if (data.status === 'processing' || data.status === 'queued') {
          toast({ title: getLocaleString('transcriptionInProgressTitle', currentLanguage), description: getLocaleString('transcriptionInProgressDescription', currentLanguage) });
          const assemblyLangForPolling = data.lang === 'ru' ? 'ru' : (data.lang === 'es' ? 'es' : determineAssemblyLangForEpisode());
          if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
          pollTranscriptStatus(data.assemblyai_transcript_id, data.id, assemblyLangForPolling);
        } else if (data.status === 'error') {
            const errorMessage = getLocaleString('unknownError', currentLanguage);
            setTranscriptError(getLocaleString('transcriptionError', currentLanguage) + `: ${errorMessage}`);
            toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionError', currentLanguage) + `: ${errorMessage}`, variant: 'destructive' });
            setTranscript(null);
        } else {
          setTranscript(null); 
          setTranscriptError(getLocaleString('noTranscriptAvailableYet', currentLanguage));
        }
      } else {
        logger.debug('[useTranscript] No transcript row yet');
        setTranscript(null);
        setTranscriptError(getLocaleString('noTranscriptAvailableYet', currentLanguage));
      }
    } catch (err) {
      if (err.code !== 'PGRST116') { 
        logger.error('[useTranscript] Error fetching transcript', { message: err.message });
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
        if (finalizeRetryRef.current.timeoutId) {
            clearTimeout(finalizeRetryRef.current.timeoutId);
            finalizeRetryRef.current.timeoutId = null;
        }
    }
  }, [fetchTranscript, externalTranscriptUtterances]);


  const handleSaveEditedSegment = async (updatedUtterances) => {
    if (!transcript) return;
    // Автоматически разбиваем длинные сегменты
    const processedTranscript = processTranscriptData({ ...transcript, utterances: updatedUtterances, words: transcript.words });
    const compactEdited = buildEditedTranscriptData({ ...transcript, utterances: processedTranscript.utterances });
    // Keep full words in memory state for player features, but store compact in DB
    setTranscript({ ...transcript, utterances: processedTranscript.utterances, words: transcript.words || [], text: processedTranscript.utterances.map(u => u.text).join(' ') });
    
    // Retry logic for large payloads
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { error: updateError } = await supabase
          .from('transcripts')
          .update({ edited_transcript_data: compactEdited })
          .eq('id', transcriptDbId);
        if (updateError) {
          console.error("Error updating segment in DB:", updateError);
          toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorUpdatingSegment', currentLanguage, { errorMessage: updateError.message }), variant: 'destructive' });
          fetchTranscript(); 
        } else {
          toast({ title: getLocaleString('transcriptSegmentUpdatedTitle', currentLanguage), description: getLocaleString('transcriptSegmentUpdatedDesc', currentLanguage), variant: "default" });
        }
        break; // Success, exit retry loop
      } catch (err) {
        retryCount++;
        if (retryCount >= maxRetries) {
          toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorUpdatingSegment', currentLanguage, { errorMessage: err.message }), variant: 'destructive' });
          fetchTranscript(); 
        } else {
          console.warn(`Retry ${retryCount}/${maxRetries} for transcript update:`, err.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
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