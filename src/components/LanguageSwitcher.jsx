import React from 'react';

const LanguageSwitcher = ({ currentLanguage, onLanguageChange }) => {
  const languages = [
    { code: 'ru', name: "Русский", flag: '🇷🇺' },
    { code: 'es', name: "Español", flag: '🇪🇸' },
    { code: 'en', name: "English", flag: '🇺🇸' },
  ];

  return (
    <div className="flex gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          className={`transition-all rounded-md px-3 sm:px-4 py-2 text-sm font-medium
                      ${currentLanguage === lang.code 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white border-transparent' 
                        : 'text-white/70 border-white/30 hover:bg-white/10 hover:text-white bg-transparent'}`}
          onClick={() => onLanguageChange(lang.code)}
        >
          {lang.flag} <span className="hidden sm:inline ml-1.5">{lang.name}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;