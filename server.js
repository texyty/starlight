const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (check public first, then root)
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

// Clean route rewrites for Rockstar
const getFilePath = (file) => {
    const pub = path.join(__dirname, 'public', file);
    return fs.existsSync(pub) ? pub : path.join(__dirname, file);
};

app.get(['/', '/index', '/index.html'], (req, res) => res.sendFile(getFilePath('index.html')));
app.get(['/profile', '/profile.html'], (req, res) => res.sendFile(getFilePath('profile.html')));
app.get(['/signin', '/signin.html'], (req, res) => res.sendFile(getFilePath('signin.html')));
app.get(['/signup', '/signup.html'], (req, res) => res.sendFile(getFilePath('signup.html')));
app.get(['/purchase', '/purchase.html'], (req, res) => res.sendFile(getFilePath('purchase.html')));
app.get(['/faq', '/faq.html'], (req, res) => res.sendFile(getFilePath('faq.html')));
app.get(['/license', '/license.html'], (req, res) => res.sendFile(getFilePath('license.html')));

// 1. Download launcher endpoint
app.get(['/download/launcher.exe', '/api/download/launcher.exe'], (req, res) => {
    let launcherPath = path.join(__dirname, 'launcher', 'NptProxy Launcher.exe');
    if (!fs.existsSync(launcherPath)) {
        launcherPath = path.join(__dirname, '..', 'mp', 'NptProxy Launcher.exe');
    }
    if (fs.existsSync(launcherPath)) {
        return res.download(launcherPath, 'Rockstar-Launcher.exe', (err) => {
            if (err && !res.headersSent) {
                res.status(404).send('Лаунчер еще не собран или файл отсутствует.');
            }
        });
    }
    if (process.env.LAUNCHER_DOWNLOAD_URL) {
        return res.redirect(process.env.LAUNCHER_DOWNLOAD_URL);
    }
    res.redirect('https://github.com/texyty/starlight/releases/latest');
});

// 2. System Status
app.get(['/api/status', '/status'], async (req, res) => {
    try {
        const dbCheck = await pool.query('SELECT NOW()');
        res.json({
            status: 'online',
            service: 'Rockstar 2.0 Backend',
            database: 'Supabase PostgreSQL connected',
            timestamp: dbCheck.rows[0].now
        });
    } catch (err) {
        res.status(500).json({ status: 'error', database: err.message });
    }
});

// 3. User Registration with sequential UID (1, 2, 3...) and default group 'user'
const handleRegister = async (req, res) => {
    const username = (req.body.username || req.body.login || '').trim();
    const password = (req.body.password || req.body.pass || '').trim();

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните логин и пароль' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Пользователь с таким логином уже существует' });
        }

        // Sequential UID starting from 1 to infinity
        const uidRes = await pool.query('SELECT COALESCE(MAX(uid), 0) + 1 AS next_uid FROM users');
        const nextUid = parseInt(uidRes.rows[0].next_uid, 10);

        const result = await pool.query(`
            INSERT INTO users (uid, username, password, user_group, subscription_status, subscription_type, role)
            VALUES ($1, $2, $3, 'user', 'NO_SUB', 'user', 'user')
            RETURNING uid, id, username, user_group, created_at
        `, [nextUid, username, password]);

        const user = result.rows[0];
        user.group = user.user_group;

        res.json({
            success: true,
            user,
            token: 'jwt_' + user.uid + '_' + Date.now(),
            message: `Регистрация успешна! Ваш UID: #${user.uid}. Группа: user`
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера базы данных' });
    }
};

app.post('/api/auth/register', handleRegister);
app.post('/auth/signup', handleRegister);

