# Применение SQL миграции для оптимизации

## Проблема
Получаете ошибку: `Could not find the function public.count_questions_by_episode(episode_slugs)`

## Решение

### Вариант 1: Через Supabase Dashboard (Рекомендуется)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor** в левом меню
4. Создайте новый запрос и скопируйте содержимое файла `supabase/migrations/count_questions_by_episode.sql`
5. Нажмите **Run** для выполнения

### Вариант 2: Через Supabase CLI

Если у вас установлен Supabase CLI:

```bash
# Применить миграцию
supabase db push

# Или применить конкретный файл
supabase db execute -f supabase/migrations/count_questions_by_episode.sql
```

### Вариант 3: Вручную через SQL

Скопируйте и выполните этот SQL запрос в Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION count_questions_by_episode(episode_slugs text[])
RETURNS TABLE (
  episode_slug text,
  lang text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.episode_slug,
    q.lang,
    COUNT(*) as count
  FROM questions q
  WHERE q.episode_slug = ANY(episode_slugs)
  GROUP BY q.episode_slug, q.lang;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION count_questions_by_episode IS 
'Возвращает количество вопросов для каждого эпизода и языка из предоставленного списка slug';
```

## Примечание

Приложение будет работать и без этой функции - используется fallback механизм, который просто делает дополнительный запрос. Функция нужна только для оптимизации производительности при большом количестве эпизодов.

После применения миграции ошибка исчезнет и загрузка страницы `/upload` будет быстрее.

