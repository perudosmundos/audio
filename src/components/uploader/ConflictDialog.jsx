import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, FileText, Database, MessageSquare, Upload } from 'lucide-react';

const ConflictDialog = ({ 
  isOpen, 
  onClose, 
  fileItem, 
  conflicts, 
  onConfirm, 
  onCancel 
}) => {
  const [overwriteSettings, setOverwriteSettings] = useState({
    overwriteServerFile: false,
    overwriteEpisodeInfo: false,
    overwriteTranscript: false,
    overwriteQuestions: false
  });

  // Инициализируем настройки на основе конфликтов
  useEffect(() => {
    if (conflicts) {
      const recommended = getRecommendedSettings(conflicts);
      setOverwriteSettings(recommended);
    }
  }, [conflicts]);

  const getRecommendedSettings = (conflicts) => {
    const settings = {
      overwriteServerFile: false,
      overwriteEpisodeInfo: false,
      overwriteTranscript: false,
      overwriteQuestions: false
    };

    if (conflicts.hasFileConflict) {
      settings.overwriteServerFile = true;
    }

    if (conflicts.hasDBConflict) {
      const db = conflicts.dbConflict;
      if (db.episode?.exists) {
        settings.overwriteEpisodeInfo = true;
      }
      if (db.transcript?.exists) {
        settings.overwriteTranscript = true;
      }
      if (db.questions?.exists) {
        settings.overwriteQuestions = true;
      }
    }

    return settings;
  };

  const handleSettingChange = (setting, value) => {
    setOverwriteSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleConfirm = () => {
    onConfirm(overwriteSettings);
  };

  const hasAnyConflict = conflicts?.hasFileConflict || conflicts?.hasDBConflict;
  const hasAnyOverwrite = Object.values(overwriteSettings).some(Boolean);

  if (!isOpen || !conflicts || !hasAnyConflict) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Обнаружены конфликты
          </DialogTitle>
          <DialogDescription>
            Файл <code className="bg-gray-100 px-1 rounded">{fileItem?.file?.name}</code> имеет конфликты с существующими данными
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Информация о конфликтах */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                {conflicts.hasFileConflict && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span>{conflicts.fileConflict.message}</span>
                    </div>
                    {conflicts.fileConflict.url && (
                      <div className="ml-6 space-y-1">
                        <div className="text-sm text-gray-600">
                          URL: <code className="bg-gray-100 px-1 rounded text-xs">{conflicts.fileConflict.url}</code>
                        </div>
                        {conflicts.fileConflict.size && (
                          <div className="text-sm text-gray-600">
                            Размер: {(conflicts.fileConflict.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        )}
                        <div className="text-sm text-gray-600">
                          Источник: {conflicts.fileConflict.source === 'database' ? 'База данных' : 'Hostinger'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {conflicts.hasDBConflict && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-green-500" />
                      <span>Эпизод уже существует в БД</span>
                    </div>
                    {conflicts.dbConflict.transcript?.exists && (
                      <div className="flex items-center gap-2 ml-6">
                        <FileText className="h-3 w-3 text-gray-500" />
                        <span className="text-sm">Транскрипт существует</span>
                      </div>
                    )}
                    {conflicts.dbConflict.questions?.exists && (
                      <div className="flex items-center gap-2 ml-6">
                        <MessageSquare className="h-3 w-3 text-gray-500" />
                        <span className="text-sm">
                          Вопросы существуют ({conflicts.dbConflict.questions.count})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Опции замены */}
          <div className="space-y-3">
            <h4 className="font-medium">Выберите что заменить:</h4>
            
            {conflicts.hasFileConflict && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overwriteServerFile"
                  checked={overwriteSettings.overwriteServerFile}
                  onCheckedChange={(checked) => 
                    handleSettingChange('overwriteServerFile', checked)
                  }
                />
                <label 
                  htmlFor="overwriteServerFile" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Заменить файл в хранилище
                </label>
              </div>
            )}

            {conflicts.hasDBConflict && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overwriteEpisodeInfo"
                    checked={overwriteSettings.overwriteEpisodeInfo}
                    onCheckedChange={(checked) => 
                      handleSettingChange('overwriteEpisodeInfo', checked)
                    }
                  />
                  <label 
                    htmlFor="overwriteEpisodeInfo" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Заменить информацию об эпизоде
                  </label>
                </div>

                {conflicts.dbConflict.transcript?.exists && (
                  <div className="flex items-center space-x-2 ml-6">
                    <Checkbox
                      id="overwriteTranscript"
                      checked={overwriteSettings.overwriteTranscript}
                      onCheckedChange={(checked) => 
                        handleSettingChange('overwriteTranscript', checked)
                      }
                    />
                    <label 
                      htmlFor="overwriteTranscript" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Заменить транскрипт
                    </label>
                  </div>
                )}

                {conflicts.dbConflict.questions?.exists && (
                  <div className="flex items-center space-x-2 ml-6">
                    <Checkbox
                      id="overwriteQuestions"
                      checked={overwriteSettings.overwriteQuestions}
                      onCheckedChange={(checked) => 
                        handleSettingChange('overwriteQuestions', checked)
                      }
                    />
                    <label 
                      htmlFor="overwriteQuestions" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Заменить вопросы
                    </label>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Предупреждение */}
          {hasAnyOverwrite && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Выбранные данные будут перезаписаны. Это действие нельзя отменить.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!hasAnyOverwrite}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Загрузить с заменой
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConflictDialog;
