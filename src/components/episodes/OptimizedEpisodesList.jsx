import React, { useEffect, useRef } from 'react';
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

  return (
    <ul className="space-y-4 animate-fade-in">
      {episodes.map((episode, index) => {
        const effectiveLang = episode.lang === 'all' ? currentLanguage : episode.lang;
        const questionsForThisEpisode = allQuestions.filter(q => q.episode_slug === episode.slug && q.lang === effectiveLang) || [];
        const questionsCount = episodeQuestionsCount[episode.slug]?.[effectiveLang] || 0;
                                          
        return (
          <li 
            key={episode.slug + '-' + effectiveLang}
            ref={(el) => attachObserver(el, episode.slug)}
          >
            <EpisodeListItem
              episode={episode}
              currentLanguage={currentLanguage}
              questionsCount={questionsCount}
              questionsForEpisode={questionsForThisEpisode}
            />
          </li>
        );
      })}
    </ul>
  );
});

export default OptimizedEpisodesList;
