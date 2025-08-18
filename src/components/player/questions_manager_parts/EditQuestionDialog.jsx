
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Trash2 } from 'lucide-react';
import PlayerControls from '@/components/player/PlayerControls.jsx';
import { formatFullTime } from '@/lib/utils';
import { getLocaleString } from '@/lib/locales';

const EditQuestionDialog = ({
  isOpen,
  onClose,
  questionData,
  onSave,
  onDelete,
  isAdding,
  dialogTime: externalDialogTime,
  onDialogTimeChange,
  onDialogTimeAdjust,
  onDialogTimeInputChange,
  questionLang: externalQuestionLang,
  onQuestionLangChange,
  currentLanguage,
  duration,
  mainPlayerIsPlaying,
  mainPlayerTogglePlayPause,
  mainPlayerSeekAudio,
}) => {
  const [internalTitle, setInternalTitle] = useState('');
  
  const isSpecialBlock = questionData?.is_intro || questionData?.is_full_transcript || questionData?.id === 'intro-virtual';

  useEffect(() => {
    setInternalTitle(questionData?.title || '');
  }, [questionData?.id, questionData?.title, isAdding]);

  const handleSave = () => {
    if (!internalTitle.trim() && !isSpecialBlock) return; 
    
    let timeToSave = parseFloat(externalDialogTime.toFixed(2));
    if (isSpecialBlock) {
      timeToSave = questionData.time; 
    }

    if (isNaN(timeToSave) || timeToSave < 0 || timeToSave > duration) return;
    
    onSave({ 
      ...questionData, 
      title: internalTitle, 
      time: timeToSave, 
      lang: externalQuestionLang,
      is_intro: questionData?.is_intro || false,
      is_full_transcript: questionData?.is_full_transcript || false
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-purple-300">
            {isAdding ? getLocaleString('addQuestionDialogTitle', currentLanguage) : getLocaleString('editQuestionDialogTitle', currentLanguage)}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            {isAdding ? getLocaleString('addQuestionDialogDescription', currentLanguage) : getLocaleString('editQuestionDialogDescription', currentLanguage)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="question-time-dialog" className="text-slate-300 font-medium">{getLocaleString('questionTime', currentLanguage)}</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="question-time-dialog" 
                type="text" 
                value={formatFullTime(externalDialogTime, true)} 
                onChange={onDialogTimeInputChange} 
                className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500 col-span-3 tabular-nums" 
                placeholder="HH:MM:SS" 
                disabled={isSpecialBlock}
              />
            </div>
            {!isSpecialBlock && (
              <PlayerControls 
                variant="timeAdjustment" 
                isPlaying={mainPlayerIsPlaying} 
                onPlayPause={mainPlayerTogglePlayPause} 
                onAdjustTime={onDialogTimeAdjust} 
                currentTime={externalDialogTime} 
                mainPlayerSeekAudio={mainPlayerSeekAudio} 
                currentLanguage={currentLanguage}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="question-title-dialog" className="text-slate-300 font-medium">{getLocaleString('questionTitle', currentLanguage)}</Label>
            <Input 
              id="question-title-dialog" 
              value={internalTitle} 
              onChange={(e) => setInternalTitle(e.target.value)} 
              className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500" 
              placeholder={getLocaleString('questionTitlePlaceholder', currentLanguage)}
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row justify-between items-center mt-4 pt-4 border-t border-slate-700/50">
          {!isAdding && questionData && questionData.id && !isSpecialBlock && (
            <Button variant="destructive" onClick={() => onDelete(questionData.id)} className="w-full sm:w-auto mb-2 sm:mb-0 bg-red-600 hover:bg-red-700 text-white font-semibold">
              <Trash2 className="h-4 w-4 mr-2" />{getLocaleString('deleteQuestion', currentLanguage)}
            </Button>
          )}
           <div className={`w-full sm:w-auto ${(!isAdding && questionData && questionData.id && !isSpecialBlock) ? 'sm:ml-auto' : 'ml-auto'} flex gap-2`}>
            <Button variant="outline" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 w-full sm:w-auto">{getLocaleString('cancel', currentLanguage)}</Button>
            <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full sm:w-auto"><Save className="h-4 w-4 mr-2" />{getLocaleString('saveQuestion', currentLanguage)}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditQuestionDialog;
