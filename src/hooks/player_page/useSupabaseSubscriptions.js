import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const useSupabaseSubscriptions = (
  episodeSlug,
  episodeData,
  currentLanguage,
  fetchQuestionsForEpisode,
  fetchTranscriptForEpisode
) => {
  useEffect(() => {
    if (!episodeSlug) return;

    const questionsChannel = supabase.channel(`db-questions-changes-for-${episodeSlug}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'questions', filter: `episode_slug=eq.${episodeSlug}` }, 
        (payload) => {
          const langForContent = episodeData?.lang === 'all' ? currentLanguage : episodeData?.lang;
          if (langForContent && payload.new?.lang === langForContent) {
            fetchQuestionsForEpisode(episodeSlug, langForContent);
          }
        }
      )
      .subscribe();

    const transcriptsChannel = supabase.channel(`db-transcripts-changes-for-${episodeSlug}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'transcripts', filter: `episode_slug=eq.${episodeSlug}` },
        (payload) => {
          const langForContent = episodeData?.lang === 'all' ? currentLanguage : episodeData?.lang;
           if (langForContent && payload.new?.lang === langForContent) {
             fetchTranscriptForEpisode(episodeSlug, langForContent);
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(questionsChannel);
      supabase.removeChannel(transcriptsChannel);
    };
  }, [episodeSlug, episodeData, currentLanguage, fetchQuestionsForEpisode, fetchTranscriptForEpisode]);
};

export default useSupabaseSubscriptions;