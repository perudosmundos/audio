import { useState, useCallback } from 'react';
import { useEditorAuth } from '@/contexts/EditorAuthContext';

const useQuestionManagement = (
  currentTime,
  currentLanguage,
  audioRef,
  mainPlayerSeekAudio,
  duration,
  episodeSlug, 
  episodeDate,
  episodeLang // Added episodeLang
) => {
  const { isAuthenticated, openAuthModal } = useEditorAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBatchAddDialogOpen, setIsBatchAddDialogOpen] = useState(false);
  const [currentQuestionData, setCurrentQuestionData] = useState(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [dialogTime, setDialogTime] = useState(0);
  const [questionLang, setQuestionLang] = useState(currentLanguage);
  const [batchQuestionsText, setBatchQuestionsText] = useState('');
  const [initialDialogTimeSet, setInitialDialogTimeSet] = useState(false);
  const [isAddQuestionFromSegmentDialogOpen, setIsAddQuestionFromSegmentDialogOpen] = useState(false);
  const [segmentForQuestion, setSegmentForQuestion] = useState(null);


  const openEditDialog = useCallback((question) => {
    // Check authentication before opening edit dialog
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    let langForDialog = question.lang || currentLanguage;
    if (currentLanguage === 'en' && episodeLang === 'es' && question.lang !== 'en') {
      langForDialog = 'en';
    }

    setCurrentQuestionData({ ...question, time: parseFloat(question.time.toFixed(2)) });
    setDialogTime(parseFloat(question.time.toFixed(2)));
    setQuestionLang(langForDialog);
    setIsAddingQuestion(false);
    setIsEditDialogOpen(true);
    setInitialDialogTimeSet(true);
  }, [currentLanguage, episodeLang, isAuthenticated, openAuthModal]);

  const openAddDialog = useCallback(() => {
    // Check authentication before opening add dialog
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    const newTime = parseFloat(audioRef.current?.currentTime.toFixed(2) || currentTime.toFixed(2));
    let langForNewQuestion = currentLanguage;
    if (currentLanguage === 'en' && episodeLang === 'es') {
      langForNewQuestion = 'en';
    }
    setCurrentQuestionData({ id: null, time: newTime, title: '', episode_slug: episodeSlug, lang: langForNewQuestion });
    setDialogTime(newTime);
    setQuestionLang(langForNewQuestion);
    setIsAddingQuestion(true);
    setIsEditDialogOpen(true);
    setInitialDialogTimeSet(false);
  }, [currentTime, currentLanguage, audioRef, episodeSlug, episodeLang, isAuthenticated, openAuthModal]);

  const openBatchAddDialog = useCallback(() => {
    setIsBatchAddDialogOpen(true);
  }, []);
  
  const openAddQuestionFromSegmentDialog = useCallback((segment) => {
    // Check authentication before opening segment question dialog
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    setSegmentForQuestion(segment);
    setIsAddQuestionFromSegmentDialogOpen(true);
  }, [isAuthenticated, openAuthModal]);

  const closeDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setInitialDialogTimeSet(false);
  }, []);

  const closeBatchAddDialog = useCallback(() => {
    setIsBatchAddDialogOpen(false);
    setBatchQuestionsText('');
  }, []);
  
  const closeAddQuestionFromSegmentDialog = useCallback(() => {
    setIsAddQuestionFromSegmentDialogOpen(false);
    setSegmentForQuestion(null);
  }, []);

  const handleDialogTimeInputChange = useCallback((e) => {
    const parts = e.target.value.split(':').map(Number);
    let newTimeValue = 0;
    if (parts.length === 3) newTimeValue = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) newTimeValue = parts[0] * 60 + parts[1];
    else if (parts.length === 1 && !isNaN(parts[0])) newTimeValue = parts[0];
    else { setDialogTime(NaN); return; }

    if (!isNaN(newTimeValue) && newTimeValue >= 0 && newTimeValue <= (duration || Infinity)) {
      setDialogTime(newTimeValue);
      setCurrentQuestionData(prev => ({ ...prev, time: newTimeValue }));
      if (mainPlayerSeekAudio) mainPlayerSeekAudio(newTimeValue, false);
    } else if (e.target.value === "") {
      setDialogTime(0);
      setCurrentQuestionData(prev => ({ ...prev, time: 0 }));
    }
  }, [duration, mainPlayerSeekAudio]);

  const handleDialogTimeAdjust = useCallback((amount) => {
    const newTime = Math.max(0, Math.min(duration || Infinity, dialogTime + amount));
    setDialogTime(newTime);
    setCurrentQuestionData(prev => ({ ...prev, time: newTime }));
    if (mainPlayerSeekAudio) mainPlayerSeekAudio(newTime, true);
  }, [dialogTime, duration, mainPlayerSeekAudio]);

  return {
    isEditDialogOpen,
    isBatchAddDialogOpen,
    currentQuestionData,
    isAddingQuestion,
    dialogTime,
    questionLang,
    batchQuestionsText,
    isAddQuestionFromSegmentDialogOpen,
    segmentForQuestion,
    openEditDialog,
    openAddDialog,
    openBatchAddDialog,
    closeDialog,
    closeBatchAddDialog,
    handleDialogTimeInputChange,
    handleDialogTimeAdjust,
    setCurrentQuestionData,
    setBatchQuestionsText,
    setDialogTime,
    setQuestionLang,
    openAddQuestionFromSegmentDialog,
    closeAddQuestionFromSegmentDialog,
  };
};

export default useQuestionManagement;