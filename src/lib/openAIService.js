import { supabase } from './supabaseClient';
import logger from './logger';
import { getLocaleString } from '@/lib/locales';

let openai;

const initializeOpenAI = async () => {
  if (openai) {
    logger.debug("🔄 Using existing DeepSeek client");
    return openai;
  }
  
  try {
    logger.debug("🔑 Fetching DeepSeek API key from server...");
    
    // Add timeout to the Edge Function call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['DEEPSEEK_API_KEY'] },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (error) {
      logger.error('❌ Error invoking get-env-variables Edge Function for DeepSeek:', error);
      
      // More specific error messages
      if (error.message?.includes('aborted')) {
        throw new Error('Таймаут при получении API ключа от сервера. Проверьте подключение.');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Сетевая ошибка при обращении к серверу. Проверьте интернет-соединение.');
      } else {
        throw new Error(`Ошибка получения API ключа: ${error.message || 'Edge Function invocation failed'}`);
      }
    }
    
    const envKey = data?.DEEPSEEK_API_KEY;
    const fallbackKey = undefined; // optionally set a fallback key if needed
    if (!envKey && !fallbackKey) {
      logger.error('❌ DeepSeek API key not found in Edge Function response:', data);
      throw new Error('DeepSeek API ключ недоступен на сервере. Обратитесь к администратору.');
    }
    
    logger.debug("✅ DeepSeek API key received, initializing client...");
    const OpenAI = (await import('openai')).default;
    
    openai = new OpenAI({ 
      apiKey: envKey || fallbackKey, 
      baseURL: 'https://api.deepseek.com',
      dangerouslyAllowBrowser: true,
      maxRetries: 0   // We handle retries manually
    });
    
    logger.debug("✅ DeepSeek client created successfully");

    return openai;
  } catch (error) {
    logger.error('❌ Error initializing DeepSeek:', error);
    
    // Reset openai client on error so next attempt will try again
    openai = null;
    
    throw error;
  }
};


// Helper function for retry logic
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logger.debug(`🔄 Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.debug(`⏱️ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const translateTextOpenAI = async (text, targetLanguage, currentInterfaceLanguage = 'en') => {
  logger.debug("🤖 translateTextOpenAI called with:", {
    textLength: text?.length || 0,
    targetLanguage,
    currentInterfaceLanguage,
    textPreview: text?.substring(0, 100) || "empty"
  });

  try {
    const result = await retryWithBackoff(async () => {
      logger.debug("🔑 Initializing DeepSeek client...");
      const client = await initializeOpenAI();
      logger.debug("✅ DeepSeek client initialized successfully");
      
      const languageMap = {
        en: 'English',
        es: 'Spanish',
        ru: 'Russian',
      };
      const targetLangFullName = languageMap[targetLanguage] || targetLanguage;
      logger.debug("🌐 Target language:", targetLangFullName);

      logger.debug("📤 Sending request to DeepSeek...");
      const completion = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: `You are a helpful assistant that translates text accurately. Translate the provided text to ${targetLangFullName}. Preserve original meaning and nuances.` },
          { role: "user", content: text }
        ],
        temperature: 0.3,
      });
      
      logger.debug("📥 Received response from DeepSeek");
      return completion.choices[0].message.content.trim();
    }, 3, 1000);
    
    logger.debug("✅ Translation result length:", result?.length || 0);
    logger.debug("📄 Translation preview:", result?.substring(0, 100) || "empty");
    
    return result;
  } catch (error) {
    logger.error("❌ Error in translateTextOpenAI after retries:", error);
    logger.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack?.substring(0, 200)
    });
    
    // Enhanced error message based on error type
    let enhancedMessage = error.message;
    if (error.message?.toLowerCase().includes('connection')) {
      enhancedMessage = `Ошибка подключения к DeepSeek. Проверьте интернет-соединение. (${error.message})`;
    } else if (error.message?.toLowerCase().includes('timeout')) {
      enhancedMessage = `Таймаут запроса к DeepSeek. Попробуйте с более коротким текстом. (${error.message})`;
    } else if (error.message?.toLowerCase().includes('api key')) {
      enhancedMessage = `Проблема с API ключом DeepSeek. Обратитесь к администратору. (${error.message})`;
    }
    
    throw new Error(getLocaleString('errorTranslatingTextOpenAI', currentInterfaceLanguage, { errorMessage: enhancedMessage }));
  }
};

