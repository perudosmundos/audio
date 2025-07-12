import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ListPlus } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import { parseQuestionsFromDescriptionString } from '@/lib/podcastService.js';

const BatchAddQuestionsDialog = ({
  isOpen,
  onClose,
  batchQuestionsText,
  onBatchQuestionsTextChange,
  onSave,
  currentLanguage,
  episodeLang,
  episodeSlug, // Changed from episodeId
  episodeDate, // Changed from episodeParsedDate
}) => {
  const handleProcessAndAdd = () => {
    if (!batchQuestionsText.trim()) return;
    const parsed = parseQuestionsFromDescriptionString(batchQuestionsText, episodeLang, episodeSlug);
    onSave(parsed);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-purple-300">{getLocaleString('batchAddQuestionsDialogTitle', currentLanguage)}</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            {getLocaleString('batchAddQuestionsDialogDescription', currentLanguage)}
            <pre className="mt-2 p-2 bg-slate-800/50 rounded text-xs text-slate-300 whitespace-pre-wrap">{`00:00:57 ${getLocaleString('bilingualExamplePart1', currentLanguage)} / ${getLocaleString('bilingualExamplePart2', currentLanguage)}\n0:03:17 ${getLocaleString('singleLanguageExample', currentLanguage)}`}</pre>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="batch-questions-text-dialog" className="text-slate-300 font-medium">{getLocaleString('pasteQuestionsList', currentLanguage)}</Label>
            <Textarea 
              id="batch-questions-text-dialog" 
              value={batchQuestionsText} 
              onChange={(e) => onBatchQuestionsTextChange(e.target.value)} 
              className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500 min-h-[150px] text-sm" 
              placeholder={getLocaleString('batchAddPlaceholder', currentLanguage)}
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row justify-end items-center mt-4 pt-4 border-t border-slate-700/50">
          <Button variant="outline" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 w-full sm:w-auto mb-2 sm:mb-0 sm:mr-2">{getLocaleString('cancel', currentLanguage)}</Button>
          <Button onClick={handleProcessAndAdd} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full sm:w-auto"><ListPlus className="h-4 w-4 mr-2" />{getLocaleString('processAndAdd', currentLanguage)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchAddQuestionsDialog;