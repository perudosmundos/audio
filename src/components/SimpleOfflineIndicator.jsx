import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

const SimpleOfflineIndicator = ({ currentLanguage = 'ru' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full text-sm">
      <div className="flex items-center gap-1">
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
          {isOnline ? 'Онлайн' : 'Офлайн'}
        </span>
      </div>
    </div>
  );
};

export default SimpleOfflineIndicator;

