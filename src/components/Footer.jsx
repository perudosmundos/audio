import React, { useState } from 'react';
import { Settings, X, Palette, Languages, HardDrive, History } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import { RussianFlag, SpanishFlag, USFlag, GermanFlag, FrenchFlag, PolishFlag } from './ui/flags';
import ThemeSettings from './ThemeSettings';
import CacheSettings from './CacheSettings';
import { UserEditHistory } from './UserEditHistory';

const Footer = ({ currentLanguage, onLanguageChange }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditHistoryOpen, setIsEditHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('theme');

  const tabs = [
    { id: 'theme', name: getLocaleString('themeSettings', currentLanguage), icon: Palette },
    { id: 'language', name: getLocaleString('language', currentLanguage), icon: Languages },
    { id: 'cache', name: getLocaleString('cacheSettings', currentLanguage), icon: HardDrive },
  ];

  // Убираем массив editHistoryTabs, так как больше не нужен

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleCloseEditHistory = () => {
    setIsEditHistoryOpen(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'theme':
        return <ThemeSettings currentLanguage={currentLanguage} />;
      case 'language':
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {getLocaleString('language', currentLanguage)}
            </h3>
            <div className="space-y-2">
              {[
                { code: 'ru', name: 'Русский', Flag: RussianFlag },
                { code: 'es', name: 'Español', Flag: SpanishFlag },
                { code: 'en', name: 'English', Flag: USFlag },
                { code: 'de', name: 'Deutsch', Flag: GermanFlag },
                { code: 'fr', name: 'Français', Flag: FrenchFlag },
                { code: 'pl', name: 'Polski', Flag: PolishFlag }
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    localStorage.setItem('podcastLang', lang.code);
                    onLanguageChange(lang.code);
                    window.location.reload();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentLanguage === lang.code
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <lang.Flag className="w-5 h-4" />
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'cache':
        return <CacheSettings currentLanguage={currentLanguage} />;
      default:
        return null;
    }
  };

  // Упрощаем рендер - показываем только UserEditHistory

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

          {/* Кнопка настроек */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-600/30 text-white rounded-lg shadow-lg backdrop-blur-sm transition-all hover:scale-105"
            title={getLocaleString('settings', currentLanguage)}
          >
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">
              {getLocaleString('settings', currentLanguage)}
            </span>
          </button>
        </div>
      </footer>

      {/* Модальное окно настроек */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">
                  {getLocaleString('settings', currentLanguage)}
                </h2>
              </div>
              <button
                onClick={handleCloseSettings}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex h-[500px]">
              {/* Боковая панель с табами */}
              <div className="w-48 bg-slate-900/50 border-r border-slate-700 p-4">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.name}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Контент табов */}
              <div className="flex-1 overflow-y-auto">
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      )}

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
