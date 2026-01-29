// --- ЧАТ (ЛОГИКА ОБНОВЛЕНА: FIX SHORT CHAT & ADMIN NAV) ---

// Вспомогательная функция для принудительного показа панелей
function resetNavVisibility() {
    const nav = document.querySelector('.bottom-nav');
    const inputArea = document.querySelector('.chat-input-area');
    
    if (nav) nav.classList.remove('hidden');
    if (inputArea) inputArea.classList.remove('nav-hidden-pos');
}

function initChatInputLogic() {
    const input = document.getElementById('chatInput');
    const nav = document.querySelector('.bottom-nav');
    const chatContainer = document.getElementById('chatConversationView');
    const chatHistory = document.getElementById('chatHistoryArea');
    const inputArea = document.querySelector('.chat-input-area');

    // ЛОГИКА КЛАВИАТУРЫ
    if(input && nav && chatContainer) {
        input.addEventListener('focus', () => {
            nav.classList.add('hidden');
            chatContainer.classList.add('keyboard-open');
            setTimeout(() => {
                if(chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 300);
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.activeElement !== input) {
                    resetNavVisibility(); // Возвращаем панели
                    chatContainer.classList.remove('keyboard-open');
                }
            }, 100);
        });
    }

    // ЛОГИКА СКРЫТИЯ ПАНЕЛИ ПРИ СКРОЛЛЕ
    if (chatHistory && nav && inputArea) {
        let lastScrollTop = 0;
        
        chatHistory.addEventListener('scroll', () => {
            // 1. Если клавиатура открыта — не скрываем
            if (document.activeElement === input) return;

            // 2. ВАЖНО: Если контента мало (нет скролла или он маленький), 
            // панель должна быть ВСЕГДА видна.
            // Проверяем: если высота контента меньше высоты окна + небольшой запас
            if (chatHistory.scrollHeight <= chatHistory.clientHeight + 50) {
                resetNavVisibility();
                return;
            }

            const st = chatHistory.scrollTop;
            
            // Игнорируем "отскок" на iOS
            if (st < 0 || st + chatHistory.clientHeight > chatHistory.scrollHeight) return;

            if (Math.abs(st - lastScrollTop) > 5) {
                if (st < lastScrollTop) {
                    // Скролл ВВЕРХ (к старым) -> СКРЫВАЕМ
                    nav.classList.add('hidden');
                    inputArea.classList.add('nav-hidden-pos');
                } else {
                    // Скролл ВНИЗ (к новым) -> ПОКАЗЫВАЕМ
                    nav.classList.remove('hidden');
                    inputArea.classList.remove('nav-hidden-pos');
                }
            }
            lastScrollTop = st;
        }, { passive: true });
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
        input.focus();
    }
}

function handleSend() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;
    sendMessageInternal(text, 'text');
}

function renderSupportTab() {
    resetNavVisibility(); // СБРОС ПРИ ВХОДЕ В ВКЛАДКУ

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
    // Убеждаемся, что навигация видна в списке чатов
    resetNavVisibility();

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
    
    resetNavVisibility(); // СБРОС ПРИ ОТКРЫТИИ ЧАТА
    
    initChatInputLogic(); 
    loadMessages(uid);
}

function backToChatList() {
    activeChatUserId = null;
    document.getElementById('chatConversationView').style.display = 'none';
    document.getElementById('adminChatListView').style.display = 'flex';
    
    resetNavVisibility(); // СБРОС ПРИ ВОЗВРАТЕ В СПИСОК
}

function initUserChat() {
    loadMessages(myUserId);
}

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

function loadMessages(uid) {
    const chatArea = document.getElementById('chatHistoryArea');
    db.ref(`chats/${uid}/messages`).off();
    db.ref(`chats/${uid}/messages`).on('value', snapshot => {
        chatArea.innerHTML = '';
        const data = snapshot.val();
        if(data) {
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