# Отладка проблемы с сохранением изменений

## Проблема
Изменения не сохраняются в таблицу `edit_history` при редактировании текста.

## Что было исправлено

### 1. Добавлена интеграция в App.jsx
Файл: `src/App.jsx`
- Добавлен импорт `import '@/lib/enhancedEditMode';`
- Это автоматически инициализирует систему отслеживания изменений

### 2. Улучшен API endpoint
Файл: `plugins/visual-editor/vite-plugin-react-inline-editor.js`
- API теперь возвращает `editData` с полной информацией о правке
- Включает `contentBefore`, `contentAfter`, `filePath`, `line`, `column`

### 3. Улучшен enhancedEditMode.js
Файл: `src/lib/enhancedEditMode.js`
- Улучшена обработка данных от API
- Добавлено подробное логирование
- Исправлена логика сохранения в базу данных

## Шаги для проверки

### Шаг 1: Примените миграцию в Supabase

1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor
3. Выполните содержимое файла:
   ```
   supabase/migrations/20251019_create_edit_history_system.sql
   ```

### Шаг 2: Проверьте, что таблицы созданы

Выполните в SQL Editor:
```sql
-- Проверить таблицы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_editors', 'edit_history');
```

Или используйте готовый скрипт:
```
supabase/migrations/check_edit_history_tables.sql
```

### Шаг 3: Перезапустите dev сервер

```bash
# Остановите текущий сервер (Ctrl+C)
# Запустите заново
npm run dev
```

### Шаг 4: Откройте консоль браузера

1. Откройте приложение в браузере
2. Нажмите F12 (Developer Tools)
3. Перейдите на вкладку Console

### Шаг 5: Авторизуйтесь как редактор

1. Откройте Настройки (кнопка внизу справа)
2. Перейдите на вкладку "Edit History"
3. Нажмите "Login as Editor"
4. Введите:
   - Email: `test@example.com`
   - Name: `Test User`

### Шаг 6: Сделайте тестовую правку

1. В режиме редактирования измените любой текст
2. Сохраните изменение

### Шаг 7: Проверьте логи в консоли

В консоли браузера вы должны увидеть:
```
[EnhancedEditMode] Initializing...
[EnhancedEditMode] Initialized successfully
[EnhancedEditMode] Saving edit to history: {...}
[EnhancedEditMode] Inserting into edit_history: {...}
[EnhancedEditMode] Edit saved to history successfully: {...}
```

### Шаг 8: Проверьте базу данных

В Supabase Dashboard → Table Editor → edit_history:
- Должна появиться новая запись
- Проверьте поля `content_before` и `content_after`

### Шаг 9: Проверьте в админ панели

1. Перейдите на `/edit`
2. Авторизуйтесь (если нужно)
3. Вы должны увидеть свою правку в списке

## Возможные проблемы и решения

### Проблема 1: "No authenticated editor"
**Решение:**
- Авторизуйтесь через Settings → Edit History
- Проверьте localStorage: `localStorage.getItem('editor_auth')`

### Проблема 2: "Error saving edit to history"
**Решение:**
- Проверьте, что миграция применена
- Проверьте RLS (Row Level Security) в Supabase
- Отключите RLS для тестирования:
```sql
ALTER TABLE user_editors DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_history DISABLE ROW LEVEL SECURITY;
```

### Проблема 3: "Permission denied for table"
**Решение:**
- Проверьте права доступа к таблицам
- В Supabase Dashboard → Authentication → Policies
- Создайте политику для анонимного доступа (для разработки):
```sql
-- Разрешить всем вставку в edit_history
CREATE POLICY "Allow insert for all" ON edit_history
FOR INSERT TO anon
WITH CHECK (true);

-- Разрешить всем вставку в user_editors
CREATE POLICY "Allow insert for all" ON user_editors
FOR INSERT TO anon
WITH CHECK (true);

-- Разрешить всем чтение
CREATE POLICY "Allow select for all" ON edit_history
FOR SELECT TO anon
USING (true);

CREATE POLICY "Allow select for all" ON user_editors
FOR SELECT TO anon
USING (true);
```

### Проблема 4: Ничего не происходит
**Решение:**
1. Очистите кэш браузера
2. Проверьте Network вкладку в DevTools
3. Убедитесь, что запрос `/api/apply-edit` успешен
4. Проверьте, что `enhancedEditMode.js` загрузился

## Тестовый SQL для проверки

Выполните в Supabase SQL Editor:

```sql
-- 1. Создать тестового редактора
SELECT get_or_create_editor('test@example.com', 'Test User');

-- 2. Проверить, что он создан
SELECT * FROM user_editors WHERE email = 'test@example.com';

-- 3. Посмотреть все правки
SELECT 
  id,
  editor_name,
  editor_email,
  edit_type,
  content_before,
  content_after,
  created_at
FROM edit_history
ORDER BY created_at DESC;

-- 4. Посмотреть через view
SELECT * FROM edit_history_with_editor ORDER BY created_at DESC;
```

## Дополнительная отладка

Добавьте в консоль браузера:

```javascript
// Проверить авторизацию
JSON.parse(localStorage.getItem('editor_auth'))

// Проверить, что fetch перехвачен
console.log('Original fetch:', window.fetch.toString().includes('EnhancedEditMode'))

// Проверить Supabase подключение
const { supabase } = await import('/src/lib/supabaseClient.js');
const { data, error } = await supabase.from('user_editors').select('*');
console.log('Editors:', data, error);

// Проверить, что таблица существует
const { data: tables, error: tablesError } = await supabase
  .from('edit_history')
  .select('*')
  .limit(1);
console.log('Edit history check:', tables, tablesError);
```

## Логи для отправки

Если проблема не решается, отправьте:

1. **Консоль браузера** (весь вывод)
2. **Network вкладка** (запрос `/api/apply-edit`)
3. **Результат SQL запроса**:
```sql
SELECT * FROM edit_history ORDER BY created_at DESC LIMIT 5;
```
4. **Версия Supabase** и **Node.js**

## Быстрая проверка работоспособности

```bash
# 1. Проверить, что файлы созданы
ls src/lib/enhancedEditMode.js
ls src/contexts/EditorAuthContext.jsx
ls src/services/editHistoryService.js

# 2. Проверить импорты в App.jsx
grep -n "enhancedEditMode" src/App.jsx
grep -n "EditorAuthProvider" src/App.jsx

# 3. Перезапустить dev сервер
npm run dev
```

Удачи! 🚀
