import { supabase } from './supabaseClient';
import { getLocaleString } from '@/lib/locales';

let openai;

const initializeOpenAI = async () => {
  if (openai) {
    console.log("🔄 Using existing OpenAI client");
    return openai;
  }
  
  try {
    console.log("🔑 Fetching OpenAI API key from server...");
    
    // Add timeout to the Edge Function call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['OPENAI_API_KEY'] },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (error) {
      console.error('❌ Error invoking get-env-variables Edge Function for OpenAI:', error);
      
      // More specific error messages
      if (error.message?.includes('aborted')) {
        throw new Error('Таймаут при получении API ключа от сервера. Проверьте подключение.');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Сетевая ошибка при обращении к серверу. Проверьте интернет-соединение.');
      } else {
        throw new Error(`Ошибка получения API ключа: ${error.message || 'Edge Function invocation failed'}`);
      }
    }
    
    if (!data || !data.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not found in Edge Function response:', data);
      throw new Error('OpenAI API ключ недоступен на сервере. Обратитесь к администратору.');
    }
    
    console.log("✅ OpenAI API key received, initializing client...");
    const OpenAI = (await import('openai')).default;
    
    openai = new OpenAI({ 
      apiKey: data.OPENAI_API_KEY, 
      dangerouslyAllowBrowser: true,
      timeout: 30000, // 30 second timeout for OpenAI requests
      maxRetries: 2   // Built-in OpenAI retry
    });
    
    console.log("✅ OpenAI client created successfully");

    return openai;
  } catch (error) {
    console.error('❌ Error initializing OpenAI:', error);
    
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
      console.log(`🔄 Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⏱️ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const translateTextOpenAI = async (text, targetLanguage, currentInterfaceLanguage = 'en') => {
  console.log("🤖 translateTextOpenAI called with:", {
    textLength: text?.length || 0,
    targetLanguage,
    currentInterfaceLanguage,
    textPreview: text?.substring(0, 100) || "empty"
  });

  try {
    const result = await retryWithBackoff(async () => {
      console.log("🔑 Initializing OpenAI client...");
      const client = await initializeOpenAI();
      console.log("✅ OpenAI client initialized successfully");
      
      const languageMap = {
        en: 'English',
        es: 'Spanish',
        ru: 'Russian',
      };
      const targetLangFullName = languageMap[targetLanguage] || targetLanguage;
      console.log("🌐 Target language:", targetLangFullName);

      console.log("📤 Sending request to OpenAI...");
      const completion = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `You are a helpful assistant that translates text accurately. Translate the provided text to ${targetLangFullName}. Preserve original meaning and nuances.` },
          { role: "user", content: text }
        ],
        temperature: 0.3,
        timeout: 30000, // 30 second timeout
      });
      
      console.log("📥 Received response from OpenAI");
      return completion.choices[0].message.content.trim();
    }, 3, 1000);
    
    console.log("✅ Translation result length:", result?.length || 0);
    console.log("📄 Translation preview:", result?.substring(0, 100) || "empty");
    
    return result;
  } catch (error) {
    console.error("❌ Error in translateTextOpenAI after retries:", error);
    console.error("❌ Error details:", {
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
      enhancedMessage = `Ошибка подключения к OpenAI. Проверьте интернет-соединение. (${error.message})`;
    } else if (error.message?.toLowerCase().includes('timeout')) {
      enhancedMessage = `Таймаут запроса к OpenAI. Попробуйте с более коротким текстом. (${error.message})`;
    } else if (error.message?.toLowerCase().includes('api key')) {
      enhancedMessage = `Проблема с API ключом OpenAI. Обратитесь к администратору. (${error.message})`;
    }
    
    throw new Error(getLocaleString('errorTranslatingTextOpenAI', currentInterfaceLanguage, { errorMessage: enhancedMessage }));
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

// Test function to verify OpenAI API connectivity
export const testOpenAIConnection = async () => {
  try {
    console.log("🧪 Testing OpenAI API connection...");
    console.log("🧪 Step 1: Testing Edge Function connectivity...");
    
    // Test the Edge Function first
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['OPENAI_API_KEY'] }
    });
    
    if (error) {
      console.error("❌ Edge Function test failed:", error);
      return { 
        success: false, 
        error: `Edge Function недоступна: ${error.message}`,
        step: "edge_function"
      };
    }
    
    if (!data || !data.OPENAI_API_KEY) {
      console.error("❌ API key not found in response:", data);
      return { 
        success: false, 
        error: "OpenAI API ключ не настроен на сервере",
        step: "api_key_missing"
      };
    }
    
    console.log("✅ Edge Function working, API key found");
    console.log("🧪 Step 2: Testing OpenAI API call...");
    
    const testResult = await translateTextOpenAI("Hola mundo", "en", "en");
    console.log("✅ OpenAI API test successful:", testResult);
    
    return { 
      success: true, 
      result: testResult,
      step: "complete"
    };
  } catch (error) {
    console.error("❌ OpenAI API test failed:", error);
    
    let errorStep = "unknown";
    if (error.message?.includes('Edge Function')) {
      errorStep = "edge_function";
    } else if (error.message?.includes('API key') || error.message?.includes('API ключ')) {
      errorStep = "api_key";
    } else if (error.message?.includes('connection') || error.message?.includes('подключение')) {
      errorStep = "connection";
    } else if (error.message?.includes('timeout') || error.message?.includes('таймаут')) {
      errorStep = "timeout";
    }
    
    return { 
      success: false, 
      error: error.message,
      step: errorStep
    };
  }
};
