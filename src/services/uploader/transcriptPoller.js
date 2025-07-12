
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import assemblyAIService from '@/lib/assemblyAIService'; 
import { translateTranscriptOpenAI } from '@/lib/openAIService';

const handleSpanishTranscriptCompletion = async (esTranscriptPayload, episodeSlug, currentLanguage, toast, updateItemState, itemOriginalId) => {
  try {
    toast({ title: "Spanish Transcript Complete", description: `Starting English translation for ${episodeSlug}.`, variant: "info" });
    
    updateItemState((itemId) => {
      const fileOriginalIdPart = itemOriginalId.split('-').slice(0, 2).join('-');
      if(itemId.startsWith(fileOriginalIdPart) && itemId.includes('-en-')) {
        return { transcriptionStatus: 'translating_from_es' };
      }
      return {};
    });

    const translatedTranscriptPayload = await translateTranscriptOpenAI(esTranscriptPayload, 'en');
    
    const upsertPayload = {
      episode_slug: episodeSlug,
      lang: 'en',
      status: 'completed', 
      transcript_data: translatedTranscriptPayload, 
      edited_transcript_data: translatedTranscriptPayload, 
      updated_at: new Date().toISOString(),
      assemblyai_transcript_id: `translated_from_es_${esTranscriptPayload.id || Date.now()}` 
    };

    const { error: enUpsertError } = await supabase
      .from('transcripts')
      .upsert(upsertPayload, { onConflict: 'episode_slug, lang' })
      .select()
      .single();

    if (enUpsertError) {
      if(enUpsertError.message.includes('constraint matching the ON CONFLICT specification')) {
          console.warn("ON CONFLICT failed for translated EN transcript, likely due to missing unique constraint on (episode_slug, lang).");
      } else {
        throw enUpsertError;
      }
    }

    toast({ title: "English Translation Complete", description: `English transcript for ${episodeSlug} is ready.`, variant: "default" });

    updateItemState((itemId) => {
      const fileOriginalIdPart = itemOriginalId.split('-').slice(0, 2).join('-');
      if(itemId.startsWith(fileOriginalIdPart) && itemId.includes('-en-')) {
        return { transcriptionStatus: 'completed' };
      }
      return {};
    }); 

  } catch (translationError) {
    console.error(`Error during English translation process for ${episodeSlug}:`, translationError);
    toast({ title: "English Translation Error", description: translationError.message, variant: "destructive" });
    updateItemState((itemId) => {
      const fileOriginalIdPart = itemOriginalId.split('-').slice(0, 2).join('-');
      if(itemId.startsWith(fileOriginalIdPart) && itemId.includes('-en-')) {
        return { transcriptionStatus: 'error', transcriptionError: translationError.message };
      }
      return {};
    });
  }
};


