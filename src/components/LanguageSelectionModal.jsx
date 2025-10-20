import React from 'react';
import { getLocaleString } from '@/lib/locales';
import { RussianFlag, SpanishFlag, USFlag, GermanFlag, FrenchFlag, PolishFlag } from './ui/flags';

const LanguageSelectionModal = ({ onLanguageSelect, currentLanguage, compact = false }) => {
  const availableLanguages = [
    { code: 'ru', name: "Русский", Flag: RussianFlag },
    { code: 'es', name: "Español", Flag: SpanishFlag },
    { code: 'en', name: "English", Flag: USFlag },
    { code: 'de', name: "Deutsch", Flag: GermanFlag },
    { code: 'fr', name: "Français", Flag: FrenchFlag },
    { code: 'pl', name: "Polski", Flag: PolishFlag },
  ];

  // Компактный режим для использования в настройках
  if (compact) {
    return (
      <div className="space-y-3">
        {availableLanguages.map(lang => (
          <button
            key={lang.code}
            onClick={() => onLanguageSelect(lang.code)}
            className={`w-full py-2 px-3 rounded-lg transition-colors flex items-center gap-3 text-left
              ${currentLanguage === lang.code 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
              }`}
          >
            <lang.Flag className="w-4 h-3 flex-shrink-0" />
            {lang.name}
          </button>
        ))}
      </div>
    );
  }

  // Полный модальный режим
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl border border-slate-700 max-w-md w-full text-center animate-scale-in">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 text-purple-400">🌐</div>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">{getLocaleString('selectLanguageModalTitle', currentLanguage)}</h2>
        <p className="text-slate-400 text-sm mb-6">
          {getLocaleString('selectLanguageModalDescription', currentLanguage)}
        </p>
        <div className="flex flex-col gap-3 sm:gap-4">
          {availableLanguages.map(lang => (
            <button
              key={lang.code}
              onClick={() => onLanguageSelect(lang.code)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-base py-3 rounded-lg transition-colors flex items-center justify-center gap-3"
            >
              <lang.Flag className="w-5 h-4 flex-shrink-0" />
              {lang.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectionModal;