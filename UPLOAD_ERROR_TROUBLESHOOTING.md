# Руководство по исправлению ошибок загрузки файлов

## Ошибка: `net::ERR_HTTP2_PROTOCOL_ERROR`

### Описание проблемы

При загрузке файлов на R2 (S3-совместимое хранилище) возникает ошибка:
```
PUT https://dosmundos-audio.s3.kz-1.srvstorage.kz/... net::ERR_HTTP2_PROTOCOL_ERROR
TypeError: Failed to fetch
```

Это означает, что браузер не может корректно загрузить файл на S3 endpoint из-за проблемы с HTTP/2 протоколом.

### 🔍 Корневая причина

S3 endpoint на `srvstorage.kz` имеет проблему с поддержкой HTTP/2:
- Сервер объявляет поддержку HTTP/2 (h2) в ALPN
- Но не может правильно обработать PUT запросы через HTTP/2
- При переключении на HTTP/1.1 ошибка также может сохраняться
- Это систематическая проблема конфигурации серверного ПО

### ✅ Реализованные решения в коде

#### 1. **HTTP/1.1 Retry (Основное решение)**

```javascript
// Первая попытка - XHR загружает файл обычным способом
await innerAttemptUpload(0, maxRetries, false);

// Если HTTP/2 ошибка:
if (isHttp2Error && !forceHttp1) {
  return innerAttemptUpload(0, maxRetries, true);  // Retry с forceHttp1=true
}

// При forceHttp1 = true добавляется специальный заголовок:
xhr.setRequestHeader('Upgrade-Insecure-Requests', '1');
```

#### 2. **Chunked Upload для больших файлов**

Для файлов > 50MB при HTTP/2 ошибке используется раздробленная загрузка:
- Разделяет файл на части по 5MB
- Загружает каждую часть отдельным PUT запросом
- Может привести к более стабильной загрузке

```javascript
if (forceHttp1 && totalBytes > 50 * 1024 * 1024) {
  return await attemptChunkedUpload(presignedUrl, file, onProgress);
}
```

#### 3. **Удалены небезопасные заголовки**

Браузер блокирует установку заголовка `Connection`, поэтому он удален:
```javascript
// ❌ НЕВЕРНО - браузер блокирует это
xhr.setRequestHeader('Connection', 'keep-alive');

// ✅ ПРАВИЛЬНО - используем другие методы
xhr.setRequestHeader('Upgrade-Insecure-Requests', '1');
```

### 📋 Логирование процесса

При загрузке вы увидите в консоли (DevTools → Console):

```
[Upload] 2024-09-04_RU.mp3: Attempt 1/4, File size: 25.50MB, ForceHTTP/1.1: false
[Upload] 2024-09-04_RU.mp3: XHR failed - Network error during PUT
[Upload] 2024-09-04_RU.mp3: Detected HTTP/2 issue, retrying with HTTP/1.1 approach...
[Upload] 2024-09-04_RU.mp3: Retrying with forced HTTP/1.1...
[Upload] 2024-09-04_RU.mp3: Attempt 1/4, File size: 25.50MB, ForceHTTP/1.1: true
[Upload] 2024-09-04_RU.mp3: XHR upload succeeded ✅
```

### 🎯 Дополнительные улучшения в коде

- ✅ **Timeout**: 5 минут (300 сек) для больших файлов
- ✅ **Progress reporting**: Real-time прогресс загрузки в процентах
- ✅ **Exponential backoff**: Умный retry с увеличивающимся ожиданием (1s, 2s, 4s)
- ✅ **Detailed logging**: Полная информация о каждом шаге
- ✅ **Smart HTTP/2 detection**: Обнаруживает ошибку и автоматически переключается

### ⚠️ Если проблема все еще возникает

1. **Проверьте Network tab в DevTools:**
   - F12 → Network → Фильтруйте по "2024-09-04_RU.mp3"
   - Посмотрите Response Headers:
     - `alt-svc: h2=":443"; ma=2592000` - означает HTTP/2
     - Посмотрите какой Protocol использовался

2. **Размер файла:**
   - Попробуйте загрузить маленький файл (~1MB)
   - Проверьте логи - дошел ли до Chunked upload?

3. **Браузер и расширения:**
   - Используйте Chrome/Firefox последней версии
   - Отключите VPN или прокси
   - Откройте DevTools в приватном режиме (без расширений)

4. **Проверьте консоль логов:**
   - Ищите сообщения `[Upload]` в console.log
   - Ищите `ERR_HTTP2_PROTOCOL_ERROR` - сколько раз появляется?

### 🔧 Решение на уровне сервера (для администраторов)

Если вы управляете S3 endpoint на `srvstorage.kz`:

1. **Отключить HTTP/2 на сервере:**
   ```nginx
   # В конфигурации Nginx/Apache
   # Использовать только HTTP/1.1
   ```

2. **Проверить конфигурацию SSL/TLS:**
   ```
   - ALPN protocols должны включать только h1 (HTTP/1.1)
   - Не объявлять h2 если сервер не готов
   ```

3. **Проверить firewall правила:**
   - Убедитесь, что PUT запросы проходят без ограничений
   - Проверьте размеры пакетов

4. **Обновить ПО сервера:**
   - Используйте последнюю стабильную версию Nginx/Apache/S3 ПО
   - Может быть баг, который уже исправлен

### 📞 Контактировать с провайдером

Если проблема persists, напишите в поддержку srvstorage.kz:
- Опишите проблему: "HTTP/2 Protocol Error при PUT запросах на audio.s3.kz-1.srvstorage.kz"
- Приложите логи (из DevTools Network tab)
- Запросите отключение HTTP/2 или исправление конфигурации

### 🚀 Краткие рекомендации

| Ситуация | Решение |
|----------|---------|
| Маленькие файлы (~1-10MB) | Автоматический retry с HTTP/1.1 должен помочь |
| Большие файлы (>50MB) | Будет использоваться Chunked upload автоматически |
| Персистентная ошибка | Обратитесь в поддержку srvstorage.kz или используйте другой S3 провайдер |
| VPN/Прокси | Попробуйте без них |
