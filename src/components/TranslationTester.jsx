import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { translateTextOpenAI, translateTranscriptOpenAI } from '@/lib/openAIService';
import { useToast } from '@/components/ui/use-toast';

const TranslationTester = () => {
  const [text, setText] = useState('Привет, как дела?');
  const [questions, setQuestions] = useState('Как дела?\nЧто нового?\nКак настроение?');
  const [targetLang, setTargetLang] = useState('en');
  const [textResult, setTextResult] = useState('');
  const [questionsResult, setQuestionsResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'ru', name: 'Russian' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'pl', name: 'Polish' },
  ];

  const handleTestText = async () => {
    if (!text.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите текст для перевода',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setTextResult('');

    try {
      const translated = await translateTextOpenAI(text, targetLang, 'ru');
      setTextResult(translated);
      
      toast({
        title: 'Успех',
        description: 'Перевод текста выполнен успешно',
        duration: 3000
      });
    } catch (error) {
      console.error('Text translation test error:', error);
      setTextResult(`Ошибка: ${error.message}`);
      
      toast({
        title: 'Ошибка перевода текста',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestQuestions = async () => {
    if (!questions.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите вопросы для перевода',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setQuestionsResult('');

    try {
      const questionList = questions.split('\n').filter(q => q.trim());
      const translatedQuestions = [];

      for (const question of questionList) {
        const translated = await translateTextOpenAI(question.trim(), targetLang, 'ru');
        translatedQuestions.push(translated);
      }

      setQuestionsResult(translatedQuestions.join('\n'));
      
      toast({
        title: 'Успех',
        description: `Переведено ${translatedQuestions.length} вопросов`,
        duration: 3000
      });
    } catch (error) {
      console.error('Questions translation test error:', error);
      setQuestionsResult(`Ошибка: ${error.message}`);
      
      toast({
        title: 'Ошибка перевода вопросов',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestTranscript = async () => {
    if (!text.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите текст для тестирования транскрипта',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setTextResult('');

    try {
      // Создаем mock transcript data
      const mockTranscript = {
        utterances: [
          {
            text: text,
            start: 0,
            end: 5,
            speaker: 'A'
          }
        ]
      };

      const translated = await translateTranscriptOpenAI(mockTranscript, targetLang, 'ru');
      
      if (translated && translated.utterances && translated.utterances.length > 0) {
        setTextResult(translated.utterances[0].text);
      } else {
        setTextResult('Ошибка: пустой результат транскрипта');
      }
      
      toast({
        title: 'Успех',
        description: 'Перевод транскрипта выполнен успешно',
        duration: 3000
      });
    } catch (error) {
      console.error('Transcript translation test error:', error);
      setTextResult(`Ошибка транскрипта: ${error.message}`);
      
      toast({
        title: 'Ошибка перевода транскрипта',
        description: error.message,
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Тестер переводчика (Текст + Вопросы)</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Тест перевода текста */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Тест перевода текста</h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">Исходный текст:</label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Введите текст для перевода"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Целевой язык:</label>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name} ({lang.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleTestText} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Переводим текст...' : 'Перевести текст'}
            </Button>
            
            <Button 
              onClick={handleTestTranscript} 
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? 'Тестируем транскрипт...' : 'Тест транскрипта'}
            </Button>
          </div>

          {textResult && (
            <div>
              <label className="block text-sm font-medium mb-2">Результат:</label>
              <div className="p-3 bg-gray-100 rounded border min-h-[100px]">
                {textResult}
              </div>
            </div>
          )}
        </div>

        {/* Тест перевода вопросов */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Тест перевода вопросов</h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">Вопросы (по одному на строку):</label>
            <Textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Введите вопросы для перевода, по одному на строку"
              className="w-full min-h-[120px]"
            />
          </div>

          <Button 
            onClick={handleTestQuestions} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Переводим вопросы...' : 'Перевести вопросы'}
          </Button>

          {questionsResult && (
            <div>
              <label className="block text-sm font-medium mb-2">Результат:</label>
              <div className="p-3 bg-gray-100 rounded border min-h-[100px]">
                {questionsResult}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Информация о поддерживаемых языках */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium mb-2">Поддерживаемые языки:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {languages.map(lang => (
            <div key={lang.code} className="flex items-center gap-2">
              <span className="font-mono text-xs bg-gray-200 px-1 rounded">{lang.code}</span>
              <span>{lang.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TranslationTester;
