import { useState, useEffect } from 'react';

const useTranscriptPlayerSync = (audioRef, transcript) => {
  const [activeSegmentTime, setActiveSegmentTime] = useState(null);
  const [segmentPlaying, setSegmentPlaying] = useState(false);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl && transcript && transcript.utterances) {
      const updateActiveSegment = () => {
        if (!audioEl || audioEl.paused) {
             setActiveSegmentTime(null);
             setSegmentPlaying(false);
             return;
        }
        setSegmentPlaying(true);
        const currentTimeMs = audioEl.currentTime * 1000;
        const currentUtterance = transcript.utterances.find(utt => currentTimeMs >= utt.start && currentTimeMs <= utt.end);
        setActiveSegmentTime(currentUtterance ? currentUtterance.start : null);
      };
      const handlePause = () => { setActiveSegmentTime(null); setSegmentPlaying(false); }
      const handlePlay = () => { 
        if (audioEl) {
          setSegmentPlaying(true); 
          updateActiveSegment(); 
        }
      }

      audioEl.addEventListener('timeupdate', updateActiveSegment);
      audioEl.addEventListener('play', handlePlay);
      audioEl.addEventListener('playing', handlePlay);
      audioEl.addEventListener('pause', handlePause);
      audioEl.addEventListener('ended', handlePause);
      return () => {
        if (audioEl) {
            audioEl.removeEventListener('timeupdate', updateActiveSegment);
            audioEl.removeEventListener('play', handlePlay);
            audioEl.removeEventListener('playing', handlePlay);
            audioEl.removeEventListener('pause', handlePause);
            audioEl.removeEventListener('ended', handlePause);
        }
      }
    }
  }, [audioRef, transcript]);

  return {
    activeSegmentTime,
    setActiveSegmentTime,
    segmentPlaying,
    setSegmentPlaying,
  };
};

export default useTranscriptPlayerSync;