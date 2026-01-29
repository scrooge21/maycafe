// --- РЕНДЕР КАТЕГОРИЙ ---
function renderCategories() {
    const nav = document.getElementById('categoryNav');
    const cats = [...new Set(products.map(p => p.category))];
    nav.innerHTML = '';
    cats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = `category-btn ${c === currentCat ? 'active' : ''}`;
        btn.innerText = c;
        btn.onclick = () => { 
            currentCat = c; 
            updateAppState(); 
            tg.HapticFeedback.selectionChanged(); 
        };
        nav.appendChild(btn);
    });
}

// --- РЕНДЕР МЕНЮ ---
function renderMenu() {
    const cont = document.getElementById('menuContainer');
    cont.innerHTML = '';
    
    // Фильтрация: Категория + Скрытые товары (скрываем, если не админ)
    const filtered = products.filter(p => {
        if (!isAdmin && p.isHidden) return false;
        return p.category === currentCat;
    });
    
    if(filtered.length === 0) {
        cont.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#999; padding:20px">Пусто 🐰</div>';
        return;
    }
    filtered.forEach(p => createProductCard(p, cont));
}

// --- РЕНДЕР ПОПУЛЯРНОГО (FEATURED) ---
function renderFeatured() {
    const grid = document.getElementById('featuredGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    // Берем первые 4 товара, исключая скрытые для обычных юзеров
    const featuredItems = products
        .filter(p => isAdmin || !p.isHidden)
        .slice(0, 4);

    featuredItems.forEach(p => createProductCard(p, grid));
}

// --- СОЗДАНИЕ КАРТОЧКИ ТОВАРА ---
function createProductCard(p, container) {
    const div = document.createElement('div');
    // Добавляем класс sold-out для серого цвета
    div.className = `item-card ${p.isSoldOut ? 'sold-out' : ''}`;
    div.onclick = () => openProductDetail(p.id); 
    
    let badgeHtml = '';
    // Приоритет: Sold Out -> Badge
    if (p.isSoldOut) {
        badgeHtml = `<div class="item-badge badge-soldout">SOLD OUT</div>`;
    } else if (p.badge) {
        badgeHtml = `<div class="item-badge badge-${p.badge}">${p.badge}</div>`;
    }

    // Иконка "Скрытый товар" для админа
    let hiddenIcon = (isAdmin && p.isHidden) ? '<div class="badge-hidden-icon"><span class="material-symbols-rounded" style="font-size:14px">visibility_off</span></div>' : '';

    div.innerHTML = `
        ${badgeHtml}
        ${hiddenIcon}
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

// --- ГЕНЕРАЦИЯ КНОПКИ В КАРТОЧКЕ ---
function getProductButtonHtml(p) {
    // Если товар закончился - неактивная кнопка
    if (p.isSoldOut) {
        return `<button class="add-btn" disabled>Закончился</button>`;
    }

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

// --- КНОПКА В ДЕТАЛЯХ ---
function renderDetailButton(id) {
    const p = products.find(x => x.id === id);
    const container = document.getElementById('detailBtnContainer');
    
    // Если товар закончился
    if (p.isSoldOut) {
        container.innerHTML = `
            <button class="detail-add-btn" disabled style="background:#ccc; box-shadow:none; cursor:not-allowed;">
                Товар закончился
            </button>
        `;
        return;
    }

    // Если товар в корзине - показываем счетчик
    if (cart[id]) {
        container.innerHTML = `
            <div class="detail-counter-box">
                <button onclick="modQty('${id}', -1)" class="dc-btn">−</button>
                <span class="dc-val">${cart[id].qty}</span>
                <button onclick="modQty('${id}', 1)" class="dc-btn">+</button>
            </div>
        `;
    } 
    // Если товара НЕТ в корзине - показываем большую кнопку добавления
    else {
        container.innerHTML = `
            <button class="detail-add-btn" onclick="addToCart('${id}')">
                + ${p.price} ₽
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

// --- ПОИСК ---
function openSearchModal() {
    document.getElementById('searchModal').style.display = 'flex';
    document.getElementById('searchInput').focus();
    
    document.getElementById('searchTagsBlock').style.display = 'block';
    document.getElementById('searchResultsGrid').innerHTML = '';

    const tagCont = document.getElementById('popularTagsContainer');
    if (tagCont) {
        tagCont.innerHTML = ''; 
        // Показываем в тегах только не скрытые (или все, если админ)
        const popularItems = products.filter(p => isAdmin || !p.isHidden).slice(0, 8); 
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

    const found = products.filter(p => {
        // Фильтр скрытых
        if (!isAdmin && p.isHidden) return false;
        
        return p.name.toLowerCase().includes(cleanQuery) || 
               (p.description && p.description.toLowerCase().includes(cleanQuery));
    });

    if (found.length === 0) {
        resultsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#999; margin-top:20px">Ничего не найдено 😔</div>';
        return;
    }

    found.forEach(p => createProductCard(p, resultsGrid));
}