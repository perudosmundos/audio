import React, { useState, useEffect } from 'react';
import { Settings, HardDrive, Trash2, Save } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import audioCacheService from '@/lib/audioCacheService';
import offlineDataService from '@/lib/offlineDataService';
import optimizedCacheService from '@/lib/optimizedCacheService';
import './styles/slider.css';

const CacheSettings = ({ currentLanguage = 'ru' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cacheStats, setCacheStats] = useState({
    totalSize: 0,
    fileCount: 0,
    maxSize: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [maxCacheSizeGB, setMaxCacheSizeGB] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCacheStats();
    loadMaxCacheSize();
  }, []);

  const loadCacheStats = async () => {
    try {
      setIsLoading(true);

      // Получаем статистику аудио кэша из audioCacheService
      const audioStats = await audioCacheService.getCacheStats();

      // Получаем статистику оптимизированного кэша
      let optimizedStats = {};
      try {
        // Проверяем, доступен ли сервис оптимизированного кэша
        if (typeof optimizedCacheService !== 'undefined') {
          try {
            optimizedStats = await optimizedCacheService.getCacheStats();
          } catch (e) {
            console.debug('Optimized cache service error:', e);
          }
        }
      } catch (e) {
        console.debug('Optimized cache service not available');
      }

      // Получаем общую статистику хранилища из offlineDataService
      const storageStats = await offlineDataService.getStorageUsage();

      // Подсчитываем общую статистику
      const totalOptimizedSize = Object.values(optimizedStats).reduce((sum, type) => sum + (type.estimatedSize || 0), 0);
      const totalOptimizedItems = Object.values(optimizedStats).reduce((sum, type) => sum + (type.itemCount || 0), 0);

      setCacheStats({
        totalSize: (audioStats.totalSize || 0) + totalOptimizedSize,
        fileCount: (audioStats.fileCount || 0) + totalOptimizedItems,
        maxSize: audioStats.maxSize || 1024 * 1024 * 1024,
        audioFiles: audioStats.fileCount || 0,
        optimizedItems: totalOptimizedItems,
        storageQuota: storageStats.quota || 0,
        storageUsage: storageStats.usage || 0
      });
    } catch (error) {
      console.error('Error loading cache stats:', error);
      // Устанавливаем значения по умолчанию при ошибке
      setCacheStats({
        totalSize: 0,
        fileCount: 0,
        maxSize: 1024 * 1024 * 1024,
        audioFiles: 0,
        optimizedItems: 0,
        storageQuota: 0,
        storageUsage: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMaxCacheSize = () => {
    const maxSizeBytes = audioCacheService.getMaxCacheSize();
    const maxSizeGB = Math.round(maxSizeBytes / (1024 * 1024 * 1024) * 10) / 10; // Округляем до 1 знака
    setMaxCacheSizeGB(maxSizeGB);
  };

  const handleSaveMaxCacheSize = async () => {
    try {
      setIsSaving(true);
      const maxSizeBytes = Math.round(maxCacheSizeGB * 1024 * 1024 * 1024);
      audioCacheService.setMaxCacheSize(maxSizeBytes);
      
      // Обновляем статистику
      await loadCacheStats();
    } catch (error) {
      console.error('Error saving max cache size:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleClearCache = async () => {
    if (!confirm(getLocaleString('confirmClearCache', currentLanguage) || 'Очистить весь кеш?')) {
      return;
    }

    try {
      setIsLoading(true);
      await audioCacheService.clearCache();
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUsagePercentage = () => {
    if (cacheStats.maxSize === 0) return 0;
    return Math.round((cacheStats.totalSize / cacheStats.maxSize) * 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage < 50) return 'text-green-400';
    if (percentage < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        title={getLocaleString('cacheSettings', currentLanguage) || 'Настройки кеша'}
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">
          {formatBytes(cacheStats.totalSize)}
        </span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">
                {getLocaleString('cacheSettings', currentLanguage) || 'Настройки кеша'}
              </h3>
            </div>

            <div className="space-y-3">
              {/* Статистика использования */}
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-300">
                    {getLocaleString('cacheUsage', currentLanguage) || 'Использование'}
                  </span>
                  <span className={`text-sm font-medium ${getUsageColor()}`}>
                    {formatBytes(cacheStats.totalSize)} / {formatBytes(cacheStats.maxSize)}
                  </span>
                </div>
                
                <div className="w-full bg-slate-600 rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      getUsagePercentage() < 50 ? 'bg-green-500' :
                      getUsagePercentage() < 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${getUsagePercentage()}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-slate-400">
                  <span>
                    {cacheStats.fileCount} {getLocaleString('files', currentLanguage) || 'файлов'}
                  </span>
                  <span>
                    {getUsagePercentage()}%
                  </span>
                </div>
              </div>

              {/* Настройка максимального размера кеша */}
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">
                    {getLocaleString('maxCacheSize', currentLanguage) || 'Максимальный размер кеша'}
                  </span>
                  <span className="text-sm text-slate-400">
                    {maxCacheSizeGB} ГБ
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={maxCacheSizeGB}
                    onChange={(e) => setMaxCacheSizeGB(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <button
                    onClick={handleSaveMaxCacheSize}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 rounded transition-colors disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {getLocaleString('save', currentLanguage) || 'Сохранить'}
                  </button>
                </div>
              </div>

              {/* Кнопки управления */}
              <div className="flex gap-2">
                <button
                  onClick={loadCacheStats}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {getLocaleString('refresh', currentLanguage) || 'Обновить'}
                </button>
                
                <button
                  onClick={handleClearCache}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-md transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {getLocaleString('clearCache', currentLanguage) || 'Очистить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CacheSettings;
