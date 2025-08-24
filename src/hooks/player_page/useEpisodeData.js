
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';
import { getLocaleString } from '@/lib/locales';
import r2Service from '@/lib/r2Service';
import { getFullTextFromUtterances } from '@/hooks/transcript/transcriptProcessingUtils';

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
  const [loading, setLoading] = useState(true); // загрузка только базовых данных эпизода (аудио URL, метаданные)
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [error, setError] = useState(null);
  const [questionsUpdatedId, setQuestionsUpdatedId] = useState(Date.now());

  // --- Transcript cache helpers (localStorage, stale-while-revalidate) ---
  const TRANSCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const getTranscriptCacheKey = useCallback((epSlug, lang) => `transcript:${epSlug}:${lang}`, []);

  const computeTranscriptVersionKey = useCallback((payload) => {
    if (!payload) return 'none';
    const { id, status, data } = payload;
    const utterances = Array.isArray(data?.utterances) ? data.utterances : [];
    const utterancesLen = utterances.length;
    const wordsLen = data?.words?.length || 0;
    const textLen = (data?.text || '').length || 0;

    // Include a lightweight checksum of speakers so renaming speakers invalidates cache
    let speakersHash = 0;
    for (let i = 0; i < utterances.length; i++) {
      const u = utterances[i];
      const idPart = String(u?.id ?? u?.start ?? i);
      const speakerPart = String(u?.speaker ?? '');
      const composite = idPart + ':' + speakerPart + '|';
      for (let j = 0; j < composite.length; j++) {
        speakersHash = ((speakersHash << 5) - speakersHash) + composite.charCodeAt(j);
        speakersHash |= 0; // force 32-bit
      }
    }

    return `${id || 'noid'}:${status || 'nostatus'}:${utterancesLen}:${wordsLen}:${textLen}:spk:${speakersHash}`;
  }, []);

  const readTranscriptCache = useCallback((epSlug, lang) => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = window.localStorage.getItem(getTranscriptCacheKey(epSlug, lang));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.meta?.versionKey || !parsed?.data) return null;
      const isFresh = Date.now() - (parsed.cachedAt || 0) < TRANSCRIPT_CACHE_TTL_MS;
      return { value: parsed, isFresh };
    } catch {
      return null;
    }
  }, [getTranscriptCacheKey]);

  const writeTranscriptCache = useCallback((epSlug, lang, cacheValue) => {
    try {
      if (typeof window === 'undefined') return;
      const toStore = { ...cacheValue, cachedAt: Date.now() };
      window.localStorage.setItem(getTranscriptCacheKey(epSlug, lang), JSON.stringify(toStore));
    } catch {}
  }, [getTranscriptCacheKey]);

  // Fallback: generate simple utterances from words when API did not return utterances
  const generateUtterancesFromWords = useCallback((wordsArray) => {
    if (!Array.isArray(wordsArray) || wordsArray.length === 0) return [];
    const MAX_UTTERANCE_MS = 8000; // up to 8s per chunk
    const MAX_WORDS_PER_UTTERANCE = 60;
    const punctuationRegex = /[.!?]\s*$/;

    const utterances = [];
    let current = null;
    for (let i = 0; i < wordsArray.length; i++) {
      const w = wordsArray[i];
      if (typeof w?.start !== 'number' || typeof w?.end !== 'number' || typeof w?.text !== 'string') {
        continue;
      }
      if (!current) {
        current = { id: `u-${utterances.length}`, start: w.start, end: w.end, text: w.text };
        continue;
      }
      // Decide whether to continue current utterance or start a new one
      const wouldBeText = current.text ? current.text + (w.text.match(/^['",.?!:;)]/) ? '' : ' ') + w.text : w.text;
      const spanMs = Math.max(w.end, current.end) - current.start;
      const wordCount = wouldBeText.split(/\s+/).filter(Boolean).length;
      const shouldBreak = spanMs >= MAX_UTTERANCE_MS || wordCount >= MAX_WORDS_PER_UTTERANCE || punctuationRegex.test(current.text);
      if (shouldBreak) {
        utterances.push(current);
        current = { id: `u-${utterances.length}`, start: w.start, end: w.end, text: w.text };
      } else {
        current.text = wouldBeText;
        current.end = Math.max(current.end, w.end);
      }
    }
    if (current) utterances.push(current);
    return utterances;
  }, []);

  const fetchTranscriptForEpisode = useCallback(async (epSlug, langForTranscript) => {
    try {
      logger.debug('🔍 Fetching transcript for:', { epSlug, langForTranscript });
      
      // Prefill from cache if available and fresh
      const cached = readTranscriptCache(epSlug, langForTranscript);
      if (cached?.isFresh && cached.value?.data) {
        logger.debug('📦 Using cached transcript data');
        setTranscript({
          id: cached.value.meta?.id || null,
          utterances: cached.value.data.utterances || [],
          words: cached.value.data.words || [],
          text: cached.value.data.text || '',
          status: cached.value.meta?.status || null
        });
      }

      const { data, error: transcriptError } = await supabase
        .from('transcripts')
        .select('id, edited_transcript_data, status')
        .eq('episode_slug', epSlug)
        .eq('lang', langForTranscript)
        .maybeSingle();

      logger.debug('📊 Transcript query result:', { data, error: transcriptError, langForTranscript });

      if (transcriptError) throw transcriptError;
      
      if (data) {
        const finalTranscriptData = data.edited_transcript_data;
        logger.debug('📝 Raw transcript data received');
        
        // Ensure utterances exist for player rendering
        let ensuredUtterances = Array.isArray(finalTranscriptData?.utterances) ? finalTranscriptData.utterances : [];
        if (ensuredUtterances.length === 0 && Array.isArray(finalTranscriptData?.words) && finalTranscriptData.words.length > 0) {
          logger.debug('🧩 Generating utterances from words as fallback');
          ensuredUtterances = generateUtterancesFromWords(finalTranscriptData.words);
        }

        const freshPayload = {
          id: data.id,
          status: data.status,
          data: {
            utterances: ensuredUtterances,
            // Используем только edited_transcript_data
            words: finalTranscriptData?.words || [],
            text: finalTranscriptData?.text || getFullTextFromUtterances(finalTranscriptData?.utterances || [])
          }
        };
        
        logger.debug('🔄 Processed transcript payload');
        
        const freshVersion = computeTranscriptVersionKey(freshPayload);
        const cachedVersion = cached?.value?.meta?.versionKey || 'none';

        if (freshVersion !== cachedVersion) {
          logger.debug('✅ Updating transcript state and cache');
          // Update state and cache only if changed
          setTranscript({ 
            id: freshPayload.id,
            utterances: freshPayload.data.utterances,
            words: freshPayload.data.words,
            text: freshPayload.data.text,
            status: freshPayload.status 
          });
          writeTranscriptCache(epSlug, langForTranscript, {
            meta: { id: freshPayload.id, status: freshPayload.status, versionKey: freshVersion },
            data: freshPayload.data
          });
        } else {
          logger.debug('⏭️ Skipping update - transcript unchanged');
        }
      } else {
        logger.debug('❌ No transcript data found in DB');
        setTranscript(null);
      }
    } catch (err) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Error fetching transcript: ${err.message}`, variant: 'destructive' });
      setTranscript(null);
    }
  }, [currentLanguage, toast, readTranscriptCache, writeTranscriptCache, computeTranscriptVersionKey]);

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
      

      const finalAudioUrl = r2Service.getCompatibleUrl(
        episode.audio_url,
        episode.r2_object_key,
        episode.r2_bucket_name
      );
      
      // Сразу устанавливаем данные эпизода и снимаем основной лоадер
      setEpisodeData({ ...episode, audio_url: finalAudioUrl });
      setLoading(false);

      // Подгружаем вопросы/транскрипт неблокирующе, с отдельными флагами загрузки
      const langForContent = episode.lang === 'all' ? currentLanguage : episode.lang;
      setQuestionsLoading(true);
      setTranscriptLoading(true);
      
      (async () => {
        try {
          await fetchQuestionsForEpisode(episode.slug, langForContent);
        } finally {
          setQuestionsLoading(false);
        }
      })();
      
      (async () => {
        try {
          await fetchTranscriptForEpisode(episode.slug, langForContent);
        } finally {
          setTranscriptLoading(false);
        }
      })();

    } catch (err) {
      console.error('useEpisodeData: Error fetching episode', err);
      setError(err.message);
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: err.message, variant: 'destructive' });
      setLoading(false);
    }
  }, [episodeSlug, currentLanguage, toast, fetchQuestionsForEpisode, fetchTranscriptForEpisode]);

  useEffect(() => {
    fetchEpisodeDetails();
  }, [fetchEpisodeDetails]);
  
  useEffect(() => {
    if (episodeData && episodeData.lang === 'all') {
      setQuestionsLoading(true);
      setTranscriptLoading(true);
      (async () => {
        try {
          await fetchQuestionsForEpisode(episodeData.slug, currentLanguage);
        } finally {
          setQuestionsLoading(false);
        }
      })();
      (async () => {
        try {
          await fetchTranscriptForEpisode(episodeData.slug, currentLanguage);
        } finally {
          setTranscriptLoading(false);
        }
      })();
    }
  }, [currentLanguage, episodeData, fetchQuestionsForEpisode, fetchTranscriptForEpisode]);

  // Keep cache in sync when transcript changes via editing or local updates
  useEffect(() => {
    if (!episodeData || !transcript) return;
    const langForContent = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;
    const payload = {
      id: transcript.id || episodeData.slug,
      status: transcript.status || null,
      data: {
        utterances: transcript.utterances || [],
        words: transcript.words || [],
        text: transcript.text || ''
      }
    };
    const version = computeTranscriptVersionKey(payload);
    writeTranscriptCache(episodeData.slug, langForContent, {
      meta: { id: payload.id, status: payload.status, versionKey: version },
      data: payload.data
    });
  }, [transcript, episodeData, currentLanguage, computeTranscriptVersionKey, writeTranscriptCache]);

  return {
    episodeData,
    questions,
    transcript,
    loading,
    questionsLoading,
    transcriptLoading,
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
