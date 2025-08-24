import { supabase } from './supabaseClient';
import logger from './logger';

// Максимальный размер чанка для сохранения в БД (в символах)
const MAX_CHUNK_SIZE = 30000; // 30KB, безопаснее для бесплатного плана
// Максимальное количество чанков на транскрипцию
const MAX_CHUNKS_PER_TRANSCRIPT = 100; // удерживаем суммарный размер в разумных пределах

/**
 * Разбивает большой текст транскрипции на чанки для порционного сохранения
 */
export const chunkTranscriptText = (text, maxChunkSize = MAX_CHUNK_SIZE) => {
  if (!text || text.length <= maxChunkSize) {
    return [{ text, startIndex: 0, endIndex: text.length }];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    
    // Если это не последний чанк, ищем место для разрыва
    if (endIndex < text.length) {
      // Ищем конец предложения в пределах окна поиска
      const searchWindow = Math.min(maxChunkSize * 0.2, 1000); // 20% от размера чанка или 1000 символов
      const searchStart = Math.max(startIndex + maxChunkSize - searchWindow, startIndex);
      const searchEnd = Math.min(startIndex + maxChunkSize + searchWindow, text.length);
      
      let bestBreakPoint = endIndex;
      
      // Ищем конец предложения
      for (let i = searchStart; i <= searchEnd; i++) {
        if (text[i] === '.' || text[i] === '?' || text[i] === '!') {
          if (i + 1 < text.length && text[i + 1] === ' ') {
            bestBreakPoint = i + 2;
            break;
          }
          bestBreakPoint = i + 1;
        }
      }
      
      // Если не нашли конец предложения, ищем пробел
      if (bestBreakPoint === endIndex) {
        for (let i = searchStart; i <= searchEnd; i++) {
          if (text[i] === ' ') {
            bestBreakPoint = i + 1;
            break;
          }
        }
      }
      
      endIndex = bestBreakPoint;
    }

    chunks.push({
      text: text.substring(startIndex, endIndex),
      startIndex,
      endIndex
    });

    startIndex = endIndex;
  }

  return chunks;
};

/**
 * Разбивает utterances на чанки по времени
 */
export const chunkUtterances = (utterances, maxChunkSize = MAX_CHUNK_SIZE) => {
  if (!utterances || utterances.length === 0) {
    return [];
  }

  const chunks = [];
  let currentChunk = {
    utterances: [],
    totalTextLength: 0,
    startTime: utterances[0]?.start || 0,
    endTime: 0
  };

  for (const utterance of utterances) {
    const utteranceTextLength = utterance.text?.length || 0;
    
    // Если добавление этого utterance превысит лимит, создаем новый чанк
    if (currentChunk.totalTextLength + utteranceTextLength > maxChunkSize && currentChunk.utterances.length > 0) {
      currentChunk.endTime = currentChunk.utterances[currentChunk.utterances.length - 1].end;
      chunks.push(currentChunk);
      
      currentChunk = {
        utterances: [],
        totalTextLength: 0,
        startTime: utterance.start,
        endTime: 0
      };
    }

    currentChunk.utterances.push(utterance);
    currentChunk.totalTextLength += utteranceTextLength;
  }

  // Добавляем последний чанк
  if (currentChunk.utterances.length > 0) {
    currentChunk.endTime = currentChunk.utterances[currentChunk.utterances.length - 1].end;
    chunks.push(currentChunk);
  }

  return chunks;
};

/**
 * Сохраняет транскрипцию порционно в базу данных
 */
