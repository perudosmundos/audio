import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Upload, Database, FileAudio, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { getLocaleString } from '@/lib/locales';
import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';
import audioDurationAnalyzer from '@/lib/audioDurationAnalyzer';

const HostingerMigrationPage = ({ currentLanguage }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [scannedFiles, setScannedFiles] = useState([]);
  const [existingEpisodes, setExistingEpisodes] = useState([]);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStatus, setMigrationStatus] = useState('');
  const [migrationResults, setMigrationResults] = useState([]);
  const [error, setError] = useState(null);
  const [customDates, setCustomDates] = useState('');
  const [isAnalyzingDuration, setIsAnalyzingDuration] = useState(false);
  const [durationAnalysisProgress, setDurationAnalysisProgress] = useState(0);
  const [allFiles, setAllFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileStats, setFileStats] = useState({ totalDates: 0, uniqueDates: [] });

  // Получаем файлы с Hostinger FTP через API

  // Загружаем существующие эпизоды из базы данных
  useEffect(() => {
    loadExistingEpisodes();
  }, []);

  const loadExistingEpisodes = async () => {
    try {
      const { data, error } = await supabase
        .from('episodes')
        .select('slug, lang, audio_url');

      if (error) throw error;

      setExistingEpisodes(data || []);
      logger.info(`[Migration] Loaded ${data?.length || 0} existing episodes`);
    } catch (error) {
      logger.error('[Migration] Error loading episodes:', error);
      setError(`Ошибка загрузки эпизодов: ${error.message}`);
    }
  };

  // Функция для загрузки всех файлов из FTP
  const loadAllFiles = async () => {
    setIsLoadingFiles(true);
    setError(null);
    setAllFiles([]);

    try {
      logger.info('[Migration] Loading all files from Hostinger FTP...');
      
      const response = await fetch('/api/hostinger-list-files');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get files list');
      }

      logger.info(`[Migration] Loaded ${data.files.length} files from FTP`);
      setAllFiles(data.files);
      
      // Анализируем статистику файлов
      const dates = new Set();
      data.files.forEach(file => {
        const dateMatch = file.fileName.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          dates.add(dateMatch[1]);
        }
      });
      
      setFileStats({
        totalDates: dates.size,
        uniqueDates: Array.from(dates).sort()
      });
      
    } catch (error) {
      logger.error('[Migration] Error loading files:', error);
      setError(`Ошибка загрузки файлов: ${error.message}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Функция для фильтрации файлов по датам
  const filterFilesByDates = (files) => {
    if (!customDates.trim()) {
      return files; // Если даты не указаны, возвращаем все файлы
    }

    const requestedDates = customDates.split(',').map(date => date.trim());
    const filteredFiles = files.filter(file => {
      const fileName = file.fileName;
      
      // Проверяем файлы с языковым префиксом: YYYY-MM-DD_LANG.mp3
      const matchWithLang = fileName.match(/^(\d{4}-\d{2}-\d{2})_(ES|RU)\.mp3$/);
      if (matchWithLang) {
        const [, date] = matchWithLang;
        return requestedDates.includes(date);
      }
      
      // Проверяем файлы без языкового префикса: YYYY-MM-DD.mp3
      const matchWithoutLang = fileName.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
      if (matchWithoutLang) {
        const [, date] = matchWithoutLang;
        return requestedDates.includes(date);
      }
      
      return false;
    });

    return filteredFiles;
  };

  // Функция для анализа длительности аудиофайлов
  const analyzeFileDurations = async (files) => {
    setIsAnalyzingDuration(true);
    setDurationAnalysisProgress(0);
    
    const filesWithDuration = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setMigrationStatus(`Анализируем длительность: ${file.fileName}...`);
      
      try {
        // Проверяем, является ли URL валидным аудиофайлом
        if (audioDurationAnalyzer.isValidAudioUrl(file.fileUrl)) {
          const duration = await audioDurationAnalyzer.getDuration(file.fileUrl);
          
          filesWithDuration.push({
            ...file,
            duration: duration,
            durationFormatted: duration ? audioDurationAnalyzer.formatDuration(duration) : 'Неизвестно'
          });
          
          logger.info(`[Migration] Duration for ${file.fileName}: ${duration ? audioDurationAnalyzer.formatDuration(duration) : 'Unknown'}`);
        } else {
          filesWithDuration.push({
            ...file,
            duration: null,
            durationFormatted: 'Не аудиофайл'
          });
        }
      } catch (error) {
        logger.warn(`[Migration] Error analyzing duration for ${file.fileName}:`, error);
        filesWithDuration.push({
          ...file,
          duration: null,
          durationFormatted: 'Ошибка анализа'
        });
      }
      
      setDurationAnalysisProgress(Math.floor(((i + 1) / files.length) * 100));
    }
    
    setIsAnalyzingDuration(false);
    setMigrationStatus('');
    return filesWithDuration;
  };

  const scanHostingerFiles = async () => {
    setIsScanning(true);
    setError(null);
    setScannedFiles([]);

    try {
      logger.info('[Migration] Starting Hostinger files scan...');
      
      // Получаем список файлов через API
      const response = await fetch('/api/hostinger-list-files');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get files list');
      }

      logger.info(`[Migration] Found ${data.files.length} files on Hostinger`);
      
      const filesToMigrate = [];
      
      for (const file of data.files) {
        const fileName = file.fileName;
        
        // Обрабатываем файлы с языковым префиксом: YYYY-MM-DD_LANG.mp3
        const matchWithLang = fileName.match(/^(\d{4}-\d{2}-\d{2})_(ES|RU)\.mp3$/);
        if (matchWithLang) {
          const [, date, lang] = matchWithLang;
          const slug = `${date}_${lang.toLowerCase()}`;
          
          // Проверяем, есть ли уже такой эпизод в базе
          const exists = existingEpisodes.some(ep => ep.slug === slug);
          
          if (!exists) {
            filesToMigrate.push({
              fileName,
              slug,
              date,
              lang: lang.toLowerCase(),
              fileUrl: file.fileUrl,
              size: file.size,
              modified: file.modified,
              status: 'pending',
              hasLangSuffix: true
            });
          }
          continue;
        }
        
        // Обрабатываем файлы без языкового префикса: YYYY-MM-DD.mp3
        const matchWithoutLang = fileName.match(/^(\d{4}-\d{2}-\d{2})\.mp3$/);
        if (matchWithoutLang) {
          const [, date] = matchWithoutLang;
          
          // Создаем записи для обоих языков
          const languages = ['es', 'ru'];
          
          for (const lang of languages) {
            const slug = `${date}_${lang}`;
            
            // Проверяем, есть ли уже такой эпизод в базе
            const exists = existingEpisodes.some(ep => ep.slug === slug);
            
            if (!exists) {
              filesToMigrate.push({
                fileName,
                slug,
                date,
                lang,
                fileUrl: file.fileUrl,
                size: file.size,
                modified: file.modified,
                status: 'pending',
                hasLangSuffix: false
              });
            }
          }
        }
      }

      logger.info(`[Migration] Found ${filesToMigrate.length} files to migrate`);
      
      // Анализируем длительность файлов
      if (filesToMigrate.length > 0) {
        const filesWithDuration = await analyzeFileDurations(filesToMigrate);
        setScannedFiles(filesWithDuration);
      } else {
        setScannedFiles(filesToMigrate);
      }
      
    } catch (error) {
      logger.error('[Migration] Error scanning files:', error);
      setError(`Ошибка сканирования файлов: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const migrateFiles = async () => {
    if (scannedFiles.length === 0) return;

    setIsMigrating(true);
    setMigrationProgress(0);
    setMigrationStatus('Начинаем миграцию...');
    setMigrationResults([]);

    try {
      for (let i = 0; i < scannedFiles.length; i++) {
        const file = scannedFiles[i];
        setMigrationStatus(`Мигрируем ${file.fileName}...`);
        
        try {
          // Создаем правильное название по языку
          const getTitle = (date, lang) => {
            if (lang === 'es') {
              return `Episodio ${date}`;
            } else if (lang === 'ru') {
              return `Эпизод ${date}`;
            }
            return `Episode ${date}`;
          };

          const getDescription = (date, lang) => {
            if (lang === 'es') {
              return `Episodio del podcast Dos Mundos del ${date}`;
            } else if (lang === 'ru') {
              return `Эпизод подкаста Dos Mundos от ${date}`;
            }
            return `Dos Mundos podcast episode from ${date}`;
          };

          // Создаем эпизод в базе данных
          const episodeData = {
            slug: file.slug,
            date: file.date,
            title: getTitle(file.date, file.lang),
            description: getDescription(file.date, file.lang),
            audio_url: file.fileUrl,
            lang: file.lang,
            duration: file.duration, // Используем длительность из анализа
            file_has_lang_suffix: file.hasLangSuffix,
            storage_provider: 'hostinger',
            file_name: file.fileName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: episode, error: episodeError } = await supabase
            .from('episodes')
            .insert(episodeData)
            .select()
            .single();

          if (episodeError) throw episodeError;

          // Создаем базовые вопросы для эпизода
          const questions = [
            {
              episode_slug: file.slug,
              lang: file.lang,
              question: file.lang === 'es' 
                ? '¿Cuál es el tema principal de este episodio?'
                : 'Какая основная тема этого эпизода?',
              answer: '',
              status: 'pending',
              created_at: new Date().toISOString(),
            },
            {
              episode_slug: file.slug,
              lang: file.lang,
              question: file.lang === 'es'
                ? '¿Qué aprendiste de este episodio?'
                : 'Что вы узнали из этого эпизода?',
              answer: '',
              status: 'pending',
              created_at: new Date().toISOString(),
            },
            {
              episode_slug: file.slug,
              lang: file.lang,
              question: file.lang === 'es'
                ? '¿Cuál es tu opinión sobre este episodio?'
                : 'Какое ваше мнение об этом эпизоде?',
              answer: '',
              status: 'pending',
              created_at: new Date().toISOString(),
            }
          ];

          const { error: questionsError } = await supabase
            .from('questions')
            .insert(questions);

          if (questionsError) throw questionsError;

          // Обновляем статус файла
          setScannedFiles(prev => 
            prev.map(f => f.fileName === file.fileName ? { ...f, status: 'completed' } : f)
          );

          setMigrationResults(prev => [...prev, {
            fileName: file.fileName,
            status: 'success',
            message: 'Эпизод и вопросы созданы успешно'
          }]);

          logger.info(`[Migration] Successfully migrated ${file.fileName}`);

        } catch (fileError) {
          logger.error(`[Migration] Error migrating ${file.fileName}:`, fileError);
          
          setScannedFiles(prev => 
            prev.map(f => f.fileName === file.fileName ? { ...f, status: 'error' } : f)
          );

          setMigrationResults(prev => [...prev, {
            fileName: file.fileName,
            status: 'error',
            message: fileError.message
          }]);
        }

        // Обновляем прогресс
        setMigrationProgress(Math.round(((i + 1) / scannedFiles.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 500)); // Небольшая задержка
      }

      setMigrationStatus('Миграция завершена!');
      logger.info('[Migration] Migration completed');

    } catch (error) {
      logger.error('[Migration] Migration error:', error);
      setError(`Ошибка миграции: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <Badge variant="default" className="bg-green-500">Завершено</Badge>;
      case 'error': return <Badge variant="destructive">Ошибка</Badge>;
      default: return <Badge variant="secondary">Ожидает</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Миграция файлов Hostinger</h1>
        <p className="text-muted-foreground">
          Сканирование папки /Audio на Hostinger FTP и добавление новых файлов в базу данных
        </p>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {/* Сканирование */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              Сканирование файлов
            </CardTitle>
            <CardDescription>
              Поиск файлов в папке /Audio на Hostinger FTP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-dates">Конкретные даты (опционально)</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-dates"
                    placeholder="2024-01-15, 2024-02-15, 2024-03-15"
                    value={customDates}
                    onChange={(e) => setCustomDates(e.target.value)}
                  />
                  <Button 
                    onClick={() => setCustomDates('')}
                    variant="outline"
                    size="sm"
                  >
                    Очистить
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Укажите конкретные даты через запятую. Если пусто, будут показаны все файлы.
                </p>
              </div>
              
              <div className="flex gap-4">
                <Button 
                  onClick={loadAllFiles} 
                  disabled={isLoadingFiles}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isLoadingFiles ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileAudio className="h-4 w-4" />
                  )}
                  {isLoadingFiles ? 'Загрузка...' : 'Показать все файлы'}
                </Button>
                
                <Button 
                  onClick={scanHostingerFiles} 
                  disabled={isScanning}
                  className="flex items-center gap-2"
                >
                  {isScanning ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileAudio className="h-4 w-4" />
                  )}
                  {isScanning ? 'Сканирование...' : 'Сканировать файлы'}
                </Button>
                
                {scannedFiles.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Найдено файлов: {scannedFiles.length}
                  </div>
                )}
                
                {/* Индикатор анализа длительности */}
                {isAnalyzingDuration && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 animate-pulse" />
                      Анализ длительности файлов...
                    </div>
                    <Progress value={durationAnalysisProgress} className="w-full" />
                    <p className="text-xs text-muted-foreground">{migrationStatus}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Все файлы из FTP */}
        {allFiles.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="h-5 w-5" />
                Файлы в папке /Audio ({filterFilesByDates(allFiles).length} из {allFiles.length})
              </CardTitle>
              <CardDescription>
                {customDates.trim() ? 'Отфильтрованные файлы по указанным датам' : 'Полный список файлов, найденных на Hostinger FTP'}
                {fileStats.totalDates > 0 && (
                  <div className="mt-2 text-sm">
                    Найдено уникальных дат: {fileStats.totalDates} • 
                    Даты: {fileStats.uniqueDates.slice(0, 5).join(', ')}
                    {fileStats.uniqueDates.length > 5 && ` и еще ${fileStats.uniqueDates.length - 5}...`}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filterFilesByDates(allFiles).map((file, index) => {
                  // Извлекаем дату из имени файла
                  const dateMatch = file.fileName.match(/^(\d{4}-\d{2}-\d{2})/);
                  const fileDate = dateMatch ? dateMatch[1] : 'Неизвестно';
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileAudio className="h-5 w-5 text-blue-500" />
                        <div>
                          <div className="font-medium">{file.fileName}</div>
                          <div className="text-sm text-muted-foreground">
                            Дата: {fileDate} • Размер: {(file.size / 1024 / 1024).toFixed(2)} MB • 
                            Изменен: {new Date(file.modified).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-blue-600">
                          {file.fileUrl.split('/').pop()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Результаты сканирования */}
        {scannedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Найденные файлы
              </CardTitle>
              <CardDescription>
                Файлы, которые будут добавлены в базу данных
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {scannedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(file.status)}
                    <div>
                      <div className="font-medium">{file.fileName}</div>
                      <div className="text-sm text-muted-foreground">
                        {file.slug} • {file.lang.toUpperCase()} • {file.hasLangSuffix ? 'С префиксом' : 'Без префикса'}
                        {file.durationFormatted && (
                          <span className="ml-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {file.durationFormatted}
                          </span>
                        )}
                      </div>
                    </div>
                    </div>
                    {getStatusBadge(file.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Миграция */}
        {scannedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Миграция в базу данных
              </CardTitle>
              <CardDescription>
                Добавление эпизодов и вопросов в Supabase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={migrateFiles} 
                  disabled={isMigrating}
                  className="flex items-center gap-2"
                >
                  {isMigrating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isMigrating ? 'Миграция...' : 'Начать миграцию'}
                </Button>

                {isMigrating && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{migrationStatus}</span>
                      <span>{migrationProgress}%</span>
                    </div>
                    <Progress value={migrationProgress} className="w-full" />
                  </div>
                )}

                {migrationResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Результаты миграции:</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {migrationResults.map((result, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          {result.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">{result.fileName}:</span>
                          <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                            {result.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HostingerMigrationPage;
