// ==========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
let currentTest = null;
let currentQIndex = 0;
let userAnswers = [];
let correctCount = 0; // Для режима Quiz
let allTests = [];
let userProfile = null; // { name, avatar }

// Игровые переменные
let gameTimer = null;
let timeLeft = 0;
let livesLeft = 0;

// Переменные для редактирования (Админ)
let editingTestId = null;

// Комнаты (Multiplayer)
let currentRoomId = null;
let roomListener = null;

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И ПРОФИЛЬ
// ==========================================

function initTests() {
    if (!myUserId) return;
    
    // Загружаем профиль из базы
    db.ref(`test_users/${myUserId}`).once('value', snap => {
        userProfile = snap.val();
        
        // Если профиля нет, берем данные из Telegram (но не сохраняем в базу пока не нажмет "Сохранить")
        if (!userProfile) {
            const tgUser = tg.initDataUnsafe.user;
            userProfile = {
                name: tgUser ? (tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')) : 'Гость',
                avatar: tgUser?.photo_url || 'https://placehold.co/100?text=U'
            };
        }
        
        // Обновляем аватарку в главном меню тестов (Hub)
        const avatarEl = document.getElementById('hubUserAvatar');
        if(avatarEl) avatarEl.src = userProfile.avatar;
    });
}

function openTestHub() {
    initTests(); // Обновляем данные при открытии

    document.getElementById('testHub').style.display = 'flex';
    
    // Гарантированно скрываем все остальные экраны, чтобы избежать наложений
    const screens = ['testPlayer', 'testResultsView', 'testCreator', 'roomLobby', 'roomResultScreen', 'testProfile'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    // Показываем кнопку создания (доступна всем по запросу)
    const createBtn = document.getElementById('adminCreateTestBtn');
    if(createBtn) createBtn.style.display = 'block';

    tg.BackButton.show();
    tg.BackButton.onClick(closeTestHub);
    
    loadTests();
}

function closeTestHub() {
    document.getElementById('testHub').style.display = 'none';
    tg.BackButton.hide();
    tg.BackButton.offClick();
    
    // Если мы пришли из корзины или другого раздела, восстанавливаем кнопку "Назад"
    if(document.getElementById('cartPage') && document.getElementById('cartPage').style.display === 'flex') {
        tg.BackButton.show(); 
        tg.BackButton.onClick(() => toggleCart(false));
    }
}

// --- РЕДАКТИРОВАНИЕ ПРОФИЛЯ ---
function openTestProfile() {
    document.getElementById('testProfile').style.display = 'flex';
    
    const nameInp = document.getElementById('profileNameInput');
    const imgPreview = document.getElementById('profilePreview');
    
    if(userProfile) {
        nameInp.value = userProfile.name;
        imgPreview.src = userProfile.avatar;
    }

    tg.BackButton.show();
    tg.BackButton.onClick(closeTestProfile);
}

function closeTestProfile() {
    document.getElementById('testProfile').style.display = 'none';
    // Возвращаемся в Test Hub
    tg.BackButton.show(); 
    tg.BackButton.onClick(closeTestHub);
}

function handleProfileAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profilePreview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function saveTestProfile() {
    const name = document.getElementById('profileNameInput').value.trim();
    if (!name) return showPopup('Ошибка', 'Введите имя');
    
    const fileInput = document.getElementById('profileAvatarInput');
    const saveBtn = document.querySelector('#testProfile button:last-child');
    const originalText = saveBtn.innerText;
    
    saveBtn.innerText = '⏳';
    
    const finalize = (url) => {
        userProfile = { name, avatar: url };
        db.ref(`test_users/${myUserId}`).set(userProfile).then(() => {
            const hubAvatar = document.getElementById('hubUserAvatar');
            if(hubAvatar) hubAvatar.src = url;
            
            closeTestProfile();
            saveBtn.innerText = originalText;
        });
    };

    if(fileInput.files[0]) {
        const fd = new FormData(); fd.append("image", fileInput.files[0]);
        fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method:"POST", body:fd })
            .then(r => r.json()).then(res => finalize(res.data.url))
            .catch(() => { finalize(userProfile.avatar); }); // Fallback
    } else {
        finalize(document.getElementById('profilePreview').src);
    }
}


