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
    logger.info('[StorageRouter] Uploading to Hostinger');
    return hostingerSFTPService.uploadFile(file, onProgress, currentLanguage, originalFilename);
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
    // Check R2 first (for backward compatibility)
    const r2Result = await r2Service.checkFileExists(originalFilename);
    if (r2Result.exists) {
      return r2Result;
    }

    // Check Hostinger
    const hostingerResult = await hostingerSFTPService.checkFileExists(originalFilename);
    if (hostingerResult.exists) {
      return hostingerResult;
    }

    return { exists: false };
  },

  /**
   * Get correct audio URL based on storage_provider
   */
  getCorrectAudioUrl: (episode) => {
    const provider = episode.storage_provider?.toLowerCase() || 'r2';
    
    console.log('[StorageRouter] getCorrectAudioUrl debug:', {
      slug: episode.slug,
      storageProvider: episode.storage_provider,
      provider: provider,
      audioUrl: episode.audio_url,
      hostingerFileKey: episode.hostinger_file_key,
      r2ObjectKey: episode.r2_object_key,
      r2BucketName: episode.r2_bucket_name
    });
    
    if (provider === 'hostinger') {
      // For Hostinger, use hostinger_file_key to build URL
      if (episode.hostinger_file_key) {
        const hostingerUrl = hostingerSFTPService.getPublicUrl(episode.hostinger_file_key, 'hostinger');
        console.log('[StorageRouter] Using Hostinger URL:', hostingerUrl);
        return hostingerUrl;
      }
      // Fallback to audio_url if hostinger_file_key is missing
      console.log('[StorageRouter] Fallback to audio_url for Hostinger:', episode.audio_url);
      return episode.audio_url;
    } else {
      // For R2, use existing audio_url or build from r2_object_key
      if (episode.audio_url) {
        console.log('[StorageRouter] Using R2 audio_url:', episode.audio_url);
        return episode.audio_url;
      }
      if (episode.r2_object_key) {
        const r2Url = r2Service.getPublicUrl(episode.r2_object_key, episode.r2_bucket_name);
        console.log('[StorageRouter] Built R2 URL:', r2Url);
        return r2Url;
      }
      console.log('[StorageRouter] No URL found for R2');
      return null;
    }
  }
};

export default storageRouter;
