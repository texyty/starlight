# Rockstar 2.0 & Starlight

Современный веб-сайт и бэкенд авторизации для игрового клиента Rockstar с интеграцией базы данных Supabase PostgreSQL и системой проверки прав для лаунчера.

## Особенности
- **Последовательные UID (1, 2, 3...)**: каждый новый пользователь при регистрации получает строгий порядковый номер.
- **Единая система групп**:
  - `user`: обычный пользователь (доступ к запуску лаунчера заблокирован).
  - `plus`: расширенный доступ (запуск и инжект разрешены).
  - `admin`: администратор с полным доступом.
- **Интеграция с Supabase PostgreSQL**: надежное хранилище пользователей, привязки HWID и логов входа.
- **API для лаунчера**:
  - `POST /api/launcher/verify` — валидация учетных данных, привязка HWID и проверка прав запуска.
  - `POST /api/launcher/request-session` & `POST /api/launcher/authorize-session` — безопасный вход через браузер.
- **Личный кабинет**: просмотр UID, группы, статуса запуска лаунчера и сброса HWID.

## Быстрый старт локально

```bash
# Установка зависимостей
npm install

# Запуск сервера
npm start
```
Сервер будет доступен по адресу `http://localhost:3000`.

## Деплой в облако (Render / Railway / VPS)

### 1. Render.com
1. Создайте **New Web Service** на [Render.com](https://render.com).
2. Подключите репозиторий `texyty/starlight`.
3. Укажите параметры:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Добавьте переменные окружения (Environment Variables) из `.env.example`:
   - `DB_HOST`: `aws-0-eu-west-1.pooler.supabase.com`
   - `DB_PORT`: `5432`
   - `DB_NAME`: `postgres`
   - `DB_USER`: `postgres.nzkrfapnmrmyccvsojab`
   - `DB_PASSWORD`: `123porevo333@`
5. Нажмите **Deploy** — через минуту ваш сайт будет доступен во всем интернете с HTTPS!
