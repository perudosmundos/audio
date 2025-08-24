import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit3, HelpCircle } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import { formatFullTime } from '@/lib/utils';
import SegmentEditControls from '@/components/player/questions_manager_parts/SegmentEditControls.jsx';
import AddSegmentDialog from '@/components/player/questions_manager_parts/AddSegmentDialog.jsx';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

const speakerDisplayColors = [
  'text-sky-400', 'text-emerald-400', 'text-amber-400', 
  'text-rose-400', 'text-indigo-400', 'text-pink-400',
  'text-teal-400', 'text-orange-400', 'text-cyan-400',
  'text-lime-400', 'text-fuchsia-400', 'text-violet-400'
];

const speakerColorCache = {};

const getSpeakerDisplay = (speakerId, currentLanguage) => {
  if (speakerId === null || speakerId === undefined || String(speakerId).trim() === "") {
    return { name: getLocaleString('unknownSpeaker', currentLanguage), color: 'text-slate-400' };
  }
  
  const speakerString = String(speakerId).trim();

  // Жёсткое сопоставление цветов для Pepe и Maria
  if (speakerString.toLowerCase() === 'pepe') {
    return { name: speakerString, color: 'text-fuchsia-400' };
  }
  if (speakerString.toLowerCase() === 'maria') {
    return { name: speakerString, color: 'text-sky-400' };
  }

  if (speakerColorCache[speakerString]) {
    const cached = speakerColorCache[speakerString];
    const isNumericDefault = /^\d+$/.test(speakerString) || /^SPEAKER_[A-Z]$/.test(speakerString.toUpperCase()) || /^SPEAKER\s[A-Z0-9]+$/.test(speakerString.toUpperCase());
    const name = isNumericDefault ? `${getLocaleString('speaker', currentLanguage)} ${speakerString.replace(/^SPEAKER\s?/i, '')}` : speakerString;
    return { name, color: cached.color };
  }
  
  let idForColorHash = 0;
  for (let i = 0; i < speakerString.length; i++) {
    idForColorHash = (idForColorHash << 5) - idForColorHash + speakerString.charCodeAt(i);
    idForColorHash |= 0; 
  }
  
  const colorIndex = Math.abs(idForColorHash) % speakerDisplayColors.length;
  const color = speakerDisplayColors[colorIndex] || 'text-slate-400';
  
  speakerColorCache[speakerString] = { color };

  const isNumericDefault = /^\d+$/.test(speakerString) || /^SPEAKER_[A-Z]$/.test(speakerString.toUpperCase()) || /^SPEAKER\s[A-Z0-9]+$/.test(speakerString.toUpperCase());
  const name = isNumericDefault ? `${getLocaleString('speaker', currentLanguage)} ${speakerString.replace(/^SPEAKER\s?/i, '')}` : speakerString;

  return { name, color };
};


