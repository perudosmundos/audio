import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { UploadCloud, Loader2, PlusCircle, ArrowLeft } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import useFileUploadManager from '@/hooks/useFileUploadManager';
import FileUploadItem from '@/components/uploader/FileUploadItem';
import OverwriteDialog from '@/components/uploader/OverwriteDialog';

const UploadPage = ({ currentLanguage }) => {
  const navigate = useNavigate();
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
    handleTranslateTimings,
  } = useFileUploadManager(currentLanguage);

  const onDrop = useCallback((acceptedFiles) => {
    addFilesToQueue(acceptedFiles);
  }, [addFilesToQueue]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'] },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div className="container mx-auto p-4 max-w-4xl bg-slate-800/70 rounded-xl shadow-2xl border border-slate-700/50">
      <Button 
        variant="outline" 
        onClick={() => navigate('/episodes')} 
        className="mb-6 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodes', currentLanguage)}
      </Button>
      <h1 className="text-3xl font-bold text-purple-300 mb-2">{getLocaleString('uploadAudioFiles', currentLanguage)}</h1>
      <p className="text-sm text-slate-400 mb-6">{getLocaleString('uploadAudioDescription', currentLanguage)}</p>

      <div {...getRootProps({ className: `p-6 border-2 border-dashed rounded-lg text-center cursor-pointer mb-6 ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}` })}>
        <input {...getInputProps()} style={{ display: 'none' }} />
        <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-2" />
        {isDragActive ? (
          <p className="text-purple-300 text-md">{getLocaleString('dropFilesHere', currentLanguage)}</p>
        ) : (
          <p className="text-slate-300 text-md">{getLocaleString('dragOrClickUpload', currentLanguage)}</p>
        )}
         <Button type="button" onClick={open} variant="ghost" className="mt-2 text-purple-300 hover:text-purple-200">
            {getLocaleString('selectFiles', currentLanguage)}
        </Button>
        <p className="text-xs text-slate-500 mt-1">{getLocaleString('supportedFormats', currentLanguage)}</p>
      </div>

      {filesToProcess.length > 0 && (
        <div className="space-y-4 mb-6">
          {filesToProcess.map((itemData) => (
            <FileUploadItem 
              key={itemData.id}
              itemData={itemData}
              onTimingsChange={handleTimingsChange}
              onTitleChange={handleTitleChange}
              onRemove={handleRemoveItem}
              onTranslateTimings={handleTranslateTimings}
              currentLanguage={currentLanguage}
              canTranslate={filesToProcess.some(item => item.originalFileId === itemData.originalFileId && item.lang === 'en' && itemData.lang === 'es')}
            />
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between mt-8">
        <Button 
            onClick={open} 
            variant="outline"
            className="border-purple-500 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 focus-visible:ring-purple-500"
            disabled={isProcessingAll}
        >
            <PlusCircle className="mr-2 h-5 w-5" />
            {getLocaleString('addAnotherFile', currentLanguage)}
        </Button>
        <Button 
          onClick={handleProcessAllFiles} 
          disabled={isProcessingAll || filesToProcess.length === 0 || filesToProcess.every(fd => fd.isUploading || fd.uploadComplete || fd.uploadError)} 
          className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3 text-white"
        >
          {isProcessingAll ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {getLocaleString('processing', currentLanguage)}...
            </>
          ) : (
            <>{getLocaleString('startAllUploads', currentLanguage)}</>
          )}
        </Button>
      </div>

      <OverwriteDialog 
        isOpen={showOverwriteDialog}
        onOpenChange={cancelOverwrite} 
        onConfirm={confirmOverwrite}
        onCancel={cancelOverwrite}
        slug={currentItemForOverwrite?.episodeSlug || ''}
        currentLanguage={currentLanguage}
      />
    </div>
  );
};

export default UploadPage;