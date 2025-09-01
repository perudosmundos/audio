import React from 'react';
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
          <button 
            onClick={() => {
              if (onSkipSeconds) onSkipSeconds(-10);
            }} 
            className="text-slate-200 hover:text-white hover:bg-white/15 h-9 w-9 bg-transparent border-none cursor-pointer rounded"
            aria-label={getLocaleString('skipBackward10', currentLanguage) || "Skip backward 10s"}
          >
            <div className="h-5 w-5">⏪</div>
          </button>
          <button 
            onClick={onPlayPause} 
            className="text-slate-100 hover:text-white bg-purple-600/30 hover:bg-purple-500/50 rounded-full h-10 w-10 bg-transparent border-none cursor-pointer"
            aria-label={isPlaying ? getLocaleString('pause', currentLanguage) : getLocaleString('play', currentLanguage)}
          >
            {isPlaying ? <div className="h-5 w-5">⏸️</div> : <div className="h-5 w-5">▶️</div>}
          </button>
          <button 
            onClick={() => {
              if (onSkipSeconds) onSkipSeconds(10);
            }} 
            className="text-slate-200 hover:text-white hover:bg-white/15 h-9 w-9 bg-transparent border-none cursor-pointer rounded"
            aria-label={getLocaleString('skipForward10', currentLanguage) || "Skip forward 10s"}
          >
            <div className="h-5 w-5">⏩</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingPlayerControls;