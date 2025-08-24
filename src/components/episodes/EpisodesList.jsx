
import React from 'react';
import EpisodeListItem from './EpisodeListItem';

const EpisodesList = React.memo(({ episodes, currentLanguage, episodeQuestionsCount, allQuestions }) => {
  if (episodes.length === 0) {
    return null; 
  }
  return (
    <ul className="space-y-4 animate-fade-in">
      {episodes.map((episode) => {
        const effectiveLang = episode.lang === 'all' ? currentLanguage : episode.lang;
        const questionsForThisEpisode = allQuestions.filter(q => 
          q.episode_slug === episode.slug && 
          q.lang === effectiveLang && 
          (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual' || (q.title && q.title.trim() !== ''))
        ) || [];
                                          
        return (
          <EpisodeListItem 
            key={episode.slug + '-' + effectiveLang} 
            episode={episode} 
            currentLanguage={currentLanguage}
            questionsCount={episodeQuestionsCount[episode.slug]?.[effectiveLang] || 0}
            questionsForEpisode={questionsForThisEpisode}
          />
        );
      })}
    </ul>
  );
});

export default EpisodesList;
