#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.join(__dirname, '../lib/locales');

console.log('\n🧪 LOCALIZATION TEST SUITE\n');

// 1. Проверка наличия всех файлов
console.log('✓ Test 1: Checking locale files existence');
const langs = ['ru', 'en', 'es', 'de', 'fr', 'pl'];
let allFiles = true;
langs.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${lang}.json`);
  if (!exists) allFiles = false;
});

if (!allFiles) {
  console.error('\n❌ Some locale files are missing!');
  process.exit(1);
}

// 2. Проверка синтаксиса JSON
console.log('\n✓ Test 2: Validating JSON syntax');
const locales = {};
let jsonValid = true;
langs.forEach(lang => {
  try {
    const filePath = path.join(localesDir, `${lang}.json`);
    const content = fs.readFileSync(filePath, 'utf8');
    locales[lang] = JSON.parse(content);
    console.log(`  ✅ ${lang}.json - Valid JSON`);
  } catch (err) {
    console.error(`  ❌ ${lang}.json - Invalid JSON: ${err.message}`);
    jsonValid = false;
  }
});

if (!jsonValid) {
  console.error('\n❌ JSON parsing failed!');
  process.exit(1);
}

// 3. Проверка количества ключей
console.log('\n✓ Test 3: Checking key counts');
const ruKeyCount = Object.keys(locales.ru).length;
const enKeyCount = Object.keys(locales.en).length;
const esKeyCount = Object.keys(locales.es).length;
const deKeyCount = Object.keys(locales.de).length;
const frKeyCount = Object.keys(locales.fr).length;
const plKeyCount = Object.keys(locales.pl).length;

let keyCountOk = true;
const counts = [ruKeyCount, enKeyCount, esKeyCount, deKeyCount, frKeyCount, plKeyCount];
const allEqual = counts.every(count => count === counts[0]);

if (allEqual) {
  console.log(`  ✅ All languages have ${ruKeyCount} keys ✓`);
} else {
  console.log(`  ❌ Key count mismatch:`);
  console.log(`    RU: ${ruKeyCount}, EN: ${enKeyCount}, ES: ${esKeyCount}, DE: ${deKeyCount}, FR: ${frKeyCount}, PL: ${plKeyCount}`);
  keyCountOk = false;
}

if (!keyCountOk) {
  console.warn('\n⚠️  Warning: Not all languages have the same number of keys');
}

// 4. Проверка обязательных ключей
console.log('\n✓ Test 4: Checking mandatory keys');
const mandatoryKeys = [
  'appName',
  'loading',
  'save',
  'cancel',
  'delete',
  'language',
  'errorGeneric',
  'russian',
  'spanish',
  'english',
  'german',
  'french',
  'polish'
];

let mandatoryOk = true;
mandatoryKeys.forEach(key => {
  let found = 0;
  langs.forEach(lang => {
    if (locales[lang][key]) found++;
  });
  const isOk = found === langs.length;
  console.log(`  ${isOk ? '✅' : '❌'} "${key}" - found in ${found}/${langs.length} languages`);
  if (!isOk) mandatoryOk = false;
});

// 5. Проверка плюрализованных ключей
console.log('\n✓ Test 5: Checking pluralization keys');
const pluralKeys = ['questionCount', 'episodes', 'filesInQueue'];
let pluralOk = true;
pluralKeys.forEach(keyBase => {
  const hasOne = Object.keys(locales.ru).includes(`${keyBase}_one`);
  const hasFew = Object.keys(locales.ru).includes(`${keyBase}_few`);
  const hasMany = Object.keys(locales.ru).includes(`${keyBase}_many`);
  
  if (hasOne || hasFew || hasMany) {
    const forms = [];
    if (hasOne) forms.push('one');
    if (hasFew) forms.push('few');
    if (hasMany) forms.push('many');
    console.log(`  ✅ "${keyBase}" - forms: ${forms.join(', ')}`);
  }
});

// 6. Проверка параметризованных ключей
console.log('\n✓ Test 6: Checking parameterized keys');
const paramKeys = Object.keys(locales.ru).filter(k => 
  locales.ru[k].includes('{') && locales.ru[k].includes('}')
);
console.log(`  ✅ Found ${paramKeys.length} parameterized keys`);
const sampleParams = paramKeys.slice(0, 3);
sampleParams.forEach(key => {
  const matches = locales.ru[key].match(/{[^}]+}/g);
  console.log(`    - "${key}" uses: ${matches.join(', ')}`);
});

// 7. Проверка синхронизации ключей между языками
console.log('\n✓ Test 7: Checking key synchronization between languages');
let syncOk = true;
const ruKeys = Object.keys(locales.ru).sort();
langs.forEach(lang => {
  if (lang !== 'ru') {
    const langKeys = Object.keys(locales[lang]).sort();
    const missing = ruKeys.filter(k => !langKeys.includes(k));
    const extra = langKeys.filter(k => !ruKeys.includes(k));
    
    if (missing.length === 0 && extra.length === 0) {
      console.log(`  ✅ ${lang} - perfectly synchronized`);
    } else {
      console.log(`  ⚠️  ${lang} - missing ${missing.length}, extra ${extra.length}`);
      if (missing.length > 0) {
        console.log(`      Missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`);
      }
      syncOk = false;
    }
  }
});

// 8. Проверка на пустые значения
console.log('\n✓ Test 8: Checking for empty values');
let emptyOk = true;
langs.forEach(lang => {
  const empty = Object.entries(locales[lang])
    .filter(([k, v]) => !v || v.trim() === '')
    .map(([k]) => k);
  
  if (empty.length === 0) {
    console.log(`  ✅ ${lang} - no empty values`);
  } else {
    console.log(`  ⚠️  ${lang} - found ${empty.length} empty values`);
    emptyOk = false;
  }
});

// 9. Статистика
console.log('\n✓ Test 9: Statistics');
console.log(`  Total keys per language: ${Object.keys(locales.ru).length}`);
console.log(`  Total file size: ${Object.values(locales).reduce((sum, l) => sum + JSON.stringify(l).length, 0)} bytes`);

const categories = {
  error: Object.keys(locales.ru).filter(k => k.toLowerCase().includes('error')).length,
  loading: Object.keys(locales.ru).filter(k => k.toLowerCase().includes('loading')).length,
  question: Object.keys(locales.ru).filter(k => k.toLowerCase().includes('question')).length,
  episode: Object.keys(locales.ru).filter(k => k.toLowerCase().includes('episode')).length,
  button: Object.keys(locales.ru).filter(k => k.toLowerCase().includes('button')).length,
};

Object.entries(categories).forEach(([cat, count]) => {
  if (count > 0) console.log(`  - Keys containing "${cat}": ${count}`);
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 TEST RESULTS');
console.log('='.repeat(50));

const allOk = allFiles && jsonValid && keyCountOk && mandatoryOk && syncOk && emptyOk;
if (allOk) {
  console.log('\n✅ ALL TESTS PASSED! Localization system is ready for production!\n');
  process.exit(0);
} else {
  console.log('\n⚠️  SOME TESTS FAILED! Please fix the issues above.\n');
  if (!syncOk || !emptyOk) {
    console.log('💡 Tip: Run "node src/scripts/fix-all-locales.js" to auto-fix synchronization issues\n');
  }
  process.exit(1);
}
