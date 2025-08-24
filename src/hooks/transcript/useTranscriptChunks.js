import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { reconstructTranscriptFromChunks, clearTranscriptChunks } from '@/lib/transcriptChunkingService';
import logger from '@/lib/logger';

/**
 * Хук для работы с чанкованными транскрипциями
 */
export const useTranscriptChunks = (episodeSlug, lang) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chunkedTranscript, setChunkedTranscript] = useState(null);
  const [chunksInfo, setChunksInfo] = useState(null);

  // Получение информации о чанках
  const fetchChunksInfo = useCallback(async () => {
    if (!episodeSlug || !lang) return;

    try {
      setIsLoading(true);
      setError(null);

      // Получаем метаданные о чанковании
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .select('chunking_metadata')
        .eq('episode_slug', episodeSlug)
        .eq('lang', lang)
        .single();

      if (transcriptError && transcriptError.code !== 'PGRST116') {
        throw transcriptError;
      }

      if (transcriptData?.chunking_metadata) {
        setChunksInfo(transcriptData.chunking_metadata);
      }

      // Получаем сводку по чанкам
      const { data: chunksSummary, error: summaryError } = await supabase
        .from('transcript_chunks_summary')
        .select('*')
        .eq('episode_slug', episodeSlug)
        .eq('lang', lang)
        .single();

      if (summaryError && summaryError.code !== 'PGRST116') {
        logger.warn('[useTranscriptChunks] Could not fetch chunks summary:', summaryError.message);
      } else if (chunksSummary) {
        setChunksInfo(prev => ({
          ...prev,
          summary: chunksSummary
        }));
      }

    } catch (err) {
      setError(err.message);
      logger.error('[useTranscriptChunks] Error fetching chunks info:', err);
    } finally {
      setIsLoading(false);
    }
  }, [episodeSlug, lang]);

  // Восстановление полной транскрипции из чанков
  const reconstructTranscript = useCallback(async () => {
    if (!episodeSlug || !lang) return;

    try {
      setIsLoading(true);
      setError(null);

      const reconstructed = await reconstructTranscriptFromChunks(episodeSlug, lang);
      
      if (reconstructed) {
        setChunkedTranscript(reconstructed);
        logger.info('[useTranscriptChunks] Transcript reconstructed successfully', {
          episodeSlug,
          lang,
          chunkCount: reconstructed.chunkCount
        });
      } else {
        setChunkedTranscript(null);
        logger.info('[useTranscriptChunks] No chunks found for transcript', { episodeSlug, lang });
      }

    } catch (err) {
      setError(err.message);
      logger.error('[useTranscriptChunks] Error reconstructing transcript:', err);
    } finally {
      setIsLoading(false);
    }
  }, [episodeSlug, lang]);

  // Очистка чанков
  const clearChunks = useCallback(async () => {
    if (!episodeSlug || !lang) return;

    try {
      setIsLoading(true);
      setError(null);

      const success = await clearTranscriptChunks(episodeSlug, lang);
      
      if (success) {
        setChunkedTranscript(null);
        setChunksInfo(null);
        logger.info('[useTranscriptChunks] Chunks cleared successfully', { episodeSlug, lang });
      } else {
        throw new Error('Failed to clear chunks');
      }

    } catch (err) {
      setError(err.message);
      logger.error('[useTranscriptChunks] Error clearing chunks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [episodeSlug, lang]);

  // Проверка, есть ли чанки для транскрипции
  const hasChunks = useCallback(() => {
    return chunksInfo && chunksInfo.totalChunks > 0;
  }, [chunksInfo]);

  // Получение размера чанков в читаемом формате
  const getChunksSizeInfo = useCallback(() => {
    if (!chunksInfo) return null;

    const totalChunks = chunksInfo.totalChunks || 0;
    const textChunks = chunksInfo.textChunks || 0;
    const utteranceChunks = chunksInfo.utteranceChunks || 0;
    const chunkSize = chunksInfo.chunkSize || 0;

    return {
      totalChunks,
      textChunks,
      utteranceChunks,
      chunkSizeKB: Math.round(chunkSize / 1024),
      estimatedTotalSizeMB: Math.round((totalChunks * chunkSize) / (1024 * 1024) * 100) / 100
    };
  }, [chunksInfo]);

  // Автоматическая загрузка информации о чанках при изменении параметров
  useEffect(() => {
    if (episodeSlug && lang) {
      fetchChunksInfo();
    }
  }, [episodeSlug, lang, fetchChunksInfo]);

  return {
    // Состояние
    isLoading,
    error,
    chunkedTranscript,
    chunksInfo,
    
    // Методы
    fetchChunksInfo,
    reconstructTranscript,
    clearChunks,
    
    // Утилиты
    hasChunks: hasChunks(),
    getChunksSizeInfo: getChunksSizeInfo(),
    
    // Сброс ошибки
    clearError: () => setError(null)
  };
};

/**
 * Хук для получения списка всех чанкованных транскрипций
 */
export const useAllTranscriptChunks = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chunkedTranscripts, setChunkedTranscripts] = useState([]);

  const fetchAllChunkedTranscripts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Получаем все транскрипции с метаданными о чанковании
      const { data: transcripts, error: transcriptsError } = await supabase
        .from('transcripts')
        .select(`
          episode_slug,
          lang,
          chunking_metadata,
          updated_at
        `)
        .not('chunking_metadata', 'is', null);

      if (transcriptsError) {
        throw transcriptsError;
      }

      // Фильтруем только те, у которых есть чанки
      const withChunks = transcripts.filter(t => 
        t.chunking_metadata && 
        t.chunking_metadata.totalChunks > 0
      );

      setChunkedTranscripts(withChunks);

    } catch (err) {
      setError(err.message);
      logger.error('[useAllTranscriptChunks] Error fetching chunked transcripts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Получение статистики по всем чанкованным транскрипциям
  const getStatistics = useCallback(() => {
    if (chunkedTranscripts.length === 0) return null;

    const totalTranscripts = chunkedTranscripts.length;
    const totalChunks = chunkedTranscripts.reduce((sum, t) => 
      sum + (t.chunking_metadata?.totalChunks || 0), 0
    );
    const totalSizeMB = chunkedTranscripts.reduce((sum, t) => {
      const chunkSize = t.chunking_metadata?.chunkSize || 0;
      const totalChunks = t.chunking_metadata?.totalChunks || 0;
      return sum + (totalChunks * chunkSize) / (1024 * 1024);
    }, 0);

    return {
      totalTranscripts,
      totalChunks,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      averageChunksPerTranscript: Math.round((totalChunks / totalTranscripts) * 100) / 100
    };
  }, [chunkedTranscripts]);

  return {
    isLoading,
    error,
    chunkedTranscripts,
    fetchAllChunkedTranscripts,
    getStatistics: getStatistics(),
    clearError: () => setError(null)
  };
};
