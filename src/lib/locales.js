import ru from './locales/ru.json';
import es from './locales/es.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import pl from './locales/pl.json';

const locales = { ru, es, en, de, fr, pl };

export const getLocaleString = (key, lang, params = {}) => {
  let currentLang = lang || 'en'; // Изменяем дефолт на английский
  if (!locales[currentLang]) {
    console.warn(`Language pack for '${currentLang}' not found. Falling back to 'en'.`);
    currentLang = 'en';
  }

  let str = locales[currentLang]?.[key] || locales.en[key];

  if (str === undefined) {
    console.warn(`Localization key '${key}' not found for language '${currentLang}' or fallback 'en'. Returning key itself.`);
    str = key;
  }

  if (params && typeof str === 'string') {
    Object.keys(params).forEach(paramKey => {
      str = str.replace(`{${paramKey}}`, params[paramKey]);
    });
  }
  return str;
};

export const getPluralizedLocaleString = (keyBase, lang, count, params = {}) => {
  let currentLang = lang || 'en';
  if (!locales[currentLang]) {
    console.warn(`Language pack for '${currentLang}' not found for pluralization. Falling back to 'en'.`);
    currentLang = 'en';
  }
  
  let key;
  if (currentLang === 'ru') {
    // Russian pluralization: 1, 2-4, 5+
    if (count === 1) {
      key = `${keyBase}_one`;
    } else if (count > 1 && count < 5) {
      key = `${keyBase}_few`;
    } else {
      key = `${keyBase}_many`;
    }
  } else if (currentLang === 'pl') {
    // Polish pluralization: 1, 2-4 (not ending in 12-14), 5+
    if (count === 1) {
      key = `${keyBase}_one`;
    } else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
      key = `${keyBase}_few`;
    } else {
      key = `${keyBase}_many`;
    }
  } else if (currentLang === 'es' || currentLang === 'en' || currentLang === 'de' || currentLang === 'fr') {
    // Spanish, English, German, French: simple 1 vs many
    if (count === 1) {
      key = `${keyBase}_one`;
    } else {
      key = `${keyBase}_many`; 
    }
  } else { 
    // Default fallback
    key = (count === 1) ? `${keyBase}_one` : `${keyBase}_many`;
  }
  
  let str = locales[currentLang]?.[key] || locales.en[key];

  if (str === undefined) {
     console.warn(`Pluralization key '${key}' (base: '${keyBase}') not found for lang '${currentLang}'. Falling back to base key or key itself.`);
     str = locales[currentLang]?.[keyBase] || locales.en[keyBase] || keyBase;
  }


  if (params && typeof str === 'string') {
    Object.keys(params).forEach(paramKey => {
      str = str.replace(`{${paramKey}}`, params[paramKey]);
    });
  }
  if (typeof str === 'string') {
    str = str.replace(`{count}`, String(count)); 
  }
  return str;
};