
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import { getProxiedAudioUrl, getAudioUrlWithFallback } from '@/lib/utils';
import r2Service from '@/lib/r2Service';

// Utility function to check if a file exists on Archive.org
export const checkEpisodeFileExists = async (episode) => {
  if (!episode.r2_object_key || !episode.audio_url) {
    return { exists: false, error: 'No file key or URL' };
  }
  
  try {
    const fileExists = await r2Service.checkFileExists(episode.r2_object_key);
    return { exists: fileExists.exists, error: null };
  } catch (error) {
    console.warn('Error checking file existence for episode:', episode.slug, error);
    return { exists: false, error: error.message };
  }
};

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
        .maybeSingle();

      if (transcriptError) throw transcriptError;
      
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
        .maybeSingle();

      if (episodeError) throw episodeError;
      if (!episode) {
        console.warn('Episode not found:', episodeSlug);
        setError(getLocaleString('episodeNotFound', currentLanguage));
        setLoading(false);
        return;
      }
      
      console.log('useEpisodeData: Episode data loaded', { 
        slug: episode.slug, 
        title: episode.title, 
        audio_url: episode.audio_url,
        r2_object_key: episode.r2_object_key,
        r2_bucket_name: episode.r2_bucket_name
      });
      
      let finalAudioUrl = r2Service.getCompatibleUrl(
        episode.audio_url, 
        episode.r2_object_key, 
        episode.r2_bucket_name
      );
      console.log('useEpisodeData: Generated compatible URL', finalAudioUrl);
      
      // Применяем прокси для обхода CORS с fallback
      try {
        finalAudioUrl = await getAudioUrlWithFallback(finalAudioUrl);
        console.log('useEpisodeData: Final audio URL (with fallback)', finalAudioUrl);
      } catch (error) {
        console.warn('useEpisodeData: Fallback failed, using original URL', error);
        finalAudioUrl = getProxiedAudioUrl(finalAudioUrl);
      }
      
      console.log('useEpisodeData: Proxy setting in localStorage:', localStorage.getItem('useAudioProxy'));
      console.log('useEpisodeData: Is development mode:', import.meta.env.DEV);
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
