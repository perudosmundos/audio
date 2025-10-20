import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, Save, FolderOpen, Clock, Download, RefreshCw } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import audioCacheService from '@/lib/audioCacheService';
import offlineDataService from '@/lib/offlineDataService';
import optimizedCacheService from '@/lib/optimizedCacheService';
import './styles/slider.css';

const CacheSettings = ({ currentLanguage = 'ru', embedded = false }) => {
  const [cacheStats, setCacheStats] = useState({
    totalSize: 0,
    fileCount: 0,
    maxSize: 0,
    files: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [maxCacheSizeGB, setMaxCacheSizeGB] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showFileList, setShowFileList] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState(null);

  useEffect(() => {
    loadCacheStats();
    loadMaxCacheSize();
    loadStorageEstimate();
  }, []);

  const loadStorageEstimate = async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageEstimate(estimate);
      }
    } catch (error) {
      console.error('Error getting storage estimate:', error);
    }
  };

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
        storageUsage: storageStats.usage || 0,
        files: audioStats.files || []
      });
      
      // Обновляем оценку хранилища
      await loadStorageEstimate();
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
        storageUsage: 0,
        files: []
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

  const handleClearCache = async () => {
    if (!confirm(getLocaleString('confirmClearCache', currentLanguage))) {
      return;
    }

    try {
      setIsLoading(true);
      await audioCacheService.clearCache();
      await loadCacheStats();
      setShowFileList(false);
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = async (url) => {
    try {
      setIsLoading(true);
      await audioCacheService.removeAudioFromCache(url);
      await loadCacheStats();
    } catch (error) {
      console.error('Error removing file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return getLocaleString('justNow', currentLanguage) || 'Just now';
    if (diffMins < 60) return `${diffMins} ${getLocaleString('minutesAgo', currentLanguage) || 'min ago'}`;
    if (diffHours < 24) return `${diffHours} ${getLocaleString('hoursAgo', currentLanguage) || 'h ago'}`;
    if (diffDays < 7) return `${diffDays} ${getLocaleString('daysAgo', currentLanguage) || 'd ago'}`;
    
    return date.toLocaleDateString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US');
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

  // Если компонент встроенный (embedded), возвращаем только контент без кнопки
  if (embedded) {
    return (
      <div className="space-y-6">
        {/* Общая информация о хранилище */}
        {storageEstimate && (
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-white mb-3">
              Общее хранилище браузера
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Использовано</span>
                <span className="text-white font-medium">
                  {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
                </span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${Math.min(100, (storageEstimate.usage / storageEstimate.quota) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-500">
                Доступно: {formatBytes(storageEstimate.quota - storageEstimate.usage)}
              </div>
            </div>
          </div>
        )}

        {/* Статистика использования кэша */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">
              {getLocaleString('cacheUsage', currentLanguage)}
            </h4>
            <button
              onClick={loadCacheStats}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600/50 rounded transition-colors disabled:opacity-50"
              title={getLocaleString('refresh', currentLanguage)}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Размер кэша</span>
              <span className={`text-sm font-medium ${getUsageColor()}`}>
                {formatBytes(cacheStats.totalSize)} / {formatBytes(cacheStats.maxSize)}
              </span>
            </div>
            
            <div className="w-full bg-slate-600 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  getUsagePercentage() < 50 ? 'bg-green-500' :
                  getUsagePercentage() < 80 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${getUsagePercentage()}%` }}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <div className="font-medium text-white">{cacheStats.audioFiles || 0}</div>
                <div className="text-slate-400">Аудио</div>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <div className="font-medium text-white">{cacheStats.optimizedItems || 0}</div>
                <div className="text-slate-400">Данные</div>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <div className="font-medium text-white">{getUsagePercentage()}%</div>
                <div className="text-slate-400">Занято</div>
              </div>
            </div>
          </div>
        </div>

        {/* Настройка максимального размера кеша */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-white">
                {getLocaleString('maxCacheSize', currentLanguage)}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {maxCacheSizeGB} ГБ
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 rounded transition-colors disabled:opacity-50"
            >
              <Save className="h-3 w-3" />
              {getLocaleString('save', currentLanguage)}
            </button>
          </div>
        </div>

        {/* Управление файлами */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">
              {getLocaleString('cachedFiles', currentLanguage)}
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFileList(!showFileList)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
              >
                <FolderOpen className="h-3 w-3" />
                {showFileList ? 'Скрыть' : `Показать (${cacheStats.files.length})`}
              </button>
              <button
                onClick={handleClearCache}
                disabled={isLoading || cacheStats.fileCount === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Очистить всё
              </button>
            </div>
          </div>

          {/* Список файлов */}
          {showFileList && cacheStats.files.length > 0 && (
            <div className="space-y-2 mt-3 max-h-64 overflow-y-auto custom-scrollbar">
              {cacheStats.files.map((file, index) => (
                <div 
                  key={index} 
                  className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate mb-1">
                        {file.episodeSlug || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {formatBytes(file.size || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(file.lastAccessed || file.cachedAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(file.url)}
                      disabled={isLoading}
                      className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors disabled:opacity-50"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showFileList && cacheStats.files.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              Нет кэшированных файлов
            </div>
          )}
        </div>
      </div>
    );
  }

  // Оригинальный режим с кнопкой (для обратной совместимости)
  return (
    <div className="relative">
      <button
        onClick={loadCacheStats}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        title={getLocaleString('cacheSettings', currentLanguage)}
      >
        <HardDrive className="h-4 w-4" />
        <span className="hidden sm:inline">
          {formatBytes(cacheStats.totalSize)}
        </span>
      </button>
    </div>
  );
};

export default CacheSettings;