export const pollTranscriptStatus = async (itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef) => {
  const { episodeSlug, lang, id: itemId, episodeTitle, sourceLangForEn, originalFileId } = itemData;
  try {
    const { data: dbTranscript, error: dbError } = await supabase
      .from('transcripts')
      .select('status, assemblyai_transcript_id, transcript_data, edited_transcript_data')
      .eq('episode_slug', episodeSlug)
      .eq('lang', lang)
      .single();

    if (dbError && dbError.code !== 'PGRST116') {
      console.error(`Error polling DB for transcript status ${episodeSlug} (${lang}):`, dbError);
      updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: dbError.message });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
      return;
    }
    
    if (lang === 'en' && sourceLangForEn === 'es') {
      if (dbTranscript && dbTranscript.status === 'completed') {
        updateItemState(itemId, { transcriptionStatus: 'completed', transcriptionError: null });
        if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
      }
      return; 
    }

    if (!dbTranscript || !dbTranscript.assemblyai_transcript_id) {
      updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: getLocaleString('noAssemblyIdInDB', currentLanguage) });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
      return;
    }

    if (dbTranscript.status === 'completed' || dbTranscript.status === 'error') {
      updateItemState(itemId, { transcriptionStatus: dbTranscript.status, transcriptionError: dbTranscript.status === 'error' ? (dbTranscript.transcript_data?.error || getLocaleString('unknownError', currentLanguage)) : null });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
      
      if (dbTranscript.status === 'completed') {
        toast({ title: getLocaleString('transcriptionCompletedTitle', currentLanguage), description: getLocaleString('transcriptionCompletedDesc', currentLanguage, {episode: episodeTitle}), variant: 'default' });
        if (lang === 'es') {
           const { data: enEpisodeLang } = await supabase.from('episodes').select('slug').eq('slug', episodeSlug.replace('_es', '_en')).single();
           if(enEpisodeLang) {
             const transcriptPayload = dbTranscript.edited_transcript_data || dbTranscript.transcript_data;
             await handleSpanishTranscriptCompletion(transcriptPayload, episodeSlug.replace('_es', '_en'), currentLanguage, toast, updateItemState, originalFileId);
           }
        }
      } else {
        toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionErrorDesc', currentLanguage, {episode: episodeTitle}), variant: 'destructive' });
      }
      return;
    }

    const assemblyResult = await assemblyAIService.getTranscriptionResult(dbTranscript.assemblyai_transcript_id, currentLanguage);
    
    if (assemblyResult.status === 'completed') {
      const updatePayload = { status: 'completed', transcript_data: assemblyResult, edited_transcript_data: assemblyResult, updated_at: new Date().toISOString() };
      
      const { error: updateError } = await supabase
        .from('transcripts')
        .update(updatePayload)
        .eq('episode_slug', episodeSlug)
        .eq('lang', lang)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating transcript in DB after AssemblyAI completion:", JSON.stringify(updateError, null, 2));
        updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: updateError.message });
      } else {
        updateItemState(itemId, { transcriptionStatus: 'completed', transcriptionError: null });
        toast({ title: getLocaleString('transcriptionCompletedTitle', currentLanguage), description: getLocaleString('transcriptionCompletedDesc', currentLanguage, {episode: episodeTitle}), variant: 'default' });
        if (lang === 'es') {
           const { data: enEpisodeLang } = await supabase.from('episodes').select('slug').eq('slug', episodeSlug.replace('_es', '_en')).single();
           if(enEpisodeLang) {
             await handleSpanishTranscriptCompletion(assemblyResult, episodeSlug.replace('_es', '_en'), currentLanguage, toast, updateItemState, originalFileId);
           }
        }
      }
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);

    } else if (assemblyResult.status === 'error') {
      const errorMessage = assemblyResult.error || getLocaleString('unknownAssemblyError', currentLanguage);
      await supabase.from('transcripts').update({ status: 'error', transcript_data: assemblyResult, updated_at: new Date().toISOString() }).eq('episode_slug', episodeSlug).eq('lang', lang);
      updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: errorMessage });
      toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionErrorAssembly', currentLanguage) + `: ${errorMessage}`, variant: 'destructive' });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
    } else {
      updateItemState(itemId, { transcriptionStatus: assemblyResult.status });
    }

  } catch (e) {
    console.error(`Exception during polling for ${episodeSlug} (${lang}):`, e);
    updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: e.message });
    if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
  }
};

export const startPollingForItem = (itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef) => {
  const itemId = itemData.id;

  if (itemData.lang === 'en' && itemData.sourceLangForEn === 'es') {
    if(itemData.transcriptionStatus === 'pending_translation_from_es'){
       const spanishSlug = itemData.episodeSlug.replace('_en', '_es');
       supabase.from('transcripts').select('status, transcript_data, edited_transcript_data').eq('episode_slug', spanishSlug).eq('lang', 'es').single()
        .then(({data: esTranscript, error}) => {
          if(!error && esTranscript && esTranscript.status === 'completed'){
            const transcriptPayload = esTranscript.edited_transcript_data || esTranscript.transcript_data;
            handleSpanishTranscriptCompletion(transcriptPayload, itemData.episodeSlug, currentLanguage, toast, updateItemState, itemData.originalFileId);
          } else if (error && error.code !== 'PGRST116') {
            console.error("Error checking source ES transcript for EN item:", error);
            updateItemState(itemId, {transcriptionStatus: 'error', transcriptionError: "Failed to check source ES transcript."})
          }
        });
    }
    return;
  }

  if (pollingIntervalsRef.current[itemId]) {
    clearInterval(pollingIntervalsRef.current[itemId]);
  }
  
  pollTranscriptStatus(itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef); 
  
  pollingIntervalsRef.current[itemId] = setInterval(() => {
    pollTranscriptStatus(itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef);
  }, 15000); 
};
