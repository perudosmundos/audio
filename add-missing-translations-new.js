#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Загружаем русский файл как основу
const ruContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'));

// Новые ключи локализации, которые нужно добавить
const newTranslations = {
  // CleanManagePage
  'uploadAudioAndManageVersions': {
    ru: 'Загрузка аудио и управление языковыми версиями',
    en: 'Upload audio and manage language versions',
    es: 'Subir audio y gestionar versiones de idiomas',
    de: 'Audio hochladen und Sprachversionen verwalten',
    fr: 'Télécharger l\'audio et gérer les versions linguistiques',
    pl: 'Prześlij audio i zarządzaj wersjami językowymi'
  },
  'supportedAudioFormatsDescription': {
    ru: 'Поддерживаются аудио файлы: MP3, WAV, M4A, AAC, OGG, FLAC',
    en: 'Supported audio files: MP3, WAV, M4A, AAC, OGG, FLAC',
    es: 'Archivos de audio admitidos: MP3, WAV, M4A, AAC, OGG, FLAC',
    de: 'Unterstützte Audio-Dateien: MP3, WAV, M4A, AAC, OGG, FLAC',
    fr: 'Fichiers audio pris en charge : MP3, WAV, M4A, AAC, OGG, FLAC',
    pl: 'Obsługiwane pliki audio: MP3, WAV, M4A, AAC, OGG, FLAC'
  },
  'waitForCompletion': {
    ru: 'Дождитесь завершения текущего процесса',
    en: 'Please wait for the current process to complete',
    es: 'Espere a que se complete el proceso actual',
    de: 'Bitte warten Sie, bis der aktuelle Prozess abgeschlossen ist',
    fr: 'Veuillez attendre la fin du processus en cours',
    pl: 'Poczekaj na zakończenie bieżącego procesu'
  },
  'errorLoadingEpisodes': {
    ru: 'Ошибка загрузки эпизодов',
    en: 'Error loading episodes',
    es: 'Error al cargar episodios',
    de: 'Fehler beim Laden der Episoden',
    fr: 'Erreur lors du chargement des épisodes',
    pl: 'Błąd ładowania odcinków'
  }
};

console.log('🔧 Добавление недостающих переводов...\n');

// Добавляем новые переводы во все файлы локализации
const languages = ['en', 'es', 'de', 'fr', 'pl'];
languages.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const currentContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let addedCount = 0;

  // Добавляем недостающие переводы
  Object.keys(newTranslations).forEach(key => {
    if (!currentContent[key]) {
      currentContent[key] = newTranslations[key][lang] || newTranslations[key].en;
      addedCount++;
    }
  });

  if (addedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(currentContent, null, 2) + '\n');
    console.log(`✅ ${lang.toUpperCase()}: добавлено ${addedCount} переводов`);
  }
});

console.log('\n📊 Проверка результатов...\n');

// Проверяем, что все файлы содержат новые ключи
Object.keys(newTranslations).forEach(key => {
  let foundCount = 0;
  const langs = ['ru', 'en', 'es', 'de', 'fr', 'pl'];

  langs.forEach(lang => {
    const filePath = path.join(localesDir, `${lang}.json`);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (content[key]) {
      foundCount++;
    }
  });

  console.log(`${key}: ${foundCount}/6 языков`);
});

console.log('\n🎉 Недостающие переводы добавлены во все файлы локализации!');
