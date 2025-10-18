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
    <div className="flex items-center gap-1" ref={dropdownRef}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleLanguageChange(lang.code)}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-sm transition-colors rounded-lg
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
    </div>
  );
};

export default LanguageSwitcher;
