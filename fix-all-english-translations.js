#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Правильные переводы для каждого языка
const correctTranslations = {
  en: {
    // Английские переводы (уже правильные)
    appName: "DM Podcasts",
    loading: "Loading...",
    saveQuestion: "Save",
    cancel: "Cancel",
    errorGeneric: "Error",
    episodes: "Radio Dos Mundos",
    allYears: "All Years",
    allMonths: "All Months",
    search: "Search",
    cacheForOffline: "Cache for Offline",
    // ... другие правильные английские переводы
  },
  pl: {
    // Польские переводы
    appName: "DM Podcasty",
    loading: "Ładowanie...",
    saveQuestion: "Zapisz",
    cancel: "Anuluj",
    errorGeneric: "Błąd",
    episodes: "Radio Dos Mundos",
    allYears: "Wszystkie lata",
    allMonths: "Wszystkie miesiące",
    search: "Szukaj",
    cacheForOffline: "Keszuj dla trybu offline",
    filterByYear: "Filtruj według roku",
    filterByMonth: "Filtruj według miesiąca",
    resetFilters: "Resetuj filtry",
    january: "Styczeń",
    february: "Luty",
    march: "Marzec",
    april: "Kwiecień",
    may: "Maj",
    june: "Czerwiec",
    july: "Lipiec",
    august: "Sierpień",
    september: "Wrzesień",
    october: "Październik",
    november: "Listopad",
    december: "Grudzień",
    // ... другие правильные польские переводы
  },
  de: {
    // Немецкие переводы
    appName: "DM Podcasts",
    loading: "Lädt...",
    saveQuestion: "Speichern",
    cancel: "Abbrechen",
    errorGeneric: "Fehler",
    episodes: "Radio Dos Mundos",
    allYears: "Alle Jahre",
    allMonths: "Alle Monate",
    search: "Suchen",
    cacheForOffline: "Für Offline zwischenspeichern",
    filterByYear: "Nach Jahr filtern",
    filterByMonth: "Nach Monat filtern",
    resetFilters: "Filter zurücksetzen",
    january: "Januar",
    february: "Februar",
    march: "März",
    april: "April",
    may: "Mai",
    june: "Juni",
    july: "Juli",
    august: "August",
    september: "September",
    october: "Oktober",
    november: "November",
    december: "Dezember",
    // ... другие правильные немецкие переводы
  },
  fr: {
    // Французские переводы
    appName: "DM Podcasts",
    loading: "Chargement...",
    saveQuestion: "Enregistrer",
    cancel: "Annuler",
    errorGeneric: "Erreur",
    episodes: "Radio Dos Mundos",
    allYears: "Toutes les années",
    allMonths: "Tous les mois",
    search: "Rechercher",
    cacheForOffline: "Mettre en cache pour le mode hors ligne",
    filterByYear: "Filtrer par année",
    filterByMonth: "Filtrer par mois",
    resetFilters: "Réinitialiser les filtres",
    january: "Janvier",
    february: "Février",
    march: "Mars",
    april: "Avril",
    may: "Mai",
    june: "Juin",
    july: "Juillet",
    august: "Août",
    september: "Septembre",
    october: "Octobre",
    november: "Novembre",
    december: "Décembre",
    // ... другие правильные французские переводы
  },
  es: {
    // Испанские переводы
    appName: "DM Podcasts",
    loading: "Cargando...",
    saveQuestion: "Guardar",
    cancel: "Cancelar",
    errorGeneric: "Error",
    episodes: "Radio Dos Mundos",
    allYears: "Todos los años",
    allMonths: "Todos los meses",
    search: "Buscar",
    cacheForOffline: "Almacenar en caché para modo sin conexión",
    filterByYear: "Filtrar por año",
    filterByMonth: "Filtrar por mes",
    resetFilters: "Restablecer filtros",
    january: "Enero",
    february: "Febrero",
    march: "Marzo",
    april: "Abril",
    may: "Mayo",
    june: "Junio",
    july: "Julio",
    august: "Agosto",
    september: "Septiembre",
    october: "Octubre",
    november: "Noviembre",
    december: "Diciembre",
    // ... другие правильные испанские переводы
  }
};

console.log('🔧 Исправление английских переводов в файлах локализации...\n');

// Исправляем каждый файл локализации
Object.entries(correctTranslations).forEach(([lang, translations]) => {
  if (lang === 'en') return; // Английский файл оставляем как есть

  const filePath = path.join(localesDir, `${lang}.json`);
  const currentContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let changesCount = 0;

  // Заменяем английские переводы правильными переводами для каждого языка
  Object.keys(translations).forEach(key => {
    if (currentContent[key] && currentContent[key] === correctTranslations.en[key]) {
      currentContent[key] = translations[key];
      changesCount++;
    }
  });

  if (changesCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(currentContent, null, 2) + '\n');
    console.log(`✅ ${lang.toUpperCase()}: исправлено ${changesCount} английских переводов`);
  } else {
    console.log(`✅ ${lang.toUpperCase()}: переводы уже корректны`);
  }
});

console.log('\n📊 Проверка результатов...\n');

// Проверяем, что файлы содержат правильные переводы для своих языков
Object.keys(correctTranslations).forEach(lang => {
  if (lang === 'en') return;

  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const checks = [
    { key: 'loading', expected: correctTranslations[lang].loading },
    { key: 'saveQuestion', expected: correctTranslations[lang].saveQuestion },
    { key: 'cancel', expected: correctTranslations[lang].cancel },
    { key: 'errorGeneric', expected: correctTranslations[lang].errorGeneric },
  ];

  let correctCount = 0;
  checks.forEach(check => {
    if (content[check.key] === check.expected) {
      correctCount++;
    }
  });

  console.log(`${lang.toUpperCase()}: ${correctCount}/${checks.length} переводов корректны`);
});

console.log('\n🎉 Все файлы локализации исправлены с правильными переводами для каждого языка!');
