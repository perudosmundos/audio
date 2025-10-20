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
  
  // Защита от быстрых переключений состояния
  const lastStateChangeRef = useRef(0);
  const STATE_CHANGE_THROTTLE = 100; // Минимум 100ms между изменениями состояния
  
  // Безопасное изменение состояния с защитой от быстрых переключений
  const safeSetIsPlayingState = (newState) => {
    const now = Date.now();
    const timeSinceLastChange = now - lastStateChangeRef.current;
    
    if (timeSinceLastChange < STATE_CHANGE_THROTTLE) {
      logger.debug(`usePlayerPlayback: Throttling state change (${timeSinceLastChange}ms < ${STATE_CHANGE_THROTTLE}ms)`);
      return;
    }
    
    lastStateChangeRef.current = now;
    setIsPlayingState(newState);
    logger.debug(`usePlayerPlayback: Safe state change to ${newState}`);
  };

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
      
      const wasPlaying = isPlayingState; // Используем состояние React вместо аудио элемента
      
      // Update the current time state immediately for UI responsiveness
      if (typeof setCurrentTimeState === 'function') {
        setCurrentTimeState(time);
      }
      onPlayerStateChange?.({ currentTime: time });
      
      // Set the audio element's time
      audioRef.current.currentTime = time;

      // Оптимизированная логика: не ждем события seeked, если аудио уже готово
      const isReady = audioRef.current.readyState >= audioRef.current.HAVE_CURRENT_DATA;
      
      if (isReady) {
        // Аудио готово - сразу продолжаем воспроизведение
        if (playAfterJump && wasPlaying) {
          // Дополнительная проверка: убеждаемся что аудио действительно на паузе
          if (audioRef.current.paused) {
            playPromiseRef.current = audioRef.current.play();
            playPromiseRef.current?.then(() => {
              safeSetIsPlayingState(true);
              onPlayerStateChange?.({ isPlaying: true });
            }).catch(e => {
              if (e.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
              if (e.name !== 'AbortError') console.error("Error playing after jump:", e);
              safeSetIsPlayingState(false);
              onPlayerStateChange?.({ isPlaying: false });
            }).finally(() => {
              isSeekingRef.current = false;
            });
          } else {
            // Аудио уже воспроизводится - просто обновляем состояние
            safeSetIsPlayingState(true);
            onPlayerStateChange?.({ isPlaying: true });
            isSeekingRef.current = false;
          }
        } else {
          // Если не нужно воспроизводить, убеждаемся что аудио на паузе
          if (!audioRef.current.paused) {
            audioRef.current.pause();
          }
          setIsPlayingState(false);
          onPlayerStateChange?.({ isPlaying: false });
          isSeekingRef.current = false;
        }
      } else {
        // Аудио не готово - используем старую логику с событием seeked
        const onSeeked = () => {
          audioRef.current?.removeEventListener('seeked', onSeeked);
          
          if (playAfterJump && wasPlaying) {
            // Дополнительная проверка перед воспроизведением
            if (audioRef.current.paused) {
              playPromiseRef.current = audioRef.current.play();
              playPromiseRef.current?.then(() => {
                safeSetIsPlayingState(true);
                onPlayerStateChange?.({ isPlaying: true });
              }).catch(e => {
                if (e.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
                if (e.name !== 'AbortError') console.error("Error playing after jump:", e);
                safeSetIsPlayingState(false);
                onPlayerStateChange?.({ isPlaying: false });
              }).finally(() => {
                isSeekingRef.current = false;
              });
            } else {
              // Аудио уже воспроизводится
              safeSetIsPlayingState(true);
              onPlayerStateChange?.({ isPlaying: true });
              isSeekingRef.current = false;
            }
          } else {
            // Убеждаемся что аудио на паузе
            if (!audioRef.current.paused) {
              audioRef.current.pause();
            }
            safeSetIsPlayingState(false);
            onPlayerStateChange?.({ isPlaying: false });
            isSeekingRef.current = false;
          }
        };
        
        audioRef.current.addEventListener('seeked', onSeeked, { once: true });
        
        // Уменьшенный timeout для более быстрого отклика
        setTimeout(() => {
          if (isSeekingRef.current) {
            logger.debug('usePlayerPlayback: Fallback timeout - clearing seeking flag');
            isSeekingRef.current = false;
          }
        }, 500); // Уменьшено с 2000ms до 500ms
      }
    };

    performSeek().catch(error => {
      logger.error("Error in performSeek:", error);
      isSeekingRef.current = false;
    });

  }, [jumpToTime, playAfterJump, jumpId]);


  useEffect(() => {
    if (audioRef.current && !isSeekingRef.current) {
      // Убираем дублирующий автозапуск - он будет в отдельном useEffect
      if (isPlayingState && episodeData?.audio_url) {
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
              safeSetIsPlayingState(false);
              onPlayerStateChange?.({isPlaying: false});
            });
        }
      } else if (!isPlayingState) {
        // Если состояние воспроизведения false, убеждаемся что аудио на паузе
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
        safeSetIsPlayingState(true);
        onPlayerStateChange?.({ isPlaying: true });
      }
    };

    const handlePause = () => {
      logger.debug('usePlayerPlayback: Audio pause event, syncing state');
      if (isPlayingState) {
        safeSetIsPlayingState(false);
        onPlayerStateChange?.({ isPlaying: false });
      }
    };

    const handleEnded = () => {
      logger.debug('usePlayerPlayback: Audio ended event, syncing state');
      if (isPlayingState) {
        safeSetIsPlayingState(false);
        onPlayerStateChange?.({ isPlaying: false });
      }
    };

    // Дополнительная синхронизация при загрузке (только если есть рассинхронизация)
    const handleLoadedData = () => {
      logger.debug('usePlayerPlayback: Audio loaded, checking state sync');
      
      // Небольшая задержка чтобы дать время автозапуску сработать
      setTimeout(() => {
        if (audioElement.paused && isPlayingState) {
          logger.debug('usePlayerPlayback: Fixing state sync - audio paused but state says playing');
          safeSetIsPlayingState(false);
          onPlayerStateChange?.({ isPlaying: false });
        } else if (!audioElement.paused && !isPlayingState) {
          logger.debug('usePlayerPlayback: Fixing state sync - audio playing but state says paused');
          safeSetIsPlayingState(true);
          onPlayerStateChange?.({ isPlaying: true });
        }
      }, 50); // 50ms задержка
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('loadeddata', handleLoadedData);

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('loadeddata', handleLoadedData);
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
                  safeSetIsPlayingState(true);
                  onPlayerStateChange?.({ isPlaying: true });
                }).catch(error => {
                  if (error.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
                  if (error.name !== 'AbortError') {
                    console.error("Delayed jump play error:", error);
                  }
                });
              }
            }
          } else {
            // Автозапуск для нового эпизода - всегда пытаемся запустить
            logger.debug('usePlayerPlayback: Auto-starting playback for new episode');
            playPromiseRef.current = audioRef.current.play();
            playPromiseRef.current?.then(() => {
              logger.debug('usePlayerPlayback: Auto-playback started successfully');
              safeSetIsPlayingState(true);
              onPlayerStateChange?.({ isPlaying: true });
            }).catch(error => {
              if (error.name === 'NotAllowedError' && typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
              if (error.name !== 'AbortError') {
                console.log("Auto-play blocked by browser (this is normal):", error.message);
              }
              // Не устанавливаем состояние в false при блокировке автозапуска
            });
          }
        };
        
        audioRef.current.addEventListener('canplay', handleCanPlay);
      }
    }
  }, [episodeData?.audio_url, isPlayingState, jumpToTime, playAfterJump]);

  // Дополнительный автозапуск при загрузке нового эпизода
  useEffect(() => {
    if (audioRef.current && episodeData?.audio_url && !isSeekingRef.current) {
      // Проверяем, что это действительно новый эпизод
      const isNewEpisode = audioRef.current.src !== episodeData.audio_url;
      
      if (isNewEpisode) {
        logger.debug('usePlayerPlayback: New episode detected, setting up auto-play');
        
        // Устанавливаем src и загружаем
        audioRef.current.src = episodeData.audio_url;
        audioRef.current.load();
        
        // Ждем готовности и запускаем только один раз
        const handleAutoPlay = () => {
          audioRef.current?.removeEventListener('canplay', handleAutoPlay);
          
          // Дополнительная проверка чтобы избежать конфликтов
          if (audioRef.current && !audioRef.current.paused) {
            logger.debug('usePlayerPlayback: Audio already playing, skipping auto-play');
            return;
          }
          
          logger.debug('usePlayerPlayback: Auto-playing new episode');
          
          const playPromise = audioRef.current.play();
          playPromise?.then(() => {
            logger.debug('usePlayerPlayback: New episode auto-play successful');
            safeSetIsPlayingState(true);
            onPlayerStateChange?.({ isPlaying: true });
          }).catch(error => {
            if (error.name === 'NotAllowedError') {
              logger.debug('usePlayerPlayback: New episode auto-play blocked by browser');
              if (typeof setShowPlayOverlay === 'function') setShowPlayOverlay(true);
            } else if (error.name !== 'AbortError') {
              console.error("New episode auto-play error:", error);
            }
          });
        };
        
        audioRef.current.addEventListener('canplay', handleAutoPlay);
      }
    }
  }, [episodeData?.slug]); // Срабатывает только при смене эпизода

};

export default usePlayerPlayback;