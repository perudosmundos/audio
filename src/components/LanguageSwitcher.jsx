import React, { useState, useRef, useEffect } from 'react';
import { RussianFlag, SpanishFlag, USFlag } from './ui/flags';

const LanguageSwitcher = ({ currentLanguage, onLanguageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const languages = [
    { code: 'ru', name: "RU", fullName: "Русский", Flag: RussianFlag },
    { code: 'es', name: "ES", fullName: "Español", Flag: SpanishFlag },
    { code: 'en', name: "EN", fullName: "English", Flag: USFlag },
  ];

  const handleLanguageChange = (langCode) => {
    localStorage.setItem('podcastLang', langCode);
    onLanguageChange(langCode);
    setIsOpen(false);
    window.location.reload();
  };

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  // Закрываем дропдаун при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 w-[140px] px-3 py-2 text-sm bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 rounded-lg border border-slate-600/30 shadow-sm transition-colors"
      >
        <div className="flex items-center gap-2">
          <currentLang.Flag className="w-4 h-4" />
          <span>{currentLang.name}</span>
        </div>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 rounded-lg overflow-hidden bg-slate-800/70 shadow-lg border border-slate-600/30 backdrop-blur-sm">
          <div className="flex items-center p-1 gap-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                className={`px-3 py-1.5 text-sm flex items-center gap-2 rounded hover:bg-slate-700/70 transition-colors whitespace-nowrap
                          ${currentLanguage === lang.code ? 'text-blue-300 font-medium bg-slate-700/40' : 'text-slate-300'}`}
                onClick={() => handleLanguageChange(lang.code)}
                title={lang.fullName}
              >
                <lang.Flag className="w-4 h-4" />
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
