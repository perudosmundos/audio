import { useEffect, useRef } from 'react';
import { getLocaleString } from '@/lib/locales';
import logger from '@/lib/logger';

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
    if (jumpToTime === null || jumpToTime === undefined || !audioRef.current) {
      return;
    }
    
    const time = parseFloat(jumpToTime);
    const id = jumpId;

    if (isNaN(time)) {
      return;
    }

    if (lastJumpIdProcessedRef && lastJumpIdProcessedRef.current === id) {
      return;
    }
    
    if (lastJumpIdProcessedRef) {
      lastJumpIdProcessedRef.current = id;
    }
    


    const performSeek = async () => {
      if (!audioRef.current || isSeekingRef.current) {
        return;
      }
      
      isSeekingRef.current = true;

      
      // Cancel any pending play promise
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {});
      }
      
      if (!audioRef.current.paused) {
        audioRef.current.pause();
      }
      
      // Update the current time state immediately for UI responsiveness
      if (typeof setCurrentTimeState === 'function') {
        setCurrentTimeState(time);
      }
      onPlayerStateChange?.({ currentTime: time });
      
      // Set the audio element's time
      audioRef.current.currentTime = time;

      const onSeeked = () => {
        audioRef.current?.removeEventListener('seeked', onSeeked);
        
        if (playAfterJump) {

          playPromiseRef.current = audioRef.current.play();
          playPromiseRef.current?.then(() => {

            setIsPlayingState(true);
            onPlayerStateChange?.({ isPlaying: true });
          }).catch(e => {
            if (e.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
            if (e.name !== 'AbortError') console.error("Error playing after jump:", e);
            setIsPlayingState(false);
            onPlayerStateChange?.({ isPlaying: false });
          }).finally(() => {
            isSeekingRef.current = false;
          });
        } else {
          // If not playing after jump, we are paused.
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
          logger.debug('usePlayerPlayback: Fallback timeout - clearing seeking flag');
          isSeekingRef.current = false;
        }
      }, 2000);
    };

    performSeek().catch(error => {
      logger.error("Error in performSeek:", error);
      isSeekingRef.current = false;
    });

  }, [jumpToTime, playAfterJump, jumpId]);


  useEffect(() => {
    if (audioRef.current && !isSeekingRef.current) {
      // Если URL есть и это первый запуск без явного перехода, попробуем автостарт
      if (episodeData?.audio_url && !isPlayingState && (jumpToTime === null || typeof jumpToTime === 'undefined')) {
        if (audioRef.current.src !== episodeData.audio_url) {
          audioRef.current.src = episodeData.audio_url;
          audioRef.current.load();
        }
        // Пытаемся начать воспроизведение (браузер может заблокировать, это ок)
        const p = audioRef.current.play();
        p?.then(() => {
          setIsPlayingState(true);
          onPlayerStateChange?.({ isPlaying: true });
        }).catch(() => {
          // Тихо игнорируем — пользователь начнёт вручную
        });
      } else if (isPlayingState && episodeData?.audio_url) {
  
        if (audioRef.current.src !== episodeData.audio_url) {
           
           audioRef.current.src = episodeData.audio_url;
           audioRef.current.load();
        }
        if (audioRef.current.paused) {
  
            if (playPromiseRef.current) {
                playPromiseRef.current.catch(() => {});
            }
            playPromiseRef.current = audioRef.current.play();
            playPromiseRef.current?.then(() => {
              // no-op
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
        }
      } else {
        if (!audioRef.current.paused) {
            audioRef.current.pause();
        }
      }
    }
  }, [isPlayingState, episodeData?.audio_url, jumpToTime]);

  // Синхронизация состояния с реальным состоянием аудио элемента
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handlePlay = () => {
      logger.debug('usePlayerPlayback: Audio play event, syncing state');
      if (!isPlayingState) {
        setIsPlayingState(true);
        onPlayerStateChange?.({ isPlaying: true });
      }
    };

    const handlePause = () => {
      logger.debug('usePlayerPlayback: Audio pause event, syncing state');
      if (isPlayingState) {
        setIsPlayingState(false);
        onPlayerStateChange?.({ isPlaying: false });
      }
    };

    const handleEnded = () => {
      logger.debug('usePlayerPlayback: Audio ended event, syncing state');
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
      // Если это новый эпизод (src изменился), запускаем воспроизведение
      if (audioRef.current.src !== episodeData.audio_url) {
        audioRef.current.src = episodeData.audio_url;
        audioRef.current.load();
        
        // Ждем загрузки метаданных перед воспроизведением
        const handleCanPlay = () => {
          audioRef.current?.removeEventListener('canplay', handleCanPlay);
          logger.debug('usePlayerPlayback: canplay event fired, checking for jump', { jumpToTime, playAfterJump });
          
          // Если есть активный переход, выполняем его после загрузки
          if (jumpToTime !== null && jumpToTime !== undefined && !lastJumpIdProcessedRef?.current) {
            logger.debug('usePlayerPlayback: Performing delayed jump after canplay', { jumpToTime, playAfterJump });
            const time = parseFloat(jumpToTime);
            if (!isNaN(time)) {
              audioRef.current.currentTime = time;
              if (playAfterJump && audioRef.current.paused) {
                playPromiseRef.current = audioRef.current.play();
                playPromiseRef.current?.then(() => {
                  logger.debug('usePlayerPlayback: Delayed jump playback started');
                  setIsPlayingState(true);
                  onPlayerStateChange?.({ isPlaying: true });
                }).catch(error => {
                  if (error.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
                  if (error.name !== 'AbortError') {
                    console.error("Delayed jump play error:", error);
                  }
                });
              }
            }
          } else if (isPlayingState && audioRef.current?.paused) {
            playPromiseRef.current = audioRef.current.play();
            playPromiseRef.current?.catch(error => {
              if (error.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
              if (error.name !== 'AbortError') {
                console.error("Auto-play error:", error);
              }
            });
          }
        };
        
        audioRef.current.addEventListener('canplay', handleCanPlay);
      }
    }
  }, [episodeData?.audio_url, isPlayingState, jumpToTime, playAfterJump]);

};

export default usePlayerPlayback;