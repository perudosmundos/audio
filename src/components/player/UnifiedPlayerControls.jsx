import React from 'react';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UnifiedPlayerControls = ({ 
  // Audio element props
  audioRef, 
  episodeAudioUrl, 
  onTimeUpdate, 
  onLoadedMetadata, 
  onEnded, 
  onDurationChange, 
  onError,
  playbackRate,
  
  // Control props
  isPlaying, 
  onPlayPause, 
  onSkip, 
  variant = "default",
  onAdjustTime,
  seekAudio,
  currentTime, 
  mainPlayerIsPlaying, 
  mainPlayerTogglePlayPause, 
  mainPlayerSeekAudio,
  audioRefCurrentTime, 
  playerDuration 
}) => {
  // Audio element effect
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioRef]);

  const controlSize = variant === "compact" ? "h-10 w-10 md:h-11 md:w-11" : "h-11 w-11 md:h-13 md:w-13";
  const iconSize = variant === "compact" ? "h-5 w-5 md:h-5 md:w-5" : "h-5 w-5 md:h-6 md:w-6";
  const mainButtonSize = variant === "compact" ? "h-14 w-14 md:h-16 md:w-16" : "h-16 w-16 md:h-18 md:w-18";
  const mainIconSize = variant === "compact" ? "h-7 w-7 md:h-8 md:w-8" : "h-8 w-8 md:h-9 md:w-9";

  if (variant === "timeAdjustment") {
    const handleTimeAdjustAndPlay = (amount) => {
      const currentAudioTime = audioRefCurrentTime ?? 0;
      const duration = playerDuration ?? Infinity;
      const newTime = Math.max(0, Math.min(duration, currentAudioTime + amount));
      
      if (onAdjustTime) { 
         onAdjustTime(amount); 
      } else if (mainPlayerSeekAudio) { 
         mainPlayerSeekAudio(newTime, true); 
      } else if (seekAudio) {
         seekAudio(newTime, true);
      }
    };

    return (
      <>
        {/* Hidden audio element */}
        <audio 
          ref={audioRef}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          onDurationChange={onDurationChange} 
          onError={onError}
          src={episodeAudioUrl} 
        />
        
        {/* Time adjustment controls */}
        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="sm" className="px-2 py-1 h-auto bg-white/10 hover:bg-white/20 border-white/20" onClick={() => handleTimeAdjustAndPlay(-10)}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> -10s
          </Button>
          <Button variant="outline" size="sm" className="px-2 py-1 h-auto bg-white/10 hover:bg-white/20 border-white/20" onClick={() => handleTimeAdjustAndPlay(-1)}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> -1s
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-white/10 hover:bg-white/20 border-white/20" 
            onClick={() => {
               if (mainPlayerTogglePlayPause) mainPlayerTogglePlayPause(); 
               else if (onPlayPause) onPlayPause(); 
            }}>
            {(mainPlayerIsPlaying !== undefined ? mainPlayerIsPlaying : isPlaying) ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" className="px-2 py-1 h-auto bg-white/10 hover:bg-white/20 border-white/20" onClick={() => handleTimeAdjustAndPlay(1)}>
            +1s <RotateCw className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button variant="outline" size="sm" className="px-2 py-1 h-auto bg-white/10 hover:bg-white/20 border-white/20" onClick={() => handleTimeAdjustAndPlay(10)}>
            +10s <RotateCw className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onDurationChange={onDurationChange} 
        onError={onError}
        src={episodeAudioUrl} 
      />
      
      {/* Main player controls */}
      <div className={`flex items-center justify-center gap-2 md:gap-2.5 ${variant === "compact" ? "my-0" : ""}`}>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => onSkip(-10)}
          className={`text-white hover:text-white/80 hover:bg-white/15 ${controlSize}`}
          aria-label="Перемотать назад на 10 секунд"
        >
          <RotateCcw className={iconSize} />
        </Button>
        
        <Button 
          variant="default" 
          size="icon"
          onClick={onPlayPause}
          className={`bg-white text-blue-700 hover:bg-white/90 rounded-full flex items-center justify-center shadow-lg ${mainButtonSize}`}
          aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
        >
          {isPlaying ? <Pause className={mainIconSize} /> : <Play className={`${mainIconSize}`} />}
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => onSkip(10)}
          className={`text-white hover:text-white/80 hover:bg-white/10 ${controlSize}`}
          aria-label="Перемотать вперед на 10 секунд"
        >
          <RotateCw className={iconSize} />
        </Button>
      </div>
    </>
  );
};

export default UnifiedPlayerControls; 