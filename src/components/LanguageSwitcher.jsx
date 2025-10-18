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
    if (langCode === currentLanguage) {
      setIsOpen(false);
      return;
    }
    localStorage.setItem('podcastLang', langCode);
    setIsOpen(false);
    onLanguageChange(langCode);
  };

  const currentLang = languages.find(lang => lang.code === currentLanguage);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Добавляем обработчик Escape
      const handleEscape = (event) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      };
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 px-3 py-2 text-sm bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 rounded-lg border border-slate-600/30 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <currentLang.Flag className="w-4 h-4" />
        <span>{currentLang.name}</span>
        <svg 
          className={`w-4 h-4 text-slate-400 group-hover:text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-transparent" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-[180px] rounded-lg overflow-hidden bg-slate-800/95 shadow-lg border border-slate-600/30 backdrop-blur-sm">
            <div className="py-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors
                    ${currentLanguage === lang.code 
                      ? 'bg-slate-700/70 text-blue-300 font-medium' 
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-200'}`}
                >
                  <lang.Flag className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-grow">{lang.fullName}</span>
                  {currentLanguage === lang.code && (
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;