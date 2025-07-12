import React, { useState, useEffect, useRef, useCallback } from 'react';
import FloatingPlayerControlsReadingMode from '@/components/player/FloatingPlayerControlsReadingMode';
import PlayerHeader from '@/components/player/player_parts/PlayerHeader';
import QuestionsManager from '@/components/player/QuestionsManager';
import SpeakerAssignmentDialog from '@/components/transcript/SpeakerAssignmentDialog';
import ReadingModeAudioPlayer from '@/components/player/ReadingModeAudioPlayer';
import { getLocaleString } from '@/lib/locales';
import { Loader2 } from 'lucide-react';

const ReadingModeDisplay = ({
  episodeData,
  currentLanguage,
  audioRef: mainAudioPlayerRef, 
  isPlaying: mainPlayerIsPlaying,
  currentTime: mainPlayerCurrentTime,
  onClose,
  onOpenSpeakerAssignmentDialog,
  onQuestionsChange, 
  episodeSlug,
  episodeDate,
  episodeAudioUrl,
  user,
  segmentForSpeakerAssignment,
  isSpeakerAssignmentDialogOpen,
  onCloseSpeakerAssignmentDialog,
  onSaveSpeakerAssignment,
  internalTranscriptUtterances
}) => {
  const readingModeAudioRef = useRef(null);
  const [rmIsPlaying, setRmIsPlaying] = useState(false);
  const [rmCurrentTime, setRmCurrentTime] = useState(0);
  const [rmDuration, setRmDuration] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(true);

  useEffect(() => {
    if (mainAudioPlayerRef?.current && mainPlayerIsPlaying) {
      mainAudioPlayerRef.current.pause();
    }
  }, [mainAudioPlayerRef, mainPlayerIsPlaying]);


  useEffect(() => {
    const audioEl = readingModeAudioRef.current;
    if (audioEl && episodeAudioUrl) {
      if (audioEl.src !== episodeAudioUrl) {
        audioEl.src = episodeAudioUrl;
        audioEl.load();
      }
      
      const onCanPlay = () => {
        if (!audioEl) return; 
        setIsLoadingAudio(false);
        audioEl.currentTime = mainPlayerCurrentTime;
        setRmCurrentTime(mainPlayerCurrentTime);
        
        if (mainPlayerIsPlaying) {
          audioEl.play().then(() => {
            if (audioEl) setRmIsPlaying(true);
          }).catch(e => console.error("RM initial play error", e));
        } else {
          audioEl.pause();
          setRmIsPlaying(false);
        }
      };

      audioEl.addEventListener('canplaythrough', onCanPlay, { once: true });
      
      return () => {
        if (audioEl) {
            audioEl.removeEventListener('canplaythrough', onCanPlay);
            if (!audioEl.paused) {
              audioEl.pause();
            }
        }
      }
    } else if (!episodeAudioUrl) {
        setIsLoadingAudio(false); 
    }
  }, [episodeAudioUrl, mainPlayerCurrentTime, mainPlayerIsPlaying]);


  const handleRmPlayPause = useCallback(() => {
    const audioEl = readingModeAudioRef.current;
    if (audioEl) {
      if (audioEl.paused) {
        audioEl.play().then(() => {
            if(audioEl) setRmIsPlaying(true);
        }).catch(e => console.error("RM play error", e));
      } else {
        audioEl.pause();
        setRmIsPlaying(false);
      }
    }
  }, []);

  const handleRmSkip = useCallback((seconds) => {
    const audioEl = readingModeAudioRef.current;
    if (audioEl) {
      const newTime = Math.max(0, Math.min(rmDuration || 0, audioEl.currentTime + seconds));
      audioEl.currentTime = newTime;
      setRmCurrentTime(newTime);
    }
  }, [rmDuration]);
  
  const handleRmSeek = useCallback((time, playAfterSeek = false) => {
    const audioEl = readingModeAudioRef.current;
    if (audioEl && !isNaN(time)) {
      audioEl.currentTime = time;
      setRmCurrentTime(time);
      if (playAfterSeek && audioEl.paused) {
        handleRmPlayPause();
      }
    }
  }, [handleRmPlayPause]);

  const handleSegmentClick = useCallback((timeInSeconds, segment) => {
    handleRmSeek(timeInSeconds, true);
  }, [handleRmSeek]);
  
  const handleCloseReadingMode = useCallback(() => {
    if (readingModeAudioRef.current && !readingModeAudioRef.current.paused) {
        readingModeAudioRef.current.pause();
        setRmIsPlaying(false);
    }
    if (mainAudioPlayerRef?.current && mainAudioPlayerRef.current.paused && mainPlayerIsPlaying) {
      mainAudioPlayerRef.current.play().catch(e => console.error("Error resuming main player:", e));
    }
    onClose();
  }, [onClose, mainAudioPlayerRef, mainPlayerIsPlaying]);


  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCloseReadingMode();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseReadingMode]);


  return (
    <>
      <ReadingModeAudioPlayer
        audioRef={readingModeAudioRef}
        src={episodeAudioUrl} 
        onTimeUpdate={setRmCurrentTime}
        onLoadedMetadata={setRmDuration}
        onEnded={() => setRmIsPlaying(false)}
        onIsPlayingChange={setRmIsPlaying}
      />
      <div className="fixed inset-0 z-[100] bg-white text-slate-900 font-serif overflow-y-auto reading-mode-active">
        <FloatingPlayerControlsReadingMode
          episodeTitle={episodeData.displayTitle}
          isPlaying={rmIsPlaying}
          onPlayPause={handleRmPlayPause}
          onSkipSeconds={handleRmSkip}
          onClose={handleCloseReadingMode}
          currentLanguage={currentLanguage}
          audioRef={readingModeAudioRef} 
          isLoadingAudio={isLoadingAudio}
        />
        <div className="container mx-auto px-4 sm:px-6 md:px-8 pt-20 pb-8 max-w-3xl">
          <PlayerHeader 
            episodeTitle={episodeData.displayTitle}
            episodeDate={null} 
            onNavigateBack={() => {}} 
            currentLanguage={currentLanguage} 
            isReadingMode={true}
          />
           {isLoadingAudio && (
             <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
                <p className="mt-3 text-sm text-slate-600">{getLocaleString('loadingAudio', currentLanguage)}</p>
            </div>
           )}
          {!isLoadingAudio && (
            <div className="reading-mode-content-text">
              <QuestionsManager
                questions={episodeData.questions || []}
                currentTime={rmCurrentTime}
                duration={rmDuration}
                onQuestionsChange={onQuestionsChange} 
                onQuestionJump={(time, id, playAfterJumpParam) => handleRmSeek(time, playAfterJumpParam)}
                episodeSlug={episodeSlug}
                episodeDate={episodeDate}
                audioRef={readingModeAudioRef} 
                mainPlayerIsPlaying={rmIsPlaying}
                mainPlayerTogglePlayPause={handleRmPlayPause}
                mainPlayerSeekAudio={handleRmSeek}
                currentLanguage={currentLanguage}
                episodeLang={episodeData.lang || 'all'}
                episodeAudioUrl={episodeAudioUrl}
                jumpToQuestionId={episodeData?.jumpToQuestionId}
                isBatchAddDisabled={true}
                showTranscript={true} 
                user={user}
                isReadingMode={true}
                onSegmentClick={handleSegmentClick} 
                disableAutomaticCollapse={true}
                readingModeEditingActive={false} 
                setReadingModeEditingSegmentRef={null} 
                onOpenSpeakerAssignmentDialog={onOpenSpeakerAssignmentDialog}
                transcriptUtterances={internalTranscriptUtterances}
              />
            </div>
          )}
        </div>
      </div>
      {segmentForSpeakerAssignment && (
        <SpeakerAssignmentDialog
          isOpen={isSpeakerAssignmentDialogOpen}
          onClose={onCloseSpeakerAssignmentDialog}
          segment={segmentForSpeakerAssignment}
          allUtterances={internalTranscriptUtterances}
          onSave={onSaveSpeakerAssignment}
          currentLanguage={currentLanguage}
        />
      )}
    </>
  );
};

export default ReadingModeDisplay;