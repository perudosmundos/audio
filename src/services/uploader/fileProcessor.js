
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import r2Service from '@/lib/r2Service';
import assemblyAIService from '@/lib/assemblyAIService';
import { parseQuestionsFromDescriptionString } from '@/lib/podcastService';
import { translateTextOpenAI } from '@/lib/openAIService';
import { startPollingForItem } from './transcriptPoller';

/**
 * Start transcription manually (called from UI button)
 */
export const startManualTranscription = async ({
  audioUrl,
  episodeSlug,
  lang,
  currentLanguage,
  toast
}) => {
  try {
    const assemblyLangCode = lang === 'es' ? 'es' : lang === 'ru' ? 'ru' : 'en';
    
    const transcriptJob = await assemblyAIService.submitTranscription(
      audioUrl,
      assemblyLangCode,
      episodeSlug,
      currentLanguage,
      lang
    );

    // Save to database
    const transcriptPayload = {
      episode_slug: episodeSlug,
      lang: lang,
      assemblyai_transcript_id: transcriptJob.id,
      status: transcriptJob.status,
      updated_at: new Date().toISOString(),
      edited_transcript_data: null 
    };
    
    const { error: transcriptDbError } = await supabase
      .from('transcripts')
      .upsert(transcriptPayload, { onConflict: 'episode_slug, lang' })
      .select()
      .maybeSingle();

    if (transcriptDbError) {
      throw new Error(`Database error: ${transcriptDbError.message}`);
    }

    return {
      success: true,
      transcriptJob
    };
  } catch (error) {
    console.error('Manual transcription start error:', error);
    throw error;
  }
};

