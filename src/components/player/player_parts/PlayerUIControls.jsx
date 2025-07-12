import React from 'react';
import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayerControls from '@/components/player/PlayerControls';
import ProgressBar from '@/components/player/ProgressBar';
import { formatFullTime } from '@/lib/utils';
import { getLocaleString } from '@/lib/locales';
import PlayerSettingsMenu from './PlayerSettingsMenu';

const PlayerUIControls = React.memo(({ 
  activeQuestionTitle, 
  isPlaying, 
  currentLanguage, 
  currentTime, 
  duration, 
  onProgressChange, 
  questions, 
  onQuestionSelectJump, 
  onNavigateQuestion, 
  onTogglePlayPause,
  onSkip,
  playerControlsContainerRef,
  showTranscript,
  onToggleShowTranscript,
  skipEmptySegments,
  onToggleSkipEmptySegments,
  onDownloadAudio,
  playbackRateOptions,
  currentPlaybackRateValue,
  onSetPlaybackRate,
  onOpenAddQuestionDialog,
  episodeDate
}) => {
  
  return (
    <div ref={playerControlsContainerRef} className="w-full flex flex-col items-center justify-center">
      <div className="w-full flex flex-col items-center justify-center px-1 sm:px-1.5">
        <div className="h-5 text-center mb-1 text-xs sm:text-sm text-white truncate px-1 w-full flex items-center justify-center">
          {activeQuestionTitle || (isPlaying ? getLocaleString('nowPlaying', currentLanguage) : getLocaleString('paused', currentLanguage))}
        </div>
        <div className="w-full flex flex-col items-center justify-center">
          <ProgressBar 
            currentTime={currentTime}
            duration={duration}
            sections={questions}
            onProgressChange={onProgressChange}
            onSectionJump={(time, id) => onQuestionSelectJump(time, id, true)}
          />
          <div className="flex justify-between text-xs mt-1 text-white/80 px-1 w-full max-w-full">
            <span>{formatFullTime(currentTime, true)}</span>
            <span>{formatFullTime(duration, true)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-col items-center gap-1.5 md:gap-2.5">
        <div className="flex items-center justify-center w-full gap-1.5 sm:gap-2 md:gap-2.5">
          <PlayerSettingsMenu
            currentLanguage={currentLanguage}
            showTranscript={showTranscript}
            onToggleShowTranscript={onToggleShowTranscript}
            skipEmptySegments={skipEmptySegments}
            onToggleSkipEmptySegments={onToggleSkipEmptySegments}
            onDownloadAudio={onDownloadAudio}
            playbackRateOptions={playbackRateOptions}
            currentPlaybackRateValue={currentPlaybackRateValue}
            onSetPlaybackRate={onSetPlaybackRate}
            isCompact={false}
          />
          <Button variant="ghost" size="icon" onClick={() => onNavigateQuestion(-1)} className="text-white/80 hover:text-white hover:bg-white/15 h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11" aria-label={getLocaleString('previousQuestion', currentLanguage)}>
            <ChevronLeft className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6" />
          </Button>
          <PlayerControls
            isPlaying={isPlaying}
            onPlayPause={onTogglePlayPause}
            onSkip={onSkip}
            variant="compact"
            currentLanguage={currentLanguage}
          />
          <Button variant="ghost" size="icon" onClick={() => onNavigateQuestion(1)} className="text-white/80 hover:text-white hover:bg-white/15 h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11" aria-label={getLocaleString('nextQuestion', currentLanguage)}>
            <ChevronRight className="h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onOpenAddQuestionDialog}
            className="text-white/80 hover:text-white hover:bg-white/15 h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11" 
            aria-label={getLocaleString('addQuestion', currentLanguage)}
          >
            <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-5 md:w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
});

export default PlayerUIControls;