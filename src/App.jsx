
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from '@/components/ui/toaster';
import Footer from '@/components/Footer';
import LanguageSelectionModal from '@/components/LanguageSelectionModal';
import { TelegramProvider } from '@/contexts/TelegramContext';
import { getLocaleString } from '@/lib/locales';
import InstantEpisodesPage from '@/pages/InstantEpisodesPage';
import PlayerPage from '@/pages/PlayerPage';
import ManagePage from '@/pages/ManageEpisodesPage';
import NotFoundPage from '@/pages/NotFoundPage';
import DeepSearchPage from '@/pages/DeepSearchPage';
import UploadPage from '@/pages/UploadPage';
import SpotifyUploadPage from '@/pages/SpotifyUploadPage';
import OfflineSettingsPage from '@/pages/OfflineSettingsPage';
import StorageMigrationPage from '@/pages/StorageMigrationPage';
import HostingerMigrationPage from '@/pages/HostingerMigrationPage';
import MigrationMenuPage from '@/pages/MigrationMenuPage';
import { supabase } from '@/lib/supabaseClient';
import { TooltipProvider } from '@/components/ui/tooltip';
import cacheIntegration from '@/lib/cacheIntegration';
import { useToast } from '@/components/ui/use-toast';
import { EditorAuthProvider, useEditorAuth } from '@/contexts/EditorAuthContext';
import { EditorAuthModal } from '@/components/EditorAuthModal';
import EditHistoryAdminPage from '@/pages/EditHistoryAdminPage';


// Internal component that has access to EditorAuthContext
const AppContent = ({ currentLanguage, handleLanguageSelect, user }) => {
  const { showAuthModal, closeAuthModal } = useEditorAuth();

  return (
    <TooltipProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex flex-col">
          <main className="flex-grow w-full">
            <Routes>
              <Route path="/" element={<Navigate to="/episodes" replace />} />
              <Route path="/episodes" element={<InstantEpisodesPage currentLanguage={currentLanguage} />} />
              <Route path="/episode/:episodeSlug" element={<PlayerPage currentLanguage={currentLanguage} user={user} />} />
              <Route path="/manage" element={<ManagePage currentLanguage={currentLanguage} />} />
              <Route path="/upload" element={<UploadPage currentLanguage={currentLanguage} />} />
              <Route path="/deep-search" element={<DeepSearchPage currentLanguage={currentLanguage} />} />
              <Route path="/spotify-upload" element={<SpotifyUploadPage currentLanguage={currentLanguage} />} />
              <Route path="/edit" element={<EditHistoryAdminPage currentLanguage={currentLanguage} />} />
              <Route path="/offline-settings" element={
                <OfflineSettingsPage 
                  currentLanguage={currentLanguage} 
                  onBack={() => window.history.back()} 
                />
              } />
              <Route path="/migration" element={<MigrationMenuPage currentLanguage={currentLanguage} />} />
              <Route path="/migration/storage" element={<StorageMigrationPage currentLanguage={currentLanguage} />} />
              <Route path="/hostinger-migration" element={<HostingerMigrationPage currentLanguage={currentLanguage} />} />
              <Route path="*" element={<NotFoundPage currentLanguage={currentLanguage} />} />
            </Routes>
          </main>
          
          <Footer 
            currentLanguage={currentLanguage} 
            onLanguageChange={handleLanguageSelect}
          />
          
          {/* Global Auth Modal */}
          <EditorAuthModal 
            isOpen={showAuthModal}
            onClose={closeAuthModal}
            currentLanguage={currentLanguage}
          />
          
          <Toaster />
          <Analytics />
        </div>
      </Router>
    </TooltipProvider>
  );
};


function App() {
  const [currentLanguage, setCurrentLanguage] = useState(localStorage.getItem('podcastLang') || null);
  const [showLangModal, setShowLangModal] = useState(!currentLanguage);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [offlineServicesReady, setOfflineServicesReady] = useState(false);
  const { toast } = useToast();

  // Инициализация оптимизированной системы кэша
  useEffect(() => {
    const initOptimizedCache = async () => {
      try {
        console.log('[App] Initializing optimized cache system...');
        
        // Инициализируем оптимизированную систему кэша
        await cacheIntegration.init();
        
        setOfflineServicesReady(true);
        console.log('[App] Optimized cache system initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize optimized cache:', error);
        setOfflineServicesReady(true);
      }
    };

    initOptimizedCache();
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
            <Analytics />
          </div>
      </TelegramProvider>
    );
  }

  return (
    <TelegramProvider>
      <EditorAuthProvider>
        <AppContent 
          currentLanguage={currentLanguage}
          handleLanguageSelect={handleLanguageSelect}
          user={user}
        />
      </EditorAuthProvider>
    </TelegramProvider>
  );
}

export default App;
