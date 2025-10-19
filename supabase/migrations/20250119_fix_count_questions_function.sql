-- Fix count_questions_by_episode function
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

-- Add comment
COMMENT ON FUNCTION count_questions_by_episode IS 
'Counts questions for multiple episodes by slug, returns episode_slug, lang, and count';
