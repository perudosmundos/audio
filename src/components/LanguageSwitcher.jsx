import React from 'react';
import { RussianFlag, SpanishFlag, USFlag } from './ui/flags';

const LanguageSwitcher = ({ currentLanguage, onLanguageChange }) => {
  const languages = [
    { code: 'ru', name: "Русский", Flag: RussianFlag },
    { code: 'es', name: "Español", Flag: SpanishFlag },
    { code: 'en', name: "English", Flag: USFlag },
  ];

  return (
    <div className="flex gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          className={`transition-all rounded-md px-3 sm:px-4 py-2 text-sm font-medium flex items-center gap-2
                      ${currentLanguage === lang.code 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white border-transparent' 
                        : 'text-white/70 border-white/30 hover:bg-white/10 hover:text-white bg-transparent'}`}
          onClick={() => onLanguageChange(lang.code)}
        >
          <lang.Flag /> <span className="hidden sm:inline">{lang.name}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;