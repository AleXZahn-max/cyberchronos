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

// Fake File System for "ls" command
const fileSystem = {
    "config.sys": "[ENCRYPTED BINARY DATA]",
    "users.dat": "root:x:0:0:root:/root:/bin/bash",
    "network.log": "Connection established: Node-44 [SECURE]",
    "manifesto.txt": "VoxTek Enterprises: Innovating for a controlled future."
};

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log("System: Link Established.");
} catch (e) {
    console.error("Firebase Config Error:", e);
    document.getElementById('net-stat').innerText = "CONFIG ERR";
    document.getElementById('net-stat').style.color = "var(--danger)";
}

// --- 3. AUTHENTICATION LOGIC ---

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-modal').classList.remove('active');
        document.getElementById('net-stat').innerText = "SECURE";
        document.getElementById('net-stat').style.color = "var(--success)";
        document.getElementById('header-uid').innerText = user.uid.substring(0,6).toUpperCase();
        
        loadUserProfile(user.uid);
        updatePresence("ONLINE");
        listenToNetwork();
        log(">> CONNECTION ESTABLISHED. WELCOME USER.", "var(--success)");
    } else {
        document.getElementById('auth-modal').classList.add('active');
        currentUser = null;
        log(">> CONNECTION LOST.", "var(--danger)");
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
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

function logout() {
    if(userDocRef) {
        userDocRef.update({ status: "OFFLINE" }).then(() => auth.signOut());
    } else {
        auth.signOut();
    }
}

// --- 4. PROFILE LOGIC ---

function loadUserProfile(uid) {
    userDocRef = db.collection('users').doc(uid);
    userDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            renderSidebarProfile(doc.data());
        } else {
            createDefaultProfile(uid);
        }
    });
}

