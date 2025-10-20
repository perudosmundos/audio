import React, { useState, useEffect } from 'react';
import { useEditorAuth } from '@/contexts/EditorAuthContext';
import { getAllEditHistory, rollbackEdit, applyRollback, getAllEditors, getEditStats } from '@/services/editHistoryService';
import { EditorAuthModal } from '@/components/EditorAuthModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getLocaleString } from '@/lib/locales';
import { 
  History, 
  Undo2, 
  User, 
  Clock, 
  FileEdit, 
  CheckCircle2, 
  XCircle, 
  LogIn,
  LogOut,
  Filter,
  RefreshCw,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const EditHistoryAdminPage = ({ currentLanguage }) => {
  const { editor, isAuthenticated, logout } = useEditorAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [allEditors, setAllEditors] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEdits, setExpandedEdits] = useState(new Set());
  const { toast } = useToast();

  // Filters
  const [filterEditor, setFilterEditor] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterTarget, setFilterTarget] = useState('all');
  const [showRolledBack, setShowRolledBack] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    applyFilters();
  }, [editHistory, filterEditor, filterType, filterTarget, showRolledBack, searchQuery]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [historyResult, editorsResult, statsResult] = await Promise.all([
        getAllEditHistory({ showRolledBack }, 200, 0),
        getAllEditors(),
        getEditStats()
      ]);

      if (historyResult.success) {
        setEditHistory(historyResult.data);
      }

      if (editorsResult.success) {
        setAllEditors(editorsResult.data);
      }

      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      toast({
        title: getLocaleString('errorLoadingHistory', currentLanguage),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...editHistory];

    if (filterEditor !== 'all') {
      filtered = filtered.filter(e => e.editor_email === filterEditor);
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.edit_type === filterType);
    }

    if (filterTarget !== 'all') {
      filtered = filtered.filter(e => e.target_type === filterTarget);
    }

    if (!showRolledBack) {
      filtered = filtered.filter(e => !e.is_rolled_back);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.content_before?.toLowerCase().includes(query) ||
        e.content_after?.toLowerCase().includes(query) ||
        e.editor_name?.toLowerCase().includes(query) ||
        e.target_id?.toLowerCase().includes(query)
      );
    }

    setFilteredHistory(filtered);
  };

  const handleRollback = async (edit) => {
    if (!editor) return;

    const confirmed = window.confirm('Are you sure you want to rollback this edit?');
    if (!confirmed) return;
    
    try {
      // First, rollback in the database
      const result = await rollbackEdit(edit.id, editor.email, null);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Then, apply the rollback to restore the content
      const applyResult = await applyRollback(result.data);
      
      if (applyResult.success) {
        toast({
          title: 'Edit rolled back successfully',
          description: 'The previous content has been restored'
        });
      } else {
        toast({
          title: 'Rollback recorded but not applied',
          description: applyResult.error,
          variant: 'destructive'
        });
      }

      // Reload data
      await loadData();
    } catch (error) {
      toast({
        title: 'Rollback failed',
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

  const getEditTypes = () => {
    const types = new Set(editHistory.map(e => e.edit_type).filter(Boolean));
    return Array.from(types);
  };

  const getTargetTypes = () => {
    const types = new Set(editHistory.map(e => e.target_type).filter(Boolean));
    return Array.from(types);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <History size={24} className="text-purple-400" />
              {getLocaleString('editHistoryAdminTitle', currentLanguage)}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {getLocaleString('authenticateToAccessEditHistory', currentLanguage)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <LogIn size={16} className="mr-2" />
              Authenticate
            </Button>
          </CardContent>
        </Card>
        <EditorAuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
              <History size={32} className="text-purple-400" />
              {getLocaleString('editHistoryAdmin', currentLanguage)}
            </h1>
            <p className="text-slate-300">
              {getLocaleString('loggedInAs', currentLanguage)}: <span className="text-purple-400 font-semibold">{editor.name}</span> ({editor.email})
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={loadData}
              variant="outline"
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
            >
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button
              onClick={logout}
              variant="outline"
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400">Total Edits</CardDescription>
                <CardTitle className="text-2xl text-white">{stats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400">Active</CardDescription>
                <CardTitle className="text-2xl text-green-400">{stats.active}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400">{getLocaleString('rolledBack', currentLanguage)}</CardDescription>
                <CardTitle className="text-2xl text-amber-400">{stats.rolledBack}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400">Last 24h</CardDescription>
                <CardTitle className="text-2xl text-purple-400">{stats.recent24h}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Filter size={20} />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-slate-300 mb-1 block">Editor</label>
                <Select value={filterEditor} onValueChange={setFilterEditor}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">All Editors</SelectItem>
                    {allEditors.map(e => (
                      <SelectItem key={e.id} value={e.email}>
                        {e.name} ({e.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-slate-300 mb-1 block">Edit Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">All Types</SelectItem>
                    {getEditTypes().map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-slate-300 mb-1 block">Target Type</label>
                <Select value={filterTarget} onValueChange={setFilterTarget}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all">All Targets</SelectItem>
                    {getTargetTypes().map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-slate-300 mb-1 block">Search</label>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search content..."
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showRolledBack"
                checked={showRolledBack}
                onChange={(e) => setShowRolledBack(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="showRolledBack" className="text-sm text-slate-300">
                {getLocaleString('showRolledBackEdits', currentLanguage)}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Edit History List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">
              {getLocaleString('editHistoryCount', currentLanguage, { count: filteredHistory.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-400">Loading...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No edits found</div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map(edit => (
                  <Card 
                    key={edit.id}
                    className={`bg-slate-700 border-slate-600 ${edit.is_rolled_back ? 'opacity-60' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <FileEdit size={20} className="text-purple-400 mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="outline" className="bg-purple-900/30 text-purple-300 border-purple-500/30">
                                {edit.edit_type}
                              </Badge>
                              <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-500/30">
                                {edit.target_type}
                              </Badge>
                              {edit.is_rolled_back && (
                                <Badge variant="outline" className="bg-amber-900/30 text-amber-300 border-amber-500/30">
                                  {getLocaleString('rolledBack', currentLanguage)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-300">
                              <User size={14} className="inline mr-1" />
                              {edit.editor_name} ({edit.editor_email})
                            </p>
                            <p className="text-xs text-slate-400">
                              <Clock size={12} className="inline mr-1" />
                              {formatDistanceToNow(new Date(edit.created_at), { addSuffix: true })}
                            </p>
                            {edit.target_id && (
                              <p className="text-xs text-slate-400 mt-1">
                                Target: {edit.target_id}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleExpanded(edit.id)}
                            className="text-slate-300 hover:text-white"
                          >
                            {expandedEdits.has(edit.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </Button>
                          {!edit.is_rolled_back && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRollback(edit)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Undo2 size={14} className="mr-1" />
                              Rollback
                            </Button>
                          )}
                        </div>
                      </div>

                      {expandedEdits.has(edit.id) && (
                        <div className="mt-4 space-y-3 border-t border-slate-600 pt-3">
                          <div>
                            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                              <XCircle size={12} />
                              Before:
                            </p>
                            <div className="bg-slate-800 p-3 rounded text-sm text-slate-200 font-mono whitespace-pre-wrap">
                              {edit.content_before || '(empty)'}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              After:
                            </p>
                            <div className="bg-slate-800 p-3 rounded text-sm text-green-300 font-mono whitespace-pre-wrap">
                              {edit.content_after || '(empty)'}
                            </div>
                          </div>
                          {edit.is_rolled_back && (
                            <div className="bg-amber-900/20 p-3 rounded">
                              <p className="text-xs text-amber-300 mb-1">
                                Rolled back by: {edit.rolled_back_by_name || 'Unknown'}
                              </p>
                              <p className="text-xs text-amber-400">
                                {formatDistanceToNow(new Date(edit.rolled_back_at), { addSuffix: true })}
                              </p>
                              {edit.rollback_reason && (
                                <p className="text-sm text-amber-200 mt-2">
                                  Reason: {edit.rollback_reason}
                                </p>
                              )}
                            </div>
                          )}
                          {edit.metadata && Object.keys(edit.metadata).length > 0 && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Metadata:</p>
                              <div className="bg-slate-800 p-2 rounded text-xs text-slate-300 font-mono">
                                {JSON.stringify(edit.metadata, null, 2)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditHistoryAdminPage;
