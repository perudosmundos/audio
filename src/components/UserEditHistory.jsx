import React, { useState, useEffect } from 'react';
import { useEditorAuth } from '@/contexts/EditorAuthContext';
import { getEditorHistory, rollbackEdit, applyRollback } from '@/services/editHistoryService';
import { EditorAuthModal } from '@/components/EditorAuthModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import { 
  History, 
  Undo2, 
  Clock, 
  FileEdit, 
  CheckCircle2, 
  XCircle, 
  LogIn,
  LogOut,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const UserEditHistory = ({ currentLanguage }) => {
  const { editor, isAuthenticated, logout } = useEditorAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEdits, setExpandedEdits] = useState(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && editor) {
      loadHistory();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, editor]);

  const loadHistory = async () => {
    if (!editor) return;
    
    setIsLoading(true);
    try {
      const result = await getEditorHistory(editor.email, 50, 0);
      if (result.success) {
        setEditHistory(result.data);
      } else {
        toast({
          title: getLocaleString('errorLoadingHistory', currentLanguage),
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: getLocaleString('errorGeneric', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = async (edit) => {
    if (!editor) return;

    const confirmed = window.confirm(
      getLocaleString('confirmRollback', currentLanguage)
    );
    
    if (!confirmed) return;
    
    try {
      // First, rollback in the database
      const result = await rollbackEdit(edit.id, editor.email, 'User rollback');
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Then, apply the rollback to restore the content
      const applyResult = await applyRollback(result.data);
      
      if (applyResult.success) {
        toast({
          title: getLocaleString('editRolledBack', currentLanguage),
          description: getLocaleString('contentRestored', currentLanguage)
        });
      } else {
        toast({
          title: getLocaleString('rollbackRecorded', currentLanguage),
          description: getLocaleString('rollbackRecordedDesc', currentLanguage),
          variant: 'default'
        });
      }

      // Reload history
      await loadHistory();
    } catch (error) {
      toast({
        title: getLocaleString('rollbackFailed', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleExpanded = (editId) => {
    setExpandedEdits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(editId)) {
        newSet.delete(editId);
      } else {
        newSet.add(editId);
      }
      return newSet;
    });
  };

  if (!isAuthenticated) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <History size={20} className="text-purple-400" />
            {getLocaleString('editHistoryTitle', currentLanguage)}
          </CardTitle>
          <CardDescription className="text-slate-300">
            {getLocaleString('loginToViewEditHistory', currentLanguage)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setShowAuthModal(true)}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <LogIn size={16} className="mr-2" />
            {getLocaleString('loginAsEditor', currentLanguage)}
          </Button>
          <EditorAuthModal 
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            currentLanguage={currentLanguage}
          />
        </CardContent>
      </Card>
    );
  }

  const activeEdits = editHistory.filter(e => !e.is_rolled_back);
  const rolledBackEdits = editHistory.filter(e => e.is_rolled_back);

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-white flex items-center gap-2 mb-2">
              <History size={20} className="text-purple-400" />
              {getLocaleString('editHistoryTitle', currentLanguage)}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {getLocaleString('loggedInAs', currentLanguage)}: <span className="text-purple-400">{editor.name}</span>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={loadHistory}
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white"
            >
              <RefreshCw size={14} />
            </Button>
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white"
            >
              <LogOut size={14} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">{getLocaleString('loading', currentLanguage)}</div>
        ) : editHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>{getLocaleString('noEditsYet', currentLanguage)}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-700 p-3 rounded">
                <p className="text-xs text-slate-400">{getLocaleString('activeEdits', currentLanguage)}</p>
                <p className="text-2xl text-green-400 font-bold">{activeEdits.length}</p>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <p className="text-xs text-slate-400">{getLocaleString('rolledBack', currentLanguage)}</p>
                <p className="text-2xl text-amber-400 font-bold">{rolledBackEdits.length}</p>
              </div>
            </div>

            {/* Edit List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {editHistory.map(edit => (
                <Card 
                  key={edit.id}
                  className={`bg-slate-700 border-slate-600 ${edit.is_rolled_back ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <FileEdit size={16} className="text-purple-400 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge 
                              variant="outline" 
                              className="text-xs bg-purple-900/30 text-purple-300 border-purple-500/30"
                            >
                              {edit.edit_type}
                            </Badge>
                            {edit.target_type && (
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-blue-900/30 text-blue-300 border-blue-500/30"
                              >
                                {edit.target_type}
                              </Badge>
                            )}
                            {edit.is_rolled_back && (
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-amber-900/30 text-amber-300 border-amber-500/30"
                              >
                                {getLocaleString('rolledBack', currentLanguage)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            <Clock size={10} className="inline mr-1" />
                            {formatDistanceToNow(new Date(edit.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpanded(edit.id)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                        >
                          {expandedEdits.has(edit.id) ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </Button>
                        {!edit.is_rolled_back && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRollback(edit)}
                            className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Undo2 size={12} className="mr-1" />
                            {getLocaleString('undo', currentLanguage)}
                          </Button>
                        )}
                      </div>
                    </div>

                    {expandedEdits.has(edit.id) && (
                      <div className="mt-3 space-y-2 border-t border-slate-600 pt-2">
                        <div>
                          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                            <XCircle size={10} />
                            {getLocaleString('beforeLabel', currentLanguage)}:
                          </p>
                          <div className="bg-slate-800 p-2 rounded text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {edit.content_before || '(empty)'}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            {getLocaleString('afterLabel', currentLanguage)}:
                          </p>
                          <div className="bg-slate-800 p-2 rounded text-xs text-green-300 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {edit.content_after || '(empty)'}
                          </div>
                        </div>
                        {edit.is_rolled_back && (
                          <div className="bg-amber-900/20 p-2 rounded">
                            <p className="text-xs text-amber-300">
                              {getLocaleString('rolledBack', currentLanguage)} {formatDistanceToNow(new Date(edit.rolled_back_at), { addSuffix: true })}
                            </p>
                            {edit.rollback_reason && (
                              <p className="text-xs text-amber-200 mt-1">
                                {getLocaleString('reason', currentLanguage)}: {edit.rollback_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
