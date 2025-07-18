import React, { useRef, useCallback } from 'react';
import { formatTime } from '@/lib/utils';

const DEFAULT_MARKER_COLOR = '#FFC107'; 

const ProgressBar = ({ currentTime, duration, sections, onProgressChange, onSectionJump }) => {
  const progressBarRef = useRef(null);

  const handleProgressInteraction = useCallback((clientX) => {
    console.log('ProgressBar: handleProgressInteraction called with clientX', clientX);
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickPosition = (clientX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(duration, clickPosition * duration));
      console.log('ProgressBar: Calculated new time', { clickPosition, newTime, duration });
      if (typeof onProgressChange === 'function' && !isNaN(newTime)) {
        console.log('ProgressBar: Calling onProgressChange with', newTime);
        onProgressChange(newTime);
      } else {
        console.log('ProgressBar: onProgressChange is not a function or invalid time', { 
          isFunction: typeof onProgressChange === 'function', 
          newTime, 
          isValid: !isNaN(newTime) 
        });
      }
    } else {
      console.log('ProgressBar: No progress bar ref or invalid duration', { 
        hasRef: !!progressBarRef.current, 
        duration 
      });
    }
  }, [duration, onProgressChange]);

  const handleMouseClick = (e) => {
    console.log('ProgressBar: Mouse click detected');
    handleProgressInteraction(e.clientX);
  };

  const handleTouchInteraction = (touch) => {
    handleProgressInteraction(touch.clientX);
  }
  
  const handleTouchStart = (e) => {
     if (e.touches.length > 0) {
      handleTouchInteraction(e.touches[0]);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault(); 
    if (e.touches.length > 0) {
      handleTouchInteraction(e.touches[0]);
    }
  };

  const handleSectionMarkerClick = useCallback((e, time, id) => {
    e.stopPropagation(); 
    if (typeof onSectionJump === 'function' && !isNaN(time)) {
      onSectionJump(time, id);
    }
  }, [onSectionJump]);


  return (
    <div 
      className="h-5 md:h-6 w-full relative cursor-pointer group"
      onClick={handleMouseClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      ref={progressBarRef}
      role="slider"
      aria-valuemin="0"
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      aria-label="Podcast progress"
    >
      <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-full h-1 md:h-1.5 bg-white/20 rounded-full group-hover:h-1.5 md:group-hover:h-2 transition-all"></div>
      <div 
        className="absolute top-1/2 left-0 transform -translate-y-1/2 progress-bar group-hover:h-1.5 md:group-hover:h-2 transition-all"
        style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
      ></div>
      
      {sections.map((section) => (
        <button
          key={section.id}
          className="absolute w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shadow-md hover:scale-150 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-white"
          style={{ 
            left: duration > 0 ? `calc(${(section.time / duration) * 100}% - 4px)` : '0%',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: DEFAULT_MARKER_COLOR 
          }}
          onClick={(e) => handleSectionMarkerClick(e, section.time, section.id)}
          onTouchStart={(e) => handleSectionMarkerClick(e, section.time, section.id)}
          title={`${section.title} (${formatTime(section.time)})`}
          aria-label={`Перейти к вопросу: ${section.title}`}
        ></button>
      ))}
      <div 
        className="absolute top-1/2 h-2.5 w-2.5 md:h-3 md:w-3 bg-white rounded-full shadow-md transform -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all group-hover:h-3.5 group-hover:w-3.5"
        style={{ left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
      ></div>
    </div>
  );
};

export default ProgressBar;