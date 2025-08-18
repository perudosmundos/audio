import React from 'react';
import { FileAudio, X, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { getLocaleString } from '@/lib/locales';

const FileUploadItem = ({
  itemData,
  onTimingsChange,
  onTitleChange,
  onRemove,
  currentLanguage,
}) => {
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
    uploadProgressDetails
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
  
  const langColor = lang === 'ru' ? 'rgba(59, 130, 246, 0.7)' : 
                    lang === 'es' ? 'rgba(234, 179, 8, 0.7)' : 
                    'rgba(34, 197, 94, 0.7)';


  return (
    <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 space-y-3 relative">
      {file && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-grow min-w-0">
            <FileAudio className="h-6 w-6 text-purple-300 shrink-0" />
            <span className="text-sm font-medium text-slate-100 truncate" title={file.name}>{file.name}</span>
          </div>
          <div className="px-2 py-0.5 text-xs font-semibold rounded-full text-white ml-2 shrink-0"
               style={{backgroundColor: langColor }}>
            {lang.toUpperCase()}
          </div>
          {!isUploading && !uploadComplete && (
            <Button variant="ghost" size="icon_sm" onClick={() => onRemove(itemData.id)} className="text-red-400 hover:text-red-300 ml-2 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <div>
        <Label htmlFor={`episodeTitle-${itemData.id}`} className="text-xs text-slate-300">{getLocaleString('episodeTitle', currentLanguage)}</Label>
        <Input
          id={`episodeTitle-${itemData.id}`}
          type="text"
          value={episodeTitle}
          onChange={handleTitleUpdate}
          className="bg-slate-600 border-slate-500 text-slate-100 mt-1 text-sm"
          disabled={isUploading || uploadComplete}
        />
      </div>

      <div>
        <div className="flex justify-between items-center">
            <Label htmlFor={`timings-${itemData.id}`} className="text-xs text-slate-300">{getLocaleString('timingsQuestions', currentLanguage)}</Label>
        </div>
        <Textarea
          id={`timings-${itemData.id}`}
          value={timingsText}
          onChange={handleTimingsUpdate}
          className="bg-slate-600 border-slate-500 focus:border-purple-400 text-slate-100 min-h-[100px] mt-1 text-sm"
          placeholder={getLocaleString('batchAddPlaceholder', currentLanguage)}
          disabled={isUploading || uploadComplete || isTranslatingTimings}
        />
      </div>

      {isUploading && (
        <div className="mt-2">
          <Progress value={uploadProgress} className="w-full [&>div]:bg-purple-400 h-2" />
          <div className="text-xs text-center mt-1 text-purple-300">
            {uploadProgressDetails?.message || getLocaleString('uploading', currentLanguage)} {uploadProgress}%
            {uploadProgressDetails && (
              <div className="text-xs text-purple-200 mt-1">
                {uploadProgressDetails.uploadedMB} / {uploadProgressDetails.totalMB} MB
              </div>
            )}
          </div>
        </div>
      )}

      {uploadError && (
        <p className="mt-2 text-xs text-red-300 text-center bg-red-800/40 p-2 rounded-md flex items-center justify-center">
            <AlertTriangle size={14} className="mr-1.5" />{uploadError}
        </p>
      )}

      {uploadComplete && !uploadError && (
        <div className="mt-2 text-xs text-center text-green-300 flex items-center justify-center bg-green-800/40 p-2 rounded-md">
          <CheckCircle className="h-4 w-4 mr-1.5" />
          <span>{getLocaleString('uploadComplete', currentLanguage)}</span>
        </div>
      )}

      {statusText && !isUploading && !uploadError && (
        <div className={`mt-2 text-xs text-center p-2 rounded-md flex items-center justify-center
          ${transcriptionStatus === 'completed' ? 'text-green-300 bg-green-800/40' : 
            transcriptionStatus === 'error' || transcriptionError ? 'text-red-300 bg-red-800/40' :
            'text-blue-300 bg-blue-800/40'}`}>
          {transcriptionStatus === 'processing' || transcriptionStatus === 'queued' || transcriptionStatus === 'translating_from_es' ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : 
           transcriptionStatus === 'error' || transcriptionError ? <AlertTriangle size={13} className="mr-1.5" /> :
           transcriptionStatus === 'completed' ? <CheckCircle size={13} className="mr-1.5" /> :
           null
          }
          <span>{statusText}</span>
          {transcriptionError && transcriptionStatus !== 'error' && <span className="ml-1 text-red-400">({getLocaleString('errorGeneric', currentLanguage)})</span>}
        </div>
      )}
       {transcriptionError && !statusText && (
         <p className="mt-2 text-xs text-red-300 text-center bg-red-800/40 p-2 rounded-md flex items-center justify-center">
            <AlertTriangle size={14} className="mr-1.5" />{transcriptionError}
         </p>
       )}


    </div>
  );
};

export default FileUploadItem;