#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Загружаем все файлы локализации
const ruContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'));
const enContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const esContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'es.json'), 'utf8'));
const deContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'de.json'), 'utf8'));
const frContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'));
const plContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'pl.json'), 'utf8'));

const allLocales = { ru: ruContent, en: enContent, es: esContent, de: deContent, fr: frContent, pl: plContent };

console.log('🔧 Полная очистка локализации от русских строк...\n');

// Очищаем каждый файл локализации кроме русского
['en', 'es', 'de', 'fr', 'pl'].forEach(lang => {
  const content = allLocales[lang];
  let changesCount = 0;

  Object.keys(content).forEach(key => {
    const value = content[key];

    // Проверяем, содержит ли значение русские символы
    if (typeof value === 'string' && /[А-Яа-яЁё]/.test(value)) {
      // Пропускаем ключ "russian" - это перевод слова "Russian" на русский
      if (key === 'russian') return;

      // Ищем подходящий перевод в других языках
      let newValue = null;

      // Сначала пробуем английский
      if (enContent[key] && !/[А-Яа-яЁё]/.test(enContent[key])) {
        newValue = enContent[key];
      }
      // Затем русский (как fallback)
      else if (ruContent[key] && !/[А-Яа-яЁё]/.test(ruContent[key])) {
        newValue = ruContent[key];
      }

      if (newValue && newValue !== value) {
        content[key] = newValue;
        changesCount++;
      }
    }
  });

  if (changesCount > 0) {
    fs.writeFileSync(path.join(localesDir, `${lang}.json`), JSON.stringify(content, null, 2) + '\n');
    console.log(`✅ ${lang.toUpperCase()}: исправлено ${changesCount} русских строк`);
  } else {
    console.log(`✅ ${lang.toUpperCase()}: русских строк не найдено`);
  }
});

console.log('\n📊 Финальная проверка...\n');

// Проверяем, что файлы не содержат русских строк
['en', 'es', 'de', 'fr', 'pl'].forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const russianStrings = Object.values(content).filter(value =>
    typeof value === 'string' && /[А-Яа-яЁё]/.test(value) && value !== 'Русский'
  );

  if (russianStrings.length === 0) {
    console.log(`✅ ${lang.toUpperCase()}: нет русских строк`);
  } else {
    console.log(`⚠️ ${lang.toUpperCase()}: найдено ${russianStrings.length} русских строк`);
  }
});

console.log('\n🎉 Очистка локализации завершена!');
