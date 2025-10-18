import offlineDataService from './offlineDataService';

class AudioCacheService {
  constructor() {
    this.cacheInProgress = new Set();
    this.maxCacheSize = this.getMaxCacheSize(); // Получаем из настроек
    this.downloadListeners = [];
  }

  // Получение максимального размера кеша из localStorage
  getMaxCacheSize() {
    const saved = localStorage.getItem('audioCacheMaxSize');
    if (saved) {
      return parseInt(saved, 10);
    }
    // По умолчанию 1 ГБ
    return 1024 * 1024 * 1024; // 1GB
  }

  // Установка максимального размера кеша
  setMaxCacheSize(sizeInBytes) {
    this.maxCacheSize = sizeInBytes;
    localStorage.setItem('audioCacheMaxSize', sizeInBytes.toString());
  }

  // Подписка на события загрузки
  onDownloadProgress(callback) {
    this.downloadListeners.push(callback);
    return () => {
      this.downloadListeners = this.downloadListeners.filter(cb => cb !== callback);
    };
  }

  // Уведомление слушателей о прогрессе
  notifyDownloadListeners(event, data = {}) {
    this.downloadListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[AudioCache] Download listener error:', error);
      }
    });
  }

  // Проверка, есть ли аудио в кеше
  async isAudioCached(url) {
    try {
      // Проверяем в Service Worker кеше
      if ('caches' in window) {
        const cache = await caches.open('audio-v1');
        const response = await cache.match(url);
        if (response) {
          return true;
        }
      }

      // Проверяем метаданные в IndexedDB
      await offlineDataService.init();
      const metadata = await offlineDataService.getAudioFileMetadata(url);
      return !!metadata;
    } catch (error) {
      console.error('[AudioCache] Error checking cache:', error);
      return false;
    }
  }

  // Получение размера кешированного аудио
  async getCachedAudioSize(url) {
    try {
      await offlineDataService.init();
      const metadata = await offlineDataService.getAudioFileMetadata(url);
      return metadata ? metadata.size : 0;
    } catch (error) {
      console.error('[AudioCache] Error getting cached audio size:', error);
      return 0;
    }
  }

  // Кеширование аудиофайла
  async cacheAudio(url, episodeSlug, forceRedownload = false) {
    // Предотвращаем множественные загрузки одного файла
    if (this.cacheInProgress.has(url)) {
      console.log('[AudioCache] Already caching:', url);
      return false;
    }

    // Проверяем, есть ли уже в кеше
    if (!forceRedownload && await this.isAudioCached(url)) {
      console.log('[AudioCache] Already cached:', url);
      await offlineDataService.updateAudioFileAccess(url);
      return true;
    }

    this.cacheInProgress.add(url);
    
    try {
      await offlineDataService.init();
      
      this.notifyDownloadListeners('download_start', { url, episodeSlug });
      
      // Проверяем доступное место
      const storageEstimate = await offlineDataService.getStorageUsage();
      const availableSpace = storageEstimate.quota - storageEstimate.usage;
      
      if (availableSpace < 50 * 1024 * 1024) { // Минимум 50MB свободного места
        throw new Error('Insufficient storage space');
      }

      // Загружаем файл с отслеживанием прогресса
      const response = await this.fetchWithProgress(url, (loaded, total) => {
        const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
        this.notifyDownloadListeners('download_progress', {
          url,
          episodeSlug,
          loaded,
          total,
          progress
        });
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const fileSize = contentLength ? parseInt(contentLength) : 0;

      // Проверяем размер файла
      if (fileSize > this.maxCacheSize * 0.5) { // Не более 50% от максимального размера кеша
        throw new Error('File too large for caching');
      }

      // Кешируем в Service Worker
      if ('caches' in window) {
        const cache = await caches.open('audio-v1');
        
        // Управляем размером кеша
        await this.manageCacheSize(cache, fileSize);
        
        // Сохраняем в кеш
        await cache.put(url, response.clone());
        console.log('[AudioCache] Cached in SW:', url);
      }

      // Сохраняем метаданные в IndexedDB
      await offlineDataService.saveAudioFileMetadata(url, episodeSlug, fileSize);
      
      this.notifyDownloadListeners('download_complete', {
        url,
        episodeSlug,
        size: fileSize
      });
      
      console.log('[AudioCache] Successfully cached audio:', url);
      return true;
      
    } catch (error) {
      console.error('[AudioCache] Failed to cache audio:', error);
      
      this.notifyDownloadListeners('download_error', {
        url,
        episodeSlug,
        error: error.message
      });
      
      throw error;
    } finally {
      this.cacheInProgress.delete(url);
    }
  }

  // Загрузка с отслеживанием прогресса
  async fetchWithProgress(url, onProgress) {
    const response = await fetch(url);
    
    if (!response.body) {
      return response;
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength) : 0;
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      if (onProgress) {
        onProgress(loaded, total);
      }
    }

    // Создаем новый Response из собранных чанков
    const allChunks = new Uint8Array(loaded);
    let position = 0;
    
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    return new Response(allChunks, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  // Управление размером кеша
  async manageCacheSize(cache, newFileSize) {
    try {
      const keys = await cache.keys();
      let totalSize = newFileSize;
      const filesWithSize = [];

      // Подсчитываем текущий размер кеша
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const size = await this.getResponseSize(response);
          totalSize += size;
          filesWithSize.push({
            request,
            size,
            url: request.url
          });
        }
      }

      // Если превышаем лимит, удаляем старые файлы
      if (totalSize > this.maxCacheSize) {
        console.log('[AudioCache] Cache size exceeded, cleaning up...');
        
        // Сортируем по времени последнего доступа
        await offlineDataService.init();
        const sortedFiles = [];
        
        for (const file of filesWithSize) {
          const metadata = await offlineDataService.getAudioFileMetadata(file.url);
          sortedFiles.push({
            ...file,
            lastAccessed: metadata ? metadata.last_accessed : 0
          });
        }
        
        // Сортируем по времени последнего доступа (старые сначала)
        sortedFiles.sort((a, b) => a.lastAccessed - b.lastAccessed);
        
        // Удаляем файлы пока не освободим достаточно места
        let freedSpace = 0;
        const targetSpace = this.maxCacheSize * 0.3; // Освобождаем 30% места
        
        for (const file of sortedFiles) {
          if (freedSpace >= targetSpace) break;

          await cache.delete(file.request);

          // Проверяем, что транзакция была создана успешно
          const transaction = await offlineDataService.getTransaction(['audioFiles'], 'readwrite');
          if (transaction) {
            const store = transaction.objectStore('audioFiles');
            await new Promise((resolve, reject) => {
              const request = store.delete(file.url);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          }

          freedSpace += file.size;
          console.log('[AudioCache] Removed from cache:', file.url);
        }
      }
    } catch (error) {
      console.error('[AudioCache] Error managing cache size:', error);
    }
  }

  // Получение размера ответа
  async getResponseSize(response) {
    try {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        return parseInt(contentLength);
      }
      
      // Если нет заголовка content-length, клонируем и считаем
      const cloned = response.clone();
      const arrayBuffer = await cloned.arrayBuffer();
      return arrayBuffer.byteLength;
    } catch (error) {
      console.error('[AudioCache] Error getting response size:', error);
      return 0;
    }
  }

  // Удаление аудио из кеша
  async removeAudioFromCache(url) {
    try {
      // Удаляем из Service Worker кеша
      if ('caches' in window) {
        const cache = await caches.open('audio-v1');
        await cache.delete(url);
      }

      // Удаляем метаданные из IndexedDB
      await offlineDataService.init();
      const transaction = await offlineDataService.getTransaction(['audioFiles'], 'readwrite');

      // Проверяем, что транзакция была создана успешно
      if (!transaction) {
        console.warn('[AudioCache] Could not create transaction for removal, but continuing...');
        // Уведомляем слушателей об удалении
        this.notifyDownloadListeners('remove_complete', { url });
        console.log('[AudioCache] Removed audio from cache (SW only):', url);
        return true;
      }

      const store = transaction.objectStore('audioFiles');
      await new Promise((resolve, reject) => {
        const request = store.delete(url);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Уведомляем слушателей об удалении
      this.notifyDownloadListeners('remove_complete', { url });

      console.log('[AudioCache] Removed audio from cache:', url);
      return true;
    } catch (error) {
      console.error('[AudioCache] Error removing audio from cache:', error);
      this.notifyDownloadListeners('remove_error', { url, error: error.message });
      return false;
    }
  }

  // Получение списка кешированных аудиофайлов
  async getCachedAudioList() {
    try {
      await offlineDataService.init();
      const transaction = await offlineDataService.getTransaction(['audioFiles']);
      const store = transaction.objectStore('audioFiles');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[AudioCache] Error getting cached audio list:', error);
      return [];
    }
  }

  // Получение общего размера кеша
  async getCacheSize() {
    try {
      const cachedFiles = await this.getCachedAudioList();
      return cachedFiles.reduce((total, file) => total + (file.size || 0), 0);
    } catch (error) {
      console.error('[AudioCache] Error getting cache size:', error);
      return 0;
    }
  }

  // Очистка всего кеша
  async clearCache() {
    try {
      // Очищаем Service Worker кеш
      if ('caches' in window) {
        await caches.delete('audio-v1');
      }

      // Очищаем метаданные из IndexedDB
      await offlineDataService.init();
      const transaction = await offlineDataService.getTransaction(['audioFiles'], 'readwrite');
      const store = transaction.objectStore('audioFiles');
      
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('[AudioCache] Cache cleared');
      return true;
    } catch (error) {
      console.error('[AudioCache] Error clearing cache:', error);
      return false;
    }
  }

  // Предварительное кеширование аудио для эпизода
  async preloadAudio(episodeData) {
    if (!episodeData.audio_url) {
      console.log('[AudioCache] No audio URL for episode:', episodeData.slug);
      return false;
    }

    try {
      return await this.cacheAudio(episodeData.audio_url, episodeData.slug);
    } catch (error) {
      console.error('[AudioCache] Failed to preload audio for episode:', episodeData.slug, error);
      return false;
    }
  }

  // Обновление времени последнего доступа
  async updateLastAccessed(url) {
    try {
      await offlineDataService.init();
      await offlineDataService.updateAudioFileAccess(url);
    } catch (error) {
      console.error('[AudioCache] Error updating last accessed:', error);
    }
  }

  // Получение статистики кеша
  async getCacheStats() {
    try {
      const cachedFiles = await this.getCachedAudioList();
      const totalSize = cachedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
      const storageEstimate = await offlineDataService.getStorageUsage();
      
      return {
        fileCount: cachedFiles.length,
        totalSize,
        maxSize: this.maxCacheSize,
        usagePercentage: Math.round((totalSize / this.maxCacheSize) * 100),
        storageQuota: storageEstimate.quota,
        storageUsage: storageEstimate.usage,
        files: cachedFiles.map(file => ({
          url: file.url,
          episodeSlug: file.episode_slug,
          size: file.size,
          cachedAt: file.cached_at,
          lastAccessed: file.last_accessed
        }))
      };
    } catch (error) {
      console.error('[AudioCache] Error getting cache stats:', error);
      return {
        fileCount: 0,
        totalSize: 0,
        maxSize: this.maxCacheSize,
        usagePercentage: 0,
        storageQuota: 0,
        storageUsage: 0,
        files: []
      };
    }
  }

  // Принудительное обновление кеша для URL
  async refreshCachedAudio(url) {
    try {
      console.log('[AudioCache] Refreshing cached audio:', url);
      
      // Удаляем из кеша
      await this.removeAudioFromCache(url);
      
      // Проверяем, есть ли метаданные
      await offlineDataService.init();
      const metadata = await offlineDataService.getAudioFileMetadata(url);
      
      if (metadata) {
        // Перекешируем файл
        return await this.cacheAudio(url, metadata.episode_slug, true);
      }
      
      return false;
    } catch (error) {
      console.error('[AudioCache] Error refreshing cached audio:', error);
      return false;
    }
  }
}

// Создаем единственный экземпляр сервиса
const audioCacheService = new AudioCacheService();

export default audioCacheService;
