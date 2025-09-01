import { 
  S3Client, 
  PutObjectCommand, 
  HeadObjectCommand, 
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getLocaleString } from '@/lib/locales'; 
import logger from './logger';

// Helpers to get env from Vite or fallback to localStorage (dev only)
const getEnv = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
      return import.meta.env[key];
    }
  } catch (err) {
    logger.warn('Failed to read env var from import.meta.env:', err?.message);
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key) || null;
    }
  } catch (err) {
    logger.warn('Failed to read env var from localStorage:', err?.message);
  }
  return null;
};

// Primary storage: Selectel S3 - now using srvstatic.kz
const buildPublicBase = (bucket, endpoint) => {
  // Always use the new public domain for audio playback
  return 'https://b2a9e188-93e4-4928-a636-2ad4c9e1094e.srvstatic.kz';
};

const R2_PRIMARY_CONFIG = {
  ACCESS_KEY_ID: getEnv('VITE_S3_ACCESS_KEY') || '',
  SECRET_ACCESS_KEY: getEnv('VITE_S3_SECRET_KEY') || '',
  BUCKET: getEnv('VITE_S3_BUCKET') || 'dosmundos-audio',
  ENDPOINT: getEnv('VITE_S3_ENDPOINT') || 'https://s3.kz-1.srvstorage.kz',
  REGION: getEnv('VITE_S3_REGION') || 'kz-1',
  FORCE_PATH_STYLE: false,
  WORKER_PUBLIC_URL: 'https://b2a9e188-93e4-4928-a636-2ad4c9e1094e.srvstatic.kz',
  // Force HTTP/1.1 to avoid HTTP/2 protocol errors
  FORCE_HTTP_1_1: getEnv('VITE_FORCE_HTTP_1_1') !== 'false'
};

// Secondary config disabled
const R2_SECONDARY_CONFIG = null;


const createS3Client = (config) => {
  const endpoint = config.ENDPOINT
    ? config.ENDPOINT
    : `https://${config.ACCOUNT_ID}.${config.ENDPOINT_SUFFIX}`;

  return new S3Client({
    region: config.REGION || "auto",
    endpoint,
    forcePathStyle: Boolean(config.FORCE_PATH_STYLE),
    credentials: {
      accessKeyId: config.ACCESS_KEY_ID,
      secretAccessKey: config.SECRET_ACCESS_KEY,
    },
    // DNS обход и улучшенная конфигурация для России
    maxAttempts: 3,
    requestHandler: {
      httpOptions: {
        timeout: 30000,
        connectTimeout: 10000,
      }
    },
    customUserAgent: 'DosMundosPodcast/1.0',
    // Force HTTP/1.1 to avoid HTTP/2 protocol errors if configured
    ...(config.FORCE_HTTP_1_1 && {
      requestHandler: {
        httpOptions: {
          timeout: 30000,
          connectTimeout: 10000,
          // Force HTTP/1.1
          httpVersion: '1.1'
        }
      }
    }),
  });
};

let primaryS3Client = createS3Client(R2_PRIMARY_CONFIG);
let secondaryS3Client = null;

