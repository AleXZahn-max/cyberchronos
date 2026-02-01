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
let userRole = "guest"; // Local role tracker
let guestName = "Citizen-" + Math.floor(Math.random() * 9000 + 1000); 

// --- GENERATE AVATAR (NO INTERNET REQUIRED) ---
function generateAvatar(text) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#050505"/>
        <text x="50" y="55" font-family="monospace" font-size="50" font-weight="bold" fill="#00f0ff" text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>`;
    return "data:image/svg+xml;base64," + btoa(svg);
}

const setAppHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
};
window.addEventListener('resize', setAppHeight);
setAppHeight();

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("System: Firebase Initialized.");
} catch (e) {
    console.error("Firebase Config Error:", e);
    const el = document.getElementById('net-stat');
    if(el) { el.innerText = "CONFIG ERR"; el.style.color = "var(--danger)"; }
}

// --- 3. AUTH LOGIC ---

function handleAuthClick() {
    if (currentUser) {
        logout();
    } else {
        toggleLoginModal();
    }
}

function toggleLoginModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.toggle('active');
}

if (auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // === LOGGED IN ===
            currentUser = user;
            
            document.getElementById('auth-modal').classList.remove('active');
            
            const authBtn = document.getElementById('authBtn');
            if(authBtn) {
                authBtn.innerText = "DISCONNECT";
                authBtn.classList.remove('auth-toggle-btn');
                authBtn.classList.add('logout-btn');
            }

            document.getElementById('net-stat').innerText = "SECURE";
            document.getElementById('net-stat').style.color = "var(--success)";
            document.getElementById('header-uid').innerText = user.uid.substring(0,6).toUpperCase();
            
            const termPrompt = document.getElementById('term-prompt');
            if(termPrompt) termPrompt.innerText = "root@cyberchronos:~#";
            
            loadUserProfile(user.uid);
            updatePresence("ONLINE");
            listenToNetwork();
            
            log(">> SECURE LINK ESTABLISHED. WELCOME USER.", "var(--success)");

        } else {
            // === GUEST MODE ===
            currentUser = null;
            userDocRef = null;
            userRole = "guest";

            const authBtn = document.getElementById('authBtn');
            if(authBtn) {
                authBtn.innerText = "CONNECT LINK";
                authBtn.classList.remove('logout-btn');
                authBtn.classList.add('auth-toggle-btn');
            }

            document.getElementById('net-stat').innerText = "OPEN";
            document.getElementById('net-stat').style.color = "var(--success)";
            document.getElementById('header-uid').innerText = "GUEST";
            
            const termPrompt = document.getElementById('term-prompt');
            if(termPrompt) termPrompt.innerText = "guest@cyberchronos:~#";

            // Reset Profile
            setProfileUI({
                name: guestName,
                role: 'guest',
                avatar: `https://placehold.co/100/000000/00f0ff?text=?`
            });

            // Close Admin Panel if open
            const adminView = document.getElementById('admin-view');
            if(adminView && adminView.style.display !== 'none') {
                switchTab('dash');
            }

            // Reset Grid
            const grid = document.getElementById('users-grid');
            if(grid) {
                grid.innerHTML = '<div style="padding:10px; color:#666; font-size:0.8rem; font-family:var(--font-code);">>> ACCESS DENIED. LOGIN REQUIRED TO VIEW GLOBAL NETWORK.</div>';
            }
            document.getElementById('active-count').innerText = "0";

            log(">> SYSTEM RESET. GUEST MODE ACTIVE.", "var(--warning)");
        }
    });
}

const loginForm = document.getElementById('login-form');
if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const msg = document.getElementById('auth-msg');

        if(msg) { msg.innerText = "Handshaking..."; msg.style.color = "var(--warning)"; }

        auth.signInWithEmailAndPassword(email, pass)
            .catch((error) => {
                if(msg) { msg.innerText = "Error: " + error.message; msg.style.color = "var(--danger)"; }
            });
    });
}

function logout() {
    if(userDocRef) {
        userDocRef.update({ status: "OFFLINE" }).then(() => auth.signOut());
    } else {
        auth.signOut();
    }
}

// --- 4. PROFILE MANAGEMENT ---

