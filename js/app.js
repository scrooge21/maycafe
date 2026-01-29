// --- ПРИ ЗАГРУЗКЕ DOM ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Обновляем кнопку корзины (если были данные в localStorage)
    updateCartButton();

    // 2. Логика экрана загрузки
    setTimeout(() => {
        const loader = document.getElementById('loading-screen');
        if(loader) {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
        }
    }, 1500); 

    // 3. Инициализация пользователя
    const user = tg.initDataUnsafe.user;
    const demoUser = { id: 7172771170, first_name: "Admin", last_name: "Demo", photo_url: "" }; 
    const currentUser = user || demoUser; 

    if(currentUser) {
        myUserId = currentUser.id;
        // Проверка на админа
        if (ADMIN_IDS.includes(myUserId)) {
            isAdmin = true;
            // Показываем кнопки админа в профиле
            const adminOrdersBtn = document.getElementById('adminOrdersBtn');
            const adminStatsBtn = document.getElementById('adminStatsBtn');
            if(adminOrdersBtn) adminOrdersBtn.style.display = 'flex';
            if(adminStatsBtn) adminStatsBtn.style.display = 'flex';
        }
        
        // Заполнение профиля
        const fullName = `${currentUser.first_name} ${currentUser.last_name || ''}`.trim();
        document.getElementById('userName').innerText = fullName;
        if(currentUser.photo_url) document.getElementById('userAvatar').src = currentUser.photo_url;
    }

    // 4. Восстановление статуса и темы
    const savedStatus = localStorage.getItem('userStatus');
    if(savedStatus) document.getElementById('statusText').innerText = savedStatus;

    if(localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').checked = true;
    }

    // 5. Слушатель товаров из базы
    db.ref('products').on('value', snap => {
        const data = snap.val();
        products = [];
        if(data) Object.keys(data).forEach(k => products.push({...data[k], id: k}));
        
        if(!currentCat && products.length > 0) currentCat = products[0].category;
        updateAppState(); 
    });

    // 6. Инициализация чата (для юзера)
    if (!isAdmin) initUserChat(); 
    
    // 7. Скрытая кнопка админки (пасхалка на аватарке)
    let taps = 0;
    document.querySelector('.avatar-img').onclick = () => {
        taps++;
        if(taps === 5) {
            if (isAdmin) openAddProduct(); 
            else showPopup("Ошибка", "Доступ запрещен");
            taps = 0;
        }
    };
    
    // 8. Слушатели свайпов
    document.addEventListener('touchstart', e => { 
        touchstartX = e.changedTouches[0].screenX; 
        touchstartY = e.changedTouches[0].screenY; 
    }, {passive: false});
    
    document.addEventListener('touchend', e => { 
        touchendX = e.changedTouches[0].screenX; 
        touchendY = e.changedTouches[0].screenY; 
        handleSwipe(e); 
    }, {passive: false});

    // 9. Слушатель загрузки фото в админке
    document.getElementById('pFile').addEventListener('change', function() {
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
            text.innerText = 'Загрузить фото';
        }
    });

    // Инициализация первой вкладки
    switchTab('home');
});

// --- НАВИГАЦИЯ И СЛАЙДЕР ---

function switchTab(tabId, el) {
    const tabs = ['home', 'menu', 'support', 'profile'];
    const index = tabs.indexOf(tabId);
    
    const swiper = document.getElementById('main-swiper');
    if (swiper) {
        swiper.style.transform = `translateX(-${index * 25}%)`;
    }
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) {
        el.classList.add('active');
    } else {
        const navItems = document.querySelectorAll('.nav-item');
        if(navItems[index]) navItems[index].classList.add('active');
    }

    // --- УПРАВЛЕНИЕ ВИДИМОСТЬЮ ЭЛЕМЕНТОВ (БАННЕР, АДМИН КНОПКА, ОТСТУПЫ) ---
    const banner = document.querySelector('.fixed-header-wrapper');
    const adminFab = document.getElementById('adminAddFab');
    // Находим "распорки" (пустые div с height: 110px) внутри вкладок
    const spacers = document.querySelectorAll('.tab-content > div:first-child');

    if (tabId === 'support' || tabId === 'profile') {
        // Скрываем баннер и кнопку админа
        if(banner) banner.style.display = 'none';
        if(adminFab) adminFab.style.display = 'none';
        
        // Убираем верхний отступ (spacer)
        spacers.forEach(s => {
            if (!s.id && !s.className) s.style.display = 'none';
        });

    } else {
        // Показываем баннер
        if(banner) banner.style.display = 'block';
        
        // Кнопка админа только если юзер админ
        if (isAdmin && adminFab) {
             adminFab.style.display = 'flex';
        } else if (adminFab) {
             adminFab.style.display = 'none';
        }

        // Возвращаем отступы
        spacers.forEach(s => {
             if (!s.id && !s.className) s.style.display = 'block';
        });
    }

    if(tabId === 'home') renderFeatured();
    if(tabId === 'support') renderSupportTab();
    
    updateCartButton();
}

function handleSwipe(e) {
    // Блокируем свайп если открыты модалки
    if (document.getElementById('videoModal').style.display === 'flex' ||
        document.getElementById('adminPanel').style.display === 'flex' ||
        document.getElementById('cartPage').style.display === 'flex' ||
        document.getElementById('productDetailModal').style.display === 'flex' ||
        document.getElementById('checkoutScreen').style.display === 'flex' ||
        document.getElementById('myOrdersModal').style.display === 'flex' ||
        document.getElementById('searchModal').style.display === 'flex') return;

    if (e.target.closest('.nav-scroller') || e.target.closest('.stories-container')) return;

    const xDiff = touchendX - touchstartX;
    const yDiff = touchendY - touchstartY;

    const navItems = document.querySelectorAll('.nav-item');
    let activeTabIndex = 0;
    navItems.forEach((item, index) => {
        if(item.classList.contains('active')) activeTabIndex = index;
    });
    const tabs = ['home', 'menu', 'support', 'profile'];

    if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 50) {
        if (tabs[activeTabIndex] === 'menu') {
            const cats = [...new Set(products.map(p => p.category))]; 
            const currentCatIndex = cats.indexOf(currentCat);
            if (xDiff < 0) { // Свайп влево
                if (currentCatIndex < cats.length - 1) {
                    currentCat = cats[currentCatIndex + 1];
                    updateAppState(); tg.HapticFeedback.selectionChanged(); return; 
                }
            } else { // Свайп вправо
                if (currentCatIndex > 0) {
                    currentCat = cats[currentCatIndex - 1];
                    updateAppState(); tg.HapticFeedback.selectionChanged(); return; 
                }
            }
        }
        if (xDiff < 0) { 
            if (activeTabIndex < tabs.length - 1) switchTab(tabs[activeTabIndex + 1]);
        } else { 
            if (activeTabIndex > 0) switchTab(tabs[activeTabIndex - 1]);
        }
    }
}

// --- ПОИСК ---
function openSearchModal() {
    document.getElementById('searchModal').style.display = 'flex';
    document.getElementById('searchInput').focus();
    
    document.getElementById('searchTagsBlock').style.display = 'block';
    document.getElementById('searchResultsGrid').innerHTML = '';

    const tagCont = document.getElementById('popularTagsContainer');
    if (tagCont) {
        tagCont.innerHTML = ''; 
        const popularItems = products.slice(0, 8); 
        popularItems.forEach(p => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip';
            chip.innerText = p.name;
            chip.onclick = () => applySearchTag(p.name);
            tagCont.appendChild(chip);
        });
    }
    tg.BackButton.show();
    tg.BackButton.onClick(closeSearchModal);
}

function closeSearchModal() {
    document.getElementById('searchModal').style.display = 'none';
    document.getElementById('searchInput').value = '';
    
    if(document.getElementById('cartPage').style.display === 'flex') {
        tg.BackButton.show();
        tg.BackButton.onClick(() => toggleCart(false));
    } else {
        tg.BackButton.hide();
        tg.BackButton.offClick();
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    handleSearch('');
    document.getElementById('searchInput').focus();
}

function applySearchTag(tagName) {
    const input = document.getElementById('searchInput');
    input.value = tagName;
    handleSearch(tagName);
}

function handleSearch(query) {
    const cleanQuery = query.toLowerCase().trim();
    const clearIcon = document.querySelector('.clear-icon');
    const tagsBlock = document.getElementById('searchTagsBlock');
    const resultsGrid = document.getElementById('searchResultsGrid');
    
    clearIcon.style.display = cleanQuery.length > 0 ? 'block' : 'none';

    if (cleanQuery.length === 0) {
        tagsBlock.style.display = 'block';
        resultsGrid.innerHTML = '';
        return;
    }

    tagsBlock.style.display = 'none';
    resultsGrid.innerHTML = '';

    const found = products.filter(p => 
        p.name.toLowerCase().includes(cleanQuery) || 
        (p.description && p.description.toLowerCase().includes(cleanQuery))
    );

    if (found.length === 0) {
        resultsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#999; margin-top:20px">Ничего не найдено 😔</div>';
        return;
    }

    found.forEach(p => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.onclick = () => openProductDetail(p.id); 
        div.innerHTML = `
            <img src="${p.img}" class="item-img" onerror="this.src='https://placehold.co/300x200?text=No+Image'">
            <div class="item-info">
                <div class="item-title">${p.name}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto">
                    <div style="width:100%;">
                        ${getProductButtonHtml(p)}
                    </div>
                </div>
            </div>
        `;
        resultsGrid.appendChild(div);
    });
}

