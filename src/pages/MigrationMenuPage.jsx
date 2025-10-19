import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Database, Upload, FileAudio } from 'lucide-react';

const MigrationMenuPage = ({ currentLanguage }) => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </div>
        <h1 className="text-3xl font-bold mb-2">Миграция данных</h1>
        <p className="text-muted-foreground">
          Выберите тип миграции для работы с файлами и базой данных
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Миграция хранилища */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/migration')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Миграция хранилища
            </CardTitle>
            <CardDescription>
              Перенос файлов с R2 на Hostinger SFTP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Перемещает существующие файлы из R2 в Hostinger и обновляет ссылки в базе данных.
            </p>
          </CardContent>
        </Card>

        {/* Миграция Hostinger */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/hostinger-migration')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              Миграция Hostinger
            </CardTitle>
            <CardDescription>
              Добавление файлов с Hostinger FTP в базу данных
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Сканирует папку /Audio на Hostinger FTP и добавляет новые файлы в Supabase с вопросами.
            </p>
          </CardContent>
        </Card>

        {/* Загрузка файлов */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/upload')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Загрузка файлов
            </CardTitle>
            <CardDescription>
              Загрузка новых аудиофайлов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Загружает новые аудиофайлы в хранилище и создает эпизоды с транскрипцией.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MigrationMenuPage;
