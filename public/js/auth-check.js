// auth-check.js — проверка сессии и защита страниц.
//
// РАНЬШЕ: если в localStorage лежал любой 'user', скрипт сразу перебрасывал на
// profile.html. Из-за этого после выхода/смены аккаунта и обновления страницы
// пользователя кидало в ПРОШЛЫЙ аккаунт (данные в localStorage были устаревшие).
//
// ТЕПЕРЬ: сессия проверяется на сервере (/api/account/details с токеном).
//   - токен действителен   -> обновляем данные и (на signin/signup) идём в профиль;
//   - токен недействителен -> чистим localStorage и остаёмся на странице входа.

function starlightClearSession() {
    localStorage.removeItem('user');
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('authToken');
}

async function starlightFetchSession() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('jwtToken');
    if (!token) return null;

    const candidates = ['/api/account/details', '/api/user/me', '/api/auth/me'];
    for (const url of candidates) {
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'x-auth-token': token, 'Authorization': 'Bearer ' + token }
            });
            if (res.status === 404) continue;      // эндпоинта нет — пробуем следующий
            if (res.status === 401 || res.status === 403) return null; // сессия недействительна
            if (!res.ok) continue;

            const data = await res.json().catch(() => null);
            const u = data && (data.user || data);
            if (u && (u.id || u.uid || u.username)) {
                localStorage.setItem('user', JSON.stringify(u));
                return u;
            }
        } catch (e) {
            // сервер недоступен — не считаем сессию недействительной
            return undefined;
        }
    }
    return undefined;
}

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    const onAuthPage = path.includes('signin') || path.includes('signup');
    const hasSession = !!(localStorage.getItem('user') || localStorage.getItem('authToken'));

    if (!hasSession) return;

    const user = await starlightFetchSession();

    if (user === null) {
        // Токен мёртвый/поддельный — сбрасываем "залипшую" сессию
        starlightClearSession();
        return;
    }

    // user === undefined -> сервер недоступен; не выкидываем, но и не редиректим слепо
    if (user && onAuthPage) {
        window.location.href = 'profile.html';
    }
});
