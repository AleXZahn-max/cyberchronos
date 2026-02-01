// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDaYxxhxjrvjVgqYcvPH53989Wr5dMgqHI",
    authDomain: "voxtek-system.firebaseapp.com",
    projectId: "voxtek-system",
    storageBucket: "voxtek-system.firebasestorage.app",
    messagingSenderId: "137141100080",
    appId: "1:137141100080:web:1b798f2e7aa12a313cd7f5"
  };

// --- 2. INITIALIZATION ---
let db, auth;
let currentUser = null;
let userDocRef = null;
let guestName = "Citizen-" + Math.floor(Math.random() * 9000 + 1000); // Генерация гостевого имени

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("System: Firebase Ready.");
} catch (e) {
    console.error("Firebase Config Error:", e);
}

// --- 3. AUTH LOGIC (DYNAMIC) ---

// Функция для кнопки в меню (Вход / Выход)
function handleAuthClick() {
    if (currentUser) {
        logout(); // Если вошли -> Выходим
    } else {
        toggleLoginModal(); // Если гости -> Открываем окно
    }
}

// Переключение видимости окна входа
function toggleLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.toggle('active');
}

// СЛУШАТЕЛЬ СОСТОЯНИЯ (ГЛАВНАЯ МАГИЯ)
if (auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // === ПОЛЬЗОВАТЕЛЬ ВОШЕЛ ===
            currentUser = user;
            console.log("Auth: Logged In as", user.uid);
            
            // 1. Закрываем окно
            const modal = document.getElementById('auth-modal');
            if(modal) modal.classList.remove('active');

            // 2. Меняем интерфейс на "Боевой"
            document.getElementById('authBtn').innerText = "DISCONNECT";
            document.getElementById('authBtn').classList.add('logout-btn');
            document.getElementById('net-stat').innerText = "SECURE";
            document.getElementById('net-stat').style.color = "var(--success)";
            document.getElementById('header-uid').innerText = user.uid.substring(0,6).toUpperCase();
            document.getElementById('term-prompt').innerText = "root@cyberchronos:~#";
            document.querySelector('.meta-tag').innerText = "ROOT";

            // 3. Загружаем реальный профиль
            loadUserProfile(user.uid);
            updatePresence("ONLINE");
            listenToNetwork();
            
            log(">> CONNECTION ESTABLISHED. WELCOME USER.", "var(--success)");

        } else {
            // === ПОЛЬЗОВАТЕЛЬ ВЫШЕЛ (ИЛИ ГОСТЬ) ===
            currentUser = null;
            userDocRef = null;
            console.log("Auth: Guest Mode");

            // 1. Возвращаем интерфейс к "Гостю"
            document.getElementById('authBtn').innerText = "CONNECT LINK";
            document.getElementById('authBtn').classList.remove('logout-btn');
            document.getElementById('net-stat').innerText = "OPEN";
            document.getElementById('net-stat').style.color = "var(--success)";
            document.getElementById('header-uid').innerText = "GUEST";
            document.getElementById('term-prompt').innerText = "guest@cyberchronos:~#";
            document.querySelector('.meta-tag').innerText = "GUEST";

            // 2. Ставим заглушку профиля
            setProfileUI({
                name: guestName,
                role: 'guest',
                avatar: `https://via.placeholder.com/100/000000/00f0ff?text=?`
            });

            // 3. Очищаем список пользователей
            const grid = document.getElementById('users-grid');
            if(grid) grid.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem;">Login required to see global network.</div>';
            document.getElementById('active-count').innerText = "0";

            log(">> SYSTEM RESET. GUEST MODE ACTIVE.", "var(--warning)");
        }
    });
}

// Обработка формы входа
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const msg = document.getElementById('auth-msg');

        msg.innerText = "Handshaking...";
        msg.style.color = "var(--warning)";

        auth.signInWithEmailAndPassword(email, pass)
            .catch((error) => {
                msg.innerText = "Error: " + error.message;
                msg.style.color = "var(--danger)";
            });
    });
}

// Выход
function logout() {
    if(userDocRef) {
        userDocRef.update({ status: "OFFLINE" }).then(() => auth.signOut());
    } else {
        auth.signOut();
    }
}

