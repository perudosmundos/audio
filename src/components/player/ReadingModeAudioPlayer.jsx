import React, { useEffect } from 'react';

const ReadingModeAudioPlayer = ({ audioRef, src, onTimeUpdate, onLoadedMetadata, onEnded, onIsPlayingChange }) => {
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleTimeUpdate = () => onTimeUpdate(audioElement.currentTime);
    const handleLoadedMetadata = () => onLoadedMetadata(audioElement.duration);
    const handleEnded = () => {
        onEnded();
        if (onIsPlayingChange) onIsPlayingChange(false);
    };
    const handlePlay = () => {
        if (onIsPlayingChange) onIsPlayingChange(true);
    }
    const handlePause = () => {
        if (onIsPlayingChange) onIsPlayingChange(false);
    }


    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);


    return () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
    };
  }, [audioRef, onTimeUpdate, onLoadedMetadata, onEnded, onIsPlayingChange]);

  return <audio ref={audioRef} src={src} style={{ display: 'none' }} />;
};

export default ReadingModeAudioPlayer;