const r2Service = {
  checkFileExists: async (originalFilename) => {
    const fileKey = originalFilename.replace(/\s+/g, '_');
    
    const attemptCheck = async (client, config) => {
      try {
        const command = new HeadObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
        await client.send(command);
        const fileUrl = `${config.WORKER_PUBLIC_URL}/${fileKey}`;
        return { exists: true, fileUrl, bucketName: config.BUCKET };
      } catch (error) {
        if (error.name === 'NoSuchKey' || (error.$metadata && error.$metadata.httpStatusCode === 404)) {
          return { exists: false };
        }
        console.warn(`Error checking file in R2 bucket ${config.BUCKET}:`, error);
        return { exists: false, error: error }; 
      }
    };

    const primaryCheck = await attemptCheck(primaryS3Client, R2_PRIMARY_CONFIG);
    if (primaryCheck.exists) return primaryCheck;
    return { exists: false };
  },

  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    const fileKey = originalFilename ? originalFilename.replace(/\s+/g, '_') : `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const totalBytes = file.size || 0;
    const totalMB = totalBytes ? (totalBytes / (1024 * 1024)).toFixed(2) : '0.00';

    const attemptUpload = async (client, config, isPrimaryAttempt) => {
      try {
        if (onProgress) onProgress(0, { stage: 'init', message: 'Инициализация загрузки…', uploadedMB: '0.00', totalMB });

        const isIA = !!config.ENDPOINT && config.ENDPOINT.includes('s3.us.archive.org');

        // Route IA uploads via our API for reliable progress + compatibility
        if (isIA && typeof window !== 'undefined') {
          const proxyBaseEnv = getEnv('VITE_IA_PROXY_BASE');
          const isProd = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) || /vercel\.app$/.test(window.location.hostname);
          const base = proxyBaseEnv || (isProd ? '' : null);
          const proxyUrl = base !== null ? `${base}/api/ia-upload?key=${encodeURIComponent(fileKey)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}` : null;
          if (proxyUrl) {
            logger.info(`[Upload] ${fileKey}: uploading via proxy ${proxyUrl}`);
            let proxyStatus = 0;
            let proxyErrorText = '';
            try {
              await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', proxyUrl);
                xhr.responseType = 'json';
                const timeoutMs = 5 * 60 * 1000;
                xhr.timeout = timeoutMs;
                xhr.upload.onprogress = (e) => {
                  if (!e.lengthComputable) return;
                  const percent = Math.floor((e.loaded / Math.max(e.total || totalBytes || 1, 1)) * 100);
                  const uploadedMBNow = ((e.loaded) / (1024 * 1024)).toFixed(2);
                  if (onProgress) onProgress(percent, { stage: 'client-upload', message: 'Загрузка файла…', uploadedMB: uploadedMBNow, totalMB });
                };
                xhr.onload = () => {
                  proxyStatus = xhr.status;
                  if (xhr.status >= 200 && xhr.status < 300) return resolve();
                  proxyErrorText = (xhr.response && xhr.response.error) || xhr.statusText || '';
                  reject(new Error(`Proxy upload failed: ${xhr.status}`));
                };
                xhr.onerror = () => reject(new Error('Network error while uploading to proxy'));
                xhr.ontimeout = () => reject(new Error('Proxy upload timeout'));
                xhr.send(file);
              });
              if (onProgress) onProgress(100, { stage: 'finalizing', message: 'Отправка на archive.org…', uploadedMB: totalMB, totalMB });
              const fileUrl = `${config.WORKER_PUBLIC_URL}/${fileKey}`;
              logger.info(`[Upload] ${fileKey}: completed via proxy. URL: ${fileUrl}`);
              return { fileUrl, fileKey, bucketName: config.BUCKET };
            } catch (proxyErr) {
              logger.warn(`[Upload] ${fileKey}: proxy failed (${proxyStatus}) ${proxyErrorText || proxyErr.message}. Falling back to direct upload.`);
              // continue to direct upload below
            }
          }
        }

        // Use browser PUT to pre-signed URL to avoid ReadableStream issues
        let presignedUrl = null;
        const isProd = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD);
        if (isProd) {
          const presignResp = await fetch(`/api/s3-presign?key=${encodeURIComponent(fileKey)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`);
          if (!presignResp.ok) throw new Error(`Presign failed: ${presignResp.status}`);
          const json = await presignResp.json();
          presignedUrl = json?.url || null;
        } else {
          // Dev: подписываем прямо в браузере (ключи уже в VITE_*)
          const localClient = new S3Client({
            region: R2_PRIMARY_CONFIG.REGION,
            endpoint: R2_PRIMARY_CONFIG.ENDPOINT,
            forcePathStyle: Boolean(R2_PRIMARY_CONFIG.FORCE_PATH_STYLE) === true,
            credentials: {
              accessKeyId: R2_PRIMARY_CONFIG.ACCESS_KEY_ID,
              secretAccessKey: R2_PRIMARY_CONFIG.SECRET_ACCESS_KEY,
            },
          });
          presignedUrl = await getSignedUrl(localClient, new PutObjectCommand({
            Bucket: R2_PRIMARY_CONFIG.BUCKET,
            Key: fileKey,
            ContentType: file.type || 'application/octet-stream',
          }), { expiresIn: 3600 });
        }
        if (!presignedUrl) throw new Error('Empty presigned URL');
        // Use XHR to report progress during upload with retry logic
        const attemptUpload = async (retryCount = 0, maxRetries = 3) => {
          try {
            // Try XHR first (better progress reporting)
            try {
              await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', presignedUrl);
                xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
                // Force HTTP/1.1 to avoid protocol errors
                xhr.setRequestHeader('Connection', 'keep-alive');
                xhr.upload.onprogress = (e) => {
                  const loaded = e.lengthComputable ? e.loaded : 0;
                  const percent = Math.floor((loaded / Math.max(totalBytes || 1, 1)) * 100);
                  const uploadedMBNow = (loaded / (1024 * 1024)).toFixed(2);
                  if (onProgress) onProgress(percent, { stage: 'uploading', message: 'Загрузка файла…', uploadedMB: uploadedMBNow, totalMB });
                };
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) return resolve();
                  reject(new Error(`PUT failed: ${xhr.status}`));
                };
                xhr.onerror = () => reject(new Error('Network error during PUT'));
                xhr.send(file);
              });
            } catch (xhrError) {
              // If XHR fails with HTTP/2 error, fall back to fetch
              if (xhrError.message.includes('Network error') || xhrError.message.includes('HTTP/2') || xhrError.message.includes('protocol')) {
                logger.warn(`[Upload] ${fileKey}: XHR failed, trying fetch fallback...`);
                
                // Use fetch as fallback (often more reliable with HTTP/2)
                const response = await fetch(presignedUrl, {
                  method: 'PUT',
                  body: file,
                  headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                  },
                });
                
                if (!response.ok) {
                  throw new Error(`Fetch PUT failed: ${response.status}`);
                }
                
                // Report progress for fetch (approximate)
                if (onProgress) onProgress(100, { stage: 'uploading', message: 'Загрузка файла…', uploadedMB: totalMB, totalMB });
              } else {
                throw xhrError;
              }
            }
          } catch (error) {
            if (retryCount < maxRetries && (error.message.includes('Network error') || error.message.includes('HTTP/2') || error.message.includes('protocol') || error.message.includes('Fetch PUT failed'))) {
              logger.warn(`[Upload] ${fileKey}: Upload error, retrying (${retryCount + 1}/${maxRetries})...`);
              // Wait before retry with exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
              return attemptUpload(retryCount + 1, maxRetries);
            }
            throw error;
          }
        };
        
        await attemptUpload();
        if (onProgress) onProgress(100, { stage: 'done', message: 'Готово', uploadedMB: totalMB, totalMB });
        const fileUrl = `${config.WORKER_PUBLIC_URL}/${fileKey}`;
        logger.info(`[Upload] ${fileKey}: completed via presigned PUT. URL: ${fileUrl}`);
        return { fileUrl, fileKey, bucketName: config.BUCKET };

      } catch (error) {
        logger.error(`Error uploading to bucket ${config.BUCKET}:`, error);
        if (isPrimaryAttempt) {
          console.warn(`Primary upload failed for ${fileKey}. Disabling secondary R2 fallback.`);
          // Вместо перехода на R2 secondary, пробросим ошибку — в РФ он недоступен
        }
        throw new Error(getLocaleString('errorUploadingToR2', currentLanguage, {errorMessage: `Bucket ${config.BUCKET}: ${error.message}`}));
      }
    };

    return attemptUpload(primaryS3Client, R2_PRIMARY_CONFIG, true);
  },

  deleteFile: async (fileKey, bucketName, currentLanguage) => {
    const client = primaryS3Client;
    const config = R2_PRIMARY_CONFIG;

    try {
      const command = new DeleteObjectCommand({ Bucket: config.BUCKET, Key: fileKey });
      await client.send(command);
      return { success: true };
    } catch (error) {
      logger.error(`Error deleting file ${fileKey} from R2 bucket ${config.BUCKET}:`, error);
      return { success: false, error: getLocaleString('errorDeletingR2File', currentLanguage, { fileName: fileKey, errorMessage: error.message }) };
    }
  },

  getPublicUrl: (fileKey, bucketName) => {
    const base = R2_PRIMARY_CONFIG.WORKER_PUBLIC_URL;
    return `${base}/${fileKey}`;
  },

  // Совместимая функция для генерации URL
  getCompatibleUrl: (audioUrl, r2ObjectKey, r2BucketName) => {

    const base = R2_PRIMARY_CONFIG.WORKER_PUBLIC_URL;

    // 1) If we have explicit key, always prefer the public base
    if (r2ObjectKey) {
      return `${base}/${r2ObjectKey}`;
    }

    // 2) If we have audioUrl, try to normalize it to the public base
    if (audioUrl) {
      try {
        const urlObj = new URL(audioUrl);
        const isSelectelS3 = /s3\.kz-1\.srvstorage\.kz$/i.test(urlObj.hostname);
        const keyGuess = urlObj.pathname.replace(/^\//, '');

        // If it's coming from Selectel S3, rewrite to the public base
        if (isSelectelS3 && keyGuess) {
          return `${base}/${keyGuess}`;
        }

        // Otherwise, keep the original URL
        return audioUrl;
      } catch (_) {
        // If parsing failed, keep original string
        return audioUrl;
      }
    }

    // 3) Nothing usable
    return null;
  },

  // Тестирование подключения с DNS обходом
  testConnection: async () => {

    
    try {
      // Тест 1: Проверка основного клиента

      const primaryCommand = new HeadObjectCommand({ 
        Bucket: R2_PRIMARY_CONFIG.BUCKET, 
        Key: 'test-connection' 
      });
      
      try {
        await primaryS3Client.send(primaryCommand);

      } catch (error) {
        if (!(error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404)) {
          console.warn('R2: Primary client test failed:', error.name, error.message);
        }
      }

      // Secondary client removed

      // Тест 3: Проверка DNS резолвинга

      try {
        const testUrl = R2_PRIMARY_CONFIG.ENDPOINT
          ? R2_PRIMARY_CONFIG.ENDPOINT
          : `https://${R2_PRIMARY_CONFIG.ACCOUNT_ID}.${R2_PRIMARY_CONFIG.ENDPOINT_SUFFIX}`;
        await fetch(testUrl, { method: 'HEAD', mode: 'no-cors' });
      } catch (error) {
        logger.warn('R2: DNS resolution failed:', error.message);
      }

      return { success: true, message: 'R2 connection test completed' };
      
    } catch (error) {
      logger.error('R2: Connection test failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Пересоздание клиентов с новыми настройками
  refreshClients: () => {

    primaryS3Client = createS3Client(R2_PRIMARY_CONFIG);
    secondaryS3Client = null;

  },

  // Диагностика R2
  runDiagnostics: async () => {

    
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

    
    // Используем обычную функцию загрузки
    return r2Service.uploadFile(file, onProgress, currentLanguage, originalFilename);
  }
};

export default r2Service;