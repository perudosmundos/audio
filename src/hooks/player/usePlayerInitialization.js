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
      lastJumpIdProcessed: lastJumpIdProcessedRef?.current,
      audioCurrentTime: audioRef.current?.currentTime,
      audioReadyState: audioRef.current?.readyState,
      audioSrc: audioRef.current?.src
    });
    
    // Проверяем, есть ли активный переход
    const hasActiveJump = jumpToTime !== null && jumpToTime !== undefined;
    
    // Проверяем, не является ли это просто паузой (если audioRef уже имеет src и currentTime)
    const isJustPause = audioRef.current && 
                       audioRef.current.src && 
                       audioRef.current.currentTime > 0 && 
                       episodeData?.audio_url === audioRef.current.src &&
                       audioRef.current.readyState > 0; // Аудио уже загружено
    
    // Не сбрасываем состояние воспроизведения, если это просто пауза
    if (!isJustPause) {
    setIsPlayingState(false);
    }
    
    // Не сбрасываем currentTime, если есть активный переход или это просто пауза
    if (!hasActiveJump && !isJustPause) {
      console.log('usePlayerInitialization: Resetting currentTime to 0');
      setCurrentTimeState(0);
    } else {
      console.log('usePlayerInitialization: Keeping currentTime', { hasActiveJump, isJustPause });
    }
    
    setActiveQuestionTitleState('');
    setDurationState(episodeData?.duration || 0);
    setCurrentPlaybackRateIndex(0); 

    if (audioRef.current) {
      // Не сбрасываем currentTime аудио, если есть активный переход или это просто пауза
      if (!hasActiveJump && !isJustPause) {
        console.log('usePlayerInitialization: Resetting audio currentTime to 0');
        audioRef.current.currentTime = 0;
      } else {
        console.log('usePlayerInitialization: Keeping audio currentTime', { hasActiveJump, isJustPause });
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
    
    const currentTime = hasActiveJump ? jumpToTime : (isJustPause ? audioRef.current?.currentTime || 0 : 0);
    onPlayerStateChange?.({isPlaying: false, currentTime, duration: episodeData?.duration || 0, activeQuestionTitle: ''});
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