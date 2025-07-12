import React from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocaleString } from '@/lib/locales';

const TranscriptSearch = ({ searchTerm, onSearchTermChange, currentLanguage }) => {
  return (
    <div className="relative mb-2">
      <Input
        type="text"
        placeholder={getLocaleString('searchTranscriptPlaceholder', currentLanguage)}
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        className="pl-9 pr-8 bg-slate-800/50 border-slate-700/60 focus:border-purple-500 text-slate-100 placeholder-slate-400 text-sm h-9"
      />
      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
      {searchTerm && (
        <Button
          variant="ghost"
          size="icon_sm"
          className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-slate-200"
          onClick={() => onSearchTermChange('')}
        >
          <X size={16} />
        </Button>
      )}
    </div>
  );
};

export default TranscriptSearch;