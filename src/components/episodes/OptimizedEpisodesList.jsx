import React, { useEffect, useRef, useMemo } from 'react';
import EpisodeListItem from './EpisodeListItem';

const OptimizedEpisodesList = React.memo(({ 
  episodes, 
  currentLanguage, 
  episodeQuestionsCount, 
  allQuestions,
  onEpisodeVisibilityChange 
}) => {
  const observerRef = useRef(null);
  const visibleEpisodesRef = useRef(new Set());

  useEffect(() => {
    // Создаем Intersection Observer для отслеживания видимых эпизодов
    if (onEpisodeVisibilityChange) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            const episodeSlug = entry.target.dataset.episodeSlug;
            if (episodeSlug) {
              if (entry.isIntersecting) {
                visibleEpisodesRef.current.add(episodeSlug);
              } else {
                visibleEpisodesRef.current.delete(episodeSlug);
              }
            }
          });
          
          // Уведомляем родительский компонент об изменениях
          onEpisodeVisibilityChange(Array.from(visibleEpisodesRef.current));
        },
        {
          rootMargin: '50px 0px', // Начинаем отслеживать за 50px до появления
          threshold: 0.1 // Элемент считается видимым при 10% видимости
        }
      );
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onEpisodeVisibilityChange]);

  // Функция для прикрепления наблюдателя к элементу
  const attachObserver = (element, episodeSlug) => {
    if (observerRef.current && element) {
      element.dataset.episodeSlug = episodeSlug;
      observerRef.current.observe(element);
    }
  };

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
  }, [episodes, currentLanguage, episodeQuestionsCount, allQuestions]);

  return (
    <ul className="space-y-4 animate-fade-in">
      {filteredEpisodeQuestions.map((episodeData) => {
        const episode = episodes.find(ep => ep.slug === episodeData.episodeSlug);
                                          
        return (
          <li 
            key={`${episode.slug}-${episode.lang === 'all' ? currentLanguage : episode.lang}`}
            ref={(el) => attachObserver(el, episode.slug)}
          >
            <EpisodeListItem
              episode={episode}
              currentLanguage={currentLanguage}
              questionsCount={episodeData.questionsCount}
              questionsForEpisode={episodeData.questions}
            />
          </li>
        );
      })}
    </ul>
  );
});

export default OptimizedEpisodesList;
