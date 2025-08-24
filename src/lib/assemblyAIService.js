
import axios from 'axios';
import { getLocaleString } from '@/lib/locales';
import { supabase } from './supabaseClient'; 
import logger from './logger';

const ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2";

let assemblyAIApiKey = null;

const initializeAssemblyAI = async () => {
  if (assemblyAIApiKey) {
    logger.debug("Using cached AssemblyAI API key");
    return assemblyAIApiKey;
  }
  
  try {
    logger.info("Initializing AssemblyAI API key...");
    
    // 1) Try localStorage (user-provided in settings UI)
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('ASSEMBLYAI_API_KEY');
        if (stored && typeof stored === 'string' && stored.trim()) {
          assemblyAIApiKey = stored.trim();
          logger.info("AssemblyAI API key loaded from localStorage");
          return assemblyAIApiKey;
        } else {
          logger.debug("No AssemblyAI API key found in localStorage");
        }
      }
    } catch (err) {
      logger.warn('Failed to read ASSEMBLYAI_API_KEY from localStorage:', err?.message);
    }

    logger.info("Attempting to fetch AssemblyAI API key via Edge Function...");
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['ASSEMBLYAI_API_KEY'] },
    });

    if (error) {
      logger.error('Error invoking get-env-variables Edge Function for AssemblyAI:', error);
      throw new Error(`Failed to fetch AssemblyAI API key: ${error.message || 'Edge Function invocation failed'}`);
    }
    
    if (!data || !data.ASSEMBLYAI_API_KEY) {
      logger.error('AssemblyAI API key not found in Edge Function response:', data);
      throw new Error('AssemblyAI API key is not available from server.');
    }
    
    assemblyAIApiKey = data.ASSEMBLYAI_API_KEY;
    logger.info("AssemblyAI API key fetched successfully from Edge Function");
    return assemblyAIApiKey;
  } catch (error) {
    logger.error('Error initializing AssemblyAI:', error);
    throw error;
  }
};

