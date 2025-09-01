
import React from 'react';

const EpisodesList = React.memo(({ episodes, currentLanguage, episodeQuestionsCount, allQuestions }) => {
  if (episodes.length === 0) {
    return null; 
  }
  return (
    <ul className="space-y-4 animate-fade-in">
      {episodes.map((episode) => {
        const effectiveLang = episode.lang === 'all' ? currentLanguage : episode.lang;
        const questionsForThisEpisode = allQuestions.filter(q => q.episode_slug === episode.slug && q.lang === effectiveLang) || [];
                                          
        return (
          <li key={episode.slug + '-' + effectiveLang} className="bg-slate-800/70 rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all duration-300 ease-in-out border border-slate-700/50 hover:border-purple-500/60 animate-fade-in-up">
            <div className="p-4">
              <div className="block group mb-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                  <h2 className="text-lg font-semibold group-hover:text-purple-200 transition-colors truncate flex-grow text-purple-300">
                    {episode.title || `Episode ${episode.slug}`}
                  </h2>
                </div>
                <div className="text-sm text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                  {episode.duration > 0 && (
                     <span>
                       Duration: <span className="font-medium text-slate-300">{episode.duration}s</span>
                     </span>
                  )}
                  <span>
                    Questions: {episodeQuestionsCount[episode.slug]?.[effectiveLang] || 0}
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
});

export default EpisodesList;
