/**
 * Утилита для анализа длительности аудиофайлов
 * Работает в браузере через Audio API
 */

const audioDurationAnalyzer = {
  /**
   * Получает длительность аудиофайла по URL
   * @param {string} audioUrl - URL аудиофайла
   * @returns {Promise<number|null>} - Длительность в секундах или null при ошибке
   */
  getDuration: async (audioUrl) => {
    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        
        // Обработчики событий
        const handleLoadedMetadata = () => {
          const duration = audio.duration;
          logger.info(`[AudioDuration] Loaded: ${audioUrl} - ${duration}s`);
          cleanup();
          resolve(duration);
        };

        const handleError = (error) => {
          logger.warn(`[AudioDuration] Error loading ${audioUrl}:`, error);
          cleanup();
          resolve(null);
        };

        const handleTimeout = () => {
          logger.warn(`[AudioDuration] Timeout loading ${audioUrl}`);
          cleanup();
          resolve(null);
        };

        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audio.removeEventListener('error', handleError);
          audio.src = '';
        };

        // Устанавливаем обработчики
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('error', handleError);

        // Таймаут на случай если файл не загрузится
        const timeout = setTimeout(handleTimeout, 10000); // 10 секунд

        // Переопределяем cleanup чтобы включить таймаут
        const originalCleanup = cleanup;
        cleanup = () => {
          clearTimeout(timeout);
          originalCleanup();
        };

        // Загружаем файл
        audio.crossOrigin = 'anonymous';
        audio.preload = 'metadata';
        audio.src = audioUrl;

      } catch (error) {
        logger.error(`[AudioDuration] Exception:`, error);
        resolve(null);
      }
    });
  },

  /**
   * Форматирует длительность в читаемый вид
   * @param {number} seconds - Длительность в секундах
   * @returns {string} - Форматированная строка (например, "3:45")
   */
  formatDuration: (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  },

  /**
   * Проверяет, является ли URL валидным аудиофайлом
   * @param {string} url - URL для проверки
   * @returns {boolean} - true если URL выглядит как аудиофайл
   */
  isValidAudioUrl: (url) => {
    if (!url || typeof url !== 'string') return false;
    
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    const lowerUrl = url.toLowerCase();
    
    return audioExtensions.some(ext => lowerUrl.includes(ext));
  }
};

export default audioDurationAnalyzer;
