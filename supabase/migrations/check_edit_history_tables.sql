-- Проверка созданных таблиц и тестовые данные

-- 1. Проверить, что таблицы созданы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_editors', 'edit_history');

-- 2. Проверить структуру таблицы user_editors
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_editors'
ORDER BY ordinal_position;

-- 3. Проверить структуру таблицы edit_history
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'edit_history'
ORDER BY ordinal_position;

-- 4. Проверить функции
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_or_create_editor', 'rollback_edit');

-- 5. Проверить индексы
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('user_editors', 'edit_history');

-- 6. Проверить view
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_name = 'edit_history_with_editor';

-- 7. Тестовый редактор (опционально - раскомментируйте, если нужно)
-- SELECT get_or_create_editor('test@example.com', 'Test User');

-- 8. Посмотреть всех редакторов
SELECT * FROM user_editors ORDER BY created_at DESC;

-- 9. Посмотреть всю историю правок
SELECT * FROM edit_history ORDER BY created_at DESC LIMIT 10;

-- 10. Посмотреть историю с информацией о редакторах
SELECT * FROM edit_history_with_editor ORDER BY created_at DESC LIMIT 10;
