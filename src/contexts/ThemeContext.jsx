import React, { createContext, useContext, useState, useEffect } from 'react';

// Определяем доступные цветовые схемы
const themes = {
  standard: {
    name: 'Стандартная',
    description: 'Текущая цветовая схема приложения',
    colors: {
      primary: 'from-purple-900 via-blue-900 to-indigo-900',
      secondary: 'bg-slate-800',
      accent: 'bg-blue-600',
      text: 'text-white'
    }
  },
  blue: {
    name: 'Синяя',
    description: 'Различные оттенки синего',
    colors: {
      primary: 'from-blue-900 via-blue-800 to-indigo-900',
      secondary: 'bg-slate-800',
      accent: 'bg-blue-500',
      text: 'text-white'
    }
  },
  green: {
    name: 'Зеленая',
    description: 'Оттенки зеленого',
    colors: {
      primary: 'from-green-900 via-emerald-900 to-teal-900',
      secondary: 'bg-slate-800',
      accent: 'bg-green-500',
      text: 'text-white'
    }
  },
  classic: {
    name: 'Классическая',
    description: 'Темная тема',
    colors: {
      primary: 'from-gray-900 via-gray-800 to-gray-900',
      secondary: 'bg-gray-800',
      accent: 'bg-gray-600',
      text: 'text-white'
    }
  },
  light: {
    name: 'Светлая',
    description: 'Светлая тема с темным текстом',
    colors: {
      primary: 'from-gray-100 via-blue-50 to-indigo-100',
      secondary: 'bg-white',
      accent: 'bg-blue-500',
      text: 'text-gray-900'
    }
  }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('standard');

  // Загружаем сохраненную тему из localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('podcastTheme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Сохраняем тему в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('podcastTheme', currentTheme);
  }, [currentTheme]);

  const changeTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
    }
  };

  const getCurrentTheme = () => {
    return themes[currentTheme];
  };

  const value = {
    currentTheme,
    themes,
    changeTheme,
    getCurrentTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