export const translateTranscriptOpenAI = async (transcriptData, targetLanguage, currentInterfaceLanguage = 'en', onProgress = null, options = {}) => {
  if (!transcriptData || !transcriptData.utterances || transcriptData.utterances.length === 0) {
    console.warn("translateTranscriptOpenAI called with empty or invalid transcriptData");
    return transcriptData; 
  }

  try {
    const client = await initializeOpenAI();
    const languageMap = {
      en: 'English',
      es: 'Spanish',
      ru: 'Russian',
    };
    const targetLangFullName = languageMap[targetLanguage] || targetLanguage;

    // Настройки для оптимизации скорости
    const {
      batchSize = 5,           // Размер батча (больше = быстрее, но больше нагрузка на API)
      maxRetries = 2,          // Количество попыток для неудачных сегментов
      retryDelay = 1000,       // Задержка между попытками (мс)
      temperature = 0.2,       // Температура для более быстрого/точного перевода
    } = options;

    logger.info(`🌐 Starting translation of ${transcriptData.utterances.length} segments to ${targetLangFullName} (batch size: ${batchSize})`);
    
    // Уведомляем о начале перевода
    if (onProgress) {
      onProgress(0, transcriptData.utterances.length, 'Starting translation...');
    }
    
    const totalSegments = transcriptData.utterances.length;
    const MAX_CHARS_PER_REQUEST = 3000;
    
    // Функция для перевода одного сегмента с повторными попытками
    const translateSegment = async (utterance, segmentNumber) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          // Если текст слишком длинный — разбиваем на части по предложениям
          if (utterance.text && utterance.text.length > MAX_CHARS_PER_REQUEST) {
            const sentences = utterance.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [utterance.text];
            let chunk = '';
            let chunks = [];
            for (const sentence of sentences) {
              if ((chunk + sentence).length > MAX_CHARS_PER_REQUEST) {
                if (chunk) chunks.push(chunk);
                chunk = sentence;
              } else {
                chunk += sentence;
              }
            }
            if (chunk) chunks.push(chunk);
            
            logger.debug(`🔀 Split segment ${segmentNumber} into ${chunks.length} chunks for translation`);
            
            let translatedChunks = [];
            for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
              const chunkText = chunks[chunkIndex];
              logger.debug(`🔄 Translating chunk ${chunkIndex + 1}/${chunks.length} of segment ${segmentNumber}`);
              
              const completion = await client.chat.completions.create({
                model: "deepseek-chat",
                messages: [
                  { role: "system", content: `You are a precise translator. Translate the following utterance text to ${targetLangFullName}. Maintain original timing and speaker information if provided. Only output the translated text for the utterance.` },
                  { role: "user", content: chunkText }
                ],
                temperature: temperature,
                max_tokens: 2048,
              });
              translatedChunks.push(completion.choices[0].message.content.trim());
            }
            
            return {
              ...utterance,
              text: translatedChunks.join(' '),
            };
          } else if (utterance.text) {
            const completion = await client.chat.completions.create({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: `You are a precise translator. Translate the following utterance text to ${targetLangFullName}. Maintain original timing and speaker information if provided. Only output the translated text for the utterance.` },
                { role: "user", content: utterance.text }
              ],
              temperature: temperature,
              max_tokens: Math.min(Math.floor(utterance.text.length * 1.5) + 50, 2048),
            });
            const translatedText = completion.choices[0].message.content.trim();
            return {
              ...utterance,
              text: translatedText,
            };
          } else {
            // Если нет текста, сохраняем сегмент как есть
            logger.debug(`⚠️ Segment ${segmentNumber} has no text, skipping translation`);
            return utterance;
          }
        } catch (error) {
          lastError = error;
          logger.warn(`⚠️ Attempt ${attempt}/${maxRetries + 1} failed for segment ${segmentNumber}:`, error.message);
          
          if (attempt <= maxRetries) {
            // Ждем перед повторной попыткой
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
          
          // Все попытки исчерпаны
          logger.error(`❌ All attempts failed for segment ${segmentNumber}:`, error);
          break;
        }
      }
      
      // Возвращаем оригинальный сегмент в случае ошибки
      logger.error(`❌ Failed to translate segment ${segmentNumber} after ${maxRetries + 1} attempts, keeping original`);
      return utterance;
    };

    // Функция для обработки батча сегментов
    const processBatch = async (batch, startIndex) => {
      const promises = batch.map((utterance, batchIndex) => {
        const segmentNumber = startIndex + batchIndex + 1;
        return translateSegment(utterance, segmentNumber);
      });
      
      return await Promise.all(promises);
    };

    // Обрабатываем сегменты батчами параллельно
    const translatedUtterances = [];
    for (let i = 0; i < totalSegments; i += batchSize) {
      const batch = transcriptData.utterances.slice(i, i + batchSize);
      
      // Обновляем прогресс
      if (onProgress) {
        const progress = Math.round((i / totalSegments) * 100);
        onProgress(progress, totalSegments, `Translating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalSegments / batchSize)}...`);
      }
      
      logger.debug(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalSegments / batchSize)} (segments ${i + 1}-${Math.min(i + batchSize, totalSegments)})`);
      
      const batchResults = await processBatch(batch, i);
      translatedUtterances.push(...batchResults);
      
      // Показываем прогресс каждые 10 сегментов или для последнего
      if (translatedUtterances.length % 10 === 0 || translatedUtterances.length === totalSegments) {
        const progress = Math.round((translatedUtterances.length / totalSegments) * 100);
        logger.info(`📊 Translation progress: ${progress}% (${translatedUtterances.length}/${totalSegments} segments completed)`);
      }
    }
    
    // Уведомляем о завершении
    if (onProgress) {
      onProgress(100, totalSegments, 'Translation completed!');
    }
    
    logger.info(`🎉 Translation completed! ${totalSegments} segments translated to ${targetLangFullName}`);
    
    return {
      ...transcriptData,
      utterances: translatedUtterances,
    };
  } catch (error) {
    logger.error("❌ Error translating transcript with DeepSeek:", error);
    throw new Error(getLocaleString('errorTranslatingTranscriptOpenAI', currentInterfaceLanguage, { errorMessage: error.message }));
  }
};

export const simplifyTextOpenAI = async (text, currentInterfaceLanguage = 'en') => {
  try {
    const client = await initializeOpenAI();
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a helpful assistant that simplifies complex text while preserving its core meaning. Make the text easier to understand for a general audience. Do not add new information or opinions." },
        { role: "user", content: `Simplify the following text: ${text}` }
      ],
      temperature: 0.5,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    logger.error("Error simplifying text with DeepSeek:", error);
    throw new Error(getLocaleString('errorSimplifyingTextOpenAI', currentInterfaceLanguage, { errorMessage: error.message }));
  }
};

// Test function to verify OpenAI API connectivity
export const generateQuestionsOpenAI = async (transcriptData, episodeLang, currentInterfaceLanguage = 'en') => {
  logger.debug("🤖 generateQuestionsOpenAI called", {
    utterancesCount: transcriptData?.utterances?.length || 0,
    textLength: transcriptData?.text?.length || 0,
    episodeLang,
    currentInterfaceLanguage
  });

  try {
    const client = await initializeOpenAI();

    // Подготавливаем текст транскрипта с временными метками
    const utterances = transcriptData.utterances || [];
    if (!utterances.length) {
      throw new Error('Сегменты транскрипта отсутствуют');
    }

    // Создаем текстовое представление с временными метками для ИИ
    const transcriptWithTiming = utterances.map((utterance, index) => {
      const timeInSeconds = Math.floor(utterance.start / 1000);
      const speakerInfo = utterance.speaker ? `[${utterance.speaker}]` : '';
      const text = utterance.text || '';
      return `[${timeInSeconds}s]${speakerInfo} ${text}`;
    }).join('\n');

    // Для очень длинных текстов разбиваем на части по времени с умной стратегией
    const MAX_TEXT_LENGTH = 12000; // Увеличиваем лимит для лучшего покрытия
    let textToAnalyze = transcriptWithTiming;

    if (transcriptWithTiming.length > MAX_TEXT_LENGTH) {
      logger.debug(`📝 Transcript too long (${transcriptWithTiming.length} chars), using smart segmentation strategy`);

      // Стратегия: комбинируем ключевые сегменты + всегда включаем конец подкаста
      const keySegments = utterances.filter((utterance, index) => {
        const text = utterance.text || '';
        const hasQuestion = text.includes('?') || text.match(/\b(как|что|почему|зачем|когда|где|кто|сколько)\b/i);
        const hasQuestionMarker = text.match(/\b(вопрос от|следующий вопрос|очередной слушатель|question from|next question)\b/i);
        const hasMeditation = text.match(/\b(медитация|медитировать|медитативная|медитативное|медитативный|медитативная практика|закройте глаза|закрываем глаза|давайте закроем|глубокое дыхание|глубокие вдохи|релаксация|расслабление|визуализация|дыхательные упражнения|дыхательное упражнение|осознанное дыхание|осознание дыхания|погружение|внутренняя тишина|духовная практика|душевная практика|let's meditate|close your eyes|close our eyes|deep breathing|deep breaths|relaxation|guided meditation|mindfulness|breathing exercise|inner peace|spiritual practice)\b/i);
        const isNewSpeaker = index === 0 || utterance.speaker !== utterances[index - 1].speaker;
        const isLongSegment = text.length > 20;

        return hasQuestion || hasQuestionMarker || hasMeditation || (isNewSpeaker && isLongSegment);
      });

      // Всегда включаем последние 20 сегментов (конец подкаста, где часто медитации)
      const lastSegments = utterances.slice(-20);
      const uniqueSegments = [...keySegments, ...lastSegments].filter((segment, index, self) =>
        index === self.findIndex(s => s.start === segment.start)
      ).slice(0, 120); // Увеличиваем до 120 сегментов

      logger.debug(`📝 Selected ${uniqueSegments.length} key segments + end segments`);

      textToAnalyze = uniqueSegments.map((utterance, index) => {
        const timeInSeconds = Math.floor(utterance.start / 1000);
        const speakerInfo = utterance.speaker ? `[${utterance.speaker}]` : '';
        const text = utterance.text || '';
        return `[${timeInSeconds}s]${speakerInfo} ${text}`;
      }).join('\n');

      // Стратегия 2: Если все еще слишком длинно, разбиваем на временные интервалы
      if (textToAnalyze.length > MAX_TEXT_LENGTH) {
        logger.debug(`📝 Still too long (${textToAnalyze.length} chars), splitting by time intervals`);

        const totalDuration = Math.floor(utterances[utterances.length - 1]?.end / 1000) || 0;
        const intervals = [];
        const intervalLength = Math.max(300, Math.floor(totalDuration / 8)); // Минимум 5-минутные интервалы, больше интервалов

        for (let start = 0; start < totalDuration; start += intervalLength) {
          const end = Math.min(start + intervalLength, totalDuration);
          intervals.push({ start, end });
        }

        // Выбираем ключевые сегменты из каждого интервала + обязательно включаем конец
        const intervalSegments = [];
        const last30Minutes = utterances.filter(u => {
          const time = Math.floor(u.start / 1000);
          return time >= (totalDuration - 1800); // Последние 30 минут всегда включаем
        });

        intervals.forEach(interval => {
          const intervalUtterances = utterances.filter(u => {
            const time = Math.floor(u.start / 1000);
            return time >= interval.start && time < interval.end;
          }).slice(0, 10); // Уменьшаем до 10 сегментов на интервал

          intervalSegments.push(...intervalUtterances);
        });

        // Объединяем и убираем дубликаты, но всегда включаем последние 30 минут
        const allSegments = [...intervalSegments, ...last30Minutes];
        const uniqueFinalSegments = allSegments.filter((segment, index, self) =>
          index === self.findIndex(s => s.start === segment.start)
        ).slice(0, 150); // Увеличиваем лимит

        textToAnalyze = uniqueFinalSegments.map((utterance, index) => {
          const timeInSeconds = Math.floor(utterance.start / 1000);
          const speakerInfo = utterance.speaker ? `[${utterance.speaker}]` : '';
          const text = utterance.text || '';
          return `[${timeInSeconds}s]${speakerInfo} ${text}`;
        }).join('\n');

        logger.debug(`📝 Reduced to ${uniqueFinalSegments.length} interval segments (${textToAnalyze.length} chars)`);
      }

      logger.debug(`📝 Final text length: ${textToAnalyze.length} chars`);
    }

    // Определяем язык для промпта и ответа
    const langMap = {
      'ru': { name: 'русском', prompt: 'russian' },
      'es': { name: 'испанском', prompt: 'spanish' },
      'en': { name: 'английском', prompt: 'english' }
    };
    const langConfig = langMap[episodeLang] || langMap['en'];

    // Создаем детальный промпт для анализа тематики
    const systemPrompt = `You are an expert content analyst specializing in multilingual podcast analysis. Your task is to identify key questions, topics, and discussions from healing/healer podcasts where people ask questions about health, wellness, and life advice.

