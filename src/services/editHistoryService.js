import { supabase } from '@/lib/supabaseClient';

/**
 * Service for managing edit history
 */

/**
 * Save an edit to history
 * @param {Object} params
 * @param {string} params.editorId - UUID of the editor
 * @param {string} params.editorEmail - Email of the editor
 * @param {string} params.editorName - Name of the editor
 * @param {string} params.editType - Type of edit (text_edit, translation, transcript, etc.)
 * @param {string} params.targetType - What was edited (episode, question, segment, ui_element)
 * @param {string} params.targetId - ID or slug of the edited item
 * @param {string} params.contentBefore - Content before edit
 * @param {string} params.contentAfter - Content after edit
 * @param {string} [params.filePath] - File path for UI edits
 * @param {Object} [params.metadata] - Additional metadata (line, column, language, etc.)
 */
export const saveEditToHistory = async ({
  editorId,
  editorEmail,
  editorName,
  editType,
  targetType,
  targetId,
  contentBefore,
  contentAfter,
  filePath = null,
  metadata = {}
}) => {
  try {
    const { data, error } = await supabase
      .from('edit_history')
      .insert({
        editor_id: editorId,
        editor_email: editorEmail,
        editor_name: editorName,
        edit_type: editType,
        target_type: targetType,
        target_id: targetId,
        file_path: filePath,
        content_before: contentBefore,
        content_after: contentAfter,
        metadata: metadata
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error saving edit to history:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get edit history for a specific editor
 * @param {string} editorEmail - Email of the editor
 * @param {number} limit - Maximum number of records to return
 * @param {number} offset - Offset for pagination
 */
export const getEditorHistory = async (editorEmail, limit = 50, offset = 0) => {
  try {
    const { data, error, count } = await supabase
      .from('edit_history_with_editor')
      .select('*', { count: 'exact' })
      .eq('editor_email', editorEmail)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return { success: true, data, count };
  } catch (error) {
    console.error('Error fetching editor history:', error);
    return { success: false, error: error.message, data: [], count: 0 };
  }
};

/**
 * Get all edit history (for admin panel)
 * @param {Object} filters
 * @param {string} [filters.editType] - Filter by edit type
 * @param {string} [filters.targetType] - Filter by target type
 * @param {boolean} [filters.showRolledBack] - Include rolled back edits
 * @param {string} [filters.editorEmail] - Filter by editor email
 * @param {number} limit - Maximum number of records to return
 * @param {number} offset - Offset for pagination
 */
export const getAllEditHistory = async (filters = {}, limit = 100, offset = 0) => {
  try {
    let query = supabase
      .from('edit_history_with_editor')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.editType) {
      query = query.eq('edit_type', filters.editType);
    }
    if (filters.targetType) {
      query = query.eq('target_type', filters.targetType);
    }
    if (filters.editorEmail) {
      query = query.eq('editor_email', filters.editorEmail);
    }
    if (filters.showRolledBack === false) {
      query = query.eq('is_rolled_back', false);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return { success: true, data, count };
  } catch (error) {
    console.error('Error fetching all edit history:', error);
    return { success: false, error: error.message, data: [], count: 0 };
  }
};

/**
 * Rollback an edit
 * @param {string} editId - UUID of the edit to rollback
 * @param {string} rolledBackByEmail - Email of the person rolling back
 * @param {string} [rollbackReason] - Reason for rollback
 */
export const rollbackEdit = async (editId, rolledBackByEmail, rollbackReason = null) => {
  try {
    const { data, error } = await supabase.rpc('rollback_edit', {
      p_edit_id: editId,
      p_rolled_back_by_email: rolledBackByEmail,
      p_rollback_reason: rollbackReason
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error);
    }

    return { success: true, data: data.data };
  } catch (error) {
    console.error('Error rolling back edit:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get edit history for a specific target
 * @param {string} targetType - Type of target (episode, question, segment, ui_element)
 * @param {string} targetId - ID of the target
 */
export const getTargetHistory = async (targetType, targetId) => {
  try {
    const { data, error } = await supabase
      .from('edit_history_with_editor')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching target history:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Get statistics about edits
 * @param {string} [editorEmail] - Optional: Get stats for specific editor
 */
export const getEditStats = async (editorEmail = null) => {
  try {
    let query = supabase
      .from('edit_history')
      .select('edit_type, created_at, is_rolled_back');

    if (editorEmail) {
      query = query.eq('editor_email', editorEmail);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate stats
    const stats = {
      total: data.length,
      rolledBack: data.filter(e => e.is_rolled_back).length,
      active: data.filter(e => !e.is_rolled_back).length,
      byType: {},
      recent24h: 0,
      recent7d: 0
    };

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    data.forEach(edit => {
      // Count by type
      stats.byType[edit.edit_type] = (stats.byType[edit.edit_type] || 0) + 1;

      // Count recent
      const editTime = new Date(edit.created_at);
      const timeDiff = now - editTime;
      if (timeDiff < day) stats.recent24h++;
      if (timeDiff < 7 * day) stats.recent7d++;
    });

    return { success: true, stats };
  } catch (error) {
    console.error('Error fetching edit stats:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all editors
 */
export const getAllEditors = async () => {
  try {
    const { data, error } = await supabase
      .from('user_editors')
      .select('*')
      .order('last_login', { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching editors:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Apply a rollback - this actually restores the previous content
 * This needs to be implemented based on the target type
 * @param {Object} edit - The edit object with rollback data
 */
export const applyRollback = async (edit) => {
  try {
    const { target_type, target_id, content_before, file_path, metadata } = edit;

    switch (target_type) {
      case 'ui_element':
        // For UI elements, we would need to call the visual editor API
        if (file_path) {
          const response = await fetch('/api/apply-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              editId: `${file_path}:${metadata?.line}:${metadata?.column}`,
              newFullText: content_before
            })
          });

          if (!response.ok) {
            throw new Error('Failed to apply UI rollback');
          }

          return { success: true };
        }
        break;

      case 'transcript':
      case 'segment':
        // For transcript segments, update the transcript in the database
        // This would need to be implemented based on your transcript structure
        console.warn('Transcript rollback not yet implemented');
        return { success: false, error: 'Transcript rollback not implemented' };

      case 'episode':
      case 'question':
        // For episodes and questions, update the relevant database table
        console.warn('Episode/Question rollback not yet implemented');
        return { success: false, error: 'Episode/Question rollback not implemented' };

      default:
        throw new Error(`Unknown target type: ${target_type}`);
    }

    return { success: false, error: 'Target type not handled' };
  } catch (error) {
    console.error('Error applying rollback:', error);
    return { success: false, error: error.message };
  }
};
