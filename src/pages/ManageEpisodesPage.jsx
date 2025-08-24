import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Loader2, Search, ArrowLeft, ShieldAlert } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import { formatShortDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import r2Service from '@/lib/r2Service';

const ManageEpisodesPage = ({ currentLanguage }) => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [episodeToDelete, setEpisodeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [episodesWithMissingFiles, setEpisodesWithMissingFiles] = useState([]);
  const [checkingMissingFiles, setCheckingMissingFiles] = useState(false);
  const navigate = useNavigate();
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

  const checkMissingFiles = useCallback(async () => {
    if (!episodes || episodes.length === 0) return;
    
    setCheckingMissingFiles(true);
    const missingFiles = [];
    
    // Check files in batches
    const batchSize = 3;
    for (let i = 0; i < episodes.length; i += batchSize) {
      const batch = episodes.slice(i, i + batchSize);
      const batchPromises = batch.map(async (episode) => {
        if (!episode.r2_object_key) return null;
        
        try {
          const { exists } = await r2Service.checkFileExists(episode.r2_object_key);
          if (!exists) {
            return episode;
          }
        } catch (error) {
          console.warn('Error checking file for episode:', episode.slug, error);
        }
        return null;
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => {
        if (result) missingFiles.push(result);
      });
      
      // Small delay between batches
      if (i + batchSize < episodes.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setEpisodesWithMissingFiles(missingFiles);
    setCheckingMissingFiles(false);
  }, [episodes]);

  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes]);

  useEffect(() => {
    if (episodes.length > 0) {
      checkMissingFiles();
    }
  }, [episodes, checkMissingFiles]);

  const handleDeleteClick = (episode) => {
    setEpisodeToDelete(episode);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!episodeToDelete) return;
    setIsDeleting(true);

    try {
      const { slug, lang, r2_object_key, r2_bucket_name } = episodeToDelete;

      const { error: questionsError } = await supabase
        .from('questions')
        .delete()
        .eq('episode_slug', slug)
        .eq('lang', lang);
      if (questionsError) throw new Error(getLocaleString('errorDeletingQuestions', currentLanguage, { errorMessage: questionsError.message }));

      const { error: transcriptsError } = await supabase
        .from('transcripts')
        .delete()
        .eq('episode_slug', slug)
        .eq('lang', lang);
      if (transcriptsError) throw new Error(getLocaleString('errorDeletingTranscripts', currentLanguage, { errorMessage: transcriptsError.message }));
      
      if (r2_object_key && r2_bucket_name) {
        const deleteArchiveResult = await r2Service.deleteFile(r2_object_key, r2_bucket_name, currentLanguage);
        if (!deleteArchiveResult.success) {
           toast({ title: getLocaleString('warning', currentLanguage), description: getLocaleString('errorDeletingR2FilePartial', currentLanguage, {fileName: r2_object_key, errorMessage: deleteArchiveResult.error}), variant: 'destructive' });
        } else {
           toast({ title: getLocaleString('fileDeletedFromR2Title', currentLanguage), description: getLocaleString('fileDeletedFromR2Desc', currentLanguage, {fileName: r2_object_key}) });
        }
      }

      const { error: episodeError } = await supabase
        .from('episodes')
        .delete()
        .eq('slug', slug);
      if (episodeError) throw new Error(getLocaleString('errorDeletingEpisodeDB', currentLanguage, { errorMessage: episodeError.message }));

      toast({ title: getLocaleString('episodeDeletedTitle', currentLanguage), description: getLocaleString('episodeDeletedSuccess', currentLanguage, { episodeTitle: episodeToDelete.title || episodeToDelete.slug }) });
      fetchEpisodes();
    } catch (error) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setEpisodeToDelete(null);
    }
  };

  const filteredEpisodes = episodes.filter(ep => {
    const prefix = getLocaleString('meditationTitlePrefix', currentLanguage);
    let datePart = '';
    if (ep.date) {
        datePart = formatShortDate(ep.date, currentLanguage);
    }
    const episodeComputedTitle = datePart ? `${prefix} ${datePart}` : ep.title || prefix;
    return episodeComputedTitle.toLowerCase().includes(searchTerm.toLowerCase()) || ep.slug.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatEpisodeTitle = (title, episodeDate, lang) => {
    const prefix = getLocaleString('meditationTitlePrefix', lang);
    let datePart = '';
    if (episodeDate) {
      datePart = formatShortDate(episodeDate, lang);
    }
    return datePart ? `${prefix} ${datePart}` : title || prefix;
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl bg-slate-800/70 rounded-xl shadow-2xl border border-slate-700/50">
      <Button 
        variant="outline" 
        onClick={() => navigate('/episodes')} 
        className="mb-6 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodes', currentLanguage)}
      </Button>
      <h1 className="text-3xl font-bold text-purple-300 mb-2">{getLocaleString('manageEpisodesTitle', currentLanguage)}</h1>
      <p className="text-sm text-slate-400 mb-6">{getLocaleString('manageEpisodesDescription', currentLanguage)}</p>

      <div className="mb-6">
        <div className="relative">
          <Input 
            type="text"
            placeholder={getLocaleString('searchEpisodes', currentLanguage)}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-700/80 border-slate-600 focus:border-purple-500 text-white placeholder-slate-400"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        </div>
      </div>

      {/* Missing Files Section */}
      {episodesWithMissingFiles.length > 0 && (
        <div className="mb-8 p-4 bg-red-500/20 border border-red-500/40 rounded-lg">
          <h2 className="text-lg font-semibold text-red-300 mb-3 flex items-center">
            <ShieldAlert className="h-5 w-5 mr-2" />
            {getLocaleString('episodesWithMissingFiles', currentLanguage)} ({episodesWithMissingFiles.length})
          </h2>
          <p className="text-sm text-red-200 mb-4">
            {getLocaleString('missingFilesDescription', currentLanguage)}
          </p>
          <ul className="space-y-2">
            {episodesWithMissingFiles.map(episode => (
              <li key={episode.slug} className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-medium text-red-200">
                    {formatEpisodeTitle(episode.title, episode.date, episode.lang === 'all' ? currentLanguage : episode.lang)}
                  </h3>
                  <p className="text-xs text-red-300">{episode.slug} - {episode.r2_object_key}</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleDeleteClick(episode)}
                  className="bg-red-700 hover:bg-red-800 text-white"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  {getLocaleString('delete', currentLanguage)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {checkingMissingFiles && (
        <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 animate-spin text-yellow-400 mr-2" />
            <span className="text-yellow-200">{getLocaleString('checkingMissingFiles', currentLanguage)}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        </div>
      ) : filteredEpisodes.length === 0 ? (
        <p className="text-center text-slate-400 py-10">{getLocaleString('noEpisodesFound', currentLanguage)}</p>
      ) : (
        <ul className="space-y-3">
          {filteredEpisodes.map(episode => (
            <li key={episode.slug} className="p-4 bg-slate-700/60 rounded-lg border border-slate-600 flex justify-between items-center">
              <div>
                <h2 className="text-md font-semibold text-purple-200 truncate" title={formatEpisodeTitle(episode.title, episode.date, episode.lang === 'all' ? currentLanguage : episode.lang)}>
                  {formatEpisodeTitle(episode.title, episode.date, episode.lang === 'all' ? currentLanguage : episode.lang)}
                </h2>
                <p className="text-xs text-slate-400">{episode.slug} 

                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => handleDeleteClick(episode)}
                className="bg-red-700 hover:bg-red-800 text-white"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {getLocaleString('delete', currentLanguage)}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {episodeToDelete && (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-400 flex items-center">
                <ShieldAlert className="h-6 w-6 mr-2" />
                {getLocaleString('confirmDeleteTitle', currentLanguage)}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-300">
                {getLocaleString('confirmDeleteEpisodeMessage', currentLanguage, { episodeTitle: formatEpisodeTitle(episodeToDelete.title, episodeToDelete.date, episodeToDelete.lang === 'all' ? currentLanguage : episodeToDelete.lang) })}
                <br/>
                <span className="font-semibold text-yellow-400 mt-2 block">{getLocaleString('actionIrreversible', currentLanguage)}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)} className="bg-slate-600 hover:bg-slate-500 border-slate-500" disabled={isDeleting}>
                {getLocaleString('cancel', currentLanguage)}
              </AlertDialogCancel>
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

export default ManageEpisodesPage;