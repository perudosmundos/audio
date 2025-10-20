#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Дополнительные переводы для английского языка
const additionalEnglishTranslations = {
  // Пакетное добавление вопросов
  batchAddQuestions: "Import from Text",
  batchAddQuestionsShort: "Import",
  batchAddQuestionsDialogTitle: "Import Questions from Text",
  batchAddQuestionsDialogDescription: "Paste a list of questions in the text field below. Each question should start with a time mark (e.g., HH:MM:SS or MM:SS), followed by the question text. If the question is in two languages, separate them with ' / ' character.",
  pasteQuestionsList: "Paste questions list:",
  processAndAdd: "Process and Add",
  bilingualExamplePart1: "Example in two languages:",
  singleLanguageExample: "Example in one language:",
  batchAddPlaceholder: "00:30 What is meditation?\n01:15 How to start meditating?\n02:00 Benefits of daily practice",
  errorBatchAddingQuestions: "Error adding questions: {errorMessage}",

  // Другие недостающие переводы
  nowPlaying: "Now Playing",
  paused: "Paused",
  selectAnEpisode: "Select an Episode",
  backToEpisodes: "Back to Episodes",
  backToEpisodesShort: "Back",
  pageNotFoundTitle: "Page Not Found",
  pageNotFoundDescription: "The page you're looking for doesn't exist.",

  // Загрузка файлов
  uploadAudioFiles: "Upload Audio Files",
  uploadAudio: "Upload Audio",
  uploadAudioDescription: "Upload your meditation audio files to get started with transcription and question management.",
  dropFilesHere: "Drop files here",
  dragOrClickUpload: "Drag and drop or click to upload",
  supportedFormats: "Supported formats: MP3, WAV, M4A, FLAC",
  uploading: "Uploading...",
  uploadError: "Upload Error",
  errorUploadingFile: "Error uploading file: {errorMessage}",
  allFilesUploadedSuccessfully: "All files uploaded successfully",

  // Другие элементы интерфейса
  openInNewWindow: "Open in New Window",
  manage: "Manage",
  autoGenerateQuestions: "Auto-generate Questions",
  loadQuestionsFromDB: "Load Questions from DB",
  fileNotFound: "File Not Found",
  fileNotFoundInFolder: "File not found in folder",
  fileFoundAndAdded: "File found and added",
  fileWillBeUploaded: "File will be uploaded",
  fileUploadError: "File upload error",
  noFilesForEpisode: "No files for episode",
  spanishTranscriptInProgress: "Spanish transcript in progress",
  transcribeSpanishFirst: "Transcribe Spanish first",
  needSpanishFirst: "Need Spanish transcript first",
  translateTimingsToEnglish: "Translate Timings to English",
  createEnglishVersion: "Create English Version",
  fromSpanishTranscript: "From Spanish transcript",
  translateTranscriptFromRussian: "Translate Transcript from Russian",
  srtDownloaded: "SRT downloaded",
  textTranslated: "Text translated",

  // Ошибки Hostinger
  errorUploadingToHostinger: "Error uploading to Hostinger",
  errorDeletingHostingerFile: "Error deleting Hostinger file",
  hostingerConnectionFailed: "Hostinger connection failed",
  hostingerUploadTimeout: "Hostinger upload timeout",

  // Миграция
  migrationStarted: "Migration started",
  migrationComplete: "Migration complete",
  migrationError: "Migration error",
  filesSelectedForMigration: "Files selected for migration",
  storageProvider: "Storage Provider",

  // Названия языков в интерфейсе
  languageRussian: "Russian",
};

console.log('🔧 Добавление недостающих английских переводов...\n');

// Загружаем текущий английский файл
const enPath = path.join(localesDir, 'en.json');
const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Добавляем недостающие переводы
let addedCount = 0;
Object.keys(additionalEnglishTranslations).forEach(key => {
  if (!enContent[key] || /[\u0400-\u04FF]/.test(enContent[key])) {
    enContent[key] = additionalEnglishTranslations[key];
    addedCount++;
    console.log(`✅ Добавлен перевод для: ${key}`);
  }
});

// Сохраняем обновленный английский файл
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2) + '\n');
console.log(`\n✅ Добавлено ${addedCount} английских переводов`);

console.log('\n🔧 Обновление остальных языков...\n');

// Обновляем остальные языки
const languagesToFix = ['es', 'de', 'fr', 'pl'];
let totalFixed = 0;

languagesToFix.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let fixedCount = 0;

  // Заменяем русские строки английскими переводами
  Object.keys(additionalEnglishTranslations).forEach(key => {
    if (content[key] && /[\u0400-\u04FF]/.test(content[key])) {
      content[key] = enContent[key];
      fixedCount++;
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`✅ ${lang.toUpperCase()}: исправлено ${fixedCount} строк`);
  totalFixed += fixedCount;
});

console.log(`\n🎉 Обновлено ${totalFixed} строк в ${languagesToFix.length} языках.`);

console.log('\n📊 Финальная проверка...\n');

// Проверяем результаты
let remainingIssues = 0;
languagesToFix.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const issues = Object.values(content).filter(value =>
    typeof value === 'string' && /[\u0400-\u04FF]/.test(value) && value !== 'Русский'
  ).length;

  remainingIssues += issues;

  if (issues === 0) {
    console.log(`✅ ${lang.toUpperCase()}: нет русских слов`);
  } else {
    console.log(`⚠️ ${lang.toUpperCase()}: найдено ${issues} русских слов`);
  }
});

if (remainingIssues === 0) {
  console.log('\n🎉 ВСЕ ПРОБЛЕМЫ С ЛОКАЛИЗАЦИЕЙ ИСПРАВЛЕНЫ!');
} else {
  console.log(`\n⚠️ Осталось ${remainingIssues} проблем с локализацией`);
}
