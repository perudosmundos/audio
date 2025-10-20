# 🎤 Операции со спикерами - Полная интеграция истории

## ✅ Статус: ПОЛНОСТЬЮ ЗАВЕРШЕНО

Дата: 19 октября 2025

---

## 📋 Все операции со спикерами

### 1. ✅ Изменение спикера (Simple Change Speaker)
**Файл**: `QuestionBlock.jsx` → `handleSetSegmentSpeaker`

**Описание**: Быстрое изменение спикера через dropdown в сегменте

**UI**: Dropdown со списком спикеров в каждом сегменте транскрипта

**Операция**:
- Выбор нового спикера из существующих
- Изменяется только текущий сегмент
- Локальное изменение (не влияет на другие сегменты)

**История**:
```javascript
{
  edit_type: "transcript",
  target_type: "segment",
  action: "ChangeSpeaker",
  content_before: "Speaker: John",
  content_after: "Speaker: Maria",
  metadata: {
    oldSpeaker: "John",
    newSpeaker: "Maria",
    segmentId: "12345"
  }
}
```

---

### 2. ✅ Глобальное переименование спикера (Rename Speaker Globally)
**Файл**: `useSpeakerAssignment.js` → `handleSaveSpeakerAssignment` (isGlobalRename=true)

**Описание**: Переименовать спикера во всех сегментах где он упоминается

**UI**: 
- Кнопка на сегменте → открывается `SpeakerAssignmentDialog`
- Radio button: "Rename speaker globally"
- Input для нового имени

**Операция**:
- Находит все сегменты с этим спикером
- Меняет имя спикера во всех найденных сегментах
- Глобальное изменение (массовое обновление)

**Пример**: "SPEAKER_A" → "Maria" во всех 50+ сегментах

**История**:
```javascript
{
  edit_type: "transcript",
  target_type: "speaker",
  action: "RenameSpeakerGlobally",
  content_before: "Speaker: SPEAKER_A",
  content_after: "Speaker: Maria",
  metadata: {
    oldSpeaker: "SPEAKER_A",
    newSpeaker: "Maria",
    isGlobalRename: true,
    affectedSegmentsCount: 52,
    affectedSegmentIds: ["seg1", "seg2", ...], // First 10
    segmentId: "12345" // Segment from which rename was initiated
  }
}
```

---

### 3. ✅ Переназначение на существующего спикера (Reassign to Existing Speaker)
**Файл**: `useSpeakerAssignment.js` → `handleSaveSpeakerAssignment` (isGlobalRename=false)

**Описание**: Переназначить сегмент на другого существующего спикера

**UI**:
- Кнопка на сегменте → `SpeakerAssignmentDialog`
- Radio button: "Reassign to existing speaker"
- Dropdown со списком всех существующих спикеров

**Операция**:
- Изменяет спикера только для текущего сегмента
- Выбор из уже существующих спикеров в транскрипте
- Локальное изменение

**Пример**: Сегмент был "Maria" → переназначить на "John"

**История**:
```javascript
{
  edit_type: "transcript",
  target_type: "speaker",
  action: "ReassignSpeaker",
  content_before: "Speaker: Maria",
  content_after: "Speaker: John",
  metadata: {
    oldSpeaker: "Maria",
    newSpeaker: "John",
    isGlobalRename: false,
    affectedSegmentsCount: 1,
    segmentId: "12345"
  }
}
```

---

### 4. ✅ Создание нового спикера для сегмента (Create New Speaker)
**Файл**: `useSpeakerAssignment.js` → `handleSaveSpeakerAssignment` (isGlobalRename=false)

**Описание**: Назначить новое уникальное имя спикера для сегмента

**UI**:
- Кнопка на сегменте → `SpeakerAssignmentDialog`
- Radio button: "Create new speaker"
- Input для имени нового спикера

**Операция**:
- Создаёт нового спикера с указанным именем
- Назначает этого спикера только текущему сегменту
- Локальное изменение

**Пример**: Сегмент был "SPEAKER_B" → создать "Guest Speaker"

**История**:
```javascript
{
  edit_type: "transcript",
  target_type: "speaker",
  action: "ReassignSpeaker", // Same as reassign but creates new
  content_before: "Speaker: SPEAKER_B",
  content_after: "Speaker: Guest Speaker",
  metadata: {
    oldSpeaker: "SPEAKER_B",
    newSpeaker: "Guest Speaker",
    isGlobalRename: false,
    affectedSegmentsCount: 1,
    segmentId: "12345"
  }
}
```

