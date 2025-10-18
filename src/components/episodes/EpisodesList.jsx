
import React, { useMemo } from 'react';
import EpisodeListItem from './EpisodeListItem';

const EpisodesList = React.memo(({ episodes, currentLanguage, episodeQuestionsCount, allQuestions, updateTimestamp }) => {
  if (episodes.length === 0) {
    return null; 
  }

  const filteredEpisodeQuestions = useMemo(() => {
    return episodes.map(episode => {
      const effectiveLang = episode.lang === 'all' ? currentLanguage : episode.lang;
      return {
        episodeSlug: episode.slug,
        questions: allQuestions.filter(q => q.episode_slug === episode.slug && q.lang === effectiveLang) || [],
        questionsCount: episodeQuestionsCount[episode.slug]?.[effectiveLang] || 0
      };
    });
  }, [episodes, currentLanguage, episodeQuestionsCount, allQuestions, updateTimestamp]);

  return (
    <ul className="space-y-4 animate-fade-in">
      {filteredEpisodeQuestions.map((episodeData) => {
        const episode = episodes.find(ep => ep.slug === episodeData.episodeSlug);
        const questionsCount = episodeData.questionsCount;
                                          
        return (
          <EpisodeListItem
            key={`${episode.slug}-${episode.lang === 'all' ? currentLanguage : episode.lang}-${updateTimestamp || ''}`}
            episode={episode}
            currentLanguage={currentLanguage}
            questionsCount={questionsCount}
            questionsForEpisode={episodeData.questions}
            updateTimestamp={updateTimestamp}
          />
        );
      })}
    </ul>
  );
});

export default EpisodesList;
