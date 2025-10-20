const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'locales', 'ru.json');

// Читаем файл
const content = fs.readFileSync(filePath, 'utf8');

// Парсим JSON с отслеживанием дубликатов
const lines = content.split('\n');
const seenKeys = new Set();
const filteredLines = [];
let inObject = false;
let bracketCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Отслеживаем открывающие и закрывающие скобки
  if (trimmed === '{') {
    bracketCount++;
    inObject = true;
    filteredLines.push(line);
    continue;
  }
  
  if (trimmed === '}' || trimmed === '},') {
    bracketCount--;
    if (bracketCount === 0) {
      inObject = false;
    }
    filteredLines.push(line);
    continue;
  }
  
  // Проверяем, является ли это строкой с ключом
  const keyMatch = line.match(/^\s*"([^"]+)"\s*:/);
  
  if (keyMatch && inObject && bracketCount === 1) {
    const key = keyMatch[1];
    
    if (seenKeys.has(key)) {
      console.log(`Removing duplicate key: "${key}" at line ${i + 1}`);
      continue; // Пропускаем дубликат
    }
    
    seenKeys.add(key);
  }
  
  filteredLines.push(line);
}

// Сохраняем исправленный файл
const newContent = filteredLines.join('\n');
fs.writeFileSync(filePath, newContent, 'utf8');

console.log('\n✅ Fixed ru.json - removed duplicate keys');
console.log(`Total unique keys: ${seenKeys.size}`);
