#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Новые переводы для панели истории редактирования
const editHistoryTranslations = {
  ru: {
    "loginToViewEditHistory": "Войдите, чтобы просмотреть и управлять историей редактирования",
    "loginAsEditor": "Войти как редактор",
    "loggedInAs": "Вошли как",
    "noEditsYet": "Пока нет правок",
    "activeEdits": "Активные правки",
    "undo": "Отменить",
    "confirmRollback": "Вы уверены, что хотите отменить эту правку?\n\nЭто восстановит предыдущее содержимое.",
    "editRolledBack": "Правка отменена",
    "contentRestored": "Предыдущее содержимое восстановлено",
    "rollbackRecorded": "Откат записан",
    "rollbackRecordedDesc": "Откат был записан, но восстановление содержимого требует ручного вмешательства",
    "reason": "Причина"
  },
  en: {
    "loginToViewEditHistory": "Login to view and manage your edit history",
    "loginAsEditor": "Login as Editor",
    "loggedInAs": "Logged in as",
    "noEditsYet": "No edits yet",
    "activeEdits": "Active Edits",
    "undo": "Undo",
    "confirmRollback": "Are you sure you want to rollback this edit?\n\nThis will restore the previous content.",
    "editRolledBack": "Edit rolled back",
    "contentRestored": "Your previous content has been restored",
    "rollbackRecorded": "Rollback recorded",
    "rollbackRecordedDesc": "The rollback was recorded but content restoration requires manual intervention",
    "reason": "Reason"
  },
  es: {
    "loginToViewEditHistory": "Inicia sesión para ver y gestionar tu historial de edición",
    "loginAsEditor": "Iniciar sesión como Editor",
    "loggedInAs": "Conectado como",
    "noEditsYet": "Aún no hay ediciones",
    "activeEdits": "Ediciones Activas",
    "undo": "Deshacer",
    "confirmRollback": "¿Estás seguro de que quieres revertir esta edición?\n\nEsto restaurará el contenido anterior.",
    "editRolledBack": "Edición revertida",
    "contentRestored": "Tu contenido anterior ha sido restaurado",
    "rollbackRecorded": "Reversión registrada",
    "rollbackRecordedDesc": "La reversión fue registrada pero la restauración del contenido requiere intervención manual",
    "reason": "Razón"
  },
  de: {
    "loginToViewEditHistory": "Melden Sie sich an, um Ihren Bearbeitungsverlauf anzuzeigen und zu verwalten",
    "loginAsEditor": "Als Editor anmelden",
    "loggedInAs": "Angemeldet als",
    "noEditsYet": "Noch keine Bearbeitungen",
    "activeEdits": "Aktive Bearbeitungen",
    "undo": "Rückgängig",
    "confirmRollback": "Sind Sie sicher, dass Sie diese Bearbeitung rückgängig machen möchten?\n\nDies wird den vorherigen Inhalt wiederherstellen.",
    "editRolledBack": "Bearbeitung rückgängig gemacht",
    "contentRestored": "Ihr vorheriger Inhalt wurde wiederhergestellt",
    "rollbackRecorded": "Rückgängigmachen aufgezeichnet",
    "rollbackRecordedDesc": "Das Rückgängigmachen wurde aufgezeichnet, aber die Inhaltswiederherstellung erfordert manuelles Eingreifen",
    "reason": "Grund"
  },
  fr: {
    "loginToViewEditHistory": "Connectez-vous pour voir et gérer votre historique de modifications",
    "loginAsEditor": "Se connecter en tant qu'Éditeur",
    "loggedInAs": "Connecté en tant que",
    "noEditsYet": "Aucune modification pour l'instant",
    "activeEdits": "Modifications Actives",
    "undo": "Annuler",
    "confirmRollback": "Êtes-vous sûr de vouloir annuler cette modification ?\n\nCela restaurera le contenu précédent.",
    "editRolledBack": "Modification annulée",
    "contentRestored": "Votre contenu précédent a été restauré",
    "rollbackRecorded": "Annulation enregistrée",
    "rollbackRecordedDesc": "L'annulation a été enregistrée mais la restauration du contenu nécessite une intervention manuelle",
    "reason": "Raison"
  },
  pl: {
    "loginToViewEditHistory": "Zaloguj się, aby zobaczyć i zarządzać historią edycji",
    "loginAsEditor": "Zaloguj jako Edytor",
    "loggedInAs": "Zalogowany jako",
    "noEditsYet": "Brak edycji",
    "activeEdits": "Aktywne Edycje",
    "undo": "Cofnij",
    "confirmRollback": "Czy na pewno chcesz cofnąć tę edycję?\n\nTo przywróci poprzednią zawartość.",
    "editRolledBack": "Edycja cofnięta",
    "contentRestored": "Twoja poprzednia zawartość została przywrócona",
    "rollbackRecorded": "Cofnięcie zapisane",
    "rollbackRecordedDesc": "Cofnięcie zostało zapisane, ale przywrócenie zawartości wymaga ręcznej interwencji",
    "reason": "Powód"
  }
};

console.log('🔧 Добавление переводов для панели истории редактирования...\n');

// Добавляем переводы в каждый файл локализации
Object.keys(editHistoryTranslations).forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const currentContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let addedCount = 0;
  Object.keys(editHistoryTranslations[lang]).forEach(key => {
    if (!currentContent[key]) {
      currentContent[key] = editHistoryTranslations[lang][key];
      addedCount++;
    }
  });

  if (addedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(currentContent, null, 2) + '\n');
    console.log(`✅ ${lang.toUpperCase()}: добавлено ${addedCount} переводов для панели истории редактирования`);
  } else {
    console.log(`✅ ${lang.toUpperCase()}: все переводы уже присутствуют`);
  }
});

console.log('\n📊 Финальная проверка...\n');

// Проверяем, что все переводы добавлены
Object.keys(editHistoryTranslations).forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const checks = [
    'loginToViewEditHistory',
    'loginAsEditor',
    'loggedInAs',
    'noEditsYet',
    'activeEdits',
    'undo',
    'confirmRollback',
    'editRolledBack',
    'contentRestored',
    'rollbackRecorded',
    'rollbackRecordedDesc',
    'reason'
  ];

  let foundCount = 0;
  checks.forEach(key => {
    if (content[key]) {
      foundCount++;
    }
  });

  console.log(`${lang.toUpperCase()}: ${foundCount}/${checks.length} переводов для панели истории редактирования найдены`);
});

console.log('\n🎉 Переводы для панели истории редактирования добавлены!');
