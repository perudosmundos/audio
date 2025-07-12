import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { getLocaleString } from '@/lib/locales';

const EditConfirmationDialog = ({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  actionType,
  currentLanguage,
}) => {
  const dontAskAgainKey = `confirm${actionType}SegmentDisabled`;

  const handleCheckedChange = (checked) => {
    localStorage.setItem(dontAskAgainKey, checked.toString());
  };
  
  const isDontAskAgainChecked = localStorage.getItem(dontAskAgainKey) === 'true';


  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className={
            actionType === 'Delete' ? 'text-red-500' : 
            actionType === 'Merge' ? 'text-orange-400' :
            actionType === 'Split' ? 'text-blue-400' : 'text-slate-50'
          }>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center space-x-2 my-4">
          <Checkbox 
            id={`dont-ask-${actionType}`} 
            checked={isDontAskAgainChecked}
            onCheckedChange={handleCheckedChange}
            className={
                actionType === 'Delete' ? 'border-slate-600 data-[state=checked]:bg-red-600 data-[state=checked]:text-white' :
                actionType === 'Merge' ? 'border-slate-600 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white' :
                actionType === 'Split' ? 'border-slate-600 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white' :
                'border-slate-600 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white'
            }
          />
          <label
            htmlFor={`dont-ask-${actionType}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-300"
          >
            {getLocaleString('doNotAskAgain', currentLanguage)}
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">{getLocaleString('cancel', currentLanguage)}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            className={
                actionType === 'Delete' ? 'bg-red-600 hover:bg-red-700 text-white' : 
                actionType === 'Merge' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                actionType === 'Split' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                'bg-purple-600 hover:bg-purple-700 text-white'
            }
          >
            {getLocaleString('confirm', currentLanguage) || 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EditConfirmationDialog;