export const saveTranscriptInChunks = async (episodeSlug, lang, transcriptData, options = {}) => {
  const {
    maxChunkSize = MAX_CHUNK_SIZE,
    maxChunks = MAX_CHUNKS_PER_TRANSCRIPT,
    saveFullData = true,
    saveCompactData = true
  } = options;

  try {
    logger.info('[transcriptChunkingService] Starting chunked save', { 
      episodeSlug, 
      lang, 
      hasUtterances: !!transcriptData.utterances,
      hasWords: !!transcriptData.words,
      textLength: transcriptData.text?.length || 0,
      options: { maxChunkSize, maxChunks, saveFullData, saveCompactData }
    });

    // 1. Сохраняем компактную версию (если требуется)
    if (saveCompactData) {
      try {
        const compactData = {
          utterances: transcriptData.utterances?.map(u => ({
            start: u.start,
            end: u.end,
            text: u.text,
            speaker: u.speaker,
            id: u.id
          })) || [],
          text: transcriptData.text || ''
        };
        try {
          const approxSize = JSON.stringify(compactData).length;
          logger.debug('[transcriptChunkingService] Compact data prepared', { utterances: compactData.utterances.length, textLen: compactData.text.length, approxJsonBytes: approxSize });
        } catch (_) {}

        const { error: compactError } = await supabase
          .from('transcripts')
          .update({ 
            edited_transcript_data: compactData,
            updated_at: new Date().toISOString()
          })
          .eq('episode_slug', episodeSlug)
          .eq('lang', lang);

        if (compactError) {
          logger.warn('[transcriptChunkingService] Failed to save compact data', { error: compactError.message });
        } else {
          logger.info('[transcriptChunkingService] Compact data saved successfully');
        }
      } catch (error) {
        logger.warn('[transcriptChunkingService] Error saving compact data', { error: error.message });
      }
    }

    // 2. Если не требуется сохранять полные данные, завершаем
    if (!saveFullData) {
      logger.info('[transcriptChunkingService] Full data saving skipped');
      return { success: true, chunksSaved: 0 };
    }

    // 3. Разбиваем на чанки и сохраняем
    // Текстовые чанки отключены для экономии места — текст можно восстановить из utterances
    const textChunks = [];
    const utteranceChunksRaw = chunkUtterances(transcriptData.utterances || [], maxChunkSize);
    // Очищаем тяжелые поля (words и любые лишние) в utterances перед сохранением
    const utteranceChunks = utteranceChunksRaw.map((chunk) => ({
      utterances: (chunk.utterances || []).map((u) => ({
        start: u.start,
        end: u.end,
        text: u.text,
        speaker: u.speaker,
        id: u.id
      })),
      totalTextLength: chunk.totalTextLength,
      startTime: chunk.startTime,
      endTime: chunk.endTime
    }));

    logger.info('[transcriptChunkingService] Chunks created', { 
      textChunks: textChunks.length, 
      utteranceChunks: utteranceChunks.length,
      firstUtterChunkSize: utteranceChunks[0]?.utterances?.length || 0
    });

    // Проверяем лимит чанков
    const totalChunks = textChunks.length + utteranceChunks.length;
    if (totalChunks > maxChunks) {
      logger.warn('[transcriptChunkingService] Too many chunks, truncating', { 
        totalChunks, 
        maxChunks 
      });
    }

    // Текстовые чанки не сохраняем
    let chunksSaved = 0;

    // Сохраняем чанки utterances
    for (let i = 0; i < Math.min(utteranceChunks.length, maxChunks / 2); i++) {
      const chunk = utteranceChunks[i];
      try {
        logger.debug('[transcriptChunkingService] Saving utterance chunk', { chunkIndex: i, utterances: chunk.utterances?.length || 0, totalTextLength: chunk.totalTextLength });
        const { error: chunkError } = await supabase
          .from('transcript_chunks')
          .upsert({
            episode_slug: episodeSlug,
            lang: lang,
            chunk_type: 'utterances',
            chunk_index: i,
            chunk_data: {
              utterances: chunk.utterances,
              startTime: chunk.startTime,
              endTime: chunk.endTime,
              totalTextLength: chunk.totalTextLength
            },
            created_at: new Date().toISOString()
          }, { 
            onConflict: 'episode_slug,lang,chunk_type,chunk_index' 
          });

        if (chunkError) {
          logger.warn('[transcriptChunkingService] Failed to save utterance chunk', { 
            chunkIndex: i, 
            error: chunkError.message 
          });
        } else {
          chunksSaved++;
          logger.debug('[transcriptChunkingService] Utterance chunk saved', { chunkIndex: i });
        }
      } catch (error) {
        logger.warn('[transcriptChunkingService] Error saving utterance chunk', { 
          chunkIndex: i, 
          error: error.message 
        });
      }
    }

    // 4. Сохраняем метаданные о чанках
    try {
      const { error: metadataError } = await supabase
        .from('transcripts')
        .update({ 
          chunking_metadata: {
            totalChunks: chunksSaved,
            textChunks: 0,
            utteranceChunks: utteranceChunks.length,
            chunkSize: maxChunkSize,
            chunkedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('episode_slug', episodeSlug)
        .eq('lang', lang);

      if (metadataError) {
        logger.warn('[transcriptChunkingService] Failed to save chunking metadata', { error: metadataError.message });
      } else {
        logger.info('[transcriptChunkingService] Chunking metadata saved', { episodeSlug, lang, chunksSaved });
      }
    } catch (error) {
      logger.warn('[transcriptChunkingService] Error saving chunking metadata', { error: error.message });
    }

    logger.info('[transcriptChunkingService] Chunked save completed', { chunksSaved });
    return { success: true, chunksSaved };

  } catch (error) {
    logger.error('[transcriptChunkingService] Fatal error during chunked save', { 
      episodeSlug, 
      lang, 
      error: error.message 
    });
    return { success: false, error: error.message };
  }
};

/**
 * Восстанавливает полную транскрипцию из чанков
 */
export const reconstructTranscriptFromChunks = async (episodeSlug, lang) => {
  try {
    // Получаем все чанки для эпизода
    const { data: chunks, error: chunksError } = await supabase
      .from('transcript_chunks')
      .select('*')
      .eq('episode_slug', episodeSlug)
      .eq('lang', lang)
      .order('chunk_type')
      .order('chunk_index');

    if (chunksError) {
      throw new Error(`Failed to fetch chunks: ${chunksError.message}`);
    }

    if (!chunks || chunks.length === 0) {
      return null;
    }
    logger.info('[transcriptChunkingService] Reconstruct: chunks fetched', { episodeSlug, lang, count: chunks.length });

    // Восстанавливаем текст (если нет текстовых чанков — собираем из utterances)
    const textChunks = chunks
      .filter(c => c.chunk_type === 'text')
      .sort((a, b) => a.chunk_index - b.chunk_index);

    let fullText = '';
    if (textChunks.length > 0) {
      for (const chunk of textChunks) {
        fullText += chunk.chunk_data.text;
      }
    }

    // Восстанавливаем utterances
    const utteranceChunks = chunks
      .filter(c => c.chunk_type === 'utterances')
      .sort((a, b) => a.chunk_index - b.chunk_index);

    const allUtterances = [];
    for (const chunk of utteranceChunks) {
      allUtterances.push(...chunk.chunk_data.utterances);
    }

    // Сортируем utterances по времени
    allUtterances.sort((a, b) => a.start - b.start);
    logger.debug('[transcriptChunkingService] Reconstruct: utterances assembled', { utterances: allUtterances.length, hasTextChunks: textChunks.length > 0 });

    return {
      text: fullText || allUtterances.map(u => u.text).join(' '),
      utterances: allUtterances,
      reconstructed: true,
      chunkCount: chunks.length
    };

  } catch (error) {
    logger.error('[transcriptChunkingService] Error reconstructing transcript', { 
      episodeSlug, 
      lang, 
      error: error.message 
    });
    return null;
  }
};

/**
 * Очищает чанки для эпизода
 */
export const clearTranscriptChunks = async (episodeSlug, lang) => {
  try {
    const { error: deleteError } = await supabase
      .from('transcript_chunks')
      .delete()
      .eq('episode_slug', episodeSlug)
      .eq('lang', lang);

    if (deleteError) {
      logger.warn('[transcriptChunkingService] Failed to clear chunks', { error: deleteError.message });
      return false;
    }

    logger.info('[transcriptChunkingService] Chunks cleared successfully', { episodeSlug, lang });
    return true;

  } catch (error) {
    logger.error('[transcriptChunkingService] Error clearing chunks', { 
      episodeSlug, 
      lang, 
      error: error.message 
    });
    return false;
  }
};
