import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

const OverwriteDialog = ({ isOpen, onOpenChange, onConfirm, onCancel, slug, currentLanguage }) => {
  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-yellow-400 flex items-center">
            <AlertTriangle className="h-6 w-6 mr-2" />
            {getLocaleString('confirmOverwriteTitle', currentLanguage)}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {getLocaleString('confirmOverwriteMessage', currentLanguage, { slug: slug })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="bg-slate-600 hover:bg-slate-500 border-slate-500">
            {getLocaleString('cancel', currentLanguage)}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            {getLocaleString('overwrite', currentLanguage)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default OverwriteDialog;