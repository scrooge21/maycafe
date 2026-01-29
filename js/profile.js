// --- ПРОФИЛЬ, ЗАКАЗЫ И СТАТИСТИКА ---

// Глобальные переменные для админки заказов
let allOrdersCache = [];
let currentAdminFilter = 'all';

function editUserStatus() {
    const newText = prompt("Новый статус:", document.getElementById('statusText').innerText);
    if (newText) {
        document.getElementById('statusText').innerText = newText;
        localStorage.setItem('userStatus', newText);
    }
}

// --- ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ ---
function openMyOrders() {
    document.getElementById('myOrdersModal').style.display = 'flex';
    const list = document.getElementById('myOrdersList');
    list.innerHTML = '<p style="text-align:center;">Загрузка...</p>';
    
    tg.BackButton.show();
    tg.BackButton.onClick(() => { 
        document.getElementById('myOrdersModal').style.display = 'none'; 
        tg.BackButton.hide(); 
        tg.BackButton.offClick(); 
    });
    
    db.ref('orders').orderByChild('userId').equalTo(myUserId).once('value', snap => renderUserOrders(snap.val(), list));
}

function renderUserOrders(data, container) {
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
            <div class="oc-items">${itemsHtml}</div>
            <div class="oc-footer">
                <span style="font-weight:bold">${order.total} ₽</span>
                <button class="repeat-btn" onclick='repeatOrder(${JSON.stringify(order.items)})'>Повторить</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function repeatOrder(items) {
    cart = items; updateAppState();
    document.getElementById('myOrdersModal').style.display = 'none';
    showPopup('Корзина', 'Товары добавлены!'); toggleCart(true); 
}

// --- АДМИНКА ЗАКАЗОВ (ФИЛЬТРЫ И СОРТИРОВКА) ---

function openAdminOrders() {
    const modal = document.getElementById('adminOrdersModal');
    modal.style.display = 'flex';
    
    const container = document.getElementById('adminOrdersList');
    container.innerHTML = ''; 
    
    let controls = document.getElementById('adminControlsBlock');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'adminControlsBlock';
        controls.className = 'admin-orders-controls';
        controls.innerHTML = `
            <input type="text" id="adminOrderSearch" class="admin-search-input" placeholder="Поиск по нику..." oninput="filterAdminOrders()">
            <div class="admin-filter-scroll">
                <div class="filter-chip active" onclick="setAdminFilter(this, 'all')">Все</div>
                <div class="filter-chip" onclick="setAdminFilter(this, 'new')">Новые</div>
                <div class="filter-chip" onclick="setAdminFilter(this, 'work')">В работе</div>
                <div class="filter-chip" onclick="setAdminFilter(this, 'ship')">Отправл.</div>
                <div class="filter-chip" onclick="setAdminFilter(this, 'done')">Готовые</div>
                <div class="filter-chip" onclick="setAdminFilter(this, 'cancel')">Отмена</div>
            </div>
        `;
        const header = modal.querySelector('.checkout-header');
        if(header && header.nextSibling) {
             modal.insertBefore(controls, header.nextSibling);
        } else {
             modal.appendChild(controls);
        }
    }

    document.getElementById('adminOrderSearch').value = '';
    setAdminFilter(document.querySelector('.filter-chip'), 'all');

    container.innerHTML = '<p style="text-align:center; padding: 20px;">Загрузка заказов...</p>';
    
    tg.BackButton.show();
    tg.BackButton.onClick(() => { 
        modal.style.display = 'none'; 
        tg.BackButton.hide(); 
        tg.BackButton.offClick(); 
    });

    db.ref('orders').limitToLast(100).once('value', snap => {
        const data = snap.val();
        if(!data) {
            allOrdersCache = [];
        } else {
            allOrdersCache = Object.keys(data).map(k => ({...data[k], key: k}));
        }
        filterAdminOrders();
    });
}

function setAdminFilter(el, status) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if(el) el.classList.add('active');
    
    currentAdminFilter = status;
    filterAdminOrders();
}

function filterAdminOrders() {
    const searchVal = document.getElementById('adminOrderSearch').value.toLowerCase();
    const container = document.getElementById('adminOrdersList');
    
    let filtered = allOrdersCache.filter(order => {
        const nameMatch = (order.userName || '').toLowerCase().includes(searchVal);
        const statusMatch = currentAdminFilter === 'all' || order.status === currentAdminFilter;
        return nameMatch && statusMatch;
    });

    const statusWeight = { 'new': 1, 'work': 2, 'ship': 3, 'done': 4, 'cancel': 5 };

    filtered.sort((a, b) => {
        const weightA = statusWeight[a.status] || 99;
        const weightB = statusWeight[b.status] || 99;
        if (weightA !== weightB) return weightA - weightB;
        return b.timestamp - a.timestamp;
    });

    renderAdminOrderListHTML(filtered, container);
}

