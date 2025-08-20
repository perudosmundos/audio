// Сервис для управления офлайн данными с IndexedDB
class OfflineDataService {
  constructor() {
    this.dbName = 'PodcastAppDB';
    this.version = 1;
    this.db = null;
  }

  // Инициализация базы данных
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
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
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };
    });
  }

  // Получение транзакции
  getTransaction(storeNames, mode = 'readonly') {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(storeNames, mode);
  }

  // --- ЭПИЗОДЫ ---
  
  async saveEpisode(episode) {
    const transaction = this.getTransaction(['episodes'], 'readwrite');
    const store = transaction.objectStore('episodes');
    
    const episodeData = {
      ...episode,
      cached_at: Date.now(),
      last_updated: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(episodeData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getEpisode(slug) {
    const transaction = this.getTransaction(['episodes']);
    const store = transaction.objectStore('episodes');
    
    return new Promise((resolve, reject) => {
      const request = store.get(slug);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllEpisodes() {
    const transaction = this.getTransaction(['episodes']);
    const store = transaction.objectStore('episodes');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- ТРАНСКРИПТЫ ---
  
  async saveTranscript(transcript) {
    const transaction = this.getTransaction(['transcripts'], 'readwrite');
    const store = transaction.objectStore('transcripts');
    
    const transcriptData = {
      ...transcript,
      cached_at: Date.now(),
      last_updated: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(transcriptData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getTranscript(episodeSlug, lang) {
    const transaction = this.getTransaction(['transcripts']);
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
  }

  // --- ВОПРОСЫ ---
  
  async saveQuestions(questions, episodeSlug, lang) {
    const transaction = this.getTransaction(['questions'], 'readwrite');
    const store = transaction.objectStore('questions');
    
    // Сначала удаляем существующие вопросы для этого эпизода и языка
    await this.deleteQuestions(episodeSlug, lang);
    
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
    
    return Promise.all(promises);
  }

  async getQuestions(episodeSlug, lang) {
    const transaction = this.getTransaction(['questions']);
    const store = transaction.objectStore('questions');
    const index = store.index('episode_slug');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(episodeSlug);
      request.onsuccess = () => {
        const questions = request.result
          .filter(q => q.lang === lang)
          .sort((a, b) => a.time - b.time);
        resolve(questions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteQuestions(episodeSlug, lang) {
    const transaction = this.getTransaction(['questions'], 'readwrite');
    const store = transaction.objectStore('questions');
    const index = store.index('episode_slug');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(episodeSlug);
      request.onsuccess = () => {
        const questions = request.result.filter(q => q.lang === lang);
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
  }

  // --- АУДИОФАЙЛЫ ---
  
  async saveAudioFileMetadata(url, episodeSlug, size = null) {
    const transaction = this.getTransaction(['audioFiles'], 'readwrite');
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
    const transaction = this.getTransaction(['audioFiles']);
    const store = transaction.objectStore('audioFiles');
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateAudioFileAccess(url) {
    const transaction = this.getTransaction(['audioFiles'], 'readwrite');
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
    const transaction = this.getTransaction(['syncQueue'], 'readwrite');
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
  }

  async getSyncQueue() {
    const transaction = this.getTransaction(['syncQueue']);
    const store = transaction.objectStore('syncQueue');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeSyncItem(id) {
    const transaction = this.getTransaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementSyncAttempts(id) {
    const transaction = this.getTransaction(['syncQueue'], 'readwrite');
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
    const transaction = this.getTransaction(['cacheSettings'], 'readwrite');
    const store = transaction.objectStore('cacheSettings');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, updated_at: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCacheSetting(key, defaultValue = null) {
    const transaction = this.getTransaction(['cacheSettings']);
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
      const store = transaction.objectStore('store');
      
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
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return { usage: 0, quota: 0 };
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
