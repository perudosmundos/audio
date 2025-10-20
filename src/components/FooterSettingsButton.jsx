import React, { useState } from 'react';
import { Settings, X, Languages } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getLocaleString } from '@/lib/locales';
import LanguageSelectionModal from './LanguageSelectionModal';

const FooterSettingsButton = ({ currentLanguage, onLanguageSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleLanguageChange = (lang) => {
    onLanguageSelect(lang);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        title={getLocaleString('settings', currentLanguage) || 'Настройки'}
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">
          {getLocaleString('settings', currentLanguage) || 'Настройки'}
        </span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden bg-slate-800 border-slate-700">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-white">
              {getLocaleString('settings', currentLanguage) || 'Настройки'}
            </DialogTitle>
            <button
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <Languages className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-white">
                {getLocaleString('languageSettings', currentLanguage) || 'Настройки языка'}
              </h3>
            </div>

            <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  {getLocaleString('languageChangeNotice', currentLanguage) || 'Выберите язык интерфейса'}
                </p>
                <LanguageSelectionModal 
                  onLanguageSelect={handleLanguageChange}
                  currentLanguage={currentLanguage}
                  compact={true}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FooterSettingsButton;
