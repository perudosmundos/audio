import React from 'react';
import { RussianFlag, SpanishFlag, USFlag, GermanFlag, FrenchFlag, PolishFlag } from './ui/flags';

const FooterLanguageSwitcher = ({ currentLanguage, onLanguageChange }) => {
  const languages = [
    { code: 'ru', name: "RU", Flag: RussianFlag },
    { code: 'es', name: "ES", Flag: SpanishFlag },
    { code: 'en', name: "EN", Flag: USFlag },
    { code: 'de', name: "DE", Flag: GermanFlag },
    { code: 'fr', name: "FR", Flag: FrenchFlag },
    { code: 'pl', name: "PL", Flag: PolishFlag },
  ];

  const handleLanguageChange = (langCode) => {
    localStorage.setItem('podcastLang', langCode);
    onLanguageChange(langCode);
    window.location.reload();
  };

  return (
    <div className="flex gap-1">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleLanguageChange(lang.code)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-colors
            ${currentLanguage === lang.code 
              ? 'bg-slate-700/70 text-blue-300 font-medium border border-slate-600/30' 
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
        >
          <lang.Flag className="w-4 h-4" />
          <span>{lang.name}</span>
        </button>
      ))}
    </div>
  );
};

export default FooterLanguageSwitcher;