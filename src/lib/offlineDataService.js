import { sanitizeTranscriptForSave } from './transcriptValidator.js';

// Сервис для управления офлайн данными с IndexedDB
class OfflineDataService {
  constructor() {
    this.dbName = 'PodcastAppDB';
    this.version = 2;
    this.db = null;
    this.fallbackStorage = new Map(); // Fallback для случаев, когда IndexedDB недоступен
    this.useFallback = false;
    this.initializing = false;
    this.initPromise = null;
  }

  // Инициализация базы данных
  async init() {
    console.log('🚀 Initializing OfflineDataService...');
    
    // Если уже инициализируемся, возвращаем существующий промис
    if (this.initPromise) {
      return this.initPromise;
    }

    // Проверяем, поддерживается ли IndexedDB
    if (!window.indexedDB) {
      console.warn('⚠️ IndexedDB не поддерживается, используем fallback хранилище');
      this.useFallback = true;
      this.fallbackStorage = new Map();
      console.log('✅ OfflineDataService initialized with fallback storage');
      return null;
    }

    // Если база уже инициализирована, возвращаем её
    if (this.db) {
      return this.db;
    }

    this.initializing = true;
    this.initPromise = new Promise((resolve, reject) => {
      // Добавляем таймаут для предотвращения зависания
      const timeoutId = setTimeout(() => {
        console.warn('IndexedDB timeout, switching to fallback storage');
        this.useFallback = true;
        this.initializing = false;
        resolve(null);
      }, 10000); // 10 секунд таймаут

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (event) => {
        clearTimeout(timeoutId);
        console.warn('IndexedDB error, switching to fallback storage:', event.target.error);
        this.useFallback = true;
        resolve(null);
      };

      request.onblocked = (event) => {
        clearTimeout(timeoutId);
        console.warn('IndexedDB blocked, switching to fallback storage:', event);
        this.useFallback = true;
        resolve(null);
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = event.target.result;

          // Хранилище эпизодов
          if (!db.objectStoreNames.contains('episodes')) {
            const episodeStore = db.createObjectStore('episodes', { keyPath: 'slug' });
            episodeStore.createIndex('date', 'date');
            episodeStore.createIndex('lang', 'lang');
          }

          // Хранилище транскриптов
          if (!db.objectStoreNames.contains('transcripts')) {
            const transcriptStore = db.createObjectStore('transcripts', { keyPath: 'id', autoIncrement: true });
            transcriptStore.createIndex('episode_slug', 'episode_slug');
            transcriptStore.createIndex('lang', 'lang');
          }

          // Хранилище вопросов
          if (!db.objectStoreNames.contains('questions')) {
            const questionStore = db.createObjectStore('questions', { keyPath: 'id', autoIncrement: true });
            questionStore.createIndex('episode_slug', 'episode_slug');
            questionStore.createIndex('lang', 'lang');
            questionStore.createIndex('time', 'time');
          }

          // Хранилище аудиофайлов (метаданные)
          if (!db.objectStoreNames.contains('audioFiles')) {
            const audioStore = db.createObjectStore('audioFiles', { keyPath: 'url' });
            audioStore.createIndex('episode_slug', 'episode_slug');
            audioStore.createIndex('cached_at', 'cached_at');
          }

          // Очередь синхронизации
          if (!db.objectStoreNames.contains('syncQueue')) {
            const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            syncStore.createIndex('type', 'type');
            syncStore.createIndex('timestamp', 'timestamp');
          }

          // Настройки кеша
          if (!db.objectStoreNames.contains('cacheSettings')) {
            const settingsStore = db.createObjectStore('cacheSettings', { keyPath: 'key' });
          }
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Error during IndexedDB upgrade:', error);
          this.useFallback = true;
          resolve(null);
        }
      };

      request.onsuccess = (event) => {
        clearTimeout(timeoutId);
        this.db = event.target.result;
        
        // Добавляем обработчик ошибок для базы данных
        this.db.onerror = (event) => {
          console.error('IndexedDB database error:', event.target.error);
        };
        
        console.log('✅ OfflineDataService initialized with IndexedDB');
        this.initializing = false;
        resolve(this.db);
      };
    });

