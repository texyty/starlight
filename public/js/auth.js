// auth.js — Starlight Authentication & Session Handler

function checkAuth() {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('jwtToken');
    return !!(user || token);
}

function redirectToSignin() {
    window.location.href = 'signin.html';
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('jwtToken');
    window.location.href = 'index.html';
}

async function handleSignIn(event) {
    if (event) event.preventDefault();
    const loginInput = document.getElementById('login');
    const passInput = document.getElementById('pass');
    const errDiv = document.getElementById('signinError');

    const username = loginInput ? loginInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (!username || !password) {
        showError(errDiv, 'Пожалуйста, заполните все поля');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (!data.success) {
            showError(errDiv, data.error || 'Ошибка входа');
            return;
        }

        // Store session
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('jwtToken', 'jwt_' + (data.user.uid || data.user.id) + '_' + Date.now());

        window.location.href = 'profile.html';
    } catch (err) {
        showError(errDiv, 'Не удалось связаться с сервером');
    }
}

async function handleRegistration(event) {
    if (event) event.preventDefault();
    const emailInput = document.getElementById('email');
    const loginInput = document.getElementById('login');
    const passInput = document.getElementById('password') || document.getElementById('pass');
    const termsInput = document.getElementById('terms');

    const username = loginInput ? loginInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (termsInput && !termsInput.checked) {
        alert('Необходимо согласиться с лицензионным соглашением');
        return;
    }

    if (!username || !password) {
        alert('Пожалуйста, заполните логин и пароль');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });
        const data = await response.json();

        if (!data.success) {
            alert(data.error || 'Ошибка при регистрации');
            return;
        }

        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('jwtToken', 'jwt_' + (data.user.uid || data.user.id) + '_' + Date.now());

        window.location.href = 'profile.html';
    } catch (err) {
        alert('Ошибка связи с сервером базы данных');
    }
}

function showError(el, msg) {
    if (!el) {
        alert(msg);
        return;
    }
    el.textContent = msg;
    el.style.display = 'block';
}

function getProductImage(name) {
    return 'img/logo.png';
}