// --- КОРЗИНА И ОФОРМЛЕНИЕ ---
function addToCart(id) {
    if(!cart[id]) {
        const p = products.find(x => x.id === id);
        cart[id] = { qty: 1, price: p.price, name: p.name, img: p.img };
    } 
    updateAppState();
    tg.HapticFeedback.impactOccurred('light');
}

function modQty(id, d) {
    if(cart[id]) {
        cart[id].qty += d;
        if(cart[id].qty <= 0) delete cart[id];
    } else if (d > 0) {
        addToCart(id);
        return;
    }
    updateAppState();
    tg.HapticFeedback.selectionChanged();
}

function updateAppState() {
    localStorage.setItem('mayCafeCart', JSON.stringify(cart)); 
    updateCartButton();
    renderCategories(); 
    renderMenu();       
    renderFeatured();   
    
    if(document.getElementById('cartPage').style.display === 'flex') renderCartPage();

    if(document.getElementById('searchModal').style.display === 'flex') {
        const q = document.getElementById('searchInput').value;
        if(q) handleSearch(q);
    }

    const detailModal = document.getElementById('productDetailModal');
    if(detailModal.style.display === 'flex' && detailModal.dataset.activeId) {
        renderDetailButton(detailModal.dataset.activeId);
    }
}

function updateCartButton() {
    const totalQty = Object.values(cart).reduce((a, b) => a + b.qty, 0);
    const totalPrice = Object.values(cart).reduce((a, b) => a + (b.price * b.qty), 0);
    const floatBtn = document.getElementById('floatingCart');
    
    const navItems = document.querySelectorAll('.nav-item');
    let isVisibleTab = false;
    if(navItems[0].classList.contains('active') || navItems[1].classList.contains('active')) {
        isVisibleTab = true;
    }

    const isCartOpen = document.getElementById('cartPage').style.display === 'flex';

    if (totalQty > 0 && isVisibleTab && !isCartOpen) {
        floatBtn.style.display = 'flex';
        floatBtn.innerHTML = `<span>${totalPrice} ₽</span>`;
    } else {
        floatBtn.style.display = 'none';
    }
}

function toggleCart(show) {
    const el = document.getElementById('cartPage');
    el.style.display = show ? 'flex' : 'none';
    
    updateCartButton();

    if(show) {
        renderCartPage();
        tg.BackButton.show(); 
        tg.BackButton.onClick(() => toggleCart(false));
    } else {
        tg.BackButton.hide(); 
        tg.BackButton.offClick();
        if(document.getElementById('searchModal').style.display === 'flex') {
            tg.BackButton.show();
            tg.BackButton.onClick(closeSearchModal);
        }
    }
}

function renderCartPage() {
    const list = document.getElementById('cartList');
    list.innerHTML = '';
    let subTotal = 0;
    let totalQty = 0;

    if(Object.keys(cart).length === 0) {
        list.innerHTML = '<div style="text-align:center; opacity:0.6; margin-top:50px">Пока тут пусто 🍕</div>';
        document.getElementById('finalBtnText').innerText = `ОФОРМИТЬ`;
        document.getElementById('itemsCountText').innerText = `0 товаров`;
        document.getElementById('subTotal').innerText = `0 ₽`;
        document.getElementById('discountRow').style.display = 'none';
        return;
    }

    Object.keys(cart).forEach(id => {
        const item = cart[id];
        subTotal += item.price * item.qty;
        totalQty += item.qty;
        
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px;">
                <img src="${item.img}" class="cart-item-img" onerror="this.src='https://placehold.co/100?text=Item'">
                <div style="flex:1">
                    <h4 style="margin:0 0 5px 0;">${item.name}</h4>
                    <div style="font-size:13px; opacity:0.7">${item.price} ₽</div>
                </div>
                <div class="qty-control" style="background:rgba(128,128,128,0.1)">
                    <button onclick="modQty('${id}', -1)">−</button>
                    <span>${item.qty}</span>
                    <button onclick="modQty('${id}', 1)">+</button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });

    const discountVal = Math.round(subTotal * (discountPercent / 100));
    const finalPrice = subTotal - discountVal;

    document.getElementById('itemsCountText').innerText = `${totalQty} товаров`;
    document.getElementById('subTotal').innerText = `${subTotal} ₽`;
    
    const discRow = document.getElementById('discountRow');
    if (discountVal > 0) {
        discRow.style.display = 'flex';
        document.getElementById('discountVal').innerText = `- ${discountVal} ₽`;
    } else {
        discRow.style.display = 'none';
    }
    document.getElementById('finalBtnText').innerText = `ОФОРМИТЬ ЗА ${finalPrice} ₽`;
}

function promptPromo() {
    const code = prompt("Введите промокод (например MAY10):");
    if(code) {
        if(code.trim().toUpperCase() === 'MAY10') { 
            discountPercent = 10; showPopup('Успех', 'Скидка 10% применена!'); 
        } else { 
            discountPercent = 0; showPopup('Ошибка', 'Промокод не найден'); 
        }
        renderCartPage();
    }
}

function clearCartConfirm() {
    if(Object.keys(cart).length === 0) return;
    showConfirm("Очистка", "Очистить корзину?", () => {
        cart = {}; discountPercent=0; updateAppState(); toggleCart(false); 
    });
}

function checkout() {
    if(Object.keys(cart).length === 0) return;
    toggleCart(false);
    const subTotal = Object.values(cart).reduce((a,b) => a + (b.price*b.qty), 0);
    const total = subTotal - Math.round(subTotal * (discountPercent / 100));
    document.getElementById('checkoutTotalPrice').innerText = total + ' ₽';
    document.getElementById('checkoutScreen').style.display = 'flex';
    tg.BackButton.show();
    tg.BackButton.onClick(closeCheckout);
}

function closeCheckout() {
    document.getElementById('checkoutScreen').style.display = 'none';
    tg.BackButton.hide();
    tg.BackButton.offClick();
    if(Object.keys(cart).length > 0) toggleCart(true);
}

function selectMethod(el, type) {
    selectedMethod = type;
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    tg.HapticFeedback.selectionChanged();
}

function selectPayment(el, type) {
    selectedPayment = type;
    document.querySelectorAll('.payment-option').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    tg.HapticFeedback.selectionChanged();
}

function confirmPayment() {
    const subTotal = Object.values(cart).reduce((a,b) => a + (b.price*b.qty), 0);
    const total = subTotal - Math.round(subTotal * (discountPercent / 100));
    const comment = document.getElementById('orderComment').value;
    
    const user = tg.initDataUnsafe.user || { first_name: 'Guest' };
    const orderData = {
        userId: myUserId, userName: `${user.first_name} ${user.last_name || ''}`,
        items: cart, total: total, method: selectedMethod, payment: selectedPayment,
        comment: comment, status: 'new', timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref('orders').push().set(orderData).then(() => {
        cart = {}; discountPercent = 0; updateAppState();
        document.getElementById('checkoutScreen').style.display = 'none';
        tg.BackButton.hide(); tg.BackButton.offClick();
        showPopup('Успех', 'Заказ принят! Статус в профиле.');
        tg.HapticFeedback.notificationOccurred('success');
    });
}

// --- РЕНДЕР ПРОДУКТОВ ---
function renderCategories() {
    const nav = document.getElementById('categoryNav');
    const cats = [...new Set(products.map(p => p.category))];
    nav.innerHTML = '';
    cats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = `category-btn ${c === currentCat ? 'active' : ''}`;
        btn.innerText = c;
        btn.onclick = () => { 
            currentCat = c; updateAppState(); tg.HapticFeedback.selectionChanged(); 
        };
        nav.appendChild(btn);
    });
}

function renderMenu() {
    const cont = document.getElementById('menuContainer');
    cont.innerHTML = '';
    const filtered = products.filter(p => p.category === currentCat);
    
    if(filtered.length === 0) {
        cont.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#999; padding:20px">Пусто 🐰</div>';
        return;
    }
    filtered.forEach(p => createProductCard(p, cont));
}

function renderFeatured() {
    const grid = document.getElementById('featuredGrid');
    grid.innerHTML = '';
    products.slice(0, 4).forEach(p => createProductCard(p, grid));
}

function createProductCard(p, container) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.onclick = () => openProductDetail(p.id); 
    div.innerHTML = `
        ${isAdmin ? `<div class="edit-badge" onclick="event.stopPropagation(); editProduct('${p.id}')"><span class="material-symbols-rounded" style="font-size:16px">edit</span></div>` : ''}
        <img src="${p.img}" class="item-img" onerror="this.src='https://placehold.co/300x200?text=No+Image'">
        <div class="item-info">
            <div class="item-title">${p.name}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto">
                <div style="width:100%;">${getProductButtonHtml(p)}</div>
            </div>
        </div>
    `;
    container.appendChild(div);
}