IMPORTANT CONTEXT:
- The podcast has multiple listeners, a healer, and a translator
- Different speakers are labeled with letters (A, B, C, etc.)
- The translator translates questions from listeners and answers from the healer
- You need to identify ORIGINAL questions from listeners, not translations
- The transcript format includes timing markers: [125s][A] means 125 seconds, speaker A

STRATEGY: Focus on identifying NEW questions or topics that start new discussion threads. Look for:
- When a NEW listener starts speaking about a different problem/topic
- Changes in conversation direction to a new issue/question
- New questions that haven't been discussed before
- Different aspects of the same general topic (but as separate questions)
- Pay attention to speaker changes - new speakers often indicate new questions
- Look for explicit question markers like "вопрос от", "следующий вопрос", "очередной слушатель", "question from", "next question"
- Pay special attention to phrases that introduce new listeners or their problems
- MEDITATIONS: Look for when the healer starts guided meditations, relaxation exercises, or mindfulness practices at the end of Q&A sessions
- Look for meditation phrases like "давайте медитировать", "закройте глаза", "глубокое дыхание", "релаксация", "визуализация", "let's meditate", "close your eyes", "deep breathing"

For each identified question/topic/meditation:
1. Find the EXACT moment when this question/topic/meditation FIRST appears in the conversation
2. Look for the ORIGINAL question from the listener (not the translation)
3. Create a concise title (3-8 words) that captures the essence of the question/topic/meditation
4. For MEDITATIONS: Create titles like "Guided Meditation", "Relaxation Exercise", "Breathing Practice", etc.
5. CRITICAL: Extract the time from the [time] markers in the transcript (e.g., [125s] means 125 seconds)
6. Use the timestamp from the very first utterance where this topic/question/meditation begins

