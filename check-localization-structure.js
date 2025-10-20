#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const localesDir = 'src/lib/locales';
const langs = ['ru', 'en', 'es', 'de', 'fr', 'pl'];
const locales = {};

console.log('🔍 Проверка структуры локализации...\n');

// Загружаем все файлы локализации
langs.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    locales[lang] = JSON.parse(content);
    console.log(`✅ ${lang}.json загружен (${Object.keys(locales[lang]).length} ключей)`);
  } catch (err) {
    console.error(`❌ Ошибка загрузки ${lang}.json: ${err.message}`);
  }
});

// Проверяем количество ключей
console.log('\n📊 Количество ключей по языкам:');
const ruKeysCount = Object.keys(locales.ru).length;
langs.forEach(lang => {
  const count = Object.keys(locales[lang]).length;
  const status = count === ruKeysCount ? '✅' : '⚠️';
  console.log(`${status} ${lang}: ${count} ключей`);
});

// Проверяем синхронизацию ключей
console.log('\n🔄 Проверка синхронизации ключей:');
const ruKeys = Object.keys(locales.ru).sort();
let allSync = true;

langs.forEach(lang => {
  if (lang === 'ru') return;

  const langKeys = Object.keys(locales[lang]).sort();
  const missing = ruKeys.filter(key => !langKeys.includes(key));
  const extra = langKeys.filter(key => !ruKeys.includes(key));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅ ${lang}: полностью синхронизирован`);
  } else {
    console.log(`⚠️ ${lang}: отсутствует ${missing.length}, лишних ${extra.length}`);
    allSync = false;
  }
});

// Проверяем несколько примеров переводов
console.log('\n🌍 Примеры переводов:');
const sampleKeys = ['appName', 'loading', 'save', 'cancel', 'errorGeneric'];

sampleKeys.forEach(key => {
  console.log(`\n"${key}":`);
  langs.forEach(lang => {
    const value = locales[lang][key] || '❌ НЕ НАЙДЕН';
    console.log(`  ${lang}: "${value}"`);
  });
});

// Плюрализация
console.log('\n🔢 Плюрализация:');
const pluralKeys = ['questionCount', 'episodes'];

pluralKeys.forEach(key => {
  console.log(`\n"${key}":`);
  langs.forEach(lang => {
    const forms = [`${key}_one`, `${key}_few`, `${key}_many`];
    const available = forms.filter(form => locales[lang][form]);
    if (available.length > 0) {
      console.log(`  ${lang}: ${available.length} форм`);
    } else {
      console.log(`  ${lang}: ❌ нет форм плюрализации`);
    }
  });
});

console.log('\n📈 Статистика:');
console.log(`Всего ключей: ${ruKeysCount}`);
console.log(`Все языки синхронизированы: ${allSync ? '✅ ДА' : '⚠️ НЕТ'}`);