// --- 4. PROFILE LOGIC ---

function loadUserProfile(uid) {
    if(!db) return;
    userDocRef = db.collection('users').doc(uid);
    
    userDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            setProfileUI(doc.data());
        } else {
            // Если профиля нет в БД, создаем
            const defName = "Unit-" + Math.floor(Math.random()*9999);
            db.collection('users').doc(uid).set({
                uid: uid,
                name: defName,
                role: "user",
                avatar: "https://via.placeholder.com/100/000000/00f0ff?text=" + defName.charAt(0),
                status: "ONLINE",
                device: getOS(),
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    });
}

// Универсальная функция обновления UI профиля
function setProfileUI(data) {
    // Имя и Статус
    const nameEl = document.getElementById('user-name');
    const roleTextEl = document.getElementById('user-role-text');
    const dashNameEl = document.getElementById('host-name');
    
    if(nameEl) nameEl.innerText = data.name || "Unknown";
    if(dashNameEl) dashNameEl.innerText = data.name || guestName;
    
    // Аватарка
    const avatarEl = document.getElementById('user-avatar');
    if(avatarEl) avatarEl.src = data.avatar || "https://via.placeholder.com/100";

    // Роли и Цвета
    const ring = document.getElementById('user-role-ring');
    const badge = document.getElementById('user-role-badge');
    
    if(ring) ring.className = "avatar-ring"; // Сброс
    
    if(data.role === 'admin') {
        if(ring) ring.classList.add('role-admin');
        if(badge) {
            badge.innerText = "ADMIN";
            badge.style.color = "var(--danger)";
            badge.style.borderColor = "var(--danger)";
        }
        if(roleTextEl) roleTextEl.innerText = "Level 10 Access";
    } else if(data.role === 'vip') {
        if(ring) ring.classList.add('role-vip');
        if(badge) {
            badge.innerText = "VIP";
            badge.style.color = "var(--vip-gold)";
            badge.style.borderColor = "var(--vip-gold)";
        }
        if(roleTextEl) roleTextEl.innerText = "Premium Link";
    } else if(data.role === 'user') {
        if(ring) ring.classList.add('role-user');
        if(badge) {
            badge.innerText = "OPERATOR";
            badge.style.color = "var(--primary)";
            badge.style.borderColor = "#333";
        }
        if(roleTextEl) roleTextEl.innerText = "Standard Access";
    } else {
        // GUEST
        if(ring) ring.classList.add('role-guest');
        if(badge) {
            badge.innerText = "CITIZEN";
            badge.style.color = "#666";
            badge.style.borderColor = "#333";
        }
        if(roleTextEl) roleTextEl.innerText = "Unregistered";
    }
}

