import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { 
  Music, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  Loader2,
  FileAudio,
  Globe,
  Calendar
} from 'lucide-react';
import SpotifyIcon from '@/components/ui/spotify-icon';
import SpotifyConfigForm from '@/components/SpotifyConfigForm';
import { getLocaleString } from '@/lib/locales';

const SpotifyUploadPage = ({ currentLanguage = 'ru' }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Spotify OAuth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [episodeData, setEpisodeData] = useState({
    title: '',
    description: '',
    language: 'ru',
    category: 'religion',
    explicit: false
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Spotify OAuth configuration
  const [spotifyConfig, setSpotifyConfig] = useState(null);
  // Используем фиксированный Redirect URI для разработки
  // Spotify не принимает localhost, поэтому используем ngrok или публичный домен
  const REDIRECT_URI = 'https://dosmundos-podcast.vercel.app/spotify-upload';
  
  // Получаем Client ID из localStorage или переменных окружения
  const SPOTIFY_CLIENT_ID = spotifyConfig?.clientId || import.meta.env.VITE_SPOTIFY_CLIENT_ID;

  useEffect(() => {
    // Загружаем сохраненную конфигурацию Spotify
    const savedConfig = localStorage.getItem('spotify_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setSpotifyConfig(parsed);
      } catch (error) {
        console.error('Error parsing saved config:', error);
      }
    }

    // Check if we have a stored access token
    const storedToken = localStorage.getItem('spotify_access_token');
    if (storedToken) {
      setAccessToken(storedToken);
      setIsAuthenticated(true);
      fetchUserProfile(storedToken);
    }

    // Check if we're returning from Spotify OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleSpotifyCallback(code);
    }
  }, []);

  const handleSpotifyCallback = async (code) => {
    try {
      const response = await fetch('/api/spotify-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.access_token);
        setIsAuthenticated(true);
        localStorage.setItem('spotify_access_token', data.access_token);
        fetchUserProfile(data.access_token);
        
        // Clean up URL
        window.history.replaceState({}, document.title, '/spotify-upload');
        
        toast({
          title: getLocaleString('spotifyAuthSuccess', currentLanguage),
          description: getLocaleString('spotifyAuthSuccessDesc', currentLanguage)
        });
      } else {
        throw new Error('Failed to authenticate with Spotify');
      }
    } catch (error) {
      console.error('Spotify auth error:', error);
      toast({
        title: getLocaleString('spotifyAuthError', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const fetchUserProfile = async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  const handleSpotifyLogin = () => {
    if (!SPOTIFY_CLIENT_ID) {
      toast({
        title: getLocaleString('configurationError', currentLanguage),
        description: getLocaleString('spotifyClientIdMissing', currentLanguage),
        variant: 'destructive'
      });
      return;
    }

    const scopes = [
      'user-read-private',
      'user-read-email'
    ].join(' ');

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
    
    // Детальная диагностика
    console.log('=== SPOTIFY AUTH DIAGNOSTICS ===');
    console.log('Client ID:', SPOTIFY_CLIENT_ID);
    console.log('Client ID length:', SPOTIFY_CLIENT_ID.length);
    console.log('Redirect URI:', REDIRECT_URI);
    console.log('Scopes:', scopes);
    console.log('Full Auth URL:', authUrl);
    console.log('================================');
    
    // Проверяем формат Client ID
    if (!/^[a-zA-Z0-9]{32}$/.test(SPOTIFY_CLIENT_ID)) {
      console.error('❌ INVALID CLIENT ID FORMAT!');
      toast({
        title: 'Ошибка формата Client ID',
        description: 'Client ID должен содержать 32 символа (буквы и цифры)',
        variant: 'destructive'
      });
      return;
    }
    
    // Проверяем Redirect URI
    if (!REDIRECT_URI.includes('localhost') && !REDIRECT_URI.includes('ngrok')) {
      console.warn('⚠️ WARNING: Redirect URI is not localhost or ngrok');
    }
    
    console.log('✅ Proceeding with Spotify authorization...');
    window.location.href = authUrl;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setSelectedFile(file);
      // Auto-fill title from filename
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setEpisodeData(prev => ({ ...prev, title: fileName }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !episodeData.title.trim()) {
      toast({
        title: getLocaleString('validationError', currentLanguage),
        description: getLocaleString('fillRequiredFields', currentLanguage),
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(getLocaleString('uploadingToSpotify', currentLanguage));

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Call Spotify upload API
      const response = await fetch('/api/spotify-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          episodeData,
          audioFileUrl: URL.createObjectURL(selectedFile)
        })
      });

      const result = await response.json();

      if (result.success) {
        setUploadStatus(getLocaleString('uploadComplete', currentLanguage));
        toast({
          title: getLocaleString('spotifyUploadSuccess', currentLanguage),
          description: getLocaleString('spotifyUploadSuccessDesc', currentLanguage)
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(getLocaleString('uploadError', currentLanguage));
      toast({
        title: getLocaleString('spotifyUploadError', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfigSaved = (config) => {
    setSpotifyConfig(config);
    // Перезагружаем страницу для применения новой конфигурации
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    setAccessToken(null);
    setIsAuthenticated(false);
    setUserProfile(null);
  };

    if (!SPOTIFY_CLIENT_ID) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <SpotifyIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">
              {getLocaleString('spotifyUploadTitle', currentLanguage)}
            </h1>
            <p className="text-slate-300">
              {getLocaleString('spotifyConfigurationRequired', currentLanguage)}
            </p>
          </div>
          
          <SpotifyConfigForm 
            currentLanguage={currentLanguage} 
            onConfigSaved={handleConfigSaved}
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700 text-slate-100">
            <CardHeader className="text-center">
                             <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                 <SpotifyIcon className="w-8 h-8 text-white" />
               </div>
              <CardTitle className="text-2xl text-2xl text-slate-100">
                {getLocaleString('spotifyUploadTitle', currentLanguage)}
              </CardTitle>
              <CardDescription className="text-slate-300">
                {getLocaleString('spotifyUploadDesc', currentLanguage)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                                 <Button 
                   onClick={handleSpotifyLogin}
                   className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                   size="lg"
                 >
                   <SpotifyIcon className="w-5 h-5 mr-2" />
                   {getLocaleString('connectSpotify', currentLanguage)}
                 </Button>
               </div>
               
               <div className="bg-slate-700/50 rounded-lg p-4">
                 <h3 className="font-semibold text-slate-200 mb-2">
                   {getLocaleString('whatYouGet', currentLanguage)}
                 </h3>
                 <ul className="text-sm text-slate-300 space-y-1">
                   <li>• {getLocaleString('spotifyFeature1', currentLanguage)}</li>
                   <li>• {getLocaleString('spotifyFeature2', currentLanguage)}</li>
                   <li>• {getLocaleString('spotifyFeature3', currentLanguage)}</li>
                   <li>• {getLocaleString('spotifyFeature4', currentLanguage)}</li>
                 </ul>
               </div>
             </CardContent>
           </Card>
         </div>
       </div>
     );
   }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              {getLocaleString('spotifyUploadTitle', currentLanguage)}
            </h1>
            <p className="text-slate-300 mt-2">
              {getLocaleString('welcomeBack', currentLanguage)} {userProfile?.display_name}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-slate-600 text-slate-300">
            {getLocaleString('disconnect', currentLanguage)}
          </Button>
        </div>

        {/* Upload Form */}
        <Card className="bg-slate-800/50 border-slate-700 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              {getLocaleString('uploadEpisode', currentLanguage)}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {getLocaleString('uploadEpisodeDesc', currentLanguage)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Selection */}
            <div>
              <Label htmlFor="audio-file" className="text-slate-200">
                {getLocaleString('audioFile', currentLanguage)}
              </Label>
              <div className="mt-2">
                <Input
                  id="audio-file"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="bg-slate-700 border-slate-600 text-slate-100 file:bg-green-600 file:border-0 file:text-white file:px-4 file:py-2 file:rounded file:cursor-pointer"
                />
              </div>
              {selectedFile && (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                  <FileAudio className="w-4 h-4" />
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            {/* Episode Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="episode-title" className="text-slate-200">
                  {getLocaleString('episodeTitle', currentLanguage)} *
                </Label>
                <Input
                  id="episode-title"
                  value={episodeData.title}
                  onChange={(e) => setEpisodeData(prev => ({ ...prev, title: e.target.value }))}
                  className="mt-1 bg-slate-700 border-slate-600 text-slate-100"
                  placeholder={getLocaleString('enterTitle', currentLanguage)}
                />
              </div>

              <div>
                <Label htmlFor="episode-language" className="text-slate-200">
                  {getLocaleString('language', currentLanguage)}
                </Label>
                <select
                  id="episode-language"
                  value={episodeData.language}
                  onChange={(e) => setEpisodeData(prev => ({ ...prev, language: e.target.value }))}
                  className="mt-1 w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-md px-3 py-2"
                >
                  <option value="ru">Русский</option>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="episode-description" className="text-slate-200">
                {getLocaleString('description', currentLanguage)}
              </Label>
              <Textarea
                id="episode-description"
                value={episodeData.description}
                onChange={(e) => setEpisodeData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 bg-slate-700 border-slate-600 text-slate-100"
                placeholder={getLocaleString('enterDescription', currentLanguage)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="episode-category" className="text-slate-200">
                  {getLocaleString('category', currentLanguage)}
                </Label>
                <select
                  id="episode-category"
                  value={episodeData.category}
                  onChange={(e) => setEpisodeData(prev => ({ ...prev, category: e.target.value }))}
                  className="mt-1 w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-md px-3 py-2"
                >
                  <option value="religion">Religion & Spirituality</option>
                  <option value="health">Health & Wellness</option>
                  <option value="education">Education</option>
                  <option value="business">Business</option>
                  <option value="technology">Technology</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 mt-6">
                <input
                  type="checkbox"
                  id="explicit-content"
                  checked={episodeData.explicit}
                  onChange={(e) => setEpisodeData(prev => ({ ...prev, explicit: e.target.checked }))}
                  className="w-4 h-4 text-green-600 bg-slate-700 border-slate-600 rounded"
                />
                <Label htmlFor="explicit-content" className="text-slate-200 text-sm">
                  {getLocaleString('explicitContent', currentLanguage)}
                </Label>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>{uploadStatus}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !episodeData.title.trim() || isUploading}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {getLocaleString('uploading', currentLanguage)}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  {getLocaleString('uploadToSpotify', currentLanguage)}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-slate-800/50 border-slate-700 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {getLocaleString('howItWorks', currentLanguage)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-slate-300">
              <p>1. {getLocaleString('step1', currentLanguage)}</p>
              <p>2. {getLocaleString('step2', currentLanguage)}</p>
              <p>3. {getLocaleString('step3', currentLanguage)}</p>
              <p>4. {getLocaleString('step4', currentLanguage)}</p>
            </div>
            
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => window.open('https://podcasters.spotify.com/', '_blank')}
                className="border-slate-600 text-slate-300"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {getLocaleString('openSpotifyPodcasters', currentLanguage)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SpotifyUploadPage;
