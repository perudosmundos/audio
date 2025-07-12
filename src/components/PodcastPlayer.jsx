import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
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
  episodeLang,
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
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);

  const langForContent = episodeData?.lang === 'all' ? currentLanguage : episodeData?.lang;

  const {
    isSpeakerAssignmentDialogOpen,
    segmentForSpeakerAssignment,
    handleOpenSpeakerAssignmentDialog,
    handleSaveSpeakerAssignment,
    handleCloseSpeakerAssignmentDialog
  } = useSpeakerAssignment(episodeData, onTranscriptUpdate, toast, currentLanguage, fetchTranscriptForEpisode, episodeSlug, langForContent);


  usePlayerInitialization({
    episodeData, audioRef, setIsPlayingState, setCurrentTimeState,
    setActiveQuestionTitleState, setDurationState, setCurrentPlaybackRateIndex,
    playbackRateOptions, onPlayerStateChange, lastJumpIdProcessedRef,
    jumpToTime: episodeData?.jumpToTime,
  });

  console.log('PodcastPlayer: About to call usePlayerTimeUpdates', {
    hasAudioRef: !!audioRef.current,
    questionsCount: internalQuestions?.length,
    hasTranscript: !!episodeData?.transcript
  });

  usePlayerPlayback({
    episodeData, audioRef, isPlayingState, setIsPlayingState,
    playPromiseRef, isSeekingRef, toast, currentLanguage,
    onPlayerStateChange, lastJumpIdProcessedRef, 
    jumpToTime: episodeData?.jumpToTime, jumpId: episodeData?.jumpId,
    playAfterJump: episodeData?.playAfterJump, setCurrentTimeState,
    setShowPlayOverlay
  });

  const { handleTimeUpdate, handleLoadedMetadata } = usePlayerTimeUpdates({
    audioRef, isSeekingRef, internalQuestions, currentLanguage,
    setCurrentTimeState, setActiveQuestionTitleState, setDurationState,
    onPlayerStateChange, skipEmptySegments, transcript: episodeData?.transcript, 
  });

  const { 
    handleProgressChange, handleSkip, navigateQuestion,
    seekAudio, togglePlayPause, setPlaybackRateByIndex
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

  useEffect(() => {
    if (audioRef.current && episodeData && episodeData.audio_url) {
      console.log('PodcastPlayer: Setting isPlaying to true for episode:', episodeData.audio_url);
      // Устанавливаем состояние воспроизведения в true, но не запускаем автоматически
      // Автоматический старт будет обработан в usePlayerPlayback
      setIsPlayingState(true);
    }
  }, [audioRef, episodeData, setIsPlayingState]);

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

  // Функция для ручного запуска play
  const handleManualPlay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setShowPlayOverlay(false);
        setIsPlayingState(true);
        onPlayerStateChange?.({ isPlaying: true });
      }).catch((error) => {
        if (error.name !== 'AbortError') {
          setShowPlayOverlay(true);
        }
      });
    }
  }, [audioRef, setIsPlayingState, onPlayerStateChange]);


  if (!episodeData) return <div className="p-4 text-center">{getLocaleString('selectAnEpisode', currentLanguage)}</div>;

  return (
    <>
    <div className="relative podcast-player bg-slate-800/50 p-2 sm:p-3 md:p-4 rounded-xl shadow-2xl border border-slate-700/40">
      {/* Overlay для ручного запуска */}
      {showPlayOverlay && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 rounded-xl">
          <button
            onClick={handleManualPlay}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg text-lg font-semibold shadow-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            ▶️ Нажмите для воспроизведения
          </button>
          <div className="mt-2 text-slate-200 text-sm">Браузер заблокировал автозапуск. Нажмите для старта аудио.</div>
        </div>
      )}
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
          onProgressChange={(time) => {
            console.log('PodcastPlayer: onProgressChange called with', time);
            handleProgressChange(time);
          }}
          questions={internalQuestions}
          onQuestionSelectJump={onQuestionSelectJump}
          onNavigateQuestion={navigateQuestion}
          onTogglePlayPause={() => {
            console.log('PodcastPlayer: onTogglePlayPause called');
            togglePlayPause();
          }}
          onSkip={(seconds) => {
            console.log('PodcastPlayer: onSkip called with', seconds);
            handleSkip(seconds);
          }}
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
