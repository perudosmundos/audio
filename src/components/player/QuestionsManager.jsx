import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PlusCircle, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocaleString } from '@/lib/locales';
import QuestionBlock from '@/components/player/questions_manager_parts/QuestionBlock.jsx';
import AddQuestionDialog from '@/components/transcript/AddQuestionDialog.jsx'; 
import EditQuestionDialog from '@/components/player/questions_manager_parts/EditQuestionDialog.jsx';
import EditConfirmationDialog from '@/components/player/questions_manager_parts/EditConfirmationDialog.jsx';
import AddQuestionFromSegmentDialog from '@/components/player/questions_manager_parts/AddQuestionFromSegmentDialog.jsx';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import TranscriptSearch from '@/components/player/questions_manager_parts/TranscriptSearch.jsx';
import { processTranscriptData } from '@/hooks/transcript/transcriptProcessingUtils';


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
  segmentToHighlight
}) => {
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  
  const [isAddQuestionGeneralDialogOpen, setIsAddQuestionGeneralDialogOpen] = useState(false);
  const [addQuestionDialogInitialTime, setAddQuestionDialogInitialTime] = useState(0);
  const [isAddQuestionFromSegmentDialogOpen, setIsAddQuestionFromSegmentDialogOpen] = useState(false);
  const [segmentForNewQuestion, setSegmentForNewQuestion] = useState(null);

  const [editingQuestion, setEditingQuestion] = useState(null);
  const [dialogTime, setDialogTime] = useState(0);
  const [dialogLang, setDialogLang] = useState(currentLanguage);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogProps, setConfirmDialogProps] = useState({});
  const { toast } = useToast();
  const questionsContainerRef = useRef(null);
  const prevSegmentToHighlightRef = useRef(null);

  const langForContent = episodeLang === 'all' ? currentLanguage : episodeLang;
  const localTranscriptUtterances = useMemo(() => transcriptUtterances || [], [transcriptUtterances]);
  
  const handleSaveEditedSegment = useCallback(async (updatedUtterances) => {
     if (!episodeSlug || !langForContent) {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: "Episode slug or language not defined for saving transcript.", variant: 'destructive' });
        return;
    }
    
    const { data: existingTranscript, error: fetchError } = await supabase
      .from('transcripts')
      .select('id, transcript_data, edited_transcript_data')
      .eq('episode_slug', episodeSlug)
      .eq('lang', langForContent)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error("Error fetching transcript for update:", fetchError);
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorFetchingTranscript', currentLanguage, { errorMessage: fetchError.message }), variant: 'destructive' });
        return;
    }

    const baseData = existingTranscript?.edited_transcript_data || existingTranscript?.transcript_data || {};
    const processedTranscript = processTranscriptData({ ...baseData, utterances: updatedUtterances, words: baseData.words });
    const newEditedTranscriptData = {
      ...baseData,
      utterances: processedTranscript.utterances,
      text: processedTranscript.utterances.map(u => u.text).join(' '),
      words: baseData.words || [] 
    };

    try {
        let updateResult;
        if (existingTranscript?.id) {
            updateResult = await supabase
                .from('transcripts')
                .update({ edited_transcript_data: newEditedTranscriptData, status: 'completed' })
                .eq('id', existingTranscript.id);
        } else {
             updateResult = await supabase
                .from('transcripts')
                .insert([{ 
                    episode_slug: episodeSlug, 
                    lang: langForContent, 
                    edited_transcript_data: newEditedTranscriptData, 
                    status: 'completed', 
                    transcript_data: baseData, 
                }]);
        }

        const { error: updateError } = updateResult;

        if (updateError) {
            console.error("Error updating segment in DB:", updateError);
            toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorUpdatingSegment', currentLanguage, { errorMessage: updateError.message }), variant: 'destructive' });
        } else {
            toast({ title: getLocaleString('transcriptSegmentUpdatedTitle', currentLanguage), description: getLocaleString('transcriptSegmentUpdatedDesc', currentLanguage), variant: "default" });
            if (typeof onQuestionsChange === 'function') { 
                onQuestionsChange('transcript_updated');
            }
        }
    } catch (err) {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: getLocaleString('errorUpdatingSegment', currentLanguage, { errorMessage: err.message }), variant: 'destructive' });
    }
  }, [episodeSlug, langForContent, currentLanguage, toast, onQuestionsChange]);


  const questionSegmentsMap = useMemo(() => {
    if (!showTranscript || !localTranscriptUtterances || localTranscriptUtterances.length === 0) return {};
    const map = {};
    const sortedQuestions = [...questions].sort((a, b) => a.time - b.time);

    sortedQuestions.forEach((question, index) => {
      const questionStartMs = question.time * 1000;
      const nextQuestion = sortedQuestions[index + 1];
      const questionEndMs = nextQuestion ? (nextQuestion.time * 1000) : (duration * 1000 || Infinity);
      
      map[question.id] = localTranscriptUtterances.filter(
        utt => utt.start >= questionStartMs && utt.start < questionEndMs
      ).sort((a, b) => a.start - b.start);
    });
    return map;
  }, [questions, duration, localTranscriptUtterances, showTranscript]);
  

  useEffect(() => {
    if (jumpToQuestionId) {
      const targetQuestion = questions.find(q => String(q.id) === String(jumpToQuestionId));
      if (targetQuestion) {
        setActiveQuestion(targetQuestion);
        setExpandedQuestions(prev => ({ ...prev, [targetQuestion.id]: true }));
        const element = document.getElementById(`question-block-${targetQuestion.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [jumpToQuestionId, questions]);

  useEffect(() => {
    if (!disableAutomaticCollapse) {
      const currentQ = questions.find(q => currentTime >= q.time && (questions.indexOf(q) === questions.length - 1 || currentTime < questions[questions.indexOf(q) + 1].time));
      if (currentQ && (!activeQuestion || activeQuestion.id !== currentQ.id)) {
        setActiveQuestion(currentQ);
        setExpandedQuestions(prev => ({ [currentQ.id]: true }));
      }
    }
  }, [currentTime, questions, activeQuestion, disableAutomaticCollapse]);

  useEffect(() => {
    console.log('QuestionsManager: segmentToHighlight effect triggered', { 
      segmentToHighlight, 
      prevSegmentToHighlight: prevSegmentToHighlightRef.current,
      questionsCount: questions?.length,
      questionSegmentsMapKeys: Object.keys(questionSegmentsMap)
    });
    
    if (segmentToHighlight && segmentToHighlight !== prevSegmentToHighlightRef.current) {
      console.log('QuestionsManager: Looking for question with segment', segmentToHighlight);
      
      const questionWithSegment = questions.find(q => {
        const segments = questionSegmentsMap[q.id];
        const hasSegment = segments && segments.some(s => s.start === segmentToHighlight);
        if (hasSegment) {
          console.log('QuestionsManager: Found question with segment', { questionId: q.id, questionTitle: q.title });
        }
        return hasSegment;
      });

      if (questionWithSegment) {
        console.log('QuestionsManager: Setting active question and expanding', questionWithSegment.id);
        setActiveQuestion(questionWithSegment);
        setExpandedQuestions(prev => ({ ...prev, [questionWithSegment.id]: true }));
        
        setTimeout(() => {
          const segmentElementId = `segment-${segmentToHighlight}`;
          const segmentElement = document.getElementById(segmentElementId);
          console.log('QuestionsManager: Looking for segment element', segmentElementId, !!segmentElement);
          
          if (segmentElement) {
            console.log('QuestionsManager: Scrolling to segment element');
            segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
             const questionElement = document.getElementById(`question-block-${questionWithSegment.id}`);
             console.log('QuestionsManager: Segment not found, scrolling to question element', `question-block-${questionWithSegment.id}`, !!questionElement);
             if (questionElement) {
                questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
          }
        }, 100); 
      } else {
        console.log('QuestionsManager: No question found with segment', segmentToHighlight);
      }
      prevSegmentToHighlightRef.current = segmentToHighlight;
    }
  }, [segmentToHighlight, questions, questionSegmentsMap]);

  const toggleQuestionExpansion = useCallback((questionId) => {
    setExpandedQuestions(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);
  
  const handleActivateQuestion = useCallback((question) => {
    onQuestionJump(question.time, `question-${question.id}`, true); 
    setActiveQuestion(question);
    if (!disableAutomaticCollapse) {
      setExpandedQuestions({ [question.id]: true });
    }
  }, [onQuestionJump, disableAutomaticCollapse]);

  const handleSegmentClick = useCallback((timeInSeconds, segment) => {
    if (mainPlayerSeekAudio) mainPlayerSeekAudio(timeInSeconds, true);
  }, [mainPlayerSeekAudio]);

  const handleAddQuestion = useCallback(() => {
    setAddQuestionDialogInitialTime(currentTime);
    setIsAddQuestionGeneralDialogOpen(true);
  }, [currentTime]);
  
  const handleAddQuestionFromSegment = useCallback((segment) => {
    setSegmentForNewQuestion(segment);
    setIsAddQuestionFromSegmentDialogOpen(true);
  }, []);

  const handleSaveNewQuestion = useCallback((title, time, isFullTranscript = false, isIntro = false) => {
    onQuestionsChange('add', { title, time, lang: langForContent, isFullTranscript, isIntro });
    setIsAddQuestionGeneralDialogOpen(false);
    setIsAddQuestionFromSegmentDialogOpen(false);
    setSegmentForNewQuestion(null);
  }, [onQuestionsChange, langForContent]);

  const handleEditQuestion = useCallback((question) => {
    setEditingQuestion(question);
    setDialogTime(question.time);
    setDialogLang(question.lang || langForContent);
  }, [langForContent]);

  const handleSaveEditedQuestion = useCallback((questionData) => {
    const isVirtualIntro = questionData.id === 'intro-virtual';
    if (isVirtualIntro) {
        onQuestionsChange('add', { 
            title: questionData.title, 
            time: 0, 
            lang: questionData.lang || langForContent, 
            isIntro: true, 
            isFullTranscript: false 
        });
    } else {
        onQuestionsChange('update', questionData);
    }
    setEditingQuestion(null);
  }, [onQuestionsChange, langForContent]);

  const handleDeleteQuestion = useCallback((id) => {
    setConfirmDialogProps({
      title: getLocaleString('confirmDeleteQuestionTitle', currentLanguage),
      description: getLocaleString('confirmDeleteQuestionDesc', currentLanguage),
      onConfirm: () => {
        onQuestionsChange('delete', { id });
        setShowConfirmDialog(false);
        setEditingQuestion(null);
      },
      actionType: 'destructive'
    });
    setShowConfirmDialog(true);
  }, [onQuestionsChange, currentLanguage]);

  const handleDialogTimeAdjust = useCallback((amount) => {
    setDialogTime(prev => Math.max(0, Math.min(duration || Infinity, prev + amount)));
  }, [duration]);
  
  const handleDialogTimeInputChange = useCallback((e) => {
    const parts = e.target.value.split(':').map(Number);
    let newTimeValue = 0;
    if (parts.length === 3) newTimeValue = parts[0]*3600 + parts[1]*60 + parts[2];
    else if (parts.length === 2) newTimeValue = parts[0]*60 + parts[1];
    else if (parts.length === 1 && !isNaN(parts[0])) newTimeValue = parts[0];
    else { setDialogTime(NaN); return; }
    if (!isNaN(newTimeValue) && newTimeValue >= 0 && newTimeValue <= (duration || Infinity)) {
        setDialogTime(newTimeValue);
    } else if (e.target.value === "") {
        setDialogTime(0);
    }
  },[duration]);


  const filteredQuestions = useMemo(() => {
    if (!searchTerm) return questions;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return questions.filter(q => 
      (q.title || '').toLowerCase().includes(lowerSearchTerm) || 
      (questionSegmentsMap[q.id] || []).some(s => (s.text || '').toLowerCase().includes(lowerSearchTerm))
    );
  }, [questions, searchTerm, questionSegmentsMap]);

  const hasActualQuestions = questions && questions.some(q => q.id !== 'intro-virtual');
  const hasTranscript = localTranscriptUtterances && localTranscriptUtterances.length > 0 && showTranscript;
  
  const virtualFullTranscriptQuestion = useMemo(() => {
    if (!hasTranscript || hasActualQuestions) return null;
    return {
      id: 'full-transcript-virtual',
      title: getLocaleString('fullTranscript', currentLanguage),
      time: 0,
      is_full_transcript: true,
      is_intro: false,
      lang: langForContent
    };
  }, [hasTranscript, hasActualQuestions, currentLanguage, langForContent]);

  const displayableQuestions = useMemo(() => {
    let result = [];
    const sortedFilteredQuestions = [...filteredQuestions].sort((a,b) => a.time - b.time);

    if (virtualFullTranscriptQuestion) {
      result.push(virtualFullTranscriptQuestion);
    } else {
      const introBlock = sortedFilteredQuestions.find(q => q.is_intro && q.time === 0);
      const fullTranscriptBlock = sortedFilteredQuestions.find(q => q.is_full_transcript);
      const regularQs = sortedFilteredQuestions.filter(q => !q.is_intro && !q.is_full_transcript);
      
      if (introBlock) result.push(introBlock);
      else if (!sortedFilteredQuestions.some(q => q.time === 0)) { 
        // If no questions and no intro, and not showing full transcript as a question
        // This case is handled by hasActualQuestions check below
      }
      result = result.concat(regularQs);
      if (fullTranscriptBlock && fullTranscriptBlock.id !== introBlock?.id) result.push(fullTranscriptBlock);
    }
    return result.filter(Boolean);
  }, [filteredQuestions, virtualFullTranscriptQuestion]);

  const questionSegmentsMapWithVirtual = useMemo(() => {
    if (virtualFullTranscriptQuestion) {
      return {
        ...questionSegmentsMap,
        [virtualFullTranscriptQuestion.id]: localTranscriptUtterances.sort((a, b) => a.start - b.start)
      };
    }
    return questionSegmentsMap;
  }, [questionSegmentsMap, virtualFullTranscriptQuestion, localTranscriptUtterances]);


  if (!hasActualQuestions && !hasTranscript && !filteredQuestions.some(q=> q.id === 'intro-virtual')) {
    return (
      <div className="text-center py-6 text-slate-400">
        <ListFilter className="mx-auto h-12 w-12 text-slate-500 mb-3" />
        <p className="text-lg font-semibold">{getLocaleString('noQuestionsOrTranscriptTitle', currentLanguage)}</p>
        <p className="text-sm">{getLocaleString('noQuestionsOrTranscriptDesc', currentLanguage)}</p>
         {user && user.id && (
            <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-2">
              <Button onClick={handleAddQuestion} className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto">
                <PlusCircle size={18} className="mr-2" /> {getLocaleString('addQuestion', currentLanguage)}
              </Button>
            </div>
        )}
      </div>
    );
  }
  
  const renderQuestionBlock = (question, index, isSpecialBlock = false) => (
    <QuestionBlock
      key={question.id}
      id={`question-block-${question.id}`}
      question={question}
      segments={questionSegmentsMapWithVirtual[question.id] || []}
      isActiveQuestion={activeQuestion?.id === question.id}
      isJumpTarget={jumpToQuestionId === String(question.id) || (segmentToHighlight && (questionSegmentsMapWithVirtual[question.id] || []).some(s => s.start === segmentToHighlight))}
      isExpanded={(!!expandedQuestions[question.id] || (isSpecialBlock && displayableQuestions.length === 1))}
      onToggleExpansion={() => toggleQuestionExpansion(question.id)}
      onActivate={() => handleActivateQuestion(question)}
      onEditQuestion={handleEditQuestion}
      currentLanguage={currentLanguage}
      onSegmentClick={handleSegmentClick}
      audioRef={audioRef}
      onSaveEditedSegment={handleSaveEditedSegment}
      activeSegmentTime={currentTime * 1000}
      onAddQuestionFromSegment={handleAddQuestionFromSegment}
      utterances={localTranscriptUtterances}
      mainPlayerIsPlaying={mainPlayerIsPlaying}
      showTranscript={showTranscript}
      user={user}
      episodeSlug={episodeSlug}
      onOpenSpeakerAssignmentDialog={onOpenSpeakerAssignmentDialog}
      segmentToHighlight={segmentToHighlight}
    />
  );

  return (
    <div className="mt-1" ref={questionsContainerRef}>
       {user && user.id && hasActualQuestions && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4 items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
            <h2 className="text-lg font-semibold text-purple-300">{getLocaleString('questions', currentLanguage)}</h2>
            <div className="flex gap-2">
                <TranscriptSearch 
                    searchTerm={searchTerm} 
                    onSearchTermChange={setSearchTerm} 
                    currentLanguage={currentLanguage} 
                />
                <Button onClick={handleAddQuestion} className="bg-purple-600 hover:bg-purple-700">
                    <PlusCircle size={18} className="mr-2" /> {getLocaleString('addQuestion', currentLanguage)}
                </Button>
            </div>
        </div>
      )}
      
      <>
        {displayableQuestions.map((question, index) => renderQuestionBlock(question, index, question.id === virtualFullTranscriptQuestion?.id))}
      </>

      {isAddQuestionGeneralDialogOpen && (
        <AddQuestionDialog
          isOpen={isAddQuestionGeneralDialogOpen}
          onClose={() => setIsAddQuestionGeneralDialogOpen(false)}
          onSave={handleSaveNewQuestion}
          maxDuration={duration}
          currentLanguage={currentLanguage}
          initialTime={addQuestionDialogInitialTime}
          episodeDate={episodeDate}
          segment={null}
          audioRef={audioRef}
          mainPlayerIsPlaying={mainPlayerIsPlaying}
          mainPlayerTogglePlayPause={mainPlayerTogglePlayPause}
          mainPlayerSeekAudio={mainPlayerSeekAudio}
        />
      )}
      {isAddQuestionFromSegmentDialogOpen && segmentForNewQuestion && (
        <AddQuestionFromSegmentDialog
          isOpen={isAddQuestionFromSegmentDialogOpen}
          onClose={() => {setIsAddQuestionFromSegmentDialogOpen(false); setSegmentForNewQuestion(null);}}
          onSave={handleSaveNewQuestion}
          segment={segmentForNewQuestion}
          currentLanguage={currentLanguage}
          audioRef={audioRef}
          mainPlayerIsPlaying={mainPlayerIsPlaying}
          mainPlayerTogglePlayPause={mainPlayerTogglePlayPause}
          mainPlayerSeekAudio={mainPlayerSeekAudio}
          duration={duration}
        />
      )}

      {editingQuestion && (
        <EditQuestionDialog
          isOpen={!!editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={handleSaveEditedQuestion}
          onDelete={handleDeleteQuestion}
          questionData={editingQuestion}
          duration={duration}
          currentLanguage={currentLanguage}
          episodeDate={episodeDate}
          dialogTime={dialogTime}
          onDialogTimeChange={setDialogTime}
          onDialogTimeAdjust={handleDialogTimeAdjust}
          onDialogTimeInputChange={handleDialogTimeInputChange}
          questionLang={dialogLang}
          onQuestionLangChange={setDialogLang}
          mainPlayerIsPlaying={mainPlayerIsPlaying}
          mainPlayerTogglePlayPause={mainPlayerTogglePlayPause}
          mainPlayerSeekAudio={mainPlayerSeekAudio}
        />
      )}
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
    </div>
  );
};

export default QuestionsManager;
