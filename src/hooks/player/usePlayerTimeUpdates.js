import { useCallback, useEffect, useRef } from 'react';
import { getLocaleString } from '@/lib/locales';

const usePlayerTimeUpdates = ({
  audioRef,
  isSeekingRef,
  internalQuestions,
  currentLanguage,
  setCurrentTimeState,
  setActiveQuestionTitleState,
  setDurationState,
  onPlayerStateChange,
}) => {
  const lastActiveQuestionTitleRef = useRef('');

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || isSeekingRef.current) {
      return;
    }

    const currentTime = audioRef.current.currentTime;

    // Проверяем валидность времени
    if (isNaN(currentTime) || currentTime < 0) {
      console.warn('Invalid currentTime detected:', currentTime);
      return;
    }

    setCurrentTimeState(currentTime);

    let activeQuestion = null;
    if (internalQuestions && internalQuestions.length > 0) {
      // Фильтруем вопросы без заголовка, кроме специальных блоков
      const filteredQuestions = internalQuestions.filter(q => {
        if (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual') {
          return true;
        }
        return q.title && q.title.trim() !== '';
      });
      
      const sortedQuestions = [...filteredQuestions].sort((a, b) => a.time - b.time);
      for (let i = sortedQuestions.length - 1; i >= 0; i--) {
        if (currentTime >= sortedQuestions[i].time) {
          activeQuestion = sortedQuestions[i];
          break;
        }
      }
    }
    
    const newActiveQuestionTitle = activeQuestion ? activeQuestion.title : getLocaleString('introduction', currentLanguage);
    if (newActiveQuestionTitle !== lastActiveQuestionTitleRef.current) {
      setActiveQuestionTitleState(newActiveQuestionTitle);
      lastActiveQuestionTitleRef.current = newActiveQuestionTitle;
    }

    if (onPlayerStateChange) {
      onPlayerStateChange({ currentTime, activeQuestionTitle: newActiveQuestionTitle });
    }
  }, [
    audioRef, 
    isSeekingRef, 
    internalQuestions, 
    currentLanguage, 
    setCurrentTimeState, 
    setActiveQuestionTitleState, 
    onPlayerStateChange
  ]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const newDuration = audioRef.current.duration;
      if (!isNaN(newDuration) && newDuration > 0) {
        setDurationState(newDuration);
        if (onPlayerStateChange) {
          onPlayerStateChange({ duration: newDuration });
        }
      }
    }
  }, [audioRef, setDurationState, onPlayerStateChange]);

  useEffect(() => {
    lastActiveQuestionTitleRef.current = ''; 
  }, [internalQuestions, currentLanguage]);

  return { handleTimeUpdate, handleLoadedMetadata };
};

export default usePlayerTimeUpdates;