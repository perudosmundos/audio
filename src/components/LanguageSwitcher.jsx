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
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="transition-all rounded-lg px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 rounded-lg border border-slate-600/30 shadow-sm cursor-pointer"
      >
        <currentLang.Flag className="w-5 h-5" />
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-lg overflow-hidden bg-[#1E1B4B]/95 shadow-lg border border-gray-600/30 backdrop-blur-sm">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLanguageChange(lang.code);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[#2D2A5A] transition-colors cursor-pointer
                          ${currentLanguage === lang.code ? 'text-blue-300 font-medium bg-[#2D2A5A]/50' : 'text-white/90'}`}
              >
                <lang.Flag className="w-4 h-4" />
                <span>{lang.fullName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
