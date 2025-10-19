class TextExportService {
  // Генерация TXT файла
  generateTXT(content, options) {
    let text = '';
    
    if (options.includeTimings) {
      text += `Время: ${this.formatTime(content.startTime)}\n`;
    }
    
    if (content.type === 'question') {
      text += `Вопрос: ${content.title}\n`;
      text += `${content.text}\n\n`;
    } else {
      text += `${content.text}\n\n`;
    }
    
    return text;
  }

  // Генерация DOC файла (HTML формат)
  generateDOC(content, options) {
    let html = '<html><head><meta charset="UTF-8"><title>Транскрипт</title></head><body>';
    
    if (options.includeTimings) {
      html += `<p><strong>Время:</strong> ${this.formatTime(content.startTime)}</p>`;
    }
    
    if (content.type === 'question') {
      html += `<h2>${content.title}</h2>`;
      html += `<p>${content.text}</p>`;
    } else {
      html += `<p>${content.text}</p>`;
    }
    
    html += '</body></html>';
    return html;
  }

  // Генерация PDF файла (через HTML)
  generatePDF(content, options) {
    // Для PDF используем тот же HTML, что и для DOC
    return this.generateDOC(content, options);
  }

  // Форматирование времени
  formatTime(seconds) {
    // Проверяем валидность времени
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
      return '0:00';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Скачивание файла
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Получение текста от вопроса до следующего вопроса
  getQuestionText(question, allQuestions, questionIndex, transcript, options = {}) {
    if (!transcript || !transcript.utterances) {
      return '';
    }

    const currentTime = question.time * 1000; // конвертируем в миллисекунды
    const nextQuestion = allQuestions[questionIndex + 1];
    const endTime = nextQuestion ? nextQuestion.time * 1000 : Infinity;

    // Фильтруем сегменты транскрипта между текущим вопросом и следующим
    const relevantSegments = transcript.utterances.filter(segment => {
      return segment.start >= currentTime && segment.start < endTime;
    });

    // Объединяем текст сегментов
    return relevantSegments.map(segment => {
      let text = segment.text || '';
      let result = '';
      
      // Добавляем тайминг к каждому сегменту, если включена опция
      if (options.includeTimings && segment.start !== undefined) {
        const segmentTime = segment.start / 1000; // конвертируем из миллисекунд в секунды
        result += `[${this.formatTime(segmentTime)}] `;
      }
      
      // Добавляем спикера, если включена опция
      if (options.includeSpeakers && segment.speaker) {
        result += `${segment.speaker}: `;
      }
      
      // Добавляем текст
      result += text;
      
      return result;
    }).join('\n'); // Разделяем сегменты переносами строк
  }

  // Основная функция экспорта
  exportText(transcript, questions, options, episodeTitle) {
    const { contentType, includeTimings, includeSpeakers, format, selectedQuestions } = options;
    
    let content = '';
    let filename = `${episodeTitle || 'transcript'}.${format}`;
    
    if (contentType === 'all') {
      // Экспорт всего текста
      content = this.generateFullText(transcript, questions, options, format);
    } else {
      // Экспорт выбранных вопросов
      const filteredQuestions = questions.filter(q => selectedQuestions.includes(q.id));
      if (format === 'txt') {
        content = this.generateQuestionsTXT(filteredQuestions, options, transcript);
      } else if (format === 'doc') {
        content = this.generateQuestionsDOC(filteredQuestions, options, transcript);
      }
    }
    
    // Определяем MIME тип
    let mimeType;
    switch (format) {
      case 'txt':
        mimeType = 'text/plain;charset=utf-8';
        break;
      case 'doc':
        mimeType = 'application/msword';
        break;
      default:
        mimeType = 'text/plain;charset=utf-8';
    }
    
    this.downloadFile(content, filename, mimeType);
  }

  // Генерация полного текста
  generateFullText(transcript, questions, options, format) {
    let content = '';
    
    if (format === 'txt') {
      content = this.generateFullTXT(transcript, questions, options);
    } else if (format === 'doc') {
      content = this.generateFullDOC(transcript, questions, options);
    }
    
    return content;
  }

  // Генерация полного TXT
  generateFullTXT(transcript, questions, options) {
    let text = '';
    
    // Создаем объединенный массив всех элементов с временными метками
    const allItems = [];
    
    // Добавляем вопросы
    questions.forEach(question => {
      allItems.push({
        type: 'question',
        time: question.time,
        title: question.title,
        text: question.title || ''
      });
    });
    
    // Добавляем сегменты транскрипта
    transcript.forEach(segment => {
      allItems.push({
        type: 'transcript',
        time: segment.start / 1000,
        text: segment.text,
        speaker: segment.speaker
      });
    });
    
    // Сортируем по времени
    allItems.sort((a, b) => a.time - b.time);
    
    // Генерируем текст в хронологическом порядке
    allItems.forEach(item => {
      if (options.includeTimings) {
        text += `[${this.formatTime(item.time)}] `;
      }
      
      if (item.type === 'question') {
        text += `ВОПРОС: ${item.title}\n`;
        // В данной системе текст вопроса хранится в title, поэтому дополнительный текст не добавляем
      } else {
        if (options.includeSpeakers && item.speaker) {
          text += `${item.speaker}: `;
        }
        text += `${item.text}`;
      }
      
      text += '\n\n';
    });
    
    return text;
  }

  // Генерация полного DOC
  generateFullDOC(transcript, questions, options) {
    let html = '<html><head><meta charset="UTF-8"><title>Транскрипт</title></head><body>';
    
    // Создаем объединенный массив всех элементов с временными метками
    const allItems = [];
    
    // Добавляем вопросы
    questions.forEach(question => {
      allItems.push({
        type: 'question',
        time: question.time,
        title: question.title,
        text: question.title || ''
      });
    });
    
    // Добавляем сегменты транскрипта
    transcript.forEach(segment => {
      allItems.push({
        type: 'transcript',
        time: segment.start / 1000,
        text: segment.text,
        speaker: segment.speaker
      });
    });
    
    // Сортируем по времени
    allItems.sort((a, b) => a.time - b.time);
    
    // Генерируем HTML в хронологическом порядке
    allItems.forEach(item => {
      if (item.type === 'question') {
        html += '<h2>';
        if (options.includeTimings) {
          html += `[${this.formatTime(item.time)}] `;
        }
        html += `${item.title}</h2>`;
        // В данной системе текст вопроса хранится в title, поэтому дополнительный текст не добавляем
      } else {
        html += '<p>';
        if (options.includeTimings) {
          html += `<strong>[${this.formatTime(item.time)}]</strong> `;
        }
        if (options.includeSpeakers && item.speaker) {
          html += `<strong>${item.speaker}:</strong> `;
        }
        html += `${item.text}</p>`;
      }
    });
    
    html += '</body></html>';
    return html;
  }



  // Генерация текста только для выбранных вопросов
  generateQuestionsText(questions, options) {
    let content = '';
    
    if (options.format === 'txt') {
      content = this.generateQuestionsTXT(questions, options);
    } else if (options.format === 'doc') {
      content = this.generateQuestionsDOC(questions, options);
    }
    
    return content;
  }

  // Генерация TXT для вопросов
  generateQuestionsTXT(questions, options, transcript = null) {
    let text = '';
    
    questions.forEach((question, index) => {
      if (options.includeTimings) {
        text += `[${this.formatTime(question.time)}] `;
      }
      text += `ВОПРОС: ${question.title}\n`;
      
      // Получаем текст от этого вопроса до следующего
      const questionText = this.getQuestionText(question, questions, index, transcript, options);
      if (questionText.trim()) {
        text += `${questionText}\n`;
      }
      text += '\n';
    });
    
    return text;
  }

  // Генерация DOC для вопросов
  generateQuestionsDOC(questions, options, transcript = null) {
    let html = '<html><head><meta charset="UTF-8"><title>Вопросы</title></head><body>';
    
    questions.forEach((question, index) => {
      html += '<h2>';
      if (options.includeTimings) {
        html += `[${this.formatTime(question.time)}] `;
      }
      html += `${question.title}</h2>`;
      
      // Получаем текст от этого вопроса до следующего
      const questionText = this.getQuestionText(question, questions, index, transcript, options);
      if (questionText.trim()) {
        html += `<p>${questionText}</p>`;
      }
    });
    
    html += '</body></html>';
    return html;
  }

  // Генерация SRT субтитров из edited_transcript_data
  // Правила: 1 строка, ~30-40 символов, ≤10 слов
  // Длительность 1.0–6.0 сек
  generateSRTFromEditedTranscript(editedTranscriptData) {
    if (!editedTranscriptData || !editedTranscriptData.utterances) {
      throw new Error('Invalid transcript data: missing utterances');
    }

    const utterances = editedTranscriptData.utterances;
    const subtitles = [];
    let subtitleIndex = 1;

    for (let i = 0; i < utterances.length; i++) {
      const utterance = utterances[i];
      const text = (utterance.text || '').trim();
      
      if (!text) continue;

      const startMs = utterance.start || 0;
      const endMs = utterance.end || (startMs + 3000); // default 3 sec if no end
      const durationMs = endMs - startMs;

      // Разбиваем текст на сегменты по правилам
      const segments = this.splitTextForSRT(text, durationMs);
      
      segments.forEach((segment, segIndex) => {
        const segmentDuration = durationMs / segments.length;
        const segmentStart = startMs + (segIndex * segmentDuration);
        const segmentEnd = segmentStart + segmentDuration;

        // Ensure minimum 1.0 sec
        const finalEnd = Math.max(segmentEnd, segmentStart + 1000);

        subtitles.push({
          index: subtitleIndex++,
          startTime: this.formatSRTTime(segmentStart),
          endTime: this.formatSRTTime(finalEnd),
          text: segment
        });
      });
    }

    // Merge too short subtitles (<1.0 sec)
    const merged = this.mergeShortSubtitles(subtitles);

    // Split too long subtitles (>6.0 sec)
    const final = this.splitLongSubtitles(merged);

    // Generate SRT format
    return final.map(sub => 
      `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}\n`
    ).join('\n');
  }

  // Разбивка текста на сегменты: 1 строка, ~30-40 символов, ≤10 слов
  splitTextForSRT(text, durationMs) {
    const words = text.split(/\s+/);
    const segments = [];
    let currentSegment = [];
    let currentLength = 0;

    for (const word of words) {
      const willExceedWords = currentSegment.length >= 10;
      const willExceedChars = currentLength + word.length + 1 > 40;

      if (willExceedWords || willExceedChars) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment.join(' '));
          currentSegment = [];
          currentLength = 0;
        }
      }

      currentSegment.push(word);
      currentLength += word.length + 1;
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment.join(' '));
    }

    return segments.length > 0 ? segments : [text];
  }

  // Форматирование времени для SRT: HH:MM:SS,mmm
  formatSRTTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor(milliseconds % 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  // Объединение слишком коротких субтитров (<1.0 сек)
  mergeShortSubtitles(subtitles) {
    const merged = [];
    let i = 0;

    while (i < subtitles.length) {
      const current = subtitles[i];
      const duration = this.parseSRTTimeToMs(current.endTime) - this.parseSRTTimeToMs(current.startTime);

      if (duration < 1000 && i + 1 < subtitles.length) {
        // Merge with next
        const next = subtitles[i + 1];
        merged.push({
          index: merged.length + 1,
          startTime: current.startTime,
          endTime: next.endTime,
          text: `${current.text} ${next.text}`
        });
        i += 2;
      } else {
        merged.push({
          ...current,
          index: merged.length + 1
        });
        i++;
      }
    }

    return merged;
  }

  // Разбивка слишком длинных субтитров (>6.0 сек)
  splitLongSubtitles(subtitles) {
    const result = [];

    subtitles.forEach(sub => {
      const startMs = this.parseSRTTimeToMs(sub.startTime);
      const endMs = this.parseSRTTimeToMs(sub.endTime);
      const duration = endMs - startMs;

      if (duration > 6000) {
        // Split text by punctuation or whitespace
        const segments = this.splitTextForSRT(sub.text, duration);
        const segmentDuration = duration / segments.length;

        segments.forEach((segment, idx) => {
          const segStart = startMs + (idx * segmentDuration);
          const segEnd = segStart + segmentDuration;

          result.push({
            index: result.length + 1,
            startTime: this.formatSRTTime(segStart),
            endTime: this.formatSRTTime(segEnd),
            text: segment
          });
        });
      } else {
        result.push({
          ...sub,
          index: result.length + 1
        });
      }
    });

    return result;
  }

  // Парсинг SRT времени в миллисекунды
  parseSRTTimeToMs(timeString) {
    const [time, ms] = timeString.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + parseInt(ms);
  }

}

export default new TextExportService();