function updatePresence(status) {
    if(userDocRef) {
        userDocRef.update({
            status: status,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

// Keep Alive (только если вошли)
setInterval(() => {
    if(userDocRef && firebase) userDocRef.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
}, 60000);

// --- 5. NETWORK LISTENER ---

function listenToNetwork() {
    if(!db) return;
    db.collection('users').where('status', '==', 'ONLINE')
        .onSnapshot((snapshot) => {
            const grid = document.getElementById('users-grid');
            if(!grid) return;
            
            grid.innerHTML = '';
            
            const activeCountEl = document.getElementById('active-count');
            if(activeCountEl) activeCountEl.innerText = snapshot.size;

            snapshot.forEach((doc) => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = 'user-node';
                
                let roleClass = 'role-user';
                if(data.role === 'admin') roleClass = 'role-admin';
                if(data.role === 'vip') roleClass = 'role-vip';

                card.innerHTML = `
                    <img src="${data.avatar || 'https://via.placeholder.com/40'}" class="node-avatar ${roleClass}">
                    <div class="node-info">
                        <span class="node-name" style="${data.role==='admin'?'color:var(--danger)':''}">${data.name}</span>
                        <span class="node-status">● ONLINE [${data.device || 'Unknown'}]</span>
                    </div>
                `;
                grid.appendChild(card);
            });
        });
}

// --- 6. TERMINAL ENGINE ---

const cmdIn = document.getElementById('cmd-in');
const termOut = document.getElementById('term-output');
const termBox = document.getElementById('term-box');

function log(txt, col="#aaa", isInput=false) {
    if(!termOut) return;
    const d = document.createElement('div');
    d.className = 'term-row';
    d.style.color = col;
    
    // Безопасное добавление текста
    if(isInput) {
        const prompt = currentUser ? "root@cyberchronos:~# " : "guest@cyberchronos:~# ";
        d.innerHTML = `<span style="color:${currentUser?'#00ff9d':'#aaa'}">${prompt}</span> <span style="color:#fff">${txt}</span>`;
    } else {
        d.textContent = txt;
    }

    termOut.appendChild(d);
    if(termBox) termBox.scrollTop = termBox.scrollHeight;
}

function processCommand(raw) {
    const parts = raw.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if(cmd === 'login') {
        toggleLoginModal();
        return;
    }

    // Если гость пытается использовать крутые команды
    const guestRestricted = ['netstat', 'encrypt', 'purge', 'setname'];
    if(!currentUser && guestRestricted.includes(cmd)) {
        log("Access Denied: Login required for this command.", "var(--danger)");
        return;
    }

    switch(cmd) {
        case 'help':
            log("COMMANDS:", "var(--primary)");
            log("  login, clear, date, status, sysinfo");
            if(currentUser) log("  setname [name], whoami, logout, netstat, encrypt, purge");
            break;
        case 'clear': if(termOut) termOut.innerHTML = ''; break;
        case 'status': log("System Operational."); break;
        case 'sysinfo': log(`Device: ${getOS()}`); break;
        case 'date': log(new Date().toString()); break;
        
        // Auth-only commands
        case 'logout': logout(); break;
        case 'whoami': log(currentUser ? `UID: ${currentUser.uid}` : "Guest"); break;
        case 'setname':
            if(arg && userDocRef) {
                userDocRef.update({ name: arg });
                log(`Identity updated to: ${arg}`, "var(--success)");
            } else log("Error: Name required.", "var(--danger)");
            break;
        case 'encrypt': log("Simulating encryption... [DONE]", "var(--success)"); break;
        
        default: log("Unknown command.", "var(--danger)");
    }
}

if(cmdIn) {
    cmdIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = cmdIn.value.trim();
            if(!val) return;
            log(val, '#fff', true);
            processCommand(val);
            cmdIn.value = '';
        }
    });
}

// --- 7. UTILS & INIT ---

function getOS() {
    const ua = navigator.userAgent;
    if(ua.includes("Android")) return "Android System";
    if(ua.includes("Win")) return "Windows NT";
    if(ua.includes("Mac")) return "macOS";
    if(ua.includes("Linux")) return "Linux";
    if(ua.includes("iPhone")) return "iOS";
    return "Unknown Terminal";
}

// Init Battery (with check)
if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
        const el = document.getElementById('batt-val');
        if(el) el.innerText = Math.round(b.level * 100) + "%";
    });
}

// Visualizer
const visContainer = document.getElementById('visualizer');
if(visContainer) {
    for(let i=0; i<30; i++) {
        let d = document.createElement('div');
        d.className = 'bar';
        d.style.flex = "1";
        d.style.background = "var(--primary)";
        d.style.opacity = "0.2";
        d.style.transition = "height 0.2s, opacity 0.2s";
        visContainer.appendChild(d);
    }
    setInterval(() => {
        Array.from(visContainer.children).forEach(bar => {
            const h = Math.floor(Math.random() * 80) + 10;
            bar.style.height = h + "%";
            bar.style.opacity = h > 70 ? "0.8" : "0.2";
        });
    }, 100);
}

// UI Toggles
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if(sb) sb.classList.toggle('open');
}

function switchTab(id, btn) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const panel = document.getElementById(id);
    if(panel) panel.classList.add('active');
    if(btn) btn.classList.add('active');
    
    if(window.innerWidth <= 900) {
        const sb = document.getElementById('sidebar');
        if(sb) sb.classList.remove('open');
    }
}

// Start with Guest UI
setProfileUI({ name: guestName, role: 'guest' });
