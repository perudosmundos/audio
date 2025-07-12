import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocaleString } from '@/lib/locales';
import { Link } from 'react-router-dom';

const PlayerHeader = ({ episodeTitle, episodeDate, onNavigateBack, currentLanguage, isReadingMode }) => {
  const logoUrl = "https://dosmundos.pe/wp-content/uploads/2025/02/logo-5-120x120.png";

  return (
    <div className="relative flex items-center justify-center mb-3 sm:mb-4">
      {!isReadingMode && (
        onNavigateBack ? (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onNavigateBack} 
            className="text-slate-300 hover:text-white hover:bg-white/10 absolute left-0 top-1/2 -translate-y-1/2 ml-1 shrink-0"
            aria-label={getLocaleString('backToEpisodesShort', currentLanguage)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <Link to="/episodes" className="absolute left-0 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 transition-colors shrink-0" aria-label={getLocaleString('backToEpisodes', currentLanguage)}>
            <img src={logoUrl} alt="Dos Mundos Logo" className="h-8 w-8 rounded-sm" />
          </Link>
        )
      )}
      <div className="flex-grow text-center">
        <h1 
          className={`font-bold truncate ${isReadingMode ? 'text-3xl text-slate-900' : 'text-xl sm:text-2xl text-white'}`} 
          title={episodeTitle}
        >
          {episodeTitle}
        </h1>
      </div>
      {!isReadingMode && onNavigateBack && <div className="w-8 shrink-0"></div>}
    </div>
  );
};

export default PlayerHeader;