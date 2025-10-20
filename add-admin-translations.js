#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Дополнительные переводы для админ-панели истории редактирования
const adminTranslations = {
  ru: {
    "editHistoryAdminTitle": "Админ-панель истории редактирования",
    "authenticateToAccessEditHistory": "Аутентифицируйтесь для доступа к истории редактирования",
    "authenticate": "Аутентифицироваться"
  },
  en: {
    "editHistoryAdminTitle": "Edit History Admin",
    "authenticateToAccessEditHistory": "Authenticate to access edit history",
    "authenticate": "Authenticate"
  },
  es: {
    "editHistoryAdminTitle": "Administración de Historial de Edición",
    "authenticateToAccessEditHistory": "Autentícate para acceder al historial de edición",
    "authenticate": "Autenticar"
  },
  de: {
    "editHistoryAdminTitle": "Bearbeitungsverlauf Admin",
    "authenticateToAccessEditHistory": "Authentifizieren Sie sich, um auf den Bearbeitungsverlauf zuzugreifen",
    "authenticate": "Authentifizieren"
  },
  fr: {
    "editHistoryAdminTitle": "Admin Historique des Modifications",
    "authenticateToAccessEditHistory": "Authentifiez-vous pour accéder à l'historique des modifications",
    "authenticate": "S'authentifier"
  },
  pl: {
    "editHistoryAdminTitle": "Admin Historii Edycji",
    "authenticateToAccessEditHistory": "Uwierzytelnij się, aby uzyskać dostęp do historii edycji",
    "authenticate": "Uwierzytelnij"
  }
};

console.log('🔧 Добавление переводов для админ-панели истории редактирования...\n');

// Добавляем переводы в каждый файл локализации
Object.keys(adminTranslations).forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const currentContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let addedCount = 0;
  Object.keys(adminTranslations[lang]).forEach(key => {
    if (!currentContent[key]) {
      currentContent[key] = adminTranslations[lang][key];
      addedCount++;
    }
  });

  if (addedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(currentContent, null, 2) + '\n');
    console.log(`✅ ${lang.toUpperCase()}: добавлено ${addedCount} переводов для админ-панели`);
  } else {
    console.log(`✅ ${lang.toUpperCase()}: все переводы уже присутствуют`);
  }
});

console.log('\n🎉 Переводы для админ-панели истории редактирования добавлены!');
