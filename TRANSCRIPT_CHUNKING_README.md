# Система порционного сохранения транскрипций (Transcript Chunking)

## Описание проблемы

При распознавании текста через AssemblyAI, большие транскрипции могут превышать лимиты базы данных или вызывать ошибки HTTP2 при попытке сохранения. Это особенно актуально для длинных аудиофайлов (подкасты, лекции, интервью).

## Решение

Система автоматически разбивает большие транскрипции на чанки (части) и сохраняет их порционно в специальную таблицу `transcript_chunks`. Это позволяет:

- Сохранять транскрипции любого размера
- Избегать ошибок превышения лимитов БД
- Оптимизировать производительность запросов
- Восстанавливать полные транскрипции по требованию

## Архитектура

### 1. Таблица `transcript_chunks`

```sql
CREATE TABLE transcript_chunks (
    id BIGSERIAL PRIMARY KEY,
    episode_slug TEXT NOT NULL,
    lang TEXT NOT NULL,
    chunk_type TEXT NOT NULL CHECK (chunk_type IN ('text', 'utterances')),
    chunk_index INTEGER NOT NULL,
    chunk_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(episode_slug, lang, chunk_type, chunk_index)
);
```

### 2. Поле `chunking_metadata` в таблице `transcripts`

Добавляется поле для хранения метаданных о чанковании:

```json
{
  "totalChunks": 15,
  "textChunks": 8,
  "utteranceChunks": 7,
  "chunkSize": 50000,
  "chunkedAt": "2024-01-15T10:30:00Z"
}
```

## Компоненты системы

### 1. `transcriptChunkingService.js`

Основной сервис для работы с чанками:

- `chunkTranscriptText()` - разбивает текст на чанки
- `chunkUtterances()` - разбивает реплики на чанки
- `saveTranscriptInChunks()` - сохраняет транскрипцию порционно
- `reconstructTranscriptFromChunks()` - восстанавливает полную транскрипцию
- `clearTranscriptChunks()` - очищает чанки

### 2. `useTranscriptChunks.js`

React хук для работы с чанкованными транскрипциями:

- Получение информации о чанках
- Восстановление транскрипции
- Очистка чанков
- Статистика по размерам

### 3. `TranscriptChunksInfo.jsx`

UI компонент для отображения информации о чанках:

- Количество и размер чанков
- Типы чанков (текст/реплики)
- Действия (восстановить/очистить)
- Метаданные

## Использование

### 1. Автоматическое чанкование

Система автоматически активируется при сохранении больших транскрипций:

```javascript
// В transcriptPoller.js и useTranscriptAssemblyAI.js
const chunkingResult = await saveTranscriptInChunks(episodeSlug, lang, transcriptData, {
  maxChunkSize: 50000, // 50KB чанки
  maxChunks: 100,      // максимум 100 чанков
  saveFullData: true,  // сохраняем полные данные
  saveCompactData: false // компактные данные уже сохранены
});
```

### 2. Ручное управление чанками

```javascript
import { useTranscriptChunks } from '@/hooks/transcript/useTranscriptChunks';

const { 
  chunksInfo, 
  reconstructTranscript, 
  clearChunks 
} = useTranscriptChunks(episodeSlug, lang);

// Восстановить транскрипцию
await reconstructTranscript();

// Очистить чанки
await clearChunks();
```

### 3. Отображение информации

```jsx
import { TranscriptChunksInfo } from '@/components/TranscriptChunksInfo';

<TranscriptChunksInfo 
  episodeSlug={episode.slug} 
  lang={episode.lang} 
  currentLanguage={currentLanguage} 
/>
```

## Настройки

### Размер чанков

По умолчанию: 50KB (50,000 символов)

```javascript
const MAX_CHUNK_SIZE = 50000; // в символах
```

### Максимальное количество чанков

По умолчанию: 100 чанков на транскрипцию

```javascript
const MAX_CHUNKS_PER_TRANSCRIPT = 100;
```

### Настройка при сохранении

