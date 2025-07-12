import React from 'react';
import TranscriptSegment from '@/components/transcript/TranscriptSegment.jsx';
import { Button } from '@/components/ui/button';
import { getLocaleString } from '@/lib/locales';

const SegmentList = ({
  segments,
  visibleSegmentsCount,
  editingSegment,
  editedText,
  activeSegmentTime,
  question,
  blockIndex,
  currentLanguage,
  onSegmentClick,
  handleEditSegment,
  handleSaveCurrentSegmentEdit,
  handleCancelEdit,
  isSaving,
  setEditedText,
  audioRef,
  segmentPlaying,
  onAddQuestionFromSegment,
  performActionWithConfirmation,
  setTextareaRef,
  handleLoadMoreSegments,
  toggleTextExpansion,
  isJumpTarget,
  isActiveQuestionBlock,
  isExpanded,
  isReadingMode,
  readingModeEditingActive,
  onOpenSpeakerAssignmentDialog
}) => {
  
  const segmentsToDisplay = segments.slice(0, visibleSegmentsCount);
  const showLoadMore = segments.length > visibleSegmentsCount && !isReadingMode;

  return (
    <div
      className={`overflow-hidden pl-1 pr-0.5 pt-1.5 mt-1 rounded-b-md 
        ${isJumpTarget && isActiveQuestionBlock && !isReadingMode ? 'border-x border-b border-purple-500/30' : 'border-t border-slate-700/20'}
        ${isReadingMode ? 'reading-mode-segment-list' : ''}
      `}
    >
      {segmentsToDisplay.map((segmentItem, index) => (
        <TranscriptSegment
          key={segmentItem.id || `${segmentItem.start}-${index}`}
          segment={segmentItem}
          isActive={!isReadingMode && activeSegmentTime === segmentItem.start}
          isEditingThisSegment={ (isReadingMode && readingModeEditingActive && editingSegment?.id === segmentItem.id) || 
                                 (!isReadingMode && editingSegment && (editingSegment.id || editingSegment.start) === (segmentItem.id || segmentItem.start))}
          editedText={editedText}
          isSaving={isSaving}
          onSegmentClick={onSegmentClick}
          onEditSegment={handleEditSegment}
          onSaveEdit={handleSaveCurrentSegmentEdit}
          onCancelEdit={handleCancelEdit}
          onTextChange={setEditedText}
          audioRef={audioRef}
          currentLanguage={currentLanguage}
          segmentPlaying={segmentPlaying}
          onAddQuestionFromSegment={onAddQuestionFromSegment}
          activeSegmentTime={activeSegmentTime}
          highlightTextFn={(text) => text} 
          isFirstSegmentInQuestion={index === 0 && question && !question.isIntro && !question.isFullTranscript && Math.abs((question.time * 1000) - segmentItem.start) < 1000 } 
          onSplitSegment={(seg, txt, pos) => performActionWithConfirmation('Split', seg, txt, pos)}
          onMergeWithPreviousSegment={(seg) => performActionWithConfirmation('Merge', seg)}
          onDeleteSegment={(seg) => performActionWithConfirmation('Delete', seg)}
          isFirstOverallSegment={blockIndex === 0 && index === 0} 
          setTextareaRef={setTextareaRef}
          isActiveQuestionBlock={isActiveQuestionBlock}
          isJumpTargetPreview={isJumpTarget && index === 0}
          isReadingMode={isReadingMode}
          readingModeEditingActive={readingModeEditingActive}
          onOpenSpeakerAssignmentDialog={onOpenSpeakerAssignmentDialog}
        />
      ))}
      {!isReadingMode && (
        <div className="flex justify-start items-center gap-2 mt-1 min-h-[26px]">
          {showLoadMore && (
            <Button 
              onClick={handleLoadMoreSegments} 
              variant="link" 
              size="sm" 
              className="text-purple-300 hover:text-purple-200 text-xs focus-visible:ring-purple-400 focus-visible:ring-offset-slate-900 focus-visible:ring-1 border border-purple-400/30 hover:border-purple-400/60 px-2 py-1 h-auto"
            >
              {getLocaleString('loadMoreSegments', currentLanguage)} ({segments.length - visibleSegmentsCount})
            </Button>
          )}
          {isExpanded && segments.length > 0 && (
            <Button 
                onClick={(e) => {e.stopPropagation(); toggleTextExpansion(e);}} 
                variant="link" 
                size="sm" 
                className="text-slate-400 hover:text-slate-200 text-xs focus-visible:ring-slate-400 focus-visible:ring-offset-slate-900 focus-visible:ring-1"
            >
                {getLocaleString('hide', currentLanguage)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SegmentList;