function loadUserProfile(uid) {
    if(!db) return;
    userDocRef = db.collection('users').doc(uid);
    userDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            userRole = data.role || "user"; 
            setProfileUI(data);
        } else {
            createDefaultProfile(uid);
        }
    });
}

function createDefaultProfile(uid) {
    const defName = "Unit-" + Math.floor(Math.random()*9999);
    const letter = defName.charAt(0).toUpperCase(); 
    
    db.collection('users').doc(uid).set({
        uid: uid,
        name: defName,
        role: "user",
        avatar: generateAvatar(letter), 
        status: "ONLINE",
        device: getOS(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function setProfileUI(data) {
    const nameEl = document.getElementById('user-name');
    const dashNameEl = document.getElementById('host-name');
    const roleTextEl = document.getElementById('user-role-text');
    const avatarEl = document.getElementById('user-avatar');
    const ring = document.getElementById('user-role-ring');
    const badge = document.getElementById('user-role-badge');

    const displayName = data.name || "Unknown";
    
    if(nameEl) nameEl.innerText = displayName;
    if(dashNameEl) dashNameEl.innerText = displayName;
    
    if(avatarEl) {
        if (data.avatar && data.avatar.startsWith('data:')) {
            avatarEl.src = data.avatar;
        } else {
            avatarEl.src = generateAvatar(displayName.charAt(0));
        }
    }

    if(ring) ring.className = "avatar-ring"; 

    if(data.role === 'admin') {
        if(ring) ring.classList.add('role-admin');
        if(badge) { badge.innerText = "ADMIN"; badge.style.color = "var(--danger)"; badge.style.borderColor = "var(--danger)"; }
        if(roleTextEl) roleTextEl.innerText = "Level 10 Access";
    } else if(data.role === 'vip') {
        if(ring) ring.classList.add('role-vip');
        if(badge) { badge.innerText = "VIP"; badge.style.color = "var(--vip-gold)"; badge.style.borderColor = "var(--vip-gold)"; }
        if(roleTextEl) roleTextEl.innerText = "Premium Link";
    } else if(data.role === 'user') {
        if(ring) ring.classList.add('role-user');
        if(badge) { badge.innerText = "OPERATOR"; badge.style.color = "var(--primary)"; badge.style.borderColor = "#333"; }
        if(roleTextEl) roleTextEl.innerText = "Standard Access";
    } else {
        if(ring) ring.classList.add('role-guest');
        if(badge) { badge.innerText = "CITIZEN"; badge.style.color = "#666"; badge.style.borderColor = "#333"; }
        if(roleTextEl) roleTextEl.innerText = "Unregistered Entity";
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

setInterval(() => {
    if(userDocRef && firebase) userDocRef.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
}, 60000);

function listenToNetwork() {
    if(!db) return;
    db.collection('users').where('status', '==', 'ONLINE')
        .onSnapshot((snapshot) => {
            const grid = document.getElementById('users-grid');
            if(!grid) return;
            grid.innerHTML = '';
            const activeEl = document.getElementById('active-count');
            if(activeEl) activeEl.innerText = snapshot.size;

            snapshot.forEach((doc) => {
                const data = doc.data();
                const card = document.createElement('div');
                card.className = 'user-node';
                let roleClass = 'role-user';
                if(data.role === 'admin') roleClass = 'role-admin';
                if(data.role === 'vip') roleClass = 'role-vip';
                const safeName = data.name || "Unknown";
                let av = data.avatar;
                if (!av || !av.startsWith('data:')) {
                    av = generateAvatar(safeName.charAt(0));
                }
                card.innerHTML = `
                    <img src="${av}" class="node-avatar ${roleClass}">
                    <div class="node-info">
                        <span class="node-name" style="${data.role==='admin'?'color:var(--danger)':''}">${safeName}</span>
                        <span class="node-status">● ONLINE [${data.device || 'Unknown'}]</span>
                    </div>
                `;
                grid.appendChild(card);
            });
        });
}

// --- 5. TERMINAL & LOGS ---

const cmdIn = document.getElementById('cmd-in');
const termOut = document.getElementById('term-output');
const termBox = document.getElementById('term-box');

function log(txt, col="#aaa", isInput=false) {
    if(!termOut) return;
    const d = document.createElement('div');
    d.className = 'term-row';
    d.style.color = col;
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

    if(cmd === 'login') { toggleLoginModal(); return; }

    const guestRestricted = ['netstat', 'encrypt', 'purge', 'setname'];
    if(!currentUser && guestRestricted.includes(cmd)) {
        log("Access Denied: Login required.", "var(--danger)");
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
        case 'logout': logout(); break;
        case 'whoami': log(currentUser ? `UID: ${currentUser.uid}` : "Guest"); break;
        case 'setname':
            if(arg && userDocRef) {
                userDocRef.update({ name: arg });
                log(`Identity updated to: ${arg}`, "var(--success)");
            } else log("Error: Name required.", "var(--danger)");
            break;
        case 'encrypt': log("Encryption cycling...", "var(--warning)"); break;
        case 'purge': log("Cache purged.", "var(--warning)"); break;
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

// --- 6. FAKE ADMIN PANEL LOGIC ---

// Traffic slider update
const trRange = document.getElementById('traffic-range');
const trVal = document.getElementById('traffic-val');
if(trRange && trVal) {
    trRange.addEventListener('input', (e) => {
        trVal.innerText = e.target.value + "%";
    });
}

// Simulated Server Logs
function addServerLog() {
    const logBox = document.getElementById('server-logs');
    if(!logBox || logBox.style.display === 'none') return;
    
    const actions = ["[INFO] Auth check", "[WARN] High latency", "[INFO] DB Sync", "[INFO] User connected", "[ERR] Packet loss"];
    const ips = ["192.168.0.4", "10.0.0.5", "172.16.8.9"];
    
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0') + ":" + now.getSeconds().toString().padStart(2,'0');
    
    const action = actions[Math.floor(Math.random() * actions.length)];
    const ip = ips[Math.floor(Math.random() * ips.length)];
    
    const div = document.createElement('div');
    div.className = "log-line";
    div.innerHTML = `<span class="l-time">${time}</span> ${action} from ${ip}`;
    
    logBox.prepend(div);
    if(logBox.children.length > 20) logBox.lastChild.remove();
}
setInterval(addServerLog, 3000); // Add a log every 3 sec

// --- 7. UTILS & NAVIGATION ---

function getOS() {
    const ua = navigator.userAgent;
    if(ua.includes("Android")) return "Android";
    if(ua.includes("Win")) return "Windows";
    if(ua.includes("Mac")) return "macOS";
    if(ua.includes("iPhone")) return "iOS";
    return "Unknown";
}

if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
        const el = document.getElementById('batt-val');
        if(el) el.innerText = Math.round(b.level * 100) + "%";
    });
}

const visContainer = document.getElementById('visualizer');
if(visContainer) {
    for(let i=0; i<30; i++) {
        let d = document.createElement('div');
        d.className = 'bar';
        d.style.flex = "1";
        d.style.background = "var(--primary)";
        d.style.opacity = "0.2";
        d.style.transition = "height 0.8s ease-in-out, opacity 0.8s";
        visContainer.appendChild(d);
    }
    
    setInterval(() => {
        Array.from(visContainer.children).forEach(bar => {
            const h = Math.floor(Math.random() * 80) + 10;
            bar.style.height = h + "%";
            bar.style.opacity = h > 70 ? "0.8" : "0.2";
        });
    }, 800);
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if(sb) sb.classList.toggle('open');
}

function switchTab(id, btn) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const panel = document.getElementById(id);
    if(panel) panel.classList.add('active');
    
    if(btn) {
        btn.classList.add('active');
    } else {
        const btns = document.querySelectorAll('.nav-btn');
        if(id === 'dash') btns[0].classList.add('active');
        if(id === 'control') btns[1].classList.add('active');
        if(id === 'term') btns[2].classList.add('active');
    }
    
    if(id === 'control') {
        const adminView = document.getElementById('admin-view');
        const lockedView = document.getElementById('locked-view');
        
        if(userRole === 'admin') {
            lockedView.style.display = 'none';
            adminView.style.display = 'flex'; // Use flex now for column layout
        } else {
            adminView.style.display = 'none';
            lockedView.style.display = 'flex';
        }
    }

    if(window.innerWidth <= 900) {
        const sb = document.getElementById('sidebar');
        if(sb) sb.classList.remove('open');
    }
}

setProfileUI({ name: guestName, role: 'guest' });