const assemblyAIService = {
  uploadDirect: async (fileOrBlob) => {
    try {
      const apiKey = await initializeAssemblyAI();
      const data = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob], { type: fileOrBlob?.type || 'application/octet-stream' });
      const response = await axios.post(`${ASSEMBLYAI_API_URL}/upload`, data, {
        headers: {
          'authorization': apiKey,
          'content-type': data.type || 'application/octet-stream'
        },
        maxBodyLength: Infinity,
      });
      return response.data?.upload_url;
    } catch (error) {
      console.error('Error uploading audio to AssemblyAI:', error.response ? error.response.data : error.message);
      throw error;
    }
  },
  submitTranscription: async (audioUrl, languageCodeForAssembly, episodeSupabaseIdOrSlug, currentInterfaceLanguage, targetLangForDB) => {
    try {
      logger.info("Starting AssemblyAI transcription submission", {
        audioUrl: audioUrl?.substring(0, 100) + '...',
        languageCode: languageCodeForAssembly,
        episodeSlug: episodeSupabaseIdOrSlug,
        targetLang: targetLangForDB
      });
      
      const apiKey = await initializeAssemblyAI();
      logger.info("AssemblyAI API key initialized successfully", {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey?.substring(0, 8) + '...' || 'none'
      });
      
      // Request body with enhanced features for Russian and Spanish
      const requestBody = {
        audio_url: audioUrl,
        language_code: languageCodeForAssembly === 'all' ? 'es' : languageCodeForAssembly,
        speaker_labels: true, // Enable speaker recognition for all languages
        punctuate: true,
        format_text: true,
        dual_channel: false
      };

      // Enhanced request for Russian and Spanish with full feature set
      if (languageCodeForAssembly === 'ru' || languageCodeForAssembly === 'es') {
        logger.debug(`Using enhanced request for ${languageCodeForAssembly} language with speaker labels and full features`);
      } else {
        // For other languages, keep existing logic
        // No additional features needed
      }

      // Note: Webhook is not available on Vercel, using polling instead
      logger.info("Webhook disabled - using polling for status updates");

      logger.info("AssemblyAI request body prepared", {
        audioUrl: requestBody.audio_url?.substring(0, 100) + '...',
        languageCode: requestBody.language_code,
        speakerLabels: requestBody.speaker_labels,
        punctuate: requestBody.punctuate,
        formatText: requestBody.format_text,
        dualChannel: requestBody.dual_channel
      });

      logger.info("Submitting to AssemblyAI with URL:", requestBody.audio_url);
      logger.debug('AssemblyAI request body (partial)', { 
        language_code: requestBody.language_code, 
        speaker_labels: requestBody.speaker_labels, 
        punctuate: requestBody.punctuate, 
        format_text: requestBody.format_text
      });
      // Avoid logging full request body to prevent sensitive data leakage

      let response;
      try {
        logger.info("Sending request to AssemblyAI API", {
          url: `${ASSEMBLYAI_API_URL}/transcript`,
          method: 'POST',
          timeout: 25000,
          hasApiKey: !!apiKey
        });
        
        response = await axios.post(`${ASSEMBLYAI_API_URL}/transcript`, requestBody, {
          headers: {
            'authorization': apiKey,
            'content-type': 'application/json'
          },
          timeout: 25000,
        });
        
        logger.info("AssemblyAI API request sent successfully");
      } catch (primaryError) {
        logger.warn('Primary submit to AssemblyAI failed, considering proxy fallback', {
          error: primaryError?.message,
          status: primaryError?.response?.status,
          data: primaryError?.response?.data
        });
        
        const msg = primaryError?.message || '';
        const transient = /Network\s*Error|ERR_HTTP2|HTTP2.*PING.*FAILED|timeout|ETIMEDOUT|ECONN|ENOTFOUND/i.test(msg);
        
        if (transient) {
          // Fallback to server proxy
          logger.info('Falling back to /api/assemblyai proxy for submission');
          try {
            response = await axios.post(`/api/assemblyai`, requestBody, { timeout: 25000 });
            logger.info('Proxy fallback successful');
          } catch (proxyError) {
            logger.error('Proxy fallback also failed', { error: proxyError?.message });
            throw primaryError; // Throw original error if proxy also fails
          }
        } else {
          throw primaryError;
        }
      }
      
      logger.info("AssemblyAI response received", { 
        status: response?.status, 
        jobId: response?.data?.id, 
        jobStatus: response?.data?.status,
        responseData: response?.data 
      });
      
      return response.data; 
    } catch (error) {
      // Детальное логирование ошибки
      logger.error("Error submitting to AssemblyAI:", {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        request: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
          hasAudioUrl: !!requestBody.audio_url,
          languageCode: requestBody.language_code,
          speakerLabels: requestBody.speaker_labels
        }
      });
      
      // Определяем тип ошибки
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        // Сервер ответил с ошибкой
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = 'AssemblyAI API key is invalid or expired';
        } else if (status === 400) {
          errorMessage = `Bad request: ${data?.error || 'Invalid parameters'}`;
        } else if (status === 403) {
          errorMessage = 'Access denied - check API key permissions';
        } else if (status === 429) {
          errorMessage = 'Rate limit exceeded - too many requests';
        } else if (status >= 500) {
          errorMessage = `AssemblyAI server error: ${data?.error || 'Internal server error'}`;
        } else {
          errorMessage = `HTTP ${status}: ${data?.error || error.response.statusText}`;
        }
      } else if (error.request) {
        // Запрос был отправлен, но ответ не получен
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout - AssemblyAI server is not responding';
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Network error - check internet connection';
        } else {
          errorMessage = `Request failed: ${error.message}`;
        }
      } else {
        // Ошибка в настройке запроса
        errorMessage = `Request setup error: ${error.message}`;
      }
      
      logger.error("AssemblyAI error details:", { errorMessage, originalError: error.message });
      throw new Error(`AssemblyAI Error: ${errorMessage}`);
    }
  },
  // Helper to presign GET if public URL is not accessible
  getPresignedGetUrl: async (objectKey) => {
    try {
      const resp = await fetch(`/api/s3-presign-get?key=${encodeURIComponent(objectKey)}`);
      if (!resp.ok) throw new Error(`Presign GET failed: ${resp.status}`);
      const json = await resp.json();
      return json?.url || null;
    } catch (e) {
      logger.warn('Presign GET error:', e.message);
      return null;
    }
  },

  getTranscriptionResult: async (transcriptId, currentInterfaceLanguage) => {
    const apiKey = await initializeAssemblyAI();
    const maxAttempts = 3;
    let attempt = 0;
    // Basic retry for transient HTTP/2 / network errors
    while (attempt < maxAttempts) {
      try {
        let response;
        try {
          response = await axios.get(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
            headers: {
              'authorization': apiKey
            },
            timeout: 60000, // Увеличиваем timeout до 60 секунд для длительных транскрипций
          });
        } catch (primaryError) {
          logger.warn('Primary fetch from AssemblyAI failed, considering proxy fallback', primaryError?.message || primaryError);
          const msg = primaryError?.message || '';
          const transient = /Network\s*Error|ERR_HTTP2|HTTP2.*PING.*FAILED|timeout|ETIMEDOUT|ECONN|ENOTFOUND/i.test(msg);
          if (transient) {
            logger.info('Falling back to /api/assemblyai proxy for fetching result');
            response = await axios.get(`/api/assemblyai`, { params: { id: transcriptId }, timeout: 60000 });
          } else {
            throw primaryError;
          }
        }
        const responseData = { ...response.data };
        if (responseData.utterances) {
          responseData.utterances = responseData.utterances.map(utt => ({
            start: utt.start,
            end: utt.end,
            text: utt.text,
            speaker: utt.speaker,
            words: utt.words || []
          }));
        }
        
        logger.info("AssemblyAI transcript result fetched", { 
          transcriptId, 
          status: responseData.status, 
          utterancesCount: responseData.utterances?.length || 0,
          hasSpeakerLabels: !!responseData.utterances?.[0]?.speaker
        });
        
        return responseData;
      } catch (error) {
        const message = error?.message || '';
        const transient = /Network\s*Error|ERR_HTTP2|HTTP2.*PING.*FAILED|Failed to fetch|timeout|ETIMEDOUT|ECONN|ENOTFOUND/i.test(message);
        logger.error("Error fetching AssemblyAI result:", error.response ? error.response.data : message);
        attempt += 1;
        if (transient && attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }
        const assemblyError = error.response?.data?.error || message;
        throw new Error(getLocaleString('errorFetchingAssemblyAIResult', currentInterfaceLanguage, { errorMessage: assemblyError }));
      }
    }
  },
  
  // Test function to verify API key
  testApiKey: async () => {
    try {
      const apiKey = await initializeAssemblyAI();
      logger.info("Testing AssemblyAI API key...");
      
      // Try to make a simple request to test the API key
      const response = await axios.get(`${ASSEMBLYAI_API_URL}/transcript`, {
        headers: {
          'authorization': apiKey
        },
        timeout: 10000,
      });
      
      logger.info("AssemblyAI API key test successful", { status: response.status });
      return { success: true, message: 'API key is valid' };
    } catch (error) {
      logger.error("AssemblyAI API key test failed", { error: error.message });
      return { 
        success: false, 
        message: error.message,
        details: {
          status: error.response?.status,
          error: error.response?.data?.error
        }
      };
    }
  },
  
};

// Export for debugging in browser console
if (typeof window !== 'undefined') {
  window.testAssemblyAI = assemblyAIService.testApiKey;
  window.assemblyAIService = assemblyAIService;
}

export default assemblyAIService;
