// --- ROOMS VARIABLES ---
let currentRoomId = null;
let roomListener = null;

// --- ENTRY ---
function openRoomLobby(action) {
    document.getElementById('testHub').style.display = 'none';
    
    if (action === 'create') {
        createRoom();
    } else {
        document.getElementById('roomLobby').style.display = 'flex';
        document.getElementById('roomWaiting').style.display = 'none';
        document.getElementById('roomJoinInput').style.display = 'flex';
        document.getElementById('joinCodeInput').value = '';
        tg.BackButton.onClick(openTestHub);
    }
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for(let i=0; i<4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
}

// --- CREATE ---
function createRoom() {
    const code = generateRoomCode();
    currentRoomId = code;
    
    const roomData = {
        host: myUserId,
        status: 'waiting',
        testId: '',
        players: {
            [myUserId]: {
                name: userProfile.name,
                avatar: userProfile.avatar,
                status: 'host'
            }
        }
    };
    
    db.ref(`rooms/${code}`).set(roomData).then(() => {
        setupRoomUI(true, code);
        subscribeToRoom(code);
    });
}

// --- JOIN ---
function joinRoomByCode() {
    const code = document.getElementById('joinCodeInput').value.toUpperCase().trim();
    if (code.length !== 4) return showPopup('Ошибка', 'Код должен быть 4 символа');
    
    db.ref(`rooms/${code}`).once('value', snap => {
        if(!snap.exists()) return showPopup('Ошибка', 'Комната не найдена');
        const room = snap.val();
        if(room.status !== 'waiting') return showPopup('Упс', 'Игра уже идет');
        
        // Добавляем себя
        db.ref(`rooms/${code}/players/${myUserId}`).set({
            name: userProfile.name,
            avatar: userProfile.avatar,
            status: 'ready'
        }).then(() => {
            currentRoomId = code;
            setupRoomUI(false, code);
            subscribeToRoom(code);
        });
    });
}

// --- ROOM LOGIC ---
function subscribeToRoom(code) {
    if(roomListener) db.ref(`rooms/${code}`).off();
    
    roomListener = db.ref(`rooms/${code}`).on('value', snap => {
        const room = snap.val();
        if(!room) {
            leaveRoom(true); // Комната удалена
            return;
        }
        
        // Рендер игроков
        const list = document.getElementById('roomPlayersList');
        list.innerHTML = '';
        Object.values(room.players).forEach(p => {
            const div = document.createElement('div');
            div.className = 'room-player-item';
            div.innerHTML = `
                <img src="${p.avatar}" class="rp-avatar ${p.status === 'finished' ? 'ready' : ''}">
                <div class="rp-name">${p.name}</div>
                <div class="rp-status">${p.status === 'host' ? '👑 Host' : (p.status === 'finished' ? '✅ Готов' : 'В игре')}</div>
            `;
            list.appendChild(div);
        });
        
        // Старт игры (если хост запустил)
        if (room.status === 'playing' && document.getElementById('testPlayer').style.display === 'none') {
            startTest(room.testId, true); // true = режим комнаты
        }

        // Финиш (если все закончили)
        if (room.status === 'finished') {
            showCoopResults(room);
        }
    });
}

function setupRoomUI(isHost, code) {
    document.getElementById('roomLobby').style.display = 'flex';
    document.getElementById('roomWaiting').style.display = 'flex';
    document.getElementById('roomJoinInput').style.display = 'none';
    
    document.getElementById('roomCodeDisplay').innerText = code;
    document.querySelector('.room-code-box').onclick = () => {
        navigator.clipboard.writeText(code);
        showPopup('Скопировано', code);
    };
    
    tg.BackButton.onClick(leaveRoom);

    if (isHost) {
        document.getElementById('roomHostControls').style.display = 'block';
        document.getElementById('roomGuestStatus').style.display = 'none';
        
        // Заполнить селект тестами
        const select = document.getElementById('roomTestSelect');
        select.innerHTML = '';
        allTests.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = t.title;
            select.appendChild(opt);
        });
    } else {
        document.getElementById('roomHostControls').style.display = 'none';
        document.getElementById('roomGuestStatus').style.display = 'block';
    }
}

