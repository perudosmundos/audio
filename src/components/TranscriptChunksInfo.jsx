import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, FileText, Clock, Trash2, Download, Info } from 'lucide-react';
import { useTranscriptChunks } from '@/hooks/transcript/useTranscriptChunks';
import { useToast } from '@/components/ui/use-toast';

/**
 * Компонент для отображения информации о чанкованных транскрипциях
 */
export const TranscriptChunksInfo = ({ episodeSlug, lang, currentLanguage }) => {
  const { toast } = useToast();
  const {
    isLoading,
    error,
    chunksInfo,
    chunkedTranscript,
    fetchChunksInfo,
    reconstructTranscript,
    clearChunks,
    hasChunks,
    getChunksSizeInfo
  } = useTranscriptChunks(episodeSlug, lang);

  const handleReconstruct = async () => {
    try {
      await reconstructTranscript();
      toast({
        title: 'Транскрипция восстановлена',
        description: 'Полная транскрипция успешно восстановлена из чанков',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Ошибка восстановления',
        description: `Не удалось восстановить транскрипцию: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const handleClearChunks = async () => {
    try {
      await clearChunks();
      toast({
        title: 'Чанки очищены',
        description: 'Все чанки транскрипции успешно удалены',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Ошибка очистки',
        description: `Не удалось очистить чанки: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-700/60 border-slate-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400 mr-2" />
            <span className="text-slate-300">Загрузка информации о чанках...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-700/60 border-slate-600">
        <CardContent className="p-4">
          <div className="flex items-center text-red-400 mb-2">
            <Info className="h-5 w-5 mr-2" />
            <span className="font-medium">Ошибка загрузки</span>
          </div>
          <p className="text-slate-300 text-sm mb-3">{error}</p>
          <Button 
            onClick={fetchChunksInfo} 
            variant="outline" 
            size="sm"
            className="border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300"
          >
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hasChunks) {
    return (
      <Card className="bg-slate-700/60 border-slate-600">
        <CardContent className="p-4">
          <div className="flex items-center text-slate-400 mb-2">
            <Database className="h-5 w-5 mr-2" />
            <span className="font-medium">Чанки не найдены</span>
          </div>
          <p className="text-slate-400 text-sm">
            Эта транскрипция не была разбита на чанки или была сохранена целиком.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sizeInfo = getChunksSizeInfo;

  return (
    <Card className="bg-slate-700/60 border-slate-600">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-purple-200 flex items-center">
          <Database className="h-5 w-5 mr-2" />
          Чанки транскрипции
        </CardTitle>
        <CardDescription className="text-slate-400">
          Информация о порционном хранении транскрипции
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Основная информация */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-600/30 rounded-lg p-3">
            <div className="flex items-center text-slate-300 mb-1">
              <FileText className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Всего чанков</span>
            </div>
            <div className="text-2xl font-bold text-purple-300">{sizeInfo.totalChunks}</div>
          </div>
          
          <div className="bg-slate-600/30 rounded-lg p-3">
            <div className="flex items-center text-slate-300 mb-1">
              <Clock className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Размер чанка</span>
            </div>
            <div className="text-2xl font-bold text-blue-300">{sizeInfo.chunkSizeKB} KB</div>
          </div>
        </div>

        {/* Детальная информация */}
        <div className="bg-slate-600/20 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Текстовые чанки:</span>
              <Badge variant="secondary" className="ml-2 bg-yellow-600/70 text-yellow-100">
                {sizeInfo.textChunks}
              </Badge>
            </div>
            <div>
              <span className="text-slate-400">Чанки реплик:</span>
              <Badge variant="secondary" className="ml-2 bg-green-600/70 text-green-100">
                {sizeInfo.utteranceChunks}
              </Badge>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400">Общий размер:</span>
              <Badge variant="secondary" className="ml-2 bg-purple-600/70 text-purple-100">
                {sizeInfo.estimatedTotalSizeMB} MB
              </Badge>
            </div>
          </div>
        </div>

        {/* Метаданные */}
        {chunksInfo?.chunkedAt && (
          <div className="text-xs text-slate-500">
            Чанкование выполнено: {new Date(chunksInfo.chunkedAt).toLocaleString()}
          </div>
        )}

        {/* Действия */}
        <div className="flex gap-2 pt-2">
          {!chunkedTranscript ? (
            <Button
              onClick={handleReconstruct}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Восстановить
            </Button>
          ) : (
            <Badge variant="secondary" className="bg-green-600/70 text-green-100">
              Восстановлено ({chunkedTranscript.chunkCount} чанков)
            </Badge>
          )}
          
          <Button
            onClick={handleClearChunks}
            variant="outline"
            size="sm"
            className="border-red-500 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Очистить
          </Button>
        </div>

        {/* Восстановленная транскрипция */}
        {chunkedTranscript && (
          <div className="bg-slate-600/20 rounded-lg p-3 mt-3">
            <div className="text-sm text-slate-300 mb-2">
              <strong>Восстановленная транскрипция:</strong>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <div>Текст: {chunkedTranscript.text?.length || 0} символов</div>
              <div>Реплики: {chunkedTranscript.utterances?.length || 0}</div>
              <div>Чанки: {chunkedTranscript.chunkCount}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Компонент для отображения сводки по всем чанкованным транскрипциям
 */
export const AllTranscriptChunksSummary = ({ currentLanguage }) => {
  const { toast } = useToast();
  const {
    isLoading,
    error,
    chunkedTranscripts,
    fetchAllChunkedTranscripts,
    getStatistics
  } = useAllTranscriptChunks();

  React.useEffect(() => {
    fetchAllChunkedTranscripts();
  }, [fetchAllChunkedTranscripts]);

  if (isLoading) {
    return (
      <Card className="bg-slate-700/60 border-slate-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400 mr-2" />
            <span className="text-slate-300">Загрузка сводки...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-700/60 border-slate-600">
        <CardContent className="p-4">
          <div className="text-red-400 mb-2">Ошибка: {error}</div>
          <Button 
            onClick={fetchAllChunkedTranscripts} 
            variant="outline" 
            size="sm"
          >
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stats = getStatistics;

  if (!stats || chunkedTranscripts.length === 0) {
    return (
      <Card className="bg-slate-700/60 border-slate-600">
        <CardContent className="p-4">
          <div className="text-slate-400 text-center py-4">
            Чанкованные транскрипции не найдены
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-700/60 border-slate-600">
      <CardHeader>
        <CardTitle className="text-lg text-purple-200">
          Сводка по чанкованным транскрипциям
        </CardTitle>
        <CardDescription className="text-slate-400">
          Общая статистика по всем транскрипциям, сохраненным порционно
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-600/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-300">{stats.totalTranscripts}</div>
            <div className="text-sm text-slate-400">Транскрипций</div>
          </div>
          <div className="bg-slate-600/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-300">{stats.totalChunks}</div>
            <div className="text-sm text-slate-400">Всего чанков</div>
          </div>
        </div>
        
        <div className="bg-slate-600/20 rounded-lg p-3">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Общий размер:</span>
              <span className="text-slate-200 font-medium">{stats.totalSizeMB} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Среднее чанков на транскрипцию:</span>
              <span className="text-slate-200 font-medium">{stats.averageChunksPerTranscript}</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button
            onClick={fetchAllChunkedTranscripts}
            variant="outline"
            size="sm"
            className="w-full border-slate-500 bg-slate-600/50 hover:bg-slate-600 text-slate-300"
          >
            Обновить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