function getProductButtonHtml(p) {
    if (cart[p.id]) {
        return `<div class="btn-counter" onclick="event.stopPropagation()">
            <button onclick="modQty('${p.id}', -1)">−</button>
            <span>${cart[p.id].qty}</span>
            <button onclick="modQty('${p.id}', 1)">+</button>
        </div>`;
    }
    return `<button class="add-btn" onclick="addToCart('${p.id}'); event.stopPropagation()">
            ${p.price} ₽
        </button>`;
}

// --- ОТКРЫТИЕ ДЕТАЛЕЙ ---
function openProductDetail(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    
    const modal = document.getElementById('productDetailModal');
    modal.dataset.activeId = id;

    document.getElementById('dImg').src = p.img || 'https://placehold.co/300x200';
    document.getElementById('dName').innerText = p.name;
    document.getElementById('dDesc').innerText = p.description || 'Описание отсутствует.';
    
    renderDetailButton(id);

    modal.style.display = 'flex';
    tg.BackButton.show();
    tg.BackButton.onClick(closeProductDetail);
}

function renderDetailButton(id) {
    const p = products.find(x => x.id === id);
    const container = document.getElementById('detailBtnContainer');
    
    if (cart[id]) {
        container.innerHTML = `
            <div class="detail-counter-box">
                <button onclick="modQty('${id}', -1)" class="dc-btn">−</button>
                <span class="dc-val">${cart[id].qty}</span>
                <button onclick="modQty('${id}', 1)" class="dc-btn">+</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button class="detail-add-btn" onclick="addToCart('${id}')">
                Добавить за ${p.price} ₽
            </button>
        `;
    }
}

function closeProductDetail() {
    const modal = document.getElementById('productDetailModal');
    modal.style.display = 'none';
    delete modal.dataset.activeId; 
    
    if(document.getElementById('searchModal').style.display === 'flex') {
        tg.BackButton.show();
        tg.BackButton.onClick(closeSearchModal);
    } 
    else if(document.getElementById('cartPage').style.display === 'flex') {
        tg.BackButton.show(); 
        tg.BackButton.onClick(() => toggleCart(false));
    } 
    else {
        tg.BackButton.hide(); 
        tg.BackButton.offClick();
    }
}

// --- ЧАТ (ЛОГИКА ОБНОВЛЕНА: ФИКС, ФОКУС, УДАЛЕНИЕ) ---

function initChatInputLogic() {
    const input = document.getElementById('chatInput');
    const nav = document.querySelector('.bottom-nav');
    const chatContainer = document.getElementById('chatConversationView'); 

    if(input && nav && chatContainer) {
        // ПРИ ОТКРЫТИИ КЛАВИАТУРЫ
        input.addEventListener('focus', () => {
            // Скрываем меню
            nav.classList.add('hidden');
            // Опускаем поле ввода к низу (убираем зазор)
            chatContainer.classList.add('keyboard-open');
            // Скроллим к последнему сообщению
            setTimeout(() => {
                const chatArea = document.getElementById('chatHistoryArea');
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 300);
        });

        // ПРИ ЗАКРЫТИИ КЛАВИАТУРЫ
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.activeElement !== input) {
                    nav.classList.remove('hidden');
                    chatContainer.classList.remove('keyboard-open');
                }
            }, 100);
        });
    }

    // ЛОГИКА СКРЕПКИ
    const attachBtn = document.querySelector('.attach-btn');
    let fileInput = document.getElementById('chatFileInput');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'chatFileInput';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                uploadChatImage(this.files[0]);
            }
        });
    }
    if(attachBtn) {
        attachBtn.onclick = () => fileInput.click();
    }
}

function uploadChatImage(file) {
    const attachBtn = document.querySelector('.attach-btn');
    const originalIcon = attachBtn.innerHTML;
    
    attachBtn.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s infinite">refresh</span>';
    
    const fd = new FormData(); 
    fd.append("image", file);
    
    fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method:"POST", body:fd })
        .then(r => r.json())
        .then(res => {
            if(res.data && res.data.url) {
                const imgHtml = `<img src="${res.data.url}" style="max-width:100%; border-radius:10px; display:block; margin-bottom:5px;">`;
                sendMessageInternal(imgHtml, 'image');
            }
            attachBtn.innerHTML = originalIcon;
        })
        .catch(() => {
            showPopup('Ошибка', 'Не удалось загрузить фото');
            attachBtn.innerHTML = originalIcon;
        });
}

function sendMessageInternal(content, type = 'text') {
    const targetUid = isAdmin ? activeChatUserId : myUserId;
    if (!targetUid) return;
    const senderRole = isAdmin ? 'admin' : 'user';
    const input = document.getElementById('chatInput');
    
    if (!isAdmin) {
        const user = tg.initDataUnsafe.user || { first_name: 'Guest' };
        let lastMsgPreview = type === 'image' ? '📷 Фото' : content;
        db.ref(`chats/${targetUid}/meta`).set({
            name: `${user.first_name} ${user.last_name || ''}`.trim(),
            photo: user.photo_url || '', 
            lastMessage: lastMsgPreview, 
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    } else {
         let lastMsgPreview = type === 'image' ? 'Вы: 📷 Фото' : `Вы: ${content}`;
         db.ref(`chats/${targetUid}/meta`).update({ 
             lastMessage: lastMsgPreview, 
             timestamp: firebase.database.ServerValue.TIMESTAMP 
         });
    }

    db.ref(`chats/${targetUid}/messages`).push({ 
        text: content, 
        sender: senderRole, 
        timestamp: firebase.database.ServerValue.TIMESTAMP 
    });

    if (type === 'text') {
        input.value = '';
        input.focus(); // Держим фокус, чтобы клавиатура не ушла
    }
}

function handleSend() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;
    sendMessageInternal(text, 'text');
}

function renderSupportTab() {
    if (isAdmin) {
        document.getElementById('adminChatListView').style.display = 'flex';
        document.getElementById('chatConversationView').style.display = 'none';
        loadAdminChatList();
    } else {
        document.getElementById('adminChatListView').style.display = 'none';
        document.getElementById('chatConversationView').style.display = 'flex';
        document.getElementById('chatHeaderAdmin').style.display = 'flex';
        document.querySelector('#chatHeaderAdmin button').style.display = 'none'; 
        document.getElementById('chatHeaderName').innerText = "Поддержка";
        initChatInputLogic(); 
    }
}

function loadAdminChatList() {
    db.ref('chats').on('value', snap => {
        const list = document.getElementById('adminChatList');
        list.innerHTML = '';
        const data = snap.val();
        if(data) {
            const sorted = Object.keys(data).sort((a,b) => (data[b].meta?.timestamp || 0) - (data[a].meta?.timestamp || 0));
            sorted.forEach(uid => {
                const meta = data[uid].meta || { name: 'Unknown', lastMessage: '...' };
                const avatar = meta.photo ? `<img src="${meta.photo}" class="chat-list-avatar" style="padding:0; border:none;">` : `<div class="chat-list-avatar">${meta.name.charAt(0)}</div>`;
                const div = document.createElement('div');
                div.className = 'chat-list-item';
                div.innerHTML = `${avatar}<div class="chat-list-content"><div class="chat-list-name">${meta.name}</div><div class="chat-list-msg">${meta.lastMessage}</div></div>`;
                div.onclick = () => openAdminChat(uid, meta.name);
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#999">Нет сообщений</div>';
        }
    });
}

function openAdminChat(uid, name) {
    activeChatUserId = uid;
    document.getElementById('adminChatListView').style.display = 'none';
    document.getElementById('chatConversationView').style.display = 'flex';
    document.getElementById('chatHeaderAdmin').style.display = 'flex';
    document.querySelector('#chatHeaderAdmin button').style.display = 'block'; 
    document.getElementById('chatHeaderName').innerText = name;
    initChatInputLogic(); 
    loadMessages(uid);
}

function backToChatList() {
    activeChatUserId = null;
    document.getElementById('chatConversationView').style.display = 'none';
    document.getElementById('adminChatListView').style.display = 'flex';
}

function initUserChat() {
    loadMessages(myUserId);
}

// ФУНКЦИЯ УДАЛЕНИЯ СООБЩЕНИЯ
function confirmDeleteMessage(chatUid, msgKey) {
    showConfirm(
        "Удалить?", 
        "Вы хотите удалить это сообщение?", 
        () => {
            db.ref(`chats/${chatUid}/messages/${msgKey}`).remove()
                .catch(err => showPopup("Ошибка", err.message));
        }
    );
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ СООБЩЕНИЙ (С ПОДДЕРЖКОЙ УДАЛЕНИЯ)
function loadMessages(uid) {
    const chatArea = document.getElementById('chatHistoryArea');
    db.ref(`chats/${uid}/messages`).off();
    db.ref(`chats/${uid}/messages`).on('value', snapshot => {
        chatArea.innerHTML = '';
        const data = snapshot.val();
        if(data) {
            // Перебираем ключи для доступа к ID сообщения
            Object.keys(data).forEach(key => {
                const msg = data[key];
                const isUserMsg = ((isAdmin && msg.sender === 'admin') || (!isAdmin && msg.sender === 'user'));
                const cssClass = isUserMsg ? 'msg-user' : 'msg-admin';
                
                const date = new Date(msg.timestamp || Date.now());
                const timeStr = date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
                
                let ticksHtml = '';
                if (isUserMsg) {
                    ticksHtml = `<span class="msg-ticks"><span class="material-symbols-rounded" style="font-size:14px;">done_all</span></span>`;
                }

                const div = document.createElement('div');
                div.className = `chat-msg ${cssClass}`;
                // Добавляем клик для удаления
                div.onclick = () => confirmDeleteMessage(uid, key);

                div.innerHTML = `
                    ${msg.text}
                    <div class="msg-meta">
                        <span class="msg-time">${timeStr}</span>
                        ${ticksHtml}
                    </div>
                `;
                chatArea.appendChild(div);
            });
            setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 50);
        } else {
            chatArea.innerHTML = '<div class="chat-placeholder">Начните диалог 🐰</div>';
        }
    });
}

// --- АДМИНКА (ТОВАРЫ) ---
function openAddProduct() {
    resetAdminForm();
    updateAdminCategoryList();
    document.getElementById('adminPanel').style.display = 'flex';
}

function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    updateAdminCategoryList();
    document.getElementById('adminPanel').style.display = 'flex';
    document.getElementById('adminFormTitle').innerText = "Редактировать";
    document.getElementById('pId').value = id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pCat').value = p.category;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pImg').value = p.img;
    document.getElementById('btnDelete').style.display = 'flex';
    document.getElementById('saveBtn').innerText = 'Обновить';
    document.getElementById('uploadText').innerText = 'Загрузить новое фото';
}

function updateAdminCategoryList() {
    const cats = [...new Set(products.map(p => p.category))];
    const dataList = document.getElementById('catList');
    dataList.innerHTML = '';
    cats.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        dataList.appendChild(option);
    });
}

