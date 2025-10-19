import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getLocaleString } from '@/lib/locales';
import { Loader2, Bot, Languages, ExternalLink, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageCard from '@/components/manage/LanguageCard';

const UploadManageView = ({
  filesToProcess = [],
  episodes = [],
  currentLanguage,
  onStartTranscription,
  onDeleteTranscript,
  onDeleteEpisode,
  onDownloadSRT,
  onProcessWithAI,
  onLoadFromDB,
  onGenerateFromText,
  translateEpisode,
  batchTranslateFromLanguage,
  translatingFrom,
  translationProgress,
  isTranscribing,
  loadingFromDB,
  generatingFromText,
  onRemoveItem,
  availableLanguages = ['es', 'ru', 'en', 'de', 'fr', 'pl']
}) => {
  // Отладочная информация для отслеживания изменений translatingFrom
  React.useEffect(() => {
    console.log('[UploadManageView] translatingFrom changed:', translatingFrom);
  }, [translatingFrom]);
  const navigate = useNavigate();
  const [selectedEpisodes, setSelectedEpisodes] = useState({});
  const [clickedButtons, setClickedButtons] = useState(new Set());

  const handleSelectEpisode = (slug, lang) => {
    const key = `${slug}-${lang}`;
    setSelectedEpisodes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDeleteClick = (episode) => {
    if (onDeleteEpisode) {
      onDeleteEpisode(episode);
    } else {
      console.log('Delete episode:', episode);
    }
  };

  // Функция для безопасного вызова перевода с защитой от множественных кликов
  const handleTranslateClick = async (sourceEpisode, targetLang, sourceLang) => {
    const buttonKey = `${sourceEpisode.slug}-${sourceLang}-${targetLang}`;
    
    if (clickedButtons.has(buttonKey)) {
      console.log('[UploadManageView] Button already clicked, ignoring');
      return;
    }

    setClickedButtons(prev => new Set([...prev, buttonKey]));
    
    try {
      await translateEpisode(sourceEpisode, targetLang, sourceLang);
    } finally {
      // Убираем кнопку из списка нажатых через 2 секунды
      setTimeout(() => {
        setClickedButtons(prev => {
          const newSet = new Set(prev);
          newSet.delete(buttonKey);
          return newSet;
        });
      }, 2000);
    }
  };

  // Combine files in queue and existing episodes, then group by base slug
  const allItems = [...filesToProcess, ...episodes];
  
  const groupedFiles = allItems.reduce((acc, item) => {
    const baseSlug = (item.episodeSlug || item.slug || '').replace(/_(es|ru|en|de|fr|pl)$/, '');
    if (!acc[baseSlug]) {
      acc[baseSlug] = {
        baseSlug: baseSlug,
        episodeTitle: item.episodeTitle || item.title || baseSlug,
        languages: {}
      };
    }
    const normalizedItem = {
      ...item,
      slug: item.slug || item.episodeSlug,
      episodeSlug: item.episodeSlug || item.slug,
      lang: item.lang,
      isUploaded: !!item.id,
    };
    acc[baseSlug].languages[item.lang] = normalizedItem;
    return acc;
  }, {});

  const langColors = {
    es: 'bg-green-600/20 border-green-500 text-green-300',
    ru: 'bg-blue-600/20 border-blue-500 text-blue-300',
    en: 'bg-purple-600/20 border-purple-500 text-purple-300',
    de: 'bg-orange-600/20 border-orange-500 text-orange-300',
    fr: 'bg-pink-600/20 border-pink-500 text-pink-300',
    pl: 'bg-teal-600/20 border-teal-500 text-teal-300'
  };

  const langNames = {
    es: 'ES',
    ru: 'RU',
    en: 'EN',
    de: 'DE',
    fr: 'FR',
    pl: 'PL'
  };

  // Массовый перевод всех эпизодов
  const handleBatchTranslateAll = (sourceLang) => {
    const targetLangs = availableLanguages.filter(lang => !['es', 'ru'].includes(lang));
    batchTranslateFromLanguage(episodes, sourceLang, targetLangs);
  };

  // Массовый перевод одного эпизода на все языки
  const handleBatchTranslateOne = async (group, sourceLang) => {
    const sourceEpisode = group.languages[sourceLang];
    if (!sourceEpisode || !sourceEpisode.transcript || sourceEpisode.transcript.status !== 'completed') {
      return;
    }

    const targetLangs = availableLanguages.filter(lang => !['es', 'ru'].includes(lang));
    
    for (const targetLang of targetLangs) {
      await translateEpisode(sourceEpisode, targetLang, sourceLang);
    }
  };

  return (
    <div className="space-y-6">
      {/* Кнопки массового перевода всех эпизодов */}
      <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-slate-300">Массовый перевод всех эпизодов:</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleBatchTranslateAll('es')}
            disabled={!!translatingFrom}
            className="h-8 text-xs bg-green-600/20 border border-green-500 text-green-300 hover:bg-green-600/40"
          >
            {translatingFrom?.includes('-es-') ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Bot className="h-3 w-3 mr-1" />
            )}
            С испанского
          </Button>
          <Button
            size="sm"
            onClick={() => handleBatchTranslateAll('ru')}
            disabled={!!translatingFrom}
            className="h-8 text-xs bg-blue-600/20 border border-blue-500 text-blue-300 hover:bg-blue-600/40"
          >
            {translatingFrom?.includes('-ru-') ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Bot className="h-3 w-3 mr-1" />
            )}
            С русского
          </Button>
        </div>
      </div>

      {/* Список эпизодов */}
      {Object.values(groupedFiles).map((group) => {
        const spanishEpisode = group.languages['es'];
        const russianEpisode = group.languages['ru'];
        const hasSpanishTranscript = spanishEpisode?.transcript?.status === 'completed';
        const hasRussianTranscript = russianEpisode?.transcript?.status === 'completed';

        return (
          <div key={group.baseSlug} className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
            {/* Заголовок эпизода */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">{group.episodeTitle}</h3>
              
              {/* Кнопки массового перевода для этого эпизода */}
              <div className="flex gap-2">
                {hasSpanishTranscript && (
                  <Button
                    size="sm"
                    onClick={() => handleBatchTranslateOne(group, 'es')}
                    disabled={!!translatingFrom}
                    className="h-7 px-2 text-xs bg-green-600/20 border border-green-500 text-green-300 hover:bg-green-600/40"
                    title="Перевести этот эпизод с испанского на все языки"
                  >
                    <Languages className="h-3 w-3 mr-1" />
                    ES → Все
                  </Button>
                )}
                {hasRussianTranscript && (
                  <Button
                    size="sm"
                    onClick={() => handleBatchTranslateOne(group, 'ru')}
                    disabled={!!translatingFrom}
                    className="h-7 px-2 text-xs bg-blue-600/20 border border-blue-500 text-blue-300 hover:bg-blue-600/40"
                    title="Перевести этот эпизод с русского на все языки"
                  >
                    <Languages className="h-3 w-3 mr-1" />
                    RU → Все
                  </Button>
                )}
              </div>
            </div>

            {/* Основные языки (ES, RU) - полные карточки */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {['es', 'ru'].map(lang => {
                const episode = group.languages[lang];
                
                if (!episode) {
                  return (
                    <div key={`${group.baseSlug}-${lang}`} className="p-3 bg-slate-700/30 border border-slate-600 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          lang === 'es' ? 'bg-green-600 text-green-100' : 'bg-blue-600 text-blue-100'
                        }`}>
                          {lang.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">
                          {getLocaleString('noFileUploaded', currentLanguage)}
                        </span>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <LanguageCard
                    key={`${group.baseSlug}-${lang}`}
                    episode={episode}
                    language={lang}
                    baseSlug={group.baseSlug}
                    currentLanguage={currentLanguage}
                    selectedEpisodes={selectedEpisodes}
                    handleSelectEpisode={handleSelectEpisode}
                    handleDeleteClick={handleDeleteClick}
                    onStartTranscription={onStartTranscription}
                    onDeleteTranscript={onDeleteTranscript}
                    onDownloadSRT={onDownloadSRT}
                    onProcessWithAI={onProcessWithAI}
                    isTranscribing={isTranscribing}
                    onLoadFromDB={onLoadFromDB}
                    onGenerateFromText={onGenerateFromText}
                    onTranslateFromLanguage={translateEpisode}
                    loadingFromDB={loadingFromDB}
                    generatingFromText={generatingFromText}
                    translatingFrom={translatingFrom}
                    episodes={allItems}
                    navigate={navigate}
                    onRemoveItem={onRemoveItem}
                  />
                );
              })}
            </div>

            {/* Переведенные языки (EN, DE, FR, PL) - компактный вид */}
            <div className="space-y-2 pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {getLocaleString('translateToEnglish', currentLanguage) || 'Переводы'}:
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {availableLanguages.filter(lang => !['es', 'ru'].includes(lang)).map(targetLang => {
                  const episode = group.languages[targetLang];
                  // Проверяем перевод с ES или RU на targetLang
                  const isTranslatingFromES = translatingFrom?.includes(`-es-${targetLang}`);
                  const isTranslatingFromRU = translatingFrom?.includes(`-ru-${targetLang}`);
                  const isTranslating = isTranslatingFromES || isTranslatingFromRU;
                  
                  // Отладочная информация
                  if (isTranslating) {
                    console.log('[UploadManageView] Translation in progress:', {
                      targetLang,
                      translatingFrom,
                      isTranslatingFromES,
                      isTranslatingFromRU
                    });
                  }

                  if (!episode) {
                    // Нет перевода - показываем кнопки создания
                    return (
                      <div key={`${group.baseSlug}-${targetLang}`} className="p-2 bg-slate-700/20 rounded border border-slate-600">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-400">{langNames[targetLang]}</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-1">Создать:</div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTranslateClick(spanishEpisode, targetLang, 'es')}
                            disabled={!hasSpanishTranscript || isTranslating}
                            className={`h-6 px-1 text-xs flex-1 ${
                              isTranslatingFromES 
                                ? 'bg-green-600/40 border-green-400 animate-pulse' 
                                : 'bg-green-600/10 hover:bg-green-600/20'
                            } disabled:opacity-30`}
                            title="Перевести с испанского"
                          >
                            {isTranslatingFromES ? <Loader2 className="h-3 w-3 animate-spin" /> : 'ES'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTranslateClick(russianEpisode, targetLang, 'ru')}
                            disabled={!hasRussianTranscript || isTranslating}
                            className={`h-6 px-1 text-xs flex-1 ${
                              isTranslatingFromRU 
                                ? 'bg-blue-600/40 border-blue-400 animate-pulse' 
                                : 'bg-blue-600/10 hover:bg-blue-600/20'
                            } disabled:opacity-30`}
                            title="Перевести с русского"
                          >
                            {isTranslatingFromRU ? <Loader2 className="h-3 w-3 animate-spin" /> : 'RU'}
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  // Есть перевод - показываем информацию и кнопки управления
                  return (
                    <div key={`${group.baseSlug}-${targetLang}`} className={`p-2 rounded border ${langColors[targetLang]}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{langNames[targetLang]}</span>
                        {episode.slug && (
                          <button
                            onClick={() => window.open(`/episode/${episode.slug}?lang=${episode.lang}`, '_blank')}
                            className="text-xs opacity-70 hover:opacity-100"
                            title={getLocaleString('openInNewWindow', currentLanguage)}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      
                      {/* Статус транскрипта */}
                      {episode.transcript && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs opacity-70">
                            {episode.transcript.status === 'completed' ? '✓ Текст' : '—'}
                          </span>
                          <span className="text-xs opacity-70">
                            {episode.questionsCount > 0 ? `${episode.questionsCount} вопр.` : '—'}
                          </span>
                        </div>
                      )}

                      {/* Кнопки действий */}
                      <div className="flex gap-1 mt-2">
                        {episode.transcript?.status === 'completed' && onDownloadSRT && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDownloadSRT(episode)}
                            className="h-6 px-2 text-xs flex-1 bg-green-600/10 hover:bg-green-600/20"
                            title={getLocaleString('downloadSubtitles', currentLanguage)}
                          >
                            Srt
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClick(episode)}
                          className="h-6 px-1 text-xs bg-red-600/10 hover:bg-red-600/20"
                          title={getLocaleString('delete', currentLanguage)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Кнопки перезаписи перевода */}
                      <div className="mt-1 pt-1 border-t border-slate-600/50">
                        <div className="text-xs text-slate-500 mb-1">Перезаписать:</div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => translateEpisode(spanishEpisode, targetLang, 'es')}
                            disabled={!hasSpanishTranscript || isTranslating}
                            className={`h-5 px-1 text-xs flex-1 ${
                              isTranslatingFromES 
                                ? 'bg-green-600/40 border-green-400 animate-pulse' 
                                : 'bg-green-600/10 hover:bg-green-600/20'
                            } disabled:opacity-30`}
                            title="Перевести заново с испанского"
                          >
                            {isTranslatingFromES ? <Loader2 className="h-2 w-2 animate-spin" /> : 'ES'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => translateEpisode(russianEpisode, targetLang, 'ru')}
                            disabled={!hasRussianTranscript || isTranslating}
                            className={`h-5 px-1 text-xs flex-1 ${
                              isTranslatingFromRU 
                                ? 'bg-blue-600/40 border-blue-400 animate-pulse' 
                                : 'bg-blue-600/10 hover:bg-blue-600/20'
                            } disabled:opacity-30`}
                            title="Перевести заново с русского"
                          >
                            {isTranslatingFromRU ? <Loader2 className="h-2 w-2 animate-spin" /> : 'RU'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UploadManageView;
