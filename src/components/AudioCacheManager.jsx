import React, { useState, useEffect } from 'react';
import { Download, Trash2, HardDrive, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getLocaleString } from '@/lib/locales';
import audioCacheService from '@/lib/audioCacheService';

const AudioCacheManager = ({ 
  currentLanguage = 'ru', 
  episodeData = null,
  showInline = false,
  className = ""
}) => {
  const [cacheStats, setCacheStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [isCached, setIsCached] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    loadCacheStats();
    
    if (episodeData?.audio_url) {
      checkIfCached();
    }

    // Подписываемся на события загрузки
    const unsubscribeDownload = audioCacheService.onDownloadProgress((event, data) => {
      if (episodeData && data.episodeSlug === episodeData.slug) {
        switch (event) {
          case 'download_start':
            setIsDownloading(true);
            setDownloadProgress({ progress: 0, loaded: 0, total: 0 });
            break;
          case 'download_progress':
            setDownloadProgress({
              progress: data.progress,
              loaded: data.loaded,
              total: data.total
            });
            break;
          case 'download_complete':
            setIsDownloading(false);
            setIsCached(true);
            setDownloadProgress({});
            loadCacheStats(); // Обновляем статистику
            break;
          case 'download_error':
            setIsDownloading(false);
            setDownloadProgress({});
            break;
        }
      }
    });

    return () => {
      unsubscribeDownload();
    };
  }, [episodeData]);

  const loadCacheStats = async () => {
    try {
      const stats = await audioCacheService.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfCached = async () => {
    if (!episodeData?.audio_url) return;
    
    try {
      const cached = await audioCacheService.isAudioCached(episodeData.audio_url);
      setIsCached(cached);
    } catch (error) {
      console.error('Error checking cache status:', error);
    }
  };

  const handleDownloadEpisode = async () => {
    if (!episodeData?.audio_url || isDownloading) return;

    try {
      await audioCacheService.cacheAudio(episodeData.audio_url, episodeData.slug);
    } catch (error) {
      console.error('Error downloading episode:', error);
    }
  };

  const handleRemoveEpisode = async () => {
    if (!episodeData?.audio_url) return;

    try {
      await audioCacheService.removeAudioFromCache(episodeData.audio_url);
      setIsCached(false);
      loadCacheStats();
    } catch (error) {
      console.error('Error removing episode from cache:', error);
    }
  };

  const handleClearCache = async () => {
    try {
      await audioCacheService.clearCache();
      setIsCached(false);
      loadCacheStats();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Встроенный режим для отдельного эпизода
  if (showInline && episodeData) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {isDownloading ? (
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-blue-500 animate-pulse" />
            <div className="flex flex-col gap-1 min-w-[100px]">
              <div className="text-xs text-slate-400">
                {downloadProgress.progress || 0}%
              </div>
              <Progress 
                value={downloadProgress.progress || 0} 
                className="h-1"
              />
            </div>
          </div>
        ) : isCached ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-400">
              {getLocaleString('cached', currentLanguage) || 'Кешировано'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveEpisode}
              className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadEpisode}
            className="flex items-center gap-1 h-6 px-2 text-blue-400 hover:text-blue-300"
          >
            <Download className="h-3 w-3" />
            <span className="text-xs">
              {getLocaleString('cache', currentLanguage) || 'Кешировать'}
            </span>
          </Button>
        )}
      </div>
    );
  }

  // Полный режим управления кешем
  if (isLoading) {
    return (
      <div className={`p-4 bg-slate-800 rounded-lg ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-2"></div>
          <div className="h-2 bg-slate-700 rounded w-full mb-4"></div>
          <div className="h-8 bg-slate-700 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-slate-800 rounded-lg space-y-4 ${className}`}>
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {getLocaleString('audioCache', currentLanguage) || 'Кеш аудио'}
        </h3>
        <div className="flex items-center gap-2">
          {navigator.onLine ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      {/* Статистика использования */}
      {cacheStats && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">
              {getLocaleString('cacheUsage', currentLanguage) || 'Использование кеша'}
            </span>
            <span className="text-white">
              {formatBytes(cacheStats.totalSize)} / {formatBytes(cacheStats.maxSize)}
            </span>
          </div>
          
          <Progress 
            value={cacheStats.usagePercentage} 
            className="h-2"
          />
          
          <div className="flex justify-between text-xs text-slate-500">
            <span>
              {cacheStats.fileCount} {getLocaleString('files', currentLanguage) || 'файлов'}
            </span>
            <span>
              {cacheStats.usagePercentage}% {getLocaleString('used', currentLanguage) || 'использовано'}
            </span>
          </div>
        </div>
      )}

      {/* Действия для текущего эпизода */}
      {episodeData && (
        <div className="border-t border-slate-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-white">
                {episodeData.title}
              </div>
              <div className="text-xs text-slate-400">
                {getLocaleString('currentEpisode', currentLanguage) || 'Текущий эпизод'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isCached ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
          </div>

          {isDownloading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">
                  {getLocaleString('downloading', currentLanguage) || 'Загрузка...'}
                </span>
                <span className="text-blue-400">
                  {downloadProgress.progress || 0}%
                </span>
              </div>
              <Progress 
                value={downloadProgress.progress || 0} 
                className="h-2"
              />
              {downloadProgress.total > 0 && (
                <div className="text-xs text-slate-500 text-center">
                  {formatBytes(downloadProgress.loaded)} / {formatBytes(downloadProgress.total)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              {isCached ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemoveEpisode}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {getLocaleString('removeFromCache', currentLanguage) || 'Удалить из кеша'}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownloadEpisode}
                  className="flex-1"
                  disabled={!navigator.onLine}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {getLocaleString('cacheForOffline', currentLanguage) || 'Кешировать для офлайн'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Управление кешем */}
      <div className="border-t border-slate-700 pt-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm font-medium text-white">
              {getLocaleString('cacheManagement', currentLanguage) || 'Управление кешем'}
            </div>
            <div className="text-xs text-slate-400">
              {getLocaleString('manageStoredAudio', currentLanguage) || 'Управление сохраненными аудиофайлами'}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            disabled={!cacheStats || cacheStats.fileCount === 0}
            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {getLocaleString('clearAll', currentLanguage) || 'Очистить все'}
          </Button>
        </div>
      </div>

      {/* Список кешированных файлов */}
      {cacheStats && cacheStats.files.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <div className="text-sm font-medium text-white mb-3">
            {getLocaleString('cachedFiles', currentLanguage) || 'Кешированные файлы'}
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {cacheStats.files.map((file, index) => (
              <div key={index} className="flex items-center justify-between text-xs p-2 bg-slate-700/50 rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">
                    {file.episodeSlug}
                  </div>
                  <div className="text-slate-400">
                    {formatBytes(file.size)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => audioCacheService.removeAudioFromCache(file.url)}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioCacheManager;
