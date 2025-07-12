import { supabase } from './supabaseClient';

const logService = {
  log: async (logData) => {
    let userToLog = logData.user;

    if (!userToLog) {
      const { data: { user: currentUserFromAuth } } = await supabase.auth.getUser();
      userToLog = currentUserFromAuth;
    }
    
    if (!userToLog) {
      console.warn("Log attempt without a user session. Skipping.");
      return { error: new Error("User not available for logging.") };
    }
    
    const { user, ...restOfLogData } = logData; 
    
    const payloadToInsert = {
      user_id: userToLog.id,
      user_email: userToLog.email,
      ...restOfLogData,
    };
    
    delete payloadToInsert.user;

    const { error } = await supabase.from('edit_logs').insert([payloadToInsert]);

    if (error) {
      console.error('Error logging edit:', error);
      return { error };
    }
    return { error: null };
  },
  
  revert: async (logEntry, user) => {
    if (!logEntry || !user) {
        console.error("Revert call missing log entry or user");
        return { error: new Error("Missing data for revert.") };
    }

    let revertError = null;
    let beforeRevertValue = null;
    let afterRevertValue = logEntry.before_value;

    if (logEntry.entity_type === 'question') {
        const { data: currentData, error: fetchError } = await supabase.from('questions').select('*').eq('id', logEntry.entity_id).single();
        if (fetchError && fetchError.code !== 'PGRST116') { 
          return { error: new Error(`Failed to fetch current question state for revert: ${fetchError.message}`) };
        }
        beforeRevertValue = currentData;

        if (logEntry.action_type === 'create') {
            const { error } = await supabase.from('questions').delete().eq('id', logEntry.entity_id);
            revertError = error;
        } else if (logEntry.action_type === 'update') {
            const { error } = await supabase.from('questions').update(logEntry.before_value).eq('id', logEntry.entity_id);
            revertError = error;
        } else if (logEntry.action_type === 'delete') {
            const { error } = await supabase.from('questions').insert(logEntry.before_value);
            revertError = error;
        }
    } else if (logEntry.entity_type === 'transcript') {
        const { data: currentData, error: fetchError } = await supabase.from('transcripts').select('edited_transcript_data').eq('id', logEntry.entity_id).single();
         if (fetchError) {
          return { error: new Error(`Failed to fetch current transcript state for revert: ${fetchError.message}`) };
        }
        beforeRevertValue = currentData.edited_transcript_data;

        const { error } = await supabase.from('transcripts').update({
            edited_transcript_data: logEntry.before_value
        }).eq('id', logEntry.entity_id);
        revertError = error;
    }

    if (revertError) {
        return { error: revertError };
    }

    const { error: logUpdateError } = await supabase.from('edit_logs').update({
        is_reverted: true,
        reverted_by: user.id,
        reverted_at: new Date().toISOString()
    }).eq('id', logEntry.id);

    if(!logUpdateError) {
        await logService.log({
            user,
            episode_slug: logEntry.episode_slug,
            entity_type: logEntry.entity_type,
            entity_id: logEntry.entity_id,
            action_type: `revert_${logEntry.action_type}`,
            before_value: beforeRevertValue,
            after_value: afterRevertValue,
            is_reverted: false, 
        });
    }
    
    return { error: logUpdateError };
  }
};

export default logService;