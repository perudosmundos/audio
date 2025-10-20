# 🚀 Чеклист для запуска системы истории правок

## ✅ Что нужно сделать ОБЯЗАТЕЛЬНО

### 1. Применить миграцию базы данных
```bash
# В Supabase Dashboard → SQL Editor
# Выполните файл:
supabase/migrations/20251019_create_edit_history_system.sql
```

**Или скопируйте и выполните SQL:**
1. Откройте `supabase/migrations/20251019_create_edit_history_system.sql`
2. Скопируйте весь код
3. Вставьте в SQL Editor в Supabase
4. Нажмите Run

### 2. Отключить RLS (для разработки)
```bash
# В Supabase Dashboard → SQL Editor
# Выполните файл:
supabase/migrations/20251019_setup_rls_policies.sql
```

Это отключит Row Level Security для таблиц, что упростит разработку.

### 3. Перезапустить dev сервер
```bash
# Остановите текущий сервер (Ctrl+C)
npm run dev
```

## 🧪 Тестирование системы

### Метод 1: Через встроенный тестер (РЕКОМЕНДУЕТСЯ)

1. Откройте приложение в браузере
2. Откройте Settings (кнопка внизу справа)
3. Перейдите на вкладку "Edit History"
4. Нажмите "Login as Editor"
5. Введите:
   - Email: `test@example.com`
   - Name: `Test User`
6. Перейдите на вкладку "Test System"
7. Нажмите "Run Tests"
8. Проверьте результаты

### Метод 2: Через реальное редактирование

1. Авторизуйтесь (шаги 1-5 выше)
2. Включите режим редактирования (если есть)
3. Измените любой текст
4. Сохраните
5. Откройте F12 → Console
6. Проверьте логи:
   ```
   [EnhancedEditMode] Saving edit to history
   [EnhancedEditMode] Edit saved to history successfully
   ```

### Метод 3: Через админ-панель

1. Перейдите на `/edit`
2. Авторизуйтесь
3. Вы должны увидеть список всех правок

## 🔍 Проверка результатов

### В консоли браузера (F12 → Console)
Должны быть логи:
```
[EnhancedEditMode] Initializing...
[EnhancedEditMode] Initialized successfully
[EnhancedEditMode] Saving edit to history: {...}
[EnhancedEditMode] Inserting into edit_history: {...}
[EnhancedEditMode] Edit saved to history successfully: {...}
```

### В Supabase Dashboard
1. Table Editor → `edit_history`
2. Должны быть записи с вашими правками
3. Проверьте поля:
   - `editor_email` = ваш email
   - `content_before` = старый текст
   - `content_after` = новый текст

### В приложении
1. Settings → Edit History - ваши правки
2. `/edit` - все правки системы

## ❌ Если не работает

### Проблема: "No authenticated editor"
```bash
# Решение:
1. Авторизуйтесь снова через Settings
2. Проверьте в консоли:
localStorage.getItem('editor_auth')
# Должен вернуть JSON с вашими данными
```

### Проблема: "Error saving edit to history"
```sql
-- Проверьте в Supabase SQL Editor:
SELECT * FROM user_editors;
SELECT * FROM edit_history;

-- Если таблиц нет - примените миграцию
-- Если есть ошибки прав - отключите RLS:
ALTER TABLE user_editors DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_history DISABLE ROW LEVEL SECURITY;
```

### Проблема: "Permission denied"
```sql
-- Выполните в Supabase:
ALTER TABLE user_editors DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_history DISABLE ROW LEVEL SECURITY;
```

### Проблема: Ничего не происходит
```bash
# 1. Очистите кэш браузера
# 2. Hard refresh (Ctrl+Shift+R)
# 3. Перезапустите dev сервер:
npm run dev
# 4. Проверьте консоль на ошибки
```

## 📊 SQL для проверки

```sql
-- 1. Проверить, что таблицы созданы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_editors', 'edit_history');

-- 2. Посмотреть всех редакторов
SELECT * FROM user_editors ORDER BY created_at DESC;

-- 3. Посмотреть все правки
SELECT 
  id,
  editor_name,
  editor_email,
  edit_type,
  target_id,
  content_before,
  content_after,
  created_at
FROM edit_history
ORDER BY created_at DESC
LIMIT 10;

-- 4. Создать тестового редактора вручную
SELECT get_or_create_editor('test@example.com', 'Test User');
```

## 📝 Полный процесс от начала до конца

1. ✅ Применить миграцию → `20251019_create_edit_history_system.sql`
2. ✅ Отключить RLS → `20251019_setup_rls_policies.sql`
3. ✅ Перезапустить `npm run dev`
4. ✅ Открыть приложение
5. ✅ Settings → Edit History → Login
6. ✅ Settings → Test System → Run Tests
7. ✅ Проверить консоль браузера
8. ✅ Проверить Supabase → edit_history
9. ✅ Открыть `/edit` → увидеть правки

## 🎯 Готово!

Если все 9 шагов выполнены успешно - система работает! 🎉

Теперь можно:
- Редактировать текст (с отслеживанием)
- Смотреть историю в Settings
- Управлять всеми правками в `/edit`
- Откатывать неправильные изменения

## 📞 Нужна помощь?

Если не работает после всех шагов, пришлите:
1. Скриншот консоли браузера (F12)
2. Скриншот Supabase → edit_history table
3. Результат SQL запроса:
```sql
SELECT * FROM edit_history ORDER BY created_at DESC LIMIT 1;
```