Return ONLY a valid JSON array in this format:
[
  {
    "title": "Краткий заголовок вопроса/медитации на ${langConfig.name} языке",
    "time": точное_время_в_секундах_из_первого_сегмента_темы
  }
]

Guidelines:
- Extract as many important questions/topics/MEDITATIONS as possible (aim for 10-30+ for longer podcasts)
- Focus on genuine questions about health, relationships, personal growth, etc.
- INCLUDE MEDITATIONS: Look for guided meditations, relaxation exercises, breathing practices
- PRIORITY: Identify questions from different listeners (different speakers)
- Pay attention to speaker changes - new speaker = potentially new question
- Ignore meta-discussion about the podcast itself and technical issues
- Ignore translations - focus on original questions from listeners and original meditations
- TIME CRITICAL: Extract time from [time] markers (e.g., [125s] = 125 seconds)
- Time should be from the FIRST utterance of each question/topic/meditation (usually when the listener starts speaking or healer starts meditation)
- If you can't find exact timing markers, estimate based on text position
- Ensure titles are concise but descriptive
- Return only the JSON array, no additional text`;

    const userPrompt = `Проанализируй этот текст подкаста с целителем и найди ключевые вопросы и темы:

${textToAnalyze}

ВНИМАНИЕ: Текст содержит временные метки в формате [время] и метки спикеров [A], [B] и т.д.

