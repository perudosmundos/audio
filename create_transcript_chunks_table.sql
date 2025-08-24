-- Создание таблицы для хранения чанков транскрипций
-- Это позволит сохранять большие транскрипции порционно

CREATE TABLE IF NOT EXISTS transcript_chunks (
    id BIGSERIAL PRIMARY KEY,
    episode_slug TEXT NOT NULL,
    lang TEXT NOT NULL,
    chunk_type TEXT NOT NULL CHECK (chunk_type IN ('text', 'utterances')),
    chunk_index INTEGER NOT NULL,
    chunk_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Уникальный индекс для предотвращения дублирования чанков
    UNIQUE(episode_slug, lang, chunk_type, chunk_index)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_episode_lang 
ON transcript_chunks(episode_slug, lang);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_type_index 
ON transcript_chunks(chunk_type, chunk_index);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_created_at 
ON transcript_chunks(created_at);

-- Добавление поля chunking_metadata в существующую таблицу transcripts
-- (если таблица уже существует)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transcripts' 
        AND column_name = 'chunking_metadata'
    ) THEN
        ALTER TABLE transcripts ADD COLUMN chunking_metadata JSONB;
    END IF;
END $$;

-- Комментарии к таблице
COMMENT ON TABLE transcript_chunks IS 'Таблица для хранения чанков больших транскрипций';
COMMENT ON COLUMN transcript_chunks.episode_slug IS 'Slug эпизода';
COMMENT ON COLUMN transcript_chunks.lang IS 'Язык транскрипции';
COMMENT ON COLUMN transcript_chunks.chunk_type IS 'Тип чанка: text или utterances';
COMMENT ON COLUMN transcript_chunks.chunk_index IS 'Индекс чанка для правильного порядка';
COMMENT ON COLUMN transcript_chunks.chunk_data IS 'Данные чанка в формате JSONB';
COMMENT ON COLUMN transcript_chunks.chunking_metadata IS 'Метаданные о чанковании в таблице transcripts';

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_transcript_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_transcript_chunks_updated_at ON transcript_chunks;
CREATE TRIGGER trigger_update_transcript_chunks_updated_at
    BEFORE UPDATE ON transcript_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_transcript_chunks_updated_at();

-- Функция для очистки старых чанков
CREATE OR REPLACE FUNCTION cleanup_old_transcript_chunks(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM transcript_chunks 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION cleanup_old_transcript_chunks(INTEGER) IS 'Функция для очистки старых чанков транскрипций';

-- Представление для удобного просмотра информации о чанках
CREATE OR REPLACE VIEW transcript_chunks_summary AS
SELECT 
    episode_slug,
    lang,
    COUNT(*) as total_chunks,
    COUNT(CASE WHEN chunk_type = 'text' THEN 1 END) as text_chunks,
    COUNT(CASE WHEN chunk_type = 'utterances' THEN 1 END) as utterance_chunks,
    MIN(created_at) as first_chunk_created,
    MAX(created_at) as last_chunk_created,
    SUM(
        CASE 
            WHEN chunk_type = 'text' THEN jsonb_array_length(chunk_data->'text')
            WHEN chunk_type = 'utterances' THEN jsonb_array_length(chunk_data->'utterances')
            ELSE 0
        END
    ) as total_items
FROM transcript_chunks
GROUP BY episode_slug, lang
ORDER BY episode_slug, lang;

-- Комментарий к представлению
COMMENT ON VIEW transcript_chunks_summary IS 'Сводка по чанкам транскрипций для каждого эпизода и языка';
