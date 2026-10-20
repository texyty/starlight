const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Хеширование паролей (тот же формат, что и в server.js): scrypt$<salt_hex>$<hash_hex>
function hashPassword(plain) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(plain), salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Проверка конфигурации. Если переменные окружения не заданы (например, на Vercel
// их забыли добавить), подключение к базе упадёт с невнятной ошибкой 500.
// Эта функция даёт точный ответ, чего не хватает.
function missingDbEnv() {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'];
    return required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
}

function dbConfigError() {
    const missing = missingDbEnv();
    if (missing.length === 0) return null;
    return `Не заданы переменные окружения: ${missing.join(', ')}. ` +
        `Добавьте их в настройках хостинга (Vercel → Settings → Environment Variables) ` +
        `или в файле .env при локальном запуске.`;
}

// Ошибка простаивающего соединения не должна валить весь сервер
// (на Vercel это приводит к падению функции с невнятной ошибкой).
pool.on('error', (err) => {
    console.error('[DB] Ошибка пула соединений:', err.message);
});

async function initDb() {
    let client;
    try {
        // connect() ДОЛЖЕН быть внутри try: иначе ошибка подключения
        // (например, ECONNREFUSED при пустом DB_HOST) валит весь процесс.
        client = await pool.connect();
        console.log('[Supabase] Initializing database schema...');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                uid INTEGER UNIQUE,
                username VARCHAR(64) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                user_group VARCHAR(32) DEFAULT 'user',
                subscription_status VARCHAR(32) DEFAULT 'NO_SUB',
                subscription_type VARCHAR(64) DEFAULT 'user',
                subscription_expires_at TIMESTAMP WITH TIME ZONE NULL,
                role VARCHAR(32) DEFAULT 'user',
                hwid VARCHAR(255) NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_login TIMESTAMP WITH TIME ZONE NULL
            );
            ALTER TABLE users ADD COLUMN IF NOT EXISTS uid INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS user_group VARCHAR(32) DEFAULT 'user';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) DEFAULT 0.00;
        `);

        // Check if Admin exists, if not create default accounts
        const adminCheck = await client.query('SELECT id FROM users WHERE username = $1', ['Admin']);
        if (adminCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO users (uid, username, password, user_group, subscription_status, subscription_type, role)
                VALUES (1, 'Admin', $1, 'admin', 'ACTIVE', 'ADMIN', 'admin')
            `, [hashPassword('1337')]);
            console.log('[Supabase] Created default Admin account (Admin / 1337) with group: admin');
        }

        // Check if demo user exists
        const userCheck = await client.query('SELECT id FROM users WHERE username = $1', ['Player']);
        if (userCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO users (uid, username, password, user_group, subscription_status, subscription_type, role)
                VALUES (2, 'Player', $1, 'user', 'NO_SUB', 'user', 'user')
            `, [hashPassword('1234')]);
            console.log('[Supabase] Created default Player account (Player / 1234) with group: user');
        }

        console.log('[Supabase] Database schema initialized successfully.');
    } catch (err) {
        console.error('[Supabase] Error initializing database:', err.message);
        // Пробрасываем ошибку наружу: вызывающий код (ensureDbReady) должен знать,
        // что БД не готова. Иначе API молча получит нерабочее соединение.
        throw err;
    } finally {
        if (client) client.release();
    }
}

module.exports = { pool, initDb, missingDbEnv, dbConfigError };