// 4. User Login
const handleLogin = async (req, res) => {
    const username = (req.body.username || req.body.login || '').trim();
    const password = (req.body.password || req.body.pass || '').trim();

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Введите логин и пароль' });
    }

    try {
        const result = await pool.query(`
            SELECT uid, id, username, password, user_group, hwid, created_at, last_login
            FROM users
            WHERE LOWER(username) = LOWER($1)
        `, [username]);

        if (result.rows.length === 0 || result.rows[0].password !== password) {
            return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
        }

        const user = result.rows[0];
        delete user.password;
        user.group = (user.user_group || 'user').toLowerCase();
        user.uid = user.uid || user.id;

        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        res.json({
            success: true,
            user,
            token: 'jwt_' + user.uid + '_' + Date.now(),
            message: 'Авторизация успешна'
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
};

app.post('/api/auth/login', handleLogin);
app.post('/authorization', handleLogin);

// 5. User details
app.get(['/api/account/details', '/account/details'], async (req, res) => {
    const userId = req.query.id || req.query.uid;
    if (!userId) return res.status(400).json({ error: 'User ID missing' });
    try {
        const result = await pool.query('SELECT uid, id, username, user_group, hwid FROM users WHERE id = $1 OR uid = $2', [userId, userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = result.rows[0];
        user.group = (user.user_group || 'user').toLowerCase();
        user.allowed = (user.group === 'plus' || user.group === 'admin');
        user.subscription_status = user.allowed ? 'ACTIVE' : 'NO_SUB';
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Launcher Verification Endpoint (.EXE SYSTEM)
// Правило: запустить лаунчер могут только plus и admin! Группа user блокируется.
app.post(['/api/launcher/verify', '/launcher/verify'], async (req, res) => {
    const { username, password, hwid } = req.body;
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            allowed: false,
            error: 'Отсутствуют учетные данные'
        });
    }

    try {
        const result = await pool.query(`
            SELECT uid, id, username, password, user_group, hwid
            FROM users
            WHERE LOWER(username) = LOWER($1)
        `, [username.trim()]);

        if (result.rows.length === 0 || result.rows[0].password !== password.trim()) {
            return res.status(401).json({
                success: false,
                allowed: false,
                error: 'Неверный логин или пароль'
            });
        }

        const user = result.rows[0];
        const userUid = user.uid || user.id;

        // Update HWID if provided and not yet bound
        if (hwid && !user.hwid) {
            await pool.query('UPDATE users SET hwid = $1, last_login = NOW() WHERE id = $2', [hwid, user.id]);
            user.hwid = hwid;
        } else {
            await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        }

        const group = (user.user_group || 'user').toLowerCase();

        // КЛЮЧЕВОЕ ПРАВИЛО: запустить лаунчер могут только plus и admin
        const isAllowed = (group === 'plus' || group === 'admin');

        if (!isAllowed) {
            return res.json({
                success: true,
                allowed: false, // запуск строго запрещен для группы 'user'
                uid: userUid,
                username: user.username,
                group: 'user',
                role: 'user',
                subscription_status: 'NO_SUB',
                subscription_type: 'user',
                error: 'Группа user не имеет доступа к запуску лаунчера. Доступ разрешен только для групп plus и admin.'
            });
        }

        // Группа plus или admin -> запуск разрешен!
        res.json({
            success: true,
            allowed: true, // доступ разрешен
            uid: userUid,
            username: user.username,
            group: group,
            role: group.toUpperCase(),
            subscription_status: 'ACTIVE',
            subscription_type: group.toUpperCase(),
            message: `Доступ разрешен для группы [${group.toUpperCase()}]. Лаунчер разблокирован!`
        });
    } catch (err) {
        console.error('Launcher verify error:', err);
        res.status(500).json({ success: false, allowed: false, error: 'Ошибка базы данных' });
    }
});

// 7. Toggle / Change Group (user -> plus -> admin -> user)
app.post(['/api/user/toggle-group', '/api/user/toggle-sub', '/user/toggle-group', '/user/toggle-sub'], async (req, res) => {
    const { userId, uid } = req.body;
    try {
        const userRes = await pool.query('SELECT id, uid, user_group FROM users WHERE id = $1 OR uid = $2', [userId || uid, uid || userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }

        const current = (userRes.rows[0].user_group || 'user').toLowerCase();
        let newGroup = 'user';
        if (current === 'user') newGroup = 'plus';
        else if (current === 'plus') newGroup = 'admin';
        else newGroup = 'user';

        const isAllowed = (newGroup === 'plus' || newGroup === 'admin');
        const subStatus = isAllowed ? 'ACTIVE' : 'NO_SUB';

        const updated = await pool.query(`
            UPDATE users
            SET user_group = $1, subscription_status = $2, subscription_type = $3, role = $4
            WHERE id = $5
            RETURNING uid, id, username, user_group, hwid
        `, [newGroup, subStatus, newGroup.toUpperCase(), newGroup, userRes.rows[0].id]);

        const u = updated.rows[0];
        u.group = u.user_group;

        res.json({
            success: true,
            user: u,
            group: newGroup,
            allowed: isAllowed,
            message: `Группа изменена на: ${newGroup.toUpperCase()} (запуск лаунчера: ${isAllowed ? 'РАЗРЕШЕН' : 'ЗАБЛОКИРОВАН'})`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. Reset HWID
app.post(['/api/user/reset-hwid', '/user/reset-hwid'], async (req, res) => {
    const { userId, uid } = req.body;
    try {
        await pool.query('UPDATE users SET hwid = NULL WHERE id = $1 OR uid = $2', [userId || uid, uid || userId]);
        res.json({ success: true, message: 'Привязка HWID успешно сброшена' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 9. In-Memory Web Login Sessions
const launcherSessions = new Map();

app.post('/api/launcher/request-session', (req, res) => {
    const sessionId = 'SES-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    launcherSessions.set(sessionId, {
        sessionId,
        code,
        status: 'pending',
        user: null,
        createdAt: Date.now()
    });
    for (const [id, s] of launcherSessions.entries()) {
        if (Date.now() - s.createdAt > 600000) launcherSessions.delete(id);
    }
    res.json({ success: true, sessionId, code });
});

app.get('/api/launcher/check-session', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || !launcherSessions.has(sessionId)) {
        return res.status(404).json({ success: false, error: 'Сессия не найдена или истекла' });
    }
    const session = launcherSessions.get(sessionId);
    res.json({
        success: true,
        status: session.status,
        user: session.user
    });
});

app.post('/api/launcher/authorize-session', async (req, res) => {
    const { sessionId, code, userId, uid } = req.body;
    let targetSession = null;
    if (sessionId && launcherSessions.has(sessionId)) {
        targetSession = launcherSessions.get(sessionId);
    } else if (code) {
        for (const s of launcherSessions.values()) {
            if (s.code === code.toUpperCase().trim()) {
                targetSession = s;
                break;
            }
        }
    }
    if (!targetSession) {
        return res.status(404).json({ success: false, error: 'Активная сессия лаунчера не найдена' });
    }
    try {
        const uRes = await pool.query('SELECT uid, id, username, user_group FROM users WHERE id = $1 OR uid = $2', [userId || uid, uid || userId]);
        if (uRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }
        const user = uRes.rows[0];
        const group = (user.user_group || 'user').toLowerCase();
        const isAllowed = (group === 'plus' || group === 'admin');

        targetSession.status = 'authorized';
        targetSession.user = {
            id: user.id,
            uid: user.uid,
            username: user.username,
            group: group,
            role: group.toUpperCase(),
            subscription_status: isAllowed ? 'ACTIVE' : 'NO_SUB',
            subscription_type: group.toUpperCase(),
            allowed: isAllowed
        };
        res.json({ success: true, message: 'Вход в лаунчер успешно подтвержден!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10. Rockstar Products API (for purchase.html)
app.get('/api/v1/internal/customization/products/getAll', (req, res) => {
    res.json({
        success: true,
        products: [
            { id: 'rockstar_plus', name: 'Rockstar Plus', price: 499, duration: 30, version: '2.0.4' },
            { id: 'rockstar_admin', name: 'Rockstar Admin Upgrade', price: 1499, duration: 9999, version: '2.0.4' }
        ]
    });
});

app.post('/api/v1/products/payment', (req, res) => {
    res.json({
        response: {
            link: '/profile'
        },
        message: 'Тестовый платеж сформирован'
    });
});

// Start Server
if (require.main === module) {
    initDb().then(() => {
        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`[Rockstar 2.0 Server] Running on http://localhost:${PORT}`);
            console.log(`[Main Page] http://localhost:${PORT}/`);
            console.log(`[Profile Page] http://localhost:${PORT}/profile`);
            console.log(`[Purchase Page] http://localhost:${PORT}/purchase.html`);
            console.log(`[Sign In] http://localhost:${PORT}/signin.html`);
            console.log(`[Launcher Verify API] http://localhost:${PORT}/api/launcher/verify`);
            console.log(`[Supabase DB] aws-0-eu-west-1.pooler.supabase.com:5432`);
            console.log(`[UID System] Sequential (1, 2, 3...)`);
            console.log(`[Groups] user (no launch) | plus (launch ok) | admin (launch ok)`);
            console.log(`=======================================================`);
        });
    });
} else {
    initDb().catch((err) => console.error('[Supabase Init]:', err.message));
}

module.exports = app;
