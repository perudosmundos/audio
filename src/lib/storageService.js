import r2Service from './r2Service';
import vkCloudService from './vkCloudService';
import { getLocaleString } from '@/lib/locales';

// Определяем, какой сервис использовать по умолчанию
// Можно изменить на 'vkCloud' для переключения на VK Cloud
const DEFAULT_STORAGE = 'vkCloud'; // 'r2' или 'vkCloud'

const storageService = {
  checkFileExists: async (originalFilename) => {
    try {
      // Сначала пробуем VK Cloud
      if (DEFAULT_STORAGE === 'vkCloud') {
        const vkResult = await vkCloudService.checkFileExists(originalFilename);
        if (vkResult.exists || !vkResult.error) {
          return vkResult;
        }
        // Если VK Cloud недоступен, пробуем R2
        console.warn('VK Cloud unavailable, falling back to R2');
      }
      
      // Пробуем R2
      const r2Result = await r2Service.checkFileExists(originalFilename);
      return r2Result;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return { exists: false, error };
    }
  },

  uploadFile: async (file, onProgress, currentLanguage, originalFilename) => {
    try {
      // Сначала пробуем VK Cloud
      if (DEFAULT_STORAGE === 'vkCloud') {
        try {
          const result = await vkCloudService.uploadFile(file, onProgress, currentLanguage, originalFilename);
          return result;
        } catch (vkError) {
          console.warn('VK Cloud upload failed, falling back to R2:', vkError);
          // Если VK Cloud недоступен, пробуем R2
        }
      }
      
      // Пробуем R2
      const result = await r2Service.uploadFile(file, onProgress, currentLanguage, originalFilename);
      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  deleteFile: async (fileKey, bucketName, currentLanguage) => {
    try {
      // Определяем тип хранилища по имени bucket
      if (bucketName && bucketName.includes('vk-cloud') || bucketName === 'vk-cloud-bucket') {
        return await vkCloudService.deleteFile(fileKey, bucketName, currentLanguage);
      } else {
        return await r2Service.deleteFile(fileKey, bucketName, currentLanguage);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  },

  getPublicUrl: async (fileKey, bucketName) => {
    try {
      // Определяем тип хранилища по имени bucket
      if (bucketName && bucketName.includes('vk-cloud') || bucketName === 'vk-cloud-bucket') {
        return await vkCloudService.getPublicUrl(fileKey, bucketName);
      } else {
        return r2Service.getPublicUrl(fileKey, bucketName);
      }
    } catch (error) {
      console.error('Error getting public URL:', error);
      throw error;
    }
  },

  // Метод для получения информации о текущем хранилище
  getStorageInfo: () => {
    return {
      defaultStorage: DEFAULT_STORAGE,
      isVKCloud: DEFAULT_STORAGE === 'vkCloud',
      isR2: DEFAULT_STORAGE === 'r2'
    };
  }
};

export default storageService; 