
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import CacheSettings from '@/components/CacheSettings';
import LanguageSelectionModal from '@/components/LanguageSelectionModal';
import { TelegramProvider } from '@/contexts/TelegramContext';
import { getLocaleString } from '@/lib/locales';
import EpisodesPage from '@/pages/EpisodesPage';
import PlayerPage from '@/pages/PlayerPage';
import ManagePage from '@/pages/ManagePage'; 
import NotFoundPage from '@/pages/NotFoundPage';
import DeepSearchPage from '@/pages/DeepSearchPage';
import UploadPage from '@/pages/UploadPage';
import SpotifyUploadPage from '@/pages/SpotifyUploadPage';
import OfflineSettingsPage from '@/pages/OfflineSettingsPage';
import { supabase } from '@/lib/supabaseClient';
import { TooltipProvider } from '@/components/ui/tooltip';
import syncService from '@/lib/syncService';
import enhancedCacheService from '@/lib/enhancedCacheService';
import { useToast } from '@/components/ui/use-toast';


const FooterContent = ({ currentLanguage, onLanguageSelect }) => {
  const navigate = useNavigate();

  const handleLanguageSwitchInPlayer = async (newLang) => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length === 3 && pathParts[1] === 'episode') {
      const currentSlug = pathParts[2];
      
      const { data: currentEpisode, error: currentEpError } = await supabase
        .from('episodes')
        .select('date, lang, slug')
        .eq('slug', currentSlug)
        .single();

      if (currentEpError || !currentEpisode) {
        console.error("Error fetching current episode details for lang switch:", currentEpError);
        onLanguageSelect(newLang); 
        return;
      }
      
      const datePartFromSlug = currentEpisode.slug.substring(0, currentEpisode.slug.lastIndexOf('_'));
      const targetSlugPart = `${datePartFromSlug}_${newLang}`;
      
      const { data: targetEpisode, error: targetEpError } = await supabase
        .from('episodes')
        .select('slug')
        .eq('date', currentEpisode.date) 
        .eq('lang', newLang) 
        .eq('slug', targetSlugPart)
        .single();

      if (!targetEpError && targetEpisode) {
        onLanguageSelect(newLang);
        navigate(`/episode/${targetEpisode.slug}${window.location.hash}`);
      } else {
         const { data: anyEpisodeSameDate, error: anyEpError } = await supabase
            .from('episodes')
            .select('slug')
            .eq('date', currentEpisode.date)
            .eq('lang', newLang)
            .limit(1)
            .single();
        
        if(!anyEpError && anyEpisodeSameDate){
            onLanguageSelect(newLang);
            navigate(`/episode/${anyEpisodeSameDate.slug}${window.location.hash}`);
        } else {
            console.warn("No equivalent episode found for the new language with the same date. Defaulting to language switch only.");
            onLanguageSelect(newLang);
        }
      }
    } else {
      onLanguageSelect(newLang);
    }
  };
  
  return (
    <footer className="py-3 sm:py-4 text-center text-xs sm:text-sm text-white/60 flex flex-col items-center gap-2">
      <div className="flex gap-2 items-center">
        {currentLanguage && <LanguageSwitcher currentLanguage={currentLanguage} onLanguageChange={handleLanguageSwitchInPlayer} />}
        <CacheSettings currentLanguage={currentLanguage} />
      </div>
    </footer>
  );
}


function App() {
  const [currentLanguage, setCurrentLanguage] = useState(localStorage.getItem('podcastLang') || null);
  const [showLangModal, setShowLangModal] = useState(!currentLanguage);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [offlineServicesReady, setOfflineServicesReady] = useState(false);
  const { toast } = useToast();

  // Инициализация офлайн сервисов (временно отключено для отладки)
  useEffect(() => {
    const initOfflineServices = async () => {
      try {
        console.log('[App] Initializing offline services...');
        
        // Временно отключаем инициализацию для отладки
        // await enhancedCacheService.init();
        
        setOfflineServicesReady(true);
        console.log('[App] Offline services initialized successfully (minimal mode)');
      } catch (error) {
        console.error('[App] Failed to initialize offline services:', error);
        setOfflineServicesReady(true);
      }
    };

    initOfflineServices();
  }, [currentLanguage, toast]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setAuthLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
    });

    if (currentLanguage) {
      localStorage.setItem('podcastLang', currentLanguage);
      setShowLangModal(false);
    } else {
      setShowLangModal(true);
    }
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [currentLanguage]);

  const handleLanguageSelect = useCallback((lang) => {
    setCurrentLanguage(lang);
    localStorage.setItem('podcastLang', lang);
    setShowLangModal(false);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex items-center justify-center">
        <p>{getLocaleString('loading', currentLanguage || 'ru')}</p>
      </div>
    );
  }

  if (showLangModal) {
    return (
      <TelegramProvider>
         <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex flex-col">
            <LanguageSelectionModal onLanguageSelect={handleLanguageSelect} currentLanguage={currentLanguage || 'ru'} />
            <Toaster />
          </div>
      </TelegramProvider>
    );
  }

  return (
    <TelegramProvider>
      <TooltipProvider>
        <Router>
          <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex flex-col">
            <main className="flex-grow w-full">
              <Routes>
                <Route path="/" element={<Navigate to="/episodes" replace />} />
                <Route path="/episodes" element={<EpisodesPage currentLanguage={currentLanguage} />} />
                <Route path="/episode/:episodeSlug" element={<PlayerPage currentLanguage={currentLanguage} user={user} />} />
                <Route path="/manage" element={<ManagePage currentLanguage={currentLanguage} />} />
                <Route path="/upload" element={<UploadPage currentLanguage={currentLanguage} />} />
                <Route path="/deep-search" element={<DeepSearchPage currentLanguage={currentLanguage} />} />
                <Route path="/spotify-upload" element={<SpotifyUploadPage currentLanguage={currentLanguage} />} />
                <Route path="/offline-settings" element={
                  <OfflineSettingsPage 
                    currentLanguage={currentLanguage} 
                    onBack={() => window.history.back()} 
                  />
                } />
                <Route path="*" element={<NotFoundPage currentLanguage={currentLanguage} />} />
              </Routes>
            </main>
            
            <FooterContent 
              currentLanguage={currentLanguage} 
              onLanguageSelect={handleLanguageSelect}
            />
            
            <Toaster />
          </div>
        </Router>
      </TooltipProvider>
    </TelegramProvider>
  );
}

export default App;
