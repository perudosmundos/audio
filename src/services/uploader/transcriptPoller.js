
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import assemblyAIService from '@/lib/assemblyAIService'; 
import { translateTranscriptFast } from '@/lib/openAIService'; 
import { processTranscriptData, buildEditedTranscriptData } from '@/hooks/transcript/transcriptProcessingUtils';
import { saveTranscriptInChunks } from '@/lib/transcriptChunkingService';
import logger from '@/lib/logger';

// Treat certain fetch failures as transient network errors (offline, dropped connection)
const isTransientNetworkError = (err) => {
  try {
    const message = (err && (err.message || err.details)) || String(err || '');
    return /Failed to fetch|Network\s*Error|NetworkError|ERR_NETWORK|ECONN|ENOTFOUND|connection.*closed|ERR_CONNECTION|ERR_HTTP2|HTTP2.*PING.*FAILED|ETIMEDOUT|timeout/i.test(message);
  } catch {
    return false;
  }
};

const handleSpanishTranscriptCompletion = async (esTranscriptPayload, episodeSlug, currentLanguage, toast, updateItemState, itemOriginalId) => {
  try {
    logger.info('[pollTranscriptStatus] ES transcript completed, starting EN translation', { 
      episodeSlug,
      utterancesCount: esTranscriptPayload?.utterances?.length || 0,
      hasText: !!esTranscriptPayload?.utterances?.[0]?.text
    });
    toast({ title: "Spanish Transcript Complete", description: `Starting English translation for ${episodeSlug}.`, variant: "info" });
    
    // Note: We can't update the English item state here because it may not exist in the UI yet
    // The state will be updated when the English item is created and starts polling

    logger.debug('[pollTranscriptStatus] Starting ES->EN translation via OpenAI', { 
      episodeSlug,
      sourceUtterances: esTranscriptPayload?.utterances?.length || 0,
      firstUtteranceSample: esTranscriptPayload?.utterances?.[0] ? {
        start: esTranscriptPayload.utterances[0].start,
        end: esTranscriptPayload.utterances[0].end,
        textLength: esTranscriptPayload.utterances[0].text?.length || 0,
        speaker: esTranscriptPayload.utterances[0].speaker
      } : null
    });
    
    // Создаем callback для отслеживания прогресса перевода
    const onTranslationProgress = (progress, total, message) => {
      logger.debug(`[pollTranscriptStatus] Translation progress: ${progress}% - ${message}`, {
        episodeSlug,
        progress,
        total,
        message
      });
      
      // Note: Progress updates can't be sent here because the English item may not exist in UI yet
    };
    
          const translatedTranscriptPayload = await translateTranscriptFast(esTranscriptPayload, 'en', 'en', onTranslationProgress);
    
    logger.debug('[pollTranscriptStatus] Translation completed, processing data', { 
      episodeSlug,
      translatedUtterances: translatedTranscriptPayload?.utterances?.length || 0,
      firstTranslatedSample: translatedTranscriptPayload?.utterances?.[0] ? {
        start: translatedTranscriptPayload.utterances[0].start,
        end: translatedTranscriptPayload.utterances[0].end,
        textLength: translatedTranscriptPayload.utterances[0].text?.length || 0,
        speaker: translatedTranscriptPayload.utterances[0].speaker
      } : null
    });
    
    const processedTranslated = processTranscriptData(translatedTranscriptPayload);
    const compactTranslated = buildEditedTranscriptData(processedTranslated);
    try {
      const approxSize = JSON.stringify(translatedTranscriptPayload).length;
      logger.info('[pollTranscriptStatus] EN translation ready', { 
        episodeSlug, 
        approxJsonBytes: approxSize, 
        utterances: compactTranslated.utterances?.length || 0,
        processedUtterances: processedTranslated?.utterances?.length || 0
      });
    } catch (_) {}
    
    const upsertPayload = {
      episode_slug: episodeSlug,
      lang: 'en',
      status: 'completed', 
              // transcript_data больше не используется, данные сохраняются в transcript_chunks
      updated_at: new Date().toISOString(),
      assemblyai_transcript_id: `translated_from_es_${esTranscriptPayload.id || Date.now()}` 
    };

    // Split large payloads to avoid HTTP2 errors
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        // First update with basic data
        // Insert or update without requiring ON CONFLICT
        let enUpsertError = null;
        logger.debug('[pollTranscriptStatus] Upserting EN transcript base row', { episodeSlug });
        const insertRes = await supabase
          .from('transcripts')
          .insert([upsertPayload]);
        if (insertRes.error) {
          const isUniqueConflict = insertRes.error.code === '23505' || /duplicate key|conflict/i.test(insertRes.error.message || '');
          if (isUniqueConflict) {
            const { error: updErr } = await supabase
              .from('transcripts')
              .update(upsertPayload)
              .eq('episode_slug', episodeSlug)
              .eq('lang', 'en');
            enUpsertError = updErr || null;
          } else {
            enUpsertError = insertRes.error;
          }
        }
        if (enUpsertError) throw enUpsertError;
        
        // Then update edited_transcript_data separately
        const compactTranslated = buildEditedTranscriptData(translatedTranscriptPayload);
        const { error: editUpdateError } = await supabase
          .from('transcripts')
          .update({ edited_transcript_data: compactTranslated })
          .eq('episode_slug', episodeSlug)
          .eq('lang', 'en');
          
        if (editUpdateError) {
          console.warn("Warning: Could not update edited_transcript_data for translated transcript:", editUpdateError);
        }
        
        // Save full payload via chunking service (utterances only)
        try {
          logger.debug('[pollTranscriptStatus] Saving EN translated transcript via chunking', { episodeSlug });
          await saveTranscriptInChunks(episodeSlug, 'en', translatedTranscriptPayload, {
            maxChunkSize: 30000,
            maxChunks: 100,
            saveFullData: true,
            saveCompactData: false
          });
        } catch (e) {
          console.warn('[pollTranscriptStatus] Could not save translated transcript via chunking:', e?.message || e);
        }

        break; // Success, exit retry loop
      } catch (err) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw err;
        } else {
          console.warn(`Retry ${retryCount}/${maxRetries} for Spanish transcript completion:`, err.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }

    toast({ title: "English Translation Complete", description: `English transcript for ${episodeSlug} is ready.`, variant: "default" });

    updateItemState(itemOriginalId, { transcriptionStatus: 'completed' }); 

  } catch (translationError) {
    console.error(`Error during English translation process for ${episodeSlug}:`, translationError);
    toast({ title: "English Translation Error", description: translationError.message, variant: "destructive" });
    updateItemState(itemOriginalId, { transcriptionStatus: 'error', transcriptionError: translationError.message });
  }
};


