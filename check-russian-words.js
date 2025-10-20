import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Кириллический символ pattern
const cyrillicPattern = /[\u0400-\u04FF]/g;

const localesDir = path.join(__dirname, 'src/lib/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

console.log('🔍 ПРОВЕРКА НА РУССКИЕ СЛОВА В ДРУГИХ ЯЗЫКАХ\n');
console.log('═'.repeat(70));

let totalIssues = 0;

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Пропускаем русский язык
  if (file === 'ru.json') {
    console.log(`\n✅ ${file} - РУССКИЙ (пропускаем)`);
    return;
  }
  
  const issues = [];
  
  function checkObject(obj, prefix = '') {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        const cyrillicMatches = value.match(cyrillicPattern);
        if (cyrillicMatches) {
          issues.push({
            key: fullKey,
            value: value,
            count: cyrillicMatches.length
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        checkObject(value, fullKey);
      }
    });
  }
  
  checkObject(data);
  
  if (issues.length === 0) {
    console.log(`\n✅ ${file} - ОК (русских слов не найдено)`);
  } else {
    console.log(`\n❌ ${file} - НАЙДЕНО ${issues.length} проблем:`);
    issues.slice(0, 5).forEach(issue => {
      console.log(`   • ${issue.key}`);
      console.log(`     Значение: "${issue.value}"`);
    });
    if (issues.length > 5) {
      console.log(`   ... и еще ${issues.length - 5} проблем`);
    }
    totalIssues += issues.length;
  }
});

console.log('\n' + '═'.repeat(70));
if (totalIssues === 0) {
  console.log('✅ ВСЕ ЯЗЫКИ ЧИСТЫЕ - РУССКИХ СЛОВ НЕ НАЙДЕНО!');
} else {
  console.log(`❌ НАЙДЕНО ВСЕГО: ${totalIssues} проблем с русским текстом`);
}
console.log('═'.repeat(70));
