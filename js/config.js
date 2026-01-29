// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBe3qvdQ-KHKaWeoagyma7muuxZyR9Kv-4", 
    authDomain: "maycafedb.firebaseapp.com",
    projectId: "maycafedb",
    storageBucket: "maycafedb.firebasestorage.app",
    messagingSenderId: "943112925202",
    appId: "1:943112925202:web:39a6634c1cab0e138f28cb"
};

const IMGBB_API_KEY = "e944f82b12294300e3c67aa8fa6d1672"; 
// ID пользователей Telegram, которые являются админами
const ADMIN_IDS = [7172771170, 1827755933, 8393398030]; 

// --- ИНИЦИАЛИЗАЦИЯ ---
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

// Установка цвета хедера при старте
if(document.body.classList.contains('dark-mode') || localStorage.getItem('theme') === 'dark') {
    tg.setHeaderColor('#1e1e1e');
} else {
    tg.setHeaderColor('#fff0f5');
}

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
let products = [];
let cart = {};
let currentCat = '';
let discountPercent = 0;
let isAdmin = false;
let activeChatUserId = null; 
let myUserId = null; 

// Переменные оформления заказа
let selectedMethod = 'table';
let selectedPayment = 'stars';

// Переменные свайпов
let touchstartX = 0; 
let touchstartY = 0; 
let touchendX = 0; 
let touchendY = 0;
let confirmCallback = null;

// Загружаем сохраненную корзину сразу
const savedCart = localStorage.getItem('mayCafeCart');
if(savedCart) { cart = JSON.parse(savedCart); }

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