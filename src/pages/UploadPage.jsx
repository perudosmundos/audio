import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { UploadCloud, Loader2, PlusCircle, ArrowLeft, TestTube, Play } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import useFileUploadManager from '@/hooks/useFileUploadManager';
import CompactUploadManager from '@/components/uploader/CompactUploadManager';
import UploadStats from '@/components/uploader/UploadStats';
import UploadFilters from '@/components/uploader/UploadFilters';
import EmptyUploadState from '@/components/uploader/EmptyUploadState';
import OverwriteDialog from '@/components/uploader/OverwriteDialog';
import { testOpenAIConnection } from '@/lib/openAIService';
import { useToast } from '@/components/ui/use-toast';

const UploadPage = ({ currentLanguage }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('ASSEMBLYAI_API_KEY') || '';
    } catch {
      return '';
    }
  });
  
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ field: 'name', order: 'asc' });
  
  const {
    filesToProcess,
    isProcessingAll,
    showOverwriteDialog,
    currentItemForOverwrite,
    addFilesToQueue,
    handleProcessAllFiles,
    handleTimingsChange,
    handleTitleChange,
    handleRemoveItem,
    confirmOverwrite,
    cancelOverwrite,
    publishEpisode,
    isEpisodePublished,
  } = useFileUploadManager(currentLanguage);

  const onDrop = useCallback((acceptedFiles) => {
    addFilesToQueue(acceptedFiles);
  }, [addFilesToQueue]);

  const handleTestOpenAI = async () => {
    setIsTestingOpenAI(true);
    try {
      const result = await testOpenAIConnection();
      if (result.success) {
        toast({
          title: "✅ DeepSeek Тест Успешен",
          description: `Все работает! Перевод: "${result.result}"`,
          duration: 5000
        });
      } else {
        let title = "❌ DeepSeek Тест Неудачен";
        let description = result.error;
        
        // Provide specific guidance based on error step
        switch (result.step) {
          case "edge_function":
            title = "🌐 Проблема с Сервером";
            description = `${result.error}\n\nПроверьте подключение к интернету и статус сервера.`;
            break;
          case "api_key_missing":
            title = "🔑 API Ключ Отсутствует";
            description = `${result.error}\n\nОбратитесь к администратору для настройки API ключа.`;
            break;
          case "connection":
            title = "🌐 Сетевая Ошибка";
            description = `${result.error}\n\nПроверьте интернет-соединение и попробуйте позже.`;
            break;
          case "timeout":
            title = "⏱️ Таймаут";
            description = `${result.error}\n\nСервер не отвечает. Попробуйте позже.`;
            break;
        }
        
        toast({
          title,
          description,
          variant: "destructive",
          duration: 8000
        });
      }
    } catch (error) {
      toast({
        title: "❌ Неожиданная Ошибка",
        description: `Произошла неожиданная ошибка: ${error.message}`,
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setIsTestingOpenAI(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'] },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  // Функции фильтрации и сортировки
  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...filesToProcess];

    // Поиск
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.episodeTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.file?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      switch (statusFilter) {
        case 'pending':
          filtered = filtered.filter(item => !item.isUploading && !item.uploadComplete && !item.uploadError);
          break;
        case 'processing':
          filtered = filtered.filter(item => item.isUploading);
          break;
        case 'completed':
          filtered = filtered.filter(item => item.uploadComplete && !item.uploadError);
          break;
        case 'error':
          filtered = filtered.filter(item => item.uploadError);
          break;
      }
    }

    // Фильтр по языку
    if (languageFilter !== 'all') {
      filtered = filtered.filter(item => item.lang === languageFilter);
    }

    // Сортировка
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortConfig.field) {
        case 'name':
          aValue = a.episodeTitle || a.file?.name || '';
          bValue = b.episodeTitle || b.file?.name || '';
          break;
        case 'date':
          aValue = a.episodeDate || '';
          bValue = b.episodeDate || '';
          break;
        case 'status':
          aValue = a.uploadComplete ? 'completed' : a.isUploading ? 'processing' : a.uploadError ? 'error' : 'pending';
          bValue = b.uploadComplete ? 'completed' : b.isUploading ? 'processing' : b.uploadError ? 'error' : 'pending';
          break;
        case 'language':
          aValue = a.lang || '';
          bValue = b.lang || '';
          break;
        default:
          aValue = a.episodeTitle || '';
          bValue = b.episodeTitle || '';
      }

      if (sortConfig.order === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    setFilteredFiles(filtered);
  }, [filesToProcess, searchTerm, statusFilter, languageFilter, sortConfig]);

  // Применяем фильтры при изменении данных
  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  // Инициализируем filteredFiles
  useEffect(() => {
    setFilteredFiles(filesToProcess);
  }, [filesToProcess]);

  const handleFilterChange = useCallback((filters) => {
    setStatusFilter(filters.status);
    setLanguageFilter(filters.language);
  }, []);

  const handleSortChange = useCallback((sort) => {
    setSortConfig(sort);
  }, []);

  const handleSearchChange = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-6xl bg-slate-800/70 rounded-xl shadow-2xl border border-slate-700/50">
      <div className="flex justify-between items-center mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate('/episodes')} 
          className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodes', currentLanguage)}
        </Button>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleTestOpenAI}
            disabled={isTestingOpenAI}
            variant="outline"
            size="sm"
            className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
          >
            {isTestingOpenAI ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="mr-2 h-4 w-4" />
            )}
            Тест DeepSeek
          </Button>
          <Button
            onClick={() => setShowApiKeyInput((v) => !v)}
            variant="outline"
            size="sm"
            className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
          >
            API AssemblyAI
          </Button>
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-purple-300 mb-2">{getLocaleString('uploadAudioFiles', currentLanguage)}</h1>
        <p className="text-sm text-slate-400">{getLocaleString('uploadAudioDescription', currentLanguage)}</p>
      </div>

      {showApiKeyInput && (
        <div className="mb-4 p-3 rounded-lg bg-slate-700/50 border border-slate-600">
          <label className="block text-xs text-slate-300 mb-1">AssemblyAI API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={() => {
              // Сохраняем API ключ при потере фокуса
              try { localStorage.setItem('ASSEMBLYAI_API_KEY', apiKey.trim()); } catch (error) {
                console.warn('Failed to save API key to localStorage:', error);
              }
            }}
            placeholder="sk_..."
            className="w-full h-9 px-3 rounded bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Ключ хранится локально в браузере</span>
            <Button
              size="sm"
              variant="secondary"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                // Сохраняем API ключ при нажатии кнопки
                try {
                  localStorage.setItem('ASSEMBLYAI_API_KEY', apiKey.trim());
                  toast({
                    title: "✅ API ключ сохранен",
                    description: "Ключ AssemblyAI успешно сохранен в браузере",
                    duration: 3000
                  });
                } catch (error) {
                  console.warn('Failed to save API key to localStorage:', error);
                  toast({
                    title: "❌ Ошибка сохранения",
                    description: "Не удалось сохранить API ключ",
                    variant: "destructive",
                    duration: 3000
                  });
                }
              }}
            >Сохранить</Button>
          </div>
        </div>
      )}

      <div {...getRootProps({ className: `p-4 border-2 border-dashed rounded-lg text-center cursor-pointer mb-6 ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}` })}>
        <input {...getInputProps()} style={{ display: 'none' }} />
        <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        {isDragActive ? (
          <p className="text-purple-300 text-sm">{getLocaleString('dropFilesHere', currentLanguage)}</p>
        ) : (
          <p className="text-slate-300 text-sm">{getLocaleString('dragOrClickUpload', currentLanguage)}</p>
        )}
        <Button type="button" onClick={open} variant="ghost" className="mt-2 text-purple-300 hover:text-purple-200 text-sm">
          {getLocaleString('selectFiles', currentLanguage)}
        </Button>
        <p className="text-xs text-slate-500 mt-1">{getLocaleString('supportedFormats', currentLanguage)}</p>
      </div>

      {filesToProcess.length > 0 ? (
        <>
          <UploadStats filesToProcess={filesToProcess} currentLanguage={currentLanguage} />
          <UploadFilters 
            filesToProcess={filesToProcess}
            onFilterChange={handleFilterChange}
            onSortChange={handleSortChange}
            onSearchChange={handleSearchChange}
            currentLanguage={currentLanguage}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {filteredFiles.map((itemData) => (
              <CompactUploadManager 
                key={itemData.id}
                itemData={itemData}
                onTimingsChange={handleTimingsChange}
                onTitleChange={handleTitleChange}
                onRemove={handleRemoveItem}
                onPublish={publishEpisode}
                currentLanguage={currentLanguage}
                isPublished={isEpisodePublished(itemData.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyUploadState currentLanguage={currentLanguage} />
      )}
      
      <div className="flex items-center justify-center gap-4 mt-8">
        <Button 
          onClick={open} 
          variant="outline"
          className="border-purple-500 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 focus-visible:ring-purple-500"
          disabled={isProcessingAll}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {getLocaleString('addAnotherFile', currentLanguage)}
        </Button>
        
        <Button 
          onClick={handleProcessAllFiles} 
          disabled={isProcessingAll || filesToProcess.length === 0 || filesToProcess.every(fd => fd.isUploading || fd.uploadComplete || fd.uploadError)} 
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
        >
          {isProcessingAll ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {getLocaleString('processing', currentLanguage)}...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {getLocaleString('startAllUploads', currentLanguage)}
            </>
          )}
        </Button>
      </div>

      {showOverwriteDialog && (
        <OverwriteDialog
          isOpen={showOverwriteDialog}
          onOpenChange={() => {
            // Обработчик изменения состояния модального окна
            // Пока не используется, но может быть расширен в будущем
          }}
          onConfirm={confirmOverwrite}
          onCancel={cancelOverwrite}
          slug={currentItemForOverwrite?.episodeSlug || ''}
          currentLanguage={currentLanguage}
        />
      )}
    </div>
  );
};

export default UploadPage;
