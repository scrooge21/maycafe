// --- КОРЗИНА И ОФОРМЛЕНИЕ ---

function addToCart(id) {
    const p = products.find(x => x.id === id);
    
    // БЛОКИРОВКА: Не добавлять, если Sold Out
    if (p && p.isSoldOut) {
        showPopup("Упс", "Этот товар закончился 😔");
        return;
    }

    if(!cart[id]) {
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
                    <div class="cart-price-large">${item.price} ₽</div>
                </div>
                <div class="qty-control">
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

// Промокод через модальное окно
function promptPromo() {
    const modal = document.getElementById('promoModal');
    if(modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('promoInput');
        if(input) {
            input.value = '';
            input.focus();
        }
    } else {
        // Fallback если модалки нет (старая версия)
        const code = prompt("Введите промокод (например MAY10):");
        if(code) processPromoCode(code);
    }
}

function closePromoModal() {
    const modal = document.getElementById('promoModal');
    if(modal) modal.style.display = 'none';
}

function applyPromoCode() {
    const input = document.getElementById('promoInput');
    if(input) {
        processPromoCode(input.value);
    }
    closePromoModal();
}

function processPromoCode(code) {
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
    
    // Скрываем плавающую корзину и кнопку админа
    const floatBtn = document.getElementById('floatingCart');
    const adminFab = document.getElementById('adminAddFab');
    if(floatBtn) floatBtn.style.display = 'none';
    if(adminFab) adminFab.style.display = 'none';

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
    
    // Восстанавливаем кнопки
    updateCartButton(); 
    
    if(isAdmin) {
        const adminFab = document.getElementById('adminAddFab');
        if(adminFab) adminFab.style.display = 'flex';
    }

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
        
        if(isAdmin) {
             const adminFab = document.getElementById('adminAddFab');
             if(adminFab) adminFab.style.display = 'flex';
        }

        showPopup('Успех', 'Заказ принят! Статус в профиле.');
        tg.HapticFeedback.notificationOccurred('success');
    });
}