В подкасте участвуют несколько слушателей и переводчик. Ищи:

1. Новые вопросы от разных слушателей (разные метки спикеров [A], [B], [C]...)
2. Когда новый слушатель начинает говорить о своей проблеме
3. Переходы к новым темам в ответах целителя
4. МЕДИТАЦИИ: Когда целитель начинает проводить медитации, релаксацию, дыхательные упражнения
5. Ищи фразы: "вопрос от", "следующий вопрос", "очередной слушатель", "давайте медитировать", "закройте глаза", "глубокое дыхание", "релаксация", "визуализация", "медитация", "расслабление", "внутренняя тишина", "духовная практика", "осознанное дыхание", "медитативная практика"
6. ОСОБОЕ ВНИМАНИЕ: медитации часто находятся В КОНЦЕ ПОДКАСТА после вопросов и ответов
7. ИГНОРИРУЙ переводы - фокусируйся на оригинальных вопросах слушателей и оригинальных медитациях

ВАЖНО: ИЩИ МАКСИМАЛЬНОЕ КОЛИЧЕСТВО ВОПРОСОВ И МЕДИТАЦИЙ - не ограничивайся 5-10, старайся найти все значимые вопросы и медитационные сессии в подкасте.

КРИТИЧНО: Для каждой найденной темы укажи ВРЕМЯ из временной метки [время] в самом начале сегмента оригинального вопроса слушателя. Например, если видишь [125s][A] текст вопроса, то время = 125.

