import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Wifi, 
  WifiOff, 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  Download,
  Settings,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import syncService from '@/lib/syncService';
import offlineDataService from '@/lib/offlineDataService';
import audioCacheService from '@/lib/audioCacheService';

const OfflineSettingsPage = ({ currentLanguage }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [storageStats, setStorageStats] = useState(null);
  const [cacheSettings, setCacheSettings] = useState({
    autoSync: true,
    maxAudioCache: 200, // MB
    maxDataCache: 100, // MB
    syncInterval: 5, // minutes
    autoCleanup: true
  });
  const [syncQueue, setSyncQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Загрузка статистики и настроек
  useEffect(() => {
    loadStatsAndSettings();
    
    // Подписка на изменения сетевого состояния
    const unsubscribe = syncService.onNetworkChange((online) => {
      setIsOnline(online);
    });
    
    // Подписка на изменения статуса синхронизации
    const syncUnsubscribe = syncService.onSyncChange((status, data) => {
      setSyncStatus(status);
      if (status === 'sync_complete') {
        loadStatsAndSettings();
      }
    });

    return () => {
      unsubscribe();
      syncUnsubscribe();
    };
  }, []);

  const loadStatsAndSettings = async () => {
    try {
      setIsLoading(true);
      
      // Загружаем статистику хранилища
      const storageStats = await offlineDataService.getStorageUsage();
      
      // Загружаем статистику аудио кэша
      const audioStats = await audioCacheService.getCacheStats();
      
      // Объединяем статистику
      const combinedStats = {
        ...storageStats,
        audioSize: audioStats.totalSize || 0,
        audioFileCount: audioStats.fileCount || 0,
        maxAudioCache: Math.round((audioStats.maxSize || 1024 * 1024 * 1024) / (1024 * 1024)) // в MB
      };
      
      setStorageStats(combinedStats);
      
      // Загружаем настройки кеша
      const settings = await offlineDataService.getCacheSetting('offlineSettings');
      if (settings) {
        setCacheSettings(JSON.parse(settings));
      }
      
      // Загружаем очередь синхронизации
      const queue = await offlineDataService.getSyncQueue();
      setSyncQueue(queue);
      
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: getLocaleString('errorLoadingData', currentLanguage),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Сохранение настроек
  const saveSettings = async () => {
    try {
      await offlineDataService.saveCacheSetting('offlineSettings', JSON.stringify(cacheSettings));
      toast({
        title: getLocaleString('settingsSaved', currentLanguage),
        description: getLocaleString('offlineSettingsSaved', currentLanguage),
        className: "bg-green-600/80 border-green-500 text-white"
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: getLocaleString('saveError', currentLanguage),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Ручная синхронизация
  const handleManualSync = async () => {
    try {
      setIsLoading(true);
      setSyncStatus('syncing');
      
      await syncService.forcSync();
      
      toast({
        title: getLocaleString('syncComplete', currentLanguage),
        description: getLocaleString('manualSyncComplete', currentLanguage),
        className: "bg-green-600/80 border-green-500 text-white"
      });
      
    } catch (error) {
      console.error('Manual sync error:', error);
      toast({
        title: getLocaleString('syncError', currentLanguage),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setSyncStatus('idle');
    }
  };

  // Очистка кеша
  const handleClearCache = async () => {
    try {
      setIsLoading(true);
      
      // Очищаем аудио кеш
      await audioCacheService.clearCache();
      
      // Очищаем данные
      await offlineDataService.clearExpiredData(0);
      
      // Очищаем очередь синхронизации
      setSyncQueue([]);
      
      // Перезагружаем статистику
      await loadStatsAndSettings();
      
      toast({
        title: getLocaleString('cacheCleared', currentLanguage),
        description: getLocaleString('offlineCacheCleared', currentLanguage),
        className: "bg-blue-600/80 border-blue-500 text-white"
      });
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: getLocaleString('clearCacheError', currentLanguage),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Форматирование размера
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Получение статуса синхронизации
  const getSyncStatusInfo = () => {
    switch (syncStatus) {
      case 'syncing':
        return { icon: <RefreshCw className="w-4 h-4 animate-spin" />, text: 'Синхронизация...', color: 'text-yellow-500' };
      case 'synced':
        return { icon: <CheckCircle className="w-4 h-4" />, text: 'Синхронизировано', color: 'text-green-500' };
      case 'error':
        return { icon: <XCircle className="w-4 h-4" />, text: 'Ошибка синхронизации', color: 'text-red-500' };
      default:
        return { icon: <Clock className="w-4 h-4" />, text: 'Ожидание', color: 'text-gray-500' };
    }
  };

  const syncStatusInfo = getSyncStatusInfo();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Заголовок */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {getLocaleString('back', currentLanguage)}
        </Button>
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Settings className="w-8 h-8" />
            {getLocaleString('offlineSettings', currentLanguage)}
          </h1>
          <p className="text-slate-400 mt-2">
            {getLocaleString('offlineSettingsDescription', currentLanguage)}
          </p>
        </div>
      </div>

      {/* Статус сети и синхронизации */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              {isOnline ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
              {getLocaleString('networkStatus', currentLanguage)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={isOnline ? "default" : "destructive"} className="text-sm">
              {isOnline ? 'Онлайн' : 'Офлайн'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2">
              {syncStatusInfo.icon}
              {getLocaleString('syncStatus', currentLanguage)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-sm ${syncStatusInfo.color}`}>
              {syncStatusInfo.text}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Статистика хранилища */}
      <Card className="bg-slate-800 border-slate-700 mb-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            {getLocaleString('storageUsage', currentLanguage)}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {getLocaleString('storageUsageDescription', currentLanguage)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storageStats ? (
            <>
              {/* Аудио кеш */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-300">
                    {getLocaleString('audioCache', currentLanguage)}
                  </span>
                  <span className="text-sm text-slate-400">
                    {formatSize(storageStats.audioSize || 0)} / {storageStats.maxAudioCache || cacheSettings.maxAudioCache} MB
                  </span>
                </div>
                <Progress 
                  value={((storageStats.audioSize || 0) / ((storageStats.maxAudioCache || cacheSettings.maxAudioCache) * 1024 * 1024)) * 100} 
                  className="h-2"
                />
              </div>

              {/* Данные */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-300">
                    {getLocaleString('dataCache', currentLanguage)}
                  </span>
                  <span className="text-sm text-slate-400">
                    {formatSize(storageStats.dataSize || 0)} / {cacheSettings.maxDataCache} MB
                  </span>
                </div>
                <Progress 
                  value={((storageStats.dataSize || 0) / (cacheSettings.maxDataCache * 1024 * 1024)) * 100} 
                  className="h-2"
                />
              </div>

              {/* Общая статистика */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {storageStats.episodeCount || 0}
                  </div>
                  <div className="text-sm text-slate-400">
                    {getLocaleString('episodes', currentLanguage)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {storageStats.transcriptCount || 0}
                  </div>
                  <div className="text-sm text-slate-400">
                    {getLocaleString('transcripts', currentLanguage)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-slate-400">
                {getLocaleString('loadingStats', currentLanguage)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Настройки кеша */}
      <Card className="bg-slate-800 border-slate-700 mb-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="w-5 h-5" />
            {getLocaleString('cacheSettings', currentLanguage)}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {getLocaleString('cacheSettingsDescription', currentLanguage)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Автоматическая синхронизация */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">
                {getLocaleString('autoSync', currentLanguage)}
              </label>
              <p className="text-sm text-slate-400">
                {getLocaleString('autoSyncDescription', currentLanguage)}
              </p>
            </div>
            <Switch
              checked={cacheSettings.autoSync}
              onCheckedChange={(checked) => setCacheSettings(prev => ({ ...prev, autoSync: checked }))}
            />
          </div>

          <Separator className="bg-slate-700" />

          {/* Максимальный размер аудио кеша */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              {getLocaleString('maxAudioCache', currentLanguage)} ({cacheSettings.maxAudioCache} MB)
            </label>
            <Slider
              value={[cacheSettings.maxAudioCache]}
              onValueChange={([value]) => setCacheSettings(prev => ({ ...prev, maxAudioCache: value }))}
              max={500}
              min={50}
              step={10}
              className="w-full"
            />
            <p className="text-sm text-slate-400 mt-1">
              {getLocaleString('maxAudioCacheDescription', currentLanguage)}
            </p>
          </div>

          <Separator className="bg-slate-700" />

          {/* Максимальный размер данных */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              {getLocaleString('maxDataCache', currentLanguage)} ({cacheSettings.maxDataCache} MB)
            </label>
            <Slider
              value={[cacheSettings.maxDataCache]}
              onValueChange={([value]) => setCacheSettings(prev => ({ ...prev, maxDataCache: value }))}
              max={200}
              min={20}
              step={10}
              className="w-full"
            />
            <p className="text-sm text-slate-400 mt-1">
              {getLocaleString('maxDataCacheDescription', currentLanguage)}
            </p>
          </div>

          <Separator className="bg-slate-700" />

          {/* Интервал синхронизации */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              {getLocaleString('syncInterval', currentLanguage)} ({cacheSettings.syncInterval} мин)
            </label>
            <Slider
              value={[cacheSettings.syncInterval]}
              onValueChange={([value]) => setCacheSettings(prev => ({ ...prev, syncInterval: value }))}
              max={30}
              min={1}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-slate-400 mt-1">
              {getLocaleString('syncIntervalDescription', currentLanguage)}
            </p>
          </div>

          <Separator className="bg-slate-700" />

          {/* Автоматическая очистка */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white">
                {getLocaleString('autoCleanup', currentLanguage)}
              </label>
              <p className="text-sm text-slate-400">
                {getLocaleString('autoCleanupDescription', currentLanguage)}
              </p>
            </div>
            <Switch
              checked={cacheSettings.autoCleanup}
              onCheckedChange={(checked) => setCacheSettings(prev => ({ ...prev, autoCleanup: checked }))}
            />
          </div>

          {/* Кнопка сохранения */}
          <Button 
            onClick={saveSettings} 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            {getLocaleString('saveSettings', currentLanguage)}
          </Button>
        </CardContent>
      </Card>

      {/* Очередь синхронизации */}
      <Card className="bg-slate-800 border-slate-700 mb-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            {getLocaleString('syncQueue', currentLanguage)}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {getLocaleString('syncQueueDescription', currentLanguage)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncQueue.length > 0 ? (
            <div className="space-y-2">
              {syncQueue.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {item.type}
                    </Badge>
                    <span className="text-sm text-slate-300">
                      {item.operation} - {item.timestamp ? formatTime(item.timestamp) : 'Unknown'}
                    </span>
                  </div>
                  <Badge variant={item.attempts >= 3 ? "destructive" : "secondary"} className="text-xs">
                    {item.attempts || 0} попыток
                  </Badge>
                </div>
              ))}
              {syncQueue.length > 10 && (
                <p className="text-sm text-slate-400 text-center">
                  ... и еще {syncQueue.length - 10} элементов
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-slate-400">
                {getLocaleString('syncQueueEmpty', currentLanguage)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Действия */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button 
          onClick={handleManualSync} 
          className="bg-green-600 hover:bg-green-700"
          disabled={isLoading || !isOnline}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {getLocaleString('manualSync', currentLanguage)}
        </Button>

        <Button 
          onClick={loadStatsAndSettings} 
          variant="outline"
          disabled={isLoading}
        >
          <Download className="w-4 h-4 mr-2" />
          {getLocaleString('refreshStats', currentLanguage)}
        </Button>

        <Button 
          onClick={handleClearCache} 
          variant="destructive"
          disabled={isLoading}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {getLocaleString('clearCache', currentLanguage)}
        </Button>
      </div>
    </div>
  );
};

export default OfflineSettingsPage;
