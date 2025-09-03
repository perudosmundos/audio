import React from 'react';

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
  
      // Устанавливаем src только если он изменился
      if (audioRef.current.src !== episodeAudioUrl) {
        audioRef.current.src = episodeAudioUrl;
        audioRef.current.load();
      }
    }
  }, [episodeAudioUrl, audioRef]);

  const handleError = (e) => {
    console.error('AudioElement error occurred');
    console.error('Audio error code:', e.target.error?.code);
    console.error('Audio error message:', e.target.error?.message);
    console.error('Audio src:', e.target.src);
    console.error('Audio networkState:', e.target.networkState);
    console.error('Audio readyState:', e.target.readyState);
    
    // Проверяем, не является ли это ошибкой кеша
    if (e.target.error?.code === e.target.error?.MEDIA_ERR_SRC_NOT_SUPPORTED || 
        e.target.error?.code === e.target.error?.MEDIA_ERR_NETWORK) {
      console.warn('Audio loading failed, might be cache or network issue');
      
      // Пытаемся обновить кеш для этого аудио
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'REFRESH_AUDIO_CACHE',
          url: e.target.src
        });
      }
      
      // Если мы в офлайн режиме, попробуем перезагрузить через некоторое время
      if (!navigator.onLine) {
        setTimeout(() => {
          console.log('Retrying audio load in offline mode...');
          if (e.target && e.target.src) {
            e.target.load();
          }
        }, 2000);
      }
    }
    
    if (onError) {
      onError(e);
    }
  };

  const handleCanPlay = () => {
    
  };

  const handleLoadStart = () => {
    
  };

  const handleLoadedData = () => {
    
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
      preload="auto"
    />
  );
});

export default AudioElement;