function startRoomGame() {
    const testId = document.getElementById('roomTestSelect').value;
    if(!testId) return;
    
    // Обновляем статус комнаты
    db.ref(`rooms/${currentRoomId}`).update({
        status: 'playing',
        testId: testId
    });
}

function submitRoomAnswers() {
    // Сохраняем ответы в комнату
    db.ref(`rooms/${currentRoomId}/answers/${myUserId}`).set(userAnswers);
    db.ref(`rooms/${currentRoomId}/players/${myUserId}/status`).set('finished');
    
    // Ждем остальных
    document.getElementById('testPlayer').style.display = 'none';
    document.getElementById('roomLobby').style.display = 'flex';
    document.getElementById('roomWaiting').innerHTML = '<h3>Ожидание других игроков...</h3><div class="room-players-grid" id="roomPlayersList"></div>';
    
    // Проверка (только хост может триггернуть финиш, или любой последний)
    // Упрощение: каждый проверяет, все ли закончили
    db.ref(`rooms/${currentRoomId}`).once('value', snap => {
        const room = snap.val();
        const totalPlayers = Object.keys(room.players).length;
        const totalAnswers = room.answers ? Object.keys(room.answers).length : 0;
        
        if(totalPlayers === totalAnswers) {
            db.ref(`rooms/${currentRoomId}/status`).set('finished');
        }
    });
}

function showCoopResults(room) {
    // Отписываемся, чтобы не мерцало
    if(roomListener) db.ref(`rooms/${currentRoomId}`).off();
    
    document.getElementById('roomLobby').style.display = 'none';
    document.getElementById('testPlayer').style.display = 'none';
    const view = document.getElementById('roomResultScreen');
    view.style.display = 'flex';
    
    // Расчет совместимости (берем первого попавшегося соперника для сравнения, если игроков > 2, логику надо усложнять, тут для 2х)
    const uids = Object.keys(room.answers);
    const myAns = room.answers[myUserId];
    let partnerId = uids.find(id => id !== myUserId);
    
    if(!partnerId) {
        document.getElementById('coopPercent').innerText = "???";
        document.getElementById('coopMessage').innerText = "Второй игрок вышел";
        return;
    }
    
    const partnerAns = room.answers[partnerId];
    const partnerName = room.players[partnerId].name;
    
    let score = 0;
    const total = myAns.length;
    
    for(let i=0; i<total; i++) {
        if(myAns[i] === partnerAns[i]) score++;
    }
    
    const percent = Math.round((score/total)*100);
    
    // Анимация круга
    const circle = document.querySelector('.coop-score-circle');
    circle.style.background = `conic-gradient(var(--primary) ${percent}%, #eee ${percent}%)`;
    document.getElementById('coopPercent').innerText = `${percent}%`;
    
    // Сообщение
    const msgEl = document.getElementById('coopMessage');
    if(percent === 100) msgEl.innerText = `Идеальная пара с ${partnerName}! ❤️`;
    else if(percent >= 70) msgEl.innerText = `Вы с ${partnerName} на одной волне!`;
    else if(percent >= 40) msgEl.innerText = `Есть точки соприкосновения с ${partnerName}.`;
    else msgEl.innerText = `Вы с ${partnerName} очень разные.`;
    
    tg.BackButton.onClick(leaveRoom);
}

function leaveRoom(isForce = false) {
    if(currentRoomId && !isForce) {
        // Удаляем себя или комнату
        db.ref(`rooms/${currentRoomId}/players/${myUserId}`).remove();
        // Если хост уходит - комната все (простая логика)
        // В продакшене лучше передавать хоста
    }
    
    currentRoomId = null;
    if(roomListener) db.ref(`rooms/${currentRoomId}`).off();
    
    document.getElementById('roomLobby').style.display = 'none';
    document.getElementById('roomResultScreen').style.display = 'none';
    openTestHub();
}