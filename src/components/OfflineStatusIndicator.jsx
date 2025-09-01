import React from 'react';
import { Wifi, WifiOff, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const OfflineStatusIndicator = ({ isOffline, syncStatus, syncProgress }) => {
  const getStatusIcon = () => {
    if (isOffline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    
    switch (syncStatus) {
      case 'syncing':
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Wifi className="w-4 h-4 text-green-500" />;
    }
  };

  const getStatusText = () => {
    if (isOffline) {
      return 'Офлайн режим';
    }
    
    switch (syncStatus) {
      case 'syncing':
        return 'Синхронизация...';
      case 'synced':
        return 'Синхронизировано';
      case 'error':
        return 'Ошибка синхронизации';
      default:
        return 'Онлайн';
    }
  };

  const getStatusColor = () => {
    if (isOffline) {
      return 'bg-red-100 border-red-300 text-red-800';
    }
    
    switch (syncStatus) {
      case 'syncing':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'synced':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'error':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-green-100 border-green-300 text-green-800';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor()}`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
      {syncProgress && syncStatus === 'syncing' && (
        <span className="text-xs opacity-75">({syncProgress}%)</span>
      )}
    </div>
  );
};

export default OfflineStatusIndicator;
