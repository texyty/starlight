const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'aws-0-eu-west-1.pooler.supabase.com',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres.nzkrfapnmrmyccvsojab',
    password: process.env.DB_PASSWORD || '123porevo333@',
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

async function initDb() {
    const client = await pool.connect();
    try {
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
        `);

        // Check if Admin exists, if not create default accounts
        const adminCheck = await client.query('SELECT id FROM users WHERE username = $1', ['Admin']);
        if (adminCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO users (uid, username, password, user_group, subscription_status, subscription_type, role)
                VALUES (1, 'Admin', '1337', 'admin', 'ACTIVE', 'ADMIN', 'admin')
            `);
            console.log('[Supabase] Created default Admin account (Admin / 1337) with group: admin');
        }

        // Check if demo user exists
        const userCheck = await client.query('SELECT id FROM users WHERE username = $1', ['Player']);
        if (userCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO users (uid, username, password, user_group, subscription_status, subscription_type, role)
                VALUES (2, 'Player', '1234', 'user', 'NO_SUB', 'user', 'user')
            `);
            console.log('[Supabase] Created default Player account (Player / 1234) with group: user');
        }

        console.log('[Supabase] Database schema initialized successfully.');
    } catch (err) {
        console.error('[Supabase] Error initializing database:', err);
    } finally {
        client.release();
    }
}

module.exports = { pool, initDb };
