# Hostinger SFTP Integration - Setup Checklist

## ✅ Что уже сделано

- ✅ **Frontend сервисы** созданы:
  - `src/lib/hostingerSFTPService.js` - браузер API
  - `src/lib/storageRouter.js` - выбор хранилища
  - `src/lib/migrationService.js` - миграция файлов
  - `src/pages/StorageMigrationPage.jsx` - UI миграции

- ✅ **Backend API endpoints** созданы:
  - `api/hostinger-upload.js` - загрузка
  - `api/hostinger-delete.js` - удаление
  - `api/hostinger-check.js` - проверка
  - `api/hostinger-migrate.js` - миграция

- ✅ **Обновлены существующие файлы:**
  - `src/services/uploader/fileProcessor.js`
  - `src/lib/r2Service.js`
  - `src/App.jsx`
  - `src/lib/locales/*.json` (3 файла)

- ✅ **Локальная конфигурация:**
  - `.env.local` создан ✅

## 📋 Что нужно сделать (в порядке)

### Этап 1️⃣: Supabase (5 минут)

- [ ] Перейди в **Supabase Dashboard** https://supabase.com/dashboard
- [ ] Выбери проект **DosMundosPodcast**
- [ ] Перейди в **SQL Editor**
- [ ] Скопируй содержимое из `supabase/migrations/20251019_add_hostinger_columns.sql`
- [ ] Вставь в SQL Editor и нажми **Run**
- [ ] Проверь что выполнилось без ошибок

**SQL которая выполнится:**
```sql
ALTER TABLE episodes ADD COLUMN storage_provider VARCHAR(20) DEFAULT 'r2';
ALTER TABLE episodes ADD COLUMN hostinger_file_key VARCHAR(255);
CREATE INDEX idx_episodes_storage_provider ON episodes(storage_provider);
```

### Этап 2️⃣: Vercel (10 минут)

- [ ] Перейди в **Vercel Dashboard** https://vercel.com/dashboard
- [ ] Выбери проект **DosMundosPodcast**
- [ ] Нажми **Settings** (вкладка сверху)
- [ ] В левом меню найди **Environment Variables**
- [ ] Добавь 6 переменных (инструкция в `VERCEL_ENV_SETUP.md`):

```
HOSTINGER_SFTP_HOST=82.25.67.168
HOSTINGER_SFTP_PORT=21
HOSTINGER_SFTP_USERNAME=u953185577
HOSTINGER_SFTP_PASSWORD=Ftppass!123
HOSTINGER_SFTP_UPLOAD_PATH=/public_html/wp-content/uploads/Audio/
HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
```

- [ ] После добавления нажми **Save**
- [ ] Дождись автоматического перепродеплоя (Vercel уведомит)

### Этаж 3️⃣: Локальное тестирование (15 минут)

- [ ] Создай `.env` файл в корне проекта с теми же 6 переменными (см. `VERCEL_ENV_SETUP.md`)
- [ ] Запусти локальный сервер:
  ```bash
  npm run dev
  ```
- [ ] Открой приложение на http://localhost:5173
- [ ] Попробуй загрузить новый аудиофайл (в Upload странице)
- [ ] Проверь в браузере Console (F12 → Console):
  - Должны быть запросы к `/api/hostinger-upload`
  - Не должно быть ошибок о `ssh2` или `crypto`
- [ ] Проверь что файл загрузился (статус должен быть "Готово")

### Этап 4️⃣: Миграция старых файлов (опционально)

- [ ] Перейди на страницу `/migration`
- [ ] Нажми **Refresh** - должны загрузиться эпизоды
- [ ] Проверь статус миграции (сколько файлов на R2, сколько на Hostinger)
- [ ] Выбери несколько эпизодов для тестовой миграции
- [ ] Нажми **Start Migration**
- [ ] Дождись завершения
- [ ] Проверь что файлы воспроизводятся в плеере

## 🧪 Проверочные тесты

### Тест 1: Новая загрузка
- [ ] Загрузи новый аудиофайл через Upload страницу
- [ ] Проверь что он сохранился с `storage_provider='hostinger'`
- [ ] Проверь что файл доступен по URL: `https://dosmundos.pe/wp-content/uploads/Audio/filename.mp3`

### Тест 2: Миграция
- [ ] На странице `/migration` выбери старый файл (с `storage_provider='r2'`)
- [ ] Запусти миграцию
- [ ] Проверь что он переместился на Hostinger
- [ ] Проверь что воспроизведение работает

### Тест 3: Удаление
- [ ] Удали эпизод из приложения
- [ ] Проверь что:
  - Если это был Hostinger файл → удалится с Hostinger
  - Если это был R2 файл → удалится с R2
  - БД обновилась

## 📊 Статусы деплоя

### После Supabase миграции:
```
✅ episodes таблица имеет 2 новых столбца
✅ Индекс создан для быстрого поиска
```

### После добавления Vercel переменных:
```
✅ Vercel перепродеплоится автоматически
✅ API endpoints получат доступ к SFTP credentials
✅ /api/hostinger-* endpoints готовы работать
```

### После локального тестирования:
```
✅ Новые загрузки идут на Hostinger
✅ API вызывы работают правильно
✅ Нет ошибок в консоли
✅ Файлы доступны публично
```

## 🔧 Troubleshooting

### "Cannot connect to Hostinger"
- [ ] Проверь что переменные добавлены в Vercel
- [ ] Проверь что пароль правильный: `Ftppass!123`
- [ ] Проверь что SFTP port 21 открыт

### "Files not uploading"
- [ ] Проверь что .env.local существует
- [ ] Проверь что VITE_HOSTINGER_PUBLIC_URL правильный
- [ ] Открой DevTools (F12) и посмотри на Network вкладку

### "API returns 500"
- [ ] Проверь Vercel logs: `vercel logs --tail`
- [ ] Проверь что все 6 переменных добавлены
- [ ] Перезагрузи Vercel dashboard

## 📞 Support

Полная документация:
- 📖 `HOSTINGER_SETUP.md` - общая информация и архитектура
- 📖 `VERCEL_ENV_SETUP.md` - инструкция для Vercel
- 📖 `SETUP_CHECKLIST.md` - этот файл

## ✨ После завершения

Когда все будет готово:
- ✅ Новые файлы автоматически идут на Hostinger
- ✅ Старые файлы остаются на R2
- ✅ Мигрировать файлы можно через `/migration` страницу
- ✅ Всё работает автоматически в production

---

**Начало:** October 19, 2025
**Статус:** 🚀 Ready for Deployment
**Время на setup:** ~30 минут
