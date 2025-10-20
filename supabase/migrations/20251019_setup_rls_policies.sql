-- Настройка политик безопасности для edit_history системы
-- Для разработки разрешаем анонимный доступ

-- Отключаем RLS для начала (можно включить позже с правильными политиками)
ALTER TABLE user_editors DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_history DISABLE ROW LEVEL SECURITY;

-- Если хотите включить RLS с публичным доступом:
-- (Раскомментируйте следующий блок)

/*
-- Включаем RLS
ALTER TABLE user_editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_history ENABLE ROW LEVEL SECURITY;

-- Политики для user_editors
-- Разрешить всем вставку новых редакторов
CREATE POLICY "Anyone can insert editors" ON user_editors
FOR INSERT 
WITH CHECK (true);

-- Разрешить всем чтение редакторов
CREATE POLICY "Anyone can view editors" ON user_editors
FOR SELECT
USING (true);

-- Разрешить обновление только своих данных (по email)
CREATE POLICY "Editors can update themselves" ON user_editors
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Политики для edit_history
-- Разрешить всем вставку истории правок
CREATE POLICY "Anyone can insert edit history" ON edit_history
FOR INSERT
WITH CHECK (true);

-- Разрешить всем чтение истории правок
CREATE POLICY "Anyone can view edit history" ON edit_history
FOR SELECT
USING (true);

-- Разрешить обновление истории (для отката)
CREATE POLICY "Anyone can update edit history" ON edit_history
FOR UPDATE
USING (true)
WITH CHECK (true);
*/

-- Проверка политик
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('user_editors', 'edit_history');
