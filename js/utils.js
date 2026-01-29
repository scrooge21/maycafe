// --- БАЗОВЫЕ УТИЛИТЫ ---

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    tg.setHeaderColor(isDark ? '#1e1e1e' : '#fff0f5');
}

function showPopup(title, text) {
    document.getElementById('popupTitle').innerText = title;
    document.getElementById('popupText').innerText = text;
    document.getElementById('customPopup').style.display = 'flex';
}

function closePopup() { 
    document.getElementById('customPopup').style.display = 'none'; 
}

function showConfirm(title, text, callback) {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmText').innerText = text;
    document.getElementById('customConfirm').style.display = 'flex';
    confirmCallback = callback;
}

function closeConfirm(result) {
    document.getElementById('customConfirm').style.display = 'none';
    if (result && confirmCallback) confirmCallback();
    confirmCallback = null;
}

// --- VIDEO PLAYER ---
function openVideoModal() {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('youtubePlayer');
    iframe.src = `https://www.youtube.com/embed/lK-Za7kMKV0?autoplay=1&mute=1&playsinline=1&rel=0&origin=${window.location.origin}`;
    modal.style.display = 'flex';
    tg.BackButton.show(); 
    tg.BackButton.onClick(closeVideoModal);
}

function closeVideoModal() {
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('youtubePlayer').src = ""; 
    if(document.getElementById('cartPage').style.display === 'none') { 
        tg.BackButton.hide(); 
        tg.BackButton.offClick(); 
    }
}