import offlineDataService from './offlineDataService';
import logger from './logger';

class OptimizedCacheService {
  constructor() {
    this.cacheStrategies = {
      'transcript': { ttl: 24 * 60 * 60 * 1000, maxSize: 50, priority: 'high' },
      'questions': { ttl: 12 * 60 * 60 * 1000, maxSize: 100, priority: 'high' },
      'episodes': { ttl: 6 * 60 * 60 * 1000, maxSize: 200, priority: 'critical' },
      'audio_metadata': { ttl: 7 * 24 * 60 * 60 * 1000, maxSize: 500, priority: 'normal' }
    };
    
    this.priorityWeights = {
      'low': 1,
      'normal': 2,
      'high': 3,
      'critical': 4
    };
    
    this.loadingPromises = new Map(); // Для предотвращения дублирования запросов
    this.backgroundQueue = []; // Очередь для фоновой загрузки
    this.isBackgroundLoading = false;
    this.userInteractionData = new Set(); // Данные, с которыми взаимодействовал пользователь
  }

  // Инициализация с оптимизацией
  async init() {
    try {
      await offlineDataService.init();
      logger.debug('[OptimizedCache] Initialized successfully');
      
      // Запускаем фоновую загрузку
      this.startBackgroundLoading();
    } catch (error) {
      logger.error('[OptimizedCache] Initialization failed:', error);
    }
  }

