import React from 'react';
import { Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocaleString } from '@/lib/locales';
import { formatFullTime } from '@/lib/utils';

const QuestionBlockHeader = ({ 
  question, 
  isActiveQuestion, 
  isExpanded, 
  editingSegment,
  onActivate, 
  onToggleExpansion, 
  onEditQuestion, 
  currentLanguage,
  segmentsAvailable,
  isReadingMode
}) => (
  <div 
    className={`flex justify-between items-center p-1.5 rounded-t-md transition-colors
      ${isReadingMode ? 'cursor-default' : 'cursor-pointer hover:bg-slate-700/20'}
      ${isActiveQuestion && !isReadingMode ? 'bg-purple-600/15' : ''}
      ${isReadingMode ? 'mb-1 pb-2 border-b-0' : ''} 
    `}
    onClick={isReadingMode ? undefined : onActivate}
    role={isReadingMode ? undefined : "button"}
    tabIndex={isReadingMode ? undefined : 0}
    onKeyPress={(e) => { if(e.key === 'Enter' && !isReadingMode) { onActivate() } }}
  >
    <div className="flex items-center gap-2 overflow-hidden">
        {!isReadingMode && (
          <div className={`text-white text-xs px-1.5 py-0.5 rounded tabular-nums ${isActiveQuestion ? 'bg-purple-500' : 'bg-blue-500/70'}`}>
            {formatFullTime(question.time, true)}
          </div>
        )}
      <span className={`font-medium flex-grow min-w-0 ${isReadingMode ? 'text-xl font-semibold text-slate-900 whitespace-normal' : 'text-sm text-slate-100 line-clamp-1'}`}>
        {question.title || ''}
      </span>
    </div>
    {!isReadingMode && (
      <div className="flex items-center shrink-0">
        {!editingSegment && segmentsAvailable && (
            <Button 
                variant="ghost" 
                size="icon_sm" 
                onClick={(e) => {e.stopPropagation(); onToggleExpansion();}}
                className="text-slate-300 hover:text-white hover:bg-white/15 h-7 w-7"
                aria-label={isExpanded ? getLocaleString('hide', currentLanguage) : getLocaleString('showText', currentLanguage)}
            >
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </Button>
        )}
        {!editingSegment && (
          <Button 
            variant="ghost" 
            size="icon_sm" 
            onClick={(e) => {
              e.stopPropagation();
              if(onEditQuestion) onEditQuestion(question);
            }}
            className="text-slate-300 hover:text-white hover:bg-white/15 h-7 w-7"
            aria-label={`${getLocaleString('editQuestion', currentLanguage)} ${question.title}`}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )}
  </div>
);

export default QuestionBlockHeader;