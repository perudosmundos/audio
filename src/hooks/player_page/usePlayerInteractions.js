import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logger from '@/lib/logger';

const usePlayerInteractions = (audioRef, playerControlsContainerRef, episodeSlug, questions, initialShowTranscript = false) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [jumpDetails, setJumpDetails] = useState({ time: null, id: null, questionId: null, playAfterJump: false, segmentToHighlight: null });
  const [showFloatingControls, setShowFloatingControls] = useState(false);
  const [playerState, setPlayerState] = useState({ isPlaying: false, currentTime: 0, duration: 0, activeQuestionTitle: '' });
  const [showTranscriptUI, setShowTranscriptUI] = useState(initialShowTranscript);


  const didDefaultAutoplayRef = useRef(false);

  useEffect(() => {
    const hash = location.hash;
    logger.debug('usePlayerInteractions: Processing hash', hash);
    if (hash) {
      // Обновленное регулярное выражение для поддержки &play=true без разделителя
      const segmentMatch = hash.match(/^#segment-(\d+(?:\.\d+)?)(?:&play=true)?$/);
      const questionMatch = hash.match(/^#question-([\w-]+)(?:&play=true)?$/);

      logger.debug('usePlayerInteractions: segmentMatch', segmentMatch);
      logger.debug('usePlayerInteractions: questionMatch', questionMatch);

      if (segmentMatch) {
        const time = parseFloat(segmentMatch[1]) / 1000; 
        const play = hash.includes('&play=true');
        logger.debug('usePlayerInteractions: Setting segment jump details', { time, play, segmentId: segmentMatch[1] });
        setJumpDetails({ time: time, id: `segment-${segmentMatch[1]}`, questionId: null, playAfterJump: play, segmentToHighlight: parseFloat(segmentMatch[1]) });
      } else if (questionMatch) {
        const questionId = questionMatch[1];
        const play = hash.includes('&play=true');
        let question = questions.find(q => String(q.id) === questionId || q.slug === questionId);
        logger.debug('usePlayerInteractions: Found question for jump', { questionId, question, play });
        if (question) {
          setJumpDetails({ time: question.time, id: `question-${questionId}`, questionId: questionId, playAfterJump: play, segmentToHighlight: null });
        } else {
          // Если вопросы ещё не подгрузились, повторим попытку позже
          const retry = setTimeout(() => {
            const q2 = questions.find(q => String(q.id) === questionId || q.slug === questionId);
            if (q2) {
              setJumpDetails({ time: q2.time, id: `question-${questionId}`, questionId: questionId, playAfterJump: play, segmentToHighlight: null });
            }
            clearTimeout(retry);
          }, 600);
        }
      }
    } else {
      // Нет якоря — включаем автозапуск с начала один раз
      if (!didDefaultAutoplayRef.current) {
        didDefaultAutoplayRef.current = true;
        const newHash = '#segment-0&play=true';
        if (location.hash !== newHash) {
          navigate(`${location.pathname}${newHash}`, { replace: true, state: location.state });
        }
        setJumpDetails({ time: 0, id: 'segment-0', questionId: null, playAfterJump: true, segmentToHighlight: 0 });
      }
    }
  }, [location.hash, questions, episodeSlug]);

  const handleSeekToTime = useCallback((time, id = null, playAfterJump = false, questionId = null) => {
    logger.debug('usePlayerInteractions: handleSeekToTime called', { time, id, playAfterJump, questionId });
    const segmentStartTimeMs = Math.round(time * 1000);
    let newHash = '';
    if (id && typeof id === 'string' && id.startsWith('question-')) {
        newHash = `#${id}${playAfterJump ? '&play=true' : ''}`;
    } else {
        newHash = `#segment-${segmentStartTimeMs}${playAfterJump ? '&play=true' : ''}`;
    }
      
    if (location.hash !== newHash) {
        if (newHash) {
            navigate(`${location.pathname}${newHash}`, { replace: true, state: location.state });
        } else {
             navigate(location.pathname, { replace: true, state: location.state });
        }
    }
    setJumpDetails({ time, id: id || `segment-${segmentStartTimeMs}`, questionId, playAfterJump, segmentToHighlight: segmentStartTimeMs });
  }, [navigate, location.pathname, location.hash, location.state]);

  const handlePlayerStateChange = useCallback((newState) => {
    logger.debug('usePlayerInteractions: handlePlayerStateChange called', newState);
    setPlayerState(prevState => ({ ...prevState, ...newState }));
  }, []);

  const handleToggleShowTranscript = useCallback(() => {
    setShowTranscriptUI(prev => !prev);
  }, []);

  const handleFloatingPlayerSkip = useCallback((seconds) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      handleSeekToTime(newTime, null, playerState.isPlaying);
    }
  }, [audioRef, playerState.isPlaying, handleSeekToTime]);

  const handleFloatingPlayPause = useCallback(() => {
    if (audioRef.current) {
      const newIsPlaying = !audioRef.current.paused; 
      if (newIsPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Floating player play error:", e));
      }
       setPlayerState(prev => ({ ...prev, isPlaying: !newIsPlaying }));
    }
  }, [audioRef]);


  return {
    jumpDetails,
    showFloatingControls,
    playerState,
    showTranscriptUI,
    handleSeekToTime,
    handlePlayerStateChange,
    handleToggleShowTranscript,
    handleFloatingPlayerSkip,
    handleFloatingPlayPause,
    setShowFloatingControls
  };
};

export default usePlayerInteractions;