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
import useEpisodeData from '@/hooks/player_page/useEpisodeData';
import useLocalEpisodeData from '@/hooks/player_page/useLocalEpisodeData';
import usePlayerInteractions from '@/hooks/player_page/usePlayerInteractions';
import useSupabaseSubscriptions from '@/hooks/player_page/useSupabaseSubscriptions';
import useSpeakerAssignment from '@/hooks/player/useSpeakerAssignment'; 
import SpeakerAssignmentDialog from '@/components/transcript/SpeakerAssignmentDialog';

const PlayerPage = ({ currentLanguage, user }) => {
  const { episodeSlug } = useParams(); 
  const navigate = useNavigate();
  const { toast } = useToast();

  const audioRef = useRef(null); 
  const [showFloatingControls, setShowFloatingControls] = useState(false);
  const playerControlsContainerRef = useRef(null);

  // Определяем, находимся ли мы в локальной среде
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Используем локальные данные в режиме разработки
  const {
    episodeData: localEpisodeData,
    questions: localQuestions,
    transcript: localTranscript,
    loading: localLoading,
    error: localError,
    questionsUpdatedId: localQuestionsUpdatedId,
    fetchEpisodeDetails: localFetchEpisodeDetails,
    fetchQuestionsForEpisode: localFetchQuestionsForEpisode,
    fetchTranscriptForEpisode: localFetchTranscriptForEpisode,
    setTranscript: localSetTranscript,
  } = useLocalEpisodeData(episodeSlug, currentLanguage, toast);

  const {
    episodeData: prodEpisodeData,
    questions: prodQuestions,
    transcript: prodTranscript,
    loading: prodLoading,
    error: prodError,
    questionsUpdatedId: prodQuestionsUpdatedId,
    fetchEpisodeDetails: prodFetchEpisodeDetails,
    fetchQuestionsForEpisode: prodFetchQuestionsForEpisode,
    fetchTranscriptForEpisode: prodFetchTranscriptForEpisode,
    setTranscript: prodSetTranscript,
  } = useEpisodeData(episodeSlug, currentLanguage, toast);

  // Выбираем данные в зависимости от среды
  const episodeData = isLocalhost ? localEpisodeData : prodEpisodeData;
  const questions = isLocalhost ? localQuestions : prodQuestions;
  const transcript = isLocalhost ? localTranscript : prodTranscript;
  const loading = isLocalhost ? localLoading : prodLoading;
  const error = isLocalhost ? localError : prodError;
  const questionsUpdatedId = isLocalhost ? localQuestionsUpdatedId : prodQuestionsUpdatedId;
  const fetchEpisodeDetails = isLocalhost ? localFetchEpisodeDetails : prodFetchEpisodeDetails;
  const fetchQuestionsForEpisode = isLocalhost ? localFetchQuestionsForEpisode : prodFetchQuestionsForEpisode;
  const fetchTranscriptForEpisode = isLocalhost ? localFetchTranscriptForEpisode : prodFetchTranscriptForEpisode;
  const setTranscript = isLocalhost ? localSetTranscript : prodSetTranscript;

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

  // Подписываемся на изменения только в продакшене
  if (!isLocalhost) {
    useSupabaseSubscriptions(
      episodeSlug,
      episodeData,
      currentLanguage,
      fetchQuestionsForEpisode,
      fetchTranscriptForEpisode
    );
  }
  
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
      fetchQuestionsForEpisode(episodeData.slug, langForQuestions);
    }
  }, [episodeData, currentLanguage, toast, fetchQuestionsForEpisode]);

  const handleTranscriptUpdate = useCallback(async (newTranscriptData) => {
    if (!episodeData || !episodeData.slug) return;
    const langForContent = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;

    const { error: updateError } = await supabase
      .from('transcripts')
      .update({ edited_transcript_data: newTranscriptData, status: 'completed' })
      .eq('episode_slug', episodeData.slug)
      .eq('lang', langForContent);

    if (updateError) {
      toast({ title: getLocaleString('errorGeneric', currentLanguage), description: `Failed to update transcript: ${updateError.message}`, variant: "destructive" });
    } else {
      setTranscript(newTranscriptData); 
    }
  }, [episodeData, currentLanguage, toast, setTranscript]);

  const playerEpisodeDataMemo = useMemo(() => {
    if (!episodeData) return null;
    
    const langForDisplay = episodeData.lang === 'all' ? currentLanguage : episodeData.lang;
    const prefix = getLocaleString('meditationTitlePrefix', langForDisplay);
    let datePart = '';

    if (episodeData.date) {
        datePart = formatShortDate(episodeData.date, langForDisplay);
    } else if (episodeData.created_at) {
        datePart = formatShortDate(episodeData.created_at, langForDisplay);
    }
    const displayTitle = datePart ? `${prefix} ${datePart}` : episodeData.title || prefix;

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

    console.log('PlayerPage: playerEpisodeDataMemo created', {
      slug: playerData.slug,
      audio_url: playerData.audio_url,
      duration: playerData.duration,
      questionsCount: playerData.questions?.length,
      transcriptUtterancesCount: playerData.transcript?.utterances?.length
    });

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
        <p className="mt-4 text-lg">{getLocaleString('loadingEpisode', currentLanguage)}</p>
      </div>
    );
  }

  if (error || !playerEpisodeDataMemo) {
    return (
      <div className="text-center p-8 bg-red-700/30 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold mb-2">{getLocaleString('errorLoadingData', currentLanguage)}</h2>
        <p className="max-w-md mx-auto">{error || getLocaleString('episodeNotFound', currentLanguage)}</p>
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
          <PodcastPlayer
              key={playerEpisodeDataMemo.slug + '-' + playerEpisodeDataMemo.lang + '-' + playerEpisodeDataMemo.questionsUpdatedId + '-' + (playerEpisodeDataMemo.transcript?.utterances?.length || 0)}
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
          />
        </div>
        <div className="w-full">
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
            segmentToHighlight={playerEpisodeDataMemo.segmentToHighlight}
          />
        </div>
      </div>
      {segmentForSpeakerAssignment && (
        <SpeakerAssignmentDialog
          isOpen={isSpeakerAssignmentDialogOpen}
          onClose={handleCloseSpeakerAssignmentDialog}
          segment={segmentForSpeakerAssignment}
          allUtterances={playerEpisodeDataMemo.transcript?.utterances || []}
          onSave={handleSaveSpeakerAssignment}
          currentLanguage={currentLanguage}
        />
      )}
    </div>
  );
};

export default PlayerPage;
