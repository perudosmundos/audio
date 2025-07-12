import { useCallback, useEffect, useRef } from 'react';
import { getLocaleString } from '@/lib/locales';

const usePlayerTimeUpdates = ({
  audioRef,
  isSeekingRef,
  internalQuestions,
  currentLanguage,
  setCurrentTimeState,
  setActiveQuestionTitleState,
  setDurationState,
  onPlayerStateChange,
  skipEmptySegments,
  transcript,
}) => {
  const lastActiveQuestionTitleRef = useRef('');
  const nextSegmentStartTimeRef = useRef(null);

  const findNextSegmentStartTime = (currentTimeMs, utterances) => {
    if (!utterances || utterances.length === 0) return null;
    const sortedUtterances = [...utterances].sort((a, b) => a.start - b.start);
    for (const utt of sortedUtterances) {
      if (utt.start > currentTimeMs) {
        return utt.start / 1000; // Convert to seconds
      }
    }
    return null; // No segment after current time
  };

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || isSeekingRef.current) {
      console.log('usePlayerTimeUpdates: Skipping time update', { 
        hasAudioRef: !!audioRef.current, 
        isSeeking: isSeekingRef.current 
      });
      return;
    }

    const currentTime = audioRef.current.currentTime;
    console.log('usePlayerTimeUpdates: Time update', { currentTime, duration: audioRef.current.duration });
    setCurrentTimeState(currentTime);

    if (skipEmptySegments && transcript?.utterances && transcript.utterances.length > 0) {
      const currentTimeMs = currentTime * 1000;
      const currentSegment = transcript.utterances.find(utt => currentTimeMs >= utt.start && currentTimeMs <= utt.end);

      if (!currentSegment) { // We are in a gap
        if (nextSegmentStartTimeRef.current === null || currentTime >= nextSegmentStartTimeRef.current) {
          // Find the start of the very next segment
          const nextStartTime = findNextSegmentStartTime(currentTimeMs, transcript.utterances);
          nextSegmentStartTimeRef.current = nextStartTime;
        }
        
        if (nextSegmentStartTimeRef.current !== null && audioRef.current.duration > nextSegmentStartTimeRef.current) {
          audioRef.current.currentTime = nextSegmentStartTimeRef.current;
          // Reset ref so it recalculates on next gap
          nextSegmentStartTimeRef.current = null; 
          return; // Skip further processing for this update as we just jumped
        }
      } else {
        // We are in a segment, reset the next jump target
        nextSegmentStartTimeRef.current = null;
      }
    }


    let activeQuestion = null;
    if (internalQuestions && internalQuestions.length > 0) {
      const sortedQuestions = [...internalQuestions].sort((a, b) => a.time - b.time);
      for (let i = sortedQuestions.length - 1; i >= 0; i--) {
        if (currentTime >= sortedQuestions[i].time) {
          activeQuestion = sortedQuestions[i];
          break;
        }
      }
    }
    
    const newActiveQuestionTitle = activeQuestion ? activeQuestion.title : getLocaleString('introduction', currentLanguage);
    if (newActiveQuestionTitle !== lastActiveQuestionTitleRef.current) {
      setActiveQuestionTitleState(newActiveQuestionTitle);
      lastActiveQuestionTitleRef.current = newActiveQuestionTitle;
    }

    if (onPlayerStateChange) {
      onPlayerStateChange({ currentTime, activeQuestionTitle: newActiveQuestionTitle });
    }
  }, [
    audioRef, 
    isSeekingRef, 
    internalQuestions, 
    currentLanguage, 
    setCurrentTimeState, 
    setActiveQuestionTitleState, 
    onPlayerStateChange,
    skipEmptySegments,
    transcript
  ]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const newDuration = audioRef.current.duration;
      if (!isNaN(newDuration) && newDuration > 0) {
        setDurationState(newDuration);
        if (onPlayerStateChange) {
          onPlayerStateChange({ duration: newDuration });
        }
      }
    }
  }, [audioRef, setDurationState, onPlayerStateChange]);

  useEffect(() => {
    lastActiveQuestionTitleRef.current = ''; 
  }, [internalQuestions, currentLanguage]);

  return { handleTimeUpdate, handleLoadedMetadata };
};

export default usePlayerTimeUpdates;