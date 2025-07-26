import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const ProxyStatusIndicator = ({ currentLanguage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [proxyStatus, setProxyStatus] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkProxyStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-proxy');
      if (response.ok) {
        const data = await response.json();
        setProxyStatus(data);
        setLastChecked(new Date());
      } else {
        throw new Error('Failed to fetch proxy status');
      }
    } catch (error) {
      console.error('Error checking proxy status:', error);
      setProxyStatus({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Автоматически проверяем статус при открытии диалога
    if (isOpen && !proxyStatus && !isLoading) {
      checkProxyStatus();
    }
  }, [isOpen]);

  const getOverallStatus = () => {
    if (!proxyStatus || proxyStatus.error) return 'error';
    if (proxyStatus.summary?.available > 0) return 'success';
    return 'warning';
  };

  const getStatusIcon = () => {
    const status = getOverallStatus();
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Wifi className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (!proxyStatus) return getLocaleString('proxyStatusUnknown', currentLanguage);
    if (proxyStatus.error) return getLocaleString('proxyStatusError', currentLanguage);
    
    const { summary } = proxyStatus;
    if (summary?.available > 0) {
      return getLocaleString('proxyStatusAvailable', currentLanguage, { 
        count: summary.available, 
        total: summary.total 
      });
    }
    return getLocaleString('proxyStatusUnavailable', currentLanguage);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusText()}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              {getLocaleString('proxyStatusTitle', currentLanguage)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Кнопка обновления */}
            <div className="flex justify-between items-center">
              <Button
                onClick={checkProxyStatus}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {getLocaleString('refresh', currentLanguage)}
              </Button>
              
              {lastChecked && (
                <span className="text-sm text-gray-500">
                  {getLocaleString('lastChecked', currentLanguage, { 
                    time: lastChecked.toLocaleTimeString() 
                  })}
                </span>
              )}
            </div>

            {/* Общий статус */}
            {proxyStatus && !proxyStatus.error && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">
                    {getLocaleString('overallStatus', currentLanguage)}
                  </span>
                  <Badge variant={getOverallStatus() === 'success' ? 'default' : 'destructive'}>
                    {proxyStatus.summary?.successRate}% {getLocaleString('successRate', currentLanguage)}
                  </Badge>
                </div>
                <Progress value={proxyStatus.summary?.successRate || 0} className="w-full" />
                <div className="mt-2 text-sm text-gray-600">
                  {getLocaleString('availableProxies', currentLanguage, { 
                    available: proxyStatus.summary?.available || 0,
                    total: proxyStatus.summary?.total || 0
                  })}
                </div>
              </div>
            )}

            {/* Детали прокси */}
            {proxyStatus && proxyStatus.results && (
              <div className="space-y-2">
                <h3 className="font-medium">
                  {getLocaleString('proxyDetails', currentLanguage)}
                </h3>
                {Object.entries(proxyStatus.results).map(([name, result]) => (
                  <div
                    key={name}
                    className={`p-3 rounded-lg border ${
                      result.available 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {result.available ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium">{name}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.type}
                        </Badge>
                      </div>
                      {result.responseTime && (
                        <span className="text-sm text-gray-500">
                          {result.responseTime}ms
                        </span>
                      )}
                    </div>
                    
                    {result.error && (
                      <div className="mt-1 text-sm text-red-600">
                        {result.error}
                      </div>
                    )}
                    
                    {result.status && (
                      <div className="mt-1 text-sm text-gray-600">
                        Status: {result.status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ошибка */}
            {proxyStatus?.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-4 h-4" />
                  <span className="font-medium">
                    {getLocaleString('errorCheckingProxies', currentLanguage)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-red-600">{proxyStatus.error}</p>
              </div>
            )}

            {/* Рекомендации */}
            {proxyStatus && proxyStatus.summary?.available === 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">
                    {getLocaleString('noProxiesAvailable', currentLanguage)}
                  </span>
                </div>
                <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                  <li>• {getLocaleString('tryRefreshing', currentLanguage)}</li>
                  <li>• {getLocaleString('checkInternetConnection', currentLanguage)}</li>
                  <li>• {getLocaleString('tryVPN', currentLanguage)}</li>
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProxyStatusIndicator; 