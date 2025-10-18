
import React from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const EmptyState = ({ currentLanguage, isLoading = false }) => (
  <div className="text-center py-12 animate-fade-in-up">
    {isLoading ? (
      <>
        <Loader2 className="mx-auto h-16 w-16 text-purple-400 animate-spin mb-4" />
        <p className="mt-4 text-lg text-slate-300">
          {getLocaleString('loadingEpisodes', currentLanguage)}
        </p>
      </>
    ) : (
      <>
        <FileText className="mx-auto h-16 w-16 text-slate-500 mb-4" />
        <p className="mt-4 text-lg text-slate-300">
          {getLocaleString('noEpisodesFoundForLanguage', currentLanguage, { language: getLocaleString(`language${currentLanguage.charAt(0).toUpperCase() + currentLanguage.slice(1)}`, currentLanguage) })}
        </p>
        <p className="mt-2 text-sm text-slate-400">{getLocaleString('tryUploadingAudioOrFilter', currentLanguage)}</p>
      </>
    )}
  </div>
);

export default EmptyState;
