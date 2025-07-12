
import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Settings, ScrollText, Download, SkipForward, PlusCircle, Gauge } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const PlayerSettingsMenu = ({
  currentLanguage,
  showTranscript,
  onToggleShowTranscript,
  skipEmptySegments,
  onToggleSkipEmptySegments,
  onDownloadAudio,
  isCompact = false,
  playbackRateOptions,
  currentPlaybackRateValue,
  onSetPlaybackRate,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size={isCompact ? "icon_sm" : "icon"} 
          className={`text-white/80 hover:text-white hover:bg-white/15 ${isCompact ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11'}`}
          aria-label={getLocaleString('settings', currentLanguage)}
        >
          <Settings className={isCompact ? "h-4 w-4" : "h-4 w-4 sm:h-5 sm:w-5 md:h-5 md:w-5"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 bg-slate-800 border-slate-700 text-slate-100 shadow-xl" side="top" align="start">
        <DropdownMenuLabel className="text-purple-300">{getLocaleString('settings', currentLanguage)}</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        
        <DropdownMenuCheckboxItem
          checked={showTranscript}
          onCheckedChange={onToggleShowTranscript}
          className="focus:bg-slate-700 data-[state=checked]:bg-purple-600/30"
        >
          <ScrollText className="mr-2 h-4 w-4 text-purple-300" />
          <span>{getLocaleString('showTranscript', currentLanguage)}</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={skipEmptySegments}
          onCheckedChange={onToggleSkipEmptySegments}
          className="focus:bg-slate-700 data-[state=checked]:bg-purple-600/30"
        >
          <SkipForward className="mr-2 h-4 w-4 text-purple-300" />
          <span>{getLocaleString('skipEmptySegments', currentLanguage)}</span>
        </DropdownMenuCheckboxItem>
        
        <DropdownMenuSeparator className="bg-slate-700" />

        <DropdownMenuLabel className="text-purple-300 flex items-center">
            <Gauge className="mr-2 h-4 w-4" />
            {getLocaleString('playbackSpeed', currentLanguage)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={String(currentPlaybackRateValue)} onValueChange={(value) => onSetPlaybackRate(parseFloat(value))}>
            {playbackRateOptions.map(option => (
                <DropdownMenuRadioItem 
                    key={option.value} 
                    value={String(option.value)}
                    className="focus:bg-slate-700 data-[state=checked]:bg-purple-600/30"
                >
                    {option.label}
                </DropdownMenuRadioItem>
            ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator className="bg-slate-700" />

        <DropdownMenuItem onClick={onDownloadAudio} className="focus:bg-slate-700">
          <Download className="mr-2 h-4 w-4 text-purple-300" />
          <span>{getLocaleString('downloadAudio', currentLanguage)}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PlayerSettingsMenu;