  // Умное кэширование с приоритетами и оптимизацией
  async smartCache(type, key, data, priority = 'normal', userInteraction = false) {
    try {
      await offlineDataService.init();
      
      const strategy = this.cacheStrategies[type];
      if (!strategy) {
        logger.warn(`[OptimizedCache] No strategy for type: ${type}`);
        return false;
      }

      // Отмечаем данные, с которыми взаимодействовал пользователь
      if (userInteraction) {
        this.userInteractionData.add(`${type}:${key}`);
      }

      // Проверяем, нужно ли обновлять кэш (если данные не изменились)
      const existingData = await this.smartGet(type, key, false);
      if (existingData && this.isDataEqual(existingData, data)) {
        logger.debug(`[OptimizedCache] Skipping cache update - data unchanged for ${type}:${key}`);
        return true;
      }

      // Управляем размером кэша только если мы добавляем новые данные
      await this.manageCacheSize(type, strategy);

      const enhancedData = {
        ...data,
        cache_metadata: {
          type,
          key,
          priority,
          cached_at: Date.now(),
          ttl: strategy.ttl,
          access_count: userInteraction ? 10 : 1, // Повышаем счетчик для пользовательских данных
          last_accessed: Date.now(),
          user_interaction: userInteraction
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
          logger.warn(`[OptimizedCache] Unsupported cache type: ${type}`);
          return false;
      }

      logger.debug(`[OptimizedCache] Cached ${type}:${key} with priority ${priority}`);
      return true;
    } catch (error) {
      logger.error(`[OptimizedCache] Failed to cache ${type}:${key}:`, error);
      return false;
    }
  }

  // Оптимизированное получение с приоритетами и предотвращением дублирования
  async smartGet(type, key, updateAccess = true) {
    // Проверяем, есть ли уже выполняющийся запрос
    const requestKey = `${type}:${key}`;
    if (this.loadingPromises.has(requestKey)) {
      logger.debug(`[OptimizedCache] Returning existing promise for ${requestKey}`);
      return this.loadingPromises.get(requestKey);
    }

    const promise = this._executeSmartGet(type, key, updateAccess);
    this.loadingPromises.set(requestKey, promise);
    
    // Очищаем из карты после завершения
    promise.finally(() => {
      this.loadingPromises.delete(requestKey);
    });

    return promise;
  }

  async _executeSmartGet(type, key, updateAccess = true) {
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
          logger.warn(`[OptimizedCache] Unsupported get type: ${type}`);
          return null;
      }

      if (!cachedData) return null;

      // Проверяем TTL
      const metadata = cachedData.cache_metadata;
      if (metadata && metadata.ttl) {
        const isExpired = Date.now() - metadata.cached_at > metadata.ttl;
        if (isExpired) {
          logger.debug(`[OptimizedCache] Cache expired for ${type}:${key}`);
          return null;
        }
      }

      // Обновляем статистику доступа только для активных запросов
      if (updateAccess && metadata) {
        metadata.access_count = (metadata.access_count || 0) + 1;
        metadata.last_accessed = Date.now();
        
        // Сохраняем обновленную статистику в фоне
        this.backgroundUpdate(type, key, cachedData, metadata.priority);
      }

      logger.debug(`[OptimizedCache] Cache hit for ${type}:${key}`);
      return cachedData;
    } catch (error) {
      logger.error(`[OptimizedCache] Failed to get ${type}:${key}:`, error);
      return null;
    }
  }

  // Фоновое обновление статистики
  async backgroundUpdate(type, key, data, priority) {
    try {
      const enhancedData = {
        ...data,
        cache_metadata: {
          ...data.cache_metadata,
          access_count: data.cache_metadata.access_count,
          last_accessed: Date.now()
        }
      };

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
      }
    } catch (error) {
      // Игнорируем ошибки фонового обновления
    }
  }

  // Приоритетная загрузка данных для пользователя
  async priorityLoad(episodesList, currentLanguage, visibleEpisodes = []) {
    try {
      logger.debug('[OptimizedCache] Starting priority load...');
      
      // Сначала загружаем видимые эпизоды (высокий приоритет)
      for (const episode of visibleEpisodes) {
        await this.smartCache('episodes', episode.slug, episode, 'critical', true);
        
        // Предзагружаем транскрипт и вопросы для видимых эпизодов
        const transcriptLang = episode.lang === 'all' ? currentLanguage : episode.lang;
        this.addToBackgroundQueue('transcript', `${episode.slug}:${transcriptLang}`, 'high');
        this.addToBackgroundQueue('questions', `${episode.slug}:${currentLanguage}`, 'high');
      }

      // Затем загружаем недавние эпизоды (средний приоритет)
      const recentEpisodes = episodesList
        .filter(ep => !visibleEpisodes.some(vep => vep.slug === ep.slug))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      for (const episode of recentEpisodes) {
        await this.smartCache('episodes', episode.slug, episode, 'high');
        
        const transcriptLang = episode.lang === 'all' ? currentLanguage : episode.lang;
        this.addToBackgroundQueue('transcript', `${episode.slug}:${transcriptLang}`, 'normal');
        this.addToBackgroundQueue('questions', `${episode.slug}:${currentLanguage}`, 'normal');
      }

      logger.debug(`[OptimizedCache] Priority load completed for ${visibleEpisodes.length} visible and ${recentEpisodes.length} recent episodes`);
    } catch (error) {
      logger.error('[OptimizedCache] Priority load failed:', error);
    }
  }

  // Добавление в очередь фоновой загрузки
  addToBackgroundQueue(type, key, priority = 'normal') {
    this.backgroundQueue.push({ type, key, priority, addedAt: Date.now() });
    
    // Сортируем очередь по приоритету
    this.backgroundQueue.sort((a, b) => {
      const aWeight = this.priorityWeights[a.priority] || 2;
      const bWeight = this.priorityWeights[b.priority] || 2;
      return bWeight - aWeight; // Высокий приоритет сначала
    });

    // Ограничиваем размер очереди
    if (this.backgroundQueue.length > 50) {
      this.backgroundQueue = this.backgroundQueue.slice(0, 50);
    }
  }

  // Запуск фоновой загрузки
  async startBackgroundLoading() {
    if (this.isBackgroundLoading) return;
    
    this.isBackgroundLoading = true;
    
    const processQueue = async () => {
      while (this.backgroundQueue.length > 0 && !document.hidden) {
        const item = this.backgroundQueue.shift();
        
        try {
          // Проверяем, не устарел ли элемент очереди
          if (Date.now() - item.addedAt > 5 * 60 * 1000) { // 5 минут
            continue;
          }
          
          // Проверяем, есть ли уже данные в кэше
          const cached = await this.smartGet(item.type, item.key, false);
          if (!cached) {
            logger.debug(`[OptimizedCache] Background loading ${item.type}:${item.key}`);
            // Здесь можно добавить логику загрузки данных из сети
            // Пока просто отмечаем, что данные отсутствуют
          }
        } catch (error) {
          logger.debug(`[OptimizedCache] Background load failed for ${item.type}:${item.key}:`, error);
        }
        
        // Делаем паузу между загрузками
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.isBackgroundLoading = false;
      
      // Перезапускаем через некоторое время, если есть элементы в очереди
      if (this.backgroundQueue.length > 0) {
        setTimeout(() => this.startBackgroundLoading(), 5000);
      }
    };
    
    processQueue();
  }

  // Управление размером кэша с приоритетом пользовательских данных
  async manageCacheSize(type, strategy) {
    try {
      const storeName = this.getStoreName(type);
      const transaction = await offlineDataService.getTransaction([storeName]);
      if (!transaction) {
        logger.warn(`[OptimizedCache] Could not create transaction for ${type} cache management`);
        return;
      }
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = async () => {
          const items = request.result;

          if (items.length <= strategy.maxSize) {
            resolve();
            return;
          }

          logger.debug(`[OptimizedCache] Cache size exceeded for ${type}, cleaning up...`);

          // Сортируем с приоритетом пользовательских данных
          const sortedItems = items
            .filter(item => item.cache_metadata)
            .sort((a, b) => {
              const aKey = this.getItemKey(type, a);
              const bKey = this.getItemKey(type, b);
              const aIsUser = aKey ? this.userInteractionData.has(`${type}:${aKey}`) : false;
              const bIsUser = bKey ? this.userInteractionData.has(`${type}:${bKey}`) : false;

              // Пользовательские данные имеют высший приоритет
              if (aIsUser && !bIsUser) return -1;
              if (!aIsUser && bIsUser) return 1;

              const aPriority = this.getPriorityWeight(a.cache_metadata.priority);
              const bPriority = this.getPriorityWeight(b.cache_metadata.priority);

              if (aPriority !== bPriority) {
                return aPriority - bPriority;
              }

              // При одинаковом приоритете удаляем менее используемые
              const aScore = (a.cache_metadata.access_count || 0) /
                           Math.max(1, Date.now() - a.cache_metadata.last_accessed);
              const bScore = (b.cache_metadata.access_count || 0) /
                           Math.max(1, Date.now() - b.cache_metadata.last_accessed);

              return aScore - bScore;
            });

          // Удаляем элементы до достижения целевого размера
          const targetSize = Math.floor(strategy.maxSize * 0.8);
          const itemsToDelete = sortedItems.slice(0, items.length - targetSize);

          if (itemsToDelete.length > 0) {
            const deleteTransaction = offlineDataService.getTransaction([storeName], 'readwrite');
            const deleteStore = deleteTransaction.objectStore(storeName);

            for (const item of itemsToDelete) {
              const key = this.getItemKey(type, item);
              if (key) {
                try {
                  deleteStore.delete(key);
                  // Удаляем из пользовательских данных
                  this.userInteractionData.delete(`${type}:${key}`);
                } catch (deleteError) {
                  logger.warn(`[OptimizedCache] Failed to delete item ${key}:`, deleteError);
                }
              }
            }

            logger.debug(`[OptimizedCache] Removed ${itemsToDelete.length} items from ${type} cache`);
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error(`[OptimizedCache] Failed to manage cache size for ${type}:`, error);
    }
  }

  // Сравнение данных для избежания избыточных обновлений
  isDataEqual(existingData, newData) {
    try {
      const existingStr = JSON.stringify(this.cleanForComparison(existingData));
      const newStr = JSON.stringify(this.cleanForComparison(newData));
      return existingStr === newStr;
    } catch {
      return false;
    }
  }

  // Очистка данных для сравнения (удаляем метаданные кэша)
  cleanForComparison(data) {
    const cleaned = { ...data };
    delete cleaned.cache_metadata;
    return cleaned;
  }

  // Вспомогательные методы
  getStoreName(type) {
    const storeMap = {
      'transcript': 'transcripts',
      'questions': 'questions',
      'episodes': 'episodes',
      'audio_metadata': 'audioFiles'
    };
    return storeMap[type] || type;
  }

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

  getPriorityWeight(priority) {
    return this.priorityWeights[priority] || 2;
  }

  // Получение статистики
  async getCacheStats() {
    try {
      await offlineDataService.init();
      const stats = {};
      
      for (const [type, strategy] of Object.entries(this.cacheStrategies)) {
        const storeName = this.getStoreName(type);
        const transaction = await offlineDataService.getTransaction([storeName]);
        if (!transaction) {
          logger.warn(`[OptimizedCache] Could not create transaction for ${type} stats`);
          continue;
        }
        const store = transaction.objectStore(storeName);
        
        const typeStats = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => {
            const items = request.result;
            const now = Date.now();
            
            let totalSize = 0;
            let expiredCount = 0;
            let accessCount = 0;
            let userInteractionCount = 0;
            
            items.forEach(item => {
              totalSize += this.estimateItemSize(item);
              
              const metadata = item.cache_metadata;
              if (metadata) {
                accessCount += metadata.access_count || 0;
                
                if (metadata.user_interaction) {
                  userInteractionCount++;
                }
                
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
              userInteractionCount,
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
      logger.error('[OptimizedCache] Failed to get cache stats:', error);
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

  // Очистка устаревших данных
  async cleanExpiredCache() {
    try {
      logger.debug('[OptimizedCache] Starting cleanup of expired cache...');
      
      for (const [type, strategy] of Object.entries(this.cacheStrategies)) {
        const storeName = this.getStoreName(type);
        const transaction = await offlineDataService.getTransaction([storeName], 'readwrite');
        if (!transaction) {
          logger.warn(`[OptimizedCache] Could not create transaction for ${type} cleanup`);
          continue;
        }
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
                    this.userInteractionData.delete(`${type}:${key}`);
                    expiredCount++;
                  }
                }
              }
            });
            
            if (expiredCount > 0) {
              logger.debug(`[OptimizedCache] Cleaned ${expiredCount} expired items from ${type} cache`);
            }
            resolve();
          };
          request.onerror = () => reject(request.error);
        });
      }
      
      logger.debug('[OptimizedCache] Cleanup completed');
    } catch (error) {
      logger.error('[OptimizedCache] Cleanup failed:', error);
    }
  }
}

// Создаем единственный экземпляр сервиса
const optimizedCacheService = new OptimizedCacheService();

export default optimizedCacheService;
