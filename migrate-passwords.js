// Разовая миграция паролей: открытый текст -> scrypt-хеши.
//
// Формат хеша тот же, что в server.js/db.js: scrypt$<salt_hex>$<hash_hex>
//
// Логика:
//   - строки, у которых пароль УЖЕ в формате scrypt$..., не трогаем;
//   - строки с открытым паролем хешируют ТЕКУЩИЙ пароль, чтобы аккаунт
//     продолжил работать с тем же паролем (ничего не теряем);
//   - флаг --reset=login1,login2 дополнительно сбрасывает пароли указанных
//     аккаунтов на случайные и печатает новые.
//
// Запуск:
//   node migrate-passwords.js                       (только посмотреть план)
//   node migrate-passwords.js --apply               (применить хеширование)
//   node migrate-passwords.js --apply --reset=login1,login2
//
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require(path.join(__dirname, 'db'));

function hashPassword(plain) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(plain), salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function isHashed(s) {
    return typeof s === 'string' && s.startsWith('scrypt$') && s.split('$').length === 3;
}
function randomPassword() {
    return crypto.randomBytes(6).toString('base64url');
}

(async () => {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const resetArg = args.find(a => a.startsWith('--reset='));
    const resetLogins = resetArg
        ? resetArg.substring('--reset='.length).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];

    const { rows } = await pool.query('SELECT id, uid, username, password, user_group FROM users ORDER BY id');
    console.log(`Всего аккаунтов: ${rows.length}`);
    console.log(`Режим: ${apply ? 'ПРИМЕНИТЬ' : 'ТОЛЬКО ПОКАЗАТЬ (dry-run)'}\n`);

    let hashed = 0, plain = 0, reset = 0;

    for (const u of rows) {
        if (isHashed(u.password)) {
            hashed++;
            console.log(`  #${u.id} ${u.username} [${u.user_group}] -> OK (хеш)`);
            continue;
        }

        plain++;
        const shouldReset = resetLogins.includes(String(u.username).toLowerCase());

        if (shouldReset) {
            const np = randomPassword();
            console.log(`  #${u.id} ${u.username} [${u.user_group}] -> RESET (новый пароль: ${np})`);
            if (apply) {
                await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashPassword(np), u.id]);
                reset++;
            }
        } else {
            console.log(`  #${u.id} ${u.username} [${u.user_group}] -> будет захеширован текущий пароль`);
            if (apply) {
                await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashPassword(u.password), u.id]);
            }
        }
    }

    console.log(`\nИтого: хешей уже ${hashed}, открытых ${plain}${apply ? `, из них сброшено ${reset}` : ''}.`);
    if (!apply) console.log('\nЭто был предварительный просмотр. Добавь --apply чтобы применить.');
    await pool.end();
})().catch(async (e) => {
    console.error('Ошибка миграции:', e.message);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
});
