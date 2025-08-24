import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import { formatFullTime } from '@/lib/utils';

const parseTimeToSeconds = (value) => {
  if (typeof value === 'number') return value;
  const parts = String(value || '').trim().split(':').map(Number);
  let seconds = NaN;
  if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
  else if (parts.length === 1 && !isNaN(parts[0])) seconds = parts[0];
  return seconds;
};

const autoFormatTimeInput = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 6);
  if (!digits) return '';
  let hh = '', mm = '', ss = '';
  if (digits.length <= 2) {
    ss = digits;
  } else if (digits.length <= 4) {
    mm = digits.slice(0, digits.length - 2);
    ss = digits.slice(-2);
  } else {
    hh = digits.slice(0, digits.length - 4);
    mm = digits.slice(-4, -2);
    ss = digits.slice(-2);
  }
  return [hh, mm, ss].filter(Boolean).map((v, i) => (i === 0 ? v.padStart(2, '0') : v.padStart(2, '0'))).join(':');
};

const AddSegmentDialog = ({
  isOpen,
  onClose,
  onSave,
  currentLanguage,
  defaultStartSec,
  defaultEndSec,
}) => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (isOpen) {
      const start = typeof defaultStartSec === 'number' ? defaultStartSec : undefined;
      const end = typeof defaultEndSec === 'number' ? defaultEndSec : (typeof start === 'number' ? start + 1 : undefined);
      setStartInput(typeof start === 'number' ? formatFullTime(start, true) : '');
      setEndInput(typeof end === 'number' ? formatFullTime(end, true) : '');
      setText('');
    }
  }, [isOpen, defaultStartSec, defaultEndSec]);

  const handleSave = () => {
    const startSec = parseTimeToSeconds(startInput);
    const endSec = parseTimeToSeconds(endInput);
    if (isNaN(startSec) || isNaN(endSec) || startSec < 0 || endSec <= startSec) {
      return; // Parent should show error via toast after validation if desired
    }
    onSave({ startSec, endSec, text: text || '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-purple-300">
            {getLocaleString('addSegment', currentLanguage)}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            {getLocaleString('addSegmentDescription', currentLanguage)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="segment-start" className="text-slate-300 font-medium">{getLocaleString('segmentStartTime', currentLanguage)}</Label>
            <Input id="segment-start" value={startInput} onChange={(e) => setStartInput(autoFormatTimeInput(e.target.value))} placeholder="HH:MM:SS" className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="segment-end" className="text-slate-300 font-medium">{getLocaleString('segmentEndTime', currentLanguage)}</Label>
            <Input id="segment-end" value={endInput} onChange={(e) => setEndInput(autoFormatTimeInput(e.target.value))} placeholder="HH:MM:SS" className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="segment-text" className="text-slate-300 font-medium">{getLocaleString('segmentText', currentLanguage)}</Label>
            <Input id="segment-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={getLocaleString('editTextSegmentPlaceholder', currentLanguage)} className="bg-slate-800 border-slate-700 focus:border-purple-500 focus:ring-purple-500" />
          </div>
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row justify-end items-center mt-2 pt-3 border-t border-slate-700/50 gap-2">
          <Button variant="outline" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" /> {getLocaleString('cancel', currentLanguage)}
          </Button>
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700 text-white font-semibold w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" /> {getLocaleString('saveSegment', currentLanguage)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddSegmentDialog;



