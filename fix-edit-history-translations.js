#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, 'src/lib/locales');

// Правильные переводы для истории редактирования
const editHistoryTranslations = {
  en: {
    "editHistoryTitle": "Edit History",
    "rolledBack": "Rolled Back",
    "errorLoadingHistory": "Error loading history",
    "errorRollback": "Error rolling back",
    "rollbackSuccessful": "Rollback successful",
    "rollbackFailed": "Rollback failed",
    "editType": "Edit Type",
    "targetType": "Target Type",
    "rolledBackBy": "Rolled back by",
    "unknownUser": "Unknown user",
    "showRolledBackEdits": "Show rolled back edits",
    "editHistoryAdmin": "Edit History Admin",
    "editHistoryCount": "Edit History ({count} edits)",
    "backButton": "Back",
    "actionReverted": "Action reverted",
    "revertButton": "Revert",
    "revertFailed": "Revert failed",
    "revertSuccessful": "Revert successful",
    "revertDescription": "Revert this change?",
    "beforeLabel": "Before",
    "afterLabel": "After",
    "revertedAtLabel": "Reverted at {date}",
    "editRevertedTitle": "Edit Reverted",
    "editRevertedDesc": "The edit has been reverted successfully",
    "nothingToRevert": "Nothing to revert",
    "editHistory": "Edit History",
    "editLogPageTitle": "Edit History",
    "errorFetchingLogs": "Error fetching edit logs",
    "noEditHistory": "No edit history available"
  },
  es: {
    "editHistoryTitle": "Historial de edición",
    "rolledBack": "Revertido",
    "errorLoadingHistory": "Error al cargar el historial",
    "errorRollback": "Error al revertir",
    "rollbackSuccessful": "Reversión exitosa",
    "rollbackFailed": "No se pudo revertir",
    "editType": "Tipo de edición",
    "targetType": "Tipo de objetivo",
    "rolledBackBy": "Revertido por",
    "unknownUser": "Usuario desconocido",
    "showRolledBackEdits": "Mostrar ediciones revertidas",
    "editHistoryAdmin": "Administración del historial de edición",
    "editHistoryCount": "Historial de edición ({count} ediciones)",
    "backButton": "Atrás",
    "actionReverted": "Acción revertida",
    "revertButton": "Revertir",
    "revertFailed": "Error al revertir",
    "revertSuccessful": "Reversión exitosa",
    "revertDescription": "¿Revertir este cambio?",
    "beforeLabel": "Antes",
    "afterLabel": "Después",
    "revertedAtLabel": "Revertido el {date}",
    "editRevertedTitle": "Edición Revertida",
    "editRevertedDesc": "La edición ha sido revertida exitosamente",
    "nothingToRevert": "Nada que revertir",
    "editHistory": "Historial de edición",
    "editLogPageTitle": "Historial de Cambios",
    "errorFetchingLogs": "Error al cargar los registros",
    "noEditHistory": "No se encontró historial de cambios"
  },
  de: {
    "editHistoryTitle": "Bearbeitungsverlauf",
    "rolledBack": "Rückgängig gemacht",
    "errorLoadingHistory": "Fehler beim Laden des Verlaufs",
    "errorRollback": "Fehler beim Rückgängigmachen",
    "rollbackSuccessful": "Rückgängigmachen erfolgreich",
    "rollbackFailed": "Rückgängigmachen fehlgeschlagen",
    "editType": "Bearbeitungstyp",
    "targetType": "Zieltyp",
    "rolledBackBy": "Rückgängig gemacht von",
    "unknownUser": "Unbekannter Benutzer",
    "showRolledBackEdits": "Rückgängig gemachte Bearbeitungen anzeigen",
    "editHistoryAdmin": "Bearbeitungsverlauf-Verwaltung",
    "editHistoryCount": "Bearbeitungsverlauf ({count} Bearbeitungen)",
    "backButton": "Zurück",
    "actionReverted": "Aktion rückgängig gemacht",
    "revertButton": "Rückgängig machen",
    "revertFailed": "Rückgängigmachen fehlgeschlagen",
    "revertSuccessful": "Rückgängigmachen erfolgreich",
    "revertDescription": "Diese Änderung rückgängig machen?",
    "beforeLabel": "Vorher",
    "afterLabel": "Nachher",
    "revertedAtLabel": "Rückgängig gemacht am {date}",
    "editRevertedTitle": "Bearbeitung Rückgängig Gemacht",
    "editRevertedDesc": "Die Bearbeitung wurde erfolgreich rückgängig gemacht",
    "nothingToRevert": "Nichts zu rückgängig machen",
    "editHistory": "Bearbeitungsverlauf",
    "editLogPageTitle": "Bearbeitungsverlauf",
    "errorFetchingLogs": "Fehler beim Laden der Bearbeitungsprotokolle",
    "noEditHistory": "Kein Bearbeitungsverlauf verfügbar"
  },
  fr: {
    "editHistoryTitle": "Historique des modifications",
    "rolledBack": "Annulé",
    "errorLoadingHistory": "Erreur lors du chargement de l'historique",
    "errorRollback": "Erreur lors de l'annulation",
    "rollbackSuccessful": "Annulation réussie",
    "rollbackFailed": "Échec de l'annulation",
    "editType": "Type de modification",
    "targetType": "Type de cible",
    "rolledBackBy": "Annulé par",
    "unknownUser": "Utilisateur inconnu",
    "showRolledBackEdits": "Afficher les modifications annulées",
    "editHistoryAdmin": "Administration de l'historique des modifications",
    "editHistoryCount": "Historique des modifications ({count} modifications)",
    "backButton": "Retour",
    "actionReverted": "Action annulée",
    "revertButton": "Annuler",
    "revertFailed": "Échec de l'annulation",
    "revertSuccessful": "Annulation réussie",
    "revertDescription": "Annuler cette modification ?",
    "beforeLabel": "Avant",
    "afterLabel": "Après",
    "revertedAtLabel": "Annulé le {date}",
    "editRevertedTitle": "Modification Annulée",
    "editRevertedDesc": "La modification a été annulée avec succès",
    "nothingToRevert": "Rien à annuler",
    "editHistory": "Historique des modifications",
    "editLogPageTitle": "Historique des modifications",
    "errorFetchingLogs": "Erreur lors du chargement des journaux de modification",
    "noEditHistory": "Aucun historique de modification disponible"
  },
  pl: {
    "editHistoryTitle": "Historia edycji",
    "rolledBack": "Cofnięto",
    "errorLoadingHistory": "Błąd ładowania historii",
    "errorRollback": "Błąd cofania",
    "rollbackSuccessful": "Cofnięcie udane",
    "rollbackFailed": "Nie udało się cofnąć",
    "editType": "Typ edycji",
    "targetType": "Typ celu",
    "rolledBackBy": "Cofnięto przez",
    "unknownUser": "Nieznany użytkownik",
    "showRolledBackEdits": "Pokaż cofnięte edycje",
    "editHistoryAdmin": "Administracja historii edycji",
    "editHistoryCount": "Historia edycji ({count} edycji)",
    "backButton": "Wstecz",
    "actionReverted": "Akcja cofnięta",
    "revertButton": "Cofnij",
    "revertFailed": "Cofnięcie nie powiodło się",
    "revertSuccessful": "Cofnięcie pomyślne",
    "revertDescription": "Czy cofnąć tę zmianę?",
    "beforeLabel": "Przed",
    "afterLabel": "Po",
    "revertedAtLabel": "Cofnięto o {date}",
    "editRevertedTitle": "Edycja cofnięta",
    "editRevertedDesc": "Edycja została pomyślnie cofnięta",
    "nothingToRevert": "Nie ma nic do cofnięcia",
    "editHistory": "Historia edycji",
    "editLogPageTitle": "Historia edycji",
    "errorFetchingLogs": "Błąd pobierania dziennika edycji",
    "noEditHistory": "Historia edycji niedostępna"
  }
};

