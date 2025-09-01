import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Save, Eye, EyeOff, Copy, Check } from 'lucide-react';
import SpotifyIcon from '@/components/ui/spotify-icon';
import { getLocaleString } from '@/lib/locales';

const SpotifyConfigForm = ({ currentLanguage = 'ru', onConfigSaved }) => {
  const { toast } = useToast();
  
  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: ''
  });
  
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Загружаем сохраненные данные при инициализации
    const savedConfig = localStorage.getItem('spotify_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
      } catch (error) {
        console.error('Error parsing saved config:', error);
      }
    }
  }, []);

  const handleInputChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!config.clientId.trim() || !config.clientSecret.trim()) {
      toast({
        title: getLocaleString('validationError', currentLanguage),
        description: getLocaleString('fillRequiredFields', currentLanguage),
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Сохраняем в localStorage
      localStorage.setItem('spotify_config', JSON.stringify(config));
      
      // Обновляем переменные окружения для текущей сессии
      window.spotifyConfig = config;
      
      toast({
        title: getLocaleString('spotifyConfigSaved', currentLanguage),
        description: getLocaleString('spotifyConfigSavedDesc', currentLanguage)
      });
      
      // Уведомляем родительский компонент
      if (onConfigSaved) {
        onConfigSaved(config);
      }
      
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: getLocaleString('spotifyConfigError', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (field) => {
    const value = config[field];
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: getLocaleString('copiedToClipboard', currentLanguage),
        description: getLocaleString('copiedToClipboardDesc', currentLanguage)
      });
    }
  };

  const handleReset = () => {
    if (window.confirm(getLocaleString('confirmResetConfig', currentLanguage))) {
      localStorage.removeItem('spotify_config');
      setConfig({ clientId: '', clientSecret: '' });
      window.spotifyConfig = null;
      
      toast({
        title: getLocaleString('configReset', currentLanguage),
        description: getLocaleString('configResetDesc', currentLanguage)
      });
    }
  };

  const handleTestConnection = async () => {
    if (!config.clientId.trim()) {
      toast({
        title: getLocaleString('validationError', currentLanguage),
        description: getLocaleString('fillRequiredFields', currentLanguage),
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/spotify-test?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(window.location.origin + '/spotify-upload')}`);
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Тест подключения успешен',
          description: `Client ID: ${data.clientId} - формат корректен`,
        });
        
        // Открываем тестовый URL в новой вкладке
        window.open(data.testUrl, '_blank');
      } else {
        toast({
          title: 'Ошибка тестирования',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast({
        title: 'Ошибка тестирования',
        description: 'Не удалось проверить подключение',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 text-slate-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SpotifyIcon className="w-5 h-5" />
          {getLocaleString('spotifyConfiguration', currentLanguage)}
        </CardTitle>
        <CardDescription className="text-slate-300">
          {getLocaleString('spotifyConfigurationDesc', currentLanguage)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Client ID */}
        <div>
          <Label htmlFor="client-id" className="text-slate-200">
            {getLocaleString('spotifyClientId', currentLanguage)} *
          </Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="client-id"
              type="text"
              value={config.clientId}
              onChange={(e) => handleInputChange('clientId', e.target.value)}
              placeholder="d49da08dc0354880a270583b043efcfd"
              className="flex-1 bg-slate-700 border-slate-600 text-slate-100"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy('clientId')}
              className="border-slate-600 text-slate-300 hover:bg-slate-600"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTestConnection()}
              className="border-slate-600 text-slate-300 hover:bg-slate-600"
              disabled={!config.clientId.trim()}
            >
              Тест
            </Button>
          </div>
        </div>

        {/* Client Secret */}
        <div>
          <Label htmlFor="client-secret" className="text-slate-200">
            {getLocaleString('spotifyClientSecret', currentLanguage)} *
          </Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="client-secret"
              type={showSecret ? 'text' : 'password'}
              value={config.clientSecret}
              onChange={(e) => handleInputChange('clientSecret', e.target.value)}
              placeholder="2243c16d2e0743bab55d9eb5b01c4ec2"
              className="flex-1 bg-slate-700 border-slate-600 text-slate-100"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSecret(!showSecret)}
              className="border-slate-600 text-slate-300 hover:bg-slate-600"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy('clientSecret')}
              className="border-slate-600 text-slate-300 hover:bg-slate-600"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={isLoading || !config.clientId.trim() || !config.clientSecret.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {getLocaleString('saveConfiguration', currentLanguage)}
          </Button>
          
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-600"
          >
            {getLocaleString('resetConfiguration', currentLanguage)}
          </Button>
        </div>

        {/* Info */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h4 className="font-semibold text-slate-200 mb-2">
            {getLocaleString('howToGetCredentials', currentLanguage)}
          </h4>
          <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
            <li>{getLocaleString('spotifyStep1', currentLanguage)}</li>
            <li>{getLocaleString('spotifyStep2', currentLanguage)}</li>
            <li>{getLocaleString('spotifyStep3', currentLanguage)}</li>
            <li>{getLocaleString('spotifyStep4', currentLanguage)}</li>
          </ol>
          
                     <div className="mt-3 flex gap-2">
             <Button
               variant="outline"
               size="sm"
               onClick={() => window.open('https://developer.spotify.com/dashboard', '_blank')}
               className="border-slate-600 text-slate-300 hover:bg-slate-600"
             >
               {getLocaleString('openSpotifyDeveloper', currentLanguage)}
             </Button>
                           <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('SPOTIFY_REDIRECT_URI_FIX.md', '_blank')}
                className="border-slate-600 text-slate-300 hover:bg-slate-600"
              >
                🔧 Исправить Redirect URI
              </Button>
           </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SpotifyConfigForm;
