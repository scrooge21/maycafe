// --- CENTRAL STATE UPDATE ---
function updateAppState() {
    localStorage.setItem('mayCafeCart', JSON.stringify(cart)); 
    updateCartButton();
    renderCategories(); 
    renderMenu();       
    renderFeatured();   
    
    // Обновляем корзину, если она открыта
    if(document.getElementById('cartPage').style.display === 'flex') renderCartPage();

    // Обновляем поиск, если он открыт
    if(document.getElementById('searchModal').style.display === 'flex') {
        const q = document.getElementById('searchInput').value;
        if(q) handleSearch(q);
    }

    // Обновляем кнопку в деталях товара
    const detailModal = document.getElementById('productDetailModal');
    if(detailModal.style.display === 'flex' && detailModal.dataset.activeId) {
        renderDetailButton(detailModal.dataset.activeId);
    }
}

// --- НАВИГАЦИЯ ---
function switchTab(tabId, el) {
    const tabs = ['home', 'menu', 'support', 'profile'];
    const index = tabs.indexOf(tabId);
    
    // Слайдер контейнера
    const swiper = document.getElementById('main-swiper');
    if (swiper) {
        swiper.style.transform = `translateX(-${index * 25}%)`;
    }
    
    // Активный класс иконок
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) {
        el.classList.add('active');
    } else {
        const navItems = document.querySelectorAll('.nav-item');
        if(navItems[index]) navItems[index].classList.add('active');
    }

    // Элементы интерфейса
    const banner = document.querySelector('.fixed-header-wrapper');
    const adminFab = document.getElementById('adminAddFab'); // Кнопка "+"
    const spacers = document.querySelectorAll('.tab-content > div:first-child'); // Отступы сверху

    // ЛОГИКА ОТОБРАЖЕНИЯ (Баннер, Кнопки, Отступы)
    
    // 1. Для MENU, SUPPORT, PROFILE -> Скрываем ФИКСИРОВАННЫЙ баннер
    // (В Menu есть свой скроллящийся баннер, в остальных он не нужен)
    if (tabId === 'menu' || tabId === 'support' || tabId === 'profile') {
        if(banner) banner.style.display = 'none';
        
        // Убираем верхние распорки (spacers), т.к. фиксированного хедера нет
        spacers.forEach(s => {
            if (!s.id && !s.className) s.style.display = 'none';
        });

    } else {
        // 2. Для HOME -> Показываем фиксированный баннер
        if(banner) banner.style.display = 'block';
        
        // Возвращаем распорки
        spacers.forEach(s => {
             if (!s.id && !s.className) s.style.display = 'block';
        });
    }

    // ЛОГИКА КНОПКИ АДМИНА (+)
    // Показываем только на HOME и MENU, и только если Админ
    if ((tabId === 'home' || tabId === 'menu') && isAdmin && adminFab) {
         adminFab.style.display = 'flex';
    } else if (adminFab) {
         adminFab.style.display = 'none';
    }

    // Рендер контента при переключении
    if(tabId === 'home') renderFeatured();
    if(tabId === 'support') renderSupportTab();
    
    updateCartButton();
}

// --- СВАЙПЫ ---
function handleSwipe(e) {
    // 1. Блокировка свайпов, если открыты любые модальные окна
    if (document.getElementById('videoModal').style.display === 'flex' ||
        document.getElementById('adminPanel').style.display === 'flex' ||
        document.getElementById('cartPage').style.display === 'flex' ||
        document.getElementById('productDetailModal').style.display === 'flex' ||
        document.getElementById('checkoutScreen').style.display === 'flex' ||
        document.getElementById('myOrdersModal').style.display === 'flex' ||
        document.getElementById('searchModal').style.display === 'flex' ||
        document.getElementById('bannerEditModal').style.display === 'flex' ||
        // Новые окна тестов
        document.getElementById('testHub').style.display === 'flex' ||
        document.getElementById('testPlayer').style.display === 'flex' ||
        document.getElementById('roomLobby').style.display === 'flex') return;

    // 2. Игнорируем свайп внутри горизонтальных скроллеров
    if (e.target.closest('.nav-scroller') || e.target.closest('.stories-container')) return;

    const xDiff = touchendX - touchstartX;
    const yDiff = touchendY - touchstartY;

    const navItems = document.querySelectorAll('.nav-item');
    let activeTabIndex = 0;
    navItems.forEach((item, index) => {
        if(item.classList.contains('active')) activeTabIndex = index;
    });
    const tabs = ['home', 'menu', 'support', 'profile'];

    // Детекция горизонтального свайпа (длина > 50px)
    if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 50) {
        
        // Особая логика для вкладки МЕНЮ (свайп категорий)
        if (tabs[activeTabIndex] === 'menu') {
            const cats = [...new Set(products.map(p => p.category))]; 
            const currentCatIndex = cats.indexOf(currentCat);
            
            if (xDiff < 0) { // Свайп ВЛЕВО (следующая категория)
                if (currentCatIndex < cats.length - 1) {
                    currentCat = cats[currentCatIndex + 1];
                    updateAppState(); tg.HapticFeedback.selectionChanged(); return; 
                }
            } else { // Свайп ВПРАВО (предыдущая категория)
                if (currentCatIndex > 0) {
                    currentCat = cats[currentCatIndex - 1];
                    updateAppState(); tg.HapticFeedback.selectionChanged(); return; 
                }
            }
        }

        // Общая логика переключения вкладок
        if (xDiff < 0) { // Свайп ВЛЕВО (следующая вкладка)
            if (activeTabIndex < tabs.length - 1) switchTab(tabs[activeTabIndex + 1]);
        } else { // Свайп ВПРАВО (предыдущая вкладка)
            if (activeTabIndex > 0) switchTab(tabs[activeTabIndex - 1]);
        }
    }
}

// --- ПРИ ЗАГРУЗКЕ DOM ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Инициализация UI
    updateCartButton();

    // 2. Экран загрузки
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if(loader) {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
        }
    }, 1500); 

    // 3. Данные пользователя Telegram
    const user = tg.initDataUnsafe.user;
    const demoUser = { id: 7172771170, first_name: "Admin", last_name: "Demo", photo_url: "" }; 
    const currentUser = user || demoUser; 

    if(currentUser) {
        myUserId = currentUser.id;
        
        // Трекинг в Firebase (Last Seen)
        const userRef = db.ref('users/' + myUserId);
        userRef.once('value', snap => {
            const now = firebase.database.ServerValue.TIMESTAMP;
            const updates = {
                lastSeen: now, 
                name: `${currentUser.first_name} ${currentUser.last_name || ''}`.trim(),
                username: currentUser.username || ''
            };
            if (!snap.exists()) {
                updates.firstSeen = now;
                userRef.set(updates);
            } else {
                userRef.update(updates);
            }
        });

        // 4. Проверка прав Админа
        if (ADMIN_IDS.includes(myUserId)) {
            isAdmin = true;
            const adminOrdersBtn = document.getElementById('adminOrdersBtn');
            const adminStatsBtn = document.getElementById('adminStatsBtn');
            // Ищем все кнопки редактирования баннера (на главной и в меню)
            const adminBannerEdits = document.querySelectorAll('.admin-banner-edit');
            
            if(adminOrdersBtn) adminOrdersBtn.style.display = 'flex';
            if(adminStatsBtn) adminStatsBtn.style.display = 'flex';
            
            // Показываем кнопки редактирования
            adminBannerEdits.forEach(btn => btn.style.display = 'flex');
        }
        
        // Заполнение профиля в UI
        const fullName = `${currentUser.first_name} ${currentUser.last_name || ''}`.trim();
        document.getElementById('userName').innerText = fullName;
        if(currentUser.photo_url) document.getElementById('userAvatar').src = currentUser.photo_url;
        
        // --- ВАЖНО: Инициализация модуля Тестов ---
        if (typeof initTests === 'function') {
            initTests();
        }
    }

    // 5. Слушатель изменений баннера (ФОН)
    db.ref('settings/banner').on('value', snap => {
        const url = snap.val();
        // Обновляем фон у ВСЕХ баннеров (на главной и в меню)
        const bannerContainers = document.querySelectorAll('.banner-content');
        
        bannerContainers.forEach(bannerContainer => {
            if (url) {
                bannerContainer.style.backgroundImage = `url('${url}')`;
                bannerContainer.classList.add('has-bg');
            } else {
                bannerContainer.style.backgroundImage = '';
                bannerContainer.classList.remove('has-bg');
            }
        });
    });

    // 6. Восстановление настроек
    const savedStatus = localStorage.getItem('userStatus');
    if(savedStatus) document.getElementById('statusText').innerText = savedStatus;

    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').checked = true;
    }

    // 7. Загрузка товаров
    db.ref('products').on('value', snap => {
        const data = snap.val();
        products = [];
        if(data) Object.keys(data).forEach(k => products.push({...data[k], id: k}));
        
        if(!currentCat && products.length > 0) currentCat = products[0].category;
        updateAppState(); 
    });

    // 8. Чат (только для обычных юзеров)
    if (!isAdmin) initUserChat(); 
    
    // 9. Пасхалка Админа (5 тапов по аватарке)
    let taps = 0;
    document.querySelector('.avatar-img').onclick = () => {
        taps++;
        if(taps === 5) {
            if (isAdmin) openAddProduct(); 
            else showPopup("Ошибка", "Доступ запрещен");
            taps = 0;
        }
    };
    
    // 10. Листенеры свайпов
    document.addEventListener('touchstart', e => { 
        touchstartX = e.changedTouches[0].screenX; 
        touchstartY = e.changedTouches[0].screenY; 
    }, {passive: false});
    
    document.addEventListener('touchend', e => { 
        touchendX = e.changedTouches[0].screenX; 
        touchendY = e.changedTouches[0].screenY; 
        handleSwipe(e); 
    }, {passive: false});

    // 11. Листенер загрузки фото в админке
    const pFile = document.getElementById('pFile');
    if (pFile) {
        pFile.addEventListener('change', function() {
            const box = document.querySelector('.admin-upload-box');
            const icon = box.querySelector('.material-symbols-rounded');
            const text = document.getElementById('uploadText');
            if (this.files && this.files[0]) {
                box.classList.add('uploaded');
                icon.innerText = 'check_circle';
                text.innerText = 'Фото выбрано';
            } else {
                box.classList.remove('uploaded');
                icon.innerText = 'add_a_photo';
                text.innerText = 'Загрузить';
            }
        });
    }

    // Запуск первой вкладки
    switchTab('home');
});