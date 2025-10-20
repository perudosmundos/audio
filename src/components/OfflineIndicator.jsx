import React, { useState, useEffect } from 'react';
import { getLocaleString } from '@/lib/locales';
import syncService from '@/lib/syncService';
import audioCacheService from '@/lib/audioCacheService';

const OfflineIndicator = ({ currentLanguage = 'ru' }) => {
  const [networkStatus, setNetworkStatus] = useState(syncService.getNetworkStatus());
  const [syncStatus, setSyncStatus] = useState({
    isActive: false,
    lastSync: null,
    pendingChanges: 0,
    error: null
  });
  const [downloadStatus, setDownloadStatus] = useState({
    isActive: false,
    progress: 0,
    currentFile: null
  });

  useEffect(() => {
    // Подписываемся на изменения сетевого состояния
    const unsubscribeNetwork = syncService.onNetworkChange((isOnline) => {
      setNetworkStatus(prev => ({ ...prev, isOnline }));
    });

    // Подписываемся на события синхронизации
    const unsubscribeSync = syncService.onSyncChange((event, data) => {
      switch (event) {
        case 'sync_start':
          setSyncStatus(prev => ({ ...prev, isActive: true, error: null }));
          break;
        case 'sync_complete':
          setSyncStatus(prev => ({
            ...prev,
            isActive: false,
            lastSync: Date.now(),
            pendingChanges: Math.max(0, prev.pendingChanges - data.successCount),
            error: data.errorCount > 0 ? `${data.errorCount} errors` : null
          }));
          break;
        case 'sync_error':
          setSyncStatus(prev => ({
            ...prev,
            isActive: false,
            error: data.error
          }));
          break;
        case 'sync_item_success':
          setSyncStatus(prev => ({
            ...prev,
            pendingChanges: Math.max(0, prev.pendingChanges - 1)
          }));
          break;
      }
    });

    // Подписываемся на события загрузки аудио
    const unsubscribeDownload = audioCacheService.onDownloadProgress((event, data) => {
      switch (event) {
        case 'download_start':
          setDownloadStatus({
            isActive: true,
            progress: 0,
            currentFile: data.episodeSlug
          });
          break;
        case 'download_progress':
          setDownloadStatus(prev => ({
            ...prev,
            progress: data.progress,
            currentFile: data.episodeSlug
          }));
          break;
        case 'download_complete':
        case 'download_error':
          setDownloadStatus({
            isActive: false,
            progress: 0,
            currentFile: null
          });
          break;
      }
    });

    // Проверяем количество ожидающих синхронизации элементов
    const checkPendingChanges = async () => {
      try {
        const queue = await syncService.syncOfflineChanges ? [] : []; // Заглушка
        setSyncStatus(prev => ({ ...prev, pendingChanges: queue.length }));
      } catch (error) {
        console.error('Error checking pending changes:', error);
      }
    };

    checkPendingChanges();
    const pendingInterval = setInterval(checkPendingChanges, 30000); // Проверяем каждые 30 секунд

    return () => {
      unsubscribeNetwork();
      unsubscribeSync();
      unsubscribeDownload();
      clearInterval(pendingInterval);
    };
  }, []);

  const getNetworkIcon = () => {
    if (networkStatus.isOnline) {
      return <div className="h-4 w-4 text-green-500">📶</div>;
    } else {
      return <div className="h-4 w-4 text-red-500">❌</div>;
    }
  };

  const getSyncIcon = () => {
    if (syncStatus.isActive) {
      return <div className="h-4 w-4 text-blue-500 animate-spin">🔄</div>;
    } else if (syncStatus.error) {
      return <div className="h-4 w-4 text-red-500">⚠️</div>;
    } else if (syncStatus.pendingChanges > 0) {
      return <div className="h-4 w-4 text-yellow-500">⏰</div>;
    } else {
      return <div className="h-4 w-4 text-green-500">✅</div>;
    }
  };

  const getStatusText = () => {
    if (!networkStatus.isOnline) {
      return getLocaleString('offlineMode', currentLanguage);
    }
    
    if (syncStatus.isActive) {
      return getLocaleString('syncing', currentLanguage);
    }
    
    if (syncStatus.error) {
      return getLocaleString('syncError', currentLanguage);
    }
    
    if (syncStatus.pendingChanges > 0) {
      return `${syncStatus.pendingChanges} ${getLocaleString('pendingChanges', currentLanguage)}`;
    }
    
    return getLocaleString('online', currentLanguage);
  };

  const getLastSyncText = () => {
    if (!syncStatus.lastSync) return '';
    
    const now = Date.now();
    const diff = now - syncStatus.lastSync;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) {
      return getLocaleString('justSynced', currentLanguage);
    } else if (minutes < 60) {
      return `${minutes} ${getLocaleString('minutesAgo', currentLanguage)}`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours} ${getLocaleString('hoursAgo', currentLanguage)}`;
    }
  };

  const handleManualSync = async () => {
    if (!networkStatus.isOnline || syncStatus.isActive) return;
    
    try {
      await syncService.forcSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full text-sm">
      {/* Индикатор сети */}
      <div className="flex items-center gap-1">
        {getNetworkIcon()}
        <span className={`text-xs ${networkStatus.isOnline ? 'text-green-400' : 'text-red-400'}`}>
          {networkStatus.isOnline ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Разделитель */}
      <div className="h-4 w-px bg-slate-600" />

      {/* Индикатор синхронизации */}
      <div 
        className="flex items-center gap-1 cursor-pointer hover:bg-slate-700/50 rounded px-1 py-0.5 transition-colors"
        onClick={handleManualSync}
        title={getLocaleString('clickToSync', currentLanguage)}
      >
        {getSyncIcon()}
        <span className="text-xs text-slate-300">
          {getStatusText()}
        </span>
      </div>

      {/* Индикатор загрузки аудио */}
      {downloadStatus.isActive && (
        <>
          <div className="h-4 w-px bg-slate-600" />
          <div className="flex items-center gap-1">
            <div className="h-4 w-4 text-blue-500">⬇️</div>
            <span className="text-xs text-blue-400">
              {downloadStatus.progress}%
            </span>
          </div>
        </>
      )}

      {/* Время последней синхронизации */}
      {syncStatus.lastSync && !syncStatus.isActive && (
        <span className="text-xs text-slate-500 ml-1">
          {getLastSyncText()}
        </span>
      )}
    </div>
  );
};

export default OfflineIndicator;
