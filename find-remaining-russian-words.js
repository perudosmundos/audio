#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

console.log('🔍 Поиск оставшихся русских слов в файлах локализации...\n');

// Загружаем английский файл как основу правильных переводов
const enContent = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

const languagesToCheck = ['es', 'de', 'fr', 'pl'];

languagesToCheck.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  console.log(`\n🔎 Проверяем ${lang.toUpperCase()}.json...`);

  const issues = [];

  Object.keys(content).forEach(key => {
    const value = content[key];
    if (typeof value === 'string' && /[\u0400-\u04FF]/.test(value) && value !== 'Русский') {
      // Пропускаем названия языков и другие допустимые случаи
      if (!key.includes('russian') && !key.includes('language') && !key.includes('polish') && !key.includes('german') && !key.includes('french') && !key.includes('spanish') && !key.includes('english')) {
        issues.push({
          key,
          value,
          enValue: enContent[key] || 'НЕТ ПЕРЕВОДА'
        });
      }
    }
  });

  if (issues.length === 0) {
    console.log(`✅ ${lang.toUpperCase()}: нет русских слов`);
  } else {
    console.log(`⚠️ ${lang.toUpperCase()}: найдено ${issues.length} русских слов:`);
    issues.slice(0, 5).forEach(issue => {
      console.log(`   • ${issue.key}: "${issue.value}"`);
      if (issue.enValue !== 'НЕТ ПЕРЕВОДА') {
        console.log(`     Английский: "${issue.enValue}"`);
      }
    });

    if (issues.length > 5) {
      console.log(`   ... и еще ${issues.length - 5} проблем`);
    }
  }
});

// Покажем статистику по всем проблемам
console.log('\n📊 Общая статистика проблем:');
let totalIssues = 0;

languagesToCheck.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const issues = Object.values(content).filter(value =>
    typeof value === 'string' && /[\u0400-\u04FF]/.test(value) && value !== 'Русский'
  ).length;

  totalIssues += issues;
  console.log(`${lang.toUpperCase()}: ${issues} проблем`);
});

console.log(`\n📈 Всего проблем: ${totalIssues}`);
