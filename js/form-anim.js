// form-anim.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.animate-form');
    if (form) {
        form.style.opacity = '0';
        form.style.transform = 'translateY(20px)';
        form.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        requestAnimationFrame(() => {
            form.style.opacity = '1';
            form.style.transform = 'translateY(0)';
        });
    }
});
