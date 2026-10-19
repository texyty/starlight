// header.js — Starlight Header & Navigation Controller

function initHeader() {
    const headerActions = document.querySelector('.header-actions');
    const openUlBtn = document.querySelector('.open-ul');
    const navUl = document.querySelector('header ul');

    // Mobile menu toggle
    if (openUlBtn && navUl) {
        openUlBtn.addEventListener('click', () => {
            navUl.classList.toggle('mobile-open');
            document.querySelector('header').classList.toggle('menu-open');
        });
    }

    // Auth state representation in header
    updateHeaderUser();
}

function updateHeaderUser() {
    const userStr = localStorage.getItem('user');
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const initial = (user.username || 'U')[0].toUpperCase();
            
            // Replace registration button with profile button
            const regBtn = headerActions.querySelector('.button');
            if (regBtn) regBtn.remove();

            let profileBtn = headerActions.querySelector('.profile-button');
            if (!profileBtn) {
                profileBtn = document.createElement('a');
                profileBtn.href = '/profile';
                profileBtn.className = 'profile-button';
                profileBtn.innerHTML = `
                    <div class="profile-avatar">${initial}</div>
                    <span class="profile-name">${user.username}</span>
                `;
                headerActions.prepend(profileBtn);
            }
        } catch (e) {
            console.error('Error parsing user in header', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', initHeader);
