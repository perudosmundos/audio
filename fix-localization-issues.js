#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Загружаем английский файл как основу для переводов
const enPath = path.join(localesDir, 'en.json');
const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Загружаем русский файл
const ruPath = path.join(localesDir, 'ru.json');
const ruContent = JSON.parse(fs.readFileSync(ruPath, 'utf8'));

console.log('🔧 Исправление проблем локализации...\n');

// Функция для исправления файла локализации
function fixLocaleFile(lang, content) {
  let fixed = 0;
  let total = 0;

  // Проходим по всем ключам английского файла
  Object.keys(enContent).forEach(key => {
    total++;
    const enValue = enContent[key];
    const currentValue = content[key];

    // Если текущее значение - русское (содержит кириллицу), заменяем на английское
    if (currentValue && /[\u0400-\u04FF]/.test(currentValue)) {
      content[key] = enValue;
      fixed++;
      console.log(`  ✅ Исправлен: ${key}`);
    }
  });

  return { fixed, total };
}

// Исправляем все языки кроме русского и английского
const languagesToFix = ['es', 'de', 'fr', 'pl'];

languagesToFix.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);

  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`\n🔍 Проверяем ${lang}.json...`);

    const { fixed, total } = fixLocaleFile(lang, content);

    if (fixed > 0) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
      console.log(`✅ ${lang}.json: исправлено ${fixed} из ${total} строк`);
    } else {
      console.log(`✅ ${lang}.json: все строки корректны`);
    }
  } catch (err) {
    console.error(`❌ Ошибка обработки ${lang}.json: ${err.message}`);
  }
});

// Проверяем результат
console.log('\n📊 Проверка результата...');
let totalIssues = 0;

languagesToFix.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const issues = Object.values(content).filter(value =>
    typeof value === 'string' && /[\u0400-\u04FF]/.test(value)
  ).length;

  totalIssues += issues;

  if (issues === 0) {
    console.log(`✅ ${lang}.json: нет русских слов`);
  } else {
    console.log(`⚠️ ${lang}.json: найдено ${issues} русских слов`);
  }
});

console.log(`\n📈 Итого: ${totalIssues === 0 ? '✅ Все проблемы исправлены!' : `⚠️ Осталось ${totalIssues} проблем`}`);
