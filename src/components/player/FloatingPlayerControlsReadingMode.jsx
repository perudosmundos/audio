import React from 'react';
import { Play, Pause, RotateCcw, RotateCw, X } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const FloatingPlayerControlsReadingMode = ({ 
  episodeTitle, 
  isPlaying, 
  onPlayPause, 
  onSkipSeconds,
  onClose,
  currentLanguage,
  audioRef 
}) => {
  if (!episodeTitle) return null;

  const handlePlayPause = () => {
    if (onPlayPause) {
      onPlayPause();
    } else if (audioRef && audioRef.current) { 
      if (audioRef.current.paused) {
        audioRef.current.play().catch(e => console.error("Reading mode play error (direct):", e));
      } else {
        audioRef.current.pause();
      }
    }
  };

  const handleSkip = (seconds) => {
     if (onSkipSeconds) {
        onSkipSeconds(seconds);
     } else if (audioRef && audioRef.current) {
        const newTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + seconds));
        audioRef.current.currentTime = newTime;
    }
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[110] bg-slate-50/90 backdrop-blur-md shadow-lg border-b border-slate-300"
    >
      <div className="container mx-auto px-3 py-2 flex items-center justify-between max-w-3xl">
        <div className="flex-grow min-w-0 mx-2 text-center">
          <p className="text-sm font-semibold text-slate-700 truncate" title={episodeTitle}>
            {episodeTitle}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {isPlaying ? getLocaleString('nowPlaying', currentLanguage) : getLocaleString('paused', currentLanguage)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => handleSkip(-10)} 
            className="text-slate-700 hover:text-purple-700 hover:bg-purple-100 h-9 w-9 bg-transparent border-none cursor-pointer rounded"
            aria-label={getLocaleString('skipBackward10', currentLanguage) || "Skip backward 10s"}
            title={getLocaleString('skipBackward10Tooltip', currentLanguage)}
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button 
            onClick={handlePlayPause} 
            className="text-slate-800 hover:text-purple-700 bg-purple-500/20 hover:bg-purple-500/30 rounded-full h-10 w-10 bg-transparent border-none cursor-pointer"
            aria-label={isPlaying ? getLocaleString('pause', currentLanguage) : getLocaleString('play', currentLanguage)}
            title={isPlaying ? getLocaleString('pauseTooltip', currentLanguage) : getLocaleString('playTooltip', currentLanguage)}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button 
            onClick={() => handleSkip(10)} 
            className="text-slate-700 hover:text-purple-700 hover:bg-purple-100 h-9 w-9 bg-transparent border-none cursor-pointer rounded"
            aria-label={getLocaleString('skipForward10', currentLanguage) || "Skip forward 10s"}
            title={getLocaleString('skipForward10Tooltip', currentLanguage)}
          >
            <RotateCw className="h-5 w-5" />
          </button>
          <button 
            onClick={onClose}
            className="text-slate-700 hover:text-red-600 hover:bg-red-100 h-9 w-9 bg-transparent border-none cursor-pointer rounded ml-2"
            aria-label={getLocaleString('exitReadingMode', currentLanguage)}
            title={getLocaleString('exitReadingModeTooltip', currentLanguage)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingPlayerControlsReadingMode;