import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const NotFoundPage = ({ currentLanguage }) => {
  return (
    <div className="min-h-[calc(100vh-150px)] flex flex-col items-center justify-center text-center p-4">
      <AlertTriangle className="w-16 h-16 text-yellow-400 mb-6" />
      <h1 className="text-4xl font-bold text-white mb-3">{getLocaleString('pageNotFoundTitle', currentLanguage)}</h1>
      <p className="text-lg text-slate-300 mb-8 max-w-md">
        {getLocaleString('pageNotFoundDescription', currentLanguage)}
      </p>
      <Link to="/episodes">
        <Button className="bg-purple-600 hover:bg-purple-700 text-lg px-8 py-6">
          {getLocaleString('backToEpisodes', currentLanguage)}
        </Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;