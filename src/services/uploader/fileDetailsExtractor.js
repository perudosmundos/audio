import { supabase } from '@/lib/supabaseClient';
import { getLocaleString } from '@/lib/locales';
import { getFileNameWithoutExtension, formatShortDate } from '@/lib/utils';

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
          .single();
        if (error && error.code !== 'PGRST116') throw error; 
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