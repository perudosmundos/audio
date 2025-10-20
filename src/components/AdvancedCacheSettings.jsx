import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, RefreshCw, Download, Wifi, WifiOff, Calendar, FileText } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import audioCacheService from '@/lib/audioCacheService';
import { supabase } from '@/lib/supabaseClient';

const AdvancedCacheSettings = ({ currentLanguage = 'ru' }) => {
  const [cacheStats, setCacheStats] = useState({
    totalSize: 0,
    fileCount: 0,
    maxSize: 0,
    files: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [episodesData, setEpisodesData] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageEstimate, setStorageEstimate] = useState(null);

  useEffect(() => {
    loadCacheStats();
    loadStorageEstimate();
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const handleOnlineStatus = () => {
    setIsOnline(navigator.onLine);
  };

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
      const stats = await audioCacheService.getCacheStats();
      setCacheStats(stats);
      
      // Загружаем данные эпизодов для отображения названий
      await loadEpisodesData(stats.files);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEpisodesData = async (cachedFiles) => {
    try {
      const slugs = cachedFiles.map(file => file.episodeSlug).filter(Boolean);
      if (slugs.length === 0) return;

      const { data: episodes, error } = await supabase
        .from('episodes')
        .select('slug, title, date, lang')
        .in('slug', slugs);

      if (!error && episodes) {
        const episodesMap = {};
        episodes.forEach(ep => {
          episodesMap[ep.slug] = ep;
        });
        setEpisodesData(episodesMap);
      }
    } catch (error) {
      console.error('Error loading episodes data:', error);
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
    if (!timestamp) return 'Неизвестно';
    return new Date(timestamp).toLocaleDateString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US');
  };

  const getEpisodeTitle = (episodeSlug) => {
    const episode = episodesData[episodeSlug];
    return episode ? episode.title : episodeSlug || 'Неизвестный эпизод';
  };

  const getEpisodeLanguage = (episodeSlug) => {
    const episode = episodesData[episodeSlug];
    return episode ? episode.lang.toUpperCase() : '?';
  };

  const handleRemoveFile = async (url) => {
    if (!confirm(getLocaleString('confirmRemoveFile', currentLanguage) || 'Удалить этот файл из кэша?')) {
      return;
    }

    try {
      await audioCacheService.removeAudioFromCache(url);
      await loadCacheStats();
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const handleRefreshFile = async (url) => {
    try {
      await audioCacheService.refreshCachedAudio(url);
      await loadCacheStats();
    } catch (error) {
      console.error('Error refreshing file:', error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(getLocaleString('confirmClearCache', currentLanguage) || 'Очистить весь кеш?')) {
      return;
    }

    try {
      await audioCacheService.clearCache();
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const getFileStatus = (file) => {
    // В реальном приложении здесь можно проверить доступность файла
    return isOnline ? 'online' : 'offline';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <Wifi className="h-4 w-4 text-green-400" />;
      case 'offline':
        return <WifiOff className="h-4 w-4 text-yellow-400" />;
      default:
        return <Wifi className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {getLocaleString('cacheSettings', currentLanguage) || 'Настройки кэша'}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Управление загруженными файлами и хранилищем
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadCacheStats();
              loadStorageEstimate();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {getLocaleString('refresh', currentLanguage) || 'Обновить'}
          </button>
        </div>
      </div>

      {/* Общая информация о хранилище браузера */}
      {storageEstimate && (
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <HardDrive className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-white">
                Хранилище браузера
              </h4>
              <p className="text-sm text-blue-200/70">
                {formatBytes(storageEstimate.usage)} из {formatBytes(storageEstimate.quota)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-white">
                {Math.round((storageEstimate.usage / storageEstimate.quota) * 100)}%
              </div>
              <div className="text-xs text-blue-200/70">
                Свободно: {formatBytes(storageEstimate.quota - storageEstimate.usage)}
              </div>
            </div>
          </div>
          
          <div className="w-full bg-slate-700/50 rounded-full h-2.5">
            <div 
              className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all shadow-lg shadow-blue-500/50"
              style={{ width: `${Math.min(100, Math.round((storageEstimate.usage / storageEstimate.quota) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Статистика кэша аудиофайлов */}
      <div className="bg-slate-700/50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <Download className="h-6 w-6 text-green-400" />
          <div className="flex-1">
            <h4 className="font-medium text-white">
              {getLocaleString('cacheUsage', currentLanguage) || 'Кэш аудиофайлов'}
            </h4>
            <p className="text-sm text-slate-400">
              {cacheStats.fileCount} {getLocaleString('files', currentLanguage) || 'файлов'} • {formatBytes(cacheStats.totalSize)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-white">
              {Math.round((cacheStats.totalSize / cacheStats.maxSize) * 100)}%
            </div>
            <div className="text-xs text-slate-400">
              из {formatBytes(cacheStats.maxSize)}
            </div>
          </div>
        </div>
        
        <div className="w-full bg-slate-600 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              (cacheStats.totalSize / cacheStats.maxSize) > 0.8 
                ? 'bg-red-500' 
                : (cacheStats.totalSize / cacheStats.maxSize) > 0.5 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, Math.round((cacheStats.totalSize / cacheStats.maxSize) * 100))}%` }}
          />
        </div>
      </div>

      {/* Список файлов */}
      <div className="bg-slate-700/50 rounded-lg">
        <div className="p-4 border-b border-slate-600">
          <h4 className="font-medium text-white">
            {getLocaleString('cachedFiles', currentLanguage) || 'Скачанные файлы'}
          </h4>
          <p className="text-sm text-slate-400">
            {cacheStats.files.length} {getLocaleString('files', currentLanguage) || 'файлов'}
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>{getLocaleString('loading', currentLanguage) || 'Загрузка...'}</p>
            </div>
          ) : cacheStats.files.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{getLocaleString('noCachedFiles', currentLanguage) || 'Нет скачанных файлов'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-600">
              {cacheStats.files.map((file, index) => (
                <div key={file.url || index} className="p-4 hover:bg-slate-600/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(getFileStatus(file))}
                        <span className="text-sm font-medium text-white truncate">
                          {getEpisodeTitle(file.episodeSlug)}
                        </span>
                        <span className="px-1.5 py-0.5 text-xs bg-slate-600 rounded text-slate-300">
                          {getEpisodeLanguage(file.episodeSlug)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(file.lastAccessed)}
                        </span>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                      
                      <div className="mt-2 text-xs text-slate-500 truncate">
                        {file.url}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRefreshFile(file.url)}
                        disabled={!isOnline}
                        className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-30"
                        title={getLocaleString('refreshFile', currentLanguage) || 'Обновить файл'}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveFile(file.url)}
                        className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                        title={getLocaleString('removeFile', currentLanguage) || 'Удалить файл'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cacheStats.files.length > 0 && (
          <div className="p-4 border-t border-slate-600">
            <button
              onClick={handleClearAll}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {getLocaleString('clearAllCache', currentLanguage) || 'Очистить весь кеш'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedCacheSettings;
