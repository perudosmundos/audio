import { useState, useEffect, useCallback } from 'react';
import { processTranscriptData } from '@/hooks/transcript/transcriptProcessingUtils';

const useTranscriptData = (externalTranscriptUtterances) => {
  const [transcript, _setTranscript] = useState(null);
  const [transcriptDbId, setTranscriptDbId] = useState(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState(null);

  const setTranscript = useCallback((data) => {
    if (data === null) {
      _setTranscript(null);
    } else if (data && data.utterances) {
      _setTranscript(processTranscriptData(data));
    } else if (data && !data.utterances && externalTranscriptUtterances) {
       _setTranscript(processTranscriptData({ ...data, utterances: externalTranscriptUtterances }));
    } else {
      _setTranscript(data); // Could be initial raw data before processing
    }
  }, [externalTranscriptUtterances]);

  useEffect(() => {
    if (externalTranscriptUtterances && (!transcript || transcript.utterances !== externalTranscriptUtterances)) {
      setTranscript({ utterances: externalTranscriptUtterances, words: transcript?.words || [] });
    }
  }, [externalTranscriptUtterances, transcript, setTranscript]);


  return {
    transcript,
    setTranscript,
    transcriptDbId,
    setTranscriptDbId,
    isLoadingTranscript,
    setIsLoadingTranscript,
    transcriptError,
    setTranscriptError,
  };
};

export default useTranscriptData;