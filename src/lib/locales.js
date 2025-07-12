import ru from './locales/ru.json';
import es from './locales/es.json';
import en from './locales/en.json';

const locales = { ru, es, en };

export const getLocaleString = (key, lang, params = {}) => {
  let currentLang = lang || 'ru'; 
  if (!locales[currentLang]) {
    console.warn(`Language pack for '${currentLang}' not found. Falling back to 'ru'.`);
    currentLang = 'ru';
  }
  
  let str = locales[currentLang]?.[key] || locales.ru[key]; 

  if (str === undefined) {
    console.warn(`Localization key '${key}' not found for language '${currentLang}' or fallback 'ru'. Returning key itself.`);
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
  let currentLang = lang || 'ru';
  if (!locales[currentLang]) {
    console.warn(`Language pack for '${currentLang}' not found for pluralization. Falling back to 'ru'.`);
    currentLang = 'ru';
  }
  
  let key;
  if (currentLang === 'ru') {
    if (count === 1) {
      key = `${keyBase}_one`;
    } else if (count > 1 && count < 5) {
      key = `${keyBase}_few`;
    } else {
      key = `${keyBase}_many`;
    }
  } else if (currentLang === 'es' || currentLang === 'en') {
    if (count === 1) {
      key = `${keyBase}_one`;
    } else {
      key = `${keyBase}_many`; 
    }
  } else { 
    key = (count === 1) ? `${keyBase}_one` : `${keyBase}_many`;
  }
  
  let str = locales[currentLang]?.[key] || locales.ru[key];
  
  if (str === undefined) {
     console.warn(`Pluralization key '${key}' (base: '${keyBase}') not found for lang '${currentLang}'. Falling back to base key or key itself.`);
     str = locales[currentLang]?.[keyBase] || locales.ru[keyBase] || keyBase;
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