import React from 'react';
import OfflineIndicator from './OfflineIndicator';

const Header = ({ podcastData, currentLanguage = 'ru' }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
      <div className="flex items-center gap-3">
        {podcastData?.image && (
          <img 
            src={podcastData.image} 
            alt={podcastData.title}
            className="w-10 h-10 rounded-lg object-cover"
          />
        )}
        <div>
          <h1 className="text-lg font-semibold text-white">
            {podcastData?.title || 'Dos Mundos Podcast'}
          </h1>
          {podcastData?.author && (
            <p className="text-sm text-slate-400">
              {podcastData.author}
            </p>
          )}
        </div>
      </div>
      
      <OfflineIndicator currentLanguage={currentLanguage} />
    </div>
  ); 
};

export default Header;