```javascript
await saveTranscriptInChunks(episodeSlug, lang, data, {
  maxChunkSize: 30000,    // 30KB чанки
  maxChunks: 50,          // максимум 50 чанков
  saveFullData: true,     // сохранять полные данные
  saveCompactData: true   // сохранять компактные данные
});
```

## Алгоритм разбиения

### 1. Разбиение текста

- Текст разбивается на чанки указанного размера
- Поиск оптимальной точки разрыва (конец предложения, пробел)
- Окно поиска: 20% от размера чанка или 1000 символов

### 2. Разбиение реплик

- Реплики группируются по времени
- Контроль общего размера текста в чанке
- Сохранение временных меток

## Восстановление транскрипции

### 1. Автоматическое восстановление

При запросе полной транскрипции система автоматически:

1. Проверяет наличие чанков
2. Загружает все чанки по порядку
3. Восстанавливает исходную структуру
4. Возвращает полную транскрипцию

### 2. Кэширование

Восстановленная транскрипция кэшируется в состоянии компонента для быстрого доступа.

## Мониторинг и статистика

### 1. Представление `transcript_chunks_summary`

```sql
SELECT 
    episode_slug,
    lang,
    COUNT(*) as total_chunks,
    COUNT(CASE WHEN chunk_type = 'text' THEN 1 END) as text_chunks,
    COUNT(CASE WHEN chunk_type = 'utterances' THEN 1 END) as utterance_chunks
FROM transcript_chunks
GROUP BY episode_slug, lang;
```

### 2. Статистика через хук

```javascript
const { getStatistics } = useAllTranscriptChunks();

const stats = getStatistics;
console.log(`Всего транскрипций: ${stats.totalTranscripts}`);
console.log(`Всего чанков: ${stats.totalChunks}`);
console.log(`Общий размер: ${stats.totalSizeMB} MB`);
```

## Очистка и обслуживание

### 1. Автоматическая очистка

```sql
-- Очистка чанков старше 30 дней
SELECT cleanup_old_transcript_chunks(30);
```

### 2. Ручная очистка

```javascript
// Очистить чанки для конкретной транскрипции
await clearTranscriptChunks(episodeSlug, lang);

// Очистить все старые чанки
await supabase.rpc('cleanup_old_transcript_chunks', { days_to_keep: 30 });
```

## Обратная совместимость

Система полностью совместима с существующим кодом:

1. **Fallback механизм** - при ошибке чанкования данные сохраняются напрямую
2. **Двойное сохранение** - компактные данные всегда сохраняются в `edited_transcript_data`
3. **Автоматическое определение** - система сама решает, нужно ли чанкование

## Производительность

### Преимущества

- Быстрое сохранение больших транскрипций
- Оптимизированные запросы к БД
- Снижение нагрузки на сеть
- Лучшая масштабируемость

### Рекомендации

1. **Размер чанков**: 30-50KB оптимально для большинства случаев
2. **Количество чанков**: не более 100 на транскрипцию
3. **Индексы**: автоматически создаются для быстрого поиска
4. **Очистка**: регулярно удаляйте старые чанки

## Устранение неполадок

### 1. Ошибка "Too many chunks"

Уменьшите размер чанков или увеличьте лимит:

```javascript
await saveTranscriptInChunks(episodeSlug, lang, data, {
  maxChunkSize: 25000,  // 25KB вместо 50KB
  maxChunks: 200        // 200 вместо 100
});
```

### 2. Медленное восстановление

Для очень больших транскрипций используйте прогрессивную загрузку:

```javascript
// Загружать чанки по частям
const chunks = await loadChunksInBatches(episodeSlug, lang, batchSize = 10);
```

### 3. Ошибки БД

Проверьте:
- Наличие таблицы `transcript_chunks`
- Права доступа к БД
- Размер JSONB полей
- Лимиты PostgreSQL

## Будущие улучшения

1. **Сжатие чанков** - автоматическое сжатие для экономии места
2. **CDN интеграция** - хранение чанков в CDN для быстрого доступа
3. **Прогрессивная загрузка** - загрузка чанков по мере необходимости
4. **Аналитика** - детальная статистика использования чанков
5. **Автоматическая оптимизация** - динамическая настройка размера чанков
