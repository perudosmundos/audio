import { supabase } from './supabaseClient';
import logger from './logger';

/**
 * Сервис для работы с таблицей timeOld
 * Извлечение вопросов из колонок timings_es и timings_ru
 */
export const timeOldService = {
  /**
   * Проверка наличия данных в таблице timeOld для эпизода
   */
  async hasTimingsData(episodeSlug, language) {
    try {
      const columnName = `timings_${language}`;

      const { data, error } = await supabase
        .from('timeOld')
        .select(columnName)
        .eq('date', episodeSlug)
        .maybeSingle();

      if (error) {
        logger.error('Error checking timings data:', error);
        return false;
      }

      const timingsData = data?.[columnName];
      const hasData = timingsData &&
                     Array.isArray(timingsData) &&
                     timingsData.length > 0;

      logger.debug(`Timings data check for ${episodeSlug}-${language}:`, {
        hasData,
        dataLength: timingsData?.length || 0
      });

      return hasData;
    } catch (error) {
      logger.error('Error in hasTimingsData:', error);
      return false;
    }
  },

  /**
   * Извлечение вопросов из таблицы timeOld
   */
  async extractQuestionsFromTimeOld(episodeSlug, language) {
    try {
      const columnName = `timings_${language}`;

      const { data, error } = await supabase
        .from('timeOld')
        .select(columnName)
        .eq('date', episodeSlug)
        .maybeSingle();

      if (error) {
        throw new Error(`Error fetching timings data: ${error.message}`);
      }

      const timingsData = data?.[columnName];

      if (!timingsData || !Array.isArray(timingsData) || timingsData.length === 0) {
        logger.warn(`No timings data found for ${episodeSlug}-${language}`);
        return [];
      }

      // Парсинг данных в формате "время текст"
      const questions = timingsData
        .map((timing, index) => {
          if (!timing || typeof timing !== 'string') {
            logger.warn(`Invalid timing data at index ${index}:`, timing);
            return null;
          }

          // Парсим формат "0:01:02 Destino, servicio"
          const timeMatch = timing.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(.+)$/);

          if (!timeMatch) {
            logger.warn(`Invalid timing format at index ${index}:`, timing);
            return null;
          }

          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseInt(timeMatch[3]);
          const title = timeMatch[4].trim();

          // Конвертируем в секунды
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;

          return {
            title: title || `Вопрос ${index + 1}`,
            time: totalSeconds
          };
        })
        .filter(Boolean); // Убираем null значения

      logger.info(`Extracted ${questions.length} questions from timeOld for ${episodeSlug}-${language}`);

      return questions;
    } catch (error) {
      logger.error('Error extracting questions from timeOld:', error);
      throw error;
    }
  },

  /**
   * Сохранение извлеченных вопросов в таблицу questions
   */
  async saveQuestionsToDatabase(episodeSlug, language, questions) {
    try {
      if (!questions || questions.length === 0) {
        throw new Error('No questions to save');
      }

      // Удаляем существующие вопросы для этого эпизода и языка
      await supabase
        .from('questions')
        .delete()
        .eq('episode_slug', episodeSlug)
        .eq('lang', language);

      // Подготавливаем данные для вставки
      const questionsToInsert = questions.map((q, index) => ({
        episode_slug: episodeSlug,
        lang: language,
        title: q.title,
        time: Number.isFinite(q.time) ? q.time : index * 10
      }));

      // Вставляем новые вопросы
      const { data, error } = await supabase
        .from('questions')
        .insert(questionsToInsert)
        .select();

      if (error) {
        throw new Error(`Error saving questions: ${error.message}`);
      }

      logger.info(`Saved ${questionsToInsert.length} questions to database for ${episodeSlug}-${language}`);

      return data;
    } catch (error) {
      logger.error('Error saving questions to database:', error);
      throw error;
    }
  },

  /**
   * Полная процедура извлечения и сохранения вопросов
   */
  async loadQuestionsFromTimeOld(episodeSlug, language) {
    try {
      logger.info(`Starting question extraction from timeOld for ${episodeSlug}-${language}`);

      // 1. Извлекаем вопросы из timeOld
      const questions = await this.extractQuestionsFromTimeOld(episodeSlug, language);

      if (questions.length === 0) {
        throw new Error('No questions found in timeOld data');
      }

      // 2. Сохраняем в таблицу questions
      await this.saveQuestionsToDatabase(episodeSlug, language, questions);

      logger.info(`Successfully loaded ${questions.length} questions from timeOld for ${episodeSlug}-${language}`);

      return questions;
    } catch (error) {
      logger.error('Error in loadQuestionsFromTimeOld:', error);
      throw error;
    }
  }
};

export default timeOldService;
