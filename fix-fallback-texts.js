#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Исправление fallback текстов в компонентах...\n');

// Функция для исправления fallback текстов в файле
function fixFallbackTexts(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;

    // Паттерн для поиска fallback текстов на русском
    const fallbackPatterns = [
      // getLocaleString('key', currentLanguage) || 'Русский текст'
      /getLocaleString\(['"`]([^'"`]+)['"`],\s*currentLanguage\)\s*\|\|\s*['"`]([^'"`]*[А-Яа-яЁё][^'"`]*)['"`]/g,
      // getLocaleString('key', currentLanguage) || "Русский текст"
      /getLocaleString\(['"`]([^'"`]+)['"`],\s*currentLanguage\)\s*\|\|\s*["`]([^"`]*[А-Яа-яЁё][^"`]*)["`]/g,
    ];

    fallbackPatterns.forEach(pattern => {
      content = content.replace(pattern, (match, key, fallbackText) => {
        if (fallbackText && /[А-Яа-яЁё]/.test(fallbackText)) {
          changes++;
          console.log(`  ❌ Исправлен fallback: ${key} -> "${fallbackText}"`);
          return `getLocaleString('${key}', currentLanguage)`;
        }
        return match;
      });
    });

    if (changes > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Исправлено ${changes} fallback текстов в ${path.basename(filePath)}`);
      return changes;
    } else {
      console.log(`✅ Нет fallback текстов для исправления в ${path.basename(filePath)}`);
      return 0;
    }

  } catch (error) {
    console.error(`❌ Ошибка обработки файла ${filePath}: ${error.message}`);
    return 0;
  }
}

// Поиск всех файлов компонентов
function findComponentFiles(dir) {
  const files = [];

  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (stat.isFile() && (item.endsWith('.jsx') || item.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
  }

  scanDirectory(dir);
  return files;
}

const srcDir = path.join(__dirname, 'src');
const componentFiles = findComponentFiles(srcDir);

console.log(`📁 Найдено ${componentFiles.length} файлов для проверки...\n`);

let totalChanges = 0;

componentFiles.forEach(file => {
  const changes = fixFallbackTexts(file);
  totalChanges += changes;
});

console.log(`\n📊 Общая статистика:`);
console.log(`✅ Исправлено ${totalChanges} fallback текстов во всех компонентах`);
console.log(`🎯 Теперь интерфейс будет правильно отображать выбранный язык без fallback на русский!`);
