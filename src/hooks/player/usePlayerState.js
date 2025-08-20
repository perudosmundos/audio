
import { useState, useCallback } from 'react';

const usePlayerState = (initialDuration = 0) => {
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [currentTimeState, setCurrentTimeState] = useState(0);
  const [durationState, setDurationState] = useState(initialDuration);
  const [currentPlaybackRateIndex, setCurrentPlaybackRateIndex] = useState(0);
  const [activeQuestionTitleState, setActiveQuestionTitleState] = useState('');
  const [isAddQuestionPlayerDialogOpen, setIsAddQuestionPlayerDialogOpen] = useState(false);
  const [addQuestionDialogInitialTime, setAddQuestionDialogInitialTime] = useState(0);

  const setIsPlayingStateWithLog = useCallback((value) => {

    setIsPlayingState(value);
  }, []);

  return {
    isPlayingState, setIsPlayingState: setIsPlayingStateWithLog,
    currentTimeState, setCurrentTimeState,
    durationState, setDurationState,
    currentPlaybackRateIndex, setCurrentPlaybackRateIndex,
    activeQuestionTitleState, setActiveQuestionTitleState,
    isAddQuestionPlayerDialogOpen, setIsAddQuestionPlayerDialogOpen,
    addQuestionDialogInitialTime, setAddQuestionDialogInitialTime,
  };
};

export default usePlayerState;
