import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocaleString } from '@/lib/locales';
import { useTelegram } from '@/contexts/TelegramContext';

const EpisodesPageHeader = ({ currentLanguage }) => {
  const { user, isReady } = useTelegram();
  const navigate = useNavigate();
  const showManageButton = isReady && user && user.username === 'de_paz';

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex items-center w-full sm:w-auto">
        <img 
          src="https://dosmundos.pe/wp-content/uploads/2025/02/logo-5-120x120.png" 
          alt="Dos Mundos Logo" 
          className="w-10 h-10 sm:w-12 sm:h-12 mr-3 rounded-full object-contain shadow-md" 
        />
        <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
          {getLocaleString('episodes', currentLanguage)}
        </h1>
      </div>
      {showManageButton && (
        <button 
          onClick={() => navigate('/manage')} 
          className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 py-2 px-5 rounded-lg"
        >
          {getLocaleString('manageAndUploadTitle', currentLanguage)}
        </button>
      )}
    </div>
  );
}

export default EpisodesPageHeader;
