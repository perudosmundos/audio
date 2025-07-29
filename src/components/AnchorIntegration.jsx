import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Play, Download, Trash2, BarChart3 } from 'lucide-react';
import anchorService from '@/lib/anchorService';
import { getLocaleString } from '@/lib/locales';

const AnchorIntegration = ({ currentLanguage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    language: 'ru'
  });
  const { toast } = useToast();

  // Загрузка эпизодов при открытии
  useEffect(() => {
    if (isOpen) {
      loadEpisodes();
    }
  }, [isOpen]);

  const loadEpisodes = async () => {
    setLoading(true);
    try {
      const result = await anchorService.getEpisodes();
      if (result.success) {
        setEpisodes(result.episodes);
      } else {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setSelectedFile(file);
      // Автоматически заполняем название из имени файла
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setMetadata(prev => ({ ...prev, title: fileName }));
    } else {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: getLocaleString('invalidAudioFile', currentLanguage),
        variant: 'destructive'
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !metadata.title) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: getLocaleString('fillRequiredFields', currentLanguage),
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      // Симулируем прогресс загрузки
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const result = await anchorService.uploadEpisode(selectedFile, {
        ...metadata,
        publishDate: new Date().toISOString()
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        toast({
          title: getLocaleString('uploadSuccess', currentLanguage),
          description: getLocaleString('episodeUploadedSuccessfully', currentLanguage)
        });
        
        // Очищаем форму
        setSelectedFile(null);
        setMetadata({ title: '', description: '', language: 'ru' });
        setUploadProgress(0);
        
        // Перезагружаем список эпизодов
        await loadEpisodes();
      } else {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteEpisode = async (episodeId) => {
    if (!confirm(getLocaleString('confirmDeleteEpisode', currentLanguage))) {
      return;
    }

    try {
      const result = await anchorService.deleteEpisode(episodeId);
      if (result.success) {
        toast({
          title: getLocaleString('deleteSuccess', currentLanguage),
          description: getLocaleString('episodeDeletedSuccessfully', currentLanguage)
        });
        await loadEpisodes();
      } else {
        toast({
          title: getLocaleString('errorGeneric', currentLanguage),
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:00` : `${minutes}:00`;
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline">
        <Upload className="w-4 h-4 mr-2" />
        {getLocaleString('anchorIntegration', currentLanguage)}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getLocaleString('anchorIntegration', currentLanguage)}</DialogTitle>
            <DialogDescription>
              {getLocaleString('anchorIntegrationDescription', currentLanguage)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Форма загрузки */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{getLocaleString('uploadNewEpisode', currentLanguage)}</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  {getLocaleString('audioFile', currentLanguage)}
                </label>
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {getLocaleString('title', currentLanguage)} *
                </label>
                <Input
                  value={metadata.title}
                  onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={getLocaleString('enterEpisodeTitle', currentLanguage)}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {getLocaleString('description', currentLanguage)}
                </label>
                <Textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={getLocaleString('enterEpisodeDescription', currentLanguage)}
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {getLocaleString('language', currentLanguage)}
                </label>
                <select
                  value={metadata.language}
                  onChange={(e) => setMetadata(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  disabled={loading}
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>

              {uploadProgress > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {getLocaleString('uploadProgress', currentLanguage)}
                  </label>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={loading || !selectedFile || !metadata.title}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {loading ? getLocaleString('uploading', currentLanguage) : getLocaleString('uploadEpisode', currentLanguage)}
              </Button>
            </div>

            {/* Список эпизодов */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">{getLocaleString('uploadedEpisodes', currentLanguage)}</h3>
                <Button onClick={loadEpisodes} variant="outline" size="sm" disabled={loading}>
                  {getLocaleString('refresh', currentLanguage)}
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  {getLocaleString('loading', currentLanguage)}...
                </div>
              ) : episodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {getLocaleString('noEpisodesFound', currentLanguage)}
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {episodes.map((episode) => (
                    <div key={episode.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{episode.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {episode.description?.substring(0, 100)}...
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>{formatDuration(episode.duration || 0)}</span>
                            <span>{new Date(episode.publish_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => window.open(episode.audio_url, '_blank')}
                            variant="outline"
                            size="sm"
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => window.open(episode.audio_url, '_blank')}
                            variant="outline"
                            size="sm"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteEpisode(episode.id)}
                            variant="outline"
                            size="sm"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnchorIntegration; 