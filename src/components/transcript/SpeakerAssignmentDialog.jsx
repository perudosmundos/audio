
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getLocaleString } from '@/lib/locales';

const SpeakerAssignmentDialog = ({
  isOpen,
  onClose,
  segment,
  onSave,
  currentLanguage
}) => {
  const [speakerName, setSpeakerName] = useState('');

  const quickAssignNames = useMemo(() => {
    return currentLanguage === 'ru' ? { pepe: 'Пепе', maria: 'Мария'} : { pepe: 'Pepe', maria: 'Maria'};
  }, [currentLanguage]);

  useEffect(() => {
    if (isOpen && segment) {
      const currentSpeaker = segment.speaker;
      const isNumericDefault = currentSpeaker !== null && currentSpeaker !== undefined && (/^\d+$/.test(String(currentSpeaker)) || /^SPEAKER\s[A-Z0-9]+$/.test(String(currentSpeaker).toUpperCase()) || /^SPEAKER_[A-Z]$/.test(String(currentSpeaker).toUpperCase()));
      setSpeakerName(isNumericDefault ? '' : (currentSpeaker || ''));
    } else if (!isOpen) {
      setSpeakerName('');
    }
  }, [isOpen, segment]);

  const handleSave = () => {
    const oldSpeakerId = segment?.speaker;
    let finalSpeakerId = speakerName.trim();

    if (finalSpeakerId === "") { 
        finalSpeakerId = null; 
    }
    
    onSave(segment, oldSpeakerId, finalSpeakerId);
    onClose();
  };

  const handleQuickAssign = (name) => {
    setSpeakerName(name);
  };

  if (!isOpen || !segment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-purple-300">{getLocaleString('assignSpeakerTitle', currentLanguage)}</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            {getLocaleString('assignSpeakerDescription', currentLanguage)} "{segment.text.substring(0,50)}..."
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="speaker-name-input" className="text-slate-300 font-medium">
                {getLocaleString('speakerName', currentLanguage)}
            </Label>
            <Input
              id="speaker-name-input"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500"
              placeholder={getLocaleString('enterSpeakerNamePlaceholder', currentLanguage)}
            />
            <div className="flex gap-2 mt-1.5">
                <Button size="xs" variant="outlineSubtle" onClick={() => handleQuickAssign(quickAssignNames.pepe)} className="text-xs">
                    {quickAssignNames.pepe}
                </Button>
                <Button size="xs" variant="outlineSubtle" onClick={() => handleQuickAssign(quickAssignNames.maria)} className="text-xs">
                    {quickAssignNames.maria}
                </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row justify-end items-center mt-4 pt-4 border-t border-slate-700/50">
          <Button variant="outline" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 w-full sm:w-auto sm:mr-2">
            {getLocaleString('cancel', currentLanguage)}
          </Button>
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full sm:w-auto">
            {getLocaleString('saveSpeakerAssignment', currentLanguage)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SpeakerAssignmentDialog;
