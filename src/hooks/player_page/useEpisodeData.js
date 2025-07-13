
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import { getProxiedAudioUrl } from '@/lib/utils';
import storageService from '@/lib/storageService';

const useEpisodeData = (episodeSlug, currentLanguage, toast) => {
  const [episodeData, setEpisodeData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionsUpdatedId, setQuestionsUpdatedId] = useState(Date.now());

  const fetchTranscriptForEpisode = useCallback(async (epSlug, langForTranscript) => {
    try {
      const { data, error: transcriptError } = await supabase
        .from('transcripts')
        .select('transcript_data, edited_transcript_data, status')
        .eq('episode_slug', epSlug)
        .eq('lang', langForTranscript)
        .single();

      if (transcriptError && transcriptError.code !== 'PGRST116') throw transcriptError;
      
      if (data) {
        const finalTranscriptData = data.edited_transcript_data || data.transcript_data;
        setTranscript({ utterances: finalTranscriptData?.utterances || [], status: data.status });
      } else {
        setTranscript(null);
      }
    } catch (err) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Error fetching transcript: ${err.message}`, variant: 'destructive' });
      setTranscript(null);
    }
  }, [currentLanguage, toast]);

  const fetchQuestionsForEpisode = useCallback(async (epSlug, langForQuestions) => {
    try {
      const { data, error: questionsError } = await supabase
        .from('questions')
        .select('id, time, title, lang, created_at, episode_slug, is_intro, is_full_transcript')
        .eq('episode_slug', epSlug)
        .eq('lang', langForQuestions)
        .order('time', { ascending: true });

      if (questionsError) throw questionsError;
      
      let fetchedQuestions = data || [];
      const hasIntro = fetchedQuestions.some(q => q.is_intro && q.time === 0);

      if (!hasIntro) {
        const introQuestion = {
          id: 'intro-virtual', 
          time: 0,
          title: getLocaleString('introduction', langForQuestions),
          lang: langForQuestions,
          is_intro: true,
          is_full_transcript: false,
          episode_slug: epSlug,
          created_at: new Date().toISOString()
        };
        fetchedQuestions = [introQuestion, ...fetchedQuestions];
      }
      
      setQuestions(fetchedQuestions);
      setQuestionsUpdatedId(Date.now());
    } catch (err) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorFetchingQuestions', currentLanguage, {errorMessage: err.message}), variant: 'destructive' });
      setQuestions([]);
    }
  }, [currentLanguage, toast]);

  const fetchEpisodeDetails = useCallback(async () => {
    if (!episodeSlug) return;
    console.log('useEpisodeData: Fetching episode details for', episodeSlug);
    setLoading(true);
    setError(null);
    try {
      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select('slug, title, lang, audio_url, duration, date, created_at, r2_object_key, r2_bucket_name')
        .eq('slug', episodeSlug)
        .single();

      if (episodeError) throw episodeError;
      if (!episode) throw new Error(getLocaleString('episodeNotFound', currentLanguage));
      
      console.log('useEpisodeData: Episode data loaded', { 
        slug: episode.slug, 
        title: episode.title, 
        audio_url: episode.audio_url,
        r2_object_key: episode.r2_object_key,
        r2_bucket_name: episode.r2_bucket_name
      });
      
      let finalAudioUrl = episode.audio_url;
      if (!finalAudioUrl && episode.r2_object_key && episode.r2_bucket_name) {
        finalAudioUrl = await storageService.getPublicUrl(episode.r2_object_key, episode.r2_bucket_name);
        console.log('useEpisodeData: Generated storage URL', finalAudioUrl);
      }
      
      // Применяем прокси для обхода CORS
      finalAudioUrl = getProxiedAudioUrl(finalAudioUrl);
      console.log('useEpisodeData: Final audio URL (with proxy)', finalAudioUrl);
      setEpisodeData({...episode, audio_url: finalAudioUrl});
      
      const langForContent = episode.lang === 'all' ? currentLanguage : episode.lang;
      await fetchQuestionsForEpisode(episode.slug, langForContent);
      await fetchTranscriptForEpisode(episode.slug, langForContent);

    } catch (err) {
      console.error('useEpisodeData: Error fetching episode', err);
      setError(err.message);
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [episodeSlug, currentLanguage, toast, fetchQuestionsForEpisode, fetchTranscriptForEpisode]);

  useEffect(() => {
    fetchEpisodeDetails();
  }, [fetchEpisodeDetails]);
  
  useEffect(() => {
    if (episodeData && episodeData.lang === 'all') {
        fetchQuestionsForEpisode(episodeData.slug, currentLanguage);
        fetchTranscriptForEpisode(episodeData.slug, currentLanguage);
    }
  }, [currentLanguage, episodeData, fetchQuestionsForEpisode, fetchTranscriptForEpisode]);

  return {
    episodeData,
    questions,
    transcript,
    loading,
    error,
    questionsUpdatedId,
    fetchEpisodeDetails,
    fetchQuestionsForEpisode,
    fetchTranscriptForEpisode,
    setTranscript,
    setQuestions,
    setQuestionsUpdatedId
  };
};

export default useEpisodeData;
