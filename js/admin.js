// --- АДМИНКА (ТОВАРЫ) ---
function openAddProduct() {
    resetAdminForm();
    updateAdminCategoryList();
    document.getElementById('adminPanel').style.display = 'flex';
    
    // Скрываем корзину
    const floatCart = document.getElementById('floatingCart');
    if(floatCart) floatCart.style.display = 'none';

    // Скрываем кнопку добавления (плюс), чтобы она не перекрывала панель
    const fab = document.getElementById('adminAddFab');
    if(fab) fab.style.display = 'none';
}

function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    updateAdminCategoryList();
    document.getElementById('adminPanel').style.display = 'flex';
    
    // Скрываем корзину и кнопку
    const floatCart = document.getElementById('floatingCart');
    if(floatCart) floatCart.style.display = 'none';
    const fab = document.getElementById('adminAddFab');
    if(fab) fab.style.display = 'none';

    document.getElementById('adminFormTitle').innerText = "Редактировать";
    document.getElementById('pId').value = id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pCat').value = p.category;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pImg').value = p.img;
    
    // Заполняем поле метки
    const badgeSelect = document.getElementById('pBadge');
    if(badgeSelect) badgeSelect.value = p.badge || '';

    // НОВОЕ: Загрузка состояния чекбоксов
    document.getElementById('pSoldOut').checked = p.isSoldOut || false;
    document.getElementById('pHidden').checked = p.isHidden || false;

    document.getElementById('btnDelete').style.display = 'flex';
    document.getElementById('saveBtn').innerText = 'Обновить';
    document.getElementById('uploadText').innerText = 'Новое фото';
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
    
    // Сброс метки
    const badgeSelect = document.getElementById('pBadge');
    if(badgeSelect) badgeSelect.value = '';

    // НОВОЕ: Сброс чекбоксов
    document.getElementById('pSoldOut').checked = false;
    document.getElementById('pHidden').checked = false;

    document.getElementById('pFile').value = ''; 
    document.querySelector('.admin-upload-box').classList.remove('uploaded');
    document.getElementById('uploadText').innerText = 'Загрузить';
    document.getElementById('btnDelete').style.display = 'none';
    document.getElementById('saveBtn').innerText = 'Сохранить';
}

function toggleAdmin() { 
    document.getElementById('adminPanel').style.display = 'none'; 
    // Возвращаем корзину, если она должна быть видна
    updateCartButton();

    // Возвращаем кнопку добавления (плюс)
    const fab = document.getElementById('adminAddFab');
    if(fab) fab.style.display = 'flex';
}

function saveProduct() {
    const id = document.getElementById('pId').value; 
    const name = document.getElementById('pName').value;
    const desc = document.getElementById('pDesc').value; 
    const price = document.getElementById('pPrice').value;
    const cat = document.getElementById('pCat').value;
    const manualImg = document.getElementById('pImg').value;
    const fileInput = document.getElementById('pFile');
    const saveBtn = document.getElementById('saveBtn');
    const badge = document.getElementById('pBadge') ? document.getElementById('pBadge').value : '';

    // НОВОЕ: Читаем значения чекбоксов
    const isSoldOut = document.getElementById('pSoldOut').checked;
    const isHidden = document.getElementById('pHidden').checked;

    if(!name || !price || !cat) return showPopup('Bot', 'Заполните обязательные поля');
    saveBtn.innerText = '⏳...';

    const finalize = (url) => {
        // НОВОЕ: Сохраняем поля isSoldOut и isHidden
        const d = { 
            name, 
            description: desc, 
            category: cat, 
            price: Number(price), 
            img: url, 
            badge: badge,
            isSoldOut: isSoldOut,
            isHidden: isHidden
        };

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

// --- BANNER EDIT (CROPPER LOGIC) ---
let cropperInstance = null;

function editBanner() {
    // Открываем модальное окно вместо старого prompt
    document.getElementById('bannerEditModal').style.display = 'flex';
    tg.BackButton.show();
    tg.BackButton.onClick(closeBannerEditor);
}

function closeBannerEditor() {
    document.getElementById('bannerEditModal').style.display = 'none';
    if(cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    document.getElementById('bannerCropImage').style.display = 'none';
    document.getElementById('cropPlaceholder').style.display = 'block';
    document.getElementById('bannerInput').value = '';
    
    // Логика кнопки "Назад"
    const cartPage = document.getElementById('cartPage');
    if (cartPage && cartPage.style.display === 'flex') {
        // Оставляем кнопку назад для корзины
    } else {
        tg.BackButton.hide();
        tg.BackButton.offClick();
    }
}

function handleBannerFileSelect(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const image = document.getElementById('bannerCropImage');
            
            // Сброс предыдущего кроппера
            if(cropperInstance) {
                cropperInstance.destroy();
            }

            image.src = e.target.result;
            image.style.display = 'block';
            document.getElementById('cropPlaceholder').style.display = 'none';

            // Инициализация Cropper
            cropperInstance = new Cropper(image, {
                aspectRatio: 3 / 1, // Широкий формат для баннера
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: false,
                center: false,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveBannerCrop() {
    if(!cropperInstance) {
        document.getElementById('bannerInput').click();
        return;
    }

    const saveBtn = document.getElementById('saveBannerBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = 'Загрузка...';
    saveBtn.disabled = true;

    // Получаем обрезанное изображение
    cropperInstance.getCroppedCanvas({
        width: 1200, 
        imageSmoothingQuality: 'high'
    }).toBlob((blob) => {
        const fd = new FormData();
        fd.append("image", blob, "banner.png");

        // Загрузка на ImgBB
        fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { 
            method: "POST", 
            body: fd 
        })
        .then(r => r.json())
        .then(res => {
            if (res.data && res.data.url) {
                // Сохранение в Firebase
                db.ref('settings/banner').set(res.data.url).then(() => {
                    showPopup("Успех", "Обложка обновлена!");
                    closeBannerEditor();
                });
            } else {
                throw new Error('Ошибка загрузки');
            }
        })
        .catch(() => {
            showPopup("Ошибка", "Не удалось загрузить изображение");
        })
        .finally(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        });
    }, 'image/png');
}