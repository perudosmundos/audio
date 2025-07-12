import { supabase } from './supabaseClient';
import { getLocaleString } from '@/lib/locales';

let openai;

const initializeOpenAI = async () => {
  if (openai) return openai;
  try {
    console.log("Attempting to fetch OpenAI API key via Edge Function...");
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['OPENAI_API_KEY'] }, 
    });

    if (error) {
      console.error('Error invoking get-env-variables Edge Function for OpenAI:', error);
      throw new Error(`Failed to fetch OpenAI API key: ${error.message || 'Edge Function invocation failed'}`);
    }
    if (!data || !data.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in Edge Function response:', data);
      throw new Error('OpenAI API key is not available from server.');
    }
    
    const OpenAI = (await import('openai')).default;
    openai = new OpenAI({ apiKey: data.OPENAI_API_KEY, dangerouslyAllowBrowser: true });
    console.log("OpenAI API key fetched and client initialized successfully.");
    return openai;
  } catch (error) {
    console.error('Error initializing OpenAI:', error);
    throw error;
  }
};


export const translateTextOpenAI = async (text, targetLanguage, currentInterfaceLanguage = 'en') => {
  try {
    const client = await initializeOpenAI();
    const languageMap = {
      en: 'English',
      es: 'Spanish',
      ru: 'Russian',
    };
    const targetLangFullName = languageMap[targetLanguage] || targetLanguage;

    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `You are a helpful assistant that translates text accurately. Translate the provided text to ${targetLangFullName}. Preserve original meaning and nuances.` },
        { role: "user", content: text }
      ],
      temperature: 0.3,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error translating text with OpenAI:", error);
    throw new Error(getLocaleString('errorTranslatingTextOpenAI', currentInterfaceLanguage, { errorMessage: error.message }));
  }
};

export const translateTranscriptOpenAI = async (transcriptData, targetLanguage, currentInterfaceLanguage = 'en') => {
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

    const translatedUtterances = [];
    const MAX_CHARS_PER_REQUEST = 3000;

    for (const utterance of transcriptData.utterances) {
      // Если текст слишком длинный — разбиваем на части по предложениям
      if (utterance.text.length > MAX_CHARS_PER_REQUEST) {
        // Разбиваем по предложениям
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
        let translatedChunks = [];
        for (const chunkText of chunks) {
          const completion = await client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: `You are a precise translator. Translate the following utterance text to ${targetLangFullName}. Maintain original timing and speaker information if provided. Only output the translated text for the utterance.` },
              { role: "user", content: chunkText }
            ],
            temperature: 0.2,
            max_tokens: 2048,
          });
          translatedChunks.push(completion.choices[0].message.content.trim());
        }
        translatedUtterances.push({
          ...utterance,
          text: translatedChunks.join(' '),
        });
      } else {
        const completion = await client.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: `You are a precise translator. Translate the following utterance text to ${targetLangFullName}. Maintain original timing and speaker information if provided. Only output the translated text for the utterance.` },
            { role: "user", content: utterance.text }
          ],
          temperature: 0.2,
          max_tokens: Math.min(Math.floor(utterance.text.length * 1.5) + 50, 2048),
        });
        const translatedText = completion.choices[0].message.content.trim();
        translatedUtterances.push({
          ...utterance,
          text: translatedText,
        });
      }
    }
    return {
      ...transcriptData,
      utterances: translatedUtterances,
    };
  } catch (error) {
    console.error("Error translating transcript with OpenAI:", error);
    throw new Error(getLocaleString('errorTranslatingTranscriptOpenAI', currentInterfaceLanguage, { errorMessage: error.message }));
  }
};

export const simplifyTextOpenAI = async (text, currentInterfaceLanguage = 'en') => {
  try {
    const client = await initializeOpenAI();
    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that simplifies complex text while preserving its core meaning. Make the text easier to understand for a general audience. Do not add new information or opinions." },
        { role: "user", content: `Simplify the following text: ${text}` }
      ],
      temperature: 0.5,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error simplifying text with OpenAI:", error);
    throw new Error(getLocaleString('errorSimplifyingTextOpenAI', currentInterfaceLanguage, { errorMessage: error.message }));
  }
};
