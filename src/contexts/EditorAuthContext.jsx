import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const EditorAuthContext = createContext(null);

const STORAGE_KEY = 'editor_auth';

export const EditorAuthProvider = ({ children }) => {
  const [editor, setEditor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Load editor from localStorage on mount
  useEffect(() => {
    const loadEditor = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Validate that the data is still valid
          if (parsed.email && parsed.name && parsed.id) {
            setEditor(parsed);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Error loading editor auth:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadEditor();
  }, []);

  // Save editor to localStorage whenever it changes
  useEffect(() => {
    if (editor) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(editor));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [editor]);

  const login = async (email, name) => {
    try {
      // Validate email format (Latin characters only)
      const emailRegex = /^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(email)) {
        throw new Error('Email must contain only Latin characters');
      }

      // Validate name (Latin characters, spaces, hyphens only)
      const nameRegex = /^[A-Za-z\s\-]+$/;
      if (!nameRegex.test(name)) {
        throw new Error('Name must contain only Latin characters, spaces, and hyphens');
      }

      // Trim inputs
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      if (!trimmedEmail || !trimmedName) {
        throw new Error('Email and name are required');
      }

      // Call the get_or_create_editor function
      const { data, error } = await supabase.rpc('get_or_create_editor', {
        p_email: trimmedEmail,
        p_name: trimmedName
      });

      if (error) throw error;

      const editorData = {
        id: data,
        email: trimmedEmail,
        name: trimmedName,
        loginTime: new Date().toISOString()
      };

      setEditor(editorData);
      return { success: true, editor: editorData };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setEditor(null);
    setShowAuthModal(false);
  };

  const openAuthModal = () => {
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
  };

  const updateEditor = async () => {
    if (!editor) return;

    try {
      // Refresh editor data from database
      const { data, error } = await supabase
        .from('user_editors')
        .select('*')
        .eq('id', editor.id)
        .single();

      if (error) throw error;

      if (data) {
        setEditor({
          id: data.id,
          email: data.email,
          name: data.name,
          loginTime: editor.loginTime,
          isActive: data.is_active,
          lastLogin: data.last_login
        });
      }
    } catch (error) {
      console.error('Error updating editor:', error);
    }
  };

  const value = {
    editor,
    isAuthenticated: !!editor,
    isLoading,
    login,
    logout,
    updateEditor,
    showAuthModal,
    openAuthModal,
    closeAuthModal
  };

  return (
    <EditorAuthContext.Provider value={value}>
      {children}
    </EditorAuthContext.Provider>
  );
};

export const useEditorAuth = () => {
  const context = useContext(EditorAuthContext);
  if (!context) {
    throw new Error('useEditorAuth must be used within EditorAuthProvider');
  }
  return context;
};
