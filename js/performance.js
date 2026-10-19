// performance.js — script for loading async styles & performance enhancements
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('link[data-async]').forEach(link => {
        link.media = 'all';
    });
});
