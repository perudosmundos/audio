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
      console.log('AudioElement: Setting src to', episodeAudioUrl);
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
    if (onError) {
      onError(e);
    }
  };

  const handleCanPlay = () => {
    console.log('AudioElement: canplay event fired');
  };

  const handleLoadStart = () => {
    console.log('AudioElement: loadstart event fired');
  };

  const handleLoadedData = () => {
    console.log('AudioElement: loadeddata event fired');
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
      preload="metadata"
      crossOrigin="anonymous"
    />
  );
});

export default AudioElement;