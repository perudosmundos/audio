import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { getLocaleString } from '@/lib/locales';
import { Loader2, Trash2, Upload, FileAudio2, CheckCircle2, XCircle, Cloud, Database, AlertTriangle } from 'lucide-react';
import conflictChecker from '@/lib/conflictChecker';

  const UploadQueue = ({
    filesToProcess = [],
    onRemoveItem,
    onStartUpload,
    isUploading,
    currentLanguage,
    onLoadFromDB
  }) => {
  // Состояние для настроек каждого файла
  const [fileSettings, setFileSettings] = useState({});
  
  // Состояние для информации о файлах в хранилище
  const [fileStatus, setFileStatus] = useState({});

  // Инициализация настроек для нового файла
  const getFileSettings = (itemId) => {
    if (!fileSettings[itemId]) {
      return {
        autoTranscribe: true,
        autoGenerateQuestions: true,
        autoLoadFromDB: true,
        autoTranslate: true,
        selectedVersion: 'both' // 'es', 'ru', 'both'
      };
    }
    return fileSettings[itemId];
  };

  const updateFileSetting = (itemId, key, value) => {
    setFileSettings(prev => ({
      ...prev,
      [itemId]: {
        ...getFileSettings(itemId),
        [key]: value
      }
    }));
  };

  // Проверка статуса файлов в хранилище
  const checkFileStatus = async (item) => {
    if (!item.r2ObjectKey) return;
    
    try {
      const fileInfo = await conflictChecker.checkFileExistsInStorage(item.r2ObjectKey);
      setFileStatus(prev => ({
        ...prev,
        [item.id]: fileInfo
      }));
    } catch (error) {
      console.warn('Error checking file status for', item.episodeSlug, error);
    }
  };

  // Проверяем статус файлов при добавлении
  useEffect(() => {
    filesToProcess.forEach(item => {
      if (!fileStatus[item.id] && item.r2ObjectKey) {
        checkFileStatus(item);
      }
    });
  }, [filesToProcess]);

  // Группировка файлов по fileGroupId (для единых файлов)
  const groupedFiles = filesToProcess.reduce((acc, item) => {
    const groupId = item.fileGroupId || item.id;
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(item);
    return acc;
  }, {});

  const handleStartUpload = () => {
    // Передаем настройки вместе с файлами
    onStartUpload(fileSettings);
  };

  const langColors = {
    es: 'bg-green-600 text-green-100',
    ru: 'bg-blue-600 text-blue-100'
  };

  if (filesToProcess.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileAudio2 className="h-5 w-5 text-purple-400" />
          Очередь загрузки ({filesToProcess.length})
        </h3>
        <Button
          onClick={handleStartUpload}
          disabled={isUploading}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Загрузить все
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedFiles).map(([groupId, items]) => {
          const isSingleTrackFile = items.length > 1 && items[0].isSingleTrackFile;
          const mainItem = items[0];
          const settings = getFileSettings(mainItem.id);

          return (
            <div key={groupId} className="bg-slate-700/30 rounded-lg border border-slate-600 p-3">
              {/* Заголовок файла */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileAudio2 className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-white truncate max-w-md">
                    {mainItem.file.name}
                  </span>
                  {mainItem.uploadComplete && (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  )}
                  {mainItem.uploadError && (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => items.forEach(item => onRemoveItem(item.id))}
                  disabled={isUploading}
                  className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* Статус файла в хранилище */}
              {fileStatus[mainItem.id] && (
                <div className="mb-3 p-2 bg-slate-600/30 rounded border border-slate-500">
                  <div className="flex items-center gap-2 text-xs">
                    {fileStatus[mainItem.id].exists ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        <span className="text-amber-300">
                          Файл уже существует в {fileStatus[mainItem.id].source === 'database' ? 'БД' : 'Hostinger'}
                        </span>
                        {fileStatus[mainItem.id].size && (
                          <span className="text-slate-400">
                            ({(fileStatus[mainItem.id].size / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Cloud className="h-3 w-3 text-blue-400" />
                        <span className="text-blue-300">Файл не найден в хранилище</span>
                      </>
                    )}
                  </div>
                  {fileStatus[mainItem.id].url && (
                    <div className="mt-1 text-xs text-slate-400 truncate">
                      URL: {fileStatus[mainItem.id].url}
                    </div>
                  )}
                </div>
              )}

              {/* Языковые версии */}
              <div className="flex items-center gap-2 mb-3">
                {items.map(item => (
                  <span
                    key={item.id}
                    className={`px-2 py-1 rounded text-xs font-medium ${langColors[item.lang]}`}
                  >
                    {item.lang.toUpperCase()}
                  </span>
                ))}
              </div>

              {/* Выбор версии для единого файла */}
              {isSingleTrackFile && (
                <div className="mb-3 p-2 bg-slate-800/50 rounded border border-slate-600">
                  <div className="text-xs text-slate-400 mb-2">Распознать версию:</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={settings.selectedVersion === 'es' ? 'default' : 'outline'}
                      onClick={() => updateFileSetting(mainItem.id, 'selectedVersion', 'es')}
                      className={`h-7 text-xs flex-1 ${
                        settings.selectedVersion === 'es'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-green-600/20 border-green-500 text-green-300'
                      }`}
                    >
                      Только ES
                    </Button>
                    <Button
                      size="sm"
                      variant={settings.selectedVersion === 'ru' ? 'default' : 'outline'}
                      onClick={() => updateFileSetting(mainItem.id, 'selectedVersion', 'ru')}
                      className={`h-7 text-xs flex-1 ${
                        settings.selectedVersion === 'ru'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-blue-600/20 border-blue-500 text-blue-300'
                      }`}
                    >
                      Только RU
                    </Button>
                    <Button
                      size="sm"
                      variant={settings.selectedVersion === 'both' ? 'default' : 'outline'}
                      onClick={() => updateFileSetting(mainItem.id, 'selectedVersion', 'both')}
                      className={`h-7 text-xs flex-1 ${
                        settings.selectedVersion === 'both'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-purple-600/20 border-purple-500 text-purple-300'
                      }`}
                    >
                      Оба (ES + RU)
                    </Button>
                  </div>
                </div>
              )}

              {/* Автоматические действия */}
              <div className="space-y-2 p-2 bg-slate-800/50 rounded border border-slate-600">
                <div className="text-xs text-slate-400 mb-2">После загрузки:</div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`transcribe-${mainItem.id}`}
                    checked={settings.autoTranscribe}
                    onCheckedChange={(checked) => 
                      updateFileSetting(mainItem.id, 'autoTranscribe', checked)
                    }
                  />
                  <label
                    htmlFor={`transcribe-${mainItem.id}`}
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Распознать текст
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`questions-${mainItem.id}`}
                    checked={settings.autoGenerateQuestions}
                    onCheckedChange={(checked) => 
                      updateFileSetting(mainItem.id, 'autoGenerateQuestions', checked)
                    }
                  />
                  <label
                    htmlFor={`questions-${mainItem.id}`}
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Распознать вопросы (AI)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`loadFromDB-${mainItem.id}`}
                    checked={settings.autoLoadFromDB}
                    onCheckedChange={(checked) => 
                      updateFileSetting(mainItem.id, 'autoLoadFromDB', checked)
                    }
                  />
                  <label
                    htmlFor={`loadFromDB-${mainItem.id}`}
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Загрузить вопросы из БД
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`translate-${mainItem.id}`}
                    checked={settings.autoTranslate}
                    onCheckedChange={(checked) => 
                      updateFileSetting(mainItem.id, 'autoTranslate', checked)
                    }
                  />
                  <label
                    htmlFor={`translate-${mainItem.id}`}
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Перевести на другие языки (EN, DE, FR, PL)
                  </label>
                </div>
              </div>

              {/* Прогресс загрузки */}
              {mainItem.isUploading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Загрузка...</span>
                    <span>{mainItem.uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${mainItem.uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Ошибка */}
              {mainItem.uploadError && (
                <div className="mt-3 p-2 bg-red-500/20 border border-red-500 rounded text-xs text-red-300">
                  {mainItem.uploadError}
                </div>
              )}

              {/* Статус транскрипции */}
              {mainItem.transcriptionStatus && (
                <div className="mt-3 text-xs text-slate-400">
                  Статус: {mainItem.transcriptionStatus}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UploadQueue;