export const pollTranscriptStatus = async (itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef) => {
  const { episodeSlug, lang, id: itemId, episodeTitle, sourceLangForEn, originalFileId } = itemData;
  try {
    logger.debug('[pollTranscriptStatus] Start', { episodeSlug, lang, itemId });
          const { data: dbTranscript, error: dbError } = await supabase
        .from('transcripts')
        .select('status, assemblyai_transcript_id, edited_transcript_data')
        .eq('episode_slug', episodeSlug)
        .eq('lang', lang)
        .single();

    if (dbError && dbError.code !== 'PGRST116') {
      if (isTransientNetworkError(dbError)) {
        console.warn(`Network issue while polling transcript status ${episodeSlug} (${lang}); will retry automatically.`);
        return; // Keep interval running; treat as transient
      }
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
      logger.warn('[pollTranscriptStatus] No DB transcript or missing assemblyai_transcript_id', { episodeSlug, lang, hasDbTranscript: !!dbTranscript });
      updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: getLocaleString('noAssemblyIdInDB', currentLanguage) });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
      return;
    }

    if (dbTranscript.status === 'completed' || dbTranscript.status === 'error') {
      logger.info('[pollTranscriptStatus] DB shows terminal status', { episodeSlug, lang, status: dbTranscript.status });
      updateItemState(itemId, { transcriptionStatus: dbTranscript.status, transcriptionError: dbTranscript.status === 'error' ? getLocaleString('unknownError', currentLanguage) : null });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
      
      if (dbTranscript.status === 'completed') {
        toast({ title: getLocaleString('transcriptionCompletedTitle', currentLanguage), description: getLocaleString('transcriptionCompletedDesc', currentLanguage, {episode: episodeTitle}), variant: 'default' });
        if (lang === 'es') {
           const { data: enEpisodeLang } = await supabase.from('episodes').select('slug').eq('slug', episodeSlug.replace('_es', '_en')).single();
           if(enEpisodeLang) {
                           const transcriptPayload = dbTranscript.edited_transcript_data;
             await handleSpanishTranscriptCompletion(transcriptPayload, episodeSlug.replace('_es', '_en'), currentLanguage, toast, updateItemState, originalFileId);
           }
        }
      } else {
        toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionErrorDesc', currentLanguage, {episode: episodeTitle}), variant: 'destructive' });
      }
      return;
    }

    logger.debug('[pollTranscriptStatus] Fetching AssemblyAI result', { transcriptId: dbTranscript.assemblyai_transcript_id });
    const assemblyResult = await assemblyAIService.getTranscriptionResult(dbTranscript.assemblyai_transcript_id, currentLanguage);
    
    if (assemblyResult.status === 'completed') {
      // Immediately reflect completion in UI and stop polling to avoid long "processing" state
      logger.info('[pollTranscriptStatus] AssemblyAI returned completed', { episodeSlug, lang });
      updateItemState(itemId, { transcriptionStatus: 'completed', transcriptionError: null });
      toast({ title: getLocaleString('transcriptionCompletedTitle', currentLanguage), description: getLocaleString('transcriptionCompletedDesc', currentLanguage, {episode: episodeTitle}), variant: 'default' });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);

      // Proceed with DB updates in the background; do not revert UI on failure
      try {
        const processed = processTranscriptData(assemblyResult);
        const compactEdited = buildEditedTranscriptData(processed);

        // 1) Ensure minimal DB row is marked as completed (fast, small payload)
        const nowIso = new Date().toISOString();
        logger.debug('[pollTranscriptStatus] Marking DB completed', { episodeSlug, lang });
        const { data: updatedRows, error: statusUpdateError } = await supabase
          .from('transcripts')
          .update({ status: 'completed', updated_at: nowIso })
          .eq('episode_slug', episodeSlug)
          .eq('lang', lang)
          .select('id');
        if (statusUpdateError) throw statusUpdateError;
        if (!updatedRows || updatedRows.length === 0) {
          // Fallback: insert minimal row if none existed
          const { error: insertError } = await supabase
            .from('transcripts')
            .insert([{ 
              episode_slug: episodeSlug,
              lang,
              status: 'completed',
              updated_at: nowIso,
              assemblyai_transcript_id: (dbTranscript && dbTranscript.assemblyai_transcript_id) ? dbTranscript.assemblyai_transcript_id : (assemblyResult && assemblyResult.id ? assemblyResult.id : null)
            }]);
          if (insertError) throw insertError;
        }

        // 2) Try to save compact edited data (small)
        logger.debug('[pollTranscriptStatus] Saving compact edited_transcript_data', { episodeSlug, lang });
        const { error: editUpdateError } = await supabase
          .from('transcripts')
          .update({ edited_transcript_data: compactEdited })
          .eq('episode_slug', episodeSlug)
          .eq('lang', lang);
        if (editUpdateError) {
          console.warn("Warning: Could not update edited_transcript_data:", editUpdateError);
        }

        // 3) Try to save full transcript payload using chunking service
        logger.debug('[pollTranscriptStatus] Saving full transcript using chunking service', { episodeSlug, lang });
        try {
          const chunkingResult = await saveTranscriptInChunks(episodeSlug, lang, assemblyResult, {
            maxChunkSize: 50000, // 50KB чанки
            maxChunks: 100,      // максимум 100 чанков
            saveFullData: true,  // сохраняем полные данные
            saveCompactData: false // компактные данные уже сохранены
          });
          
          if (chunkingResult.success) {
            logger.info('[pollTranscriptStatus] Transcript saved in chunks successfully', { 
              episodeSlug, 
              lang, 
              chunksSaved: chunkingResult.chunksSaved 
            });
          } else {
            logger.warn('[pollTranscriptStatus] Failed to save transcript in chunks', { 
              episodeSlug, 
              lang, 
              error: chunkingResult.error 
            });
          }
        } catch (chunkingError) {
          console.warn("Warning: Could not save transcript using chunking service:", chunkingError?.message || chunkingError);
          
          // Fallback: попытка сохранить через чанки еще раз
          logger.debug('[pollTranscriptStatus] Fallback: trying chunking service again', { episodeSlug, lang });
          try {
            const retryChunkingResult = await saveTranscriptInChunks(episodeSlug, lang, assemblyResult, {
              maxChunkSize: 25000, // Меньшие чанки
              maxChunks: 200,      // Больше чанков
              saveFullData: true,
              saveCompactData: false
            });
            
            if (retryChunkingResult.success) {
              logger.info('[pollTranscriptStatus] Fallback chunking succeeded', { episodeSlug, lang });
            } else {
              logger.warn('[pollTranscriptStatus] Fallback chunking also failed', { episodeSlug, lang, error: retryChunkingResult.error });
            }
          } catch (retryError) {
            console.warn("Warning: Fallback chunking also failed:", retryError?.message || retryError);
          }
        }
      } catch (updateError) {
        console.warn("Non-fatal: error updating transcript in DB after completion:", updateError?.message || updateError);
      }

      // Kick off EN translation from ES after marking UI complete
      if (lang === 'es') {
        const englishSlug = episodeSlug.replace('_es', '_en');
        
        logger.info('[pollTranscriptStatus] Processing Spanish transcript completion', { 
          spanishSlug: episodeSlug, 
          englishSlug, 
          willCreateEnglish: true 
        });
        
        // Проверяем, есть ли уже английский эпизод
        const { data: enEpisodeLang } = await supabase.from('episodes').select('slug').eq('slug', englishSlug).single();
        
        if (enEpisodeLang) {
          // Английский эпизод уже существует, запускаем перевод
          logger.info('[pollTranscriptStatus] English episode exists, starting translation', { spanishSlug: episodeSlug, englishSlug });
          await handleSpanishTranscriptCompletion(assemblyResult, englishSlug, currentLanguage, toast, updateItemState, originalFileId);
        } else {
          // Английского эпизода нет, создаем его и запускаем перевод
          logger.info('[pollTranscriptStatus] Creating English episode and starting translation', { spanishSlug: episodeSlug, englishSlug });
          
          try {
            // Получаем данные испанского эпизода для создания английского
            const { data: spanishEpisode } = await supabase
              .from('episodes')
              .select('title, date, audio_url, r2_object_key, r2_bucket_name, duration, file_has_lang_suffix')
              .eq('slug', episodeSlug)
              .eq('lang', 'es')
              .single();
            
            if (spanishEpisode) {
              logger.debug('[pollTranscriptStatus] Spanish episode data retrieved', { 
                spanishSlug: episodeSlug, 
                englishSlug, 
                hasTitle: !!spanishEpisode.title,
                hasAudio: !!spanishEpisode.audio_url 
              });
              
              // Создаем английский эпизод
              const { error: createError } = await supabase
                .from('episodes')
                .upsert({
                  slug: englishSlug,
                  title: spanishEpisode.title,
                  lang: 'en',
                  date: spanishEpisode.date,
                  audio_url: spanishEpisode.audio_url,
                  r2_object_key: spanishEpisode.r2_object_key,
                  r2_bucket_name: spanishEpisode.r2_bucket_name,
                  duration: spanishEpisode.duration,
                  file_has_lang_suffix: spanishEpisode.file_has_lang_suffix
                }, { 
                  onConflict: 'slug' // Используем upsert вместо insert для безопасного создания
                });
              
              if (createError) {
                logger.warn('[pollTranscriptStatus] Failed to create English episode', { error: createError.message });
              } else {
                logger.info('[pollTranscriptStatus] English episode created successfully', { englishSlug });
                // Теперь запускаем перевод
                await handleSpanishTranscriptCompletion(assemblyResult, englishSlug, currentLanguage, toast, updateItemState, originalFileId);
              }
            } else {
              logger.warn('[pollTranscriptStatus] Could not find Spanish episode data for creating English version', { episodeSlug });
            }
          } catch (createError) {
            logger.error('[pollTranscriptStatus] Error creating English episode', { error: createError?.message || String(createError) });
          }
        }
      }

    } else if (assemblyResult.status === 'error') {
      const errorMessage = assemblyResult.error || getLocaleString('unknownAssemblyError', currentLanguage);
      logger.error('[pollTranscriptStatus] AssemblyAI error status', { episodeSlug, lang, errorMessage });
      await supabase.from('transcripts').update({ status: 'error', updated_at: new Date().toISOString() }).eq('episode_slug', episodeSlug).eq('lang', lang);
      updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: errorMessage });
      toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionErrorAssembly', currentLanguage) + `: ${errorMessage}`, variant: 'destructive' });
      if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
    } else {
      logger.debug('[pollTranscriptStatus] AssemblyAI intermediate status', { status: assemblyResult.status, episodeSlug, lang });
      updateItemState(itemId, { transcriptionStatus: assemblyResult.status });
    }

  } catch (e) {
    if (isTransientNetworkError(e)) {
      console.warn(`Transient network error during polling for ${episodeSlug} (${lang}); will retry automatically.`, e?.message || e);
      logger.warn('[pollTranscriptStatus] transient network error', { episodeSlug, lang, message: e?.message || String(e || '') });
      return; // Do not mark as error; let interval retry
    }
    console.error(`Exception during polling for ${episodeSlug} (${lang}):`, e);
    logger.error('[pollTranscriptStatus] exception', { episodeSlug, lang, message: e?.message || String(e || '') });
    updateItemState(itemId, { transcriptionStatus: 'error', transcriptionError: e.message });
    if (pollingIntervalsRef.current[itemId]) clearInterval(pollingIntervalsRef.current[itemId]);
  }
};

export const startPollingForItem = (itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef) => {
  const itemId = itemData.id;

  if (itemData.lang === 'en' && itemData.sourceLangForEn === 'es') {
    if(itemData.transcriptionStatus === 'pending_translation_from_es'){
       const spanishSlug = itemData.episodeSlug.replace('_en', '_es');
               supabase.from('transcripts').select('status, edited_transcript_data').eq('episode_slug', spanishSlug).eq('lang', 'es').single()
          .then(({data: esTranscript, error}) => {
            if(!error && esTranscript && esTranscript.status === 'completed'){
              const transcriptPayload = esTranscript.edited_transcript_data;
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
