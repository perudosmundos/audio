
import logger from '@/lib/logger';

const MAX_SEGMENT_DURATION_MS = 120000; 
const PREFERRED_SPLIT_WINDOW_MS = 30000; 

const findLastSentenceEndIndex = (textBlock, maxChars) => {
  if (!textBlock || textBlock.length <= maxChars) return textBlock.length;

  let searchEnd = maxChars;
  let searchStart = Math.max(0, maxChars - (PREFERRED_SPLIT_WINDOW_MS / 1000 * 15)); 

  for (let i = searchEnd; i >= searchStart; i--) {
    if (textBlock[i] === '.' || textBlock[i] === '?' || textBlock[i] === '!') {
      if (i + 1 < textBlock.length && textBlock[i+1] === ' ') {
        return i + 2; 
      }
      return i + 1; 
    }
  }
  
  let lastSpace = -1;
  for (let i = searchEnd; i >= searchStart; i--) {
    if (textBlock[i] === ' ') {
      lastSpace = i;
      break;
    }
  }
  return lastSpace !== -1 ? lastSpace + 1 : maxChars;
};


export const splitLongUtterance = (utterance) => {
  const utteranceDuration = utterance.end - utterance.start;
  if (utteranceDuration <= MAX_SEGMENT_DURATION_MS) {
    return [utterance];
  }

  const newUtterances = [];
  let currentStart = utterance.start;

  if (utterance.words && utterance.words.length > 0) {
    let currentWords = [];
    let currentText = "";

    for (let i = 0; i < utterance.words.length; i++) {
      const word = utterance.words[i];
      const potentialChunkEnd = word.end;

      if (potentialChunkEnd - currentStart > MAX_SEGMENT_DURATION_MS && currentWords.length > 0) {
        let splitAtWordIndex = currentWords.length -1; 
        let searchBackwardsFromIndex = currentWords.length -1;
        
        for (let j = searchBackwardsFromIndex; j >=0; j--) {
            const prevWord = currentWords[j];
            if (potentialChunkEnd - prevWord.start > PREFERRED_SPLIT_WINDOW_MS && j < searchBackwardsFromIndex) break; 
            if (/[.?!]$/.test(prevWord.text)) {
                splitAtWordIndex = j;
                break;
            }
        }
        
        const wordsForThisChunk = currentWords.slice(0, splitAtWordIndex + 1);
        const textForThisChunk = wordsForThisChunk.map(w => w.text).join(" ");
        const endForThisChunk = wordsForThisChunk[wordsForThisChunk.length -1].end;

        newUtterances.push({
          ...utterance,
          start: currentStart,
          end: endForThisChunk,
          text: textForThisChunk,
          words: [...wordsForThisChunk],
          id: `${utterance.id || utterance.start}-split-${newUtterances.length}-${Date.now()}`
        });
        
        currentWords = currentWords.slice(splitAtWordIndex + 1);
        currentText = currentWords.map(w => w.text).join(" ");
        currentStart = currentWords.length > 0 ? currentWords[0].start : potentialChunkEnd; 
        
        if(currentWords.length === 0) { 
           if (i < utterance.words.length){ 
             currentWords.push(word);
             currentText = word.text;
             currentStart = word.start;
           } else { 
             continue;
           }
        } else { 
          currentWords.push(word);
          currentText = currentWords.map(w => w.text).join(" ");
        }

      } else {
        currentWords.push(word);
        currentText = currentText ? `${currentText} ${word.text}` : word.text;
      }
    }

    if (currentWords.length > 0) {
      newUtterances.push({
        ...utterance,
        start: currentStart,
        end: utterance.end, 
        text: currentText.trim(),
        words: currentWords,
        id: `${utterance.id || utterance.start}-split-${newUtterances.length}-${Date.now()}`
      });
    }
  } else { 
    const numChunks = Math.ceil(utteranceDuration / MAX_SEGMENT_DURATION_MS);
    let textOffset = 0;

    for (let i = 0; i < numChunks; i++) {
      const chunkStartMs = utterance.start + i * MAX_SEGMENT_DURATION_MS;
      const chunkDurationMs = Math.min(MAX_SEGMENT_DURATION_MS, utterance.end - chunkStartMs);
      const chunkEndMs = chunkStartMs + chunkDurationMs;
      
      const proportionOfDuration = chunkDurationMs / utteranceDuration;
      let estimatedCharsForChunk = Math.floor(utterance.text.length * proportionOfDuration);
      
      let actualCharsForChunk;
      if (i === numChunks - 1) {
        actualCharsForChunk = utterance.text.length - textOffset;
      } else {
        actualCharsForChunk = findLastSentenceEndIndex(utterance.text.substring(textOffset), estimatedCharsForChunk);
         if (textOffset + actualCharsForChunk > utterance.text.length) { 
            actualCharsForChunk = utterance.text.length - textOffset;
        }
      }
      
      const chunkText = utterance.text.substring(textOffset, textOffset + actualCharsForChunk);
      textOffset += actualCharsForChunk;

      if (chunkText.trim()) {
        newUtterances.push({
          ...utterance,
          start: chunkStartMs,
          end: chunkEndMs,
          text: chunkText.trim(),
          words: [], 
          id: `${utterance.id || utterance.start}-textsplit-${i}-${Date.now()}`
        });
      }
    }
  }
  
  return newUtterances.length > 0 ? newUtterances : [utterance];
};


