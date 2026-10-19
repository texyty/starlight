// auth-check.js
document.addEventListener('DOMContentLoaded', () => {
    // If user is already logged in on signin or signup page, redirect to profile
    if (localStorage.getItem('user')) {
        const path = window.location.pathname;
        if (path.includes('signin') || path.includes('signup')) {
            window.location.href = 'profile.html';
        }
    }
});