function createDefaultProfile(uid) {
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

function renderSidebarProfile(data) {
    document.getElementById('user-name').innerText = data.name || "Unknown";
    
    // Set Avatar
    document.getElementById('user-avatar').src = data.avatar || "https://via.placeholder.com/100";
    
    // Set Role Styles
    const ring = document.getElementById('user-role-ring');
    const badge = document.getElementById('user-role-badge');
    const roleText = document.getElementById('user-role-text');
    
    ring.className = "avatar-ring"; // Reset
    
    if(data.role === 'admin') {
        ring.classList.add('role-admin');
        badge.innerText = "ADMIN";
        badge.style.color = "var(--danger)";
        badge.style.borderColor = "var(--danger)";
        roleText.innerText = "Level 10 Access";
    } else if(data.role === 'vip') {
        ring.classList.add('role-vip');
        badge.innerText = "VIP";
        badge.style.color = "var(--vip-gold)";
        badge.style.borderColor = "var(--vip-gold)";
        roleText.innerText = "Premium Link";
    } else {
        ring.classList.add('role-user');
        badge.innerText = "OPERATOR";
        badge.style.color = "var(--primary)";
        badge.style.borderColor = "#333";
        roleText.innerText = "Standard Access";
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

// Keep Alive
setInterval(() => {
    if(userDocRef) userDocRef.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
}, 60000);

// --- 5. NETWORK LISTENER ---

function listenToNetwork() {
    db.collection('users').where('status', '==', 'ONLINE')
        .onSnapshot((snapshot) => {
            const grid = document.getElementById('users-grid');
            grid.innerHTML = '';
            document.getElementById('active-count').innerText = snapshot.size;

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

// --- 6. TERMINAL ENGINE (FULL FEATURES) ---

const cmdIn = document.getElementById('cmd-in');
const termOut = document.getElementById('term-output');
const termBox = document.getElementById('term-box');
let cmdHistory = [];
let historyIndex = -1;
let activeProcessTimers = [];

// Helper: Schedule log
function scheduleLog(fn, delay) {
    const id = setTimeout(() => {
        fn();
        activeProcessTimers = activeProcessTimers.filter(t => t !== id);
    }, delay);
    activeProcessTimers.push(id);
}

// Helper: Kill Process
function killProcess() {
    if(activeProcessTimers.length > 0) {
        activeProcessTimers.forEach(clearTimeout);
        activeProcessTimers = [];
        log("^C", "var(--danger)");
        return true;
    }
    return false;
}

function processCommand(raw) {
    const parts = raw.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch(cmd) {
        case 'help':
            log("COMMANDS:", "var(--primary)");
            log("  status, whoami, clear, setname [name], logout");
            log("  ls, sysinfo, netstat, encrypt, purge, date");
            break;
        
        case 'clear': termOut.innerHTML = ''; break;
        
        case 'status': 
            log("[OK] KERNEL: ACTIVE");
            log("[OK] DB LINK: ESTABLISHED");
            break;

        case 'ls':
            log("Directory of /root/systems:", "var(--text-muted)");
            for (const [file, content] of Object.entries(fileSystem)) {
                log(`  ${file}`, "#fff");
            }
            break;

        case 'sysinfo':
            log("HARDWARE PROFILE:");
            log(`  HOST: ${document.getElementById('host-name').innerText}`);
            log("  CORES: 8 LOGICAL / 4 PHYSICAL");
            log("  ARCH: x64_vox_edition");
            break;

        case 'netstat':
            log("Active Connections (TCP/IP):");
            log("  PROTO  LOCAL ADDR      FOREIGN ADDR    STATE", "var(--text-muted)");
            log("  TCP    127.0.0.1:443   10.0.0.5:8080   ESTABLISHED");
            log("  TCP    192.168.1.5     104.22.1.1:443  TIME_WAIT");
            break;

        case 'encrypt':
            log("Initializing AES-4096 handshake...", "var(--warning)");
            scheduleLog(() => log(">> Generating keys...", "var(--text-muted)"), 500);
            scheduleLog(() => log(">> Hashing data blocks...", "var(--text-muted)"), 1200);
            scheduleLog(() => log(">> Verifying integrity...", "var(--text-muted)"), 2000);
            scheduleLog(() => log(">> ENCRYPTION COMPLETE.", "var(--success)"), 2800);
            break;

        case 'purge':
            log("Clearing buffer...", "var(--warning)");
            scheduleLog(() => log(">> Flushing cache...", "var(--text-muted)"), 600);
            scheduleLog(() => log(">> Releasing handles...", "var(--text-muted)"), 1200);
            scheduleLog(() => log(">> Memory released: 512MB", "var(--success)"), 1800);
            break;

        case 'date': log(new Date().toString()); break;

        case 'logout': logout(); break;

        case 'whoami': 
            log(currentUser ? `UID: ${currentUser.uid}` : "Not logged in"); 
            break;

        case 'setname':
            if(arg && userDocRef) {
                userDocRef.update({ name: arg });
                log(`Identity updated to: ${arg}`, "var(--success)");
            } else {
                log("Error: Name required or not logged in.", "var(--danger)");
            }
            break;

        default: log("Unknown command.", "var(--danger)");
    }
}

function log(txt, col="#aaa", isInput=false) {
    const d = document.createElement('div');
    d.className = 'term-row';
    
    // Resolve CSS Vars for JS
    let colorCode = col;
    if(col.includes('primary')) colorCode = '#00f0ff';
    if(col.includes('danger')) colorCode = '#ff3333';
    if(col.includes('success')) colorCode = '#00ff9d';
    if(col.includes('warning')) colorCode = '#ffcc00';
    if(col.includes('text-muted')) colorCode = '#8b9bb4';

    d.style.color = colorCode;
    d.textContent = txt;

    if(isInput) {
        d.innerHTML = `<span style="color:#00ff9d; margin-right:10px">root@sys:~#</span> <span style="color:#fff">${txt}</span>`;
    }

    termOut.appendChild(d);
    termBox.scrollTop = termBox.scrollHeight;
}

// Input Handlers
cmdIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = cmdIn.value.trim();
        if(!val) return;
        cmdHistory.push(val);
        historyIndex = cmdHistory.length;
        log(val, '#fff', true);
        processCommand(val);
        cmdIn.value = '';
    }
    // Ctrl+C
    if (e.ctrlKey && e.key === 'c') {
        if(killProcess()) {
            e.preventDefault();
            log("^C", "var(--danger)");
            cmdIn.value = '';
        }
    }
    // Ctrl+L
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        termOut.innerHTML = '';
    }
    // Arrows
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if(historyIndex > 0) { historyIndex--; cmdIn.value = cmdHistory[historyIndex]; }
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if(historyIndex < cmdHistory.length - 1) { historyIndex++; cmdIn.value = cmdHistory[historyIndex]; }
        else { historyIndex = cmdHistory.length; cmdIn.value = ''; }
    }
});

// --- 7. UTILS & INIT ---

function getOS() {
    const ua = navigator.userAgent;
    if(ua.includes("Android")) return "Android System";
    if(ua.includes("Win")) return "Windows NT";
    if(ua.includes("Mac")) return "macOS";
    if(ua.includes("Linux")) return "Linux";
    return "Unknown Terminal";
}

// System Stats
function initSys() {
    const saved = localStorage.getItem('cc_host');
    const os = getOS();
    document.getElementById('host-name').innerText = saved || (os.includes("Win") ? "CyberChronos 14 Pro" : "OnePlus 10 Pro");
    document.getElementById('os-tag').innerText = os.toUpperCase();
}

// Battery
if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
        document.getElementById('batt-val').innerText = Math.round(b.level * 100) + "%";
    });
}

// Time
setInterval(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    document.getElementById('uptime').innerText = `${h}:${m}`;
}, 1000);

// Visualizer
const visContainer = document.getElementById('visualizer');
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

// UI Toggles
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}
function switchTab(id, btn) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
    if(window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
    if(id === 'term') setTimeout(() => cmdIn.focus(), 100);
}

// Init
initSys();
document.addEventListener('click', () => {
    if(document.getElementById('term').classList.contains('active')) cmdIn.focus();
});