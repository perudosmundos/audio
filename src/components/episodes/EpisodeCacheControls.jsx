import React, { useState, useEffect } from 'react';
import { Download, Trash2, HardDrive, Loader2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import audioCacheService from '@/lib/audioCacheService';

const EpisodeCacheControls = ({ episode, currentLanguage = 'ru' }) => {
  const [isCached, setIsCached] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    checkCacheStatus();
    
    // Подписываемся на события загрузки и удаления
    const unsubscribeDownload = audioCacheService.onDownloadProgress((event, data) => {
      if (data.episodeSlug === episode.slug || data.url === episode.audio_url) {
        switch (event) {
          case 'download_start':
            setIsDownloading(true);
            setDownloadProgress(0);
            break;
          case 'download_progress':
            setDownloadProgress(data.progress || 0);
            break;
          case 'download_complete':
            setIsDownloading(false);
            setIsCached(true);
            setDownloadProgress(0);
            break;
          case 'download_error':
            setIsDownloading(false);
            setDownloadProgress(0);
            break;
          case 'remove_complete':
            setIsCached(false);
            setIsRemoving(false);
            break;
          case 'remove_error':
            setIsRemoving(false);
            console.error('Error removing from cache:', data.error);
            break;
        }
      }
    });

    return () => {
      unsubscribeDownload();
    };
  }, [episode.slug, episode.audio_url]);

  const checkCacheStatus = async () => {
    try {
      const cached = await audioCacheService.isAudioCached(episode.audio_url);
      setIsCached(cached);
    } catch (error) {
      console.error('Error checking cache status:', error);
    }
  };

  const handleDownload = async () => {
    if (!episode.audio_url) return;
    
    try {
      setIsDownloading(true);
      await audioCacheService.cacheAudio(episode.audio_url, episode.slug);
    } catch (error) {
      console.error('Error downloading audio:', error);
      setIsDownloading(false);
    }
  };

  const handleRemove = async () => {
    if (!episode.audio_url) return;
    
    try {
      setIsRemoving(true);
      const success = await audioCacheService.removeAudioFromCache(episode.audio_url);
      if (success) {
        setIsCached(false);
        console.log('Successfully removed from cache:', episode.audio_url);
      } else {
        console.error('Failed to remove from cache');
      }
    } catch (error) {
      console.error('Error removing from cache:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  const getButtonText = () => {
    if (isDownloading) {
      return downloadProgress > 0 ? `${downloadProgress}%` : getLocaleString('downloading', currentLanguage);
    }
    if (isRemoving) {
      return getLocaleString('removing', currentLanguage);
    }
    if (isCached) {
      return getLocaleString('cached', currentLanguage);
    }
    return getLocaleString('cacheForOffline', currentLanguage);
  };

  const getButtonIcon = () => {
    if (isDownloading || isRemoving) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isCached) {
      return <HardDrive className="h-4 w-4" />;
    }
    return <Download className="h-4 w-4" />;
  };

  const getButtonClass = () => {
    if (isDownloading || isRemoving) {
      return "bg-slate-600/50 text-slate-300 cursor-not-allowed";
    }
    if (isCached) {
      return "bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300";
    }
    return "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300";
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={isCached ? handleRemove : handleDownload}
        disabled={isDownloading || isRemoving}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${getButtonClass()}`}
        title={
          isCached 
            ? getLocaleString('removeFromCache', currentLanguage)
            : getLocaleString('cacheForOffline', currentLanguage)
        }
      >
        {isCached ? <Trash2 className="h-3.5 w-3.5" /> : getButtonIcon()}
        <span className="hidden sm:inline">{getButtonText()}</span>
      </button>
      
      {isDownloading && downloadProgress > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800/80 rounded px-2 py-1">
          <div className="w-12 bg-slate-700 rounded-full h-1.5">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <span>{downloadProgress}%</span>
        </div>
      )}
    </div>
  );
};

export default EpisodeCacheControls;
