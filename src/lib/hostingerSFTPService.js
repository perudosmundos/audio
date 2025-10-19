import { getLocaleString } from '@/lib/locales';
import logger from '@/lib/logger';

const HOSTINGER_CONFIG = {
  PUBLIC_URL: import.meta.env.VITE_HOSTINGER_PUBLIC_URL || 'https://dosmundos.pe/wp-content/uploads/Audio/',
};

const getApiBase = () => {
  // Always use relative paths for /api routes
  // Vite proxy in dev environment handles /api routing
  return '';
};

const hostingerSFTPService = {
  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    const fileKey = originalFilename ? originalFilename.replace(/\s+/g, '_') : `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const totalBytes = file.size || 0;
    const totalMB = totalBytes ? (totalBytes / (1024 * 1024)).toFixed(2) : '0.00';

    const attemptUpload = async (retryCount = 0, maxRetries = 3) => {
      try {
        if (onProgress) onProgress(0, { stage: 'init', message: 'Инициализация загрузки…', uploadedMB: '0.00', totalMB });

        logger.info(`[Hostinger Upload] ${fileKey}: Starting upload`);

        if (onProgress) onProgress(10, { stage: 'connecting', message: 'Подключение к серверу…', uploadedMB: '0.00', totalMB });

        // Convert file to base64 for transmission
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);

        if (onProgress) onProgress(20, { stage: 'uploading', message: 'Загрузка файла…', uploadedMB: '0.00', totalMB });

        // Call backend API
        const apiBase = getApiBase();
        const response = await fetch(`${apiBase}/api/hostinger-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBuffer: base64Data,
            fileName: fileKey,
            fileSize: totalBytes,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        if (onProgress) onProgress(100, { stage: 'done', message: 'Готово', uploadedMB: totalMB, totalMB });

        logger.info(`[Hostinger Upload] ${fileKey}: Upload successful`);
        return {
          fileUrl: result.fileUrl,
          fileKey: result.fileKey,
          bucketName: 'hostinger',
          storage_provider: 'hostinger',
        };
      } catch (error) {
        logger.error(`[Hostinger Upload] ${fileKey}: Attempt ${retryCount + 1}/${maxRetries} failed:`, error.message);

        if (retryCount < maxRetries) {
          logger.warn(`[Hostinger Upload] ${fileKey}: Retrying (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return attemptUpload(retryCount + 1, maxRetries);
        }

        logger.error(`[Hostinger Upload] ${fileKey}: All retries failed`);
        throw new Error(getLocaleString('errorUploadingToHostinger', currentLanguage, { errorMessage: error.message }));
      }
    };

    return attemptUpload();
  },

  deleteFile: async (fileKey, bucketName, currentLanguage) => {
    try {
      logger.info(`[Hostinger Delete] ${fileKey}: Starting deletion`);

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/hostinger-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }

      logger.info(`[Hostinger Delete] ${fileKey}: Deleted successfully`);
      return { success: true };
    } catch (error) {
      logger.error(`[Hostinger Delete] Error:`, error);
      return { success: false, error: getLocaleString('errorDeletingHostingerFile', currentLanguage, { fileName: fileKey, errorMessage: error.message }) };
    }
  },

  checkFileExists: async (originalFilename) => {
    try {
      const fileKey = originalFilename.replace(/\s+/g, '_');

      logger.info(`[Hostinger Check] ${fileKey}: Checking existence via HTTP`);

      // Простая проверка через HTTP запрос к файлу
      const fileUrl = `${HOSTINGER_CONFIG.PUBLIC_URL}${fileKey}`;
      
      const response = await fetch(fileUrl, {
        method: 'HEAD',
        mode: 'no-cors', // Обходим CORS
      });

      // Если запрос прошел без ошибок, файл существует
      logger.info(`[Hostinger Check] ${fileKey}: File exists on Hostinger`);
      return {
        exists: true,
        fileUrl: fileUrl,
        fileKey: fileKey,
        bucketName: 'hostinger',
        storage_provider: 'hostinger',
      };
    } catch (error) {
      logger.warn(`[Hostinger Check] ${fileKey}: File not found - ${error.message}`);
      return { exists: false };
    }
  },

  getPublicUrl: (fileKey, bucketName) => {
    return `${HOSTINGER_CONFIG.PUBLIC_URL}${fileKey}`;
  },

  testConnection: async () => {
    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/hostinger-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'test-connection' }),
      });

      if (response.ok) {
        logger.info('[Hostinger Test] Connection successful');
        return { success: true, message: 'Hostinger SFTP connection test successful' };
      } else {
        throw new Error(`Status: ${response.status}`);
      }
    } catch (error) {
      logger.error('[Hostinger Test] Connection failed:', error.message);
      return { success: false, error: error.message };
    }
  },
};

export default hostingerSFTPService;
