import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress'; 
import { UploadCloud, FileAudio, X, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import bunnyService from '@/lib/bunnyService';
import { getFileNameWithoutExtension } from '@/lib/utils';
import assemblyAIService from '@/lib/assemblyAIService';

const AudioUploader = ({ isOpen, onClose, onUploadSuccess, currentLanguage }) => {
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressDetails, setUploadProgressDetails] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(acceptedFiles => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file)
    }))]);
    setUploadError(null);
    setUploadComplete(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'] },
    multiple: true
  });

  const removeFile = (fileToRemove) => {
    setFiles(files.filter(file => file !== fileToRemove));
  };

  const generateEpisodeSlug = (dateStr, lang) => {
    if (!dateStr) dateStr = new Date().toISOString().split('T')[0]; // Fallback to current date
    return `${dateStr}_${lang}`;
  };

  const extractDetailsFromFilename = (filename) => {
    const nameWithoutExt = getFileNameWithoutExtension(filename);
    let title = nameWithoutExt;
    let lang = 'all';
    let parsedDate = null; // YYYY-MM-DD

    const dateMatch = nameWithoutExt.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (dateMatch) {
      parsedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      title = title.replace(dateMatch[0], '').trim().replace(/^[-_]+|[-_]+$/g, '');
    } else {
      // Try to parse if filename itself is a date like YYYY-MM-DD
      const strictDateMatch = nameWithoutExt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (strictDateMatch) {
        parsedDate = `${strictDateMatch[1]}-${strictDateMatch[2]}-${strictDateMatch[3]}`;
        title = ''; // No specific title part if filename is just date
      }
    }
    
    const langSuffixMatch = title.match(/_([RUruESes]{2})$/);
    if (langSuffixMatch) {
        lang = langSuffixMatch[1].toLowerCase();
        title = title.substring(0, title.lastIndexOf(langSuffixMatch[0])).trim().replace(/^[-_]+|[-_]+$/g, '');
    }
    
    title = title || (parsedDate ? `Meditación ${parsedDate}` : nameWithoutExt);

    return { title, lang, parsedDate };
  };


  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadProgressDetails(null);
    setUploadError(null);
    setUploadComplete(false);

    for (const file of files) {
      try {
        // Проверяем API ключ перед загрузкой
        console.log('AudioUploader: Validating Bunny.net API key...');
        const apiValidation = await bunnyService.validateAPIKey();
        
        if (!apiValidation.valid) {
          console.error('AudioUploader: API key validation failed:', apiValidation.error);
          toast({ 
            title: getLocaleString('uploadError', currentLanguage), 
            description: `Bunny.net API key error: ${apiValidation.error}`,
            variant: 'destructive'
          });
          continue;
        }
        
        console.log('AudioUploader: API key is valid, proceeding with upload...');
        
        const { fileUrl: workerFileUrl, fileKey, bucketName } = await bunnyService.uploadFile(
          file, 
          (progress, details) => {
            setUploadProgress(progress);
            setUploadProgressDetails(details);
          },
          currentLanguage
        );
        toast({ title: getLocaleString('uploadToBunnySuccess', currentLanguage), description: `${file.name} (Bunny.net: ${bucketName})` });

        const audioForDuration = new Audio(URL.createObjectURL(file));
        let duration = 0;
        try {
            duration = await new Promise((resolve) => {
                audioForDuration.onloadedmetadata = () => resolve(audioForDuration.duration);
                audioForDuration.onerror = () => resolve(0); 
            });
        } catch (e) { console.error("Error getting duration",e); duration = 0; }

        const { title: episodeTitle, lang: fileLang, parsedDate: episodeDate } = extractDetailsFromFilename(file.name);
        const episodeSlug = generateEpisodeSlug(episodeDate || new Date().toISOString().split('T')[0], fileLang);
        
        const { data: episodeData, error: dbError } = await supabase
          .from('episodes')
          .insert([
            { 
              slug: episodeSlug,
              title: episodeTitle, 
              lang: fileLang,
              date: episodeDate || new Date().toISOString().split('T')[0],
              audio_url: workerFileUrl, 
              r2_object_key: fileKey,
              r2_bucket_name: bucketName,
              duration: Math.round(duration || 0),
            }
          ])
          .select('slug')
          .maybeSingle();

        if (dbError) {
            if (dbError.code === '23505') { // Unique violation for slug
                toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Эпизод с slug ${episodeSlug} уже существует.`, variant: 'destructive'});
            } else {
                throw new Error(`Supabase error: ${dbError.message}`);
            }
            setIsUploading(false);
            return;
        }
        toast({ title: getLocaleString('metadataSavedSuccess', currentLanguage), description: file.name });
        
        if (episodeData && episodeData.slug) {
          let assemblyLangCode;
          let transcriptLangForDb;

          if (fileLang === 'all') {
            assemblyLangCode = currentLanguage === 'ru' ? 'ru' : 'es'; 
            transcriptLangForDb = currentLanguage;
          } else {
            assemblyLangCode = fileLang;
            transcriptLangForDb = fileLang;
          }
          
          const transcriptJob = await assemblyAIService.submitTranscription(
            workerFileUrl, 
            assemblyLangCode, 
            episodeData.slug, // Pass episode slug to webhook
            currentLanguage 
          );
          
          const { error: transcriptDbError } = await supabase
            .from('transcripts')
            .insert([{
              episode_slug: episodeData.slug,
              lang: transcriptLangForDb, 
              assemblyai_transcript_id: transcriptJob.id,
              status: transcriptJob.status,
            }]);

          if (transcriptDbError) console.error("Error saving initial transcript job to DB:", transcriptDbError);
          
          toast({ title: getLocaleString('transcriptionStarted', currentLanguage), description: `${file.name} (${assemblyLangCode})` });
        }
        
      } catch (error) {
        console.error('Upload process error for file', file.name, ':', error);
        setUploadError(`${getLocaleString('errorUploadingFile', currentLanguage, {fileName: file.name})}: ${error.message}`);
        toast({ title: getLocaleString('uploadError', currentLanguage), description: error.message, variant: 'destructive'});
        setIsUploading(false); 
        return; 
      }
    }
    
    setUploadComplete(true);
    setIsUploading(false);
    setFiles([]); 
    if (onUploadSuccess) onUploadSuccess();
  };

  const handleClose = () => {
    if (isUploading) return; 
    setFiles([]);
    setUploadProgress(0);
    setUploadProgressDetails(null);
    setUploadError(null);
    setUploadComplete(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-purple-300">{getLocaleString('uploadAudioFiles', currentLanguage)}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {getLocaleString('uploadAudioDescription', currentLanguage)}
          </DialogDescription>
        </DialogHeader>

        <div {...getRootProps()} className={`mt-4 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer
          ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}`}>
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-12 w-12 text-slate-500 mb-2" />
          {isDragActive ? (
            <p className="text-purple-400">{getLocaleString('dropFilesHere', currentLanguage)}</p>
          ) : (
            <p className="text-slate-400">{getLocaleString('dragOrClickUpload', currentLanguage)}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">{getLocaleString('supportedFormats', currentLanguage)}: MP3, WAV, M4A, etc.</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto space-y-2 pr-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-purple-400" />
                  <span className="text-sm truncate" title={file.name}>{file.name}</span>
                </div>
                {!isUploading && (
                  <Button variant="ghost" size="icon_sm" onClick={() => removeFile(file)} className="text-red-400 hover:text-red-300">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {isUploading && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="w-full [&>div]:bg-purple-500" />
            <div className="text-sm text-center mt-2 text-purple-300">
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
          <p className="mt-4 text-sm text-red-400 text-center">{uploadError}</p>
        )}
        
        {uploadComplete && !uploadError && (
           <div className="mt-4 text-center text-green-400 flex items-center justify-center">
             <CheckCircle className="h-5 w-5 mr-2"/>
             <p>{getLocaleString('allFilesUploadedSuccessfully', currentLanguage)}</p>
           </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose} disabled={isUploading} className="border-slate-600 hover:bg-slate-700">
            {getLocaleString('close', currentLanguage)}
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || files.length === 0} className="bg-purple-600 hover:bg-purple-700">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {getLocaleString('uploadingInProgress', currentLanguage)}
              </>
            ) : (
              getLocaleString('startUpload', currentLanguage)
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AudioUploader;