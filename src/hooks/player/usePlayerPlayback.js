import { useEffect, useRef } from 'react';
import { getLocaleString } from '@/lib/locales';

const usePlayerPlayback = ({
  episodeData,
  audioRef,
  isPlayingState,
  setIsPlayingState,
  isSeekingRef,
  toast,
  currentLanguage,
  onPlayerStateChange,
  lastJumpIdProcessedRef,
  jumpToTime,
  jumpId,
  playAfterJump,
  setCurrentTimeState,
  setShowPlayOverlay // новый пропс
}) => {
  const playPromiseRef = useRef(null);

  useEffect(() => {
    console.log('usePlayerPlayback: jumpToTime effect triggered', { 
      jumpToTime, 
      jumpId, 
      playAfterJump, 
      hasAudioRef: !!audioRef.current,
      lastJumpIdProcessed: lastJumpIdProcessedRef?.current
    });
    
    if (jumpToTime === null || jumpToTime === undefined || !audioRef.current) {
      console.log('usePlayerPlayback: Skipping jump - invalid conditions');
      return;
    }
    
    const time = parseFloat(jumpToTime);
    const id = jumpId;

    if (isNaN(time)) {
      console.log('usePlayerPlayback: Skipping jump - invalid time');
      return;
    }

    if (lastJumpIdProcessedRef && lastJumpIdProcessedRef.current === id) {
      console.log('usePlayerPlayback: Skipping jump - already processed');
      return;
    }
    
    if (lastJumpIdProcessedRef) {
      lastJumpIdProcessedRef.current = id;
    }
    
    console.log('usePlayerPlayback: Performing seek to time', { time, id, playAfterJump });

    const performSeek = async () => {
      console.log('usePlayerPlayback: performSeek started', { time, playAfterJump });
      
      if (!audioRef.current || isSeekingRef.current) {
        console.log('usePlayerPlayback: performSeek skipped - no audio ref or already seeking');
        return;
      }
      
      isSeekingRef.current = true;
      console.log('usePlayerPlayback: Setting seeking flag');
      
      // Cancel any pending play promise
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {});
      }
      
      if (!audioRef.current.paused) {
        console.log('usePlayerPlayback: Pausing audio before seek');
        audioRef.current.pause();
      }
      
      // Update the current time state immediately for UI responsiveness
      if (typeof setCurrentTimeState === 'function') {
        setCurrentTimeState(time);
      }
      onPlayerStateChange?.({ currentTime: time });
      
      // Set the audio element's time
      console.log('usePlayerPlayback: Setting audio currentTime to', time);
      audioRef.current.currentTime = time;

      const onSeeked = () => {
        console.log('usePlayerPlayback: seeked event fired');
        audioRef.current?.removeEventListener('seeked', onSeeked);
        
        if (playAfterJump) {
          console.log('usePlayerPlayback: Starting playback after seek');
          playPromiseRef.current = audioRef.current.play();
          playPromiseRef.current?.then(() => {
            console.log('usePlayerPlayback: Playback started after seek');
            setIsPlayingState(true);
            onPlayerStateChange?.({ isPlaying: true });
          }).catch(e => {
            if (e.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
            if (e.name !== 'AbortError') console.error("Error playing after jump:", e);
            setIsPlayingState(false);
            onPlayerStateChange?.({ isPlaying: false });
          }).finally(() => {
            console.log('usePlayerPlayback: Clearing seeking flag after play');
            isSeekingRef.current = false;
          });
        } else {
          // If not playing after jump, we are paused.
          console.log('usePlayerPlayback: Keeping paused after seek');
          setIsPlayingState(false);
          onPlayerStateChange?.({ isPlaying: false });
          isSeekingRef.current = false;
        }
      };
      
      audioRef.current.addEventListener('seeked', onSeeked, { once: true });
      
      // If the media is not ready, load it. The 'seeked' event will fire after it's ready enough.
      if (audioRef.current.readyState < audioRef.current.HAVE_METADATA) {
          audioRef.current.load();
      }
      
      // Fallback timeout to clear seeking flag if seeked event doesn't fire
      setTimeout(() => {
        if (isSeekingRef.current) {
          console.log('usePlayerPlayback: Fallback timeout - clearing seeking flag');
          isSeekingRef.current = false;
        }
      }, 2000);
    };

    performSeek().catch(error => {
      console.error("Error in performSeek:", error);
      isSeekingRef.current = false;
    });

  }, [jumpToTime, playAfterJump, jumpId]);


  useEffect(() => {
    console.log('usePlayerPlayback: useEffect triggered', { 
      isPlayingState, 
      hasAudioUrl: !!episodeData?.audio_url,
      audioUrl: episodeData?.audio_url,
      isSeeking: isSeekingRef.current,
      audioPaused: audioRef.current?.paused
    });
    
    if (audioRef.current && !isSeekingRef.current) {
      if (isPlayingState && episodeData?.audio_url) {
        console.log('usePlayerPlayback: Attempting to play audio');
        if (audioRef.current.src !== episodeData.audio_url) {
           console.log('usePlayerPlayback: Setting new src');
           audioRef.current.src = episodeData.audio_url;
           audioRef.current.load();
        }
        if (audioRef.current.paused) {
            console.log('usePlayerPlayback: Audio is paused, starting playback');
            if (playPromiseRef.current) {
                playPromiseRef.current.catch(() => {});
            }
            playPromiseRef.current = audioRef.current.play();
            playPromiseRef.current?.then(() => {
              console.log('usePlayerPlayback: Playback started successfully');
            }).catch(error => {
              if (error.name !== 'AbortError') {
                  console.error("Playback error:", error);
                  toast({
                  title: getLocaleString('playbackErrorTitle', currentLanguage),
                  description: getLocaleString('playbackErrorDescription', currentLanguage),
                  variant: "destructive",
                  });
              }
              setIsPlayingState(false);
              onPlayerStateChange?.({isPlaying: false});
            });
        } else {
          console.log('usePlayerPlayback: Audio is already playing');
        }
      } else {
        if (!audioRef.current.paused) {
            console.log('usePlayerPlayback: Pausing audio, currentTime before pause:', audioRef.current.currentTime);
            audioRef.current.pause();
            console.log('usePlayerPlayback: Audio paused, currentTime after pause:', audioRef.current.currentTime);
        }
      }
    } else {
      console.log('usePlayerPlayback: Skipping playback logic', {
        hasAudioRef: !!audioRef.current,
        isSeeking: isSeekingRef.current,
        isPlayingState,
        hasAudioUrl: !!episodeData?.audio_url
      });
    }
  }, [isPlayingState, episodeData?.audio_url]);

  // Синхронизация состояния с реальным состоянием аудио элемента
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handlePlay = () => {
      console.log('usePlayerPlayback: Audio play event, syncing state');
      if (!isPlayingState) {
        setIsPlayingState(true);
        onPlayerStateChange?.({ isPlaying: true });
      }
    };

    const handlePause = () => {
      console.log('usePlayerPlayback: Audio pause event, syncing state');
      if (isPlayingState) {
        setIsPlayingState(false);
        onPlayerStateChange?.({ isPlaying: false });
      }
    };

    const handleEnded = () => {
      console.log('usePlayerPlayback: Audio ended event, syncing state');
      if (isPlayingState) {
        setIsPlayingState(false);
        onPlayerStateChange?.({ isPlaying: false });
      }
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, isPlayingState, setIsPlayingState, onPlayerStateChange]);

  // Автоматический старт воспроизведения при загрузке нового эпизода
  useEffect(() => {
    if (audioRef.current && episodeData?.audio_url && !isSeekingRef.current) {
      // Если это новый эпизод (src изменился), загружаем аудио но не запускаем автоматически
      if (audioRef.current.src !== episodeData.audio_url) {
        audioRef.current.src = episodeData.audio_url;
        audioRef.current.load();
        
        // Ждем загрузки метаданных
        const handleCanPlay = () => {
          audioRef.current?.removeEventListener('canplay', handleCanPlay);
          console.log('usePlayerPlayback: canplay event fired, checking for jump', { jumpToTime, playAfterJump });
          
          // Если есть активный переход, выполняем его после загрузки
          if (jumpToTime !== null && jumpToTime !== undefined && !lastJumpIdProcessedRef?.current) {
            console.log('usePlayerPlayback: Performing delayed jump after canplay', { jumpToTime, playAfterJump });
            const time = parseFloat(jumpToTime);
            if (!isNaN(time)) {
              audioRef.current.currentTime = time;
              // Не запускаем автоматическое воспроизведение после jump
              // Пользователь должен сам нажать кнопку play
              console.log('usePlayerPlayback: Jump completed, waiting for user interaction');
            }
          }
          // Убираем автоматическое воспроизведение
          console.log('usePlayerPlayback: Audio ready, waiting for user interaction');
        };
        
        audioRef.current.addEventListener('canplay', handleCanPlay);
      }
    }
  }, [episodeData?.audio_url, jumpToTime, playAfterJump]);

};

export default usePlayerPlayback;