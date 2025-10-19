
import { useCallback } from 'react';
import { getLocaleString } from '@/lib/locales';

const usePlayerNavigation = ({
  audioRef,
  durationState,
  isPlayingState,
  setIsPlayingState,
  onQuestionSelectJump,
  internalQuestions,
  currentTimeState,
  toast,
  currentLanguage,
  currentPlaybackRateIndex,
  setCurrentPlaybackRateIndex,
  playbackRateOptions,
  episodeData,
  onPlayerStateChange,
}) => {

  const handleProgressChange = useCallback((newTime) => {
    if (audioRef.current && !isNaN(newTime)) {
      const clampedTime = Math.max(0, Math.min(durationState || 0, newTime));
      
      // Всегда сохраняем текущее состояние воспроизведения при перемотке
      onQuestionSelectJump(clampedTime, null, isPlayingState);
    }
  }, [audioRef, durationState, onQuestionSelectJump, isPlayingState]);

  const handleSkip = useCallback((seconds) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      
      // Оптимизация: для быстрой перемотки используем прямую установку времени
      if (Math.abs(seconds) <= 10) {
        // Быстрая перемотка - обновляем время напрямую для мгновенного отклика
        audioRef.current.currentTime = newTime;
        // Обновляем состояние через обычный механизм, но без ожидания
        onQuestionSelectJump(newTime, null, isPlayingState);
      } else {
        // Большие переходы - используем обычную логику
        onQuestionSelectJump(newTime, null, isPlayingState);
      }
    }
  }, [onQuestionSelectJump, audioRef, isPlayingState]);

  const navigateQuestion = useCallback((direction) => {
    if (!internalQuestions || internalQuestions.length === 0) {
      toast({ title: getLocaleString('navigationToastTitle', currentLanguage), description: getLocaleString('navigationNoQuestions', currentLanguage), className:"bg-blue-600/80 border-blue-500 text-white" });
      return;
    }

    let currentQuestionIndex = -1;
    let currentQuestionStartTime = 0;

    for (let i = 0; i < internalQuestions.length; i++) {
      if (internalQuestions[i].time <= currentTimeState) {
        currentQuestionIndex = i;
        currentQuestionStartTime = internalQuestions[i].time;
      } else {
        break; 
      }
    }
    
    const playAfterNav = isPlayingState; // Используем состояние React вместо аудио элемента

    if (direction < 0) { 
      if (currentQuestionIndex !== -1 && (currentTimeState - currentQuestionStartTime > 2)) {
        onQuestionSelectJump(currentQuestionStartTime, internalQuestions[currentQuestionIndex].id, playAfterNav);
      } else if (currentQuestionIndex > 0) {
        onQuestionSelectJump(internalQuestions[currentQuestionIndex - 1].time, internalQuestions[currentQuestionIndex - 1].id, playAfterNav);
      } else {
        onQuestionSelectJump(0, internalQuestions.length > 0 ? internalQuestions[0].id : null, playAfterNav);
      }
    } else { 
      if (currentQuestionIndex < internalQuestions.length - 1) {
        onQuestionSelectJump(internalQuestions[currentQuestionIndex + 1].time, internalQuestions[currentQuestionIndex + 1].id, playAfterNav);
      } else {
        return; 
      }
    }
  }, [internalQuestions, currentTimeState, audioRef, onQuestionSelectJump, currentLanguage, toast]);

  const seekAudio = useCallback((time, playAfterSeek = false) => {
     onQuestionSelectJump(time, null, playAfterSeek);
  }, [onQuestionSelectJump]);

  const togglePlayPause = useCallback(() => {
    if (!episodeData?.audio_url && audioRef.current) {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('noAudioSource', currentLanguage), variant: 'destructive' });
        setIsPlayingState(false);
        onPlayerStateChange?.({isPlaying: false});
        return;
    }
    
    // Проверяем реальное состояние аудио элемента
    const audioIsActuallyPlaying = audioRef.current && !audioRef.current.paused;
    const newIsPlaying = !audioIsActuallyPlaying;
    
    setIsPlayingState(newIsPlaying);
    onPlayerStateChange?.({isPlaying: newIsPlaying});
  }, [episodeData?.audio_url, toast, currentLanguage, audioRef, setIsPlayingState, onPlayerStateChange]);

  const setPlaybackRateByIndex = useCallback((index) => {
    if (index >= 0 && index < playbackRateOptions.length) {
      setCurrentPlaybackRateIndex(index);
      if (audioRef.current) {
        audioRef.current.playbackRate = playbackRateOptions[index].value;
      }
      onPlayerStateChange?.({ playbackRate: playbackRateOptions[index].value });
    }
  }, [playbackRateOptions, setCurrentPlaybackRateIndex, audioRef, onPlayerStateChange]);

  return {
    handleProgressChange,
    handleSkip,
    navigateQuestion,
    seekAudio,
    togglePlayPause,
    setPlaybackRateByIndex,
  };
};

export default usePlayerNavigation;