---

## 🔍 Различия между операциями

| Операция | Где доступна | Scope | Файл |
|----------|--------------|-------|------|
| **Simple Change** | Dropdown в сегменте | 1 сегмент | QuestionBlock.jsx |
| **Global Rename** | Speaker Dialog | Все сегменты с этим спикером | useSpeakerAssignment.js |
| **Reassign Existing** | Speaker Dialog | 1 сегмент | useSpeakerAssignment.js |
| **Create New** | Speaker Dialog | 1 сегмент | useSpeakerAssignment.js |

---

## 🎯 UI Потоки

### Поток 1: Быстрое изменение (Simple Change)
1. Открыть транскрипт эпизода
2. Найти сегмент
3. Кликнуть на dropdown со спикерами
4. Выбрать другого спикера
5. ✅ Сохранено в историю

### Поток 2: Диалог назначения спикера
1. Открыть транскрипт эпизода
2. Найти сегмент
3. Кликнуть на кнопку **назначения спикера** (иконка)
4. Откроется `SpeakerAssignmentDialog`
5. Выбрать один из вариантов:
   - **Rename globally** (если спикер не дефолтный)
   - **Reassign to existing**
   - **Create new**
6. Ввести данные или выбрать из списка
7. Нажать кнопку подтверждения
8. ✅ Сохранено в историю

---

## 🛡️ Защита авторизацией

### Simple Change Speaker (QuestionBlock.jsx)
```javascript
if (!isAuthenticated) {
  toast({
    title: "Authentication Required",
    description: "Please log in to change speakers...",
    variant: "destructive"
  });
  return;
}
```

### Speaker Assignment Dialog (useSpeakerAssignment.js)
```javascript
if (!isAuthenticated) {
  toast({
    title: "Authentication Required",
    description: "Please log in to change speakers...",
    variant: "destructive"
  });
  handleCloseSpeakerAssignmentDialog();
  return;
}
```

---

## 🧪 Тестовые сценарии

### Тест 1: Simple Change без авторизации
1. Logout из системы
2. Попробовать изменить спикера через dropdown
3. **Ожидание**: Toast с ошибкой "Authentication Required"

### Тест 2: Simple Change с авторизацией
1. Login (Settings → Edit History)
2. Изменить спикера через dropdown
3. **Ожидание**: 
   - Спикер изменился
   - В консоли: `[QuestionBlock] Speaker change saved to history`
   - В истории запись с action: "ChangeSpeaker"

### Тест 3: Global Rename
1. Login
2. Открыть Speaker Dialog на сегменте с дефолтным именем (например "SPEAKER_A")
3. Выбрать "Rename speaker globally"
4. Ввести новое имя (например "Maria")
5. Сохранить
6. **Ожидание**:
   - Все сегменты с "SPEAKER_A" стали "Maria"
   - В консоли: `[useSpeakerAssignment] RenameSpeakerGlobally saved to history (X segments affected)`
   - В истории: action: "RenameSpeakerGlobally", affectedSegmentsCount: X

### Тест 4: Reassign to Existing
1. Login
2. Открыть Speaker Dialog
3. Выбрать "Reassign to existing speaker"
4. Выбрать спикера из dropdown
5. Сохранить
6. **Ожидание**:
   - Только текущий сегмент изменился
   - В истории: action: "ReassignSpeaker", affectedSegmentsCount: 1

### Тест 5: Create New Speaker
1. Login
2. Открыть Speaker Dialog
3. Выбрать "Create new speaker"
4. Ввести новое имя
5. Сохранить
6. **Ожидание**:
   - Текущий сегмент получил новое имя спикера
   - В истории: action: "ReassignSpeaker", affectedSegmentsCount: 1

### Тест 6: Откат операции
1. В истории найти операцию со спикером
2. Нажать "Rollback"
3. Подтвердить
4. **Ожидание**: 
   - Спикер вернулся к прежнему значению
   - Для Global Rename: все сегменты откатились

---

## 📊 Структура метаданных

### Simple Change (QuestionBlock)
```javascript
metadata: {
  episodeSlug: "episode-1",
  segmentId: "12345",
  action: "ChangeSpeaker",
  oldSpeaker: "John",
  newSpeaker: "Maria",
  segmentStart: 1000,
  segmentEnd: 5000,
  timestamp: "2025-10-19T12:00:00Z"
}
```

### Global Rename (useSpeakerAssignment)
```javascript
metadata: {
  episodeSlug: "episode-1",
  segmentId: "12345", // Segment from which rename initiated
  action: "RenameSpeakerGlobally",
  oldSpeaker: "SPEAKER_A",
  newSpeaker: "Maria",
  isGlobalRename: true,
  affectedSegmentsCount: 52,
  affectedSegmentIds: ["seg1", "seg2", "seg3", ...], // First 10
  segmentStart: 1000,
  segmentEnd: 5000,
  timestamp: "2025-10-19T12:00:00Z"
}
```

### Reassign/Create (useSpeakerAssignment)
```javascript
metadata: {
  episodeSlug: "episode-1",
  segmentId: "12345",
  action: "ReassignSpeaker",
  oldSpeaker: "Maria",
  newSpeaker: "John",
  isGlobalRename: false,
  affectedSegmentsCount: 1,
  affectedSegmentIds: ["12345"],
  segmentStart: 1000,
  segmentEnd: 5000,
  timestamp: "2025-10-19T12:00:00Z"
}
```

---

## 📂 Модифицированные файлы

### QuestionBlock.jsx (уже было)
- Добавлена интеграция для Simple Change Speaker
- Проверка авторизации
- Сохранение в историю

### useSpeakerAssignment.js (НОВОЕ)
- ✨ Добавлены импорты: `useEditorAuth`, `saveEditToHistory`
- ✨ Добавлен хук: `const { editor, isAuthenticated } = useEditorAuth()`
- ✨ Добавлена проверка авторизации в начале `handleSaveSpeakerAssignment`
- ✨ Добавлено отслеживание затронутых сегментов: `affectedSegments[]`
- ✨ Добавлено сохранение в историю после успешного обновления
- ✨ Логирование количества затронутых сегментов

---

## 🎉 Итоговая сводка всех операций

### Операции с текстом сегментов:
1. ✅ Update text
2. ✅ Split
3. ✅ Merge
4. ✅ Delete
5. ✅ Insert

### Операции со спикерами:
6. ✅ Simple Change Speaker (QuestionBlock)
7. ✅ Global Rename Speaker (useSpeakerAssignment)
8. ✅ Reassign to Existing (useSpeakerAssignment)
9. ✅ Create New Speaker (useSpeakerAssignment)

### Операции с UI:
10. ✅ Visual text editing

---

## 🔍 Отладка

### Консольные логи:
```javascript
// QuestionBlock
[QuestionBlock] Speaker change saved to history

// useSpeakerAssignment
[useSpeakerAssignment] RenameSpeakerGlobally saved to history (52 segments affected)
[useSpeakerAssignment] ReassignSpeaker saved to history (1 segments affected)
```

### Проверка в БД:
```sql
-- Все операции со спикерами
SELECT * FROM edit_history 
WHERE target_type = 'speaker' 
ORDER BY created_at DESC;

-- Глобальные переименования
SELECT * FROM edit_history 
WHERE metadata->>'action' = 'RenameSpeakerGlobally' 
ORDER BY created_at DESC;

-- Посмотреть сколько сегментов было затронуто
SELECT 
  metadata->>'action' as action,
  metadata->>'oldSpeaker' as old_speaker,
  metadata->>'newSpeaker' as new_speaker,
  (metadata->>'affectedSegmentsCount')::int as segments_affected,
  created_at
FROM edit_history 
WHERE target_type = 'speaker'
ORDER BY created_at DESC;
```

---

## 🚀 Готово к тестированию!

**Все 4 операции со спикерами теперь полностью интегрированы с историей редактирования!**

Протестируйте каждый тип операции и убедитесь, что:
- ✅ Без авторизации показывается ошибка
- ✅ С авторизацией операции выполняются
- ✅ Все операции сохраняются в историю
- ✅ Global Rename затрагивает множество сегментов
- ✅ Local operations затрагивают только один сегмент
- ✅ В метаданных есть вся необходимая информация
- ✅ Откат работает корректно

---

**Дата последнего обновления**: 19 октября 2025
**Статус**: ✅ ВСЕ ОПЕРАЦИИ СО СПИКЕРАМИ ИНТЕГРИРОВАНЫ
