# Vercel Environment Variables Setup

## 🎯 Цель
Добавить переменные окружения в Vercel Dashboard для backend API endpoints (Hostinger SFTP операции).

## 📝 Переменные для добавления в Vercel

Добавь эти переменные в **Vercel Dashboard** → **Settings** → **Environment Variables**:

```
HOSTINGER_SFTP_HOST=82.25.67.168
HOSTINGER_SFTP_PORT=21
HOSTINGER_SFTP_USERNAME=u953185577
HOSTINGER_SFTP_PASSWORD=Ftppass!123
HOSTINGER_SFTP_UPLOAD_PATH=/public_html/wp-content/uploads/Audio/
HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
```

## 📋 Пошаговая инструкция

### Шаг 1: Перейди в Vercel Dashboard
1. Открой https://vercel.com/dashboard
2. Выбери проект **DosMundosPodcast**

### Шаг 2: Перейди в Settings
1. Нажми на вкладку **Settings** (сверху)
2. В левом меню найди **Environment Variables**

### Шаг 3: Добавь переменные
Для каждой переменной:
1. Нажми **Add**
2. Вставь имя (NAME) и значение (VALUE)
3. Выбери **Development**, **Preview**, и **Production** (чтобы была на всех)
4. Нажми **Save**

**Переменные:**
| NAME | VALUE |
|------|-------|
| `HOSTINGER_SFTP_HOST` | `82.25.67.168` |
| `HOSTINGER_SFTP_PORT` | `21` |
| `HOSTINGER_SFTP_USERNAME` | `u953185577` |
| `HOSTINGER_SFTP_PASSWORD` | `Ftppass!123` |
| `HOSTINGER_SFTP_UPLOAD_PATH` | `/public_html/wp-content/uploads/Audio/` |
| `HOSTINGER_PUBLIC_URL` | `https://dosmundos.pe/wp-content/uploads/Audio/` |

### Шаг 4: Проверь что все добавлены
После добавления, ты должен увидеть все 6 переменных в списке.

## 🚀 После добавления

После добавления переменных:

1. **Новый деплой автоматический** - Vercel автоматически перепродеплойит приложение
2. **API endpoints будут работать** - `/api/hostinger-*` смогут подключиться к Hostinger
3. **Frontend и Backend синхронизированы** - Всё готово к боевой работе

## ✅ Проверка

### Локально (для тестирования)
Создай файл `.env` в корне проекта:
```env
HOSTINGER_SFTP_HOST=82.25.67.168
HOSTINGER_SFTP_PORT=21
HOSTINGER_SFTP_USERNAME=u953185577
HOSTINGER_SFTP_PASSWORD=Ftppass!123
HOSTINGER_SFTP_UPLOAD_PATH=/public_html/wp-content/uploads/Audio/
HOSTINGER_PUBLIC_URL=https://dosmundos.pe/wp-content/uploads/Audio/
```

Потом:
```bash
npm run dev
```

И попробуй загрузить файл - он должен пойти на Hostinger через API.

## ⚠️ Важно

- ✅ **Пароль SFTP видно в Vercel** - это нормально, только админы могут видеть
- ✅ **Переменные безопасны** - не попадают в код, только в runtime
- ⚠️ **Не коммитьте** - `.env` и `.env.local` в .gitignore

---

**Статус:** ✅ Ready for Setup
