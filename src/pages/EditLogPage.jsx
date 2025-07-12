import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, RotateCcw, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru, es, enUS } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import logService from '@/lib/logService';

const dateLocales = { ru, es, en: enUS };

const DiffViewer = ({ before, after, currentLanguage }) => {
  const renderValue = (value) => {
    if (value === null || value === undefined) {
      return <span className="text-slate-500">null</span>;
    }
    return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 font-mono">
      <div>
        <h4 className="text-sm font-semibold text-red-400 mb-1">{getLocaleString('beforeLabel', currentLanguage)}</h4>
        <div className="bg-red-900/20 p-2 rounded-md">{renderValue(before)}</div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-green-400 mb-1">{getLocaleString('afterLabel', currentLanguage)}</h4>
        <div className="bg-green-900/20 p-2 rounded-md">{renderValue(after)}</div>
      </div>
    </div>
  );
};

const EditLogPage = ({ currentLanguage, user }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('edit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: getLocaleString('errorFetchingLogs', currentLanguage), description: error.message, variant: 'destructive' });
    } else {
      setLogs(data);
    }
    setLoading(false);
  }, [toast, currentLanguage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRevert = async (logEntry) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in to revert changes.", variant: "destructive"});
      return;
    }
    setRevertingId(logEntry.id);
    const { error } = await logService.revert(logEntry, user);
    if (error) {
      toast({ title: getLocaleString("revertFailed", currentLanguage), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: getLocaleString("revertSuccessful", currentLanguage), description: getLocaleString("revertDescription", currentLanguage, {logId: logEntry.id}) });
      fetchLogs();
    }
    setRevertingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">{getLocaleString('editLogPageTitle', currentLanguage)}</h1>
        <Button onClick={() => navigate(-1)} variant="outline" className="bg-slate-700/50 hover:bg-slate-600/70 border-slate-600">
          <ArrowLeft className="mr-2 h-4 w-4" /> {getLocaleString('backButton', currentLanguage)}
        </Button>
      </div>

      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className={`p-3 rounded-lg shadow-md transition-all ${log.is_reverted ? 'bg-slate-800/50 opacity-60' : 'bg-slate-800/80'}`}>
            <div className="flex flex-wrap justify-between items-start gap-2">
              <div>
                <p className="font-semibold text-white">
                  <span className="text-purple-300 font-bold">{log.action_type.toUpperCase()}</span> on {log.entity_type}
                </p>
                <p className="text-xs text-slate-400">
                  <span className="font-medium text-slate-300">{log.user_email || 'N/A'}</span> at {format(new Date(log.created_at), 'Pp', { locale: dateLocales[currentLanguage] || enUS })}
                </p>
                 <p className="text-xs text-slate-400">{getLocaleString('episodeTitle', currentLanguage)}: <span className="font-mono text-slate-300">{log.episode_slug}</span> | ID: <span className="font-mono text-slate-300">{log.entity_id}</span></p>
              </div>
              <div>
                {log.is_reverted ? (
                  <div className="flex items-center gap-2 text-green-400 px-3 py-1.5 rounded-md bg-green-900/30">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">{getLocaleString('actionReverted', currentLanguage)}</span>
                  </div>
                ) : (
                  <Button 
                    size="sm"
                    onClick={() => handleRevert(log)} 
                    disabled={revertingId === log.id || !user}
                    variant="destructive"
                    className="bg-red-600/80 hover:bg-red-600"
                    title={!user ? "Login to revert" : ""}
                  >
                    {revertingId === log.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    {getLocaleString('revertButton', currentLanguage)}
                  </Button>
                )}
              </div>
            </div>

            <DiffViewer before={log.before_value} after={log.after_value} currentLanguage={currentLanguage} />
            
            {log.reverted_at && (
              <p className="text-xs text-slate-500 mt-2 border-t border-slate-700 pt-2">
                {getLocaleString('revertedAtLabel', currentLanguage, { date: format(new Date(log.reverted_at), 'Pp', { locale: dateLocales[currentLanguage] || enUS }) })}
              </p>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-center text-slate-400 py-8">{getLocaleString('noEditHistory', currentLanguage) || "No edit history found."}</p>
        )}
      </div>
    </div>
  );
};

export default EditLogPage;