function resetAdminForm() {
    document.getElementById('adminFormTitle').innerText = "Новый товар";
    document.getElementById('pId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pDesc').value = '';
    document.getElementById('pCat').value = '';
    document.getElementById('pPrice').value = '';
    document.getElementById('pImg').value = '';
    document.getElementById('pFile').value = ''; 
    document.querySelector('.admin-upload-box').classList.remove('uploaded');
    document.getElementById('uploadText').innerText = 'Загрузить фото';
    document.getElementById('btnDelete').style.display = 'none';
    document.getElementById('saveBtn').innerText = 'Сохранить';
}

function toggleAdmin() { document.getElementById('adminPanel').style.display = 'none'; }

function saveProduct() {
    const id = document.getElementById('pId').value; 
    const name = document.getElementById('pName').value;
    const desc = document.getElementById('pDesc').value; 
    const price = document.getElementById('pPrice').value;
    const cat = document.getElementById('pCat').value;
    const manualImg = document.getElementById('pImg').value;
    const fileInput = document.getElementById('pFile');
    const saveBtn = document.getElementById('saveBtn');

    if(!name || !price || !cat) return showPopup('Bot', 'Заполните обязательные поля');
    saveBtn.innerText = '⏳...';

    const finalize = (url) => {
        const d = { name, description: desc, category: cat, price: Number(price), img: url };
        const onSuccess = () => { showPopup('Успех', 'Сохранено ✨'); toggleAdmin(); saveBtn.innerText = 'Сохранить'; };
        if (id) db.ref('products/' + id).update(d).then(onSuccess);
        else db.ref('products').push(d).then(onSuccess);
    };

    if(fileInput.files[0]) {
        const fd = new FormData(); fd.append("image", fileInput.files[0]);
        fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method:"POST", body:fd })
            .then(r => r.json()).then(res => finalize(res.data.url))
            .catch(() => { showPopup('Ошибка', 'Фото не загружено'); saveBtn.innerText = 'Сохранить'; });
    } else {
        finalize(manualImg || 'https://placehold.co/300x200?text=No+Image');
    }
}

function deleteProduct() {
    const id = document.getElementById('pId').value;
    showConfirm("Удаление", "Точно удалить?", () => {
        db.ref('products/' + id).remove().then(() => { toggleAdmin(); showPopup('Готово', 'Удалено 🗑'); });
    });
}

// --- ЗАКАЗЫ И СТАТИСТИКА (АДМИН + ЮЗЕР) ---
function openMyOrders() {
    document.getElementById('myOrdersModal').style.display = 'flex';
    const list = document.getElementById('myOrdersList');
    list.innerHTML = '<p style="text-align:center;">Загрузка...</p>';
    tg.BackButton.show();
    tg.BackButton.onClick(() => { document.getElementById('myOrdersModal').style.display = 'none'; tg.BackButton.hide(); tg.BackButton.offClick(); });
    db.ref('orders').orderByChild('userId').equalTo(myUserId).once('value', snap => renderOrderList(snap.val(), list, false));
}

