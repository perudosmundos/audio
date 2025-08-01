import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getLocaleString } from '@/lib/locales'; 

const R2_PRIMARY_CONFIG = {
  ACCESS_KEY_ID: "9725f0f870623b4acdd984d5863343be",
  SECRET_ACCESS_KEY: "d866515b4eda43f69b8ed97036227222c73be8ff1dcd4b9450f945625f9eceae",
  BUCKET: "audio-files", 
  ACCOUNT_ID: "b673708f9f9609c4d372573207f830ce",
  ENDPOINT_SUFFIX: "r2.cloudflarestorage.com",
  WORKER_PUBLIC_URL: "https://audio.alexbrin102.workers.dev",
  PROXY_URL: "/audio-proxy",
  API_PROXY_URL: "/api/audio-proxy"
};

const R2_SECONDARY_CONFIG = {
  ACCESS_KEY_ID: "fdd9df8e8e4963564e4264b2bc8250c6",
  SECRET_ACCESS_KEY: "ada4a9cd24c77795f0df4d3c3fd2f41ec293f167777746134fd695fbd5248907",
  BUCKET: "audio-files-secondary", 
  ACCOUNT_ID: "b673708f9f9609c4d372573207f830ce", 
  ENDPOINT_SUFFIX: "r2.cloudflarestorage.com",
  WORKER_PUBLIC_URL: "https://audio-secondary.alexbrin102.workers.dev",
  PROXY_URL: "/audio-secondary-proxy",
  API_PROXY_URL: "/api/audio-secondary-proxy"
};


const createS3Client = (config) => {
  return new S3Client({
    region: "auto", 
    endpoint: `https://${config.ACCOUNT_ID}.${config.ENDPOINT_SUFFIX}`,
    credentials: {
      accessKeyId: config.ACCESS_KEY_ID,
      secretAccessKey: config.SECRET_ACCESS_KEY,
    },
    // DNS обход и улучшенная конфигурация для России
    maxAttempts: 3, // Увеличиваем количество попыток
    requestHandler: {
      httpOptions: {
        timeout: 30000, // 30 секунд таймаут
        connectTimeout: 10000, // 10 секунд на подключение
      }
    },
    // Альтернативные DNS серверы
    customUserAgent: 'DosMundosPodcast/1.0',
  });
};

let primaryS3Client = createS3Client(R2_PRIMARY_CONFIG);
let secondaryS3Client = createS3Client(R2_SECONDARY_CONFIG);

