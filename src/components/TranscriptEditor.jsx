import React from 'react';
import { getLocaleString } from '@/lib/locales';

const TranscriptEditor = ({ currentLanguage = 'en' }) => {
  return (
    <div className="p-4 text-center text-slate-400">
      <p>{getLocaleString('transcriptEditorTitle', currentLanguage)}</p>
      <p className="text-sm mt-2">
        {currentLanguage === 'ru' 
          ? 'Редактирование транскрипта доступно в основном плеере через интерфейс вопросов.'
          : currentLanguage === 'es'
          ? 'La edición de transcripciones está disponible en el reproductor principal a través de la interfaz de preguntas.'
          : 'Transcript editing is available in the main player through the questions interface.'
        }
      </p>
    </div>
  );
};

export default TranscriptEditor;