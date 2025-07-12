import React, { createContext, useContext, useEffect, useState } from 'react';

const TelegramContext = createContext(null);

export const useTelegram = () => {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return context;
};

export const TelegramProvider = ({ children }) => {
  const [telegram, setTelegram] = useState(null);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if Telegram WebApp is available
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Initialize Telegram WebApp
      tg.expand();
      tg.ready();
      
      setTelegram(tg);
      
      // Get user data if available
      if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        setUser(tg.initDataUnsafe.user);
      } else {
        // Fallback for development/testing
        setUser({
          id: 12345,
          first_name: "Тестовый",
          last_name: "Пользователь",
          username: "test_user",
          language_code: "ru"
        });
      }
      
      setIsReady(true);
    } else {
      console.log("Telegram WebApp is not available. Running in browser mode.");
      
      // Fallback for development/testing
      setUser({
        id: 12345,
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        language_code: "ru"
      });
      
      setIsReady(true);
    }
  }, []);

  const sendData = (data) => {
    if (telegram) {
      telegram.sendData(JSON.stringify(data));
    } else {
      console.log("Telegram WebApp not available, would send data:", data);
    }
  };

  const showAlert = (message) => {
    if (telegram) {
      telegram.showAlert(message);
    } else {
      alert(message);
    }
  };

  const showConfirm = (message, callback) => {
    if (telegram) {
      telegram.showConfirm(message, callback);
    } else {
      // Избегаем использования глобальной функции confirm
      // Вместо этого используем window.confirm и сразу вызываем callback
      const result = window.confirm(message);
      callback(result);
    }
  };

  const closeApp = () => {
    if (telegram) {
      telegram.close();
    } else {
      console.log("Would close Telegram WebApp");
    }
  };

  return (
    <TelegramContext.Provider value={{
      telegram,
      user,
      isReady,
      sendData,
      showAlert,
      showConfirm,
      closeApp
    }}>
      {children}
    </TelegramContext.Provider>
  );
};