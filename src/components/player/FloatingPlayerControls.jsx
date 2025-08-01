import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCw, RotateCcw } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const FloatingPlayerControls = ({ 
  episodeTitle, 
  isPlaying, 
  activeQuestionTitle,
  onPlayPause, 
  onSkipSeconds,
  currentLanguage
}) => {
  if (!episodeTitle) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md shadow-xl border-b border-slate-700/50"
    >
      <div className="container mx-auto px-3 py-2 flex items-center justify-between max-w-4xl">
        <div className="flex-grow min-w-0 mr-2">
          <p className="text-sm font-semibold text-purple-300 truncate" title={episodeTitle}>
            {episodeTitle}
          </p>
          <p className="text-xs text-slate-300 truncate" title={activeQuestionTitle || getLocaleString('paused', currentLanguage)}>
            {activeQuestionTitle || (isPlaying ? getLocaleString('nowPlaying', currentLanguage) : getLocaleString('paused', currentLanguage))}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (onSkipSeconds) onSkipSeconds(-10);
            }} 
            className="text-slate-200 hover:text-white hover:bg-white/15 h-9 w-9"
            aria-label={getLocaleString('skipBackward10', currentLanguage) || "Skip backward 10s"}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onPlayPause} 
            className="text-slate-100 hover:text-white bg-purple-600/30 hover:bg-purple-500/50 rounded-full h-10 w-10"
            aria-label={isPlaying ? getLocaleString('pause', currentLanguage) : getLocaleString('play', currentLanguage)}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (onSkipSeconds) onSkipSeconds(10);
            }} 
            className="text-slate-200 hover:text-white hover:bg-white/15 h-9 w-9"
            aria-label={getLocaleString('skipForward10', currentLanguage) || "Skip forward 10s"}
          >
            <RotateCw className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FloatingPlayerControls;