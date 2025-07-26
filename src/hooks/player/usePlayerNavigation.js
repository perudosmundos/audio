
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
    console.log('usePlayerNavigation: handleProgressChange called with', newTime);
    if (audioRef.current && !isNaN(newTime)) {
      const clampedTime = Math.max(0, Math.min(durationState || 0, newTime));
      console.log('usePlayerNavigation: Seeking to time', clampedTime);
      onQuestionSelectJump(clampedTime, null, isPlayingState);
    } else {
      console.log('usePlayerNavigation: Invalid time or no audio ref', { newTime, hasAudioRef: !!audioRef.current });
    }
  }, [audioRef, durationState, onQuestionSelectJump, isPlayingState]);

  const handleSkip = useCallback((seconds) => {
    console.log('usePlayerNavigation: handleSkip called with', seconds);
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      console.log('usePlayerNavigation: Skipping to time', newTime);
      onQuestionSelectJump(newTime, null, isPlayingState);
    } else {
      console.log('usePlayerNavigation: No audio ref for skip');
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
    
    const playAfterNav = audioRef.current ? !audioRef.current.paused : false;

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
    console.log('usePlayerNavigation: togglePlayPause called', { 
      isPlayingState, 
      hasAudioUrl: !!episodeData?.audio_url,
      hasAudioRef: !!audioRef.current,
      audioCurrentTime: audioRef.current?.currentTime,
      audioPaused: audioRef.current?.paused
    });
    
    if (!episodeData?.audio_url && audioRef.current) {
        console.log('usePlayerNavigation: No audio URL available');
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('noAudioSource', currentLanguage), variant: 'destructive' });
        setIsPlayingState(false);
        onPlayerStateChange?.({isPlaying: false});
        return;
    }
    
    if (!audioRef.current) {
        console.log('usePlayerNavigation: No audio ref available');
        return;
    }
    
    // Проверяем реальное состояние аудио элемента
    const audioIsActuallyPlaying = !audioRef.current.paused;
    const newIsPlaying = !audioIsActuallyPlaying;
    
    console.log('usePlayerNavigation: Audio state check', { 
      audioIsActuallyPlaying, 
      newIsPlaying, 
      isPlayingState 
    });
    
    if (newIsPlaying) {
      // Пытаемся запустить воспроизведение
      console.log('usePlayerNavigation: Attempting to play audio');
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('usePlayerNavigation: Playback started successfully');
            setIsPlayingState(true);
            onPlayerStateChange?.({isPlaying: true});
          })
          .catch((error) => {
            console.error('usePlayerNavigation: Playback failed:', error);
            
            if (error.name === 'NotAllowedError') {
              console.log('usePlayerNavigation: NotAllowedError - user interaction required');
              // Не изменяем состояние, так как воспроизведение не запустилось
              toast({ 
                title: getLocaleString('playbackErrorTitle', currentLanguage) || 'Ошибка воспроизведения', 
                description: getLocaleString('playbackErrorDescription', currentLanguage) || 'Нажмите кнопку воспроизведения еще раз', 
                variant: 'destructive' 
              });
            } else if (error.name === 'NotSupportedError') {
              console.log('usePlayerNavigation: NotSupportedError - audio format not supported');
              setIsPlayingState(false);
              onPlayerStateChange?.({isPlaying: false});
              toast({ 
                title: getLocaleString('audioErrorTitle', currentLanguage) || 'Ошибка аудио', 
                description: getLocaleString('audioNotSupported', currentLanguage) || 'Формат аудио не поддерживается браузером', 
                variant: 'destructive' 
              });
            } else {
              // Для других ошибок сбрасываем состояние
              setIsPlayingState(false);
              onPlayerStateChange?.({isPlaying: false});
              toast({ 
                title: getLocaleString('errorGeneric', currentLanguage), 
                description: error.message, 
                variant: 'destructive' 
              });
            }
          });
      }
    } else {
      // Останавливаем воспроизведение
      console.log('usePlayerNavigation: Pausing audio');
      audioRef.current.pause();
      setIsPlayingState(false);
      onPlayerStateChange?.({isPlaying: false});
    }
  }, [episodeData?.audio_url, toast, currentLanguage, audioRef, isPlayingState, setIsPlayingState, onPlayerStateChange]);

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
