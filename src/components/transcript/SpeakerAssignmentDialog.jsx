
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getLocaleString } from '@/lib/locales';

const speakerDisplayColors = [
  'text-sky-400', 'text-emerald-400', 'text-amber-400', 
  'text-rose-400', 'text-indigo-400', 'text-pink-400',
  'text-teal-400', 'text-orange-400', 'text-cyan-400',
  'text-lime-400', 'text-fuchsia-400', 'text-violet-400'
];

const speakerColorCache = {};

const getSpeakerColor = (speakerId) => {
  if (speakerId === null || speakerId === undefined || String(speakerId).trim() === "") {
    return 'text-slate-400';
  }
  
  const speakerString = String(speakerId).trim();

  // Жёсткое сопоставление цветов для Pepe и Maria
  if (speakerString.toLowerCase() === 'pepe') {
    return 'text-fuchsia-400';
  }
  if (speakerString.toLowerCase() === 'maria') {
    return 'text-sky-400';
  }

  if (speakerColorCache[speakerString]) {
    return speakerColorCache[speakerString].color;
  }
  
  let idForColorHash = 0;
  for (let i = 0; i < speakerString.length; i++) {
    idForColorHash = (idForColorHash << 5) - idForColorHash + speakerString.charCodeAt(i);
    idForColorHash |= 0; 
  }
  
  const colorIndex = Math.abs(idForColorHash) % speakerDisplayColors.length;
  const color = speakerDisplayColors[colorIndex] || 'text-slate-400';
  
  speakerColorCache[speakerString] = { color };
  return color;
};

