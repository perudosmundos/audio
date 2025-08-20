
import axios from 'axios';
import { getLocaleString } from '@/lib/locales';
import { supabase } from './supabaseClient'; 

const ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2";

let assemblyAIApiKey = null;

const initializeAssemblyAI = async () => {
  if (assemblyAIApiKey) return assemblyAIApiKey;
  try {
    console.log("Attempting to fetch AssemblyAI API key via Edge Function...");
    const { data, error } = await supabase.functions.invoke('get-env-variables', {
      body: { variable_names: ['ASSEMBLYAI_API_KEY'] },
    });

    if (error) {
      console.error('Error invoking get-env-variables Edge Function for AssemblyAI:', error);
      throw new Error(`Failed to fetch AssemblyAI API key: ${error.message || 'Edge Function invocation failed'}`);
    }
    if (!data || !data.ASSEMBLYAI_API_KEY) {
      console.error('AssemblyAI API key not found in Edge Function response:', data);
      throw new Error('AssemblyAI API key is not available from server.');
    }
    assemblyAIApiKey = data.ASSEMBLYAI_API_KEY;
    console.log("AssemblyAI API key fetched successfully.");
    return assemblyAIApiKey;
  } catch (error) {
    console.error('Error initializing AssemblyAI:', error);
    throw error;
  }
};

const spanishSlang = [
  "Ayahuasca", "Dos Mundos", "Chiric Sanango", "Ajo Sacha", "Camalonga", "Mucura", "Oje", "Yage",
  "Zarzaparrilla", "Toe", "Durman", "Uchu sanango", "Plantas", "Tabaco", "Ayahuasca Cruda",
  "Lengua de suegra", "Malva", "Cloruro", "Aloe", "Cucarachas", "Murure", "Cumaceba", "Uña de gato",
  "Chacruna", "Ayahuasca te", "Rape", "San Pedro", "Frio del cuerpo", "Baños calientes", "Guayusa",
  "Manchinga", "Floripondio", "Chuchuhuasi", "Dieta con plantas maestras", "Comasaba", "Piñón",
  "Guava", "Pepe", "Sagrado"
];


const assemblyAIService = {
  submitTranscription: async (audioUrl, languageCodeForAssembly, episodeSupabaseIdOrSlug, currentInterfaceLanguage, targetLangForDB) => {
    try {
      const apiKey = await initializeAssemblyAI();
      
      const requestBody = {
        audio_url: audioUrl,
        language_code: languageCodeForAssembly === 'all' ? 'es' : languageCodeForAssembly, 
        speaker_labels: true,
        punctuate: true,
        format_text: true,
        words: true,
        dual_channel: false,
      };

      if (targetLangForDB === 'es') {
        requestBody.word_boost = spanishSlang;
      }
      
      if (languageCodeForAssembly !== 'ru' && languageCodeForAssembly !== 'es') {
        requestBody.disfluencies = true;
      }

      const supabaseUrlInstance = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrlInstance && episodeSupabaseIdOrSlug && targetLangForDB) {
        const encodedEpisodeSlug = encodeURIComponent(episodeSupabaseIdOrSlug);
        const encodedLang = encodeURIComponent(targetLangForDB);
        requestBody.webhook_url = `${supabaseUrlInstance}/functions/v1/assemblyai-webhook?episode_slug=${encodedEpisodeSlug}&lang=${encodedLang}`;
        console.log("Webhook URL set to:", requestBody.webhook_url);
      } else {
        console.warn("Webhook URL not set. Supabase URL, episode slug, or target language missing.");
      }

      const response = await axios.post(`${ASSEMBLYAI_API_URL}/transcript`, requestBody, {
        headers: {
          'authorization': apiKey,
          'content-type': 'application/json'
        }
      });
      return response.data; 
    } catch (error) {
      console.error("Error submitting to AssemblyAI:", error.response ? error.response.data : error.message, error.config);
      const assemblyError = error.response?.data?.error || error.message;
      throw new Error(getLocaleString('errorSubmittingAssemblyAI', currentInterfaceLanguage, {errorMessage: assemblyError}));
    }
  },

  getTranscriptionResult: async (transcriptId, currentInterfaceLanguage) => {
    try {
      const apiKey = await initializeAssemblyAI();
      const response = await axios.get(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
        headers: {
          'authorization': apiKey
        }
      });
      
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
      return responseData; 
    } catch (error) {
      console.error("Error fetching AssemblyAI result:", error.response ? error.response.data : error.message);
      const assemblyError = error.response?.data?.error || error.message;
      throw new Error(getLocaleString('errorFetchingAssemblyAIResult', currentInterfaceLanguage, {errorMessage: assemblyError}));
    }
  },
  
};

export default assemblyAIService;
