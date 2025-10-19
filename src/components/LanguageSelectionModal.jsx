import React from 'react';
import { getLocaleString } from '@/lib/locales';

const LanguageSelectionModal = ({ onLanguageSelect, currentLanguage }) => {
  const availableLanguages = [
    { code: 'ru', name: "Русский", flag: '🇷🇺' },
    { code: 'es', name: "Español", flag: '🇪🇸' },
    { code: 'en', name: "English", flag: '🇺🇸' },
    { code: 'de', name: "Deutsch", flag: '🇩🇪' },
    { code: 'fr', name: "Français", flag: '🇫🇷' },
    { code: 'pl', name: "Polski", flag: '🇵🇱' },
  ];

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
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-base py-3 rounded-lg transition-colors"
            >
              {lang.flag} {lang.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectionModal;