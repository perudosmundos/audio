-- Обновить старые S3 URL на публичные домены
-- Выполните в Supabase SQL Editor или через psql

UPDATE episodes 
SET audio_url = REPLACE(
    audio_url, 
    'https://dosmundos-audio.s3.kz-1.srvstorage.kz/', 
    'https://b2a9e188-93e4-4928-a636-2ad4c9e1094e.srvstatic.kz/'
)
WHERE audio_url LIKE 'https://dosmundos-audio.s3.kz-1.srvstorage.kz/%';

-- Проверить результат:
SELECT slug, audio_url FROM episodes WHERE audio_url LIKE '%srvstatic.kz%' LIMIT 5;