// ==========================================
// СПИСОК ТЕСТОВ (ЗАГРУЗКА И РЕНДЕР)
// ==========================================

function loadTests() {
    const list = document.getElementById('testsListContainer');
    list.innerHTML = '<p style="text-align:center; margin-top:40px; color:#999">Загрузка...</p>';
    
    Promise.all([
        db.ref('tests').once('value'),
        db.ref(`test_results_meta/${myUserId}`).once('value')
    ]).then(([testsSnap, resSnap]) => {
        list.innerHTML = '';
        const testsData = testsSnap.val();
        const userResults = resSnap.val() || {};

        if(!testsData) {
            list.innerHTML = '<p style="text-align:center; margin-top:40px; color:#999">Нет тестов</p>';
            return;
        }
        
        allTests = Object.keys(testsData).map(k => ({...testsData[k], id: k}));
        
        allTests.forEach(test => {
            const div = document.createElement('div');
            div.className = 'test-card';
            
            // Проверка прохождения
            const result = userResults[test.id];
            const isPassed = !!result;
            
            // --- ГЛАВНОЕ ИСПРАВЛЕНИЕ КЛИКА ---
            div.onclick = (e) => {
                // Игнорируем клик, если нажали на кнопки админа
                if(e.target.closest('.admin-action-btn')) return;

                if (isPassed) {
                    // Если тест пройден, вызываем Confirm
                    // Благодаря обновленному CSS (z-index: 4000), он теперь будет виден
                    showConfirm(
                        "Пройти заново?", 
                        "Ваш предыдущий результат будет сброшен.", 
                        () => {
                            // Если нажали "Да"
                            startTest(test.id);
                        }
                    );
                } else {
                    // Если новый - сразу старт
                    startTest(test.id);
                }
            };
            
            const isQuiz = test.type === 'quiz';
            const badgeClass = isQuiz ? 'type-quiz' : 'type-match';
            const badgeText = isQuiz ? '🏆 Викторина' : '❤️ Совместимость';
            
            let footerHtml = '';
            
            if (isAdmin) {
                footerHtml = `
                    <div class="admin-test-actions" style="display:flex; gap:10px;">
                        <button class="admin-action-btn btn-edit" onclick="event.stopPropagation(); editTest('${test.id}')" style="background:#e3f2fd; color:#1976d2; border:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-rounded" style="font-size:18px">edit</span>
                        </button>
                        <button class="admin-action-btn btn-delete" onclick="event.stopPropagation(); deleteTest('${test.id}')" style="background:#ffebee; color:#d32f2f; border:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                            <span class="material-symbols-rounded" style="font-size:18px">delete</span>
                        </button>
                    </div>
                `;
            } else {
                if (isPassed) {
                    if (isQuiz) {
                        footerHtml = `
                            <div style="text-align:right;">
                                <div class="last-result" style="font-size:13px; font-weight:800; color:var(--primary);">🏆 ${result.score}/${test.questions.length}</div>
                                <div style="font-size:10px; color:var(--gray);">Нажми для рестарта</div>
                            </div>`;
                    } else {
                        footerHtml = `
                            <div style="text-align:right;">
                                <div class="last-result" style="font-size:13px; font-weight:800; color:#4CAF50;">✅ Пройдено</div>
                                <div style="font-size:10px; color:var(--gray);">Нажми для рестарта</div>
                            </div>`;
                    }
                } else {
                    footerHtml = `<span style="color:var(--primary); font-weight:bold; font-size:14px;">👉 Начать</span>`;
                }
            }
            
            const qCount = test.questions ? test.questions.length : 0;

            div.innerHTML = `
                <img src="${test.image}" class="test-cover" onerror="this.src='https://placehold.co/600x300?text=Quiz'">
                <div class="test-card-content">
                    <span class="test-type-badge ${badgeClass}">${badgeText}</span>
                    <div class="test-title">${test.title}</div>
                    <div class="test-desc">${test.description}</div>
                    <div class="test-footer">
                        <span style="font-size:12px; color:var(--gray)">${qCount} вопросов</span>
                        ${footerHtml}
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    });
}


// ==========================================
// ИГРОВОЙ ПРОЦЕСС (PLAYER ENGINE)
// ==========================================

function startTest(id, isRoomMode = false) {
    currentTest = allTests.find(t => t.id === id);
    if(!currentTest || !currentTest.questions) return showPopup('Ошибка', 'Тест пустой');
    
    currentQIndex = 0;
    userAnswers = [];
    correctCount = 0;
    
    // Настройки режима
    const isQuiz = currentTest.type === 'quiz';
    livesLeft = (isQuiz && currentTest.lives) ? parseInt(currentTest.lives) : 999;
    const hasTimer = (isQuiz && currentTest.timer) && parseInt(currentTest.timer) > 0;
    
    // UI: Скрываем все, показываем плеер
    document.getElementById('testHub').style.display = 'none';
    document.getElementById('roomLobby').style.display = 'none';
    document.getElementById('testResultsView').style.display = 'none'; // Скрыть результаты если рестарт
    
    const player = document.getElementById('testPlayer');
    player.style.display = 'flex'; 
    
    // Настройка статус-бара
    const statsBar = document.getElementById('tpStatsBar');
    if (isQuiz && (hasTimer || livesLeft < 99)) {
        statsBar.style.display = 'flex';
        document.getElementById('tpLives').innerHTML = livesLeft < 99 ? `<span class="material-symbols-rounded">favorite</span> ${livesLeft}` : '';
        document.getElementById('tpTimer').innerHTML = '';
    } else {
        statsBar.style.display = 'none';
    }
    
    tg.BackButton.onClick(() => {
        showConfirm('Выход', 'Прервать тест?', () => {
            stopGameTimer();
            if(isRoomMode) leaveRoom(); 
            else openTestHub();
        });
    });
    
    renderQuestion(isRoomMode);
}

function renderQuestion(isRoomMode) {
    stopGameTimer();
    
    const q = currentTest.questions[currentQIndex];
    const total = currentTest.questions.length;
    const percent = (currentQIndex / total) * 100;
    
    document.getElementById('tpBar').style.width = `${percent}%`;
    document.getElementById('tpQuestionText').innerText = q.text;
    
    const optsCont = document.getElementById('tpOptionsCont');
    optsCont.innerHTML = '';
    
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'tp-btn';
        btn.innerText = opt;
        btn.disabled = false; // Разблокируем кнопки
        btn.onclick = () => selectAnswer(idx, btn, isRoomMode);
        optsCont.appendChild(btn);
    });

    // Запуск таймера
    if(currentTest.type === 'quiz' && currentTest.timer && parseInt(currentTest.timer) > 0) {
        timeLeft = parseInt(currentTest.timer);
        updateTimerDisplay();
        
        gameTimer = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if(timeLeft <= 0) {
                stopGameTimer();
                handleTimeOut(isRoomMode);
            }
        }, 1000);
    }
}

function updateTimerDisplay() {
    document.getElementById('tpTimer').innerHTML = `<span class="material-symbols-rounded">timer</span> ${timeLeft}`;
}

function handleTimeOut(isRoomMode) {
    if (currentTest.type !== 'quiz') return;
    
    livesLeft--;
    document.getElementById('tpLives').innerHTML = `<span class="material-symbols-rounded">favorite</span> ${livesLeft}`;
    
    // Блокируем кнопки
    document.querySelectorAll('.tp-btn').forEach(b => b.disabled = true);

    if(livesLeft <= 0) {
        showPopup("Game Over", "Время вышло! 💀");
        setTimeout(() => isRoomMode ? leaveRoom() : openTestHub(), 1500);
    } else {
        showPopup("Время вышло!", "Минус жизнь ❤️‍🩹");
        setTimeout(() => nextQuestion(isRoomMode), 1000);
    }
}

function selectAnswer(idx, btnEl, isRoomMode) {
    if(gameTimer) clearInterval(gameTimer); // Пауза таймера
    
    // Блокируем кнопки от повторного нажатия
    document.querySelectorAll('.tp-btn').forEach(b => b.disabled = true);

    const isQuiz = currentTest.type === 'quiz';
    const q = currentTest.questions[currentQIndex];
    const correctIdx = (q.correct !== undefined) ? parseInt(q.correct) : -1;
    
    const proceed = () => {
        userAnswers.push(idx);
        setTimeout(() => nextQuestion(isRoomMode), isQuiz ? 1000 : 400);
    };

    if (isQuiz) {
        // РЕЖИМ ВИКТОРИНЫ
        if (idx === correctIdx) {
            btnEl.classList.add('correct');
            correctCount++;
            tg.HapticFeedback.notificationOccurred('success');
            proceed();
        } else {
            btnEl.classList.add('wrong');
            tg.HapticFeedback.notificationOccurred('error');
            
            // Подсветка правильного
            const allBtns = document.querySelectorAll('.tp-btn');
            if(allBtns[correctIdx]) allBtns[correctIdx].classList.add('correct');
            
            livesLeft--;
            document.getElementById('tpLives').innerHTML = `<span class="material-symbols-rounded">favorite</span> ${livesLeft}`;
            
            if(livesLeft <= 0) {
                setTimeout(() => {
                    showPopup("Game Over", "Жизни закончились 💀");
                    if(isRoomMode) leaveRoom(); else openTestHub();
                }, 1500);
            } else {
                proceed();
            }
        }
    } else {
        // РЕЖИМ СОВМЕСТИМОСТИ
        btnEl.classList.add('selected');
        tg.HapticFeedback.selectionChanged();
        proceed();
    }
}

function nextQuestion(isRoomMode) {
    if(currentQIndex < currentTest.questions.length - 1) {
        currentQIndex++;
        renderQuestion(isRoomMode);
    } else {
        if(isRoomMode) {
            submitRoomAnswers(); // Логика комнат
        } else {
            finishSingleTest(); // Логика соло
        }
    }
}

function stopGameTimer() {
    if(gameTimer) { clearInterval(gameTimer); gameTimer = null; }
}

function finishSingleTest() {
    document.getElementById('tpBar').style.width = '100%';
    
    const resultData = {
        userId: myUserId,
        userName: userProfile.name,
        userPhoto: userProfile.avatar,
        answers: userAnswers,
        score: correctCount,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // 1. Сохраняем детальный результат (для матчинга)
    db.ref(`test_results/${currentTest.id}/${myUserId}`).set(resultData);
    
    // 2. Сохраняем мета-результат (для отображения на карточке)
    db.ref(`test_results_meta/${myUserId}/${currentTest.id}`).set({
        score: correctCount,
        passed: true
    }).then(() => {
        showSoloResults();
    });
}


// ==========================================
// ЭКРАН РЕЗУЛЬТАТОВ (SOLO)
// ==========================================

function showSoloResults() {
    document.getElementById('testPlayer').style.display = 'none';
    const view = document.getElementById('testResultsView');
    view.style.display = 'flex';
    view.innerHTML = '';
    
    tg.BackButton.onClick(openTestHub);
    
    const header = document.createElement('div');
    header.className = 'tr-header';
    header.innerHTML = `<div class="tr-score">Тест завершен</div><h3 class="tr-title">${currentTest.title}</h3>`;
    view.appendChild(header);

    // Кнопки действий
    const buttonsHtml = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; width:100%; margin-top:20px;">
            <button class="pay-btn" onclick="startTest('${currentTest.id}')" style="background:var(--card); color:var(--text); border:1px solid var(--border);">🔄 Заново</button>
            <button class="pay-btn" onclick="openTestHub()">В меню</button>
        </div>
    `;

    if (currentTest.type === 'quiz') {
        // --- ВИКТОРИНА (Счет) ---
        const box = document.createElement('div');
        box.className = 'quiz-result-box';
        const total = currentTest.questions.length;
        const pct = Math.round((correctCount/total)*100);
        
        let msg = "Неплохо!";
        if(pct === 100) msg = "Идеально! 🎉";
        else if(pct >= 80) msg = "Отличный результат! 🔥";
        else if(pct < 50) msg = "Попробуй еще раз 💪";

        box.innerHTML = `
            <div class="quiz-score-big">${correctCount}/${total}</div>
            <div class="quiz-msg">${msg}</div>
            ${buttonsHtml}
        `;
        view.appendChild(box);
        
    } else {
        // --- СОВМЕСТИМОСТЬ (Список) ---
        const listContainer = document.createElement('div');
        listContainer.className = 'match-list';
        listContainer.innerHTML = '<p style="text-align:center;color:#999;margin-top:20px">Ищем совпадения...</p>';
        view.appendChild(listContainer);
        
        const btnContainer = document.createElement('div');
        btnContainer.style.padding = '20px';
        btnContainer.innerHTML = buttonsHtml;
        view.appendChild(btnContainer);

        db.ref(`test_results/${currentTest.id}`).once('value', snap => {
            const data = snap.val();
            if(!data) {
                listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#999">Ты первый!</div>';
                return;
            }
            
            const myRes = data[myUserId];
            const matches = [];
            
            Object.keys(data).forEach(uid => {
                if(uid === myUserId) return;
                const other = data[uid];
                let score = 0;
                const len = Math.min(myRes.answers.length, other.answers ? other.answers.length : 0);
                if(len === 0) return;
                
                for(let i=0; i<len; i++) {
                    if(myRes.answers[i] === other.answers[i]) score++;
                }
                const percent = Math.round((score / len) * 100);
                matches.push({...other, percent});
            });
            
            matches.sort((a,b) => b.percent - a.percent);
            
            listContainer.innerHTML = '';
            if(matches.length === 0) {
                listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#999">Пока не с кем сравнивать</div>';
            }
            
            matches.forEach(m => {
                const item = document.createElement('div');
                item.className = 'match-item';
                item.innerHTML = `
                    <img src="${m.userPhoto}" class="match-avatar" onerror="this.src='https://placehold.co/100?text=U'">
                    <div class="match-info">
                        <div class="match-name">${m.userName}</div>
                        <div class="match-label">Совпадение</div>
                    </div>
                    <div class="match-percent" style="color:${getPercentColor(m.percent)}">${m.percent}%</div>
                `;
                listContainer.appendChild(item);
            });
        });
    }
}

function getPercentColor(p) {
    if(p >= 80) return '#4CAF50';
    if(p >= 50) return '#FFC107';
    return '#ff4444';
}


// ==========================================
// КОМНАТЫ (MULTIPLAYER)
// ==========================================

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
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

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

function joinRoomByCode() {
    const code = document.getElementById('joinCodeInput').value.toUpperCase().trim();
    if(code.length !== 4) return showPopup('Ошибка', 'Неверный код');
    
    db.ref(`rooms/${code}`).once('value', snap => {
        if(!snap.exists()) return showPopup('Ошибка', 'Комната не найдена');
        if(snap.val().status !== 'waiting') return showPopup('Ошибка', 'Игра уже идет');
        
        db.ref(`rooms/${code}/players/${myUserId}`).set({
            name: userProfile.name, avatar: userProfile.avatar, status: 'ready'
        }).then(() => {
            currentRoomId = code;
            setupRoomUI(false, code);
            subscribeToRoom(code);
        });
    });
}

function subscribeToRoom(code) {
    if(roomListener) db.ref(`rooms/${code}`).off();
    
    roomListener = db.ref(`rooms/${code}`).on('value', snap => {
        const room = snap.val();
        if(!room) {
            if (currentRoomId) leaveRoom(true); 
            return;
        }
        
        // Рендер игроков
        const list = document.getElementById('roomPlayersList');
        if(list) {
            list.innerHTML = '';
            if (room.players) {
                Object.values(room.players).forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'room-player-item';
                    div.innerHTML = `
                        <img src="${p.avatar}" class="rp-avatar ${p.status === 'finished' ? 'ready' : ''}">
                        <div class="rp-name">${p.name}</div>
                        <div class="rp-status">${p.status === 'host' ? '👑' : (p.status === 'finished' ? '✅' : '')}</div>
                    `;
                    list.appendChild(div);
                });
            }
        }
        
        // Старт игры (синхронно)
        if (room.status === 'playing' && document.getElementById('testPlayer').style.display === 'none') {
            if (!room.testId) return;
            startTest(room.testId, true); 
        }

        // Финиш
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
        
        const select = document.getElementById('roomTestSelect');
        select.innerHTML = '<option disabled selected>Выберите тест...</option>';
        allTests.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.title}</option>`;
        });
    } else {
        document.getElementById('roomHostControls').style.display = 'none';
        document.getElementById('roomGuestStatus').style.display = 'block';
    }
}

function startRoomGame() {
    const testId = document.getElementById('roomTestSelect').value;
    if(!testId || testId.includes('Выберите')) return showPopup('Инфо', 'Выберите тест');
    db.ref(`rooms/${currentRoomId}`).update({ status: 'playing', testId: testId });
}

function submitRoomAnswers() {
    db.ref(`rooms/${currentRoomId}/answers/${myUserId}`).set(userAnswers);
    db.ref(`rooms/${currentRoomId}/players/${myUserId}/status`).set('finished');
    
    document.getElementById('testPlayer').style.display = 'none';
    document.getElementById('roomLobby').style.display = 'flex';
    document.getElementById('roomWaiting').innerHTML = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;"><h3>Ожидание других игроков...</h3></div>';
    
    // Проверка финиша
    db.ref(`rooms/${currentRoomId}`).once('value', snap => {
        const r = snap.val();
        if(Object.keys(r.players).length === Object.keys(r.answers || {}).length) {
            db.ref(`rooms/${currentRoomId}/status`).set('finished');
        }
    });
}

function showCoopResults(room) {
    if(roomListener) db.ref(`rooms/${currentRoomId}`).off();
    
    document.getElementById('roomLobby').style.display = 'none';
    document.getElementById('testPlayer').style.display = 'none';
    document.getElementById('roomResultScreen').style.display = 'flex';
    
    const uids = Object.keys(room.answers || {});
    if(uids.length < 2) {
        document.getElementById('coopPercent').innerText = "?";
        document.getElementById('coopMessage').innerText = "Недостаточно игроков";
    } else {
        const myAns = room.answers[myUserId];
        const partnerId = uids.find(id => id !== myUserId);
        const partnerAns = room.answers[partnerId];
        const partnerName = room.players[partnerId].name;
        
        let score = 0;
        const total = Math.min(myAns.length, partnerAns.length);
        for(let i=0; i<total; i++) if(myAns[i] === partnerAns[i]) score++;
        const pct = Math.round((score/total)*100);
        
        document.querySelector('.coop-score-circle').style.background = `conic-gradient(var(--primary) ${pct}%, #eee ${pct}%)`;
        document.getElementById('coopPercent').innerText = `${pct}%`;
        document.getElementById('coopMessage').innerText = `Совместимость с ${partnerName}`;
    }
    
    tg.BackButton.onClick(() => leaveRoom());
}

function leaveRoom(isForce=false) {
    if(currentRoomId && !isForce) {
        db.ref(`rooms/${currentRoomId}/players/${myUserId}`).remove();
    }
    currentRoomId = null;
    if(roomListener) db.ref(`rooms/${currentRoomId}`).off();
    
    document.getElementById('roomLobby').style.display = 'none';
    document.getElementById('roomResultScreen').style.display = 'none';
    
    // Восстанавливаем UI для следующего раза
    document.getElementById('roomWaiting').innerHTML = `
        <div class="room-code-box"><span style="font-size:12px;color:var(--gray)">КОД</span><h1 id="roomCodeDisplay">----</h1></div>
        <div class="room-players-grid" id="roomPlayersList"></div>
        <div style="margin-top:auto"><div id="roomHostControls" style="display:none"><select id="roomTestSelect" class="room-select-styled"></select><button class="pay-btn" onclick="startRoomGame()" style="margin-top:15px">Старт</button></div><div id="roomGuestStatus" style="display:none;color:var(--gray)">Ожидаем...</div></div>
    `;
    
    openTestHub();
}


// ==========================================
// АДМИНКА (СОЗДАНИЕ И РЕДАКТИРОВАНИЕ)
// ==========================================

function openTestCreator() {
    document.getElementById('testHub').style.display = 'none';
    document.getElementById('testCreator').style.display = 'flex';
    editingTestId = null; // Режим создания
    
    // Сброс
    document.getElementById('tcTitle').value = '';
    document.getElementById('tcDesc').value = '';
    document.getElementById('tcTimer').value = '';
    document.getElementById('tcLives').value = '';
    document.getElementById('tcCoverPreview').src = '';
    document.querySelector('.creator-cover-upload span').style.display = 'block';
    
    setCreatorMode('quiz');
    document.getElementById('tcQuestions').innerHTML = '';
    addCreatorQuestion();
    
    tg.BackButton.onClick(openTestHub);
}

function editTest(id) {
    document.getElementById('testHub').style.display = 'none';
    document.getElementById('testCreator').style.display = 'flex';
    editingTestId = id; // Режим редактирования
    
    const t = allTests.find(x => x.id === id);
    if(!t) return openTestHub();
    
    document.getElementById('tcTitle').value = t.title;
    document.getElementById('tcDesc').value = t.description;
    document.getElementById('tcTimer').value = t.timer || '';
    document.getElementById('tcLives').value = t.lives || '';
    
    if(t.image) {
        document.getElementById('tcCoverPreview').src = t.image;
        document.querySelector('.creator-cover-upload span').style.display = 'none';
    }
    
    setCreatorMode(t.type || 'quiz');
    
    const cont = document.getElementById('tcQuestions');
    cont.innerHTML = '';
    if(t.questions) {
        t.questions.forEach((q, idx) => {
            const div = document.createElement('div');
            div.className = `tc-block mode-${t.type||'quiz'}`;
            div.innerHTML = `
                <div class="tc-q-header"><span>Вопрос #${idx+1}</span><span class="tc-del-q" onclick="this.parentElement.parentElement.remove()">Удалить</span></div>
                <input type="text" class="checkout-input q-text" placeholder="Текст вопроса" value="${q.text}" style="margin-bottom:10px">
                <div class="q-opts-container">
                    ${q.options.map((opt, i) => createOptionRowHTML(idx, i, q.correct === i, opt)).join('')}
                </div>
                <div class="tc-add-opt" onclick="addOptionToQ(this, ${idx})">+ Вариант</div>
            `;
            cont.appendChild(div);
        });
    }
    
    tg.BackButton.onClick(openTestHub);
}

function setCreatorMode(mode) {
    document.querySelectorAll('.type-opt').forEach(el => el.classList.remove('active'));
    document.querySelector(`.type-opt[data-mode="${mode}"]`).classList.add('active');
    document.getElementById('tcQuestions').dataset.mode = mode;
    document.querySelectorAll('.tc-block').forEach(b => b.className = `tc-block mode-${mode}`);
}

function handleCoverUpload(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('tcCoverPreview').src = e.target.result;
            document.querySelector('.creator-cover-upload span').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function addCreatorQuestion() {
    const cont = document.getElementById('tcQuestions');
    const idx = cont.children.length;
    const mode = cont.dataset.mode || 'quiz';
    const div = document.createElement('div');
    div.className = `tc-block mode-${mode}`;
    div.innerHTML = `
        <div class="tc-q-header"><span>Вопрос #${idx+1}</span><span class="tc-del-q" onclick="this.parentElement.parentElement.remove()">Удалить</span></div>
        <input type="text" class="checkout-input q-text" placeholder="Текст вопроса" style="margin-bottom:10px">
        <div class="q-opts-container">${createOptionRowHTML(idx, 0, true)}${createOptionRowHTML(idx, 1)}</div>
        <div class="tc-add-opt" onclick="addOptionToQ(this, ${idx})">+ Вариант</div>
    `;
    cont.appendChild(div);
}

function createOptionRowHTML(qIdx, optIdx, isCorrect=false, val='') {
    return `<div class="q-opt-row"><input type="radio" name="q${qIdx}_correct" value="${optIdx}" class="q-correct-radio" ${isCorrect?'checked':''}><input type="text" class="checkout-input q-opt" placeholder="Ответ" value="${val}"></div>`;
}

function addOptionToQ(el, qIdx) {
    const container = el.previousElementSibling;
    const optIdx = container.children.length;
    const div = document.createElement('div');
    div.className = 'q-opt-row';
    div.innerHTML = `<input type="radio" name="q${qIdx}_correct" value="${optIdx}" class="q-correct-radio"><input type="text" class="checkout-input q-opt" placeholder="Ответ">`;
    container.appendChild(div);
}

function saveNewTest() {
    const title = document.getElementById('tcTitle').value;
    const mode = document.getElementById('tcQuestions').dataset.mode;
    if(!title) return showPopup('Ошибка', 'Введите название');
    
    const saveBtn = document.querySelector('#testCreator .tests-header button:last-child');
    saveBtn.innerText = '⏳';

    const questions = [];
    document.querySelectorAll('.tc-block').forEach(block => {
        const text = block.querySelector('.q-text').value;
        const options = [];
        let correct = 0;
        
        block.querySelectorAll('.q-opt-row').forEach((row, i) => {
            const val = row.querySelector('.q-opt').value;
            if(val) {
                options.push(val);
                if(row.querySelector('input[type="radio"]').checked) correct = i;
            }
        });
        
        if(text && options.length > 1) {
            questions.push({ text, options, correct });
        }
    });
    
    if(questions.length === 0) { saveBtn.innerText = 'OK'; return showPopup('Ошибка', 'Добавьте вопросы'); }

    const coverInput = document.getElementById('tcCoverInput');
    const finalize = (img) => {
        const testData = {
            title, description: document.getElementById('tcDesc').value,
            image: img, type: mode,
            timer: document.getElementById('tcTimer').value,
            lives: document.getElementById('tcLives').value,
            questions
        };
        
        if (editingTestId) {
            db.ref(`tests/${editingTestId}`).update(testData).then(() => {
                showPopup('Успех', 'Тест обновлен'); saveBtn.innerText = 'OK'; openTestHub();
            });
        } else {
            db.ref('tests').push(testData).then(() => {
                showPopup('Успех', 'Тест создан'); saveBtn.innerText = 'OK'; openTestHub();
            });
        }
    };

    if(coverInput.files[0]) {
        const fd = new FormData(); fd.append("image", coverInput.files[0]);
        fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {method:"POST", body:fd})
            .then(r=>r.json()).then(d => finalize(d.data.url))
            .catch(() => finalize(editingTestId ? allTests.find(x=>x.id===editingTestId).image : 'https://placehold.co/600x300'));
    } else {
        const oldImg = editingTestId ? allTests.find(x=>x.id===editingTestId).image : 'https://placehold.co/600x300';
        finalize(oldImg);
    }
}

function deleteTest(id) {
    if(confirm('Удалить тест?')) {
        db.ref('tests/' + id).remove();
        loadTests();
    }
}