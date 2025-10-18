import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, PenLine, Trash2, AlertTriangle, FileText, Bot } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';

/**
 * Интерактивная кнопка управления транскрипцией
 * Заменяет автоматический процесс на ручное управление
 */
const TranscriptionButton = ({
  episode,
  onStartTranscription,
  onDeleteTranscript,
  onDownloadSRT,
  onProcessWithAI,
  isTranscribing,
  currentLanguage,
  disabled = false
}) => {
  const getButtonState = () => {
    // Если транскрипция в процессе
    if (isTranscribing) {
      return {
        text: getLocaleString('starting', currentLanguage),
        variant: 'default',
        disabled: true,
        icon: <Loader2 className="h-3 w-3 animate-spin mr-1" />
      };
    }

    // Если транскрипция завершена
    if (episode.transcript?.status === 'completed') {
      return {
        text: getLocaleString('deleteAndRetranscribe', currentLanguage),
        variant: 'destructive',
        disabled: disabled || !episode.audio_url,
        icon: <Trash2 className="h-3 w-3 mr-1" />,
        action: 'delete_and_retranscribe'
      };
    }

    // Если транскрипция в процессе (статус processing)
    if (episode.transcript?.status === 'processing') {
      return {
        text: getLocaleString('transcriptionInProgress', currentLanguage),
        variant: 'default',
        disabled: true,
        icon: <Loader2 className="h-3 w-3 animate-spin mr-1" />
      };
    }

    // Если транскрипция с ошибкой
    if (episode.transcript?.status === 'error') {
      return {
        text: getLocaleString('transcriptionFailedShort', currentLanguage),
        variant: 'destructive',
        disabled: disabled || !episode.audio_url,
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
        action: 'retry'
      };
    }

    // Нет транскрипции - показать кнопку начала
    return {
      text: `${getLocaleString('transcribe', currentLanguage)} ${episode.lang.toUpperCase()}`,
      variant: 'default',
      disabled: disabled || !episode.audio_url,
      icon: <PenLine className="h-3 w-3 mr-1" />,
      action: 'start'
    };
  };

  const buttonState = getButtonState();

  const handleClick = () => {
    if (buttonState.action === 'delete_and_retranscribe') {
      onDeleteTranscript(episode);
    } else if (buttonState.action === 'retry' || buttonState.action === 'start') {
      onStartTranscription(episode);
    }
  };

  // Если транскрипция завершена, показываем дополнительные кнопки
  if (episode.transcript?.status === 'completed') {
    return (
      <div className="flex gap-1">
        {/* Основная кнопка управления транскрипцией */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleClick}
          disabled={buttonState.disabled}
          className="h-8 px-2 text-xs bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/40 hover:text-red-200 flex-1"
          title={getLocaleString('deleteAndRetranscribe', currentLanguage)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {getLocaleString('deleteAndRetranscribe', currentLanguage)}
        </Button>

        {/* Кнопка скачивания SRT */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDownloadSRT && onDownloadSRT(episode)}
          className="h-8 px-2 text-xs bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/40 hover:text-green-200 flex-1"
          title={getLocaleString('downloadSubtitles', currentLanguage)}
        >
          <FileText className="h-3 w-3 mr-1" />
          Srt
        </Button>

        {/* Кнопка обработки через AI */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onProcessWithAI && onProcessWithAI(episode)}
          className="h-8 px-2 text-xs bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/40 hover:text-blue-200 flex-1"
          title={getLocaleString('processWithAI', currentLanguage)}
        >
          <Bot className="h-3 w-3 mr-1" />
          AI
        </Button>
      </div>
    );
  }

  // Стандартная кнопка для всех остальных состояний
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={buttonState.disabled}
      className={`h-8 px-2 text-xs ${
        buttonState.variant === 'destructive'
          ? 'bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/40 hover:text-red-200'
          : 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200'
      }`}
      title={
        buttonState.action === 'delete_and_retranscribe'
          ? getLocaleString('deleteAndRetranscribe', currentLanguage)
          : buttonState.text
      }
    >
      {buttonState.icon}
      {buttonState.text}
    </Button>
  );
};

export default TranscriptionButton;
