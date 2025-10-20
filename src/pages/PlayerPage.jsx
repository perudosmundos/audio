import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import PodcastPlayer from '@/components/PodcastPlayer'; 
import QuestionsManager from '@/components/player/QuestionsManager';
import FloatingPlayerControls from '@/components/player/FloatingPlayerControls';
import { getLocaleString } from '@/lib/locales';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatShortDate } from '@/lib/utils';
import useOfflineEpisodeData from '@/hooks/useOfflineEpisodeData';
import usePlayerInteractions from '@/hooks/player_page/usePlayerInteractions';
import useSupabaseSubscriptions from '@/hooks/player_page/useSupabaseSubscriptions';
import useSpeakerAssignment from '@/hooks/player/useSpeakerAssignment'; 
import SpeakerAssignmentDialog from '@/components/transcript/SpeakerAssignmentDialog';
import useQuestionManagement from '@/hooks/useQuestionManagement';
import AddQuestionFromSegmentDialog from '@/components/player/questions_manager_parts/AddQuestionFromSegmentDialog';
import AddQuestionDialog from '@/components/transcript/AddQuestionDialog';
import { useEditorAuth } from '@/contexts/EditorAuthContext';
import { saveEditToHistory } from '@/services/editHistoryService';


const PlayerPage = ({ currentLanguage: appCurrentLanguage, user }) => {
  const { episodeSlug } = useParams(); 
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  const { editor, isAuthenticated, openAuthModal } = useEditorAuth();
  
  // Read language from URL parameter, fallback to app language
  const urlParams = new URLSearchParams(location.search);
  const urlLanguage = urlParams.get('lang');
  const currentLanguage = urlLanguage || appCurrentLanguage;

  // Update global app language if URL parameter is present and different
  useEffect(() => {
    if (urlLanguage && urlLanguage !== appCurrentLanguage) {
      // Update localStorage to persist the language change
      localStorage.setItem('podcastLang', urlLanguage);
      
      // Force page reload to update global app state
      window.location.reload();
    }
  }, [urlLanguage, appCurrentLanguage]);

  const audioRef = useRef(null); 
  const [showFloatingControls, setShowFloatingControls] = useState(false);
  const playerControlsContainerRef = useRef(null);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const {
    episodeData,
    questions,
    transcript,
    loading,
    questionsLoading,
    transcriptLoading,
    error,
    questionsUpdatedId,
    isOfflineMode,
    saveEditedTranscript,
    saveQuestions,
    refreshAllData,
    preloadAudio,
    fetchTranscriptForEpisode,
    fetchQuestionsForEpisode,
    setTranscript,
  } = useOfflineEpisodeData(episodeSlug, currentLanguage, toast);

  // Слушаем обновления эпизодов после перевода
  useEffect(() => {
    if (!refreshAllData) return; // Защита от вызова до инициализации

    const handleEpisodeUpdate = (event) => {
      const { slug, lang, episode } = event.detail;
      
      // Если это текущий эпизод, обновляем данные
      if (slug === episodeSlug && lang === currentLanguage) {
        console.log('[PlayerPage] Episode updated after translation, refreshing data');
        refreshAllData();
      }
    };

    window.addEventListener('episodeUpdated', handleEpisodeUpdate);
    
    return () => {
      window.removeEventListener('episodeUpdated', handleEpisodeUpdate);
    };
  }, [episodeSlug, currentLanguage, refreshAllData]);

  const {
    jumpDetails,
    showFloatingControls: playerShowFloatingControls,
    playerState,
    showTranscriptUI,
    handleSeekToTime,
    handlePlayerStateChange,
    handleToggleShowTranscript,
    handleFloatingPlayerSkip,
    handleFloatingPlayPause,
    setShowFloatingControls: setPlayerShowFloatingControls
  } = usePlayerInteractions(audioRef, playerControlsContainerRef, episodeSlug, questions, true); 

  // Отключаем Supabase subscriptions в офлайн режиме
  useSupabaseSubscriptions(
    episodeSlug,
    episodeData,
    currentLanguage,
    fetchQuestionsForEpisode,
    fetchTranscriptForEpisode,
    isOfflineMode // Передаем офлайн статус
  );

  const {
    isAddQuestionFromSegmentDialogOpen,
    segmentForQuestion,
    openAddQuestionFromSegmentDialog,
    closeAddQuestionFromSegmentDialog
  } = useQuestionManagement(
    playerState.currentTime,
    currentLanguage,
    audioRef,
    handleSeekToTime,
    playerState.duration,
    episodeData?.slug,
    episodeData?.date,
    episodeData?.lang
  );
  
  useEffect(() => {
    const handleScroll = () => {
      const ref = playerControlsContainerRef.current;
      if (ref) {
        const rect = ref.getBoundingClientRect();
        if (rect.bottom < 0) {
          setShowFloatingControls(true);
        } else {
          setShowFloatingControls(false);
        }
      } else {
        setShowFloatingControls(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleQuestionUpdate = useCallback(async (action, questionData) => {
    if (!episodeData || !episodeData.slug) return;
    
    // Special handling for virtual blocks
    if (questionData.id === 'intro-virtual') {
      // Create or update a real intro question (time locked to 0)
      const langForQuestions = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;
      const { data: existingIntro, error: fetchErr } = await supabase
        .from('questions')
        .select('*')
        .eq('episode_slug', episodeData.slug)
        .eq('lang', langForQuestions)
        .eq('is_intro', true)
        .eq('time', 0)
        .maybeSingle();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: fetchErr.message, variant: 'destructive' });
        return;
      }

      const payload = {
        episode_slug: episodeData.slug,
        time: 0,
        title: questionData.title,
        lang: langForQuestions,
        is_intro: true,
        is_full_transcript: false
      };

      let dbError;
      if (existingIntro && existingIntro.id) {
        const { error } = await supabase.from('questions').update({ title: payload.title }).eq('id', existingIntro.id);
        dbError = error;
      } else {
        const { error } = await supabase.from('questions').insert(payload).select().single();
        dbError = error;
      }

      if (dbError) {
        toast({ title: getLocaleString('errorGeneric', currentLanguage), description: dbError.message, variant: 'destructive' });
      } else {
        fetchQuestionsForEpisode(episodeData.slug, langForQuestions);
      }
      return;
    }

    if (questionData.id === 'full-transcript-virtual') {
      console.warn('Attempted to modify virtual question:', questionData.id);
      return;
    }
    
    let dbError;
    const langForQuestions = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;

    if (action === 'add') {
      const questionPayload = { 
        episode_slug: episodeData.slug, 
        time: questionData.time, 
        title: questionData.title, 
        lang: questionData.lang || langForQuestions,
        is_intro: questionData.isIntro || false,
        is_full_transcript: questionData.isFullTranscript || false
      };
      const { error } = await supabase.from('questions').insert(questionPayload).select().single();
      dbError = error;
    } else if (action === 'update') {
      const questionPayload = { 
        title: questionData.title, 
        time: questionData.time, 
        lang: questionData.lang || langForQuestions,
        is_intro: questionData.isIntro || false,
        is_full_transcript: questionData.isFullTranscript || false
      };
      const { error } = await supabase.from('questions').update(questionPayload).eq('id', questionData.id).select().single();
      dbError = error;
    } else if (action === 'delete') {
      const { error } = await supabase.from('questions').delete().eq('id', questionData.id);
      dbError = error;
    }

    if (dbError) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: dbError.message, variant: 'destructive' });
    } else {
      // Save to edit history if authenticated
      if (isAuthenticated && editor) {
        try {
          let contentBefore = '';
          let contentAfter = '';
          let targetId = '';
          
          if (action === 'add') {
            contentBefore = '';
            contentAfter = `Title: ${questionData.title}, Time: ${questionData.time}s`;
            targetId = `${episodeData.slug}_question_new_${Date.now()}`;
          } else if (action === 'update') {
            const originalQuestion = questions.find(q => q.id === questionData.id);
            if (originalQuestion) {
              contentBefore = `Title: ${originalQuestion.title}, Time: ${originalQuestion.time}s`;
              contentAfter = `Title: ${questionData.title}, Time: ${questionData.time}s`;
            }
            targetId = `${episodeData.slug}_question_${questionData.id}`;
          } else if (action === 'delete') {
            const originalQuestion = questions.find(q => q.id === questionData.id);
            if (originalQuestion) {
              contentBefore = `Title: ${originalQuestion.title}, Time: ${originalQuestion.time}s`;
              contentAfter = '';
            }
            targetId = `${episodeData.slug}_question_${questionData.id}`;
          }
          
          await saveEditToHistory({
            editorId: editor.id,
            editorEmail: editor.email,
            editorName: editor.name,
            editType: 'question',
            targetType: 'question',
            targetId: targetId,
            contentBefore: contentBefore,
            contentAfter: contentAfter,
            filePath: null,
            metadata: {
              episodeSlug: episodeData.slug,
              questionId: questionData.id || 'new',
              action: action,
              questionData: questionData,
              timestamp: new Date().toISOString()
            }
          });
          console.log(`[PlayerPage] Question ${action} saved to history`);
        } catch (historyError) {
          console.error('[PlayerPage] Failed to save edit history:', historyError);
          // Don't fail the whole operation if history save fails
        }
      }
      
      fetchQuestionsForEpisode(episodeData.slug, langForQuestions);
    }
  }, [episodeData, currentLanguage, toast, fetchQuestionsForEpisode, isAuthenticated, editor, questions]);

  const handleEditQuestion = useCallback((question) => {
    // Check authentication before opening edit dialog
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    if (question.id === 'full-transcript-virtual') {
      console.warn('Attempted to edit virtual question:', question.id);
      return;
    }
    setEditingQuestion(question);
  }, [isAuthenticated, openAuthModal]);

  const handleTranscriptUpdate = useCallback(async (newTranscriptData) => {
    if (!episodeData || !episodeData.slug) return;
    const langForContent = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;

    // Split large payloads to avoid HTTP2 errors
    const compactEdited = {
      utterances: newTranscriptData.utterances || []
    };
    
    // Retry logic for large payloads
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const { error: updateError } = await supabase
          .from('transcripts')
          .update({ edited_transcript_data: compactEdited, status: 'completed' })
          .eq('episode_slug', episodeData.slug)
          .eq('lang', langForContent);

        if (updateError) {
          console.error("Error updating transcript:", updateError);
          toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Failed to update transcript: ${updateError.message}`, variant: "destructive" });
        } else {
          setTranscript(newTranscriptData); 
        }
        break; // Success, exit retry loop
      } catch (err) {
        retryCount++;
        if (retryCount >= maxRetries) {
          toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Failed to update transcript: ${err.message}`, variant: "destructive" });
        } else {
          console.warn(`Retry ${retryCount}/${maxRetries} for transcript update:`, err.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }
  }, [episodeData, currentLanguage, toast, setTranscript]);

  // Адаптер для совместимости с useSegmentEditing
  const handleSegmentEdit = useCallback(async (newUtterances, actionType, originalSegment, updatedSegment) => {
    if (!episodeData || !episodeData.slug || !transcript) return;
    
    try {
      // Используем оффлайн-совместимый метод сохранения
      await saveEditedTranscript(newUtterances);
    } catch (error) {
      console.error('Error saving segment edit:', error);
      toast({
        title: getLocaleString('saveError', currentLanguage),
        description: error.message,
        variant: "destructive"
      });
    }
  }, [episodeData, transcript, saveEditedTranscript, currentLanguage, toast]);

  const playerEpisodeDataMemo = useMemo(() => {
    if (!episodeData) return null;
    
    const langForDisplay = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;
    
    // Если есть переведенное название из БД, используем его
    let displayTitle;
    if (episodeData.title && episodeData.title.trim() !== '') {
      displayTitle = episodeData.title;
    } else {
      // Иначе генерируем название на основе префикса и даты
      const prefix = getLocaleString('meditationTitlePrefix', langForDisplay);
      let datePart = '';

      if (episodeData.date) {
          datePart = formatShortDate(episodeData.date, langForDisplay);
      } else if (episodeData.created_at) {
          datePart = formatShortDate(episodeData.created_at, langForDisplay);
      }
      displayTitle = datePart ? `${prefix} ${datePart}` : prefix;
    }

    const playerData = {
      ...episodeData,
      displayTitle: displayTitle,
      questions: questions,
      transcript: transcript,
      jumpToTime: jumpDetails.time,
      jumpId: jumpDetails.id,
      jumpToQuestionId: jumpDetails.questionId,
      playAfterJump: jumpDetails.playAfterJump,
      segmentToHighlight: jumpDetails.segmentToHighlight,
      questionsUpdatedId: questionsUpdatedId,
      lang: langForDisplay,
      onTranscriptUpdate: handleTranscriptUpdate 
    };



    return playerData;
  }, [episodeData, questions, transcript, jumpDetails, questionsUpdatedId, currentLanguage, handleTranscriptUpdate]);
  
  const {
    isSpeakerAssignmentDialogOpen,
    segmentForSpeakerAssignment,
    handleOpenSpeakerAssignmentDialog,
    handleSaveSpeakerAssignment,
    handleCloseSpeakerAssignmentDialog,
  } = useSpeakerAssignment(
    playerEpisodeDataMemo, 
    handleTranscriptUpdate, 
    toast, 
    currentLanguage, 
    fetchTranscriptForEpisode, 
    playerEpisodeDataMemo?.slug, 
    playerEpisodeDataMemo?.lang
  );

  // Пока не получили базовые данные эпизода — показываем простой лоадер
  if (loading && !episodeData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <p className="mt-4 text-lg">{getLocaleString('loadingEpisode', currentLanguage)}</p>
      </div>
    );
  }

  // Не блокируем рендер плеера: если грузится только текст/вопросы — покажем их спиннеры ниже
  if (!episodeData && !loading) {
    return (
      <div className="text-center p-8 bg-red-700/30 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold mb-2">{getLocaleString('errorLoadingData', currentLanguage)}</h2>
        <p className="max-w-md mx-auto">{getLocaleString('episodeNotFound', currentLanguage)}</p>
        <Button onClick={() => navigate('/episodes')} variant="outline" className="mt-4 bg-slate-700/50 hover:bg-slate-600/70 border-slate-600 text-slate-300 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodesShort', currentLanguage)}
        </Button>
      </div>
    );
  }

  if (error && !playerEpisodeDataMemo) {
    return (
      <div className="text-center p-8 bg-red-700/30 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold mb-2">{getLocaleString('errorLoadingData', currentLanguage)}</h2>
        <p className="max-w-md mx-auto">{error}</p>
        <Button onClick={() => navigate('/episodes')} variant="outline" className="mt-4 bg-slate-700/50 hover:bg-slate-600/70 border-slate-600 text-slate-300 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backToEpisodesShort', currentLanguage)}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {showFloatingControls && (
        <FloatingPlayerControls
          episodeTitle={playerEpisodeDataMemo?.displayTitle || ''}
          isPlaying={playerState.isPlaying}
          activeQuestionTitle={playerState.activeQuestionTitle}
          onPlayPause={handleFloatingPlayPause}
          onSkipSeconds={handleFloatingPlayerSkip}
          currentLanguage={currentLanguage}
        />
      )}
      <div className="w-full max-w-3xl">

        
        <div ref={playerControlsContainerRef} className="mb-4">
          {playerEpisodeDataMemo && (
            <PodcastPlayer
                key={playerEpisodeDataMemo.slug + '-' + playerEpisodeDataMemo.lang}
                episodeData={playerEpisodeDataMemo}
                onQuestionUpdate={handleQuestionUpdate}
                currentLanguage={currentLanguage}
                onQuestionSelectJump={handleSeekToTime}
                audioRef={audioRef} 
                episodeSlug={playerEpisodeDataMemo.slug}
                episodeAudioUrl={playerEpisodeDataMemo.audio_url}
                episodeLang={playerEpisodeDataMemo.lang}
                episodeDate={playerEpisodeDataMemo.date}
                navigateBack={() => navigate('/episodes')}
                onPlayerStateChange={handlePlayerStateChange}
                playerControlsContainerRef={playerControlsContainerRef}
                showTranscript={showTranscriptUI}
                onToggleShowTranscript={handleToggleShowTranscript}
                user={user}
                onTranscriptUpdate={handleTranscriptUpdate}
                fetchTranscriptForEpisode={fetchTranscriptForEpisode}
                isOfflineMode={isOfflineMode}
            />
          )}
        </div>
        <div className="w-full relative">
          {(questionsLoading || transcriptLoading) && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-1 rounded-md bg-slate-800/70 backdrop-blur border border-slate-700/70 text-slate-300 text-xs flex items-center gap-1.5 shadow-md">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
              <span>{getLocaleString('loadingTranscriptAndQuestions', currentLanguage) || 'Loading transcript and questions...'}</span>
            </div>
          )}
           <QuestionsManager
            questions={playerEpisodeDataMemo.questions || []}
            currentTime={playerState.currentTime}
            duration={playerState.duration}
            onQuestionsChange={handleQuestionUpdate}
            onQuestionJump={(time, id, playAfterJumpParam) => handleSeekToTime(time, id, playAfterJumpParam)}
            episodeSlug={playerEpisodeDataMemo.slug}
            episodeDate={playerEpisodeDataMemo.date}
            audioRef={audioRef}
            mainPlayerIsPlaying={playerState.isPlaying}
            mainPlayerTogglePlayPause={handleFloatingPlayPause} 
            mainPlayerSeekAudio={(time, play) => handleSeekToTime(time, null, play)}
            currentLanguage={currentLanguage}
            episodeLang={playerEpisodeDataMemo.lang || 'all'}
            episodeAudioUrl={playerEpisodeDataMemo.audio_url}
            jumpToQuestionId={playerEpisodeDataMemo.jumpToQuestionId}
            isBatchAddDisabled={true}
            showTranscript={showTranscriptUI}
            user={user}
            disableAutomaticCollapse={true}
            onOpenSpeakerAssignmentDialog={handleOpenSpeakerAssignmentDialog}
            transcriptUtterances={playerEpisodeDataMemo.transcript?.utterances || []}
            transcriptId={playerEpisodeDataMemo.transcript?.id || null}
            transcriptWords={playerEpisodeDataMemo.transcript?.words || []}
            segmentToHighlight={playerEpisodeDataMemo.segmentToHighlight}
            isLoading={Boolean(questionsLoading)}
            transcriptLoading={Boolean(transcriptLoading)}
            onTranscriptLocalUpdate={setTranscript}
            onSaveEditedSegment={handleSegmentEdit}
            onAddQuestionFromSegment={openAddQuestionFromSegmentDialog}
            onEditQuestion={handleEditQuestion}
          />
        </div>
      </div>
      {segmentForSpeakerAssignment && (
        <SpeakerAssignmentDialog
          isOpen={isSpeakerAssignmentDialogOpen}
          onClose={handleCloseSpeakerAssignmentDialog}
          segment={segmentForSpeakerAssignment}
          allUtterances={playerEpisodeDataMemo?.transcript?.utterances || []}
          onSave={handleSaveSpeakerAssignment}
          currentLanguage={currentLanguage}
        />
      )}
      {segmentForQuestion && (
        <AddQuestionFromSegmentDialog
          isOpen={isAddQuestionFromSegmentDialogOpen}
          onClose={closeAddQuestionFromSegmentDialog}
          segment={segmentForQuestion}
          onSave={(title, time) => {
            handleQuestionUpdate('add', { title, time, lang: currentLanguage });
            closeAddQuestionFromSegmentDialog();
          }}
          currentLanguage={currentLanguage}
          audioRef={audioRef}
          mainPlayerIsPlaying={playerState.isPlaying}
          mainPlayerTogglePlayPause={handleFloatingPlayPause}
          mainPlayerSeekAudio={handleSeekToTime}
          duration={playerState.duration}
        />
      )}
      {editingQuestion && (
        <AddQuestionDialog
          isOpen={!!editingQuestion}
          onClose={() => setEditingQuestion(null)}
          initialTime={editingQuestion.time}
          initialTitle={editingQuestion.title}
          onSave={(title, time) => {
            handleQuestionUpdate('update', { 
              id: editingQuestion.id, 
              title, 
              time, 
              lang: editingQuestion.lang || currentLanguage 
            });
            setEditingQuestion(null);
          }}
          onDelete={editingQuestion.id === 'intro-virtual' ? undefined : () => {
            handleQuestionUpdate('delete', { id: editingQuestion.id });
            setEditingQuestion(null);
          }}
          currentLanguage={currentLanguage}
          audioRef={audioRef}
          mainPlayerIsPlaying={playerState.isPlaying}
          mainPlayerTogglePlayPause={handleFloatingPlayPause}
          mainPlayerSeekAudio={handleSeekToTime}
          duration={playerState.duration}
          isEditing={true}
          disableTimeEditing={editingQuestion.id === 'intro-virtual'}
          hideDelete={editingQuestion.id === 'intro-virtual'}
        />
      )}
    </div>
  );
};

export default PlayerPage;
