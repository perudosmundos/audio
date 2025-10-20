import React, { useState } from 'react';
import { X, History } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import LanguageSwitcher from './LanguageSwitcher';
import { UserEditHistory } from './UserEditHistory';

const Footer = ({ currentLanguage, onLanguageChange }) => {
  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);

  const handleCloseEditHistory = () => {
    setIsEditHistoryOpen(false);
  };

  return (
    <>
      {/* Футер */}
      <footer className="bg-transparent px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
          {/* Кнопка истории редактирования */}
          <button
            onClick={() => setIsEditHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-600/30 text-white rounded-lg shadow-lg backdrop-blur-sm transition-all hover:scale-105"
            title="История редактирования"
          >
            <History className="h-4 w-4" />
            <span className="text-sm font-medium">
              История редактирования
            </span>
          </button>

          {/* Выбор языка */}
          <LanguageSwitcher 
            currentLanguage={currentLanguage} 
            onLanguageChange={onLanguageChange}
            dropdownPosition="up"
          />
        </div>
      </footer>


      {/* Модальное окно истории редактирования */}
      {isEditHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <History className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">
                  История редактирования
                </h2>
              </div>
              <button
                onClick={handleCloseEditHistory}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Основной контент без левой колонки */}
            <div className="h-[500px] overflow-y-auto">
              <UserEditHistory currentLanguage={currentLanguage} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
