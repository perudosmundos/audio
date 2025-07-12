import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, X, CornerLeftUp, DivideSquare, Trash2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const SegmentEditControls = ({
  onSave,
  onCancel,
  onSplit,
  onMerge,
  onDelete,
  isFirstOverallSegment,
  currentLanguage,
}) => {
  return (
    <div 
      className="flex flex-wrap items-center justify-start gap-1 pt-1.5"
    >
      <TooltipProvider delayDuration={200}>
         {!isFirstOverallSegment && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onMerge} variant="ghost" size="icon_sm" className="h-7 w-7 text-white hover:bg-slate-700/70">
                <CornerLeftUp size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700">
              <p>{getLocaleString('mergeWithPreviousSegment', currentLanguage)}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onSplit} variant="ghost" size="icon_sm" className="h-7 w-7 text-white hover:bg-slate-700/70">
              <DivideSquare size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700">
            <p>{getLocaleString('splitSegmentAtCursor', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
             <Button onClick={onDelete} variant="ghost" size="icon_sm" className="h-7 w-7 text-white hover:bg-slate-700/70">
              <Trash2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-slate-800 text-white border-slate-700">
            <p>{getLocaleString('deleteSegment', currentLanguage)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-grow"></div> 

      <Button onClick={onCancel} variant="ghost" size="icon_sm" className="h-7 w-7 text-white hover:bg-slate-700/70">
        <X size={18} />
      </Button>
      <Button onClick={onSave} variant="ghost" size="icon_sm" className="h-7 w-7 text-white hover:bg-slate-700/70">
        <Check size={18} /> 
      </Button>
    </div>
  );
};

export default SegmentEditControls;