import { useEffect } from 'react';

const usePlayerInitialization = ({
  episodeData,
  audioRef,
  setIsPlayingState,
  setCurrentTimeState,
  setActiveQuestionTitleState,
  setDurationState,
  setCurrentPlaybackRateIndex,
  playbackRateOptions,
  onPlayerStateChange,
  lastJumpIdProcessedRef,
  jumpToTime, // Добавляем параметр для проверки активного перехода
}) => {
  useEffect(() => {
    console.log('usePlayerInitialization: Initializing player', { 
      episodeSlug: episodeData?.slug, 
      audioUrl: episodeData?.audio_url,
      jumpToTime,
      lastJumpIdProcessed: lastJumpIdProcessedRef?.current
    });
    
    // Проверяем, есть ли активный переход
    const hasActiveJump = jumpToTime !== null && jumpToTime !== undefined;
    
    setIsPlayingState(false);
    // Не сбрасываем currentTime, если есть активный переход
    if (!hasActiveJump) {
      setCurrentTimeState(0);
    }
    setActiveQuestionTitleState('');
    setDurationState(episodeData?.duration || 0);
    setCurrentPlaybackRateIndex(0); 

    if (audioRef.current) {
      // Не сбрасываем currentTime аудио, если есть активный переход
      if (!hasActiveJump) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.playbackRate = playbackRateOptions[0].value;
      if (episodeData?.audio_url) {
        if (audioRef.current.src !== episodeData.audio_url) {
          audioRef.current.src = episodeData.audio_url;
          audioRef.current.load();
        }
      } else {
        audioRef.current.removeAttribute('src');
        audioRef.current.load(); 
      }
    }
    
    // Не сбрасываем lastJumpIdProcessedRef, если есть активный переход
    if (!hasActiveJump && lastJumpIdProcessedRef) {
      lastJumpIdProcessedRef.current = null;
    }
    
    onPlayerStateChange?.({isPlaying: false, currentTime: hasActiveJump ? jumpToTime : 0, duration: episodeData?.duration || 0, activeQuestionTitle: ''});
  }, [
      episodeData?.slug, 
      episodeData?.audio_url, 
      episodeData?.duration, 
      audioRef, 
      setIsPlayingState, 
      setCurrentTimeState, 
      setActiveQuestionTitleState, 
      setDurationState, 
      setCurrentPlaybackRateIndex, 
      playbackRateOptions, 
      onPlayerStateChange,
      lastJumpIdProcessedRef,
      jumpToTime
    ]);
};

export default usePlayerInitialization;