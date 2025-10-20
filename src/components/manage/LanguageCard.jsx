import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileAudio2, Trash2 } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import TranscriptionButton from './TranscriptionButton';
import SmartQuestionButton from './SmartQuestionButton';
import TranslationButton from './TranslationButton';

/**
 * Карточка языковой версии эпизода
 * Сохраняет существующую структуру ссылок и блоков
 */
const LanguageCard = ({
  episode,
  language,
  baseSlug,
  currentLanguage,
  selectedEpisodes,
  handleSelectEpisode,
  handleDeleteClick,
  // Функции управления транскрипцией
  onStartTranscription,
  onDeleteTranscript,
  isTranscribing,
  // Функции управления вопросами
  onLoadFromDB,
  onGenerateFromText,
  onTranslateFromLanguage,
  loadingFromDB,
  generatingFromText,
  translatingFrom,
  // Функции перевода
  onTranslateFromSpanish,
  onTranslateFromRussian,
  transferringText,
  transferringQuestions,
  // Данные для переводов
  episodes,
  navigate
}) => {
  const langColors = {
    es: 'bg-green-600 text-green-100',
    ru: 'bg-blue-600 text-blue-100',
    en: 'bg-purple-600 text-purple-100',
    de: 'bg-orange-600 text-orange-100',
    fr: 'bg-pink-600 text-pink-100',
    pl: 'bg-teal-600 text-teal-100'
  };

  const hasEpisode = episode !== null;

  if (!hasEpisode) {
    return (
      <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600 border-dashed">
        <div className="text-center">
          <FileAudio2 className="mx-auto h-6 w-6 text-slate-500 opacity-70 mb-2" />
          <p className="text-slate-500 text-sm">
            {getLocaleString('noFileUploaded', currentLanguage)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-slate-600/40 border border-slate-500 rounded-lg">
      <div className="space-y-2">
        {/* Заголовок с языком и ссылками (сохраняем структуру) */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${langColors[language]}`}>
              {language.toUpperCase()}
            </span>
            <div className="flex items-center gap-1">
              <div
                className="text-xs text-purple-300 truncate cursor-pointer hover:text-purple-200 hover:underline max-w-[100px]"
                title={`Open episode: ${episode.slug}`}
                onClick={() => navigate(`/episode/${episode.slug}?lang=${episode.lang}`)}
              >
                {episode.slug}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/episode/${episode.slug}?lang=${episode.lang}`, '_blank');
                }}
                className="h-5 w-5 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                title={getLocaleString('openInNewWindow', currentLanguage)}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Checkbox
              id={`select-${episode.slug}-${episode.lang}`}
              checked={!!selectedEpisodes[`${episode.slug}-${episode.lang}`]}
              onCheckedChange={() => handleSelectEpisode(episode.slug, episode.lang)}
              className="border-slate-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteClick(episode)}
              className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              title={getLocaleString('delete', currentLanguage)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Статус-индикаторы (сохраняем) */}
        <div className="flex flex-wrap gap-1">
          {episode.transcript && episode.transcript.status !== 'completed' && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              episode.transcript.status === 'processing' ? 'bg-yellow-600 text-yellow-100' :
              episode.transcript.status === 'error' ? 'bg-red-600 text-red-100' :
              'bg-gray-600 text-gray-100'
            }`}>
              {episode.transcript.status === 'processing' ? getLocaleString('processing', currentLanguage) :
               episode.transcript.status === 'error' ? getLocaleString('error', currentLanguage) :
               getLocaleString('notStarted', currentLanguage)}
            </span>
          )}

          {episode.duration && episode.duration > 0 && (
            <span className="text-xs text-slate-400">
              {formatDuration(episode.duration)}
            </span>
          )}
        </div>

        {/* Интерактивные элементы управления */}
        <div className="pt-2 space-y-2">
          {/* Транскрипция */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Транскрипция:</span>
            <TranscriptionButton
              episode={episode}
              onStartTranscription={onStartTranscription}
              onDeleteTranscript={onDeleteTranscript}
              isTranscribing={isTranscribing}
              currentLanguage={currentLanguage}
            />
          </div>

          {/* Вопросы */}
          {episode.transcript?.status === 'completed' && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                Вопросы:
              </span>
              <SmartQuestionButton
                episode={episode}
                episodes={episodes}
                onLoadFromDB={onLoadFromDB}
                onGenerateFromText={onGenerateFromText}
                onTranslateFromLanguage={onTranslateFromLanguage}
                loadingFromDB={loadingFromDB}
                generatingFromText={generatingFromText}
                translatingFrom={translatingFrom}
                currentLanguage={currentLanguage}
              />
            </div>
          )}

          {/* Перевод (только для английского) */}
          {episode.lang === 'en' && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Перевод:</span>
              <TranslationButton
                episode={episode}
                episodes={episodes}
                onTranslateFromSpanish={onTranslateFromSpanish}
                onTranslateFromRussian={onTranslateFromRussian}
                transferringText={transferringText}
                transferringQuestions={transferringQuestions}
                currentLanguage={currentLanguage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to format duration (сохраняем из оригинала)
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
};

export default LanguageCard;
