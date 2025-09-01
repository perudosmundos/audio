
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import AudioElement from '@/components/player/player_parts/AudioElement';
import PlayerHeader from '@/components/player/player_parts/PlayerHeader';
import PlayerUIControls from '@/components/player/player_parts/PlayerUIControls';
import SpeakerAssignmentDialog from '@/components/transcript/SpeakerAssignmentDialog';
import AddQuestionDialog from '@/components/transcript/AddQuestionDialog.jsx'; 
import usePlayerState from '@/hooks/player/usePlayerState.js';
import usePlayerInitialization from '@/hooks/player/usePlayerInitialization';
import usePlayerPlayback from '@/hooks/player/usePlayerPlayback';
import usePlayerNavigation from '@/hooks/player/usePlayerNavigation';
import usePlayerTimeUpdates from '@/hooks/player/usePlayerTimeUpdates';
import useSpeakerAssignment from '@/hooks/player/useSpeakerAssignment';
import { getLocaleString } from '@/lib/locales';

const playbackRateOptions = [
  { label: "1x", value: 1},
  { label: "1.5x", value: 1.5},
  { label: "2x", value: 2},
];

const PodcastPlayer = ({ 
  episodeData, 
  onQuestionUpdate, 
  currentLanguage, 
  onQuestionSelectJump, 
  audioRef,
  episodeSlug, 
  episodeAudioUrl,
  episodeDate, 
  navigateBack,
  onPlayerStateChange,
  playerControlsContainerRef,
  showTranscript,
  onToggleShowTranscript,
  user,
  onTranscriptUpdate,
  fetchTranscriptForEpisode
 }) => {
  
  const { toast } = useToast();
  const internalQuestions = episodeData?.questions || [];
  const internalTranscriptUtterances = episodeData?.transcript?.utterances || [];

  const {
    isPlayingState, setIsPlayingState,
    currentTimeState, setCurrentTimeState,
    durationState, setDurationState,
    currentPlaybackRateIndex, setCurrentPlaybackRateIndex,
    activeQuestionTitleState, setActiveQuestionTitleState,
    isAddQuestionPlayerDialogOpen, setIsAddQuestionPlayerDialogOpen,
    addQuestionDialogInitialTime, setAddQuestionDialogInitialTime
  } = usePlayerState(episodeData?.duration);

  const playbackRate = playbackRateOptions[currentPlaybackRateIndex].value;

  const playPromiseRef = useRef(null);
  const isSeekingRef = useRef(false);
  const lastJumpIdProcessedRef = useRef(null);
  const [skipEmptySegments, setSkipEmptySegments] = useState(false);

  const langForContent = episodeData?.lang === 'all' ? currentLanguage : episodeData?.lang;

  const {
    isSpeakerAssignmentDialogOpen,
    segmentForSpeakerAssignment,
    handleSaveSpeakerAssignment,
    handleCloseSpeakerAssignmentDialog
  } = useSpeakerAssignment(episodeData, onTranscriptUpdate, toast, currentLanguage, fetchTranscriptForEpisode, episodeSlug, langForContent);

  usePlayerInitialization({
    episodeData, audioRef, setIsPlayingState, setCurrentTimeState,
    setActiveQuestionTitleState, setDurationState, setCurrentPlaybackRateIndex,
    playbackRateOptions, onPlayerStateChange, lastJumpIdProcessedRef,
    jumpToTime: episodeData?.jumpToTime,
  });

  usePlayerPlayback({
    episodeData, audioRef, isPlayingState, setIsPlayingState,
    playPromiseRef, isSeekingRef, toast, currentLanguage,
    onPlayerStateChange, lastJumpIdProcessedRef, 
    jumpToTime: episodeData?.jumpToTime, jumpId: episodeData?.jumpId,
    playAfterJump: episodeData?.playAfterJump, setCurrentTimeState,
  });

  const { handleTimeUpdate, handleLoadedMetadata } = usePlayerTimeUpdates({
    audioRef, isSeekingRef, internalQuestions, currentLanguage,
    setCurrentTimeState, setActiveQuestionTitleState, setDurationState,
    onPlayerStateChange, skipEmptySegments, transcript: episodeData?.transcript, 
  });

  const { 
    handleProgressChange, handleSkip, navigateQuestion,
    seekAudio, togglePlayPause
  } = usePlayerNavigation({
    audioRef, durationState, isPlayingState, setIsPlayingState,
    onQuestionSelectJump, internalQuestions, currentTimeState,
    toast, currentLanguage, currentPlaybackRateIndex,
    setCurrentPlaybackRateIndex, playbackRateOptions, episodeData, onPlayerStateChange,
  });
  
  const handleQuestionsChange = useCallback((action, questionDataOrArray) => {
    onQuestionUpdate(action, questionDataOrArray);
  }, [onQuestionUpdate]);

  const handleSetPlaybackRate = useCallback((rateValue) => {
    const index = playbackRateOptions.findIndex(opt => opt.value === rateValue);
    if (index !== -1) {
      setCurrentPlaybackRateIndex(index);
      if (audioRef.current) {
        audioRef.current.playbackRate = rateValue;
      }
      onPlayerStateChange?.({ playbackRate: rateValue });
    }
  }, [setCurrentPlaybackRateIndex, audioRef, onPlayerStateChange]);

  useEffect(() => {
    if(typeof window !== 'undefined'){
      window.__navigateQuestion = navigateQuestion;
      window.__skipPlayerTime = handleSkip;
      window.__togglePlayPause = togglePlayPause;
      window.__seekAudio = seekAudio;
    }
    return () => {
      if(typeof window !== 'undefined'){
        delete window.__navigateQuestion;
        delete window.__skipPlayerTime;
        delete window.__togglePlayPause;
        delete window.__seekAudio;
      }
    }
  }, [navigateQuestion, handleSkip, togglePlayPause, seekAudio]);

  const handleDownloadAudio = () => {
    if (episodeAudioUrl) {
      const link = document.createElement('a');
      link.href = episodeAudioUrl;
      link.download = `${episodeSlug || 'podcast_episode'}.mp3`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: getLocaleString('downloadStartedTitle', currentLanguage), description: getLocaleString('downloadStartedDesc', currentLanguage) });
    } else {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('audioNotAvailableForDownload', currentLanguage), variant: 'destructive' });
    }
  };

  const handleSaveNewQuestionFromPlayer = useCallback((title, time, isFullTranscript = false, isIntro = false) => {
    handleQuestionsChange('add', { title, time, lang: langForContent, isFullTranscript, isIntro });
    setIsAddQuestionPlayerDialogOpen(false);
  }, [handleQuestionsChange, langForContent, setIsAddQuestionPlayerDialogOpen]);

  const handleOpenAddQuestionDialogFromPlayer = useCallback(() => {
    setAddQuestionDialogInitialTime(currentTimeState);
    setIsAddQuestionPlayerDialogOpen(true);
  }, [currentTimeState, setAddQuestionDialogInitialTime, setIsAddQuestionPlayerDialogOpen]);

  if (!episodeData) return <div className="p-4 text-center">{getLocaleString('selectAnEpisode', currentLanguage)}</div>;

  return (
    <>
    <div className="relative podcast-player bg-slate-800/50 p-2 sm:p-3 md:p-4 rounded-xl shadow-2xl border border-slate-700/40">
      <PlayerHeader 
        episodeTitle={episodeData.displayTitle}
        episodeDate={episodeData.date} 
        onNavigateBack={navigateBack} 
        currentLanguage={currentLanguage} 
      />
      <div>
        <AudioElement 
          audioRef={audioRef}
          episodeAudioUrl={episodeAudioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => { setIsPlayingState(false); onPlayerStateChange?.({isPlaying: false});}}
          onDurationChange={handleLoadedMetadata} 
          playbackRate={playbackRate}
          onError={(e) => {
             if (e.target.error && e.target.error.code !== e.target.error.MEDIA_ERR_ABORTED) {
                toast({
                title: getLocaleString('audioErrorTitle', currentLanguage),
                description: getLocaleString('audioErrorDescriptionPlayer', currentLanguage, {episodeTitle: episodeData.title}),
                variant: "destructive",
                });
            }
          }}
        />
        
        <PlayerUIControls 
          activeQuestionTitle={activeQuestionTitleState}
          isPlaying={isPlayingState}
          currentLanguage={currentLanguage}
          currentTime={currentTimeState}
          duration={durationState}
          onProgressChange={handleProgressChange}
          questions={internalQuestions}
          onQuestionSelectJump={onQuestionSelectJump}
          onNavigateQuestion={navigateQuestion}
          onTogglePlayPause={togglePlayPause}
          onSkip={handleSkip}
          playerControlsContainerRef={playerControlsContainerRef}
          showTranscript={showTranscript}
          onToggleShowTranscript={onToggleShowTranscript}
          skipEmptySegments={skipEmptySegments}
          onToggleSkipEmptySegments={() => setSkipEmptySegments(prev => !prev)}
          onDownloadAudio={handleDownloadAudio}
          playbackRateOptions={playbackRateOptions}
          currentPlaybackRateValue={playbackRate}
          onSetPlaybackRate={handleSetPlaybackRate}
          onOpenAddQuestionDialog={handleOpenAddQuestionDialogFromPlayer}
          episodeDate={episodeDate}
        />
      </div>
    </div>
     {segmentForSpeakerAssignment && (
        <SpeakerAssignmentDialog
          isOpen={isSpeakerAssignmentDialogOpen}
          onClose={handleCloseSpeakerAssignmentDialog}
          segment={segmentForSpeakerAssignment}
          allUtterances={internalTranscriptUtterances}
          onSave={handleSaveSpeakerAssignment}
          currentLanguage={currentLanguage}
        />
      )}
      {isAddQuestionPlayerDialogOpen && (
        <AddQuestionDialog
          isOpen={isAddQuestionPlayerDialogOpen}
          onClose={() => setIsAddQuestionPlayerDialogOpen(false)}
          onSave={handleSaveNewQuestionFromPlayer}
          maxDuration={durationState}
          currentLanguage={currentLanguage}
          initialTime={addQuestionDialogInitialTime}
          episodeDate={episodeDate}
          segment={null}
          audioRef={audioRef}
          mainPlayerIsPlaying={isPlayingState}
          mainPlayerTogglePlayPause={togglePlayPause}
          mainPlayerSeekAudio={seekAudio}
        />
      )}
    </>
  );
};

export default React.memo(PodcastPlayer);