export const splitTranscriptToSegments = (utterances, maxSegmentDurationMs = 120000) => {
  if (!Array.isArray(utterances) || utterances.length === 0) return [];
  const segments = [];
  let currentSegment = [];
  let segmentStart = null;
  let segmentEnd = null;

  for (let i = 0; i < utterances.length; i++) {
    const utt = utterances[i];
    if (currentSegment.length === 0) {
      segmentStart = utt.start;
      segmentEnd = utt.end;
      currentSegment.push(utt);
      continue;
    }
    // Проверяем, не превысит ли добавление этого utterance лимит
    if ((utt.end - segmentStart) > maxSegmentDurationMs) {
      // Если текущее utterance само по себе длинное — разбить его
      if ((utt.end - utt.start) > maxSegmentDurationMs) {
        // Используем splitLongUtterance для этого utterance
        const splitted = splitLongUtterance(utt);
        // Первый кусок — завершает текущий сегмент, остальные — новые сегменты
        if (splitted.length > 0) {
          // Первый кусок — завершает текущий сегмент
          segments.push([...currentSegment, splitted[0]]);
          // Остальные куски — отдельные сегменты
          for (let j = 1; j < splitted.length; j++) {
            segments.push([splitted[j]]);
          }
        } else {
          segments.push([...currentSegment, utt]);
        }
        currentSegment = [];
        segmentStart = null;
        segmentEnd = null;
      } else {
        // Завершаем текущий сегмент
        segments.push([...currentSegment]);
        // Начинаем новый сегмент с текущего utterance
        currentSegment = [utt];
        segmentStart = utt.start;
        segmentEnd = utt.end;
      }
    } else {
      // Добавляем utterance в текущий сегмент
      currentSegment.push(utt);
      segmentEnd = utt.end;
    }
  }
  if (currentSegment.length > 0) {
    segments.push([...currentSegment]);
  }
  return segments;
};


// Efficiently assign words to utterances in a single pass (O(U + W))
const mapWordsToUtterances = (utterances, words) => {
  if (!Array.isArray(utterances) || !Array.isArray(words) || utterances.length === 0 || words.length === 0) {
    return utterances.map(() => []);
  }

  // Assume input arrays are already sorted by start time (AssemblyAI usually provides sorted arrays)
  const wordLists = new Array(utterances.length);
  for (let i = 0; i < utterances.length; i++) wordLists[i] = [];

  let wIdx = 0;
  for (let uIdx = 0; uIdx < utterances.length; uIdx++) {
    const u = utterances[uIdx];
    const uStart = u.start;
    const uEnd = u.end;

    // Advance words until they reach current utterance window
    while (wIdx < words.length && words[wIdx].end < uStart) {
      wIdx++;
    }
    // Collect words inside utterance window
    let tempIdx = wIdx;
    while (tempIdx < words.length) {
      const w = words[tempIdx];
      if (w.start > uEnd) break;
      if (w.confidence === undefined || w.confidence > 0) {
        wordLists[uIdx].push(w);
      }
      tempIdx++;
    }
    // Prepare next search start position
    wIdx = tempIdx;
  }

  return wordLists;
};

export const processTranscriptData = (data) => {
  if (!data || !Array.isArray(data.utterances)) {
    return { ...data, utterances: [] };
  }

  const utterances = data.utterances;
  const allWords = Array.isArray(data.words) ? data.words : [];
  const wordsPerUtterance = mapWordsToUtterances(utterances, allWords);

  const processedUtterances = utterances.flatMap((utt, idx) => {
    const utteranceWithWords = {
      ...utt,
      words: (wordsPerUtterance[idx] && wordsPerUtterance[idx].length > 0) ? wordsPerUtterance[idx] : (utt.words || [])
    };
    const splitted = splitLongUtterance(utteranceWithWords);
    // Log only extremely long utterances to reduce console spam
    if ((utt.end - utt.start) > 300000) {
      logger.debug('[TranscriptProcessing] Long utterance detected:', {
        start: utt.start,
        end: utt.end,
        durationMs: utt.end - utt.start,
        originalTextLen: (utt.text || '').length,
        splitCount: splitted.length
      });
    }
    return splitted;
  }).filter(utt => utt.text && utt.text.trim() !== "");
  
  return { ...data, utterances: processedUtterances, words: data.words };
};

// Build a compact payload for edited transcript data to store in DB
// Keeps only essential fields to reduce size and speed up reads/writes
export const buildEditedTranscriptData = (data) => {
  if (!data) {
    return { utterances: [] };
  }

  const sourceUtterances = Array.isArray(data.utterances) ? data.utterances : [];

  const minimalUtterances = sourceUtterances
    .filter(u => u && typeof u.start === 'number' && typeof u.end === 'number' && typeof u.text === 'string')
    .map((u) => {
      const out = {
        start: u.start,
        end: u.end,
        text: u.text
      };
      if (u.id !== undefined) out.id = u.id;
      if (u.speaker !== undefined && u.speaker !== null && String(u.speaker).trim() !== '') {
        out.speaker = u.speaker;
      }
      return out;
    });

  return { utterances: minimalUtterances };
};

// Helper function to get full text from utterances when needed
export const getFullTextFromUtterances = (utterances) => {
  if (!Array.isArray(utterances) || utterances.length === 0) {
    return '';
  }
  return utterances.map(u => u.text || '').join(' ');
};