function renderAdminOrderListHTML(orders, container) {
    container.innerHTML = '';
    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px; opacity:0.6;">Заказов не найдено</p>';
        return;
    }

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
            <div class="oc-header">
                <span>№ ${order.key.slice(-4)} • ${date}</span>
                <span class="oc-status ${stClass}">${stText}</span>
            </div>
            <div style="font-size:14px; font-weight:700; margin-bottom:5px; color:var(--primary); user-select: text;">
                👤 ${order.userName}
            </div>
            <div class="oc-items">${itemsHtml}</div>
            <div style="font-size:13px; color:var(--gray); margin-bottom:10px;">
                <i>${order.comment || 'Нет комментария'}</i> <br>
                Способ: ${order.method === 'table' ? 'В зале' : 'С собой'} • Оплата: ${order.payment === 'stars' ? 'Stars' : 'Карта'}
            </div>
            <div class="oc-footer">
                <span style="font-weight:bold; font-size:16px;">${order.total} ₽</span>
            </div>
            <div class="admin-card-actions">
                <button class="filter-chip ${order.status === 'work' ? 'active' : ''}" onclick="updateStatusAndRefresh('${order.key}', 'work')">В работу</button>
                <button class="filter-chip ${order.status === 'ship' ? 'active' : ''}" onclick="updateStatusAndRefresh('${order.key}', 'ship')">Отправлен</button>
                <button class="filter-chip ${order.status === 'done' ? 'active' : ''}" onclick="updateStatusAndRefresh('${order.key}', 'done')">Готов</button>
                <button class="filter-chip ${order.status === 'cancel' ? 'active' : ''}" onclick="updateStatusAndRefresh('${order.key}', 'cancel')" style="color:#ff4444; border-color:#ff4444;">Отмена</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function updateStatusAndRefresh(key, status) {
    db.ref('orders/' + key).update({ status: status });
    const orderIndex = allOrdersCache.findIndex(o => o.key === key);
    if (orderIndex !== -1) {
        allOrdersCache[orderIndex].status = status;
        filterAdminOrders();
    }
}

// --- СТАТИСТИКА (ИСПРАВЛЕННАЯ ЛОГИКА) ---
function openStats() {
    const modal = document.getElementById('adminStatsModal');
    modal.style.display = 'flex';
    
    // Скрываем контент, показываем лоадер
    const loader = document.getElementById('statsLoader');
    const content = document.getElementById('statsContent');
    if(loader) loader.style.display = 'block';
    if(content) content.style.display = 'none';

    tg.BackButton.show();
    tg.BackButton.onClick(() => { 
        modal.style.display = 'none'; 
        tg.BackButton.hide(); 
        tg.BackButton.offClick(); 
    });
    
    // Загружаем данные
    Promise.all([
        db.ref('orders').once('value'),
        db.ref('users').once('value'),
        db.ref('products').once('value')
    ]).then(([orderSnap, userSnap, productSnap]) => {
        const orders = orderSnap.val() || {};
        const users = userSnap.val() || {};
        const productsMap = productSnap.val() || {};

        // 1. БИЗНЕС МЕТРИКИ
        let totalRevenue = 0;
        let totalOrders = 0;
        const statusCounts = { done: 0, cancel: 0, process: 0 }; 

        Object.values(orders).forEach(o => {
            totalOrders++;
            if (o.status !== 'cancel') totalRevenue += (o.total || 0);
            
            if (o.status === 'done') statusCounts.done++;
            else if (o.status === 'cancel') statusCounts.cancel++;
            else statusCounts.process++;
        });

        // 2. АУДИТОРИЯ (РАЗДЕЛЕНИЕ НА ВСЕХ, DAU и НОВЫХ)
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        let totalUniqueUsers = 0; // Все уникальные записи в базе
        let dau = 0;              // Заходили в последние 24ч (Active Users)
        let newUsers24h = 0;      // Зарегистрировались в последние 24ч

        Object.values(users).forEach(u => {
            totalUniqueUsers++; // Просто счетчик всех
            
            const lastSeen = u.lastSeen || 0;
            const firstSeen = u.firstSeen || 0;

            // Если был онлайн за последние сутки
            if (lastSeen > (now - oneDayMs)) {
                dau++;
            }

            // Если дата первой регистрации была за последние сутки
            if (firstSeen > (now - oneDayMs)) {
                newUsers24h++;
            }
        });

        // 3. ТОВАРЫ
        const totalProducts = Object.keys(productsMap).length;

        // 4. RETENTION (% активных сегодня от общей базы)
        const retentionRate = totalUniqueUsers > 0 ? Math.round((dau / totalUniqueUsers) * 100) : 0;

        // --- ОБНОВЛЕНИЕ DOM ---
        
        // Аудитория
        const elTotalU = document.getElementById('stTotalUsers'); // Всего уникальных
        if(elTotalU) elTotalU.innerText = totalUniqueUsers;

        const elDAU = document.getElementById('stDAU'); // Активные (DAU)
        if(elDAU) elDAU.innerText = dau;
        
        const elNew = document.getElementById('stNewUsers'); // Новые
        if(elNew) elNew.innerText = `+${newUsers24h}`;
        
        const elRet = document.getElementById('stRetention');
        if(elRet) elRet.innerText = `${retentionRate}%`;

        // Бизнес
        const elRev = document.getElementById('stRevenue');
        if(elRev) elRev.innerText = `${totalRevenue.toLocaleString()} ₽`;
        
        const elOrdT = document.getElementById('stOrdersTotal');
        if(elOrdT) elOrdT.innerText = totalOrders;
        
        const elProd = document.getElementById('stProducts');
        if(elProd) elProd.innerText = totalProducts;

        // Графики
        const retBar = document.getElementById('retentionBar');
        if(retBar) retBar.style.width = `${retentionRate}%`;
        
        const donePct = totalOrders ? (statusCounts.done / totalOrders) * 100 : 0;
        const cancelPct = totalOrders ? (statusCounts.cancel / totalOrders) * 100 : 0;
        const procPct = totalOrders ? (statusCounts.process / totalOrders) * 100 : 0;

        const barDone = document.getElementById('barDone');
        if(barDone) barDone.style.width = `${donePct}%`;
        
        const barProc = document.getElementById('barProcess');
        if(barProc) barProc.style.width = `${procPct}%`;
        
        const barCancel = document.getElementById('barCancel');
        if(barCancel) barCancel.style.width = `${cancelPct}%`;

        // Показываем контент
        if(loader) loader.style.display = 'none';
        if(content) content.style.display = 'block';
    });
}