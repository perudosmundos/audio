import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { translateTranscriptOpenAI, translateTextOpenAI } from '@/lib/openAIService';
import { buildEditedTranscriptData } from '@/hooks/transcript/transcriptProcessingUtils';
import { getLocaleString } from '@/lib/locales';

const useTranslationManager = (currentLanguage, toast, episodes, setEpisodes) => {
  const [translatingFrom, setTranslatingFrom] = useState(null);
  const [translationProgress, setTranslationProgress] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);

  // Перевод транскрипта и вопросов с указанного языка на целевой язык
  const translateEpisode = useCallback(async (sourceEpisode, targetLang, sourceLang, options = {}) => {
    const overwrite = options?.overwrite ?? true; // По умолчанию перезаписываем существующие переводы в массовом режиме
    const questionsOnly = options?.questionsOnly ?? false; // Флаг для перевода только вопросов
    console.log('[translateEpisode] Starting translation:', {
      sourceSlug: sourceEpisode?.slug,
      sourceLang,
      targetLang,
      isTranslating,
      overwrite,
      questionsOnly
    });

    if (!sourceEpisode || !sourceEpisode.slug) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: 'Исходный эпизод не найден',
        variant: 'destructive'
      });
      return false;
    }

    // Проверяем, не идет ли уже перевод
    if (isTranslating) {
      console.log('[translateEpisode] Translation already in progress, skipping');
      return false;
    }

    // Валидация поддерживаемых языков
    const supportedLanguages = ['en', 'es', 'ru', 'de', 'fr', 'pl'];
    if (!supportedLanguages.includes(targetLang)) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Неподдерживаемый целевой язык: ${targetLang}`,
        variant: 'destructive'
      });
      return false;
    }

    if (!supportedLanguages.includes(sourceLang)) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Неподдерживаемый исходный язык: ${sourceLang}`,
        variant: 'destructive'
      });
      return false;
    }

    const translationKey = `${sourceEpisode.slug}-${sourceLang}-${targetLang}`;
    console.log('[translateEpisode] Setting translatingFrom to:', translationKey);
    setIsTranslating(true);
    setTranslatingFrom(translationKey);

    try {
      // 1. Проверяем наличие транскрипта у исходного эпизода
      const { data: sourceTranscript, error: sourceTranscriptError } = await supabase
        .from('transcripts')
        .select('*')
        .eq('episode_slug', sourceEpisode.slug)
        .eq('lang', sourceLang)
        .single();

      console.log('[translateEpisode] Source transcript:', {
        found: !!sourceTranscript,
        status: sourceTranscript?.status,
        error: sourceTranscriptError?.message
      });

      if (sourceTranscriptError || !sourceTranscript || sourceTranscript.status !== 'completed') {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: `Транскрипт ${sourceLang.toUpperCase()} не готов для перевода`,
          variant: 'destructive'
        });
        return false;
      }

      // 2. Создаем эпизод для целевого языка (если не существует)
  let targetSlug;
      if (sourceEpisode.slug.match(/_[a-z]{2}$/)) {
        // Если slug уже имеет языковой суффикс, заменяем его
        targetSlug = sourceEpisode.slug.replace(/_[a-z]{2}$/, `_${targetLang}`);
      } else {
        // Если slug не имеет языкового суффикса, добавляем его
        targetSlug = `${sourceEpisode.slug}_${targetLang}`;
      }
      
      console.log('[translateEpisode] Target slug generation:', {
        sourceSlug: sourceEpisode.slug,
        targetLang,
        targetSlug,
        hasLangSuffix: !!sourceEpisode.slug.match(/_[a-z]{2}$/)
      });
      
      const { data: existingTargetEpisode, error: checkError } = await supabase
        .from('episodes')
        .select('id, slug, lang')
        .eq('slug', targetSlug)
        .eq('lang', targetLang)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (!existingTargetEpisode) {
        // Переводим название эпизода
        console.log('[translateEpisode] Translating episode title:', sourceEpisode.title);
        const translatedTitle = await translateTextOpenAI(
          sourceEpisode.title,
          targetLang,
          currentLanguage
        );
        
        if (!translatedTitle || translatedTitle.trim() === '') {
          console.warn('[translateEpisode] Empty title translation, using original');
        }

        // Создаем новый эпизод для перевода
        // Копируем аудио ссылку из исходного эпизода (как в других частях кода)
        // Это позволяет слушать оригинальное аудио в переведенной версии
        const { error: insertError } = await supabase
          .from('episodes')
          .insert([{
            slug: targetSlug,
            title: translatedTitle?.trim() || sourceEpisode.title,
            lang: targetLang,
            date: sourceEpisode.date,
            audio_url: sourceEpisode.audio_url || '',
            r2_object_key: sourceEpisode.r2_object_key || '',
            r2_bucket_name: sourceEpisode.r2_bucket_name || '',
            duration: sourceEpisode.duration || 0,
            file_has_lang_suffix: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertError) {
          throw new Error(`Ошибка создания эпизода: ${insertError.message}`);
        }
      } else if (overwrite) {
        // Если эпизод уже существует и включен overwrite, сообщим в лог
        console.log('[translateEpisode] Target episode exists, will overwrite transcript and questions:', {
          targetSlug,
          targetLang
        });
      }

      // 3. Переводим транскрипт (только если не questionsOnly)
      if (!questionsOnly) {
        toast({
          title: '🔄 Перевод транскрипта',
          description: `Переводим с ${sourceLang.toUpperCase()} на ${targetLang.toUpperCase()}...`
        });

        const translatedTranscript = await translateTranscriptOpenAI(
          sourceTranscript.edited_transcript_data || sourceTranscript.transcript_data,
          targetLang,
          currentLanguage,
          (current, total, message) => {
            setTranslationProgress({
              [translationKey]: {
                current,
                total,
                message,
                percentage: Math.round((current / total) * 100)
              }
            });
          }
        );

        if (!translatedTranscript || !translatedTranscript.utterances) {
          throw new Error('Ошибка перевода: получен пустой результат');
        }

        // 4. Сохраняем переведенный транскрипт
        // Если overwrite включен, удалим старый транскрипт перед upsert, чтобы очистить лишние поля
        if (overwrite) {
          try {
            await supabase
              .from('transcripts')
              .delete()
              .eq('episode_slug', targetSlug)
              .eq('lang', targetLang);
          } catch (e) {
            console.warn('[translateEpisode] Failed to delete existing transcript before overwrite (continuing):', e?.message);
          }
        }
        const compactTranslated = buildEditedTranscriptData(translatedTranscript);
        
        const { error: transcriptUpsertError } = await supabase
          .from('transcripts')
          .upsert([{
            episode_slug: targetSlug,
            lang: targetLang,
            status: 'completed',
            edited_transcript_data: compactTranslated,
            updated_at: new Date().toISOString()
          }], {
            onConflict: 'episode_slug,lang'
          });

        if (transcriptUpsertError) {
          throw new Error(`Ошибка сохранения транскрипта: ${transcriptUpsertError.message}`);
        }
      }

      // 5. Переводим вопросы (если есть)
      const { data: sourceQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('episode_slug', sourceEpisode.slug)
        .eq('lang', sourceLang);

      console.log('[translateEpisode] Source questions:', {
        found: !!sourceQuestions,
        count: sourceQuestions?.length || 0,
        error: questionsError?.message
      });

      if (!questionsError && sourceQuestions && sourceQuestions.length > 0) {
        toast({
          title: questionsOnly ? '🔄 Перевод только вопросов' : '🔄 Перевод вопросов',
          description: `Переводим ${sourceQuestions.length} вопросов с ${sourceLang.toUpperCase()} на ${targetLang.toUpperCase()}...`
        });

        const translatedQuestions = [];
        let successCount = 0;
        let errorCount = 0;

        for (const question of sourceQuestions) {
          try {
            console.log(`[translateEpisode] Translating question: "${question.title}"`);
            
            const translatedTitle = await translateTextOpenAI(
              question.title,
              targetLang,
              currentLanguage
            );

            if (!translatedTitle || translatedTitle.trim() === '') {
              console.warn(`Empty translation for question: ${question.title}`);
              errorCount++;
              continue;
            }

            console.log(`[translateEpisode] Translated: "${question.title}" -> "${translatedTitle}"`);

            translatedQuestions.push({
              episode_slug: targetSlug,
              lang: targetLang,
              time: question.time,
              title: translatedTitle.trim(),
              created_at: new Date().toISOString()
            });
            
            successCount++;
          } catch (error) {
            console.error(`Error translating question: ${question.title}`, error);
            errorCount++;
            // Продолжаем с другими вопросами, но логируем ошибку
          }
        }

        console.log(`[translateEpisode] Questions translation summary:`, {
          total: sourceQuestions.length,
          success: successCount,
          errors: errorCount
        });

        if (translatedQuestions.length > 0) {
          // Удаляем старые вопросы для целевого языка (или всегда, если overwrite)
          if (overwrite) {
            await supabase
              .from('questions')
              .delete()
              .eq('episode_slug', targetSlug)
              .eq('lang', targetLang);
          }

          // Вставляем новые переведенные вопросы
          const { error: questionsInsertError } = await supabase
            .from('questions')
            .insert(translatedQuestions);

          if (questionsInsertError) {
            console.warn('Ошибка сохранения вопросов:', questionsInsertError);
            toast({
              title: '⚠️ Ошибка сохранения вопросов',
              description: `Переведено ${translatedQuestions.length} вопросов, но возникла ошибка при сохранении`,
              variant: 'destructive',
              duration: 5000
            });
          } else {
            console.log(`Успешно переведено и сохранено ${translatedQuestions.length} вопросов`);
            toast({
              title: '✅ Вопросы переведены',
              description: `Успешно переведено и сохранено ${translatedQuestions.length} вопросов`,
              duration: 3000
            });
          }
        } else {
          console.warn('Не удалось перевести ни одного вопроса');
          toast({
            title: '⚠️ Вопросы не переведены',
            description: 'Не удалось перевести ни одного вопроса',
            variant: 'destructive',
            duration: 5000
          });
        }
      }

      // 6. Обновляем состояние эпизодов
      if (setEpisodes) {
        // Загружаем полные данные эпизода с транскриптом и количеством вопросов
        const { data: updatedEpisode } = await supabase
          .from('episodes')
          .select('*')
          .eq('slug', targetSlug)
          .eq('lang', targetLang)
          .single();

        const { data: transcript } = await supabase
          .from('transcripts')
          .select('id, episode_slug, lang, status, assemblyai_transcript_id, updated_at')
          .eq('episode_slug', targetSlug)
          .eq('lang', targetLang)
          .single();

        const { count: questionsCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('episode_slug', targetSlug)
          .eq('lang', targetLang);

        if (updatedEpisode) {
          const episodeWithData = {
            ...updatedEpisode,
            transcript: transcript || null,
            questionsCount: questionsCount || 0
          };

          setEpisodes(prev => {
            const filtered = prev.filter(e => !(e.slug === targetSlug && e.lang === targetLang));
            return [...filtered, episodeWithData];
          });

          // Уведомляем о том, что данные эпизода обновились
          // Это поможет другим компонентам обновить свои данные
          window.dispatchEvent(new CustomEvent('episodeUpdated', {
            detail: { slug: targetSlug, lang: targetLang, episode: episodeWithData }
          }));
        }
      }

      toast({
        title: '✅ Перевод завершен',
        description: `Эпизод успешно переведен на ${targetLang.toUpperCase()}`,
        duration: 5000
      });

      return true;

    } catch (error) {
      console.error('Translation error:', error);
      
      let errorMessage = error.message;
      if (error.message?.includes('API key')) {
        errorMessage = 'Проблема с API ключом DeepSeek. Обратитесь к администратору.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Таймаут запроса. Попробуйте позже.';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Превышен лимит запросов. Подождите немного.';
      }
      
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Ошибка перевода на ${targetLang.toUpperCase()}: ${errorMessage}`,
        variant: 'destructive',
        duration: 8000
      });
      return false;
    } finally {
      console.log('[translateEpisode] Resetting translatingFrom state');
      setIsTranslating(false);
      setTranslatingFrom(null);
      setTranslationProgress({});
    }
  }, [currentLanguage, toast, setEpisodes, isTranslating]);

  // Массовый перевод всех эпизодов с указанного языка
  const batchTranslateFromLanguage = useCallback(async (episodes, sourceLang, targetLangs, options = {}) => {
    // По умолчанию в массовом режиме НЕ перезаписываем — переводим только отсутствующие/незавершенные
    const overwrite = options?.overwrite ?? false;
    const sourceEpisodes = episodes.filter(e => e.lang === sourceLang && e.transcript?.status === 'completed');
    
    if (sourceEpisodes.length === 0) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: `Нет эпизодов ${sourceLang.toUpperCase()} с завершенной транскрипцией`,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: '🚀 Массовый перевод',
      description: `Начинаем перевод ${sourceEpisodes.length} эпизодов на ${targetLangs.length} языков`,
      duration: 5000
    });

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    const getTargetSlug = (slug, targetLang) => {
      if (slug.match(/_[a-z]{2}$/)) {
        return slug.replace(/_[a-z]{2}$/, `_${targetLang}`);
      }
      return `${slug}_${targetLang}`;
    };

    for (const episode of sourceEpisodes) {
      for (const targetLang of targetLangs) {
        // Пропускаем, если уже есть завершенный перевод и overwrite выключен
        try {
          const targetSlug = getTargetSlug(episode.slug, targetLang);
          const existing = episodes.find(e => e.slug === targetSlug && e.lang === targetLang);
          const isTranslated = existing?.transcript?.status === 'completed';
          if (!overwrite && isTranslated) {
            skippedCount++;
            continue;
          }
        } catch (e) {
          // В случае ошибки проверки — не скипаем, а пробуем перевести
        }

        const success = await translateEpisode(episode, targetLang, sourceLang, { overwrite });
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    const summary = `Успешно: ${successCount}, Пропущено (уже переведены): ${skippedCount}, Ошибок: ${failCount}`;
    toast({
      title: successCount > 0 ? '✅ Массовый перевод завершен' : (failCount > 0 ? '❌ Ошибка перевода' : 'ℹ️ Нечего переводить'),
      description: summary,
      variant: failCount > 0 ? 'destructive' : 'default',
      duration: 8000
    });
  }, [currentLanguage, toast, translateEpisode]);

  return {
    translateEpisode,
    batchTranslateFromLanguage,
    translatingFrom,
    translationProgress
  };
};

export default useTranslationManager;


