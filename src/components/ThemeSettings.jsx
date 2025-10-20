import React, { useState, useEffect } from 'react';
import { Palette, Moon, Sun, Droplets, Sparkles, Zap } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const ThemeSettings = ({ currentLanguage = 'ru' }) => {
  const [currentTheme, setCurrentTheme] = useState('default');

  const themes = [
    {
      id: 'default',
      name: getLocaleString('themeDefault', currentLanguage),
      description: getLocaleString('themeDefaultDesc', currentLanguage),
      icon: Sparkles,
      classes: 'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900',
      preview: 'from-purple-900 via-blue-900 to-indigo-900'
    },
    {
      id: 'dark',
      name: getLocaleString('themeDark', currentLanguage),
      description: getLocaleString('themeDarkDesc', currentLanguage),
      icon: Moon,
      classes: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
      preview: 'from-gray-900 via-gray-800 to-gray-900'
    },
    {
      id: 'light',
      name: getLocaleString('themeLight', currentLanguage),
      description: getLocaleString('themeLightDesc', currentLanguage),
      icon: Sun,
      classes: 'bg-gradient-to-br from-blue-50 via-white to-blue-100 text-gray-900',
      preview: 'from-blue-50 via-white to-blue-100'
    },
    {
      id: 'green',
      name: getLocaleString('themeGreen', currentLanguage),
      description: getLocaleString('themeGreenDesc', currentLanguage),
      icon: Droplets,
      classes: 'bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900',
      preview: 'from-emerald-900 via-green-800 to-teal-900'
    },
    {
      id: 'orange',
      name: getLocaleString('themeOrange', currentLanguage),
      description: getLocaleString('themeOrangeDesc', currentLanguage),
      icon: Zap,
      classes: 'bg-gradient-to-br from-orange-900 via-amber-800 to-yellow-900',
      preview: 'from-orange-900 via-amber-800 to-yellow-900'
    }
  ];

  useEffect(() => {
    // Загружаем сохраненную тему из localStorage
    const savedTheme = localStorage.getItem('podcastTheme') || 'default';
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (themeId) => {
    const theme = themes.find(t => t.id === themeId) || themes[0];
    
    // Удаляем предыдущие классы темы
    document.documentElement.classList.remove(
      'bg-gradient-to-br', 
      'from-purple-900', 'via-blue-900', 'to-indigo-900',
      'from-gray-900', 'via-gray-800', 'to-gray-900',
      'from-blue-50', 'via-white', 'to-blue-100',
      'from-emerald-900', 'via-green-800', 'to-teal-900',
      'from-orange-900', 'via-amber-800', 'to-yellow-900',
      'text-gray-900'
    );
    
    // Добавляем новые классы темы
    const classes = theme.classes.split(' ');
    classes.forEach(className => {
      document.documentElement.classList.add(className);
    });
  };

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem('podcastTheme', themeId);
    applyTheme(themeId);
  };

  const getCurrentTheme = () => {
    return themes.find(theme => theme.id === currentTheme) || themes[0];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">
          {getLocaleString('themeSettings', currentLanguage)}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {themes.map((theme) => {
          const IconComponent = theme.icon;
          const isSelected = currentTheme === theme.id;
          
          return (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-slate-600 bg-slate-700/50 hover:bg-slate-600/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isSelected ? 'bg-purple-500' : 'bg-slate-600'
                }`}>
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      isSelected ? 'text-purple-300' : 'text-white'
                    }`}>
                      {theme.name}
                    </span>
                    {isSelected && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {theme.description}
                  </p>
                </div>
              </div>
              
              {/* Preview gradient */}
              <div className="mt-3 flex items-center gap-2">
                <div className={`w-full h-4 rounded-full bg-gradient-to-r ${theme.preview}`}></div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-slate-400 text-center">
        {getLocaleString('themeChangeHint', currentLanguage)}
      </div>
    </div>
  );
};

export default ThemeSettings;