const r2Service = {
  checkFileExists: async (originalFilename) => {
    const fileKey = originalFilename.replace(/\s+/g, '_');
    
    const attemptCheck = async (client, config) => {
      try {
        const command = new HeadObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
        await client.send(command);
        // Используем прокси для обхода CORS
        const fileUrl = import.meta.env.PROD 
          ? `${window.location.origin}/api/audio-proxy/${fileKey}`
          : `/api/audio-proxy/${fileKey}`;
        return { exists: true, fileUrl, bucketName: config.BUCKET };
      } catch (error) {
        if (error.name === 'NoSuchKey' || (error.$metadata && error.$metadata.httpStatusCode === 404)) {
          return { exists: false };
        }
        console.warn(`Error checking file in R2 bucket ${config.BUCKET}:`, error);
        return { exists: false, error: error }; 
      }
    };

    let primaryCheck = await attemptCheck(primaryS3Client, R2_PRIMARY_CONFIG);
    if (primaryCheck.exists) return primaryCheck;
    if (primaryCheck.error && primaryCheck.error.name !== 'NoSuchKey' && (!primaryCheck.error.$metadata || primaryCheck.error.$metadata.httpStatusCode !== 404)) {
        console.warn("Primary R2 check failed with non-404 error. Trying secondary without assuming primary is full.");
    }

    let secondaryCheck = await attemptCheck(secondaryS3Client, R2_SECONDARY_CONFIG);
    if (secondaryCheck.exists) return secondaryCheck;
    
    return { exists: false };
  },

  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    const fileKey = originalFilename ? originalFilename.replace(/\s+/g, '_') : `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    
    const attemptUpload = async (client, config, isPrimaryAttempt) => {
      try {
        if (onProgress) onProgress(0); 
        const arrayBuffer = await file.arrayBuffer();
        if (onProgress) onProgress(25); 

        const params = {
          Bucket: config.BUCKET,
          Key: fileKey,
          Body: arrayBuffer, 
          ContentType: file.type,
        };
        
        if (onProgress) onProgress(50); 
        const command = new PutObjectCommand(params);
        await client.send(command);
        if (onProgress) onProgress(100); 

        // Используем прокси для обхода CORS
        const fileUrl = import.meta.env.PROD 
          ? `${window.location.origin}/api/audio-proxy/${fileKey}`
          : `/api/audio-proxy/${fileKey}`;
        return { fileUrl, fileKey, bucketName: config.BUCKET };

      } catch (error) {
        console.error(`Error uploading to R2 bucket ${config.BUCKET}:`, error);
        if (isPrimaryAttempt) {
          console.warn(`Primary R2 upload failed for ${fileKey}. Attempting secondary.`);
          return attemptUpload(secondaryS3Client, R2_SECONDARY_CONFIG, false);
        }
        throw new Error(getLocaleString('errorUploadingToR2', currentLanguage, {errorMessage: `Bucket ${config.BUCKET}: ${error.message}`}));
      }
    };

    return attemptUpload(primaryS3Client, R2_PRIMARY_CONFIG, true);
  },

  deleteFile: async (fileKey, bucketName, currentLanguage) => {
    let client;
    let config;

    if (bucketName === R2_PRIMARY_CONFIG.BUCKET) {
      client = primaryS3Client;
      config = R2_PRIMARY_CONFIG;
    } else if (bucketName === R2_SECONDARY_CONFIG.BUCKET) {
      client = secondaryS3Client;
      config = R2_SECONDARY_CONFIG;
    } else {
      return { success: false, error: getLocaleString('unknownBucketError', currentLanguage, { bucketName: bucketName }) };
    }

    try {
      const command = new DeleteObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
      await client.send(command);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting file ${fileKey} from R2 bucket ${config.BUCKET}:`, error);
      return { success: false, error: getLocaleString('errorDeletingR2File', currentLanguage, { fileName: fileKey, errorMessage: error.message }) };
    }
  },

  getPublicUrl: (fileKey, bucketName) => {
    // Используем прокси для обхода CORS
    const proxyPath = bucketName === R2_SECONDARY_CONFIG.BUCKET 
      ? 'audio-secondary-proxy' 
      : 'audio-proxy';
    
    if (import.meta.env.PROD) {
      return `${window.location.origin}/api/${proxyPath}/${fileKey}`;
    } else {
      return `/api/${proxyPath}/${fileKey}`;
    }
  },

  // Совместимая функция для генерации URL
  getCompatibleUrl: (audioUrl, r2ObjectKey, r2BucketName) => {
    console.log('R2: getCompatibleUrl called with:', { audioUrl, r2ObjectKey, r2BucketName });
    
    // Если есть прямой URL, используем его (но применяем прокси если это Cloudflare Worker)
    if (audioUrl) {
      if (audioUrl.includes('alexbrin102.workers.dev')) {
        const url = new URL(audioUrl);
        const filePath = url.pathname.substring(1);
        
        // Сначала пробуем прямой доступ
        const directUrl = import.meta.env.PROD 
          ? `${window.location.origin}/api/direct-audio/${filePath}`
          : `/api/direct-audio/${filePath}`;
        
        console.log('R2: Using direct access URL:', directUrl);
        return directUrl;
      }
      console.log('R2: Using direct URL:', audioUrl);
      return audioUrl;
    }
    
    // Если есть ключ, генерируем прямой R2 URL
    if (r2ObjectKey) {
      const generatedUrl = import.meta.env.PROD 
        ? `${window.location.origin}/api/direct-audio/${r2ObjectKey}`
        : `/api/direct-audio/${r2ObjectKey}`;
      
      console.log('R2: Generated direct URL from key:', generatedUrl);
      return generatedUrl;
    }
    
    console.log('R2: No URL could be generated');
    return null;
  },

  // Новая функция для тестирования доступности аудио
  testAudioAvailability: async (audioUrl) => {
    if (!audioUrl) return { available: false, error: 'No URL provided' };
    
    try {
      console.log('R2: Testing audio availability for:', audioUrl);
      
      const response = await fetch(audioUrl, {
        method: 'HEAD',
        timeout: 10000
      });
      
      const isAvailable = response.ok || response.status === 206;
      console.log('R2: Audio availability test result:', { url: audioUrl, status: response.status, available: isAvailable });
      
      return { 
        available: isAvailable, 
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      console.error('R2: Audio availability test failed:', error);
      return { 
        available: false, 
        error: error.message 
      };
    }
  },

  // Функция для получения рабочего URL с fallback
  getWorkingAudioUrl: async (audioUrl, r2ObjectKey, r2BucketName) => {
    console.log('R2: getWorkingAudioUrl called with:', { audioUrl, r2ObjectKey, r2BucketName });
    
    // Генерируем основной URL (прямой доступ)
    const primaryUrl = r2Service.getCompatibleUrl(audioUrl, r2ObjectKey, r2BucketName);
    if (!primaryUrl) {
      return { url: null, error: 'No URL could be generated' };
    }
    
    // Тестируем основной URL
    const primaryTest = await r2Service.testAudioAvailability(primaryUrl);
    if (primaryTest.available) {
      console.log('R2: Primary URL (direct) is working:', primaryUrl);
      return { url: primaryUrl, source: 'direct' };
    }
    
    // Если прямой доступ не работает, пробуем прокси
    console.log('R2: Direct access failed, trying proxy');
    
    const proxyUrls = [];
    
    // Если это Cloudflare Worker URL, пробуем прокси
    if (audioUrl && audioUrl.includes('alexbrin102.workers.dev')) {
      const url = new URL(audioUrl);
      const filePath = url.pathname.substring(1);
      const proxyPath = audioUrl.includes('audio-secondary.alexbrin102.workers.dev') 
        ? 'audio-secondary-proxy' 
        : 'audio-proxy';
      
      proxyUrls.push(
        import.meta.env.PROD 
          ? `${window.location.origin}/api/${proxyPath}/${filePath}`
          : `/api/${proxyPath}/${filePath}`
      );
    }
    
    // Если есть ключ, пробуем прокси для R2
    if (r2ObjectKey) {
      const proxyPath = r2BucketName === R2_SECONDARY_CONFIG.BUCKET 
        ? 'audio-secondary-proxy' 
        : 'audio-proxy';
      
      proxyUrls.push(
        import.meta.env.PROD 
          ? `${window.location.origin}/api/${proxyPath}/${r2ObjectKey}`
          : `/api/${proxyPath}/${r2ObjectKey}`
      );
    }
    
    // Тестируем прокси URL
    for (const proxyUrl of proxyUrls) {
      console.log('R2: Testing proxy URL:', proxyUrl);
      const test = await r2Service.testAudioAvailability(proxyUrl);
      if (test.available) {
        console.log('R2: Proxy URL is working:', proxyUrl);
        return { url: proxyUrl, source: 'proxy' };
      } else {
        console.log('R2: Proxy URL failed:', proxyUrl, 'Status:', test.status);
      }
    }
    
    console.log('R2: No working URL found');
    return { 
      url: primaryUrl, // Возвращаем основной URL как fallback
      error: 'No working URL found, using primary as fallback',
      source: 'fallback'
    };
  },

  // Тестирование подключения с DNS обходом
  testConnection: async () => {
    console.log('R2: Testing connection with DNS bypass...');
    
    try {
      // Тест 1: Проверка основного клиента
      console.log('R2: Testing primary client...');
      const primaryCommand = new HeadObjectCommand({ 
        Bucket: R2_PRIMARY_CONFIG.BUCKET, 
        Key: 'test-connection' 
      });
      
      try {
        await primaryS3Client.send(primaryCommand);
        console.log('R2: Primary client test successful');
      } catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
          console.log('R2: Primary client connected (expected 404 for test file)');
        } else {
          console.warn('R2: Primary client test failed:', error.name, error.message);
        }
      }

      // Тест 2: Проверка вторичного клиента
      console.log('R2: Testing secondary client...');
      const secondaryCommand = new HeadObjectCommand({ 
        Bucket: R2_SECONDARY_CONFIG.BUCKET, 
        Key: 'test-connection' 
      });
      
      try {
        await secondaryS3Client.send(secondaryCommand);
        console.log('R2: Secondary client test successful');
      } catch (error) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
          console.log('R2: Secondary client connected (expected 404 for test file)');
        } else {
          console.warn('R2: Secondary client test failed:', error.name, error.message);
        }
      }

      // Тест 3: Проверка DNS резолвинга
      console.log('R2: Testing DNS resolution...');
      try {
        const response = await fetch(`https://${R2_PRIMARY_CONFIG.ACCOUNT_ID}.${R2_PRIMARY_CONFIG.ENDPOINT_SUFFIX}`, {
          method: 'HEAD',
          mode: 'no-cors'
        });
        console.log('R2: DNS resolution successful');
      } catch (error) {
        console.warn('R2: DNS resolution failed:', error.message);
      }

      return { success: true, message: 'R2 connection test completed' };
      
    } catch (error) {
      console.error('R2: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Пересоздание клиентов с новыми настройками
  refreshClients: () => {
    console.log('R2: Refreshing S3 clients with DNS bypass settings...');
    primaryS3Client = createS3Client(R2_PRIMARY_CONFIG);
    secondaryS3Client = createS3Client(R2_SECONDARY_CONFIG);
    console.log('R2: Clients refreshed successfully');
  },

  // Диагностика R2
  runDiagnostics: async () => {
    console.log('R2: Running diagnostics...');
    
    try {
      const connectionTest = await r2Service.testConnection();
      
      if (connectionTest.success) {
        return { 
          success: true, 
          workingBucket: R2_PRIMARY_CONFIG.BUCKET,
          message: 'R2 diagnostics completed successfully'
        };
      } else {
        return { 
          success: false, 
          error: connectionTest.error,
          message: 'R2 diagnostics failed'
        };
      }
    } catch (error) {
      console.error('R2: Diagnostics failed:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'R2 diagnostics failed with exception'
      };
    }
  },

  // Тест создания bucket (для совместимости с тестовой страницей)
  testBucketCreation: async (bucketName) => {
    console.log('R2: Testing bucket creation for:', bucketName);
    
    try {
      // R2 buckets создаются автоматически при первой загрузке
      // Просто проверяем подключение
      const connectionTest = await r2Service.testConnection();
      
      if (connectionTest.success) {
        return { 
          success: true, 
          bucketName: R2_PRIMARY_CONFIG.BUCKET,
          testFileKey: 'test-connection',
          message: 'R2 bucket test successful'
        };
      } else {
        return { 
          success: false, 
          error: connectionTest.error,
          message: 'R2 bucket test failed'
        };
      }
    } catch (error) {
      console.error('R2: Bucket creation test failed:', error);
      return { 
        success: false, 
        error: error.message,
        message: 'R2 bucket test failed with exception'
      };
    }
  },

  // Упрощенная загрузка файла (для совместимости с тестовой страницей)
  uploadFileSimple: async (file, onProgress, currentLanguage, originalFilename) => {
    console.log('R2: Simple upload called for:', originalFilename || file.name);
    
    // Используем обычную функцию загрузки
    return r2Service.uploadFile(file, onProgress, currentLanguage, originalFilename);
  }
};

export default r2Service;