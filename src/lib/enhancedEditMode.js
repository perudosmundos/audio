/**
 * Enhanced Edit Mode Integration
 * This file integrates editor authentication with the visual editor
 */

// Check if editor is authenticated
const checkEditorAuth = () => {
  try {
    const editorData = localStorage.getItem('editor_auth');
    if (!editorData) return null;
    
    const editor = JSON.parse(editorData);
    if (editor && editor.id && editor.email && editor.name) {
      return editor;
    }
  } catch (error) {
    console.error('Error checking editor auth:', error);
  }
  return null;
};

// Save edit to history
const saveEditToHistory = async (editData) => {
  const editor = editData.editorId ? editData : checkEditorAuth();
  if (!editor || !editor.id) {
    console.warn('[EnhancedEditMode] No authenticated editor - edit not saved to history');
    return;
  }

  try {
    // Import supabase client
    const { supabase } = await import('/src/lib/supabaseClient.js');
    
    const historyRecord = {
      editor_id: editData.editorId || editor.id,
      editor_email: editData.editorEmail || editor.email,
      editor_name: editData.editorName || editor.name,
      edit_type: 'text_edit',
      target_type: 'ui_element',
      target_id: editData.editId,
      file_path: editData.filePath,
      content_before: editData.contentBefore || '',
      content_after: editData.contentAfter || '',
      metadata: {
        line: editData.line,
        column: editData.column,
        timestamp: new Date().toISOString()
      }
    };

    console.log('[EnhancedEditMode] Inserting into edit_history:', historyRecord);

    const { data, error } = await supabase
      .from('edit_history')
      .insert(historyRecord)
      .select()
      .single();

    if (error) {
      console.error('[EnhancedEditMode] Error saving edit to history:', error);
      throw error;
    } else {
      console.log('[EnhancedEditMode] Edit saved to history successfully:', data);
      return data;
    }
  } catch (error) {
    console.error('[EnhancedEditMode] Error in saveEditToHistory:', error);
    throw error;
  }
};

// Intercept the edit save to add authentication check and history tracking
const enhanceEditSave = () => {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch to intercept edit API calls
  window.fetch = async function(...args) {
    const [url, options] = args;
    
    // Check if this is an edit API call
    if (url === '/api/apply-edit' && options?.method === 'POST') {
      // Check authentication
      const editor = checkEditorAuth();
      
      if (!editor) {
        // Show authentication required message
        const shouldAuth = confirm(
          'You need to be authenticated to make edits.\n\n' +
          'Would you like to authenticate now?'
        );
        
        if (shouldAuth) {
          // Trigger auth modal
          window.dispatchEvent(new CustomEvent('show-editor-auth'));
          return Promise.reject(new Error('Authentication required'));
        }
        
        return Promise.reject(new Error('Edit cancelled - authentication required'));
      }
      
      // Parse the request body to get edit details
      let editData = {};
      try {
        const body = JSON.parse(options.body);
        editData = {
          editId: body.editId,
          contentBefore: null, // Will be set from response
          contentAfter: body.newFullText
        };
        
        // Parse editId to get file path, line, column
        const parts = body.editId.split(':');
        if (parts.length >= 3) {
          editData.column = parts.pop();
          editData.line = parts.pop();
          editData.filePath = parts.join(':');
        }
      } catch (error) {
        console.error('Error parsing edit request:', error);
      }
      
      // Call original fetch
      const response = await originalFetch(...args);
      
      // Clone response to read it without consuming it
      const clonedResponse = response.clone();
      
      try {
        const result = await clonedResponse.json();
        
        if (result.success && result.editData) {
          // Use the editData from the response
          const fullEditData = {
            ...editData,
            ...result.editData,
            editorId: editor.id,
            editorEmail: editor.email,
            editorName: editor.name
          };
          
          console.log('[EnhancedEditMode] Saving edit to history:', fullEditData);
          
          // Save to history
          await saveEditToHistory(fullEditData);
          
          console.log('[EnhancedEditMode] Edit saved to history successfully');
        }
      } catch (error) {
        console.error('[EnhancedEditMode] Error processing edit response:', error);
      }
      
      return response;
    }
    
    // For all other requests, use original fetch
    return originalFetch(...args);
  };
};

// Initialize enhanced edit mode
export const initEnhancedEditMode = () => {
  console.log('[EnhancedEditMode] Initializing...');
  
  // Enhance edit save functionality
  enhanceEditSave();
  
  // Listen for custom events
  window.addEventListener('show-editor-auth', () => {
    console.log('[EnhancedEditMode] Auth modal should be shown');
    // This will be handled by React components
  });
  
  console.log('[EnhancedEditMode] Initialized successfully');
};

// Auto-initialize when this module is loaded
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancedEditMode);
  } else {
    initEnhancedEditMode();
  }
}
