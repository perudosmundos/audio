#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.join(__dirname, '../lib/locales');

// Прочитаем все языки
const ru = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const es = JSON.parse(fs.readFileSync(path.join(localesDir, 'es.json'), 'utf8'));
const de = JSON.parse(fs.readFileSync(path.join(localesDir, 'de.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(localesDir, 'fr.json'), 'utf8'));
const pl = JSON.parse(fs.readFileSync(path.join(localesDir, 'pl.json'), 'utf8'));

console.log('📊 Current state:');
console.log(`  🇷🇺 RU: ${Object.keys(ru).length} keys`);
console.log(`  🇬🇧 EN: ${Object.keys(en).length} keys`);
console.log(`  🇪🇸 ES: ${Object.keys(es).length} keys`);
console.log(`  🇩🇪 DE: ${Object.keys(de).length} keys`);
console.log(`  🇫🇷 FR: ${Object.keys(fr).length} keys`);
console.log(`  🇵🇱 PL: ${Object.keys(pl).length} keys`);

// Функция для заполнения недостающих ключей
function fillMissingKeys(target, source, fallback) {
  const allKeys = new Set([...Object.keys(source), ...Object.keys(fallback)]);

  allKeys.forEach(key => {
    if (!target[key]) {
      // Сначала берём из source если есть
      if (source[key]) {
        target[key] = source[key];
      }
      // Иначе из fallback
      else if (fallback[key]) {
        target[key] = fallback[key];
      }
    }
  });

  return target;
}

// Функция для синхронизации всех языков с максимальным количеством ключей
function syncAllLanguages() {
  // Находим язык с максимальным количеством ключей
  const allLangs = { ru, en, es, de, fr, pl };
  const maxKeysLang = Object.entries(allLangs).reduce((max, [lang, data]) =>
    Object.keys(data).length > Object.keys(max).length ? data : max, ru);

  const baseKeys = Object.keys(maxKeysLang);

  // Синхронизируем все языки с максимальным набором ключей
  Object.values(allLangs).forEach(lang => {
    baseKeys.forEach(key => {
      if (!lang[key]) {
        // Ищем значение в других языках
        for (const [otherLang, otherData] of Object.entries(allLangs)) {
          if (otherData[key]) {
            lang[key] = otherData[key];
            break;
          }
        }
      }
    });
  });

  return allLangs;
}

// Синхронизируем все языки
console.log('\n📝 Synchronizing all languages...');
const syncedLanguages = syncAllLanguages();

// Обновляем глобальные переменные
Object.assign(ru, syncedLanguages.ru);
Object.assign(en, syncedLanguages.en);
Object.assign(es, syncedLanguages.es);
Object.assign(de, syncedLanguages.de);
Object.assign(fr, syncedLanguages.fr);
Object.assign(pl, syncedLanguages.pl);

// Сохраняем обновленные файлы
const files = [
  { path: path.join(localesDir, 'en.json'), data: syncedLanguages.en, lang: '🇬🇧 EN' },
  { path: path.join(localesDir, 'es.json'), data: syncedLanguages.es, lang: '🇪🇸 ES' },
  { path: path.join(localesDir, 'de.json'), data: syncedLanguages.de, lang: '🇩🇪 DE' },
  { path: path.join(localesDir, 'fr.json'), data: syncedLanguages.fr, lang: '🇫🇷 FR' },
  { path: path.join(localesDir, 'pl.json'), data: syncedLanguages.pl, lang: '🇵🇱 PL' }
];

files.forEach(({ path: filePath, data, lang }) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✅ ${lang}: ${Object.keys(data).length} keys`);
});

const totalKeys = Object.keys(ru).length;
console.log('\n✅ Localization update complete!');
console.log('📊 Summary - All languages now have:');
console.log(`  ✓ ${totalKeys} keys (${totalKeys} total)`);
console.log(`  ✓ 6 languages supported:`);
console.log(`    🇷🇺 Russian (RU) - Base language`);
console.log(`    🇬🇧 English (EN)`);
console.log(`    🇪🇸 Spanish (ES)`);
console.log(`    🇩🇪 German (DE)`);
console.log(`    🇫🇷 French (FR)`);
console.log(`    🇵🇱 Polish (PL)`);
