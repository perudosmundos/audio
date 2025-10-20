#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Загружаем русский файл как основу
const ruContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'));

// Полные правильные переводы на английский
const englishTranslations = {
  appName: "DM Podcasts",
  loading: "Loading...",
  loadingPodcast: "Loading podcast...",
  loadingEpisodes: "Loading meditations...",
  loadingEpisode: "Loading meditation...",
  errorLoadingData: "Error loading data",
  tryAgain: "Try again",
  failedToLoadPodcastData: "Failed to load podcast data: {errorMessage}. Please try again later.",
  episodeNotFound: "Meditation not found",
  noEpisodesFoundForLanguage: "No meditations found for \"{language}\" language.",
  tryUploadingAudio: "Try uploading an audio file to get started.",
  reloadEpisodes: "Reload data",
  episodes: "Radio Dos Mundos",
  searchEpisodesAndQuestions: "Search meditations, questions and text...",
  searchInTranscript: "Search in transcript...",
  searchResultsEmpty: "Nothing found for your search.",
  noEpisodesForLanguageShort: "Meditations not found",
  selectEpisode: "Select meditation: {episodeTitle}",
  openEpisode: "Open",
  episodeTitleMissing: "Meditation title missing",
  descriptionMissing: "Description missing.",
  questions: "Questions",
  questionsCountFormat: "({count})",
  noQuestionsForLanguage: "Questions have not been added yet for the current language.",
  loadingTranscriptAndQuestions: "Loading transcript and questions...",
  noQuestionsOrTranscriptTitle: "No questions or transcript yet",
  noQuestionsOrTranscriptDesc: "When the transcript is ready it will appear here. You can add questions now.",
  loadingTranscript: "Loading transcript...",
  addQuestion: "Add",
  editQuestion: "Edit question",
  deleteQuestion: "Delete question",
  saveQuestion: "Save",
  cancel: "Cancel",
  questionTime: "Time",
  questionTitle: "Question title",
  questionTitlePlaceholder: "E.g.: About the benefits of meditation",
  questionLanguage: "Question language",
  addQuestionDialogTitle: "Add question",
  addQuestionDialogDescription: "Mark the time and enter the question details.",
  addQuestionDialogDescriptionSegment: "Add a question for the segment: \"{segmentText}\"",
  editQuestionDialogTitle: "Edit question",
  editQuestionDialogDescription: "Modify the question details.",
  confirmDeleteQuestionTitle: "Confirm deletion",
  confirmDeleteQuestionDescription: "Are you sure you want to delete this question? This action is irreversible.",
  audioErrorTitle: "Audio error",
  audioErrorDescriptionPlayer: "Error loading audio for \"{episodeTitle}\".",
  playbackErrorTitle: "Playback error",
  playbackErrorDescription: "Could not play audio.",
  navigationNoQuestions: "There are no questions in this meditation to navigate.",
  navigationToastTitle: "Navigation",
  previousQuestion: "Previous question",
  nextQuestion: "Next question",
  changePlaybackSpeed: "Change playback speed, current: {speed}",
  selectLanguageModalTitle: "Select a language",
  selectLanguageModalDescription: "Please select your preferred language for the application. You can change it later.",
  russian: "Русский",
  spanish: "Español",
  english: "English",
  german: "Deutsch",
  french: "Français",
  polish: "Polski",
  allLanguages: "All languages",
  language: "Language",
  filename: "Filename",
  duration: "Duration",
  foundQuestionsInEpisode: "Found in questions",
  foundInTranscript: "Found in transcript",
  questionCount_one: "{count} question",
  questionCount_few: "{count} questions",
  questionCount_many: "{count} questions",
  errorAddingQuestion: "Failed to add question: {errorMessage}",
  errorUpdatingQuestion: "Failed to update question: {errorMessage}",
  errorDeletingQuestion: "Failed to delete question: {errorMessage}",
  errorGeneric: "Error",
};

// Создаем английский файл локализации
console.log('🔄 Создание правильного английского файла локализации...\n');

// Начинаем с полного русского контента
let enContent = { ...ruContent };

// Затем перезаписываем английскими переводами
Object.keys(englishTranslations).forEach(key => {
  if (englishTranslations[key]) {
    enContent[key] = englishTranslations[key];
  }
});

const enPath = path.join(localesDir, 'en.json');
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2) + '\n');
console.log(`✅ Создан правильный en.json с ${Object.keys(enContent).length} ключами`);

// Теперь запускаем синхронизацию для исправления остальных языков
console.log('\n🔧 Синхронизация остальных языков на основе английского...\n');

const langs = ['es', 'de', 'fr', 'pl'];
langs.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Используем английский как источник правильных переводов
  Object.keys(enContent).forEach(key => {
    if (content[key] && /[\u0400-\u04FF]/.test(content[key])) {
      content[key] = enContent[key];
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`✅ Исправлен ${lang}.json`);
});

console.log('\n✅ Все файлы локализации исправлены!');