console.log('🔧 Исправление переводов истории редактирования...\n');

// Исправляем каждый файл локализации
Object.keys(editHistoryTranslations).forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const currentContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let changesCount = 0;

  // Обновляем переводы истории редактирования
  Object.keys(editHistoryTranslations[lang]).forEach(key => {
    if (currentContent[key] !== editHistoryTranslations[lang][key]) {
      currentContent[key] = editHistoryTranslations[lang][key];
      changesCount++;
    }
  });

  if (changesCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(currentContent, null, 2) + '\n');
    console.log(`✅ ${lang.toUpperCase()}: обновлено ${changesCount} переводов истории редактирования`);
  } else {
    console.log(`✅ ${lang.toUpperCase()}: переводы истории редактирования уже корректны`);
  }
});

console.log('\n📊 Финальная проверка...\n');

// Проверяем, что все переводы корректны
Object.keys(editHistoryTranslations).forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const checks = [
    { key: 'editHistoryTitle', expected: editHistoryTranslations[lang].editHistoryTitle },
    { key: 'rolledBack', expected: editHistoryTranslations[lang].rolledBack },
    { key: 'errorLoadingHistory', expected: editHistoryTranslations[lang].errorLoadingHistory },
    { key: 'rollbackSuccessful', expected: editHistoryTranslations[lang].rollbackSuccessful },
    { key: 'editType', expected: editHistoryTranslations[lang].editType },
    { key: 'targetType', expected: editHistoryTranslations[lang].targetType },
    { key: 'rolledBackBy', expected: editHistoryTranslations[lang].rolledBackBy },
    { key: 'unknownUser', expected: editHistoryTranslations[lang].unknownUser },
    { key: 'showRolledBackEdits', expected: editHistoryTranslations[lang].showRolledBackEdits },
    { key: 'editHistoryAdmin', expected: editHistoryTranslations[lang].editHistoryAdmin },
    { key: 'editHistoryCount', expected: editHistoryTranslations[lang].editHistoryCount },
    { key: 'backButton', expected: editHistoryTranslations[lang].backButton },
    { key: 'actionReverted', expected: editHistoryTranslations[lang].actionReverted },
    { key: 'revertButton', expected: editHistoryTranslations[lang].revertButton },
    { key: 'revertFailed', expected: editHistoryTranslations[lang].revertFailed },
    { key: 'revertSuccessful', expected: editHistoryTranslations[lang].revertSuccessful },
    { key: 'revertDescription', expected: editHistoryTranslations[lang].revertDescription },
    { key: 'beforeLabel', expected: editHistoryTranslations[lang].beforeLabel },
    { key: 'afterLabel', expected: editHistoryTranslations[lang].afterLabel },
    { key: 'revertedAtLabel', expected: editHistoryTranslations[lang].revertedAtLabel },
    { key: 'editRevertedTitle', expected: editHistoryTranslations[lang].editRevertedTitle },
    { key: 'editRevertedDesc', expected: editHistoryTranslations[lang].editRevertedDesc },
    { key: 'nothingToRevert', expected: editHistoryTranslations[lang].nothingToRevert },
    { key: 'editHistory', expected: editHistoryTranslations[lang].editHistory },
    { key: 'editLogPageTitle', expected: editHistoryTranslations[lang].editLogPageTitle },
    { key: 'errorFetchingLogs', expected: editHistoryTranslations[lang].errorFetchingLogs },
    { key: 'noEditHistory', expected: editHistoryTranslations[lang].noEditHistory }
  ];

  let correctCount = 0;
  checks.forEach(check => {
    if (content[check.key] === check.expected) {
      correctCount++;
    }
  });

  console.log(`${lang.toUpperCase()}: ${correctCount}/${checks.length} переводов истории редактирования корректны`);
});

console.log('\n🎉 Переводы истории редактирования исправлены!');
