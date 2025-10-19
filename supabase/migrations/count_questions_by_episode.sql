-- SQL функция для быстрого подсчета вопросов по эпизодам
-- Это опциональная оптимизация для страницы /upload

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

-- Комментарий для документации
COMMENT ON FUNCTION count_questions_by_episode IS 
'Возвращает количество вопросов для каждого эпизода и языка из предоставленного списка slug';


