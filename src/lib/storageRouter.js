import r2Service from '@/lib/r2Service';
import hostingerSFTPService from '@/lib/hostingerSFTPService';
import logger from '@/lib/logger';

/**
 * Storage Router - selects appropriate storage service
 * New files → Hostinger SFTP
 * Existing files → R2
 */
const storageRouter = {
  /**
   * Upload file - always uses Hostinger for new files
   */
  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    logger.info('[StorageRouter] Uploading to R2 (fallback to R2)');
    return r2Service.uploadFile(file, onProgress, currentLanguage, originalFilename);
  },

  /**
   * Delete file - uses storage_provider from database to determine which service to use
   */
  deleteFile: async (fileKey, bucketName, currentLanguage, storageProvider = 'r2') => {
    const provider = storageProvider?.toLowerCase() === 'hostinger' ? 'hostinger' : 'r2';
    
    logger.info(`[StorageRouter] Deleting ${fileKey} from ${provider}`);
    
    if (provider === 'hostinger') {
      return hostingerSFTPService.deleteFile(fileKey, bucketName, currentLanguage);
    } else {
      return r2Service.deleteFile(fileKey, bucketName, currentLanguage);
    }
  },

  /**
   * Get public URL - uses storage_provider from database
   */
  getPublicUrl: (fileKey, bucketName, storageProvider = 'r2') => {
    const provider = storageProvider?.toLowerCase() === 'hostinger' ? 'hostinger' : 'r2';
    
    if (provider === 'hostinger') {
      return hostingerSFTPService.getPublicUrl(fileKey, bucketName);
    } else {
      return r2Service.getPublicUrl(fileKey, bucketName);
    }
  },

  /**
   * Check file exists - checks both storages for compatibility
   */
  checkFileExists: async (originalFilename) => {
    logger.info(`[StorageRouter] Checking file existence: ${originalFilename}`);
    
    // Проверяем только Hostinger FTP (файлы уже там)
    try {
      const hostingerCheck = await hostingerSFTPService.checkFileExists(originalFilename);
      if (hostingerCheck.exists) {
        logger.info(`[StorageRouter] File found on Hostinger: ${originalFilename}`);
        return hostingerCheck;
      }
    } catch (error) {
      logger.warn(`[StorageRouter] Hostinger check failed: ${error.message}`);
    }

    // Если не найден на Hostinger, считаем что не существует
    logger.info(`[StorageRouter] File not found on Hostinger: ${originalFilename}`);
    return { exists: false };
  },

  /**
   * Test both connections
   */
  testConnections: async () => {
    logger.info('[StorageRouter] Testing storage connections...');
    
    const r2Test = await r2Service.testConnection();
    const hostingerTest = await hostingerSFTPService.testConnection();
    
    return {
      r2: r2Test,
      hostinger: hostingerTest,
      bothWorking: r2Test.success && hostingerTest.success,
      message: `R2: ${r2Test.success ? '✅' : '❌'}, Hostinger: ${hostingerTest.success ? '✅' : '❌'}`
    };
  },
};

export default storageRouter;
