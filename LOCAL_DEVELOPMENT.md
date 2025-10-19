# Local Development Guide - Hostinger Integration

## 🚀 Быстрый старт (локально)

### ✅ Готово:
- [x] `.env` - backend переменные для API endpoints
- [x] `.env.local` - frontend переменные для браузера
- [x] Все файлы созданы и готовы

### 🏃 Запуск (всё готово, просто запусти):

```bash
npm run dev
```

Приложение откроется на **http://localhost:5173**

---

## 🧪 Тестирование локально

### Тест 1: Новая загрузка на Hostinger ✅

1. **Откройте приложение** на http://localhost:5173
2. **Перейдите** на страницу **Upload** (загрузка)
3. **Загрузите** новый MP3 файл
4. **Откройте DevTools** (нажми **F12**)
5. **Посмотри вкладку Network:**
   - Должен быть запрос `POST /api/hostinger-upload`
   - Статус должен быть `200` или `201`
6. **Посмотри вкладку Console:**
   - Не должно быть ошибок `ssh2` или `crypto`
   - Должны быть логи: `[Hostinger Upload] filename: Upload successful`

**Результат:** Файл загружен на Hostinger ✅

---

### Тест 2: Миграция старых файлов ✅

1. **Перейди** на страницу **/migration**
2. **Нажми Refresh** - должны загрузиться эпизоды
3. **Посмотри статус:**
   - Total Episodes: (сколько всего)
   - On Hostinger: (новые файлы)
   - Still on R2: (старые файлы)
4. **Выбери** 1-2 эпизода для теста
5. **Нажми Start Migration**
6. **Смотри прогресс:**
   - Должно показывать текущий файл
   - Должна быть прогресс-полоска
7. **Проверь результаты** после завершения

**Результат:** Файлы мигрированы с R2 на Hostinger ✅

---

### Тест 3: Проверка в консоли браузера 🔍

Открой **DevTools** (F12) → **Console** и выполни:

```javascript
// Проверь что все API доступны
fetch('/api/hostinger-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileName: 'test.mp3' })
})
.then(r => r.json())
.then(d => console.log('✅ API работает:', d))
.catch(e => console.error('❌ Ошибка:', e))
```

**Результат:** Должен вывести `✅ API работает`

---

## 📁 Структура файлов

```
DosMundosPodcast/
├── .env                          ← Backend переменные (для API)
├── .env.local                    ← Frontend переменные (для браузера)
├── api/
│   ├── hostinger-upload.js       ← POST /api/hostinger-upload
│   ├── hostinger-delete.js       ← POST /api/hostinger-delete
│   ├── hostinger-check.js        ← POST /api/hostinger-check
│   └── hostinger-migrate.js      ← POST /api/hostinger-migrate
└── src/
    ├── lib/
    │   ├── hostingerSFTPService.js
    │   ├── storageRouter.js
    │   └── migrationService.js
    └── pages/
        └── StorageMigrationPage.jsx
```

---

## 🔧 Команды

### Запуск dev сервера:
```bash
npm run dev
```
Приложение будет на **http://localhost:5173**

### Запуск с логированием:
```bash
npm run dev -- --log request
```

### Проверить что API работают:
```bash
# В отдельном терминале, во время работы npm run dev
curl http://localhost:3000/api/hostinger-check -X POST \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp3"}'
```

---

## ⚠️ Важно для локального тестирования

### Переменные окружения:
- `.env` - автоматически загружается Vite для backend API
- `.env.local` - автоматически загружается Vite для frontend

### Если API не работает:
1. **Проверь что оба файла существуют:**
   ```bash
   ls .env .env.local
   ```
2. **Перезагрузи сервер:**
   ```bash
   # Ctrl+C чтобы остановить
   npm run dev # запусти заново
   ```
3. **Очисти браузер кэш:** Ctrl+Shift+Delete

### Если видишь ошибку о crypto:
- ❌ **НЕПРАВИЛЬНО:** ssh2 используется в браузере
- ✅ **ПРАВИЛЬНО:** ssh2 должен использоваться только в `/api/` файлах

Если видишь такую ошибку, то:
1. Проверь что используется **обновленный** `hostingerSFTPService.js`
2. Все операции должны идти через `/api/hostinger-*` endpoints

---

## 🎯 Полный flow тестирования локально

### 1️⃣ Подготовка (2 минуты)
```bash
cd C:\Users\alexb\OneDrive\Desktop\App\DosMundosPodcast
npm run dev
```

### 2️⃣ Открыть приложение (1 минута)
- Открой http://localhost:5173 в браузере
- Проверь что приложение загружается

### 3️⃣ Тест новой загрузки (5 минут)
- Перейди на Upload страницу
- Загрузи новый MP3 файл
- Смотри что происходит в Network tab DevTools
- Должен быть запрос к `/api/hostinger-upload`

### 4️⃣ Проверить БД (2 минуты)
- Открой Supabase Dashboard
- Таблица `episodes` → проверь что новый файл имеет `storage_provider='hostinger'`

### 5️⃣ Тест миграции (10 минут)
- Перейди на `/migration`
- Выбери эпизод с `storage_provider='r2'`
- Нажми Start Migration
- Дождись завершения
- Проверь что файл теперь на Hostinger

---

## 🚨 Troubleshooting

### Error: "ECONNREFUSED" при подключении к API
**Решение:**
```bash
# Убедись что сервер запущен
npm run dev

# Если не помогло, очисти и переустанови зависимости
rm -r node_modules package-lock.json
npm install
npm run dev
```

### Error: "Cannot find module 'ssh2'"
**Решение:**
```bash
npm install ssh2
npm run dev
```

### Error: "crypto is not available"
**Решение:**
- Это означает что ssh2 используется в браузере (НЕПРАВИЛЬНО)
- Проверь что `hostingerSFTPService.js` вызывает `/api/` endpoints
- Все SFTP операции должны быть на backend

### Файл не загружается на Hostinger
**Решение:**
1. Открой DevTools → Network tab
2. Посмотри запрос к `/api/hostinger-upload`
3. Нажми на него и посмотри Response
4. Там будет ошибка от сервера или Hostinger
5. Проверь логи: `npm run dev` выведет ошибки в консоль

### "Cannot read property 'status' of undefined"
**Решение:**
- Файлы `.env` и `.env.local` должны быть в корне проекта
- Проверь что они существуют:
  ```bash
  type .env
  type .env.local
  ```

---

## 📞 Быстрая помощь

| Проблема | Решение |
|----------|---------|
| Нет Network запросов | Перезагрузи `npm run dev` |
| 404 на `/api/hostinger-*` | Проверь что файлы в папке `api/` существуют |
| 500 ошибка от API | Проверь переменные в `.env` |
| ssh2 ошибка в браузере | Используй обновленный `hostingerSFTPService.js` |
| БД не обновляется | Проверь что миграция SQL применена в Supabase |

---

## ✅ Когда всё работает локально:

- ✅ Новые файлы загружаются на Hostinger
- ✅ API endpoints отвечают 200 OK
- ✅ На `/migration` видно файлы
- ✅ Миграция работает и обновляет БД
- ✅ Нет ошибок в консоли

**Тогда готово к деплою на Vercel!** 🚀

---

**Дата:** October 19, 2025
**Статус:** ✅ Ready for Local Testing