const TranscriptSegment = ({
  segment,
  isActive,
  isEditingThisSegment,
  editedText,
  onSegmentClick,
  onEditSegment,
  onSaveEdit,
  onCancelEdit,
  onTextChange,
  currentLanguage,
  onAddQuestionFromSegment,
  highlightTextFn,
  onSplitSegment,
  onMergeWithPreviousSegment,
  onDeleteSegment,
  isFirstOverallSegment,
  setTextareaRef,
  isActiveQuestionBlock,
  isJumpTargetPreview,
  onOpenSpeakerAssignmentDialog,
  availableSpeakers = [],
  onSetSegmentSpeaker,
  onInsertManualSegment
}) => {
  
  const [cursorPositionForSplit, setCursorPositionForSplit] = useState(null);
  const internalTextareaRef = useRef(null);
  const [textareaHeight, setTextareaHeight] = useState('auto');
  const [isAddSegmentOpen, setIsAddSegmentOpen] = useState(false);
  const [defaultAddStartSec, setDefaultAddStartSec] = useState(undefined);
  const [defaultAddEndSec, setDefaultAddEndSec] = useState(undefined);
  
  useEffect(() => {
    if (setTextareaRef && internalTextareaRef.current) {
      setTextareaRef(internalTextareaRef.current);
    }
  }, [setTextareaRef, internalTextareaRef]);

  useEffect(() => {
    if (isEditingThisSegment && internalTextareaRef.current) {
      internalTextareaRef.current.focus();
      const scrollHeight = internalTextareaRef.current.scrollHeight;
      internalTextareaRef.current.style.height = 'auto'; 
      internalTextareaRef.current.style.height = `${scrollHeight}px`; 
      setTextareaHeight(`${scrollHeight}px`);
    } else {
      setTextareaHeight('auto');
    }
  }, [isEditingThisSegment, editedText]);
  
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditingThisSegment && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (onSaveEdit) onSaveEdit();
      }
    };

    const currentRef = internalTextareaRef.current;
    if (currentRef && isEditingThisSegment) {
      currentRef.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      if (currentRef && isEditingThisSegment) {
        currentRef.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isEditingThisSegment, onSaveEdit]);

  const handleTimeClick = (e) => {
    e.stopPropagation(); 
    if (onSegmentClick && segment && typeof segment.start === 'number') {
      onSegmentClick(segment.start / 1000, segment);
    }
  };

  const handleSpeakerClick = (e) => {
    e.stopPropagation();
    if (onOpenSpeakerAssignmentDialog && segment) {
      onOpenSpeakerAssignmentDialog(segment);
    }
  };
  
  const segmentTextDisplay = highlightTextFn && segment?.text ? highlightTextFn(segment.text) : segment?.text;

  const attemptSplit = () => {
    if (onSplitSegment && segment) {
      // If cursorPositionForSplit is valid, pass it; otherwise let downstream read selection from textareaRef
      const pos = (typeof cursorPositionForSplit === 'number' && cursorPositionForSplit >= 0 && cursorPositionForSplit <= (editedText || '').length)
        ? cursorPositionForSplit
        : undefined;
      onSplitSegment(segment, editedText, pos);
    }
  };

  const attemptMerge = () => {
    if (onMergeWithPreviousSegment && segment) {
        onMergeWithPreviousSegment(segment);
    }
  };
  
  const attemptDelete = () => {
    if (onDeleteSegment && segment) {
        onDeleteSegment(segment);
    }
  };

  const openAddSegment = () => {
    if (segment && typeof segment.end === 'number') {
      const startSec = Math.round(segment.end / 1000);
      setDefaultAddStartSec(startSec);
      setDefaultAddEndSec(startSec + 1);
    } else {
      setDefaultAddStartSec(undefined);
      setDefaultAddEndSec(undefined);
    }
    setIsAddSegmentOpen(true);
  };
  const closeAddSegment = () => setIsAddSegmentOpen(false);

  const handleInlineSpeakerChange = (newSpeaker) => {
    if (!onSetSegmentSpeaker) return;
    const oldSpeakerId = segment?.speaker;
    const finalSpeakerId = newSpeaker === '' ? null : newSpeaker;
    onSetSegmentSpeaker(segment, oldSpeakerId, finalSpeakerId);
  };

  const handleTextareaChange = (e) => {
    if (onTextChange) {
        onTextChange(e.target.value);
    }
    if (internalTextareaRef.current) {
      internalTextareaRef.current.style.height = 'auto';
      internalTextareaRef.current.style.height = `${internalTextareaRef.current.scrollHeight}px`;
      setTextareaHeight(`${internalTextareaRef.current.scrollHeight}px`);
    }
  };

  const handleTextareaClick = (e) => {
    setCursorPositionForSplit(e.target.selectionStart);
  };
  const handleTextareaKeyUp = (e) => {
     setCursorPositionForSplit(e.target.selectionStart);
  };

  const segmentBaseStyle = `p-1.5 mb-1 rounded-md transition-all duration-200 ease-in-out shadow-sm text-sm relative`;
  let segmentDynamicStyle = "";

  if (isEditingThisSegment) {
    segmentDynamicStyle = "bg-slate-500 ring-1 ring-purple-400 shadow-purple-400/20";
  } else if (isActive) { 
    segmentDynamicStyle = "bg-purple-700/20 ring-2 ring-purple-400 shadow-lg shadow-purple-400/20 z-10 segment-active-highlight";
  } else if (isJumpTargetPreview && isActiveQuestionBlock) {
    segmentDynamicStyle = "bg-purple-600/15"; 
  } else {
    segmentDynamicStyle = "bg-slate-700/30 hover:bg-slate-600/40";
  }


  if (!segment || typeof segment.start !== 'number' || typeof segment.end !== 'number') {
    return null; 
  }
  
  const speakerInfo = getSpeakerDisplay(segment.speaker, currentLanguage);
  const timeColorClass = speakerInfo.color;

  return (
    <>
    <div
      className={`${segmentBaseStyle} ${segmentDynamicStyle}`}
      id={`segment-${segment.start}`}
    >
      <div className="min-w-0">
          <div className={`flex justify-between items-center mb-px text-xs`}>
              <div className="flex items-center">
                <span 
                  onClick={handleTimeClick}
                  className={`hover:underline ${isEditingThisSegment ? 'text-slate-300 cursor-default' : `${timeColorClass} cursor-pointer`}`}
                  role="button"
                  tabIndex={isEditingThisSegment ? -1 : 0}
                  onKeyPress={(e) => { if(e.key === 'Enter' && !isEditingThisSegment) handleTimeClick(e);}}
                >
                  {formatFullTime(segment.start / 1000)} - {formatFullTime(segment.end / 1000)}
                </span>
                {segment.speaker !== null && segment.speaker !== undefined && !isEditingThisSegment && (
                    <span 
                      onClick={handleSpeakerClick}
                      className={`ml-2 font-medium cursor-pointer hover:opacity-80 ${speakerInfo.color}`}
                      title={`${getLocaleString('assignSpeakerTooltip', currentLanguage)}: ${speakerInfo.name}`}
                    >
                      ({speakerInfo.name})
                    </span>
                )}
              </div>
              {!isEditingThisSegment && (
                  <div className="flex items-center gap-0.5">
                      <TooltipProvider delayDuration={200}>
                          <Tooltip>
                          <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon_xs" className="text-slate-300 hover:text-purple-300 hover:bg-slate-700/70 h-6 w-6" onClick={(e) => { e.stopPropagation(); if(onAddQuestionFromSegment) onAddQuestionFromSegment(segment);}}>
                              <HelpCircle size={14} />
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700">
                              <p>{getLocaleString('addQuestionToSegment', currentLanguage)}</p>
                          </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                          <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon_xs" className="text-slate-300 hover:text-purple-300 hover:bg-slate-700/70 h-6 w-6" onClick={(e) => { e.stopPropagation(); if(onEditSegment) onEditSegment(segment);}}>
                              <Edit3 size={13} />
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700">
                              <p>{getLocaleString('editSegment', currentLanguage)}</p>
                          </TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                  </div>
              )}
          </div>
        
        <div className="flex items-start gap-1">
          <div className="flex-grow min-w-0">
            {isEditingThisSegment ? (
              <>
              <div className="mb-2 w-full max-w-xs">
                <Select value={String(segment?.speaker || '') || '__none__'} onValueChange={(v) => handleInlineSpeakerChange(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 h-8">
                    <SelectValue placeholder={getLocaleString('selectSpeakerPlaceholder', currentLanguage)}>
                      {segment?.speaker && (
                        <span className={getSpeakerDisplay(segment.speaker, currentLanguage).color}>
                          {getSpeakerDisplay(segment.speaker, currentLanguage).name}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="__none__">
                      <span className="text-slate-400">{getLocaleString('unknownSpeaker', currentLanguage)}</span>
                    </SelectItem>
                    {availableSpeakers.map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={getSpeakerDisplay(s, currentLanguage).color}>{s}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                ref={internalTextareaRef}
                value={editedText || ""}
                onChange={handleTextareaChange}
                onClick={(e) => { e.stopPropagation(); handleTextareaClick(e); }}
                onKeyUp={handleTextareaKeyUp}
                className={`w-full p-2 rounded border-slate-400 focus:ring-purple-500 focus:border-purple-500 text-sm leading-relaxed placeholder-slate-500 overflow-hidden resize-none bg-slate-200 text-slate-900`}
                style={{ height: textareaHeight }}
                placeholder={getLocaleString('editTextSegmentPlaceholder', currentLanguage)}
              />
              </>
            ) : (
              <>
              <p
                className={`leading-relaxed whitespace-pre-wrap pt-0.5 pb-0 rounded-sm text-sm text-slate-100`}
              >
                {segmentTextDisplay}
              </p>
              </>
            )}
          </div>
        </div>
        {isEditingThisSegment && (
          <SegmentEditControls
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            onSplit={attemptSplit}
            onMerge={attemptMerge}
            onDelete={attemptDelete}
            onAdd={(e) => { if (e) e.stopPropagation(); openAddSegment(); }}
            isFirstOverallSegment={isFirstOverallSegment}
            currentLanguage={currentLanguage}
          />
        )}
      </div>
    </div>
    <AddSegmentDialog
      isOpen={isAddSegmentOpen}
      onClose={closeAddSegment}
      onSave={({ startSec, endSec, text }) => {
        if (typeof onInsertManualSegment === 'function') {
          onInsertManualSegment(startSec, endSec, text);
        }
        closeAddSegment();
      }}
      currentLanguage={currentLanguage}
      defaultStartSec={defaultAddStartSec}
      defaultEndSec={defaultAddEndSec}
    />
    </>
  );
};

export default TranscriptSegment;
