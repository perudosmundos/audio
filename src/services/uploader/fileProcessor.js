
import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import r2Service from '@/lib/r2Service';
import assemblyAIService from '@/lib/assemblyAIService';
import { parseQuestionsFromDescriptionString } from '@/lib/podcastService';
import { translateTextOpenAI } from '@/lib/openAIService';
import { startPollingForItem } from './transcriptPoller';

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
  
  const { file, episodeSlug, episodeTitle, lang, parsedDate, timingsText, sourceLangForEn, originalFileId } = itemData;

  if (!episodeSlug) {
    updateItemState(itemData.id, { isUploading: false, uploadError: "Не удалось определить SLUG." });
    return { success: false, requiresDialog: false };
  }

  let workerFileUrl;
  let r2FileKey;
  let bucketNameUsed;
  let userConfirmedOverwriteGlobal = forceOverwrite;
  let userOverwriteChoices = overwriteOptions || null;

  try {
    if (!forceOverwrite) {
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
    
    if (!userConfirmedOverwriteGlobal || !workerFileUrl) {
      const fileExistsInR2 = await r2Service.checkFileExists(file.name);
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

    const episodePayload = {
      slug: episodeSlug,
      title: episodeTitle,
      lang: lang,
      date: parsedDate,
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

      const choices = userOverwriteChoices || { overwriteTranscript: true };
      if (shouldSubmitTranscription && choices.overwriteTranscript) {
        try {
            const assemblyLangCode = lang; 
            // If the public URL is not accessible by AssemblyAI (schema/CDN), fall back to direct upload
            // Try multiple URL approaches for AssemblyAI compatibility
            let transcriptJob;
            try {
              // Use the correct public URL format for AssemblyAI
              let assemblyUrl = workerFileUrl;
              console.log("DEBUG: workerFileUrl before conversion:", workerFileUrl);
              
              // If we have a file name, construct the correct public URL
              if (file && file.name) {
                const fileName = file.name.replace(/\s+/g, '_');
                assemblyUrl = `https://b2a9e188-93e4-4928-a636-2ad4c9e1094e.srvstatic.kz/${fileName}`;
                console.log("Constructed correct public URL for AssemblyAI:", assemblyUrl);
              }
              
              console.log("DEBUG: Final assemblyUrl:", assemblyUrl);
              console.log("Submitting to AssemblyAI with URL:", assemblyUrl);
              transcriptJob = await assemblyAIService.submitTranscription(assemblyUrl, assemblyLangCode, upsertedEpisode.slug, currentLanguage, lang);
                        } catch (e) {
              const msg = (e?.message || '').toLowerCase();
              if (msg.includes('invalid endpoint schema')) {
                console.log("Public URL failed, trying presigned GET URL as recommended by AssemblyAI docs");
                try {
                  // Second try: presigned GET URL for server authentication (AssemblyAI best practice)
                  const objectKey = r2FileKey || (file?.name ? file.name.replace(/\s+/g, '_') : null);
                  if (objectKey) {
                    console.log("Getting presigned GET URL for object key:", objectKey);
                    const presignedUrl = await assemblyAIService.getPresignedGetUrl(objectKey);
                    if (presignedUrl) {
                      console.log("Using presigned GET URL (AssemblyAI recommended method):", presignedUrl);
                      transcriptJob = await assemblyAIService.submitTranscription(presignedUrl, assemblyLangCode, upsertedEpisode.slug, currentLanguage, lang);
                    } else {
                      throw new Error('Could not get presigned URL');
                    }
                  } else {
                    throw new Error('No object key available');
                  }
                } catch (presignError) {
                  console.log("Presigned URL also failed:", presignError.message);
                  console.log("Uploading directly to AssemblyAI as final fallback");
                  // Final fallback: direct upload
                  const uploadUrl = await assemblyAIService.uploadDirect(file);
                  transcriptJob = await assemblyAIService.submitTranscription(uploadUrl, assemblyLangCode, upsertedEpisode.slug, currentLanguage, lang);
                }
              } else {
                throw e;
              }
            }
            
            const transcriptPayload = {
                episode_slug: upsertedEpisode.slug,
                lang: lang,
                assemblyai_transcript_id: transcriptJob.id,
                status: transcriptJob.status,
                updated_at: new Date().toISOString(),
                        edited_transcript_data: null 
            };
            
            const { error: transcriptDbError } = await supabase.from('transcripts').upsert(transcriptPayload, { onConflict: 'episode_slug, lang' }).select().maybeSingle();

            if (transcriptDbError) {
              if(transcriptDbError.message.includes('constraint matching the ON CONFLICT specification')) {
                console.error("ON CONFLICT failed when upserting transcript job, likely due to missing unique constraint on (episode_slug, lang). DB Schema needs 'ALTER TABLE public.transcripts ADD CONSTRAINT transcripts_episode_slug_lang_unique UNIQUE (episode_slug, lang);'");
                throw new Error(getLocaleString('errorSavingTranscriptionData', currentLanguage, { errorMessage: "Database configuration error (ON CONFLICT)."}));
              } else {
                throw new Error(getLocaleString('supabaseTranscriptError', currentLanguage, { errorMessage: transcriptDbError.message }));
              }
            }
            
            updateItemState(itemData.id, { transcriptionStatus: transcriptJob.status });
            if (transcriptJob.status === 'queued' || transcriptJob.status === 'processing') {
              startPollingForItem(itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef, getAllItems);
            } else if (transcriptJob.status === 'completed') {
               updateItemState(itemData.id, { transcriptionStatus: 'completed' });
               toast({ title: getLocaleString('transcriptionCompletedTitle', currentLanguage), description: getLocaleString('transcriptionCompletedDesc', currentLanguage, {episode: itemData.episodeTitle}), variant: 'default' });
            }

        } catch (assemblyError) {
            console.error(`AssemblyAI submission error for ${episodeSlug}:`, assemblyError);
            updateItemState(itemData.id, { transcriptionError: assemblyError.message, transcriptionStatus: 'error' });
        }
      }
    }
    updateItemState(itemData.id, { isUploading: false, uploadComplete: true, uploadProgress: 100 });
    return { success: true, requiresDialog: false };
  } catch (error) {
    console.error(`Upload process error for ${file.name} (${lang}):`, error);
    updateItemState(itemData.id, { isUploading: false, uploadError: error.message, transcriptionStatus: 'error' });
    return { success: false, requiresDialog: false };
  }
};
