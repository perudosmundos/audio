import React, { useRef, useCallback } from 'react';
import { formatTime } from '@/lib/utils';
import { getLocaleString } from '@/lib/locales';

const DEFAULT_MARKER_COLOR = '#FFC107';

const ProgressBar = ({ currentTime, duration, sections, onProgressChange, onSectionJump, currentLanguage = 'ru' }) => {

  const progressBarRef = useRef(null);

  const handleProgressInteraction = useCallback((clientX) => {
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickPosition = (clientX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(duration, clickPosition * duration));

      if (typeof onProgressChange === 'function' && !isNaN(newTime)) {
        onProgressChange(newTime);
      } else {
      }
    } else {
    }
  }, [duration, onProgressChange]);

  const handleMouseClick = (e) => {
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
      className="h-6 md:h-7 w-full relative cursor-pointer group"
      onClick={handleMouseClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      ref={progressBarRef}
      role="slider"
      aria-valuemin="0"
      aria-valuemax={duration}
      aria-valuenow={currentTime}
      aria-label={getLocaleString('playerProgressBar', currentLanguage)}
    >
      <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-full h-1.5 md:h-2 bg-white/20 rounded-full group-hover:h-2 md:group-hover:h-2.5 transition-all"></div>

      <div
        className="absolute top-1/2 left-0 transform -translate-y-1/2 progress-bar group-hover:h-2 md:group-hover:h-2.5 transition-all"
        style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
      ></div>

      {sections.map((section) => (
        <button
          key={section.id}
          className="absolute w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shadow-md hover:scale-150 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-white"
          style={{
            left: duration > 0 ? `calc(${(section.time / duration) * 100}% - 5px)` : '0%',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: DEFAULT_MARKER_COLOR
          }}
          onClick={(e) => handleSectionMarkerClick(e, section.time, section.id)}
          onTouchStart={(e) => handleSectionMarkerClick(e, section.time, section.id)}
          title={`${section.title} (${formatTime(section.time)})`}
          aria-label={getLocaleString('playerJumpToQuestion', currentLanguage, { title: section.title })}
        ></button>
      ))}
      <div
        className="absolute top-1/2 h-3 w-3 md:h-3.5 md:w-3.5 bg-white rounded-full shadow-md transform -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all group-hover:h-4 group-hover:w-4"
        style={{ left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
      ></div>
    </div>
  );
};

export default ProgressBar;