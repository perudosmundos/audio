import React, { useState } from 'react';
import { useEditorAuth } from '@/contexts/EditorAuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, LogIn } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

export const EditorAuthModal = ({ isOpen, onClose, onSuccess, currentLanguage }) => {
  const { login, isAuthenticated } = useEditorAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, name);
      
      if (result.success) {
        setEmail('');
        setName('');
        if (onSuccess) onSuccess(result.editor);
        if (onClose) onClose();
      } else {
        setError(result.error || getLocaleString('loginFailed', currentLanguage));
      }
    } catch (err) {
      setError(err.message || getLocaleString('errorGeneric', currentLanguage));
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (value) => {
    const emailRegex = /^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(value);
  };

  const validateName = (value) => {
    const nameRegex = /^[A-Za-z\s\-]+$/;
    return nameRegex.test(value);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (error && validateEmail(value)) {
      setError('');
    }
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (error && validateName(value)) {
      setError('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <LogIn size={20} className="text-purple-400" />
            {getLocaleString('editorAuthentication', currentLanguage)}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {getLocaleString('editorAuthDescription', currentLanguage)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">
              {getLocaleString('email', currentLanguage)}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder={getLocaleString('emailPlaceholder', currentLanguage)}
              required
              disabled={isLoading}
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
            />
            {email && !validateEmail(email) && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {getLocaleString('emailLatinOnly', currentLanguage)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-200">
              {getLocaleString('name', currentLanguage)}
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder={getLocaleString('namePlaceholder', currentLanguage)}
              required
              disabled={isLoading}
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
            />
            {name && !validateName(name) && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {getLocaleString('nameLatinOnly', currentLanguage)}
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-900/20 border border-red-500/30">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
            >
              {getLocaleString('cancel', currentLanguage)}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !validateEmail(email) || !validateName(name)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  {getLocaleString('authenticating', currentLanguage)}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  {getLocaleString('authenticate', currentLanguage)}
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
