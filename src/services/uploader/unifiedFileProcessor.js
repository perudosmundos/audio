import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import { getFileNameWithoutExtension, formatShortDate } from '@/lib/utils';
import r2Service from '@/lib/r2Service';
import assemblyAIService from '@/lib/assemblyAIService';
import { parseQuestionsFromDescriptionString } from '@/lib/podcastService';
import { translateTextOpenAI } from '@/lib/openAIService';
import { startPollingForItem } from './transcriptPoller';

// File details extraction functions
export const generateInitialItemData = async (file, targetLang, currentLanguage, toast, sourceLangForEnTimings = null, esTimingsForEn = null) => {
  const nameWithoutExt = getFileNameWithoutExtension(file.name);
  let dateFromFile = null;
  let titleBase = nameWithoutExt;
  let fileHasLangSuffix = false;

  const langSuffixMatch = nameWithoutExt.match(/_([RUruESesENen]{2})$/i);
  if (langSuffixMatch) {
    titleBase = nameWithoutExt.substring(0, nameWithoutExt.lastIndexOf(langSuffixMatch[0])).trim();
    fileHasLangSuffix = true;
  }
  
  const dateMatch = titleBase.match(/(\d{4})\.(\d{2})\.(\d{2})/); 
  if (dateMatch) {
    dateFromFile = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    titleBase = titleBase.replace(dateMatch[0], '').trim().replace(/^[-_]+|[-_]+$/g, '');
  } else {
    const strictDateMatch = titleBase.match(/^(\d{4})-(\d{2})-(\d{2})$/); 
    if (strictDateMatch) {
      dateFromFile = `${strictDateMatch[1]}-${strictDateMatch[2]}-${strictDateMatch[3]}`;
      titleBase = ''; 
    }
  }
  
  const meditationPrefix = getLocaleString('meditationTitlePrefix', targetLang);
  const episodeTitle = `${meditationPrefix} ${dateFromFile ? formatShortDate(dateFromFile, targetLang) : titleBase || getFileNameWithoutExtension(file.name)}`;
  const episodeSlug = dateFromFile ? `${dateFromFile}_${targetLang}` : `${getFileNameWithoutExtension(file.name)}_${targetLang}`;

  let timingsText = '';
  if (targetLang === 'en' && sourceLangForEnTimings === 'es' && esTimingsForEn) {
      timingsText = esTimingsForEn;
  } else if (dateFromFile) {
    try {
      const columnToFetch = targetLang === 'ru' ? 'timings_ru' : targetLang === 'es' ? 'timings_es' : null;
      if (columnToFetch) {
        const { data, error } = await supabase
          .from('timeOld')
          .select(columnToFetch)
          .eq('date', dateFromFile)
          .maybeSingle();
        if (error) throw error; 
        if (data) {
          timingsText = data[columnToFetch] || '';
        }
      }
    } catch (err) {
      console.error(`Error fetching timings for ${file.name} (${targetLang}):`, err);
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Не удалось загрузить тайминги для ${file.name} (${targetLang}): ${err.message}`, variant: 'destructive' });
    }
  }

  return {
    file,
    originalFileId: file.name + file.lastModified,
    id: `${file.name}-${targetLang}-${Date.now()}`, 
    parsedDate: dateFromFile,
    lang: targetLang,
    episodeTitle,
    episodeSlug,
    timingsText,
    uploadProgress: 0,
    isUploading: false,
    uploadError: null,
    uploadComplete: false,
    transcriptionStatus: null,
    transcriptionError: null,
    fileHasLangSuffix,
    sourceLangForEn: sourceLangForEnTimings,
    isTranslatingTimings: false,
    translationTriggered: false,
  };
};

// File processing functions
export const processSingleItem = async ({
  itemData,
  forceOverwrite = false,
  updateItemState,
  currentLanguage,
  toast,
  openOverwriteDialog, 
  pollingIntervalsRef,
  getAllItems 
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
        userConfirmedOverwriteGlobal = true; 
        
        workerFileUrl = existingEpisode.audio_url;
        r2FileKey = existingEpisode.r2_object_key;
        bucketNameUsed = existingEpisode.r2_bucket_name;
      }
    }
    
    if (!userConfirmedOverwriteGlobal || !workerFileUrl) {
      const fileExistsInR2 = await r2Service.checkFileExists(file.name);
      if (fileExistsInR2.exists && !userConfirmedOverwriteGlobal) {
        workerFileUrl = fileExistsInR2.fileUrl;
        r2FileKey = file.name.replace(/\s+/g, '_'); 
        bucketNameUsed = fileExistsInR2.bucketName;
        updateItemState(itemData.id, { uploadProgress: 100 }); 
        toast({ title: getLocaleString('fileAlreadyInR2Title', currentLanguage), description: getLocaleString('fileAlreadyInR2Desc', currentLanguage, { fileName: file.name }), variant: "info" });
      } else {
        const { fileUrl: uploadedUrl, fileKey: uploadedKey, bucketName: uploadedBucket } = await r2Service.uploadFile(
          file,
          (progress) => updateItemState(itemData.id, { uploadProgress: progress }),
          currentLanguage,
          file.name 
        );
        workerFileUrl = uploadedUrl;
        r2FileKey = uploadedKey;
        bucketNameUsed = uploadedBucket;
      }
    } else if (userConfirmedOverwriteGlobal && workerFileUrl) {
       updateItemState(itemData.id, { uploadProgress: 100 });
       toast({ title: getLocaleString('usingExistingR2FileTitle', currentLanguage), description: getLocaleString('usingExistingR2FileDesc', currentLanguage, { fileName: r2FileKey }), variant: "info" });
    }
    
    if (userConfirmedOverwriteGlobal) {
       updateItemState(itemData.id, { uploadError: null, transcriptionStatus: getLocaleString('overwritingDbData', currentLanguage) });
       
       const { error: qDelError } = await supabase.from('questions').delete().eq('episode_slug', episodeSlug).eq('lang', lang);
       if (qDelError) console.warn(`Error deleting old questions for ${episodeSlug} (${lang}): ${qDelError.message}`);
       
       const { error: tDelError } = await supabase.from('transcripts').delete().eq('episode_slug', episodeSlug).eq('lang', lang);
       if (tDelError) console.warn(`Error deleting old transcripts for ${episodeSlug} (${lang}): ${tDelError.message}`);
       
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
    
    const { data: upsertedEpisode, error: episodeDbError } = await supabase
      .from('episodes')
      .upsert(episodePayload, { onConflict: 'slug' })
      .select('slug')
      .maybeSingle();

    if (episodeDbError) throw new Error(getLocaleString('supabaseEpisodeError', currentLanguage, {errorMessage: episodeDbError.message}));
    
    if (timingsText.trim() && upsertedEpisode.slug) {
      let questionsToInsert = parseQuestionsFromDescriptionString(timingsText, lang, upsertedEpisode.slug);
      
      const logTranslatedQuestions = async (questions, currentSlug, enSlug) => {
        try {
          const translatedTimingsText = await translateTextOpenAI(timingsText, 'en');
          const translatedQuestionsForEn = parseQuestionsFromDescriptionString(translatedTimingsText, 'en', enSlug);

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
        } else if (existingTranscript.status === 'processing' && existingTranscript.assemblyai_transcript_id) {
          shouldSubmitTranscription = false;
          startPollingForItem(itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef);
        }
      }

      if (shouldSubmitTranscription) {
        try {
          const { transcriptId, error: assemblyError } = await assemblyAIService.submitTranscription(workerFileUrl, lang);
          if (assemblyError) throw assemblyError;

          const transcriptPayload = {
            episode_slug: upsertedEpisode.slug,
            lang: lang,
            assemblyai_transcript_id: transcriptId,
            status: 'processing'
          };

          const { error: transcriptDbError } = await supabase
            .from('transcripts')
            .upsert(transcriptPayload, { onConflict: 'episode_slug,lang' });

          if (transcriptDbError) throw new Error(getLocaleString('supabaseTranscriptError', currentLanguage, { errorMessage: transcriptDbError.message }));

          startPollingForItem(itemData, updateItemState, currentLanguage, toast, pollingIntervalsRef);
        } catch (transcriptionError) {
          console.error("Transcription submission error:", transcriptionError);
          updateItemState(itemData.id, { transcriptionError: transcriptionError.message });
          toast({ title: getLocaleString('transcriptionErrorTitle', currentLanguage), description: getLocaleString('transcriptionErrorDesc', currentLanguage, { errorMessage: transcriptionError.message }), variant: "destructive" });
        }
      }
    }

    updateItemState(itemData.id, { 
      isUploading: false, 
      uploadComplete: true, 
      uploadError: null,
      transcriptionStatus: existingTranscript?.status === 'completed' ? 'completed' : itemData.transcriptionStatus
    });

    return { success: true, requiresDialog: false };

  } catch (error) {
    console.error("Error processing item:", error);
    updateItemState(itemData.id, { 
      isUploading: false, 
      uploadError: error.message,
      transcriptionError: error.message
    });
    toast({ title: getLocaleString('errorGeneric', currentLanguage), description: error.message, variant: "destructive" });
    return { success: false, requiresDialog: false };
  }
}; 