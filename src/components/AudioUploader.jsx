import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import r2Service from '@/lib/r2Service'; 
import assemblyAIService from '@/lib/assemblyAIService';
import { getFileNameWithoutExtension } from '@/lib/utils';

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
        const { fileUrl: workerFileUrl, fileKey, bucketName } = await r2Service.uploadFile(
          file, 
          (progress, details) => {
            setUploadProgress(progress);
            setUploadProgressDetails(details);
            if (details?.message) {
              console.log(`[Upload UI] ${file.name}: ${progress}% — ${details.message} (${details?.uploadedMB || '0.00'} / ${details?.totalMB || '0.00'} MB)`);
            }
          },
          currentLanguage
        );
        toast({ title: getLocaleString('uploadToR2Success', currentLanguage), description: `${file.name} (Archive.org: ${bucketName})` });

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-slate-700 max-w-lg w-full text-white">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-purple-300 mb-2">
            {getLocaleString('uploadAudioFiles', currentLanguage)}
          </h2>
          <p className="text-slate-400 text-sm">
            {getLocaleString('uploadAudioDescription', currentLanguage)}
          </p>
        </div>

        <div {...getRootProps()} className={`mt-4 p-8 border-2 border-dashed rounded-lg text-center cursor-pointer
          ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}`}>
          <input {...getInputProps()} />
          <div className="mx-auto h-12 w-12 text-slate-500 mb-2 text-4xl">☁️</div>
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
                  <div className="h-5 w-5 text-purple-400">🎵</div>
                  <span className="text-sm truncate" title={file.name}>{file.name}</span>
                </div>
                {!isUploading && (
                  <button onClick={() => removeFile(file)} className="text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer">
                    ❌
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
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
             <div className="h-5 w-5 mr-2">✅</div>
             <p>{getLocaleString('allFilesUploadedSuccessfully', currentLanguage)}</p>
           </div>
        )}

        <div className="mt-6 flex gap-3">
          <button 
            onClick={handleClose} 
            disabled={isUploading} 
            className="flex-1 px-4 py-2 border border-slate-600 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {getLocaleString('close', currentLanguage)}
          </button>
          <button 
            onClick={handleUpload} 
            disabled={isUploading || files.length === 0} 
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <div className="inline-block h-4 w-4 animate-spin mr-2">⏳</div>
                {getLocaleString('uploadingInProgress', currentLanguage)}
              </>
            ) : (
              getLocaleString('startUpload', currentLanguage)
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioUploader;