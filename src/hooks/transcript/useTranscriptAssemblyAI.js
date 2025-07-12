import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import assemblyAIService from '@/lib/assemblyAIService.js';
import { getLocaleString } from '@/lib/locales';
import { processTranscriptData } from '@/hooks/transcript/transcriptProcessingUtils';


const useTranscriptAssemblyAI = (
  episodeSlug, 
  episodeAudioUrl, 
  episodeLang, 
  currentLanguage, 
  toast, 
  setTranscriptState, 
  setTranscriptDbIdState, 
  setIsLoadingTranscriptState, 
  setTranscriptErrorState,
  currentTranscriptState,
  currentTranscriptDbId
) => {
  const [isPollingTranscript, setIsPollingTranscript] = useState(false);
  const [transcriptionJobId, setTranscriptionJobId] = useState(null);
  const pollingTimeoutRef = useRef(null);

  const determineAssemblyLangForEpisode = useCallback(() => {
    if (episodeLang === 'ru') return 'ru';
    if (episodeLang === 'es') return 'es';
    return currentLanguage === 'ru' ? 'ru' : 'es';
  }, [episodeLang, currentLanguage]);

  const pollTranscriptStatus = useCallback(async (assemblyId, dbTranscriptId, assemblyLang) => {
    if (isPollingTranscript) return;
    setIsPollingTranscript(true);
    try {
      const result = await assemblyAIService.getTranscriptionResult(assemblyId, currentLanguage);
      if (result.status === 'completed') {
        setTranscriptState(result); 
        toast({ title: getLocaleString('transcriptionCompletedTitle', currentLanguage), description: getLocaleString('transcriptionCompletedDescription', currentLanguage) });
        
        const { error: updateError } = await supabase
          .from('transcripts')
          .update({ status: 'completed', transcript_data: result, edited_transcript_data: processTranscriptData(result) })
          .eq('id', dbTranscriptId);
        if (updateError) {
            console.error("Error updating transcript in DB after polling:", updateError);
        }
      } else if (result.status === 'error') {
        const errorMessage = result.error || getLocaleString('unknownAssemblyError', currentLanguage);
        setTranscriptErrorState(getLocaleString('transcriptionErrorAssembly', currentLanguage) + `: ${errorMessage}`);
        toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionErrorAssembly', currentLanguage) + `: ${errorMessage}`, variant: 'destructive' });
        await supabase.from('transcripts').update({ status: 'error', transcript_data: result }).eq('id', dbTranscriptId);
      } else {
        pollingTimeoutRef.current = setTimeout(() => pollTranscriptStatus(assemblyId, dbTranscriptId, assemblyLang), 15000);
      }
    } catch (err) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorPollingTranscript', currentLanguage), variant: 'destructive' });
    } finally {
      setIsPollingTranscript(false);
    }
  }, [isPollingTranscript, toast, currentLanguage, setTranscriptState, setTranscriptErrorState]);

  const handleStartTranscription = useCallback(async (langCodeForAssembly = null, audioUrlForTranscription = null, existingDbTranscriptEntry = null) => {
    if (!episodeSlug || (!episodeAudioUrl && !audioUrlForTranscription)) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('missingEpisodeOrUrl', currentLanguage), variant: 'destructive' });
      return;
    }
    
    if (transcriptionJobId && (existingDbTranscriptEntry?.status === 'processing' || existingDbTranscriptEntry?.status === 'queued')) {
        console.log("Transcription request already sent and in progress. Skipping new request.");
        return;
    }

    const finalAudioUrl = audioUrlForTranscription || episodeAudioUrl;
    setIsLoadingTranscriptState(true);
    setTranscriptErrorState(null);
    
    const assemblyLangToUse = langCodeForAssembly || determineAssemblyLangForEpisode();
    const transcriptLangForDb = episodeLang === 'all' ? currentLanguage : episodeLang;

    try {
      const job = await assemblyAIService.submitTranscription(finalAudioUrl, assemblyLangToUse, episodeSlug, currentLanguage, transcriptLangForDb);
      setTranscriptionJobId(job.id);

      let dbOp = existingDbTranscriptEntry?.id
        ? supabase.from('transcripts').update({ assemblyai_transcript_id: job.id, status: job.status, lang: transcriptLangForDb, updated_at: new Date().toISOString(), edited_transcript_data: null }).eq('id', existingDbTranscriptEntry.id)
        : supabase.from('transcripts').insert([{ episode_slug: episodeSlug, lang: transcriptLangForDb, assemblyai_transcript_id: job.id, status: job.status, edited_transcript_data: null }]);
      
      const { error: dbError, data: transcriptEntries } = await dbOp.select('id, edited_transcript_data').single();
      if (dbError) throw dbError;
      if (!transcriptEntries) throw new Error("Failed to get transcript entry ID from DB operation.");
      const newDbTranscriptId = transcriptEntries.id;
      setTranscriptDbIdState(newDbTranscriptId);

      if (job.status === 'queued' || job.status === 'processing') {
        toast({ title: getLocaleString('transcriptionSubmittedTitle', currentLanguage), description: getLocaleString('transcriptionSubmittedDescription', currentLanguage, { lang: assemblyLangToUse }) });
        if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
        pollTranscriptStatus(job.id, newDbTranscriptId, assemblyLangToUse);
      } else if (job.status === 'error') {
        const errorMessage = job.error || getLocaleString('unknownAssemblyError', currentLanguage);
        setTranscriptErrorState(getLocaleString('transcriptionErrorAssembly', currentLanguage) + `: ${errorMessage}`);
        await supabase.from('transcripts').update({ status: 'error', transcript_data: job }).eq('id', newDbTranscriptId);
      }
    } catch (err) {
      setTranscriptErrorState(getLocaleString('errorStartingTranscription', currentLanguage, { errorMessage: err.message }));
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: err.message, variant: 'destructive' });
    } finally {
      setIsLoadingTranscriptState(false);
    }
  }, [
      episodeSlug, 
      episodeAudioUrl, 
      toast, 
      currentLanguage, 
      determineAssemblyLangForEpisode, 
      pollTranscriptStatus, 
      episodeLang, 
      transcriptionJobId,
      setIsLoadingTranscriptState,
      setTranscriptErrorState,
      setTranscriptDbIdState
    ]);

  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isPollingTranscript,
    setIsPollingTranscript,
    transcriptionJobId,
    setTranscriptionJobId,
    pollingTimeoutRef,
    determineAssemblyLangForEpisode,
    pollTranscriptStatus,
    handleStartTranscription,
  };
};

export default useTranscriptAssemblyAI;