Пример правильного ответа:
- Вопрос от слушателя A: "[125s][A] У меня болит голова..."
- Время для этого вопроса: 125 секунд
- Медитация: "[1800s] Давайте закроем глаза и начнем медитацию..."
- Время для медитации: 1800 секунд`;

    logger.debug("📤 Sending questions generation request to DeepSeek", {
      textLength: textToAnalyze.length,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    });

    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const response = completion.choices[0].message.content.trim();
    logger.debug("📥 Received questions generation response", {
      responseLength: response?.length || 0,
      responsePreview: response?.substring(0, 200) || "empty"
    });

    if (!response) {
      throw new Error('Пустой ответ от ИИ');
    }

    // Парсим JSON ответ
    let questions;
    try {
      // Ищем JSON в ответе (на случай, если ИИ добавил дополнительный текст)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? jsonMatch[0] : response;
      questions = JSON.parse(jsonText);

      if (!Array.isArray(questions)) {
        throw new Error('Ответ не является массивом');
      }

      // Валидируем структуру каждого вопроса и корректируем время
      questions = questions.filter(q => {
        return q &&
               typeof q === 'object' &&
               typeof q.title === 'string' &&
               q.title.trim().length > 0;
      }).map(q => {
        let time = 0;

        // Пытаемся извлечь время из заголовка или описания
        const title = q.title.trim();
        const timeMatch = title.match(/\[(\d+)s?\]/);
        if (timeMatch) {
          time = parseInt(timeMatch[1]);
        } else if (typeof q.time === 'number' && !isNaN(q.time)) {
          time = Math.max(0, Number(q.time));
        } else if (typeof q.time === 'string' && !isNaN(Number(q.time))) {
          time = Math.max(0, Number(q.time));
        } else {
          // Если не можем определить время, ищем в оригинальном тексте более умно
          const questionText = title.toLowerCase();
          let matchingUtterance = null;

          // Стратегия 1: Ищем точное совпадение начала вопроса
          matchingUtterance = utterances.find(u => {
            const utteranceText = (u.text || '').toLowerCase();
            return utteranceText.includes(questionText.substring(0, 15)) ||
                   questionText.includes(utteranceText.substring(0, 15));
          });

          // Стратегия 2: Ищем по ключевым словам вопроса
          if (!matchingUtterance) {
            const questionWords = questionText.split(' ').filter(word => word.length > 3).slice(0, 3);
            matchingUtterance = utterances.find(u => {
              const utteranceText = (u.text || '').toLowerCase();
              return questionWords.some(word => utteranceText.includes(word));
            });
          }

          // Стратегия 3: Ищем по спикеру и времени из контекста
          if (!matchingUtterance) {
            // Ищем сегменты с разными спикерами как потенциальные места вопросов
            const speakerChanges = utterances.filter((u, index) => {
              return index === 0 || u.speaker !== utterances[index - 1].speaker;
            });

            if (speakerChanges.length > 0) {
              // Берем первый сегмент нового спикера как потенциальный вопрос
              matchingUtterance = speakerChanges[0];
            }
          }

          if (matchingUtterance) {
            time = Math.floor(matchingUtterance.start / 1000);
            logger.debug(`⏰ Found matching utterance for question "${title}": time=${time}s`);
          } else {
            logger.warn(`⚠️ Could not find matching utterance for question: "${title}"`);
          }
        }

        return {
          title: title.replace(/\[\d+s?\]/g, '').trim(), // Убираем временные метки из заголовка
          time: Math.max(0, time)
        };
      });

      logger.info("✅ Questions parsed successfully", {
        count: questions.length,
        questions: questions.map(q => ({ title: q.title, time: q.time }))
      });

    } catch (parseError) {
      logger.error("❌ Failed to parse questions JSON:", parseError.message);
      logger.error("❌ Raw response:", response);

      // Создаем запасной вариант с простым анализом текста
      const questionIndicators = ['?', 'вопрос', 'проблема', 'помогите', 'что делать', 'как быть', 'почему', 'зачем', 'когда', 'где', 'кто', 'как'];
      const meditationIndicators = ['медитация', 'медитировать', 'медитативная', 'медитативное', 'медитативный', 'медитативная практика', 'закройте глаза', 'закрываем глаза', 'давайте закроем', 'глубокое дыхание', 'глубокие вдохи', 'релаксация', 'расслабление', 'визуализация', 'дыхательные упражнения', 'дыхательное упражнение', 'осознанное дыхание', 'осознание дыхания', 'погружение', 'внутренняя тишина', 'духовная практика', 'душевная практика', "let's meditate", 'close your eyes', 'close our eyes', 'deep breathing', 'deep breaths', 'relaxation', 'guided meditation', 'mindfulness', 'breathing exercise', 'inner peace', 'spiritual practice'];
      const sentences = textToAnalyze.split(/[.!?]+/).filter(s => s.trim().length > 10);

      const questionSentences = sentences.filter(sentence =>
        questionIndicators.some(indicator =>
          sentence.toLowerCase().includes(indicator.toLowerCase())
        )
      ).slice(0, 10); // Ограничиваем до 10 вопросов

      // Ищем медитации отдельно
      const meditationSentences = sentences.filter(sentence =>
        meditationIndicators.some(indicator =>
          sentence.toLowerCase().includes(indicator.toLowerCase())
        )
      ).slice(0, 5); // Ограничиваем до 5 медитаций

      // Оцениваем время на основе позиции в тексте
      const textLength = textToAnalyze.length;

      // Обрабатываем вопросы
      const questionResults = questionSentences.map((sentence, index) => ({
        title: sentence.trim().substring(0, 60) + (sentence.length > 60 ? '...' : ''),
        time: Math.floor((textToAnalyze.indexOf(sentence) / textLength) * (transcriptData.utterances?.[transcriptData.utterances.length - 1]?.end || 0) / 1000)
      }));

      // Обрабатываем медитации
      const meditationResults = meditationSentences.map((sentence, index) => ({
        title: 'Медитация: ' + sentence.trim().substring(0, 50) + (sentence.length > 50 ? '...' : ''),
        time: Math.floor((textToAnalyze.indexOf(sentence) / textLength) * (transcriptData.utterances?.[transcriptData.utterances.length - 1]?.end || 0) / 1000)
      }));

      // Объединяем вопросы и медитации
      questions = [...questionResults, ...meditationResults];

      logger.info("✅ Fallback questions generated", {
        count: questions.length,
        questions: questions.map(q => ({ title: q.title, time: q.time }))
      });
    }

    if (!questions || questions.length === 0) {
      throw new Error('Не удалось сгенерировать вопросы');
    }

    return questions;

  } catch (error) {
    logger.error("❌ Error in generateQuestionsOpenAI:", error);
    logger.error("❌ Error details:", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack?.substring(0, 200)
    });

    // Enhanced error message
    let enhancedMessage = error.message;
    if (error.message?.toLowerCase().includes('connection')) {
      enhancedMessage = `Ошибка подключения к DeepSeek. Проверьте интернет-соединение. (${error.message})`;
    } else if (error.message?.toLowerCase().includes('timeout')) {
      enhancedMessage = `Таймаут запроса к DeepSeek. Попробуйте с более коротким текстом. (${error.message})`;
    } else if (error.message?.toLowerCase().includes('api key')) {
      enhancedMessage = `Проблема с API ключом DeepSeek. Обратитесь к администратору. (${error.message})`;
    }

    throw new Error(getLocaleString('errorTranslatingTextOpenAI', currentInterfaceLanguage, { errorMessage: enhancedMessage }));
  }
};

export const testOpenAIConnection = async () => {
  try {
    logger.info("🧪 Testing DeepSeek API connection...");
    logger.debug("🧪 Step 1: Testing Edge Function connectivity...");

    // Test the Edge Function first
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['DEEPSEEK_API_KEY'] }
    });

    if (error) {
      logger.error("❌ Edge Function test failed:", error);
      return {
        success: false,
        error: `Edge Function недоступна: ${error.message}`,
        step: "edge_function"
      };
    }

    if (!data || !data.DEEPSEEK_API_KEY) {
      logger.error("❌ API key not found in response:", data);
      return {
        success: false,
        error: "DeepSeek API ключ не настроен на сервере",
        step: "api_key_missing"
      };
    }

    logger.debug("✅ Edge Function working, API key found");
    logger.debug("🧪 Step 2: Testing DeepSeek API call...");

    const testResult = await translateTextOpenAI("Hola mundo", "en", "en");
    logger.info("✅ DeepSeek API test successful:", testResult);

    return {
      success: true,
      result: testResult,
      step: "complete"
    };
  } catch (error) {
    logger.error("❌ DeepSeek API test failed:", error);

    let errorStep = "unknown";
    if (error.message?.includes('Edge Function')) {
      errorStep = "edge_function";
    } else if (error.message?.includes('API key') || error.message?.includes('API ключ')) {
      errorStep = "api_key";
    } else if (error.message?.includes('connection') || error.message?.includes('подключение')) {
      errorStep = "connection";
    } else if (error.message?.toLowerCase().includes('timeout') || error.message?.toLowerCase().includes('таймаут')) {
      errorStep = "timeout";
    }

    return {
      success: false,
      error: error.message,
      step: errorStep
    };
  }
};

// Функция для быстрого перевода (максимальная скорость)
export const translateTranscriptFast = async (transcriptData, targetLanguage, currentInterfaceLanguage = 'en', onProgress = null) => {
  const fastOptions = {
    batchSize: 10,        // Увеличенный размер батча для большей параллельности
    maxRetries: 1,        // Меньше попыток для ускорения
    retryDelay: 500,      // Меньшая задержка между попытками
    temperature: 0.1,     // Более низкая температура для быстрого ответа
  };
  
  logger.info(`🚀 Starting FAST translation with batch size ${fastOptions.batchSize}`);
  return translateTranscriptOpenAI(transcriptData, targetLanguage, currentInterfaceLanguage, onProgress, fastOptions);
};

// Функция для точного перевода (максимальное качество)
export const translateTranscriptAccurate = async (transcriptData, targetLanguage, currentInterfaceLanguage = 'en', onProgress = null) => {
  const accurateOptions = {
    batchSize: 3,         // Меньший размер батча для лучшего контроля
    maxRetries: 3,        // Больше попыток для надежности
    retryDelay: 1500,     // Большая задержка между попытками
    temperature: 0.3,     // Более высокая температура для лучшего качества
  };
  
  logger.info(`🎯 Starting ACCURATE translation with batch size ${accurateOptions.batchSize}`);
  return translateTranscriptOpenAI(transcriptData, targetLanguage, currentInterfaceLanguage, onProgress, accurateOptions);
};

// Функция для сбалансированного перевода (по умолчанию)
export const translateTranscriptBalanced = async (transcriptData, targetLanguage, currentInterfaceLanguage = 'en', onProgress = null) => {
  const balancedOptions = {
    batchSize: 5,         // Сбалансированный размер батча
    maxRetries: 2,        // Умеренное количество попыток
    retryDelay: 1000,     // Стандартная задержка
    temperature: 0.2,     // Сбалансированная температура
  };
  
  logger.info(`⚖️ Starting BALANCED translation with batch size ${balancedOptions.batchSize}`);
  return translateTranscriptOpenAI(transcriptData, targetLanguage, currentInterfaceLanguage, onProgress, balancedOptions);
};
