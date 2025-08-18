import { useState, useCallback } from 'react';

const useReadingMode = (mainPlayerIsPlaying, toastInstance, currentLanguage, mainAudioRef, setMainPlayerIsPlaying) => {
  const [readingMode, setReadingMode] = useState(false);

  const toggleReadingMode = useCallback(() => {
    setReadingMode(prev => {
      const newMode = !prev;
      if (newMode && mainAudioRef.current && mainPlayerIsPlaying) {
        mainAudioRef.current.pause();
        if(setMainPlayerIsPlaying) setMainPlayerIsPlaying(false);
      } else if (!newMode && mainAudioRef.current && mainAudioRef.current.paused && mainPlayerIsPlaying) {
        mainAudioRef.current.play().catch(e => console.error("Error resuming main player on RM exit:", e));
      }
      return newMode;
    });
  }, [mainAudioRef, mainPlayerIsPlaying, setMainPlayerIsPlaying]);

  const handleReadingModeSegmentClick = useCallback((time, segment, audioRefForReadingMode, setIsPlayingForReadingMode) => {
    if (audioRefForReadingMode && audioRefForReadingMode.current && !isNaN(time)) {
        audioRefForReadingMode.current.currentTime = time;
        if (setIsPlayingForReadingMode) {
            if (audioRefForReadingMode.current.paused) {
                 audioRefForReadingMode.current.play().catch(e => console.error("RM segment click play error", e));
                 setIsPlayingForReadingMode(true);
            }
        }
    }
  }, []);
  
  return {
    readingMode,
    toggleReadingMode,
    handleReadingModeSegmentClick,
  };
};

export default useReadingMode;