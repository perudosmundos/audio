import offlineDataService from './offlineDataService';
import logger from './logger';

class EnhancedCacheService {
  constructor() {
    this.cacheStrategies = {
      'transcript': { ttl: 24 * 60 * 60 * 1000, maxSize: 50 }, // 24 часа, до 50 транскриптов
      'questions': { ttl: 12 * 60 * 60 * 1000, maxSize: 100 }, // 12 часов, до 100 наборов вопросов
      'episodes': { ttl: 6 * 60 * 60 * 1000, maxSize: 200 }, // 6 часов, до 200 эпизодов
      'audio_metadata': { ttl: 7 * 24 * 60 * 60 * 1000, maxSize: 500 } // 7 дней, до 500 метаданных
    };
  }

  // Интеграция с localStorage кешом транскриптов
  migrateExistingTranscriptCache = async () => {
    try {
      await offlineDataService.init();
      
      // Получаем все ключи localStorage с транскриптами
      const transcriptKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('transcript:')) {
          transcriptKeys.push(key);
        }
      }

      logger.debug(`[EnhancedCache] Found ${transcriptKeys.length} transcript cache entries to migrate`);

      for (const key of transcriptKeys) {
        try {
          const data = localStorage.getItem(key);
          if (!data) continue;

          const parsed = JSON.parse(data);
          if (!parsed?.meta || !parsed?.data) continue;

          // Извлекаем episodeSlug и lang из ключа
          const keyParts = key.replace('transcript:', '').split(':');
          if (keyParts.length < 2) continue;

          const episodeSlug = keyParts[0];
          const lang = keyParts[1];

          // Создаем запись в IndexedDB
          const transcriptData = {
            id: parsed.meta.id,
            episode_slug: episodeSlug,
            lang: lang,
            status: parsed.meta.status,
                    edited_transcript_data: parsed.data,
            cached_at: parsed.cachedAt || Date.now(),
            last_updated: Date.now()
          };

          await offlineDataService.saveTranscript(transcriptData);
          console.log(`[EnhancedCache] Migrated transcript cache for ${episodeSlug}:${lang}`);
        } catch (error) {
          logger.error(`[EnhancedCache] Failed to migrate cache entry ${key}:`, error);
        }
      }
    } catch (error) {
      logger.error('[EnhancedCache] Migration failed:', error);
    }
  };

  // Умное кеширование с приоритетами
  async smartCache(type, key, data, priority = 'normal') {
    try {
      await offlineDataService.init();
      
      const strategy = this.cacheStrategies[type];
      if (!strategy) {
        logger.warn(`[EnhancedCache] No strategy for type: ${type}`);
        return false;
      }

      // Проверяем размер кеша и очищаем при необходимости
      await this.manageCacheSize(type, strategy);

      // Добавляем метаданные приоритета и стратегии
      const enhancedData = {
        ...data,
        cache_metadata: {
          type,
          key,
          priority,
          cached_at: Date.now(),
          ttl: strategy.ttl,
          access_count: 1,
          last_accessed: Date.now()
        }
      };

      // Сохраняем в соответствующее хранилище
      switch (type) {
        case 'transcript':
          await offlineDataService.saveTranscript(enhancedData);
          break;
        case 'questions':
          if (data.questions && data.episodeSlug && data.lang) {
            await offlineDataService.saveQuestions(data.questions, data.episodeSlug, data.lang);
          }
          break;
        case 'episodes':
          await offlineDataService.saveEpisode(enhancedData);
          break;
        default:
          logger.warn(`[EnhancedCache] Unsupported cache type: ${type}`);
          return false;
      }

      logger.debug(`[EnhancedCache] Cached ${type}:${key} with priority ${priority}`);
      return true;
    } catch (error) {
      logger.error(`[EnhancedCache] Failed to cache ${type}:${key}:`, error);
      return false;
    }
  }

  // Получение из кеша с обновлением статистики
  async smartGet(type, key, updateAccess = true) {
    try {
      await offlineDataService.init();
      
      let cachedData = null;

      // Получаем данные в зависимости от типа
      switch (type) {
        case 'transcript':
          const [episodeSlug, lang] = key.split(':');
          cachedData = await offlineDataService.getTranscript(episodeSlug, lang);
          break;
        case 'questions':
          const [qEpisodeSlug, qLang] = key.split(':');
          cachedData = await offlineDataService.getQuestions(qEpisodeSlug, qLang);
          break;
        case 'episodes':
          cachedData = await offlineDataService.getEpisode(key);
          break;
        default:
          logger.warn(`[EnhancedCache] Unsupported get type: ${type}`);
          return null;
      }

      if (!cachedData) return null;

      // Проверяем TTL
      const metadata = cachedData.cache_metadata;
      if (metadata && metadata.ttl) {
        const isExpired = Date.now() - metadata.cached_at > metadata.ttl;
        if (isExpired) {
          logger.debug(`[EnhancedCache] Cache expired for ${type}:${key}`);
          return null;
        }
      }

      // Обновляем статистику доступа
      if (updateAccess && metadata) {
        metadata.access_count = (metadata.access_count || 0) + 1;
        metadata.last_accessed = Date.now();
        
        // Сохраняем обновленную статистику
        await this.smartCache(type, key, cachedData, metadata.priority);
      }

      console.log(`[EnhancedCache] Cache hit for ${type}:${key}`);
      return cachedData;
    } catch (error) {
      logger.error(`[EnhancedCache] Failed to get ${type}:${key}:`, error);
      return null;
    }
  }

  // Управление размером кеша
  async manageCacheSize(type, strategy) {
    try {
      const transaction = offlineDataService.getTransaction([this.getStoreName(type)]);
      const store = transaction.objectStore(this.getStoreName(type));
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = async () => {
          const items = request.result;
          
          if (items.length <= strategy.maxSize) {
            resolve();
            return;
          }

          logger.debug(`[EnhancedCache] Cache size exceeded for ${type}, cleaning up...`);
          
          // Сортируем по приоритету и времени последнего доступа
          const sortedItems = items
            .filter(item => item.cache_metadata)
            .sort((a, b) => {
              const aPriority = this.getPriorityWeight(a.cache_metadata.priority);
              const bPriority = this.getPriorityWeight(b.cache_metadata.priority);
              
              if (aPriority !== bPriority) {
                return aPriority - bPriority; // Низкий приоритет удаляется первым
              }
              
              // При одинаковом приоритете удаляем менее используемые
              const aScore = (a.cache_metadata.access_count || 0) / 
                           Math.max(1, Date.now() - a.cache_metadata.last_accessed);
              const bScore = (b.cache_metadata.access_count || 0) / 
                           Math.max(1, Date.now() - b.cache_metadata.last_accessed);
              
              return aScore - bScore;
            });

          // Удаляем элементы до достижения целевого размера
          const targetSize = Math.floor(strategy.maxSize * 0.8); // Удаляем до 80% от максимума
          const itemsToDelete = sortedItems.slice(0, items.length - targetSize);
          
          const deleteTransaction = offlineDataService.getTransaction([this.getStoreName(type)], 'readwrite');
          const deleteStore = deleteTransaction.objectStore(this.getStoreName(type));
          
          for (const item of itemsToDelete) {
            const key = this.getItemKey(type, item);
            if (key) {
              deleteStore.delete(key);
            }
          }
          
          logger.debug(`[EnhancedCache] Removed ${itemsToDelete.length} items from ${type} cache`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error(`[EnhancedCache] Failed to manage cache size for ${type}:`, error);
    }
  }

  // Получение имени хранилища для типа
  getStoreName(type) {
    const storeMap = {
      'transcript': 'transcripts',
      'questions': 'questions',
      'episodes': 'episodes',
      'audio_metadata': 'audioFiles'
    };
    return storeMap[type] || type;
  }

  // Получение ключа элемента
  getItemKey(type, item) {
    switch (type) {
      case 'transcript':
        return item.id;
      case 'questions':
        return item.id;
      case 'episodes':
        return item.slug;
      case 'audio_metadata':
        return item.url;
      default:
        return item.id || item.key;
    }
  }

  // Получение веса приоритета
  getPriorityWeight(priority) {
    const weights = {
      'low': 1,
      'normal': 2,
      'high': 3,
      'critical': 4
    };
    return weights[priority] || 2;
  }

  // Предварительная загрузка популярных данных
  async preloadPopularContent(episodesList, currentLanguage) {
    try {
      logger.debug('[EnhancedCache] Starting preload of popular content...');
      
      // Сортируем эпизоды по дате (новые сначала) и берем первые 10
      const recentEpisodes = episodesList
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

      for (const episode of recentEpisodes) {
        // Кешируем эпизод с высоким приоритетом
        await this.smartCache('episodes', episode.slug, episode, 'high');
        
        // Пытаемся предзагрузить транскрипт и вопросы
        try {
          // Определяем язык для транскрипта
          const transcriptLang = episode.lang === 'all' ? currentLanguage : episode.lang;
          
          // Проверяем, есть ли уже в кеше
          const cachedTranscript = await this.smartGet('transcript', `${episode.slug}:${transcriptLang}`, false);
          const cachedQuestions = await this.smartGet('questions', `${episode.slug}:${currentLanguage}`, false);
          
          if (!cachedTranscript) {
            logger.debug(`[EnhancedCache] Transcript not cached for ${episode.slug}, will load on demand`);
          }
          
          if (!cachedQuestions) {
            logger.debug(`[EnhancedCache] Questions not cached for ${episode.slug}, will load on demand`);
          }
        } catch (error) {
          logger.error(`[EnhancedCache] Failed to preload content for ${episode.slug}:`, error);
        }
      }
      
      logger.debug(`[EnhancedCache] Preload completed for ${recentEpisodes.length} episodes`);
    } catch (error) {
      logger.error('[EnhancedCache] Preload failed:', error);
    }
  }

  // Очистка устаревших данных
  async cleanExpiredCache() {
    try {
      logger.debug('[EnhancedCache] Starting cleanup of expired cache...');
      
      for (const [type, strategy] of Object.entries(this.cacheStrategies)) {
        const storeName = this.getStoreName(type);
        const transaction = offlineDataService.getTransaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => {
            const items = request.result;
            let expiredCount = 0;
            
            items.forEach(item => {
              const metadata = item.cache_metadata;
              if (metadata && metadata.ttl) {
                const isExpired = Date.now() - metadata.cached_at > metadata.ttl;
                if (isExpired) {
                  const key = this.getItemKey(type, item);
                  if (key) {
                    store.delete(key);
                    expiredCount++;
                  }
                }
              }
            });
            
            if (expiredCount > 0) {
              logger.debug(`[EnhancedCache] Cleaned ${expiredCount} expired items from ${type} cache`);
            }
            resolve();
          };
          request.onerror = () => reject(request.error);
        });
      }
      
      logger.debug('[EnhancedCache] Cleanup completed');
    } catch (error) {
      logger.error('[EnhancedCache] Cleanup failed:', error);
    }
  }

  // Получение статистики кеша
  async getCacheStats() {
    try {
      await offlineDataService.init();
      const stats = {};
      
      for (const [type, strategy] of Object.entries(this.cacheStrategies)) {
        const storeName = this.getStoreName(type);
        const transaction = offlineDataService.getTransaction([storeName]);
        const store = transaction.objectStore(storeName);
        
        const typeStats = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => {
            const items = request.result;
            const now = Date.now();
            
            let totalSize = 0;
            let expiredCount = 0;
            let accessCount = 0;
            
            items.forEach(item => {
              totalSize += this.estimateItemSize(item);
              
              const metadata = item.cache_metadata;
              if (metadata) {
                accessCount += metadata.access_count || 0;
                
                if (metadata.ttl && now - metadata.cached_at > metadata.ttl) {
                  expiredCount++;
                }
              }
            });
            
            resolve({
              itemCount: items.length,
              maxItems: strategy.maxSize,
              expiredCount,
              totalAccessCount: accessCount,
              estimatedSize: totalSize,
              utilizationPercent: Math.round((items.length / strategy.maxSize) * 100)
            });
          };
          request.onerror = () => reject(request.error);
        });
        
        stats[type] = typeStats;
      }
      
      return stats;
    } catch (error) {
      logger.error('[EnhancedCache] Failed to get cache stats:', error);
      return {};
    }
  }

  // Оценка размера элемента
  estimateItemSize(item) {
    try {
      return JSON.stringify(item).length;
    } catch {
      return 1000; // Примерная оценка
    }
  }

  // Инициализация с миграцией существующего кеша
  async init() {
    try {
      await offlineDataService.init();
      
      // Мигрируем существующий кеш транскриптов
      await this.migrateExistingTranscriptCache();
      
      // Очищаем устаревшие данные
      await this.cleanExpiredCache();
      
      logger.debug('[EnhancedCache] Initialized successfully');
    } catch (error) {
      logger.error('[EnhancedCache] Initialization failed:', error);
    }
  }
}

// Создаем единственный экземпляр сервиса
const enhancedCacheService = new EnhancedCacheService();

export default enhancedCacheService;

