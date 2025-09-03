import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLocaleString } from '@/lib/locales';
import { Download, FileText, File, FileImage } from 'lucide-react';

const DownloadTextDialog = ({ 
  isOpen, 
  onClose, 
  currentLanguage, 
  questions = [], 
  transcript = [],
  episodeTitle = '',
  onDownload 
}) => {
  const [contentType, setContentType] = useState('all'); // 'all' or 'questions'
  const [includeTimings, setIncludeTimings] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(false);
  const [format, setFormat] = useState('txt');
  const [selectedQuestions, setSelectedQuestions] = useState([]);

  const handleQuestionToggle = (questionId) => {
    setSelectedQuestions(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleDownload = () => {
    const options = {
      contentType,
      includeTimings,
      includeSpeakers,
      format,
      selectedQuestions: contentType === 'questions' ? selectedQuestions : null
    };
    
    onDownload(options);
    onClose();
  };

  const getFormatIcon = (formatType) => {
    switch (formatType) {
      case 'txt':
        return <FileText className="h-4 w-4" />;
      case 'doc':
        return <File className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-purple-300 flex items-center gap-2">
            <Download className="h-5 w-5" />
            {getLocaleString('downloadTextSettings', currentLanguage)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Content Type Selection */}
          <div className="space-y-3">
            <Label className="text-slate-300 font-medium">
              {getLocaleString('contentType', currentLanguage)}
            </Label>
            <RadioGroup value={contentType} onValueChange={setContentType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="text-slate-200">
                  {getLocaleString('allText', currentLanguage)}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="questions" id="questions" />
                <Label htmlFor="questions" className="text-slate-200">
                  {getLocaleString('selectedQuestions', currentLanguage)}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Question Selection */}
          {contentType === 'questions' && (
            <div className="space-y-3">
              <Label className="text-slate-300 font-medium">
                {getLocaleString('selectQuestions', currentLanguage)}
              </Label>
              <div className="max-h-40 overflow-y-auto space-y-2 bg-slate-700/50 rounded-lg p-3">
                {questions.map((question) => (
                  <div key={question.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`question-${question.id}`}
                      checked={selectedQuestions.includes(question.id)}
                      onCheckedChange={() => handleQuestionToggle(question.id)}
                    />
                    <Label 
                      htmlFor={`question-${question.id}`} 
                      className="text-slate-200 text-sm cursor-pointer flex-1"
                    >
                      {question.title || getLocaleString('untitledQuestion', currentLanguage)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Include Timings */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeTimings"
              checked={includeTimings}
              onCheckedChange={setIncludeTimings}
            />
            <Label htmlFor="includeTimings" className="text-slate-200">
              {getLocaleString('includeTimings', currentLanguage)}
            </Label>
          </div>

          {/* Include Speakers */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeSpeakers"
              checked={includeSpeakers}
              onCheckedChange={setIncludeSpeakers}
            />
            <Label htmlFor="includeSpeakers" className="text-slate-200">
              {getLocaleString('includeSpeakers', currentLanguage)}
            </Label>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-slate-300 font-medium">
              {getLocaleString('format', currentLanguage)}
            </Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="txt" className="text-slate-100 focus:bg-slate-600">
                  <div className="flex items-center gap-2">
                    {getFormatIcon('txt')}
                    <span>TXT</span>
                  </div>
                </SelectItem>
                <SelectItem value="doc" className="text-slate-100 focus:bg-slate-600">
                  <div className="flex items-center gap-2">
                    {getFormatIcon('doc')}
                    <span>DOC</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {getLocaleString('cancel', currentLanguage)}
          </Button>
          <Button 
            onClick={handleDownload}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={contentType === 'questions' && selectedQuestions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {getLocaleString('download', currentLanguage)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadTextDialog;
