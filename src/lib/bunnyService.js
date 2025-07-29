const BUNNY_CONFIG = {
  API_KEY: "588622d1-bf9a-4474-ac44-a35120a563b14df6ca78-1e4f-45df-9fbd-c595e47a9aed",
  STORAGE_ZONE: "dosmundos-audio",
  STORAGE_URL: "https://storage.bunnycdn.com/dosmundos-audio/",
  CDN_URL: "https://dosmundos-audio.b-cdn.net/",
  REGION: "de" // Frankfurt
};

const bunnyService = {
  // Загрузка файла в Bunny.net Storage
  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    const fileKey = originalFilename ? originalFilename.replace(/\s+/g, '_') : `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    
    console.log('Bunny: Starting upload for', fileKey);
    
    try {
      if (onProgress) onProgress(0);
      
      // Читаем файл как ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      if (onProgress) onProgress(25);
      
      // Подготавливаем заголовки для загрузки
      const headers = {
        'AccessKey': BUNNY_CONFIG.API_KEY,
        'Content-Type': file.type,
        'Content-Length': arrayBuffer.byteLength.toString()
      };
      
      if (onProgress) onProgress(50);
      
      // Загружаем файл в Bunny.net Storage
      const uploadUrl = `${BUNNY_CONFIG.STORAGE_URL}${fileKey}`;
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers,
        body: arrayBuffer
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      if (onProgress) onProgress(100);
      
      // Генерируем CDN URL для доступа к файлу
      const cdnUrl = `${BUNNY_CONFIG.CDN_URL}${fileKey}`;
      
      console.log('Bunny: Upload successful', { fileKey, cdnUrl });
      
      return { 
        fileUrl: cdnUrl, 
        fileKey, 
        bucketName: BUNNY_CONFIG.STORAGE_ZONE,
        storageType: 'bunny'
      };
      
    } catch (error) {
      console.error('Bunny: Upload error', error);
      throw new Error(`Failed to upload to Bunny.net: ${error.message}`);
    }
  },

  // Проверка существования файла
  checkFileExists: async (fileKey) => {
    try {
      const response = await fetch(`${BUNNY_CONFIG.STORAGE_URL}${fileKey}`, {
        method: 'HEAD',
        headers: {
          'AccessKey': BUNNY_CONFIG.API_KEY
        }
      });
      
      if (response.ok) {
        const cdnUrl = `${BUNNY_CONFIG.CDN_URL}${fileKey}`;
        return { 
          exists: true, 
          fileUrl: cdnUrl, 
          bucketName: BUNNY_CONFIG.STORAGE_ZONE 
        };
      } else {
        return { exists: false };
      }
    } catch (error) {
      console.warn('Bunny: Error checking file', error);
      return { exists: false, error: error.message };
    }
  },

  // Удаление файла
  deleteFile: async (fileKey, currentLanguage) => {
    try {
      const response = await fetch(`${BUNNY_CONFIG.STORAGE_URL}${fileKey}`, {
        method: 'DELETE',
        headers: {
          'AccessKey': BUNNY_CONFIG.API_KEY
        }
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Bunny: Delete error', error);
      return { 
        success: false, 
        error: `Failed to delete file: ${error.message}` 
      };
    }
  },

  // Генерация публичного URL
  getPublicUrl: (fileKey) => {
    return `${BUNNY_CONFIG.CDN_URL}${fileKey}`;
  },

  // Получение рабочего URL с fallback
  getWorkingAudioUrl: async (audioUrl, fileKey, storageType) => {
    console.log('Bunny: getWorkingAudioUrl called with:', { audioUrl, fileKey, storageType });
    
    // Если это Bunny.net URL, используем его напрямую
    if (audioUrl && audioUrl.includes('b-cdn.net')) {
      console.log('Bunny: Using direct CDN URL:', audioUrl);
      return { url: audioUrl, source: 'bunny-cdn' };
    }
    
    // Если есть fileKey, генерируем Bunny.net URL
    if (fileKey) {
      const bunnyUrl = bunnyService.getPublicUrl(fileKey);
      console.log('Bunny: Generated URL from key:', bunnyUrl);
      return { url: bunnyUrl, source: 'bunny-generated' };
    }
    
    // Если есть audioUrl, но это не Bunny.net, используем его
    if (audioUrl) {
      console.log('Bunny: Using original URL:', audioUrl);
      return { url: audioUrl, source: 'original' };
    }
    
    console.log('Bunny: No URL could be generated');
    return { url: null, error: 'No URL could be generated' };
  },

  // Тестирование доступности аудио
  testAudioAvailability: async (audioUrl) => {
    if (!audioUrl) return { available: false, error: 'No URL provided' };
    
    try {
      console.log('Bunny: Testing audio availability for:', audioUrl);
      
      const response = await fetch(audioUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      
      const isAvailable = response.ok || response.status === 206;
      console.log('Bunny: Audio availability test result:', { url: audioUrl, status: response.status, available: isAvailable });
      
      return { 
        available: isAvailable, 
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      console.error('Bunny: Audio availability test failed:', error);
      return { 
        available: false, 
        error: error.message 
      };
    }
  },

  // Тестирование подключения к Bunny.net
  testConnection: async () => {
    console.log('Bunny: Testing connection...');
    
    try {
      // Тестируем доступ к Storage Zone
      const response = await fetch(BUNNY_CONFIG.STORAGE_URL, {
        method: 'GET',
        headers: {
          'AccessKey': BUNNY_CONFIG.API_KEY
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        console.log('Bunny: Connection test successful');
        return { success: true, message: 'Bunny.net connection successful' };
      } else {
        console.warn('Bunny: Connection test failed with status:', response.status);
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error('Bunny: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Диагностика Bunny.net
  runDiagnostics: async () => {
    console.log('Bunny: Running diagnostics...');
    
    try {
      const connectionTest = await bunnyService.testConnection();
      
      if (connectionTest.success) {
        return { 
          success: true, 
          storageZone: BUNNY_CONFIG.STORAGE_ZONE,
          cdnUrl: BUNNY_CONFIG.CDN_URL,
          message: 'Bunny.net diagnostics completed successfully'
        };
      } else {
        return { 
          success: false, 
          error: connectionTest.error,
          message: 'Bunny.net diagnostics failed'
        };
      }
    } catch (error) {
      console.error('Bunny: Diagnostics failed:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'Bunny.net diagnostics failed with exception'
      };
    }
  }
};

export default bunnyService; 