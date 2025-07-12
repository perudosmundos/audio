import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadCloud, Loader2, PlusCircle, ArrowLeft, Settings2, Trash2, Search, ShieldAlert, ListChecks } from 'lucide-react';
import { getLocaleString, getPluralizedLocaleString } from '@/lib/locales';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import r2Service from '@/lib/r2Service';
import useFileUploadManager from '@/hooks/useFileUploadManager';
import FileUploadItem from '@/components/uploader/FileUploadItem';
import OverwriteDialog from '@/components/uploader/OverwriteDialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatShortDate } from '@/lib/utils';

const ManageEpisodesList = ({ currentLanguage }) => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEpisodes, setSelectedEpisodes] = useState({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [episodesToDelete, setEpisodesToDelete] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('episodes')
      .select('slug, title, lang, date, r2_object_key, r2_bucket_name, file_has_lang_suffix')
      .order('date', { ascending: false });

    if (error) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorFetchingEpisodes', currentLanguage, { errorMessage: error.message }), variant: 'destructive' });
      setEpisodes([]);
    } else {
      setEpisodes(data || []);
    }
    setLoading(false);
  }, [currentLanguage, toast]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  const handleSelectEpisode = (slug, lang) => {
    const id = `${slug}-${lang}`;
    setSelectedEpisodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selectedEpisodes).every(Boolean) && Object.keys(selectedEpisodes).length === filteredEpisodes.length && filteredEpisodes.length > 0;
    const newSelectedEpisodes = {};
    if (!allSelected) {
      filteredEpisodes.forEach(ep => {
        newSelectedEpisodes[`${ep.slug}-${ep.lang}`] = true;
      });
    }
    setSelectedEpisodes(newSelectedEpisodes);
  };
  

  const numSelected = Object.values(selectedEpisodes).filter(Boolean).length;

  const handleDeleteClick = (episode) => {
    setEpisodesToDelete([episode]);
    setShowDeleteDialog(true);
  };
  
  const handleDeleteSelectedClick = () => {
    const toDelete = episodes.filter(ep => selectedEpisodes[`${ep.slug}-${ep.lang}`]);
    if (toDelete.length > 0) {
      setEpisodesToDelete(toDelete);
      setShowDeleteDialog(true);
    }
  };

  const confirmDelete = async () => {
    if (episodesToDelete.length === 0) return;
    setIsDeleting(true);

    let successCount = 0;
    let errorCount = 0;

    for (const episode of episodesToDelete) {
      try {
        const { slug, lang, r2_object_key, r2_bucket_name, title } = episode;
        
        const { error: questionsError } = await supabase.from('questions').delete().eq('episode_slug', slug).eq('lang', lang);
        if (questionsError) throw new Error(getLocaleString('errorDeletingQuestions', currentLanguage, { errorMessage: questionsError.message }));

        const { error: transcriptsError } = await supabase.from('transcripts').delete().eq('episode_slug', slug).eq('lang', lang);
        if (transcriptsError) throw new Error(getLocaleString('errorDeletingTranscripts', currentLanguage, { errorMessage: transcriptsError.message }));
        
        if (r2_object_key && r2_bucket_name) {
          const deleteR2Result = await r2Service.deleteFile(r2_object_key, r2_bucket_name, currentLanguage);
          if (!deleteR2Result.success) {
             toast({ title: getLocaleString('warning', currentLanguage), description: getLocaleString('errorDeletingR2FilePartial', currentLanguage, {fileName: r2_object_key, errorMessage: deleteR2Result.error}), variant: 'destructive' });
          } else {
             toast({ title: getLocaleString('fileDeletedFromR2Title', currentLanguage), description: getLocaleString('fileDeletedFromR2Desc', currentLanguage, {fileName: r2_object_key}) });
          }
        }

        const { error: episodeError } = await supabase.from('episodes').delete().eq('slug', slug);
        if (episodeError) throw new Error(getLocaleString('errorDeletingEpisodeDB', currentLanguage, { errorMessage: episodeError.message }));
        successCount++;
      } catch (error) {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `${getLocaleString('errorDeletingEpisodeDB', currentLanguage, {errorMessage: error.message})} (Episode: ${episode.title || episode.slug})`, variant: 'destructive' });
        errorCount++;
      }
    }
    
    if (successCount > 0) {
        toast({ title: getLocaleString('episodeDeletedTitle', currentLanguage), 
                description: `${successCount} ${getPluralizedLocaleString('episodeCount', currentLanguage, successCount, {count: successCount})} ${getLocaleString('deletedSuccessfully', currentLanguage) || 'deleted successfully'}.`
              });
    }


    fetchEpisodes();
    setSelectedEpisodes({});
    setIsDeleting(false);
    setShowDeleteDialog(false);
    setEpisodesToDelete([]);
  };

  const filteredEpisodes = episodes.filter(ep => {
    const prefix = getLocaleString('meditationTitlePrefix', currentLanguage);
    let datePart = '';
    if (ep.date) datePart = formatShortDate(ep.date, currentLanguage);
    const episodeComputedTitle = datePart ? `${prefix} ${datePart}` : ep.title || prefix;
    return episodeComputedTitle.toLowerCase().includes(searchTerm.toLowerCase()) || ep.slug.toLowerCase().includes(searchTerm.toLowerCase());
  });
  
  const formatEpisodeTitle = (title, episodeDate, lang) => {
    const prefix = getLocaleString('meditationTitlePrefix', lang);
    let datePart = '';
    if (episodeDate) datePart = formatShortDate(episodeDate, lang);
    return datePart ? `${prefix} ${datePart}` : title || prefix;
  };

  return (
    <div className="mt-10">
      <h2 className="text-2xl font-bold text-purple-300 mb-2 flex items-center">
        <Settings2 className="mr-2 h-6 w-6"/>
        {getLocaleString('manageExistingEpisodes', currentLanguage)}
      </h2>
      <p className="text-sm text-slate-400 mb-6">{getLocaleString('manageEpisodesDescription', currentLanguage)}</p>
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <Input 
            type="text"
            placeholder={getLocaleString('searchEpisodes', currentLanguage)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700/80 border-slate-600 focus:border-purple-500 text-white placeholder-slate-400 h-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        </div>
        <Button onClick={handleSelectAll} variant="outline" className="h-10 border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300 hover:text-white" disabled={filteredEpisodes.length === 0}>
           <ListChecks className="mr-2 h-4 w-4"/> {numSelected === filteredEpisodes.length && filteredEpisodes.length > 0 ? getLocaleString('deselectAll', currentLanguage) : getLocaleString('selectAll', currentLanguage)} ({numSelected})
        </Button>
        <Button onClick={handleDeleteSelectedClick} variant="destructive" className="h-10" disabled={numSelected === 0 || isDeleting}>
          <Trash2 className="mr-2 h-4 w-4"/> {getLocaleString('deleteSelected', currentLanguage)} ({numSelected})
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-purple-400" /></div>
      ) : filteredEpisodes.length === 0 ? (
        <p className="text-center text-slate-400 py-10">{getLocaleString('noEpisodesFound', currentLanguage)}</p>
      ) : (
        <ul className="space-y-3">
          {filteredEpisodes.map(episode => (
            <li key={`${episode.slug}-${episode.lang}`} className="p-3 sm:p-4 bg-slate-700/60 rounded-lg border border-slate-600 flex items-center gap-3">
              <Checkbox
                id={`select-${episode.slug}-${episode.lang}`}
                checked={!!selectedEpisodes[`${episode.slug}-${episode.lang}`]}
                onCheckedChange={() => handleSelectEpisode(episode.slug, episode.lang)}
                className="border-slate-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
              />
              <div className="flex-grow min-w-0">
                <label htmlFor={`select-${episode.slug}-${episode.lang}`} className="cursor-pointer">
                    <h3 className="text-sm sm:text-md font-semibold text-purple-200 truncate" title={formatEpisodeTitle(episode.title, episode.date, episode.lang === 'all' ? currentLanguage : episode.lang)}>
                    {formatEpisodeTitle(episode.title, episode.date, episode.lang === 'all' ? currentLanguage : episode.lang)}
                    </h3>
                </label>
                <p className="text-xs text-slate-400">{episode.slug} 
                {episode.file_has_lang_suffix && episode.lang !== 'all' && (
                  <span className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    episode.lang === 'ru' ? 'bg-blue-600/70 text-blue-100' : 
                    episode.lang === 'es' ? 'bg-yellow-600/70 text-yellow-100' :
                    'bg-green-600/70 text-green-100' 
                  }`}>
                    {episode.lang.toUpperCase()}
                  </span>
                )}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(episode)} className="bg-red-700 hover:bg-red-800 text-white shrink-0" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{getLocaleString('delete', currentLanguage)}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {showDeleteDialog && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400 flex items-center"><ShieldAlert className="h-6 w-6 mr-2" />{getLocaleString('confirmDeleteTitle', currentLanguage)}</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                { episodesToDelete.length === 1 
                    ? getLocaleString('confirmDeleteEpisodeMessage', currentLanguage, { episodeTitle: formatEpisodeTitle(episodesToDelete[0].title, episodesToDelete[0].date, episodesToDelete[0].lang === 'all' ? currentLanguage : episodesToDelete[0].lang) })
                    : getLocaleString('confirmDeleteMultipleEpisodesMessage', currentLanguage, { count: episodesToDelete.length })
                }
                <br/><span className="font-semibold text-yellow-400 mt-2 block">{getLocaleString('actionIrreversible', currentLanguage)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>{getLocaleString('cancel', currentLanguage)}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {isDeleting ? getLocaleString('deleting', currentLanguage) : getLocaleString('deleteConfirm', currentLanguage)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};


const ManagePage = ({ currentLanguage }) => {
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
      <h1 className="text-3xl font-bold text-purple-300 mb-2">{getLocaleString('manageAndUploadTitle', currentLanguage)}</h1>
      <p className="text-sm text-slate-400 mb-6">{getLocaleString('manageAndUploadDescription', currentLanguage)}</p>

      <div {...getRootProps({ className: `p-6 border-2 border-dashed rounded-lg text-center cursor-pointer mb-6 ${isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}` })}>
        <input {...getInputProps()} style={{ display: 'none' }} />
        <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-2" />
        {isDragActive ? (
          <p className="text-purple-300 text-md">{getLocaleString('dropFilesHere', currentLanguage)}</p>
        ) : (
          <p className="text-slate-300 text-md">{getLocaleString('dragOrClickUpload', currentLanguage)}</p>
        )}
         <Button type="button" onClick={open} variant="ghost" className="mt-2 text-purple-400 hover:text-purple-300 focus-visible:ring-purple-400 bg-purple-500/10 hover:bg-purple-500/20">
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
              currentLanguage={currentLanguage}
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
      
      <ManageEpisodesList currentLanguage={currentLanguage} />
    </div>
  );
};

export default ManagePage;