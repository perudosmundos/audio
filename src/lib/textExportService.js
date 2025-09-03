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


}

export default new TextExportService();
