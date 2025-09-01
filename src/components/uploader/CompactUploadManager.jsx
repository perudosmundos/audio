import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  FileAudio, 
  X, 
  CheckCircle, 
  Loader2, 
  AlertTriangle, 
  Edit3, 
  Play, 
  Upload,
  Eye,
  Globe,
  Languages
} from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const CompactUploadManager = ({
  itemData,
  onTimingsChange,
  onTitleChange,
  onRemove,
  onPublish,
  currentLanguage,
  isPublished = false
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const { 
    file, 
    episodeTitle, 
    lang, 
    timingsText, 
    isUploading, 
    uploadProgress, 
    uploadError, 
    uploadComplete,
    transcriptionStatus,
    transcriptionError,
    isTranslatingTimings,
    uploadProgressDetails,
    translationProgress,
    translationMessage
  } = itemData;

  const handleTimingsUpdate = (e) => {
    onTimingsChange(itemData.id, e.target.value);
  };

  const handleTitleUpdate = (e) => {
    onTitleChange(itemData.id, e.target.value);
  };

  const getTranscriptionStatusText = () => {
    if (!transcriptionStatus) return null;
    switch (transcriptionStatus) {
      case 'queued':
        return getLocaleString('transcriptionQueued', currentLanguage);
      case 'processing':
        return getLocaleString('transcriptionProcessing', currentLanguage);
      case 'completed':
        return getLocaleString('transcriptionCompletedShort', currentLanguage);
      case 'error':
        return getLocaleString('transcriptionFailedShort', currentLanguage);
      case 'pending_translation_from_es':
        return getLocaleString('transcriptionPendingTranslation', currentLanguage);
      case 'translating_from_es':
        return getLocaleString('transcriptionTranslating', currentLanguage);
      default:
        return transcriptionStatus;
    }
  };

  const statusText = getTranscriptionStatusText();
  const canPublish = uploadComplete && !uploadError && transcriptionStatus === 'completed' && !isPublished;

  const getLanguageIcon = () => {
    switch (lang) {
      case 'es': return <Languages className="h-4 w-4 text-green-400" />;
      case 'en': return <Globe className="h-4 w-4 text-blue-400" />;
      case 'ru': return <Languages className="h-4 w-4 text-red-400" />;
      default: return <Languages className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <>
      {/* Компактная карточка */}
      <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-grow min-w-0">
            <FileAudio className="h-5 w-5 text-purple-300 shrink-0" />
            <span className="text-sm font-medium text-slate-100 truncate" title={file?.name}>
              {file?.name || 'Unknown file'}
            </span>
            {getLanguageIcon()}
          </div>

          <div className="flex items-center gap-1">
            {!isUploading && !uploadComplete && (
              <Button 
                variant="ghost" 
                size="icon_sm" 
                onClick={() => onRemove(itemData.id)} 
                className="text-red-400 hover:text-red-300 h-7 w-7"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            
            {uploadComplete && !uploadError && (
              <Button
                variant="ghost"
                size="icon_sm"
                onClick={() => setShowPreview(true)}
                className="text-blue-400 hover:text-blue-300 h-7 w-7"
                title="Preview"
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}

            {canPublish && (
              <Button
                variant="ghost"
                size="icon_sm"
                onClick={() => onPublish(itemData)}
                className="text-green-400 hover:text-green-300 h-7 w-7"
                title="Publish to episodes"
              >
                <Upload className="h-3 w-3" />
              </Button>
            )}

            {uploadComplete && !uploadError && (
              <Button
                variant="ghost"
                size="icon_sm"
                onClick={() => setShowEditor(true)}
                className="text-purple-400 hover:text-purple-300 h-7 w-7"
                title="Edit"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Заголовок эпизода */}
        <div className="mb-2">
          <Input
            type="text"
            value={episodeTitle}
            onChange={handleTitleUpdate}
            className="bg-slate-600 border-slate-500 text-slate-100 text-sm h-8"
            disabled={isUploading || uploadComplete}
            placeholder="Episode title..."
          />
        </div>

        {/* Статус загрузки */}
        {isUploading && (
          <div className="mb-2">
            <Progress value={uploadProgress} className="w-full [&>div]:bg-purple-400 h-1.5" />
            <div className="text-xs text-center mt-1 text-purple-300">
              {uploadProgressDetails?.message || getLocaleString('uploading', currentLanguage)} {uploadProgress}%
            </div>
          </div>
        )}

        {/* Ошибки */}
        {uploadError && (
          <div className="text-xs text-red-300 text-center bg-red-800/40 p-2 rounded-md flex items-center justify-center">
            <AlertTriangle size={12} className="mr-1" />
            {uploadError}
          </div>
        )}

        {/* Успешная загрузка */}
        {uploadComplete && !uploadError && (
          <div className="text-xs text-center text-green-300 flex items-center justify-center bg-green-800/40 p-2 rounded-md">
            <CheckCircle className="h-3 w-3 mr-1" />
            <span>{getLocaleString('uploadComplete', currentLanguage)}</span>
          </div>
        )}

        {/* Статус транскрипции */}
        {statusText && !isUploading && !uploadError && (
          <div className={`mt-2 text-xs text-center p-1.5 rounded-md flex items-center justify-center
            ${transcriptionStatus === 'completed' ? 'text-green-300 bg-green-800/40' : 
              transcriptionStatus === 'error' || transcriptionError ? 'text-red-300 bg-red-800/40' :
              'text-blue-300 bg-blue-800/40'}`}>
            {transcriptionStatus === 'processing' || transcriptionStatus === 'queued' || transcriptionStatus === 'translating_from_es' ? 
              <Loader2 className="h-3 w-3 animate-spin mr-1" /> : 
              transcriptionStatus === 'error' || transcriptionError ? 
                <AlertTriangle size={12} className="mr-1" /> :
                transcriptionStatus === 'completed' ? 
                  <CheckCircle size={12} className="mr-1" /> : null
            }
            <span>{statusText}</span>
          </div>
        )}

        {/* Прогресс перевода */}
        {transcriptionStatus === 'translating_from_es' && translationProgress !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between items-center text-xs text-blue-300 mb-1">
              <span>{getLocaleString('transcriptionTranslating', currentLanguage)}</span>
              <span>{translationProgress}%</span>
            </div>
            <Progress value={translationProgress} className="w-full [&>div]:bg-blue-400 h-1.5" />
          </div>
        )}

        {/* Ошибки транскрипции */}
        {transcriptionError && !statusText && (
          <div className="text-xs text-red-300 text-center bg-red-800/40 p-2 rounded-md flex items-center justify-center">
            <AlertTriangle size={12} className="mr-1" />
            {transcriptionError}
          </div>
        )}
      </div>

      {/* Диалог редактора */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="sm:max-w-2xl bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-purple-300">Edit Episode: {episodeTitle}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Edit episode details and timings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor={`episodeTitle-${itemData.id}`} className="text-sm text-slate-300">
                {getLocaleString('episodeTitle', currentLanguage)}
              </Label>
              <Input
                id={`episodeTitle-${itemData.id}`}
                type="text"
                value={episodeTitle}
                onChange={handleTitleUpdate}
                className="bg-slate-600 border-slate-500 text-slate-100 mt-1"
              />
            </div>

            <div>
              <Label htmlFor={`timings-${itemData.id}`} className="text-sm text-slate-300">
                {getLocaleString('timingsQuestions', currentLanguage)}
              </Label>
              <Textarea
                id={`timings-${itemData.id}`}
                value={timingsText}
                onChange={handleTimingsUpdate}
                className="bg-slate-600 border-slate-500 focus:border-purple-400 text-slate-100 min-h-[200px] mt-1"
                placeholder={getLocaleString('batchAddPlaceholder', currentLanguage)}
                disabled={isTranslatingTimings}
              />
            </div>

            {canPublish && (
              <div className="pt-4 border-t border-slate-600">
                <Button 
                  onClick={() => {
                    onPublish(itemData);
                    setShowEditor(false);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Publish to Episodes
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог предварительного просмотра */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-2xl bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-purple-300">Preview: {episodeTitle}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Review episode before publishing
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-slate-700/50 rounded-lg">
              <h3 className="font-semibold text-slate-200 mb-2">Episode Details</h3>
              <p className="text-sm text-slate-300"><strong>Title:</strong> {episodeTitle}</p>
              <p className="text-sm text-slate-300"><strong>Language:</strong> {lang.toUpperCase()}</p>
              <p className="text-sm text-slate-300"><strong>File:</strong> {file?.name}</p>
              <p className="text-sm text-slate-300"><strong>Status:</strong> {statusText}</p>
            </div>

            {timingsText && (
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <h3 className="font-semibold text-slate-200 mb-2">Timings & Questions</h3>
                <div className="text-sm text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {timingsText}
                </div>
              </div>
            )}

            {canPublish && (
              <div className="pt-4 border-t border-slate-600">
                <Button 
                  onClick={() => {
                    onPublish(itemData);
                    setShowPreview(false);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Publish to Episodes
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompactUploadManager;

