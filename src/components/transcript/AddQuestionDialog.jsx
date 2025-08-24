
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Save } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import { formatFullTime } from '@/lib/utils';
import PlayerControls from '@/components/player/PlayerControls';

const AddQuestionDialog = ({ 
    isOpen, 
    onClose, 
    segment,
    initialTime, 
    initialTitle,
    onSave, 
    onDelete,
    currentLanguage,
    audioRef,
    mainPlayerIsPlaying,
    mainPlayerTogglePlayPause,
    mainPlayerSeekAudio,
    duration,
    isEditing = false,
    disableTimeEditing = false,
    hideDelete = false
}) => {
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionTime, setQuestionTime] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (segment) {
        setQuestionTime(segment.start / 1000);
      } else if (initialTime !== undefined) {
        setQuestionTime(initialTime);
      } else {
        setQuestionTime(0);
      }
      setQuestionTitle(initialTitle || ''); 
    }
  }, [segment, initialTime, initialTitle, isOpen]);

  const handleSave = () => {
    if (!questionTitle.trim()) return;
    onSave(questionTitle, questionTime); 
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const handleDialogTimeAdjust = (amount) => {
    const newTime = Math.max(0, Math.min(duration || Infinity, questionTime + amount));
    setQuestionTime(newTime);
    if(mainPlayerSeekAudio) mainPlayerSeekAudio(newTime, true); 
  };
  
  const handleDialogTimeInputChange = (e) => {
    const parts = e.target.value.split(':').map(Number);
    let newTimeValue = 0;
    if (parts.length === 3) newTimeValue = parts[0]*3600 + parts[1]*60 + parts[2];
    else if (parts.length === 2) newTimeValue = parts[0]*60 + parts[1];
    else if (parts.length === 1 && !isNaN(parts[0])) newTimeValue = parts[0];
    else {
        setQuestionTime(NaN); 
        return;
    }
     
    if (!isNaN(newTimeValue) && newTimeValue >= 0 && newTimeValue <= (duration || Infinity)) {
        setQuestionTime(newTimeValue);
        if(mainPlayerSeekAudio) mainPlayerSeekAudio(newTimeValue, false); 
    } else if (e.target.value === "") {
        setQuestionTime(0); 
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-purple-300">
            {isEditing 
              ? getLocaleString('editQuestionDialogTitle', currentLanguage)
              : getLocaleString('addQuestionDialogTitle', currentLanguage)
            }
          </DialogTitle>
           <DialogDescription className="text-sm text-slate-400">
             {segment 
                ? getLocaleString('addQuestionDialogDescriptionSegment', currentLanguage, {segmentText: segment.text.substring(0, 70) + "..."})
                : getLocaleString('addQuestionDialogDescription', currentLanguage)
             }
           </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-question-time" className="text-slate-300 font-medium">{getLocaleString('questionTime', currentLanguage)}</Label>
              <Input
                id="dialog-question-time"
                type="text"
                value={formatFullTime(questionTime, true)}
                onChange={handleDialogTimeInputChange}
                className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500 col-span-3 tabular-nums"
                placeholder="HH:MM:SS"
                disabled={disableTimeEditing}
              />
              {!disableTimeEditing && (
                <PlayerControls 
                  variant="timeAdjustment"
                  isPlaying={mainPlayerIsPlaying} 
                  onPlayPause={mainPlayerTogglePlayPause} 
                  onAdjustTime={handleDialogTimeAdjust} 
                  currentTime={questionTime} 
                  mainPlayerSeekAudio={mainPlayerSeekAudio}
                  currentLanguage={currentLanguage}
                  audioRefCurrentTime={audioRef?.current?.currentTime}
                  playerDuration={duration}
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dialog-question-title" className="text-slate-300 font-medium">{getLocaleString('questionTitle', currentLanguage)}</Label>
              <Input
                id="dialog-question-title"
                value={questionTitle}
                onChange={(e) => setQuestionTitle(e.target.value)}
                className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500"
                placeholder={getLocaleString('questionTitlePlaceholder', currentLanguage)}
              />
            </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row justify-between items-center mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            {isEditing && onDelete && !hideDelete && (
              <Button 
                variant="outline" 
                onClick={handleDelete} 
                className="bg-red-600/10 hover:bg-red-600/20 border-red-500/30 text-red-400 hover:text-red-300 w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {getLocaleString('deleteQuestion', currentLanguage)}
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto mb-2 sm:mb-0">
            <Button variant="outline" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 w-full sm:w-auto">
                {getLocaleString('cancel', currentLanguage)}
            </Button>
            <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              {getLocaleString('saveQuestion', currentLanguage)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddQuestionDialog;