function openAdminOrders() {
    document.getElementById('adminOrdersModal').style.display = 'flex';
    const list = document.getElementById('adminOrdersList');
    list.innerHTML = '<p style="text-align:center;">Загрузка...</p>';
    tg.BackButton.show();
    tg.BackButton.onClick(() => { document.getElementById('adminOrdersModal').style.display = 'none'; tg.BackButton.hide(); tg.BackButton.offClick(); });
    db.ref('orders').limitToLast(50).once('value', snap => renderOrderList(snap.val(), list, true));
}

function renderOrderList(data, container, isAdminMode) {
    container.innerHTML = '';
    if(!data) { container.innerHTML = '<p style="text-align:center; margin-top:50px">Список пуст</p>'; return; }
    const orders = Object.keys(data).map(k => ({...data[k], key: k})).sort((a,b) => b.timestamp - a.timestamp);

    orders.forEach(order => {
        const date = new Date(order.timestamp).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
        let stText = 'Новый', stClass = 'st-new';
        if(order.status === 'work') { stText = 'В работе'; stClass = 'st-work'; }
        else if(order.status === 'ship') { stText = 'Отправлен'; stClass = 'st-ship'; }
        else if(order.status === 'done') { stText = 'Выполнен'; stClass = 'st-done'; }
        else if(order.status === 'cancel') { stText = 'Отменен'; stClass = 'st-cancel'; }

        let itemsHtml = '';
        if(order.items) Object.values(order.items).forEach(i => itemsHtml += `<div>${i.qty} x ${i.name}</div>`);

        const div = document.createElement('div');
        div.className = 'order-card';
        div.innerHTML = `
            <div class="oc-header"><span>№ ${order.key.slice(-4)} • ${date}</span><span class="oc-status ${stClass}">${stText}</span></div>
            ${isAdminMode ? `<div style="font-size:12px; margin-bottom:5px; color:var(--primary)">👤 ${order.userName}</div>` : ''}
            <div class="oc-items">${itemsHtml}</div>
            <div class="oc-footer"><span style="font-weight:bold">${order.total} ₽</span>
            ${!isAdminMode ? `<button class="repeat-btn" onclick='repeatOrder(${JSON.stringify(order.items)})'>Повторить</button>` : ''}</div>
        `;
        if(isAdminMode) {
            div.innerHTML += `
            <div style="margin-top:10px; display:flex; gap:5px; border-top:1px dashed var(--border); padding-top:10px;">
                <button onclick="setOrderStatus('${order.key}', 'work')">🔵</button>
                <button onclick="setOrderStatus('${order.key}', 'ship')">🟣</button>
                <button onclick="setOrderStatus('${order.key}', 'done')">✅</button>
                <button onclick="setOrderStatus('${order.key}', 'cancel')">❌</button>
            </div>`;
        }
        container.appendChild(div);
    });
}

function setOrderStatus(key, status) {
    db.ref('orders/' + key).update({ status: status });
    setTimeout(openAdminOrders, 150);
}

function repeatOrder(items) {
    cart = items; updateAppState();
    document.getElementById('myOrdersModal').style.display = 'none';
    showPopup('Корзина', 'Товары добавлены!'); toggleCart(true); 
}

function openStats() {
    document.getElementById('adminStatsModal').style.display = 'flex';
    tg.BackButton.show();
    tg.BackButton.onClick(() => { document.getElementById('adminStatsModal').style.display = 'none'; tg.BackButton.hide(); tg.BackButton.offClick(); });
    
    db.ref('orders').once('value', snap => {
        const orders = snap.val() || {};
        let money = 0;
        Object.values(orders).forEach(o => money += (o.total || 0));
        document.getElementById('statOrders').innerText = Object.keys(orders).length;
        document.getElementById('statMoney').innerText = money + ' ₽';
    });
    db.ref('chats').once('value', snap => document.getElementById('statUsers').innerText = snap.numChildren());
}

// --- VIDEO PLAYER ---
function openVideoModal() {
    const modal = document.getElementById('videoModal');
    const iframe = document.getElementById('youtubePlayer');
    iframe.src = `https://www.youtube.com/embed/lK-Za7kMKV0?autoplay=1&mute=1&playsinline=1&rel=0&origin=${window.location.origin}`;
    modal.style.display = 'flex';
    tg.BackButton.show(); tg.BackButton.onClick(closeVideoModal);
}

function closeVideoModal() {
    document.getElementById('videoModal').style.display = 'none';
    document.getElementById('youtubePlayer').src = ""; 
    if(document.getElementById('cartPage').style.display === 'none') { tg.BackButton.hide(); tg.BackButton.offClick(); }
}

function editUserStatus() {
    const newText = prompt("Новый статус:", document.getElementById('statusText').innerText);
    if (newText) {
        document.getElementById('statusText').innerText = newText;
        localStorage.setItem('userStatus', newText);
    }
}