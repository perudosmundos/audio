import React, { useState } from 'react';
import { useEditorAuth } from '@/contexts/EditorAuthContext';
import { saveEditToHistory, getEditorHistory, getAllEditHistory } from '@/services/editHistoryService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, XCircle, TestTube } from 'lucide-react';

/**
 * Тестовый компонент для проверки системы истории правок
 * Используйте его для отладки и проверки работоспособности
 */
export const EditHistoryTester = () => {
  const { editor, isAuthenticated } = useEditorAuth();
  const { toast } = useToast();
  const [testResult, setTestResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testContent, setTestContent] = useState('Test content before');
  const [newContent, setNewContent] = useState('Test content after');

  const runTest = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      // Test 1: Check authentication
      console.log('Test 1: Checking authentication...');
      if (!isAuthenticated || !editor) {
        throw new Error('Not authenticated. Please login first.');
      }
      console.log('✓ Authentication OK:', editor);

      // Test 2: Save test edit to history
      console.log('Test 2: Saving test edit to history...');
      const saveResult = await saveEditToHistory({
        editorId: editor.id,
        editorEmail: editor.email,
        editorName: editor.name,
        editType: 'text_edit',
        targetType: 'ui_element',
        targetId: 'test-component-123',
        contentBefore: testContent,
        contentAfter: newContent,
        filePath: 'src/components/TestComponent.jsx',
        metadata: {
          line: 42,
          column: 10,
          test: true,
          timestamp: new Date().toISOString()
        }
      });

      if (!saveResult.success) {
        throw new Error(`Failed to save: ${saveResult.error}`);
      }
      console.log('✓ Save OK:', saveResult.data);

      // Test 3: Fetch editor history
      console.log('Test 3: Fetching editor history...');
      const historyResult = await getEditorHistory(editor.email, 10, 0);
      if (!historyResult.success) {
        throw new Error(`Failed to fetch history: ${historyResult.error}`);
      }
      console.log('✓ Fetch history OK:', historyResult.data);

      // Test 4: Fetch all history
      console.log('Test 4: Fetching all history...');
      const allHistoryResult = await getAllEditHistory({}, 10, 0);
      if (!allHistoryResult.success) {
        throw new Error(`Failed to fetch all history: ${allHistoryResult.error}`);
      }
      console.log('✓ Fetch all history OK:', allHistoryResult.data);

      setTestResult({
        success: true,
        message: 'All tests passed! ✓',
        details: {
          savedEdit: saveResult.data,
          historyCount: historyResult.data.length,
          totalCount: allHistoryResult.count
        }
      });

      toast({
        title: 'Tests Passed! ✓',
        description: `Successfully saved and retrieved edit history. Found ${historyResult.data.length} edits.`
      });

    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({
        success: false,
        message: error.message,
        error: error
      });

      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700 max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TestTube size={20} className="text-purple-400" />
          Edit History System Tester
        </CardTitle>
        <CardDescription className="text-slate-300">
          Test the edit history system functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Authentication Status */}
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Authentication Status</h3>
          {isAuthenticated ? (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle size={16} />
              <span>Authenticated as: {editor.name} ({editor.email})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400">
              <XCircle size={16} />
              <span>Not authenticated. Please login in Settings → Edit History</span>
            </div>
          )}
        </div>

        {/* Test Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Content Before:</label>
            <Input
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="Original content"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Content After:</label>
            <Input
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="New content"
            />
          </div>
        </div>

        {/* Run Test Button */}
        <Button
          onClick={runTest}
          disabled={!isAuthenticated || isLoading}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {isLoading ? 'Running Tests...' : 'Run Tests'}
        </Button>

        {/* Test Results */}
        {testResult && (
          <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle size={20} className="text-green-400" />
              ) : (
                <XCircle size={20} className="text-red-400" />
              )}
              <span className={`font-semibold ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.message}
              </span>
            </div>
            {testResult.details && (
              <div className="text-xs text-slate-300 mt-2 space-y-1">
                <p>• Edit ID: {testResult.details.savedEdit?.id}</p>
                <p>• Editor History Count: {testResult.details.historyCount}</p>
                <p>• Total Edits: {testResult.details.totalCount}</p>
              </div>
            )}
            {testResult.error && (
              <pre className="text-xs text-red-300 mt-2 bg-slate-900 p-2 rounded overflow-x-auto">
                {JSON.stringify(testResult.error, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-slate-400 space-y-1 mt-4 p-3 bg-slate-700/50 rounded">
          <p className="font-semibold text-slate-300">Testing Steps:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Make sure you're logged in (Settings → Edit History)</li>
            <li>Verify the database migration was applied</li>
            <li>Check browser console for detailed logs</li>
            <li>Click "Run Tests" to test the system</li>
            <li>Check /edit page to see the test edit</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