export const processSingleItem = async ({
  itemData,
  forceOverwrite = false,
  updateItemState,
  currentLanguage,
  toast,
  openOverwriteDialog, 
  pollingIntervalsRef,
  getAllItems,
  overwriteOptions = null,
}) => {
  updateItemState(itemData.id, { 
    isUploading: true, 
    uploadProgress: 0, 
    uploadError: null, 
    uploadComplete: false,
    transcriptionStatus: null,
    transcriptionError: null,
  });
  
  const { file, episodeSlug, episodeTitle, lang, parsedDate, timingsText, sourceLangForEn, originalFileId, fileGroupId, isSingleTrackFile } = itemData;

  // Check if another item in the same group already uploaded the file
  let sharedAudioUrl = null;
  let sharedR2Key = null;
  
  if (isSingleTrackFile && fileGroupId) {
    const allItems = getAllItems();
    const groupItems = allItems.filter(item => item.fileGroupId === fileGroupId && item.id !== itemData.id);
    const uploadedItem = groupItems.find(item => item.uploadedAudioUrl && item.r2FileKey);
    
    if (uploadedItem) {
      sharedAudioUrl = uploadedItem.uploadedAudioUrl;
      sharedR2Key = uploadedItem.r2FileKey;
      console.log(`Reusing uploaded audio from group ${fileGroupId}: ${sharedAudioUrl}`);
    }
  }

  if (!episodeSlug) {
    updateItemState(itemData.id, { isUploading: false, uploadError: "Не удалось определить SLUG." });
    return { success: false, requiresDialog: false };
  }

  let workerFileUrl = sharedAudioUrl;
  let r2FileKey = sharedR2Key;
  let bucketNameUsed;
  let userConfirmedOverwriteGlobal = forceOverwrite;
  let userOverwriteChoices = overwriteOptions || null;
  
  // Skip upload if we're reusing shared audio
  const skipUpload = !!(sharedAudioUrl && sharedR2Key);

  try {
    if (!skipUpload && !forceOverwrite) {
      const { data: existingEpisode, error: checkError } = await supabase
        .from('episodes')
        .select('slug, audio_url, r2_object_key, r2_bucket_name')
        .eq('slug', episodeSlug)
        .maybeSingle();

      if (checkError) {
         console.error("Supabase check episode error:", checkError);
         throw new Error(getLocaleString('errorCheckingEpisodeDB', currentLanguage, {errorMessage: checkError.message}));
      }

      if (existingEpisode) {
        const userConfirmedDialog = await openOverwriteDialog(itemData);
        if (!userConfirmedDialog) {
          updateItemState(itemData.id, { isUploading: false, uploadError: getLocaleString('uploadCancelledEpisodeExists', currentLanguage) });
          return { success: false, requiresDialog: true };
        }
        // If dialog returned object with choices, capture
        if (typeof userConfirmedDialog === 'object' && userConfirmedDialog !== null) {
          userOverwriteChoices = userConfirmedDialog;
        } else {
          userOverwriteChoices = null;
        }
        userConfirmedOverwriteGlobal = true; 
        
        console.log("Found existing episode in DB:", {
          slug: existingEpisode.slug,
          audio_url: existingEpisode.audio_url,
          r2_object_key: existingEpisode.r2_object_key,
          r2_bucket_name: existingEpisode.r2_bucket_name
        });
        // Don't use old URLs from DB when overwriting - they might be outdated
        // We'll determine the correct URL based on overwrite choices
        if (userOverwriteChoices && userOverwriteChoices.overwriteServerFile) {
          // Will upload new file and get new URL
          workerFileUrl = null;
          r2FileKey = null;
          bucketNameUsed = null;
        } else {
          // Use existing file info
          workerFileUrl = existingEpisode.audio_url;
          r2FileKey = existingEpisode.r2_object_key;
          bucketNameUsed = existingEpisode.r2_bucket_name;
        }
      }
    }
    
    if (!skipUpload && (!userConfirmedOverwriteGlobal || !workerFileUrl)) {
      let fileExistsInR2 = { exists: false };
      try {
        fileExistsInR2 = await r2Service.checkFileExists(file.name);
      } catch (checkError) {
        // If file existence check fails (e.g., network error), just proceed with upload
        console.warn('[fileProcessor] File existence check failed, proceeding with upload:', checkError.message);
        fileExistsInR2 = { exists: false };
      }
      
      if (fileExistsInR2.exists && !userConfirmedOverwriteGlobal) {
        // Trigger dialog also when only server file exists
        const userConfirmedDialog = await openOverwriteDialog(itemData);
        if (!userConfirmedDialog) {
          updateItemState(itemData.id, { isUploading: false, uploadError: getLocaleString('uploadCancelledEpisodeExists', currentLanguage) });
          return { success: false, requiresDialog: true };
        }
        if (typeof userConfirmedDialog === 'object') {
          userOverwriteChoices = userConfirmedDialog;
        }
        // Treat as overwrite flow
        userConfirmedOverwriteGlobal = true;

        if (userOverwriteChoices && userOverwriteChoices.overwriteServerFile) {
          const { fileUrl: uploadedUrl, fileKey: uploadedKey, bucketName: uploadedBucket } = await r2Service.uploadFile(
            file,
            (progress, details) => updateItemState(itemData.id, { 
              uploadProgress: progress,
              uploadProgressDetails: details
            }),
            currentLanguage,
            file.name 
          );
          workerFileUrl = uploadedUrl;
          r2FileKey = uploadedKey;
          bucketNameUsed = uploadedBucket;
        } else {
          workerFileUrl = fileExistsInR2.fileUrl;
          r2FileKey = file.name.replace(/\s+/g, '_'); 
          bucketNameUsed = fileExistsInR2.bucketName;
          updateItemState(itemData.id, { uploadProgress: 100 }); 
          toast({ title: getLocaleString('fileAlreadyInR2Title', currentLanguage), description: getLocaleString('fileAlreadyInR2Desc', currentLanguage, { fileName: file.name }), variant: "info" });
        }
      } else {
        const { fileUrl: uploadedUrl, fileKey: uploadedKey, bucketName: uploadedBucket } = await r2Service.uploadFile(
          file,
          (progress, details) => updateItemState(itemData.id, { 
            uploadProgress: progress,
            uploadProgressDetails: details
          }),
          currentLanguage,
          file.name 
        );
        workerFileUrl = uploadedUrl;
        r2FileKey = uploadedKey;
        bucketNameUsed = uploadedBucket;
      }
    } else if (userConfirmedOverwriteGlobal && workerFileUrl) {
       // Respect overwriteServerFile choice even when episode existed in DB
       const choices = userOverwriteChoices || { overwriteServerFile: false };
       if (choices.overwriteServerFile) {
         const { fileUrl: uploadedUrl, fileKey: uploadedKey, bucketName: uploadedBucket } = await r2Service.uploadFile(
           file,
           (progress, details) => updateItemState(itemData.id, { 
             uploadProgress: progress,
             uploadProgressDetails: details
           }),
           currentLanguage,
           file.name 
         );
         workerFileUrl = uploadedUrl;
         r2FileKey = uploadedKey;
         bucketNameUsed = uploadedBucket;
       } else {
         updateItemState(itemData.id, { uploadProgress: 100 });
         toast({ title: getLocaleString('usingExistingR2FileTitle', currentLanguage), description: getLocaleString('usingExistingR2FileDesc', currentLanguage, { fileName: r2FileKey }), variant: "info" });
       }
    }
    
    if (userConfirmedOverwriteGlobal) {
       updateItemState(itemData.id, { uploadError: null, transcriptionStatus: getLocaleString('overwritingDbData', currentLanguage) });
       const choices = userOverwriteChoices || { overwriteServerFile: true, overwriteEpisodeInfo: true, overwriteTranscript: true, overwriteQuestions: true };
       
       if (choices.overwriteQuestions) {
         const { error: qDelError } = await supabase.from('questions').delete().eq('episode_slug', episodeSlug).eq('lang', lang);
         if (qDelError) console.warn(`Error deleting old questions for ${episodeSlug} (${lang}): ${qDelError.message}`);
       }
       if (choices.overwriteTranscript) {
         const { error: tDelError } = await supabase.from('transcripts').delete().eq('episode_slug', episodeSlug).eq('lang', lang);
         if (tDelError) console.warn(`Error deleting old transcripts for ${episodeSlug} (${lang}): ${tDelError.message}`);
       }
       
       toast({title: getLocaleString('overwritingEpisodeTitle', currentLanguage), description: getLocaleString('overwritingEpisodeDesc', currentLanguage, {slug: episodeSlug})});
    }
    
    const audioForDuration = new Audio();
    audioForDuration.src = URL.createObjectURL(file);
    let duration = 0;
    try {
      duration = await new Promise((resolve, reject) => {
        audioForDuration.onloadedmetadata = () => resolve(audioForDuration.duration);
        audioForDuration.onerror = (e) => {
          console.error("Audio metadata load error:", e);
          reject(new Error(getLocaleString('audioMetadataError', currentLanguage)));
        };
        setTimeout(() => reject(new Error('Timeout getting audio duration')), 7000);
      });
    } catch (e) { 
      console.error("Error getting duration", e); 
      duration = 0; 
      toast({ title: getLocaleString('warning', currentLanguage), description: getLocaleString('audioMetadataError', currentLanguage) + " " + e.message, variant: "destructive" });
    } finally {
      URL.revokeObjectURL(audioForDuration.src);
    }

    // Provide fallback date if parsedDate is null to avoid database constraint violation
    const episodeDate = parsedDate || new Date().toISOString().split('T')[0];

    const episodePayload = {
      slug: episodeSlug,
      title: episodeTitle,
      lang: lang,
      date: episodeDate,
      audio_url: workerFileUrl,
      r2_object_key: r2FileKey,
      r2_bucket_name: bucketNameUsed,
      duration: Math.round(duration || 0),
      file_has_lang_suffix: itemData.fileHasLangSuffix,
    };
    
    let upsertedEpisode;
    if (userConfirmedOverwriteGlobal) {
      const choices = userOverwriteChoices || { overwriteEpisodeInfo: true };
      if (choices.overwriteEpisodeInfo) {
        const upsertRes = await supabase
          .from('episodes')
          .upsert(episodePayload, { onConflict: 'slug' })
          .select('slug')
          .maybeSingle();
        upsertedEpisode = upsertRes.data;
        if (upsertRes.error) throw new Error(getLocaleString('supabaseEpisodeError', currentLanguage, {errorMessage: upsertRes.error.message}));
      } else {
        const fetchRes = await supabase
          .from('episodes')
          .select('slug')
          .eq('slug', episodeSlug)
          .maybeSingle();
        if (fetchRes.error) throw new Error(getLocaleString('supabaseEpisodeError', currentLanguage, {errorMessage: fetchRes.error.message}));
        upsertedEpisode = fetchRes.data || { slug: episodeSlug };
      }
    } else {
      const upsertRes = await supabase
        .from('episodes')
        .upsert(episodePayload, { onConflict: 'slug' })
        .select('slug')
        .maybeSingle();
      upsertedEpisode = upsertRes.data;
      if (upsertRes.error) throw new Error(getLocaleString('supabaseEpisodeError', currentLanguage, {errorMessage: upsertRes.error.message}));
    }
    
    if (timingsText.trim() && upsertedEpisode.slug) {
      const choices = userOverwriteChoices || { overwriteTranscript: true, overwriteQuestions: true };
      // Insert questions if opted-in
      if (choices.overwriteQuestions) {
      let questionsToInsert = parseQuestionsFromDescriptionString(timingsText, lang, upsertedEpisode.slug);
      
      const logTranslatedQuestions = async (questions, currentSlug, enSlug) => {
        try {
          console.log(`[logTranslatedQuestions] Starting translation for ${questions.length} questions from ${currentSlug} to ${enSlug}`);
          
          // Переводим только заголовки вопросов, сохраняя исходное время
          const translatedQuestionsForEn = await Promise.all(questions.map(async (q) => {
            const prompt = `Переведи следующий заголовок вопроса с испанского на английский язык. Верни только переведенный текст без кавычек и дополнительных символов: "${q.title}"`;
            const translatedTitle = await translateTextOpenAI(prompt, 'en');
            
            console.log(`[logTranslatedQuestions] Question translation:`, {
              original: { title: q.title, time: q.time },
              translated: { title: translatedTitle.trim(), time: q.time }
            });
            
            return {
              episode_slug: enSlug,
              lang: 'en',
              title: translatedTitle.trim(),
              time: q.time // Сохраняем исходное время без изменений
            };
          }));

          if (translatedQuestionsForEn.length > 0) {
            const { error: enQDelError } = await supabase.from('questions').delete().eq('episode_slug', enSlug).eq('lang', 'en');
            if (enQDelError) console.warn(`Error deleting old EN questions for ${enSlug}: ${enQDelError.message}`);
            
            const { error: enQError } = await supabase.from('questions').insert(translatedQuestionsForEn).select();
            if (enQError) console.warn(`Error saving translated EN questions for ${enSlug}: ${enQError.message}`);
            else {
              toast({title: "English Questions Translated", description: `Questions for ${enSlug} translated to English.`, variant: "default"});
            }
          }
        } catch (translationError) {
          console.error("Error translating questions to English:", translationError);
          toast({title: "English Question Translation Error", description: translationError.message, variant: "destructive"});
        }
      };

      if (lang === 'es' && getAllItems) {
        const allCurrentItems = getAllItems();
        const correspondingEnItem = allCurrentItems.find(item => item.originalFileId === originalFileId && item.lang === 'en' && item.sourceLangForEn === 'es');
        if (correspondingEnItem) {
          await logTranslatedQuestions(questionsToInsert, episodeSlug, correspondingEnItem.episodeSlug);
        }
      }

      if (questionsToInsert.length > 0) {
        const { error: questionsError } = await supabase.from('questions').insert(questionsToInsert).select();
        if (questionsError) console.warn(`Error saving questions for ${episodeSlug} (${lang}): ${questionsError.message}`);
      }
      }
    }

    if (upsertedEpisode.slug) {
      updateItemState(itemData.id, { transcriptionStatus: getLocaleString('startingTranscription', currentLanguage) });
      
      const { data: existingTranscript, error: transcriptCheckError } = await supabase
        .from('transcripts')
        .select('status, assemblyai_transcript_id')
        .eq('episode_slug', upsertedEpisode.slug)
        .eq('lang', lang)
        .maybeSingle();

      if (transcriptCheckError && transcriptCheckError.code !== 'PGRST116') {
        throw new Error(getLocaleString('supabaseTranscriptError', currentLanguage, { errorMessage: transcriptCheckError.message }));
      }

      let shouldSubmitTranscription = true;
      if (existingTranscript && !userConfirmedOverwriteGlobal) {
        if (existingTranscript.status === 'completed') {
          shouldSubmitTranscription = false;
          updateItemState(itemData.id, { transcriptionStatus: 'completed' });
          toast({ title: getLocaleString('transcriptionExistsTitle', currentLanguage), description: getLocaleString('transcriptionExistsDesc', currentLanguage, {episode: episodeTitle}), variant: 'info' });
        } else if (existingTranscript.status === 'processing' || existingTranscript.status === 'queued') {
          shouldSubmitTranscription = false;
          updateItemState(itemData.id, { transcriptionStatus: existingTranscript.status });
          startPollingForItem(itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef, getAllItems);
        }
      }
      
      if (lang === 'en' && sourceLangForEn === 'es') {
        shouldSubmitTranscription = false;
        updateItemState(itemData.id, { transcriptionStatus: 'pending_translation_from_es' });
        const { error: transcriptDbError } = await supabase
          .from('transcripts')
          .upsert({
            episode_slug: episodeSlug,
            lang: 'en',
            status: 'pending_translation_from_es',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'episode_slug, lang' });

        if (transcriptDbError) {
           if(transcriptDbError.message.includes('constraint matching the ON CONFLICT specification')) {
            console.warn("ON CONFLICT failed for pending_translation_from_es, likely due to missing unique constraint on (episode_slug, lang). This may be okay if poller handles it.");
          } else {
            throw new Error(getLocaleString('supabaseTranscriptError', currentLanguage, { errorMessage: transcriptDbError.message }));
          }
        }
      }

      // AUTO-TRANSCRIPTION DISABLED: Now handled manually via TranscriptionButton
      // Store audio URL for manual transcription
      updateItemState(itemData.id, { 
        uploadedAudioUrl: workerFileUrl,
        r2FileKey: r2FileKey,
        transcriptionStatus: 'not_started' 
      });
      
      console.log(`Upload complete for ${episodeSlug}. Transcription can be started manually from UI.`);
    }
    updateItemState(itemData.id, { isUploading: false, uploadComplete: true, uploadProgress: 100 });
    return { success: true, requiresDialog: false };
  } catch (error) {
    console.error(`Upload process error for ${file.name} (${lang}):`, error);
    updateItemState(itemData.id, { isUploading: false, uploadError: error.message, transcriptionStatus: 'error' });
    return { success: false, requiresDialog: false };
  }
};
