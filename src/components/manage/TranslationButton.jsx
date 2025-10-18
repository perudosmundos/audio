import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Languages, AlertTriangle } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

/**
 * Кнопка перевода между языками
 * Учитывает зависимости: английский переводится только с испанского
 */
const TranslationButton = ({
  episode,
  episodes, // Все эпизоды для поиска источника перевода
  onTranslateFromSpanish,
  onTranslateFromRussian,
  transferringText,
  transferringQuestions,
  currentLanguage
}) => {
  const getTranslationOptions = () => {
    if (episode.lang !== 'en') return []; // Только английский переводится

    const options = [];

    // Поиск испанской версии с готовой транскрипцией
    const spanishEpisode = episodes.find(ep =>
      ep.slug === episode.slug && ep.lang === 'es' && ep.transcript?.status === 'completed'
    );

    if (spanishEpisode) {
      // Можно переводить транскрипт с испанского
      if (!episode.transcript || episode.transcript.status !== 'completed') {
        options.push({
          type: 'transcript',
          text: getLocaleString('translateTranscriptFromSpanish', currentLanguage),
          available: true,
          loading: transferringText,
          icon: <Languages className="h-3 w-3 mr-1" />,
          action: 'translateTranscript'
        });
      }

      // Поиск испанской версии с вопросами для перевода
      const spanishWithQuestions = episodes.find(ep =>
        ep.slug === episode.slug && ep.lang === 'es' && ep.questionsCount > 0
      );

      if (spanishWithQuestions) {
        options.push({
          type: 'questions',
          text: getLocaleString('translateQuestionsFromSpanish', currentLanguage),
          available: true,
          loading: transferringQuestions,
          icon: <Languages className="h-3 w-3 mr-1" />,
          action: 'translateQuestions'
        });
      }
    }

    // Поиск русской версии с вопросами (альтернативный источник)
    const russianWithQuestions = episodes.find(ep =>
      ep.slug === episode.slug && ep.lang === 'ru' && ep.questionsCount > 0
    );

    if (russianWithQuestions) {
      options.push({
        type: 'questions_ru',
        text: getLocaleString('translateQuestionsFromRussian', currentLanguage),
        available: true,
        loading: transferringQuestions,
        icon: <Languages className="h-3 w-3 mr-1" />,
        action: 'translateQuestionsFromRU'
      });
    }

    return options;
  };

  const translationOptions = getTranslationOptions();

  if (translationOptions.length === 0) {
    // Нет доступных источников для перевода
    const spanishEpisode = episodes.find(ep =>
      ep.slug === episode.slug && ep.lang === 'es'
    );

    if (!spanishEpisode) {
      return (
        <div className="text-xs text-slate-400 text-center">
          {getLocaleString('spanishVersionRequired', currentLanguage)}
        </div>
      );
    }

    if (spanishEpisode && !spanishEpisode.transcript?.status === 'completed') {
      return (
        <div className="text-xs text-slate-400 text-center">
          {getLocaleString('spanishTranscriptRequired', currentLanguage)}
        </div>
      );
    }

    return (
      <div className="text-xs text-slate-400 text-center">
        {getLocaleString('transcriptRequired', currentLanguage)}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {translationOptions.map((option, index) => (
        <Button
          key={index}
          size="sm"
          variant="outline"
          onClick={() => {
            if (option.action === 'translateTranscript') {
              onTranslateFromSpanish(episode);
            } else if (option.action === 'translateQuestions') {
              onTranslateFromSpanish(episode, true); // true = перевод вопросов
            } else if (option.action === 'translateQuestionsFromRU') {
              onTranslateFromRussian(episode);
            }
          }}
          disabled={option.loading || !option.available}
          className="h-8 px-2 text-xs bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200"
          title={option.text}
        >
          {option.loading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            option.icon
          )}
          {option.text}
        </Button>
      ))}
    </div>
  );
};

export default TranslationButton;
