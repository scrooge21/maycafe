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