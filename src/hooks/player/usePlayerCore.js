import { useState, useEffect } from 'react';

const usePlayerCore = (initialDuration = 0) => {
  // State management
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [currentTimeState, setCurrentTimeState] = useState(0);
  const [durationState, setDurationState] = useState(initialDuration);
  const [currentPlaybackRateIndex, setCurrentPlaybackRateIndex] = useState(0);
  const [activeQuestionTitleState, setActiveQuestionTitleState] = useState('');
  const [isAddQuestionPlayerDialogOpen, setIsAddQuestionPlayerDialogOpen] = useState(false);
  const [addQuestionDialogInitialTime, setAddQuestionDialogInitialTime] = useState(0);

  // Initialization effect
  const initializePlayer = ({
    episodeData,
    audioRef,
    playbackRateOptions,
    onPlayerStateChange,
    lastJumpIdProcessedRef,
  }) => {
    useEffect(() => {
      setIsPlayingState(false);
      setCurrentTimeState(0);
      setActiveQuestionTitleState('');
      setDurationState(episodeData?.duration || 0);
      setCurrentPlaybackRateIndex(0); 

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
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
      if (lastJumpIdProcessedRef) lastJumpIdProcessedRef.current = null;
      onPlayerStateChange?.({isPlaying: false, currentTime: 0, duration: episodeData?.duration || 0, activeQuestionTitle: ''});
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
        lastJumpIdProcessedRef
      ]);
  };

  return {
    // State
    isPlayingState, setIsPlayingState,
    currentTimeState, setCurrentTimeState,
    durationState, setDurationState,
    currentPlaybackRateIndex, setCurrentPlaybackRateIndex,
    activeQuestionTitleState, setActiveQuestionTitleState,
    isAddQuestionPlayerDialogOpen, setIsAddQuestionPlayerDialogOpen,
    addQuestionDialogInitialTime, setAddQuestionDialogInitialTime,
    
    // Initialization
    initializePlayer,
  };
};

export default usePlayerCore; 