    return this.initPromise;
  }

  // Получение транзакции
  async getTransaction(storeNames, mode = 'readonly') {
    try {
      // Если база данных не инициализирована или закрыта, инициализируем её
      if (!this.db || this.db.readyState !== 'open') {
        console.log('🔄 Initializing or reinitializing database...');
        await this.init();
      }

      // Проверяем успешность инициализации
      if (!this.db || this.db.readyState !== 'open') {
        if (this.useFallback) {
          console.log('Using fallback storage');
          return null;
        }
        throw new Error('Database not initialized properly');
      }

      // Проверяем, что все хранилища существуют
      for (const storeName of storeNames) {
        if (!this.db.objectStoreNames.contains(storeName)) {
          throw new Error(`Object store '${storeName}' does not exist`);
        }
      }

      const transaction = this.db.transaction(storeNames, mode);
      
      // Добавляем обработчики ошибок для транзакции
      transaction.onerror = (event) => {
        console.error('Transaction error:', event.target.error);
      };
      
      transaction.onabort = (event) => {
        console.warn('Transaction aborted:', event.target.error);
      };
      
      // Добавляем таймаут для предотвращения зависания
      const timeoutId = setTimeout(() => {
        try {
          transaction.abort();
        } catch (e) {
          console.warn('Could not abort transaction:', e);
        }
      }, 15000); // 15 секунд таймаут
      
      // Очищаем таймаут при завершении транзакции
      transaction.oncomplete = () => clearTimeout(timeoutId);
      transaction.onerror = () => clearTimeout(timeoutId);
      transaction.onabort = () => clearTimeout(timeoutId);
      
      return transaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      if (error.name === 'InvalidStateError') {
        console.log('Database connection was lost, attempting to reinitialize...');
        this.db = null;
        return this.getTransaction(storeNames, mode);
      }
      throw new Error(`Ошибка создания транзакции: ${error.message}`);
    }
  }

  // --- ЭПИЗОДЫ ---
  
  async saveEpisode(episode) {
    if (!episode || !episode.slug) {
      throw new Error('Episode data with slug is required');
    }

    const episodeData = {
      ...episode,
      cached_at: Date.now(),
      last_updated: Date.now()
    };

    // Если используем fallback хранилище
    if (this.useFallback) {
      const key = `episode_${episode.slug}`;
      this.fallbackStorage.set(key, episodeData);
      console.log('💾 Episode saved to fallback storage:', episode.slug);
      return episode.slug;
    }

    try {
      const transaction = await this.getTransaction(['episodes'], 'readwrite');
      const store = transaction.objectStore('episodes');
      
      return new Promise((resolve, reject) => {
        const request = store.put(episodeData);
        request.onsuccess = () => {
          console.log('💾 Episode saved to IndexedDB:', episode.slug);
          resolve(request.result);
        };
        request.onerror = () => {
          console.error('❌ Failed to save episode to IndexedDB:', episode.slug, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in saveEpisode:', error);
      // Fallback to fallback storage if IndexedDB fails
      console.log('🔄 Falling back to fallback storage for episode:', episode.slug);
      this.useFallback = true;
      const key = `episode_${episode.slug}`;
      this.fallbackStorage.set(key, episodeData);
      return episode.slug;
    }
  }

  async getEpisode(slug) {
    const transaction = await this.getTransaction(['episodes']);
    const store = transaction.objectStore('episodes');
    
    return new Promise((resolve, reject) => {
      const request = store.get(slug);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllEpisodes() {
    // Если используем fallback хранилище
    if (this.useFallback) {
      const episodes = [];
      for (const [key, value] of this.fallbackStorage.entries()) {
        if (key.startsWith('episode_')) {
          episodes.push(value);
        }
      }
      return episodes.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    const transaction = await this.getTransaction(['episodes']);
    const store = transaction.objectStore('episodes');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const episodes = request.result || [];
        // Сортируем по дате (новые первыми)
        episodes.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        resolve(episodes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- ТРАНСКРИПТЫ ---
  
  async saveTranscript(transcript) {
    if (!transcript) {
      throw new Error('Transcript data is required');
    }

    // Валидируем и очищаем данные перед сохранением
    const sanitizedTranscript = sanitizeTranscriptForSave(transcript);
    
    // Проверяем корректность ID для IndexedDB
    if (!this.useFallback && sanitizedTranscript.id !== undefined) {
      const transcriptId = Number(sanitizedTranscript.id);
      if (isNaN(transcriptId)) {
        console.warn('Invalid transcript ID, using timestamp instead:', sanitizedTranscript.id);
        sanitizedTranscript.id = Date.now();
      }
    }

    // Если используем fallback хранилище
    if (this.useFallback) {
      const key = `transcript_${sanitizedTranscript.episode_slug}_${sanitizedTranscript.lang}`;
      const transcriptData = {
        ...sanitizedTranscript,
        cached_at: Date.now(),
        last_updated: Date.now()
      };
      this.fallbackStorage.set(key, transcriptData);
      return Date.now(); // Возвращаем timestamp как ID
    }

    try {
      const transaction = await this.getTransaction(['transcripts'], 'readwrite');
      const store = transaction.objectStore('transcripts');
      
      const transcriptData = {
        ...sanitizedTranscript,
        cached_at: Date.now(),
        last_updated: Date.now()
      };
      
      return new Promise((resolve, reject) => {
        // Добавляем таймаут для предотвращения зависания
        const timeoutId = setTimeout(() => {
          reject(new Error('Timeout: Сохранение транскрипта заняло слишком много времени'));
        }, 10000); // 10 секунд таймаут

        const request = store.put(transcriptData);
        
        request.onsuccess = () => {
          clearTimeout(timeoutId);
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          clearTimeout(timeoutId);
          console.error('Error saving transcript:', event.target.error);
          reject(new Error(`Ошибка сохранения транскрипта: ${event.target.error?.message || 'Неизвестная ошибка'}`));
        };

        // Добавляем обработчик завершения транзакции
        transaction.oncomplete = () => {
          clearTimeout(timeoutId);
        };

        transaction.onerror = (event) => {
          clearTimeout(timeoutId);
          reject(new Error(`Transaction error: ${event.target.error?.message || 'Transaction failed'}`));
        };
      });
    } catch (error) {
      console.error('Error in saveTranscript:', error);
      throw error;
    }
  }

  async getTranscript(episodeSlug, lang) {
    // Если используем fallback хранилище
    if (this.useFallback) {
      const key = `transcript_${episodeSlug}_${lang}`;
      return this.fallbackStorage.get(key) || null;
    }

    try {
      const transaction = await this.getTransaction(['transcripts']);
      const store = transaction.objectStore('transcripts');
      const index = store.index('episode_slug');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(episodeSlug);
        request.onsuccess = () => {
          const transcripts = request.result.filter(t => t.lang === lang);
          resolve(transcripts.length > 0 ? transcripts[0] : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error in getTranscript:', error);
      return null;
    }
  }

  // --- ВОПРОСЫ ---
  
  async saveQuestions(questions, episodeSlug, lang) {
    if (!Array.isArray(questions)) {
      console.warn('Questions must be an array, received:', typeof questions);
      questions = [];
    }

    // Если используем fallback хранилище
    if (this.useFallback) {
      const key = `questions_${episodeSlug}_${lang}`;
      const questionsData = {
        questions: questions,
        episode_slug: episodeSlug,
        lang: lang,
        cached_at: Date.now(),
        last_updated: Date.now()
      };
      this.fallbackStorage.set(key, questionsData);
      return questions.length;
    }

    try {
      // Сначала удаляем существующие вопросы для этого эпизода и языка
      await this.deleteQuestions(episodeSlug, lang);
      
      if (questions.length === 0) {
        return 0; // Нет вопросов для сохранения
      }

      const transaction = await this.getTransaction(['questions'], 'readwrite');
      const store = transaction.objectStore('questions');
      
      // Создаем все промисы сразу, чтобы транзакция не завершилась
      const promises = questions.map(question => {
        const questionData = {
          ...question,
          episode_slug: episodeSlug,
          lang: lang,
          cached_at: Date.now(),
          last_updated: Date.now()
        };
        
        return new Promise((resolve, reject) => {
          const request = store.add(questionData);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      });
      
      // Выполняем все операции в рамках одной транзакции
      const results = await Promise.all(promises);
      
      // Ждем завершения транзакции
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(results.length);
        transaction.onerror = (event) => reject(new Error(`Transaction error: ${event.target.error?.message || 'Transaction failed'}`));
      });
    } catch (error) {
      console.error('Error in saveQuestions:', error);
      throw error;
    }
  }

  async getQuestions(episodeSlug, lang) {
    // Если используем fallback хранилище
    if (this.useFallback) {
      const key = `questions_${episodeSlug}_${lang}`;
      const questionsData = this.fallbackStorage.get(key);
      if (questionsData && questionsData.questions) {
        return questionsData.questions.sort((a, b) => (a.time || 0) - (b.time || 0));
      }
      return [];
    }

    try {
      const transaction = await this.getTransaction(['questions']);
      const store = transaction.objectStore('questions');
      const index = store.index('episode_slug');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(episodeSlug);
        request.onsuccess = () => {
          const questions = request.result
            .filter(q => q.lang === lang)
            .sort((a, b) => (a.time || 0) - (b.time || 0));
          resolve(questions);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error in getQuestions:', error);
      return [];
    }
  }

  async deleteQuestions(episodeSlug, lang) {
    // Если используем fallback хранилище
    if (this.useFallback) {
      const key = `questions_${episodeSlug}_${lang}`;
      this.fallbackStorage.delete(key);
      return true;
    }

    try {
      const transaction = await this.getTransaction(['questions'], 'readwrite');
      const store = transaction.objectStore('questions');
      const index = store.index('episode_slug');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(episodeSlug);
        request.onsuccess = () => {
          const questions = request.result.filter(q => q.lang === lang);
          if (questions.length === 0) {
            resolve(true);
            return;
          }
          
          const deletePromises = questions.map(q => {
            return new Promise((deleteResolve, deleteReject) => {
              const deleteRequest = store.delete(q.id);
              deleteRequest.onsuccess = () => deleteResolve();
              deleteRequest.onerror = () => deleteReject(deleteRequest.error);
            });
          });
          Promise.all(deletePromises).then(resolve).catch(reject);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error in deleteQuestions:', error);
      return false;
    }
  }

  // --- АУДИОФАЙЛЫ ---
  
  async saveAudioFileMetadata(url, episodeSlug, size = null) {
    const transaction = await this.getTransaction(['audioFiles'], 'readwrite');
    const store = transaction.objectStore('audioFiles');
    
    const audioData = {
      url,
      episode_slug: episodeSlug,
      size,
      cached_at: Date.now(),
      last_accessed: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(audioData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAudioFileMetadata(url) {
    const transaction = await this.getTransaction(['audioFiles']);
    const store = transaction.objectStore('audioFiles');
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateAudioFileAccess(url) {
    const transaction = await this.getTransaction(['audioFiles'], 'readwrite');
    const store = transaction.objectStore('audioFiles');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(url);
      getRequest.onsuccess = () => {
        const audioData = getRequest.result;
        if (audioData) {
          audioData.last_accessed = Date.now();
          const putRequest = store.put(audioData);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // --- ОЧЕРЕДЬ СИНХРОНИЗАЦИИ ---
  
  async addToSyncQueue(type, data, operation = 'update') {
    // Если используем fallback хранилище
    if (this.useFallback) {
      const key = `sync_${Date.now()}_${Math.random()}`;
      const syncItem = {
        id: key,
        type, // 'transcript', 'question', 'episode'
        operation, // 'create', 'update', 'delete'
        data,
        timestamp: Date.now(),
        attempts: 0,
        max_attempts: 3
      };
      this.fallbackStorage.set(key, syncItem);
      return key;
    }

    try {
      const transaction = await this.getTransaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      const syncItem = {
        type, // 'transcript', 'question', 'episode'
        operation, // 'create', 'update', 'delete'
        data,
        timestamp: Date.now(),
        attempts: 0,
        max_attempts: 3
      };
      
      return new Promise((resolve, reject) => {
        const request = store.add(syncItem);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error in addToSyncQueue:', error);
      throw error;
    }
  }

  async getSyncQueue() {
    // Если используем fallback хранилище
    if (this.useFallback) {
      const queue = [];
      for (const [key, value] of this.fallbackStorage.entries()) {
        if (key.startsWith('sync_')) {
          queue.push(value);
        }
      }
      return queue.sort((a, b) => a.timestamp - b.timestamp);
    }

    try {
      const transaction = await this.getTransaction(['syncQueue']);
      const store = transaction.objectStore('syncQueue');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error in getSyncQueue:', error);
      // Fallback to fallback storage if IndexedDB fails
      console.log('🔄 Falling back to fallback storage for sync queue');
      this.useFallback = true;
      const queue = [];
      for (const [key, value] of this.fallbackStorage.entries()) {
        if (key.startsWith('sync_')) {
          queue.push(value);
        }
      }
      return queue.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  async removeSyncItem(id) {
    const transaction = await this.getTransaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementSyncAttempts(id) {
    const transaction = await this.getTransaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.attempts += 1;
          item.last_attempt = Date.now();
          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve(item);
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // --- НАСТРОЙКИ КЕША ---
  
  async saveCacheSetting(key, value) {
    const transaction = await this.getTransaction(['cacheSettings'], 'readwrite');
    const store = transaction.objectStore('cacheSettings');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, updated_at: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCacheSetting(key, defaultValue = null) {
    const transaction = await this.getTransaction(['cacheSettings']);
    const store = transaction.objectStore('cacheSettings');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- ОЧИСТКА ДАННЫХ ---
  
  async clearExpiredData(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 дней по умолчанию
    const cutoffTime = Date.now() - maxAge;
    const stores = ['episodes', 'transcripts', 'questions', 'audioFiles'];
    
    for (const storeName of stores) {
      const transaction = this.getTransaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const items = request.result;
          const expiredItems = items.filter(item => 
            item.cached_at && item.cached_at < cutoffTime
          );
          
          const deletePromises = expiredItems.map(item => {
            return new Promise((deleteResolve, deleteReject) => {
              const deleteRequest = store.delete(item.id || item.slug || item.url);
              deleteRequest.onsuccess = () => deleteResolve();
              deleteRequest.onerror = () => deleteReject(deleteRequest.error);
            });
          });
          
          Promise.all(deletePromises).then(resolve).catch(reject);
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getStorageUsage() {
    try {
      if (this.useFallback) {
        // В fallback режиме возвращаем базовую статистику
        return {
          audioSize: 0,
          dataSize: 0,
          episodeCount: this.fallbackStorage.size,
          transcriptCount: 0,
          questionCount: 0,
          syncQueueCount: 0
        };
      }

      const stats = {
        audioSize: 0,
        dataSize: 0,
        episodeCount: 0,
        transcriptCount: 0,
        questionCount: 0,
        syncQueueCount: 0
      };

      // Подсчитываем количество эпизодов
      try {
        const episodeTransaction = this.getTransaction(['episodes']);
        const episodeStore = episodeTransaction.objectStore('episodes');
        const episodeRequest = episodeStore.count();
        episodeRequest.onsuccess = () => {
          stats.episodeCount = episodeRequest.result;
        };
      } catch (error) {
        console.warn('Error counting episodes:', error);
      }

      // Подсчитываем количество транскриптов
      try {
        const transcriptTransaction = this.getTransaction(['transcripts']);
        const transcriptStore = transcriptTransaction.objectStore('transcripts');
        const transcriptRequest = transcriptStore.count();
        transcriptRequest.onsuccess = () => {
          stats.transcriptCount = transcriptRequest.result;
        };
      } catch (error) {
        console.warn('Error counting transcripts:', error);
      }

      // Подсчитываем количество вопросов
      try {
        const questionTransaction = this.getTransaction(['questions']);
        const questionStore = questionTransaction.objectStore('questions');
        const questionRequest = questionStore.count();
        questionRequest.onsuccess = () => {
          stats.questionCount = questionRequest.result;
        };
      } catch (error) {
        console.warn('Error counting questions:', error);
      }

      // Подсчитываем количество элементов в очереди синхронизации
      try {
        const syncTransaction = this.getTransaction(['syncQueue']);
        const syncStore = syncTransaction.objectStore('syncQueue');
        const syncRequest = syncStore.count();
        syncRequest.onsuccess = () => {
          stats.syncQueueCount = syncRequest.result;
        };
      } catch (error) {
        console.warn('Error counting sync queue:', error);
      }

      // Оцениваем размер данных (примерно)
      stats.dataSize = (stats.episodeCount * 1024) + (stats.transcriptCount * 5120) + (stats.questionCount * 512);

      return stats;
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return {
        audioSize: 0,
        dataSize: 0,
        episodeCount: 0,
        transcriptCount: 0,
        questionCount: 0,
        syncQueueCount: 0
      };
    }
  }

  // Удаление эпизода
  async deleteEpisode(slug) {
    if (this.useFallback) {
      const key = `episode_${slug}`;
      this.fallbackStorage.delete(key);
      return true;
    }

    try {
      const transaction = this.getTransaction(['episodes'], 'readwrite');
      const store = transaction.objectStore('episodes');
      
      return new Promise((resolve, reject) => {
        const request = store.delete(slug);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting episode:', error);
      throw error;
    }
  }

  // Закрытие соединения с базой данных
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Создаем единственный экземпляр сервиса
const offlineDataService = new OfflineDataService();

export default offlineDataService;
