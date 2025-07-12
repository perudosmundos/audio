import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, TextSelect, AlertTriangle } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const TranscriptControls = ({
  isLoading,
  transcriptError,
  transcriptAvailable,
  onRefresh,
  onStartTranscription,
  currentLanguage,
  assemblyLang,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-300 text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> {getLocaleString('loadingTranscript', currentLanguage)}
      </div>
    );
  }

  if (transcriptError) {
    return (
      <div className="text-red-400 text-center p-2 text-xs bg-red-900/20 rounded-md flex items-center justify-center">
        <AlertTriangle size={16} className="mr-2"/> {transcriptError}
      </div>
    );
  }

  if (!transcriptAvailable) {
    return (
      <div className="text-center py-4">
        <p className="text-slate-400 mb-2 text-sm">{getLocaleString('noTranscriptAvailableYet', currentLanguage)}</p>
        <Button onClick={onStartTranscription} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-xs h-8">
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <TextSelect className="h-3 w-3 mr-1.5" />}
          {getLocaleString('startTranscription', currentLanguage)} ({assemblyLang})
        </Button>
      </div>
    );
  }
  
  return null; 
};

export default TranscriptControls;