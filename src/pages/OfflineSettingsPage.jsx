import React, { useState, useEffect } from 'react';
import { ArrowLeft, HardDrive, Wifi, WifiOff, RefreshCw, Settings, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getLocaleString } from '@/lib/locales';
import syncService from '@/lib/syncService';
import audioCacheService from '@/lib/audioCacheService';
import offlineDataService from '@/lib/offlineDataService';
import AudioCacheManager from '@/components/AudioCacheManager';
import OfflineIndicator from '@/components/OfflineIndicator';

const OfflineSettingsPage = ({ 
  currentLanguage = 'ru',
  onBack 
}) => {
  const [networkStatus, setNetworkStatus] = useState(syncService.getNetworkStatus());
  const [storageStats, setStorageStats] = useState(null);
  const [syncQueue, setSyncQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadStats();

    // Подписываемся на изменения сети и синхронизации
    const unsubscribeNetwork = syncService.onNetworkChange((isOnline) => {
      setNetworkStatus(prev => ({ ...prev, isOnline }));
    });

    const unsubscribeSync = syncService.onSyncChange((event, data) => {
      switch (event) {
        case 'sync_start':
          setIsSyncing(true);
          break;
        case 'sync_complete':
        case 'sync_error':
          setIsSyncing(false);
          loadStats(); // Обновляем статистику после синхронизации
          break;
      }
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeSync();
    };
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      // Загружаем статистику хранилища
      const storage = await syncService.getStorageStats();
      setStorageStats(storage);

      // Загружаем очередь синхронизации
      await offlineDataService.init();
      const queue = await offlineDataService.getSyncQueue();
      setSyncQueue(queue);
    } catch (error) {
      console.error('Error loading offline settings stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!networkStatus.isOnline || isSyncing) return;

    try {
      await syncService.forcSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const handleClearAllData = async () => {
    try {
      await audioCacheService.clearCache();
      await offlineDataService.clearExpiredData(0); // Удаляем все данные
      await loadStats();
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageUsagePercentage = () => {
    if (!storageStats || !storageStats.quota) return 0;
    return Math.round((storageStats.usage / storageStats.quota) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-700 rounded w-1/3"></div>
            <div className="h-32 bg-slate-700 rounded"></div>
            <div className="h-48 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              {getLocaleString('offlineSettings', currentLanguage) || 'Настройки офлайн'}
            </h1>
          </div>
          <OfflineIndicator currentLanguage={currentLanguage} />
        </div>

        <div className="space-y-6">
          {/* Статус сети и синхронизации */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {networkStatus.isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              {getLocaleString('networkStatus', currentLanguage) || 'Состояние сети'}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">
                    {getLocaleString('connection', currentLanguage) || 'Соединение'}
                  </span>
                  <span className={networkStatus.isOnline ? 'text-green-400' : 'text-red-400'}>
                    {networkStatus.isOnline 
                      ? (getLocaleString('online', currentLanguage) || 'Онлайн')
                      : (getLocaleString('offline', currentLanguage) || 'Офлайн')
                    }
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">
                    {getLocaleString('pendingSync', currentLanguage) || 'Ожидает синхронизации'}
                  </span>
                  <span className="text-white">
                    {syncQueue.length} {getLocaleString('items', currentLanguage) || 'элементов'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={!networkStatus.isOnline || isSyncing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing 
                    ? (getLocaleString('syncing', currentLanguage) || 'Синхронизация...')
                    : (getLocaleString('syncNow', currentLanguage) || 'Синхронизировать')
                  }
                </Button>
              </div>
            </div>
          </div>

          {/* Использование хранилища */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              {getLocaleString('storageUsage', currentLanguage) || 'Использование хранилища'}
            </h2>
            
            {storageStats && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">
                    {getLocaleString('totalUsage', currentLanguage) || 'Общее использование'}
                  </span>
                  <span className="text-white">
                    {formatBytes(storageStats.usage)} / {formatBytes(storageStats.quota)}
                  </span>
                </div>
                
                <Progress 
                  value={getStorageUsagePercentage()} 
                  className="h-2"
                />
                
                <div className="text-xs text-slate-500 text-center">
                  {getStorageUsagePercentage()}% {getLocaleString('used', currentLanguage) || 'использовано'}
                </div>
                
                <div className="flex justify-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearAllData}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {getLocaleString('clearAllData', currentLanguage) || 'Очистить все данные'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Управление кешем аудио */}
          <AudioCacheManager
            currentLanguage={currentLanguage}
            className="bg-slate-800"
          />

          {/* Очередь синхронизации */}
          {syncQueue.length > 0 && (
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">
                {getLocaleString('syncQueue', currentLanguage) || 'Очередь синхронизации'}
              </h2>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {syncQueue.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-3 bg-slate-700/50 rounded">
                    <div>
                      <div className="text-white font-medium">
                        {item.type} - {item.operation}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.attempts}/{item.max_attempts} {getLocaleString('attempts', currentLanguage) || 'попыток'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Информация о возможностях */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              {getLocaleString('offlineFeatures', currentLanguage) || 'Возможности офлайн'}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400">
                  <Download className="h-4 w-4" />
                  <span>{getLocaleString('audioPlayback', currentLanguage) || 'Воспроизведение аудио'}</span>
                </div>
                <div className="flex items-center gap-2 text-green-400">
                  <Settings className="h-4 w-4" />
                  <span>{getLocaleString('textEditing', currentLanguage) || 'Редактирование текста'}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400">
                  <RefreshCw className="h-4 w-4" />
                  <span>{getLocaleString('autoSync', currentLanguage) || 'Автоматическая синхронизация'}</span>
                </div>
                <div className="flex items-center gap-2 text-green-400">
                  <HardDrive className="h-4 w-4" />
                  <span>{getLocaleString('localStorage', currentLanguage) || 'Локальное хранение'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineSettingsPage;
