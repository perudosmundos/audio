import { supabase } from '@/lib/supabaseClient';
import { parseQuestionsFromDescriptionString } from '@/lib/podcastService';

class TimeOldService {
  /**
   * Загружает вопросы из timeOld таблицы для указанной даты и языка
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @param {string} lang - Язык ('es' или 'ru')
   * @returns {Promise<Array>} Массив вопросов
   */
  async loadQuestionsFromTimeOld(date, lang) {
    try {
      const columnToFetch = lang === 'ru' ? 'timings_ru' : 'timings_es';
      
      const { data, error } = await supabase
        .from('timeOld')
        .select(columnToFetch)
        .eq('date', date)
        .maybeSingle();

      if (error) {
        throw new Error(`Ошибка загрузки из timeOld: ${error.message}`);
      }

      if (!data || !data[columnToFetch]) {
        return [];
      }

      // Парсим вопросы из строки таймингов
      const questions = parseQuestionsFromDescriptionString(
        data[columnToFetch],
        lang,
        `${date}_${lang}`
      );

      return questions;
    } catch (error) {
      console.error('Error loading questions from timeOld:', error);
      throw error;
    }
  }

  /**
   * Сохраняет вопросы в таблицу questions
   * @param {Array} questions - Массив вопросов
   * @returns {Promise<boolean>} Успешность операции
   */
  async saveQuestionsToDB(questions) {
    try {
      if (!questions || questions.length === 0) {
        return true;
      }

      const { error } = await supabase
        .from('questions')
        .insert(questions);

      if (error) {
        throw new Error(`Ошибка сохранения вопросов: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error saving questions to DB:', error);
      throw error;
    }
  }

  /**
   * Загружает и сохраняет вопросы для эпизода
   * @param {Object} episode - Данные эпизода
   * @returns {Promise<Object>} Результат операции
   */
  async loadAndSaveQuestionsForEpisode(episode) {
    try {
      const { episodeSlug, lang, parsedDate } = episode;
      
      if (!parsedDate) {
        throw new Error('Дата эпизода не найдена');
      }

      // Загружаем вопросы из timeOld
      const questions = await this.loadQuestionsFromTimeOld(parsedDate, lang);
      
      if (questions.length === 0) {
        return {
          success: true,
          message: 'Вопросы для этой даты не найдены в timeOld',
          questionsCount: 0
        };
      }

      // Обновляем episode_slug для всех вопросов
      const questionsWithSlug = questions.map(q => ({
        ...q,
        episode_slug: episodeSlug
      }));

      // Сохраняем в БД
      await this.saveQuestionsToDB(questionsWithSlug);

      return {
        success: true,
        message: `Загружено ${questions.length} вопросов из timeOld`,
        questionsCount: questions.length
      };
    } catch (error) {
      console.error('Error in loadAndSaveQuestionsForEpisode:', error);
      throw error;
    }
  }

  /**
   * Проверяет, есть ли данные в timeOld для указанной даты
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @returns {Promise<Object>} Информация о наличии данных
   */
  async checkTimeOldData(date) {
    try {
      const { data, error } = await supabase
        .from('timeOld')
        .select('timings_es, timings_ru')
        .eq('date', date)
        .maybeSingle();

      if (error) {
        throw new Error(`Ошибка проверки timeOld: ${error.message}`);
      }

      return {
        hasData: !!data,
        hasSpanish: !!(data?.timings_es),
        hasRussian: !!(data?.timings_ru),
        data: data
      };
    } catch (error) {
      console.error('Error checking timeOld data:', error);
      throw error;
    }
  }
}

export default new TimeOldService();