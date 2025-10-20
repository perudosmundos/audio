import React, { useState } from 'react';
import { Settings, X, Palette, HardDrive, Languages } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLocaleString } from '@/lib/locales';
import ThemeSettings from './ThemeSettings';
import CacheSettings from './CacheSettings';
import LanguageSelectionModal from './LanguageSelectionModal';

const FooterSettingsButton = ({ currentLanguage, onLanguageSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('theme');

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleLanguageChange = (lang) => {
    onLanguageSelect(lang);
    // Можно автоматически переключиться на другую вкладку после выбора языка
    setActiveTab('theme');
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="theme" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {getLocaleString('theme', currentLanguage) || 'Тема'}
              </TabsTrigger>
              <TabsTrigger value="cache" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                {getLocaleString('cache', currentLanguage) || 'Кэш'}
              </TabsTrigger>
              <TabsTrigger value="language" className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                {getLocaleString('language', currentLanguage) || 'Язык'}
              </TabsTrigger>
            </TabsList>

            <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
              <TabsContent value="theme" className="mt-0">
                <ThemeSettings currentLanguage={currentLanguage} />
              </TabsContent>

              <TabsContent value="cache" className="mt-0">
                <CacheSettings currentLanguage={currentLanguage} embedded={true} />
              </TabsContent>

              <TabsContent value="language" className="mt-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">
                    {getLocaleString('languageSettings', currentLanguage) || 'Настройки языка'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {getLocaleString('languageChangeNotice', currentLanguage) || 'Выберите язык интерфейса'}
                  </p>
                  <LanguageSelectionModal 
                    onLanguageSelect={handleLanguageChange}
                    currentLanguage={currentLanguage}
                    compact={true}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FooterSettingsButton;
