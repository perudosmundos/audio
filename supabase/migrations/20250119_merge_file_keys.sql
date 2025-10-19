-- Объединяем r2_object_key и hostinger_file_key в одну колонку file_name
-- Сначала добавляем новые колонки
ALTER TABLE public.episodes 
ADD COLUMN file_name character varying(255);

ALTER TABLE public.episodes 
ADD COLUMN file_has_lang_suffix boolean DEFAULT false;

-- Копируем данные из существующих колонок
UPDATE public.episodes 
SET file_name = COALESCE(hostinger_file_key, r2_object_key)
WHERE file_name IS NULL;

-- Удаляем старые колонки
ALTER TABLE public.episodes 
DROP COLUMN IF EXISTS r2_object_key,
DROP COLUMN IF EXISTS hostinger_file_key;

-- Добавляем индекс для новой колонки
CREATE INDEX IF NOT EXISTS idx_episodes_file_name 
ON public.episodes USING btree (file_name);

-- Добавляем комментарии
COMMENT ON COLUMN public.episodes.file_name IS 'Имя файла в хранилище (объединяет r2_object_key и hostinger_file_key)';
COMMENT ON COLUMN public.episodes.file_has_lang_suffix IS 'Есть ли языковой суффикс в имени файла (например, _ES, _RU)';
