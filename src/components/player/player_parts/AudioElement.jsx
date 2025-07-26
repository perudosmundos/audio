import React from 'react';
import { diagnoseAudioUrl } from '@/lib/utils';

const AudioElement = React.memo(({ 
  audioRef, 
  episodeAudioUrl, 
  onTimeUpdate, 
  onLoadedMetadata, 
  onEnded, 
  onDurationChange, 
  onError,
  playbackRate
}) => {
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioRef]);

  React.useEffect(() => {
    if (audioRef.current && episodeAudioUrl) {
      console.log('AudioElement: Setting src to', episodeAudioUrl);
      
      // Диагностика URL перед установкой
      const runDiagnostics = async () => {
        try {
          const diagnosis = await diagnoseAudioUrl(episodeAudioUrl);
          console.log('AudioElement: URL diagnosis:', diagnosis);
          
          if (diagnosis.error) {
            console.warn('AudioElement: URL diagnosis failed:', diagnosis.error);
          }
        } catch (error) {
          console.warn('AudioElement: Failed to run diagnostics:', error);
        }
      };
      
      runDiagnostics();
      
      // Устанавливаем src только если он изменился
      if (audioRef.current.src !== episodeAudioUrl) {
        // Сбрасываем ошибки перед установкой нового src
        audioRef.current.removeAttribute('data-error');
        
        audioRef.current.src = episodeAudioUrl;
        audioRef.current.load();
        
        console.log('AudioElement: Audio src set and load() called');
      }
    }
  }, [episodeAudioUrl, audioRef]);

  const handleError = (e) => {
    const audio = e.target;
    const error = audio.error;
    
    console.error('AudioElement error occurred');
    console.error('Audio error code:', error?.code);
    console.error('Audio error message:', error?.message);
    console.error('Audio src:', audio.src);
    console.error('Audio networkState:', audio.networkState);
    console.error('Audio readyState:', audio.readyState);
    
    // Устанавливаем флаг ошибки
    audio.setAttribute('data-error', 'true');
    
    // Дополнительная диагностика
    const errorDetails = {
      code: error?.code,
      message: error?.message,
      src: audio.src,
      networkState: audio.networkState,
      readyState: audio.readyState,
      currentTime: audio.currentTime,
      duration: audio.duration
    };
    
    console.error('AudioElement: Detailed error info:', errorDetails);
    
    if (onError) {
      onError(e);
    }
  };

  const handleCanPlay = () => {
    console.log('AudioElement: canplay event fired');
    const audio = audioRef.current;
    if (audio) {
      console.log('AudioElement: Audio ready for playback', {
        duration: audio.duration,
        currentTime: audio.currentTime,
        networkState: audio.networkState,
        readyState: audio.readyState
      });
    }
  };

  const handleLoadStart = () => {
    console.log('AudioElement: loadstart event fired');
  };

  const handleLoadedData = () => {
    console.log('AudioElement: loadeddata event fired');
  };

  const handleProgress = () => {
    const audio = audioRef.current;
    if (audio && audio.buffered.length > 0) {
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      console.log('AudioElement: Buffering progress', {
        bufferedEnd,
        currentTime: audio.currentTime,
        duration: audio.duration
      });
    }
  };

  const handleStalled = () => {
    console.warn('AudioElement: Audio stalled - network issue detected');
  };

  const handleSuspend = () => {
    console.log('AudioElement: Audio suspended - loading paused');
  };

  const handleWaiting = () => {
    console.log('AudioElement: Audio waiting - buffering');
  };

  return (
    <audio 
      ref={audioRef}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={onLoadedMetadata}
      onEnded={onEnded}
      onDurationChange={onDurationChange} 
      onError={handleError}
      onCanPlay={handleCanPlay}
      onLoadStart={handleLoadStart}
      onLoadedData={handleLoadedData}
      onProgress={handleProgress}
      onStalled={handleStalled}
      onSuspend={handleSuspend}
      onWaiting={handleWaiting}
      preload="metadata"
      crossOrigin="anonymous"
      // Добавляем атрибуты для лучшей поддержки Range запросов
      controlsList="nodownload"
    />
  );
});

export default AudioElement;