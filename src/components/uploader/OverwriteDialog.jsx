import React, { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const OverwriteDialog = ({ isOpen, onOpenChange, onConfirm, onCancel, slug, currentLanguage }) => {
  const [overwriteOptions, setOverwriteOptions] = useState({
    overwriteServerFile: true,
    overwriteEpisodeInfo: true,
    overwriteTranscript: true,
    overwriteQuestions: true,
  });

  if (!isOpen) return null;

  const handleCheckboxChange = (option) => {
    setOverwriteOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const handleConfirm = () => {
    onConfirm(overwriteOptions);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-yellow-400 flex items-center">
            <AlertTriangle className="h-6 w-6 mr-2" />
            {getLocaleString('confirmOverwriteTitle', currentLanguage)}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {getLocaleString('confirmOverwriteMessage', currentLanguage, { slug: slug })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 my-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="overwriteServerFile"
              checked={overwriteOptions.overwriteServerFile}
              onChange={() => handleCheckboxChange('overwriteServerFile')}
              className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="overwriteServerFile" className="text-sm text-slate-300">
              {getLocaleString('overwriteServerFile', currentLanguage)}
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="overwriteEpisodeInfo"
              checked={overwriteOptions.overwriteEpisodeInfo}
              onChange={() => handleCheckboxChange('overwriteEpisodeInfo')}
              className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="overwriteEpisodeInfo" className="text-sm text-slate-300">
              {getLocaleString('overwriteEpisodeInfo', currentLanguage)}
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="overwriteTranscript"
              checked={overwriteOptions.overwriteTranscript}
              onChange={() => handleCheckboxChange('overwriteTranscript')}
              className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="overwriteTranscript" className="text-sm text-slate-300">
              {getLocaleString('overwriteTranscript', currentLanguage)}
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="overwriteQuestions"
              checked={overwriteOptions.overwriteQuestions}
              onChange={() => handleCheckboxChange('overwriteQuestions')}
              className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="overwriteQuestions" className="text-sm text-slate-300">
              {getLocaleString('overwriteQuestions', currentLanguage)}
            </label>
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="bg-slate-600 hover:bg-slate-500 border-slate-500">
            {getLocaleString('cancel', currentLanguage)}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-red-600 hover:bg-red-700">
            {getLocaleString('overwrite', currentLanguage)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OverwriteDialog;