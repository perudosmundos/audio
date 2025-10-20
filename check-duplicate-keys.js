const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'lib', 'locales');
const files = ['ru.json', 'en.json', 'es.json', 'de.json', 'fr.json', 'pl.json'];

console.log('Checking for duplicate keys in localization files...\n');

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = Object.keys(content);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    
    if (duplicates.length > 0) {
      console.log(`❌ ${file}: Found duplicate keys: ${duplicates.join(', ')}`);
    } else {
      console.log(`✅ ${file}: No duplicate keys found`);
    }
  } catch (e) {
    console.log(`❌ ${file}: Error parsing JSON - ${e.message}`);
  }
});

console.log('\nDone!');
