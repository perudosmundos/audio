-- Create edit history system for text editing with authentication
-- Migration: Create tables for tracking editors and edit history

-- Create user_editors table to store editor information
CREATE TABLE IF NOT EXISTS user_editors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT name_latin_only CHECK (name ~* '^[A-Za-z\s\-]+$')
);

-- Create edit_history table to store all edits
CREATE TABLE IF NOT EXISTS edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    editor_id UUID NOT NULL REFERENCES user_editors(id) ON DELETE CASCADE,
    editor_email VARCHAR(255) NOT NULL,
    editor_name VARCHAR(255) NOT NULL,
    
    -- What was edited
    edit_type VARCHAR(50) NOT NULL, -- 'text_edit', 'translation', 'transcript', etc.
    target_type VARCHAR(50), -- 'episode', 'question', 'segment', 'ui_element'
    target_id VARCHAR(255), -- ID or slug of the edited item
    file_path VARCHAR(500), -- For UI text edits
    
    -- Before and after content
    content_before TEXT,
    content_after TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_rolled_back BOOLEAN DEFAULT false,
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    rolled_back_by UUID REFERENCES user_editors(id),
    rollback_reason TEXT,
    
    -- Additional context
    metadata JSONB, -- Can store additional info like line number, language, etc.
    
    CONSTRAINT content_changed CHECK (content_before IS DISTINCT FROM content_after)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_edit_history_editor_id ON edit_history(editor_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_editor_email ON edit_history(editor_email);
CREATE INDEX IF NOT EXISTS idx_edit_history_created_at ON edit_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edit_history_target ON edit_history(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_edit_history_edit_type ON edit_history(edit_type);
CREATE INDEX IF NOT EXISTS idx_edit_history_rolled_back ON edit_history(is_rolled_back);
CREATE INDEX IF NOT EXISTS idx_user_editors_email ON user_editors(email);
CREATE INDEX IF NOT EXISTS idx_user_editors_active ON user_editors(is_active);

-- Create a view for easy querying of edit history with editor info
CREATE OR REPLACE VIEW edit_history_with_editor AS
SELECT 
    eh.id,
    eh.editor_id,
    eh.editor_email,
    eh.editor_name,
    eh.edit_type,
    eh.target_type,
    eh.target_id,
    eh.file_path,
    eh.content_before,
    eh.content_after,
    eh.created_at,
    eh.is_rolled_back,
    eh.rolled_back_at,
    eh.rolled_back_by,
    rb.email as rolled_back_by_email,
    rb.name as rolled_back_by_name,
    eh.rollback_reason,
    eh.metadata,
    ue.last_login as editor_last_login,
    ue.is_active as editor_is_active
FROM edit_history eh
LEFT JOIN user_editors ue ON eh.editor_id = ue.id
LEFT JOIN user_editors rb ON eh.rolled_back_by = rb.id
ORDER BY eh.created_at DESC;

-- Function to rollback an edit
CREATE OR REPLACE FUNCTION rollback_edit(
    p_edit_id UUID,
    p_rolled_back_by_email VARCHAR(255),
    p_rollback_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_editor_id UUID;
    v_result JSONB;
BEGIN
    -- Get the editor ID
    SELECT id INTO v_editor_id FROM user_editors WHERE email = p_rolled_back_by_email;
    
    IF v_editor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Editor not found');
    END IF;
    
    -- Update the edit history
    UPDATE edit_history
    SET 
        is_rolled_back = true,
        rolled_back_at = NOW(),
        rolled_back_by = v_editor_id,
        rollback_reason = p_rollback_reason
    WHERE id = p_edit_id AND is_rolled_back = false
    RETURNING jsonb_build_object(
        'id', id,
        'content_before', content_before,
        'target_type', target_type,
        'target_id', target_id,
        'file_path', file_path,
        'metadata', metadata
    ) INTO v_result;
    
    IF v_result IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Edit not found or already rolled back');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$ LANGUAGE plpgsql;

-- Function to get or create editor
CREATE OR REPLACE FUNCTION get_or_create_editor(
    p_email VARCHAR(255),
    p_name VARCHAR(255)
)
RETURNS UUID AS $$
DECLARE
    v_editor_id UUID;
BEGIN
    -- Try to get existing editor
    SELECT id INTO v_editor_id 
    FROM user_editors 
    WHERE email = p_email;
    
    IF v_editor_id IS NOT NULL THEN
        -- Update last login
        UPDATE user_editors SET last_login = NOW() WHERE id = v_editor_id;
        RETURN v_editor_id;
    END IF;
    
    -- Create new editor
    INSERT INTO user_editors (email, name)
    VALUES (p_email, p_name)
    RETURNING id INTO v_editor_id;
    
    RETURN v_editor_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE user_editors IS 'Stores information about users who can edit content';
COMMENT ON TABLE edit_history IS 'Complete history of all edits with rollback capability';
COMMENT ON COLUMN edit_history.edit_type IS 'Type of edit: text_edit, translation, transcript, etc.';
COMMENT ON COLUMN edit_history.target_type IS 'What was edited: episode, question, segment, ui_element';
COMMENT ON COLUMN edit_history.metadata IS 'Additional context: {line, column, language, component_name, etc.}';
COMMENT ON FUNCTION rollback_edit IS 'Rollback an edit and restore previous content';
COMMENT ON FUNCTION get_or_create_editor IS 'Get existing editor or create new one, updates last_login';
