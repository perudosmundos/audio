
import React from 'react';
import { List } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const EmptyState = ({ currentLanguage }) => (
  <div className="text-center py-12 animate-fade-in-up">
    <List className="mx-auto h-16 w-16 text-slate-500 mb-4" />
    <p className="mt-4 text-lg text-slate-300">
      {getLocaleString('noEpisodesFoundForLanguage', currentLanguage, { language: getLocaleString(currentLanguage, currentLanguage) })}
    </p>
    <p className="mt-2 text-sm text-slate-400">{getLocaleString('tryUploadingAudioOrFilter', currentLanguage)}</p>
  </div>
);

export default EmptyState;
