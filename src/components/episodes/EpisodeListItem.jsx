
import React from 'react';
import { Link } from 'react-router-dom';
import EpisodeQuestionsList from './EpisodeQuestionsList';
import { getLocaleString, getPluralizedLocaleString } from '@/lib/locales';
import { formatFullTime, formatShortDate } from '@/lib/utils';
// Removed unused icons to satisfy linter

const EpisodeListItem = React.memo(({ episode, currentLanguage, questionsCount, questionsForEpisode }) => {
  
  const formatEpisodeTitle = (title, episodeDate) => {
    const prefix = getLocaleString('meditationTitlePrefix', currentLanguage);
    let datePart = '';

    if (episodeDate) {
      datePart = formatShortDate(episodeDate, currentLanguage);
    }
    
    return datePart ? `${prefix} ${datePart}` : title || prefix;
  };

  const displayTitle = formatEpisodeTitle(episode.title, episode.date);
  const langDisplay = episode.lang === 'all' ? currentLanguage : episode.lang;
  const langColorClass = langDisplay === 'ru' ? 'bg-blue-600/70 text-blue-100' 
                      : langDisplay === 'es' ? 'bg-yellow-600/70 text-yellow-100' 
                      : 'bg-green-600/70 text-green-100';



  return (
    <li className="bg-slate-800/70 rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all duration-300 ease-in-out border border-slate-700/50 hover:border-purple-500/60 animate-fade-in-up">
      <div className="p-4">
        
        <Link to={`/episode/${episode.slug}`} className="block group mb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
            <h2 className="text-lg font-semibold group-hover:text-purple-200 transition-colors truncate flex-grow text-purple-300" title={displayTitle}>
              {displayTitle}
            </h2>
            {episode.file_has_lang_suffix && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ml-0 sm:ml-3 mt-1 sm:mt-0 ${langColorClass} shadow-sm`}>
                {langDisplay.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
            {episode.duration > 0 && (
               <span>
                 {getLocaleString('duration', currentLanguage)}: <span className="font-medium text-slate-300">{formatFullTime(episode.duration, false)}</span>
               </span>
            )}
            <span>
              {getPluralizedLocaleString('questionCount', currentLanguage, questionsCount || 0, { count: questionsCount || 0 })}
            </span>
          </div>
        </Link>
        <EpisodeQuestionsList
          questions={questionsForEpisode}
          episodeSlug={episode.slug}
          currentLanguage={currentLanguage}
        />
      </div>
    </li>
  );
});

export default EpisodeListItem;