const SpeakerAssignmentDialog = ({
  isOpen,
  onClose,
  segment,
  onSave,
  currentLanguage,
  allUtterances = []
}) => {
  const [speakerName, setSpeakerName] = useState('');
  const [selectedExisting, setSelectedExisting] = useState('');
  const [actionType, setActionType] = useState('rename'); // 'rename', 'reassign', 'create'

  const quickAssignNames = useMemo(() => {
    return currentLanguage === 'ru' ? { pepe: 'Пепе', maria: 'Мария'} : { pepe: 'Pepe', maria: 'Maria'};
  }, [currentLanguage]);

  const availableSpeakers = useMemo(() => {
    const set = new Set();
    (allUtterances || []).forEach(u => {
      const s = (u && u.speaker !== undefined && u.speaker !== null) ? String(u.speaker).trim() : '';
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allUtterances]);

  const currentSpeaker = segment?.speaker;
  const hasCurrentSpeaker = currentSpeaker !== null && currentSpeaker !== undefined && String(currentSpeaker).trim() !== '';
  const isNumericDefault = hasCurrentSpeaker && (/^\d+$/.test(String(currentSpeaker)) || /^SPEAKER\s[A-Z0-9]+$/.test(String(currentSpeaker).toUpperCase()) || /^SPEAKER_[A-Z]$/.test(String(currentSpeaker).toUpperCase()));

  useEffect(() => {
    if (isOpen && segment) {
      // Если есть текущий спикер и он не дефолтный числовой - показываем его для переименования
      if (hasCurrentSpeaker && !isNumericDefault) {
        setSpeakerName(String(currentSpeaker));
        setActionType('rename');
      } else {
        setSpeakerName('');
        setActionType('create');
      }
      setSelectedExisting('');
    } else if (!isOpen) {
      setSpeakerName('');
      setSelectedExisting('');
      setActionType('rename');
    }
  }, [isOpen, segment, hasCurrentSpeaker, isNumericDefault, currentSpeaker]);

  const handleSave = () => {
    const oldSpeakerId = currentSpeaker;
    let finalSpeakerId;
    let isGlobalRename = false;

    switch (actionType) {
      case 'rename':
        // Переименовать текущего спикера глобально
        finalSpeakerId = speakerName.trim() || null;
        isGlobalRename = true;
        break;
      case 'reassign':
        // Переназначить сегмент на существующего спикера
        finalSpeakerId = selectedExisting === '__none__' ? null : selectedExisting;
        break;
      case 'create':
        // Создать нового спикера для этого сегмента
        finalSpeakerId = speakerName.trim() || null;
        break;
      default:
        finalSpeakerId = null;
    }
    
    onSave(segment, oldSpeakerId, finalSpeakerId, isGlobalRename);
    onClose();
  };

  const handleQuickAssign = (name) => {
    if (actionType === 'rename' || actionType === 'create') {
      setSpeakerName(name);
    }
  };

  if (!isOpen || !segment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-purple-300">{getLocaleString('assignSpeakerTitle', currentLanguage)}</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            {getLocaleString('assignSpeakerDescription', currentLanguage)} "{segment.text.substring(0,50)}..."
            {hasCurrentSpeaker && (
              <div className="mt-2 text-xs">
                {getLocaleString('currentSpeaker', currentLanguage)}: <span className={getSpeakerColor(currentSpeaker)}>{String(currentSpeaker)}</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="space-y-4">
            <RadioGroup value={actionType} onValueChange={setActionType} className="space-y-3">
              {hasCurrentSpeaker && !isNumericDefault && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rename" id="rename" className="border-slate-600 text-purple-400" />
                  <Label htmlFor="rename" className="text-slate-300 text-sm cursor-pointer">
                    {getLocaleString('renameSpeakerGlobally', currentLanguage)} "<span className={getSpeakerColor(currentSpeaker)}>{String(currentSpeaker)}</span>"
                  </Label>
                </div>
              )}
              
              {availableSpeakers.length > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reassign" id="reassign" className="border-slate-600 text-purple-400" />
                  <Label htmlFor="reassign" className="text-slate-300 text-sm cursor-pointer">
                    {getLocaleString('reassignToExistingSpeaker', currentLanguage)}
                  </Label>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="create" id="create" className="border-slate-600 text-purple-400" />
                <Label htmlFor="create" className="text-slate-300 text-sm cursor-pointer">
                  {getLocaleString('createNewSpeaker', currentLanguage)}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {actionType === 'reassign' && (
            <div className="space-y-2">
              <Label className="text-slate-300 font-medium">
                {getLocaleString('selectExistingSpeaker', currentLanguage)}
              </Label>
              <Select value={selectedExisting || '__none__'} onValueChange={(v) => setSelectedExisting(v === '__none__' ? '' : v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500">
                  <SelectValue placeholder={getLocaleString('selectSpeakerPlaceholder', currentLanguage)}>
                    {selectedExisting && selectedExisting !== '__none__' && (
                      <span className={getSpeakerColor(selectedExisting)}>{selectedExisting}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="__none__">
                    <span className="text-slate-400">{getLocaleString('unknownSpeaker', currentLanguage)}</span>
                  </SelectItem>
                  {availableSpeakers.map(s => (
                    <SelectItem key={s} value={s}>
                      <span className={getSpeakerColor(s)}>{s}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(actionType === 'rename' || actionType === 'create') && (
            <div className="space-y-2">
              <Label htmlFor="speaker-name-input" className="text-slate-300 font-medium">
                {actionType === 'rename' 
                  ? getLocaleString('newSpeakerName', currentLanguage)
                  : getLocaleString('speakerName', currentLanguage)
                }
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
                  <span className={getSpeakerColor('pepe')}>{quickAssignNames.pepe}</span>
                </Button>
                <Button size="xs" variant="outlineSubtle" onClick={() => handleQuickAssign(quickAssignNames.maria)} className="text-xs">
                  <span className={getSpeakerColor('maria')}>{quickAssignNames.maria}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row justify-end items-center mt-4 pt-4 border-t border-slate-700/50">
          <Button variant="outline" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 w-full sm:w-auto sm:mr-2">
            {getLocaleString('cancel', currentLanguage)}
          </Button>
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full sm:w-auto">
            {actionType === 'rename' 
              ? getLocaleString('renameSpeaker', currentLanguage)
              : actionType === 'reassign'
              ? getLocaleString('reassignSpeaker', currentLanguage) 
              : getLocaleString('createSpeaker', currentLanguage)
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SpeakerAssignmentDialog;
