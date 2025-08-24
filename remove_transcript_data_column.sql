-- Удаление столбца transcript_data из таблицы transcripts
-- Этот столбец больше не нужен, так как данные сохраняются в transcript_chunks

-- Проверяем, существует ли столбец
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transcripts' 
        AND column_name = 'transcript_data'
    ) THEN
        -- Удаляем столбец
        ALTER TABLE transcripts DROP COLUMN transcript_data;
        RAISE NOTICE 'Столбец transcript_data успешно удален';
    ELSE
        RAISE NOTICE 'Столбец transcript_data не существует';
    END IF;
END $$;

-- Обновляем комментарии к таблице
COMMENT ON TABLE transcripts IS 'Таблица транскрипций эпизодов (без столбца transcript_data)';
COMMENT ON COLUMN transcripts.edited_transcript_data IS 'Компактная версия транскрипции для быстрого доступа';
COMMENT ON COLUMN transcripts.chunking_metadata IS 'Метаданные о разбивке на чанки в таблице transcript_chunks';
