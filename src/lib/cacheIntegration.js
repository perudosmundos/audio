import optimizedCacheService from './optimizedCacheService';
import logger from './logger';

// Интеграция оптимизированной системы кэша в приложение
class CacheIntegration {
  constructor() {
    this.isInitialized = false;
  }

  // Инициализация системы кэша
  async init() {
    if (this.isInitialized) return;
    
    try {
      await optimizedCacheService.init();
      this.isInitialized = true;
      logger.debug('[CacheIntegration] Cache system initialized');
      
      // Запускаем периодическую очистку устаревших данных
      this.startPeriodicCleanup();
    } catch (error) {
      logger.error('[CacheIntegration] Initialization failed:', error);
    }
  }

  // Периодическая очистка устаревших данных
  startPeriodicCleanup() {
    // Очищаем каждые 30 минут
    setInterval(async () => {
      try {
        await optimizedCacheService.cleanExpiredCache();
        logger.debug('[CacheIntegration] Periodic cleanup completed');
      } catch (error) {
        logger.error('[CacheIntegration] Periodic cleanup failed:', error);
      }
    }, 30 * 60 * 1000); // 30 минут
  }

  // Получение статистики кэша
  async getStats() {
    try {
      return await optimizedCacheService.getCacheStats();
    } catch (error) {
      logger.error('[CacheIntegration] Failed to get cache stats:', error);
      return {};
    }
  }

  // Очистка всего кэша
  async clearAll() {
    try {
      // Очищаем пользовательские данные
      optimizedCacheService.userInteractionData.clear();
      
      // Очищаем очереди
      optimizedCacheService.backgroundQueue = [];
      optimizedCacheService.loadingPromises.clear();
      
      logger.debug('[CacheIntegration] Cache cleared');
    } catch (error) {
      logger.error('[CacheIntegration] Failed to clear cache:', error);
    }
  }

  // Оптимизированная загрузка данных для страницы эпизодов
  async loadEpisodesPageData(currentLanguage) {
    try {
      // Сначала пытаемся загрузить из кэша
      const cachedEpisodes = await optimizedCacheService.smartGet('episodes', 'all');
      
      if (cachedEpisodes && cachedEpisodes.length > 0) {
        logger.debug('[CacheIntegration] Using cached episodes data');
        return {
          episodes: cachedEpisodes.filter(ep => ep.lang === currentLanguage || ep.lang === 'all'),
          fromCache: true
        };
      }

      // Если кэша нет, возвращаем null для загрузки свежих данных
      return null;
    } catch (error) {
      logger.error('[CacheIntegration] Failed to load episodes data:', error);
      return null;
    }
  }

  // Сохранение данных страницы эпизодов в кэш
  async saveEpisodesPageData(episodesData, questionsData) {
    try {
      // Сохраняем эпизоды
      for (const episode of episodesData) {
        await optimizedCacheService.smartCache('episodes', episode.slug, episode, 'critical');
      }
      
      // Сохраняем полный список эпизодов
      await optimizedCacheService.smartCache('episodes', 'all', episodesData, 'critical');

      // Сохраняем вопросы
      if (questionsData) {
        const questionsByEpisode = {};
        questionsData.forEach(q => {
          if (!questionsByEpisode[q.episode_slug]) {
            questionsByEpisode[q.episode_slug] = {};
          }
          if (!questionsByEpisode[q.episode_slug][q.lang]) {
            questionsByEpisode[q.episode_slug][q.lang] = [];
          }
          questionsByEpisode[q.episode_slug][q.lang].push(q);
        });
        
        for (const [episodeSlug, langs] of Object.entries(questionsByEpisode)) {
          for (const [lang, questions] of Object.entries(langs)) {
            await optimizedCacheService.smartCache('questions', `${episodeSlug}:${lang}`, { questions, episodeSlug, lang }, 'high');
          }
        }
      }

      logger.debug('[CacheIntegration] Episodes page data saved to cache');
    } catch (error) {
      logger.error('[CacheIntegration] Failed to save episodes data:', error);
    }
  }

  // Загрузка данных для страницы плеера
  async loadPlayerPageData(episodeSlug, currentLanguage) {
    try {
      const results = {};
      
      // Загружаем данные эпизода
      results.episode = await optimizedCacheService.smartGet('episodes', episodeSlug);
      
      // Загружаем вопросы
      results.questions = await optimizedCacheService.smartGet('questions', `${episodeSlug}:${currentLanguage}`);
      
      // Загружаем транскрипт
      const transcriptLang = results.episode?.lang === 'all' ? currentLanguage : results.episode?.lang;
      results.transcript = await optimizedCacheService.smartGet('transcript', `${episodeSlug}:${transcriptLang}`);

      // Отмечаем взаимодействие пользователя с этими данными
      if (results.episode) {
        await optimizedCacheService.smartCache('episodes', episodeSlug, results.episode, 'critical', true);
      }

      logger.debug('[CacheIntegration] Player page data loaded from cache');
      return results;
    } catch (error) {
      logger.error('[CacheIntegration] Failed to load player data:', error);
      return {};
    }
  }

  // Сохранение данных страницы плеера в кэш
  async savePlayerPageData(episodeData, questionsData, transcriptData, currentLanguage) {
    try {
      if (episodeData) {
        await optimizedCacheService.smartCache('episodes', episodeData.slug, episodeData, 'critical', true);
      }
      
      if (questionsData) {
        const transcriptLang = episodeData?.lang === 'all' ? currentLanguage : episodeData?.lang;
        await optimizedCacheService.smartCache('questions', `${episodeData.slug}:${currentLanguage}`, { 
          questions: questionsData, 
          episodeSlug: episodeData.slug, 
          lang: currentLanguage 
        }, 'high', true);
      }
      
      if (transcriptData) {
        const transcriptLang = episodeData?.lang === 'all' ? currentLanguage : episodeData?.lang;
        await optimizedCacheService.smartCache('transcript', `${episodeData.slug}:${transcriptLang}`, transcriptData, 'high', true);
      }

      logger.debug('[CacheIntegration] Player page data saved to cache');
    } catch (error) {
      logger.error('[CacheIntegration] Failed to save player data:', error);
    }
  }

  // Предварительная загрузка данных для улучшения UX
  async preloadDataForUX(episodesList, currentLanguage) {
    try {
      // Предзагружаем данные для последних 3 эпизодов
      const recentEpisodes = episodesList.slice(0, 3);
      
      for (const episode of recentEpisodes) {
        // Добавляем в очередь фоновой загрузки
        const transcriptLang = episode.lang === 'all' ? currentLanguage : episode.lang;
        optimizedCacheService.addToBackgroundQueue('transcript', `${episode.slug}:${transcriptLang}`, 'low');
        optimizedCacheService.addToBackgroundQueue('questions', `${episode.slug}:${currentLanguage}`, 'low');
      }

      logger.debug(`[CacheIntegration] Preloaded data for ${recentEpisodes.length} episodes`);
    } catch (error) {
      logger.error('[CacheIntegration] Preload failed:', error);
    }
  }
}

// Создаем единственный экземпляр
const cacheIntegration = new CacheIntegration();

export default cacheIntegration;
