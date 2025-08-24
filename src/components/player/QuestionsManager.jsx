import React, { useMemo, useState, useEffect, useCallback } from 'react';
import QuestionBlock from '@/components/player/questions_manager_parts/QuestionBlock.jsx';

const QuestionsManager = ({
  questions,
  currentTime,
  duration,
  onQuestionsChange,
  onQuestionJump,
  episodeSlug,
  episodeDate,
  audioRef,
  mainPlayerIsPlaying,
  mainPlayerTogglePlayPause,
  mainPlayerSeekAudio,
  currentLanguage,
  episodeLang,
  episodeAudioUrl,
  jumpToQuestionId,
  showTranscript,
  user,
  disableAutomaticCollapse = false,
  onOpenSpeakerAssignmentDialog,
  transcriptUtterances,
  transcriptId,
  transcriptWords,
  segmentToHighlight,
  isLoading,
  transcriptLoading,
  onTranscriptLocalUpdate,
  onSaveEditedSegment,
  onAddQuestionFromSegment,
  onEditQuestion
}) => {
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [expandedById, setExpandedById] = useState({});

  const langForContent = episodeLang === 'all' ? currentLanguage : episodeLang;
  const utterances = transcriptUtterances || [];

  const questionSegmentsMap = useMemo(() => {
    if (!showTranscript || utterances.length === 0) return {};
    const map = {};
    const sorted = [...questions].sort((a, b) => a.time - b.time);
    sorted.forEach((q, idx) => {
      const startMs = (q.time || 0) * 1000;
      const next = sorted[idx + 1];
      const endMs = next ? (next.time * 1000) : (duration ? duration * 1000 : Infinity);
      map[q.id] = utterances
        .filter(u => typeof u.start === 'number' && u.start >= startMs && u.start < endMs)
        .sort((a, b) => a.start - b.start);
    });
    return map;
  }, [questions, utterances, duration, showTranscript]);

  const questionEndTimeMsMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(questions) || questions.length === 0) return map;
    const sorted = [...questions].sort((a, b) => a.time - b.time);
    sorted.forEach((q, idx) => {
      const next = sorted[idx + 1];
      const endSec = next ? next.time : (typeof duration === 'number' ? duration : Infinity);
      map[q.id] = (endSec === Infinity) ? Infinity : endSec * 1000;
    });
    return map;
  }, [questions, duration]);

  useEffect(() => {
    if (!disableAutomaticCollapse && Array.isArray(questions) && questions.length > 0) {
      const playingQ = questions.find(q => currentTime >= q.time && (questions.indexOf(q) === questions.length - 1 || currentTime < questions[questions.indexOf(q) + 1].time));
      if (playingQ && playingQ.id !== activeQuestionId) {
        setActiveQuestionId(playingQ.id);
        setExpandedById(prev => ({ ...prev, [playingQ.id]: true }));
      }
    }
  }, [currentTime, questions, activeQuestionId, disableAutomaticCollapse]);

  useEffect(() => {
    if (!jumpToQuestionId) return;
    const q = questions.find(x => String(x.id) === String(jumpToQuestionId));
    if (q) {
      setActiveQuestionId(q.id);
      setExpandedById(prev => ({ ...prev, [q.id]: true }));
      const el = document.getElementById(`question-block-${q.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [jumpToQuestionId, questions]);

  const toggleQuestionExpansion = useCallback((id) => {
    setExpandedById(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleActivateQuestion = useCallback((q) => {
    onQuestionJump(q.time, `question-${q.id}`, true);
    setActiveQuestionId(q.id);
    if (!disableAutomaticCollapse) setExpandedById({ [q.id]: true });
  }, [onQuestionJump, disableAutomaticCollapse]);

  const handleSegmentClick = useCallback((timeInSeconds) => {
    if (mainPlayerSeekAudio) mainPlayerSeekAudio(timeInSeconds, true);
  }, [mainPlayerSeekAudio]);

  const displayableQuestions = useMemo(() => {
    if (!Array.isArray(questions)) return [];
    const sorted = [...questions].sort((a, b) => a.time - b.time);
    
    // Фильтруем вопросы без заголовка, кроме специальных блоков
    const filteredQuestions = sorted.filter(q => {
      // Пропускаем специальные блоки (intro, full_transcript)
      if (q.is_intro || q.is_full_transcript || q.id === 'intro-virtual') {
        return true;
      }
      // Пропускаем вопросы с заголовком (не пустой и не только пробелы)
      return q.title && q.title.trim() !== '';
    });
    
    const fullTranscript = (!filteredQuestions.some(q => q.id !== 'intro-virtual') && utterances.length > 0 && showTranscript)
      ? [{ id: 'full-transcript-virtual', title: '', time: 0, is_full_transcript: true, is_intro: false, lang: langForContent }]
      : [];
    return [...fullTranscript, ...filteredQuestions];
  }, [questions, utterances, showTranscript, langForContent]);

  return (
    <div className="mt-1">
      {displayableQuestions.map((q) => (
        <QuestionBlock
          key={q.id}
          id={`question-block-${q.id}`}
          question={q}
          segments={questionSegmentsMap[q.id] || []}
          isActiveQuestion={activeQuestionId === q.id}
          isJumpTarget={segmentToHighlight && (questionSegmentsMap[q.id] || []).some(s => s.start === segmentToHighlight)}
          isExpanded={!!expandedById[q.id]}
          onToggleExpansion={() => toggleQuestionExpansion(q.id)}
          onActivate={() => handleActivateQuestion(q)}
          onEditQuestion={() => onEditQuestion(q)}
          currentLanguage={currentLanguage}
          onSegmentClick={handleSegmentClick}
          audioRef={audioRef}
          onSaveEditedSegment={onSaveEditedSegment}
          activeSegmentTime={currentTime * 1000}
          onAddQuestionFromSegment={onAddQuestionFromSegment}
          utterances={utterances}
          mainPlayerIsPlaying={mainPlayerIsPlaying}
          showTranscript={showTranscript}
          user={user}
          episodeSlug={episodeSlug}
          isReadingMode={false}
          readingModeEditingActive={false}
          setReadingModeEditingSegmentRef={null}
          onOpenSpeakerAssignmentDialog={onOpenSpeakerAssignmentDialog}
          segmentToHighlight={segmentToHighlight}
          transcriptLoading={transcriptLoading}
          questionRangeEndMs={questionEndTimeMsMap[q.id]}
        />
      ))}
    </div>
  );
};

export default QuestionsManager;


