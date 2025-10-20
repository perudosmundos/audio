# 🌍 Система локализации (i18n) - Руководство пользователя

## ✅ Статус системы

**Все 6 языков полностью интегрированы и готовы к использованию!**

| Язык | Код | Статус | Ключей | Размер |
|------|-----|--------|--------|--------|
| 🇷🇺 Русский | `ru` | ✅ 100% | 658 | 52 KB |
| 🇬🇧 Английский | `en` | ✅ 100% | 658 | 46 KB |
| 🇪🇸 Испанский | `es` | ✅ 100% | 658 | 50 KB |
| 🇩🇪 Немецкий | `de` | ✅ 100% | 658 | 48 KB |
| 🇫🇷 Французский | `fr` | ✅ 100% | 658 | 50 KB |
| 🇵🇱 Польский | `pl` | ✅ 100% | 658 | 44 KB |

## 🎯 Основные возможности

### 1. Переключение языков
Пользователи могут переключать язык через:
- **Модальное окно выбора** при первом запуске приложения
- **Меню настроек** (Settings → Language)
- **Футер-панель** с флагами языков

### 2. Правильная плюрализация
Система автоматически выбирает правильную форму:

```javascript
// Примеры для разных языков
getPluralizedLocaleString('questionCount', 'ru', 1)  // "1 вопрос"
getPluralizedLocaleString('questionCount', 'ru', 2)  // "2 вопроса"
getPluralizedLocaleString('questionCount', 'ru', 5)  // "5 вопросов"

getPluralizedLocaleString('questionCount', 'en', 1)  // "1 question"
getPluralizedLocaleString('questionCount', 'en', 2)  // "2 questions"
```

### 3. Параметризованные строки
Вставка переменных в текст:

```javascript
getLocaleString('failedToLoadPodcastData', 'en', {
  errorMessage: 'Network timeout'
})
// Результат: "Failed to load podcast data: Network timeout. Please try again later."
```

## 📖 Использование в коде

### Импорт функций
```javascript
import { getLocaleString, getPluralizedLocaleString } from '@/lib/locales';
```

### Получение простой строки
```jsx
<h1>{getLocaleString('appName', currentLanguage)}</h1>
```

### С параметрами
```jsx
<p>{getLocaleString('errorUploadingFile', currentLanguage, { 
  fileName: 'podcast.mp3' 
})}</p>
```

### Плюрализация
```jsx
<span>{getPluralizedLocaleString('episodes', currentLanguage, episodeCount)}</span>
```

### С параметрами + плюрализация
```jsx
<p>{getPluralizedLocaleString('questionsLoadedFromDB', currentLanguage, count, {
  count: count,
  itemName: 'questions'
})}</p>
```

## 🔧 Структура файлов

### JSON формат
```json
{
  "appName": "DM Podcasts",
  "loading": "Loading...",
  "episodeTitle": "Episode title",
  "questionCount_one": "{count} question",
  "questionCount_few": "{count} questions",
  "questionCount_many": "{count} questions",
  "failedToLoadData": "Failed to load data: {errorMessage}"
}
```

### Правила именования ключей
- **Простые**: `loading`, `save`, `cancel`
- **С параметрами**: `{ключ}_{параметр}` → `failedToLoadData`
- **Плюрализация**: `{ключ}_{форма}` → `questionCount_one`, `questionCount_many`

## 🌐 Компоненты с локализацией

### Основные компоненты
- ✅ Header (заголовок)
- ✅ Navigation (навигация)
- ✅ Settings (настройки)
- ✅ Theme Settings (темы)
- ✅ Language Switcher (переключатель языков)

### Функциональные компоненты
- ✅ Upload Manager (загрузка)
- ✅ Episode Manager (управление эпизодами)
- ✅ Transcript Editor (редактор транскрипта)
- ✅ Player (плеер)
- ✅ Questions (вопросы)

### Сложные компоненты
- ✅ Offline Sync (офлайн синхронизация)
- ✅ Cache Management (управление кешем)
- ✅ Search & Deep Search (поиск)
- ✅ Migrations (миграции)
- ✅ Spotify Integration (Spotify интеграция)

## 📝 Добавление новых ключей

### Шаг 1: Добавить в ru.json
```json
{
  "myNewKey": "Мой новый текст"
}
```

### Шаг 2: Запустить синхронизацию
```bash
npm run sync-locales
# или
node src/scripts/fix-all-locales.js
```

### Шаг 3: Переводы будут автоматически добавлены
- Система скопирует ключ во все файлы
- Вы получите уведомление о необходимости перевода

### Шаг 4: Добавить переводы
```json
{
  "myNewKey": "My new text"  // English
  "myNewKey": "Mi nuevo texto"  // Spanish
  // и т.д.
}
```

## ⚙️ Конфигурация

### Добавить новый язык

1. Создать файл `src/lib/locales/xx.json` (xx - код языка)
2. Добавить в `src/lib/locales.js`:
```javascript
import xx from './locales/xx.json';
const locales = { ru, es, en, de, fr, pl, xx };
```

3. Добавить в `src/components/LanguageSelectionModal.jsx`:
```javascript
{ code: 'xx', name: "Language Name", flag: '🏳️' }
```

4. Обновить правила плюрализации в `locales.js` если необходимо

## 🐛 Отладка

### Проверить все ключи
```bash
node -e "const ru = require('./src/lib/locales/ru.json'); console.log('Total keys:', Object.keys(ru).length);"
```

### Найти отсутствующие ключи
```javascript
const ru = require('./src/lib/locales/ru.json');
const en = require('./src/lib/locales/en.json');
const missing = Object.keys(ru).filter(k => !en[k]);
console.log('Missing in EN:', missing);
```

### Проверить синхронизацию
```bash
node src/scripts/fix-all-locales.js
```

## 📊 Статистика

- **Всего ключей**: 658 в каждом файле
- **Категории ключей**:
  - UI элементы: ~150 ключей
  - Сообщения об ошибках: ~80 ключей
  - Управление эпизодами: ~100 ключей
  - Транскрипция: ~100 ключей
  - Другие: ~228 ключей

## 🎨 Интеграция с UI

### Пример использования в компоненте
```jsx
import React, { useState } from 'react';
import { getLocaleString, getPluralizedLocaleString } from '@/lib/locales';

function MyComponent({ currentLanguage }) {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>{getLocaleString('appName', currentLanguage)}</h1>
      
      <button>
        {getLocaleString('save', currentLanguage)}
      </button>
      
      <p>
        {getPluralizedLocaleString('questionCount', currentLanguage, count)}
      </p>
    </div>
  );
}
```

## 🚀 Best Practices

1. **Всегда передавайте currentLanguage** - не используйте глобальные переменные
2. **Используйте ключи вместо строк** - легче переводить
3. **Группируйте связанные ключи** - используйте префиксы (error_, button_, etc.)
4. **Тестируйте плюрализацию** - проверяйте для разных чисел
5. **Предусмотрите fallback** - система автоматически вернет ключ если перевода нет

## 📞 Поддержка

Для проблем с локализацией:
1. Проверьте, что ключ существует в ru.json
2. Запустите скрипт синхронизации
3. Проверьте тип (простой, параметризованный, плюрализированный)

---

**Версия**: 1.0  
**Дата**: 2025-10-19  
**Статус**: ✅ Production Ready
