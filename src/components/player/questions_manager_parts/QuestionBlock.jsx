import React, { useState, useEffect, useCallback } from 'react';
import { Edit, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocaleString } from '@/lib/locales';
import { formatFullTime } from '@/lib/utils';
import EditConfirmationDialog from '@/components/player/questions_manager_parts/EditConfirmationDialog.jsx';
import SegmentList from '@/components/player/questions_manager_parts/SegmentList.jsx';
import useSegmentEditing from '@/hooks/useSegmentEditing.js';
import { useEditorAuth } from '@/contexts/EditorAuthContext';
import { saveEditToHistory } from '@/services/editHistoryService';
import { useToast } from '@/components/ui/use-toast';

const QuestionBlockHeader = ({ 
  question, 
  isActiveQuestion, 
  isExpanded, 
  editingSegment,
  onActivate, 
  onToggleExpansion, 
  onEditQuestion, 
  currentLanguage,
  segmentsAvailable,
  isReadingMode
}) => (
  <div 
    className={`flex justify-between items-center p-1.5 rounded-t-md transition-colors
      ${isReadingMode ? 'cursor-default' : 'cursor-pointer hover:bg-slate-700/20'}
      ${isActiveQuestion && !isReadingMode ? 'bg-purple-600/15' : ''}
      ${isReadingMode ? 'mb-1 pb-2' : ''} 
    `}
    onClick={isReadingMode ? undefined : onActivate}
    role={isReadingMode ? undefined : "button"}
    tabIndex={isReadingMode ? undefined : 0}
    onKeyPress={(e) => { if(e.key === 'Enter' && !isReadingMode) { onActivate() } }}
  >
    <div className="flex items-center gap-2 overflow-hidden">
        {!isReadingMode && (
          <div className={`text-white text-xs px-1.5 py-0.5 rounded tabular-nums ${isActiveQuestion ? 'bg-purple-500' : 'bg-blue-500/70'}`}>
            {formatFullTime(question.time, true)}
          </div>
        )}
      <span className={`font-medium line-clamp-1 flex-grow min-w-0 ${isReadingMode ? 'text-xl font-semibold text-slate-900' : 'text-sm text-slate-100'}`}>
        {question.title || ''}
      </span>
    </div>
    {!isReadingMode && (
      <div className="flex items-center shrink-0">
        {!editingSegment && segmentsAvailable && (
            <Button 
                variant="ghost" 
                size="icon_sm" 
                onClick={(e) => {e.stopPropagation(); onToggleExpansion();}}
                className="text-slate-300 hover:text-white hover:bg-white/15 h-7 w-7"
                aria-label={isExpanded ? getLocaleString('hide', currentLanguage) : getLocaleString('showText', currentLanguage)}
            >
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </Button>
        )}
        {!editingSegment && (
          <Button 
            variant="ghost" 
            size="icon_sm" 
            onClick={(e) => {
              e.stopPropagation();
              if(onEditQuestion) onEditQuestion(question);
            }}
            className="text-slate-300 hover:text-white hover:bg-white/15 h-7 w-7"
            aria-label={`${getLocaleString('editQuestion', currentLanguage)} ${question.title}`}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )}
  </div>
);


const QuestionBlock = React.memo(({
  question,
  segments,
  isActiveQuestion,
  isJumpTarget,
  isExpanded,
  onToggleExpansion,
  onActivate,
  onEditQuestion,
  currentLanguage,
  onSegmentClick,
  audioRef,
  onSaveEditedSegment, 
  activeSegmentTime,
  onAddQuestionFromSegment,
  utterances,
  mainPlayerIsPlaying,
  showTranscript,
  user,
  episodeSlug,
  isReadingMode,
  readingModeEditingActive,
  setReadingModeEditingSegmentRef,
  onOpenSpeakerAssignmentDialog,
  segmentToHighlight,
  transcriptLoading,
  questionRangeEndMs
}) => {
  const [visibleSegmentsCount, setVisibleSegmentsCount] = useState(isReadingMode ? Infinity : 5);
  const { editor, isAuthenticated, openAuthModal } = useEditorAuth();
  const { toast } = useToast();

  const {
    editingSegment,
    setEditingSegment, 
    editedText,
    setEditedText,
    showConfirmDialog,
    confirmDialogProps,
    textareaRef, 
    setTextareaRef: setInternalTextareaRef,
    handleEditSegment,
    handleSaveCurrentSegmentEdit,
    handleCancelEdit,
    performActionWithConfirmation,
    setShowConfirmDialog,
    isSaving,
    insertSegmentManually,
  } = useSegmentEditing(utterances || [], onSaveEditedSegment, audioRef, currentLanguage, user, episodeSlug);

  useEffect(() => {
    if (isExpanded && !editingSegment && !isReadingMode) {
      setVisibleSegmentsCount(5); 
    } else if (isReadingMode) {
      setVisibleSegmentsCount(Infinity);
    }
  }, [isExpanded, editingSegment, isReadingMode]);

  useEffect(() => {
    if (segmentToHighlight && isExpanded && segments.length > visibleSegmentsCount) {
      const segmentIndex = segments.findIndex(s => s.start === segmentToHighlight);
      if (segmentIndex !== -1) {
        const desiredVisible = Math.min(segments.length, segmentIndex + 6); // target + 5 after
        if (desiredVisible > visibleSegmentsCount) {
          setVisibleSegmentsCount(desiredVisible);
        }
      }
    }
  }, [segmentToHighlight, isExpanded, segments, visibleSegmentsCount]);
  
  const handleLoadMoreSegments = useCallback(() => {
    setVisibleSegmentsCount(prev => prev + 10);
  }, []);

  const isFullTranscriptBlock = Boolean(question?.is_full_transcript) || question?.id === 'full-transcript-virtual';
  const questionStartMs = (question?.time || 0) * 1000;
  const isActiveByTimeRange = (
    !isReadingMode &&
    !isFullTranscriptBlock &&
    typeof activeSegmentTime === 'number' &&
    activeSegmentTime >= questionStartMs &&
    (questionRangeEndMs === Infinity || typeof questionRangeEndMs === 'number') &&
    activeSegmentTime < (questionRangeEndMs === Infinity ? Number.POSITIVE_INFINITY : questionRangeEndMs)
  );

  // Highlight rules: when playing, highlight the question by time range [question.time, nextQuestion.time);
  // when paused/stopped, highlight the clicked/active question
  const shouldHighlight = !isReadingMode && ((mainPlayerIsPlaying && isActiveByTimeRange) || (!mainPlayerIsPlaying && isActiveQuestion));

  const blockHighlightClass = shouldHighlight && !isReadingMode
    ? (isJumpTarget && isExpanded ? 'ring-1 ring-purple-500/30' : 'bg-purple-600/10 ring-1 ring-purple-500/20')
    : '';

  const segmentsAvailableForHeader = segments && segments.length > 0 && showTranscript;
  const displaySegments = segments; 
  const displayVisibleCount = (editingSegment || (isReadingMode && readingModeEditingActive)) ? (segments ? segments.length : 0) : visibleSegmentsCount;

  const availableSpeakers = React.useMemo(() => {
    const set = new Set();
    (utterances || []).forEach(u => {
      const s = (u && u.speaker !== undefined && u.speaker !== null) ? String(u.speaker).trim() : '';
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [utterances]);

  const handleSetSegmentSpeaker = useCallback(async (segment, oldSpeakerId, newSpeakerId) => {
    // Check authentication
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    
    if (!Array.isArray(utterances) || !onSaveEditedSegment) return;
    const targetId = segment?.id || segment?.start;
    const newUtterances = (utterances || []).map(u => {
      if ((u.id || u.start) === targetId) {
        if (String(u.speaker || '') !== String(newSpeakerId || '')) {
          return { ...u, speaker: newSpeakerId };
        }
      }
      return u;
    });
    await onSaveEditedSegment(newUtterances, 'update', segment, { ...segment, speaker: newSpeakerId });
    
    // Save to edit history
    if (editor) {
      try {
        const segmentId = segment.id || segment.start;
        await saveEditToHistory({
          editorId: editor.id,
          editorEmail: editor.email,
          editorName: editor.name,
          editType: 'transcript',
          targetType: 'segment',
          targetId: `${episodeSlug}_segment_${segmentId}`,
          contentBefore: `Speaker: ${oldSpeakerId || 'None'}`,
          contentAfter: `Speaker: ${newSpeakerId || 'None'}`,
          filePath: null,
          metadata: {
            episodeSlug: episodeSlug,
            segmentId: segmentId,
            action: 'ChangeSpeaker',
            oldSpeaker: oldSpeakerId,
            newSpeaker: newSpeakerId,
            segmentStart: segment.start,
            segmentEnd: segment.end,
            timestamp: new Date().toISOString()
          }
        });
        console.log('[QuestionBlock] Speaker change saved to history');
      } catch (historyError) {
        console.error('[QuestionBlock] Failed to save edit history:', historyError);
        // Don't fail the whole operation if history save fails
      }
    }
  }, [utterances, onSaveEditedSegment, isAuthenticated, editor, episodeSlug, toast]);

  
  const handleEditSegmentInternal = useCallback((segment) => {
    if (isReadingMode && readingModeEditingActive) {
      handleEditSegment(segment);
      if (setReadingModeEditingSegmentRef) {
        setReadingModeEditingSegmentRef({ 
          segment, 
          setText: setEditedText,
          save: () => handleSaveCurrentSegmentEdit(segment.id || segment.start) 
        });
      }
    } else if (!isReadingMode) {
      handleEditSegment(segment);
    }
  }, [isReadingMode, readingModeEditingActive, handleEditSegment, setReadingModeEditingSegmentRef, setEditedText, handleSaveCurrentSegmentEdit]);

  const handleSaveEditInternal = useCallback(async () => {
    await handleSaveCurrentSegmentEdit(editingSegment?.id || editingSegment?.start);
    if (isReadingMode && readingModeEditingActive && setReadingModeEditingSegmentRef) {
       setReadingModeEditingSegmentRef(null);
    }
  }, [handleSaveCurrentSegmentEdit, editingSegment, isReadingMode, readingModeEditingActive, setReadingModeEditingSegmentRef]);

  const handleCancelEditInternal = useCallback(() => {
    handleCancelEdit();
    if (isReadingMode && readingModeEditingActive && setReadingModeEditingSegmentRef) {
       setReadingModeEditingSegmentRef(null);
    }
  }, [handleCancelEdit, isReadingMode, readingModeEditingActive, setReadingModeEditingSegmentRef]);

  return (
    <>
      <div className={`mb-0.5 rounded-md ${blockHighlightClass} ${isReadingMode ? 'reading-mode-block' : ''}`}>
        <QuestionBlockHeader
          question={question}
          isActiveQuestion={shouldHighlight}
          isExpanded={isExpanded || !!editingSegment} 
          editingSegment={editingSegment}
          onActivate={onActivate}
          onToggleExpansion={onToggleExpansion}
          onEditQuestion={onEditQuestion}
          currentLanguage={currentLanguage}
          segmentsAvailable={segmentsAvailableForHeader}
          isReadingMode={isReadingMode}
        />
        {(isExpanded || editingSegment) && displaySegments && displaySegments.length > 0 && showTranscript && (
          <div className="animate-expand-collapse overflow-hidden">
             <SegmentList
                segments={displaySegments}
                visibleSegmentsCount={displayVisibleCount}
                editingSegment={editingSegment}
                editedText={editedText}
                activeSegmentTime={activeSegmentTime}
                question={question}
                blockIndex={0} 
                currentLanguage={currentLanguage}
                onSegmentClick={onSegmentClick}
                handleEditSegment={handleEditSegmentInternal} 
                handleSaveCurrentSegmentEdit={handleSaveEditInternal}
                handleCancelEdit={handleCancelEditInternal}
                isSaving={isSaving}
                setEditedText={setEditedText}
                audioRef={audioRef}
                segmentPlaying={mainPlayerIsPlaying}
                onAddQuestionFromSegment={onAddQuestionFromSegment}
                performActionWithConfirmation={performActionWithConfirmation}
                setTextareaRef={setInternalTextareaRef}
                handleLoadMoreSegments={handleLoadMoreSegments}
                toggleTextExpansion={onToggleExpansion}
                isJumpTarget={isJumpTarget}
                isActiveQuestionBlock={shouldHighlight}
                isExpanded={isExpanded}
                isReadingMode={isReadingMode}
                readingModeEditingActive={readingModeEditingActive}
                onOpenSpeakerAssignmentDialog={onOpenSpeakerAssignmentDialog}
                onInsertManualSegment={insertSegmentManually}
                availableSpeakers={availableSpeakers}
                onSetSegmentSpeaker={handleSetSegmentSpeaker}
             />
           </div>
        )}
          {(isExpanded || editingSegment) && showTranscript && transcriptLoading && (
            <div 
              className={`text-xs pt-1.5 pl-1.5 mt-1 rounded-b-md pb-2 ${isReadingMode ? 'text-slate-600' : 'text-slate-400 border-t border-slate-700/20'}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                {getLocaleString('loadingTranscript', currentLanguage)}
              </span>
            </div>
          )}
      </div>

      {showConfirmDialog && (
        <EditConfirmationDialog
            isOpen={showConfirmDialog}
            onOpenChange={setShowConfirmDialog}
            title={confirmDialogProps.title}
            description={confirmDialogProps.description}
            onConfirm={confirmDialogProps.onConfirm}
            onCancel={() => setShowConfirmDialog(false)}
            actionType={confirmDialogProps.actionType}
            currentLanguage={currentLanguage}
        />
      )}
    </>
  );
});

export default QuestionBlock;