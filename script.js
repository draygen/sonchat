const socket = io();
let currentUser = null;
let otherUser = null;
let showDecoded = false;

// Encoding using katakana (from original)
const customEncoding = "ｻﾊｰ｢｣ﾂｴｦ･､ﾃｲﾔｪﾜｼﾝﾁﾄｸﾅﾈﾉｿﾀﾕﾞｽﾛﾘﾊﾝﾟｧｨｩｫｬｭｮｯｱｲｳｴｵ";

function encode(text) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode >= 97 && charCode <= 122) {
            result += customEncoding[charCode - 97];
        } else if (charCode >= 65 && charCode <= 90) {
            result += customEncoding[charCode - 65];
        } else {
            result += text[i];
        }
    }
    return result;
}

function decode(encodedText, originalText) {
    // We store original with message, so just return it
    return originalText;
}

function showCustomNameInput() {
    document.getElementById('custom-name-input').style.display = 'flex';
    document.getElementById('custom-name').focus();
}

function joinWithCustomName() {
    const name = document.getElementById('custom-name').value.trim();
    if (name) {
        selectUser(name);
    }
}

// Allow Enter key to submit custom name
document.getElementById('custom-name').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinWithCustomName();
    }
});

function selectUser(user) {
    let password = null;

    if (user === 'Dad' || user === 'Jared') {
        password = prompt(`Enter password for ${user}:`);
        if (password === null) return; // User cancelled
    }

    currentUser = user;

    document.getElementById('user-select').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';

    // Tell server we joined with password (if any)
    socket.emit('join', { username: currentUser, password: password });

    // Focus input
    document.getElementById('message-input').focus();
}

function updateUserList(users) {
    const userListDiv = document.getElementById('user-list');
    userListDiv.innerHTML = '';

    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-list-item';

        let avatarHtml;
        if (user === 'Dad' || user === 'Jared') {
            avatarHtml = `<img src="${user}.jpg" alt="${user}">`;
        } else {
            avatarHtml = `<div class="user-initial">${user.charAt(0).toUpperCase()}</div>`;
        }

        item.innerHTML = `
            ${avatarHtml}
            <span>${user}</span>
            <div class="online-dot"></div>
        `;
        userListDiv.appendChild(item);
    });
}

function addAnnouncement(announcement) {
    const messagesDiv = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'announcement';
    div.textContent = announcement.text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getAvatarHtml(user) {
    if (user === 'Dad' || user === 'Jared') {
        return `<img class="message-avatar" src="${user}.jpg" alt="${user}">`;
    } else {
        const initial = user.charAt(0).toUpperCase();
        return `<div class="message-avatar-placeholder">${initial}</div>`;
    }
}

function addMessage(msg, prepend = false) {
    const messagesDiv = document.getElementById('messages');
    const row = document.createElement('div');
    const isSent = msg.user === currentUser;
    row.className = 'message-row ' + (isSent ? 'sent' : 'received');

    row.innerHTML = `
        ${getAvatarHtml(msg.user)}
        <div class="message">
            <div class="sender">${msg.user}</div>
            <div class="encoded">${msg.encoded}</div>
            <div class="decoded">${msg.text}</div>
            <div class="time">${formatTime(msg.timestamp)}</div>
        </div>
    `;

    row.querySelector('.message').onclick = () => row.querySelector('.message').classList.toggle('revealed');

    if (showDecoded) {
        row.querySelector('.message').classList.add('revealed');
    }

    if (prepend) {
        messagesDiv.insertBefore(row, messagesDiv.firstChild);
    } else {
        messagesDiv.appendChild(row);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if (!text) return;

    const encoded = encode(text);

    socket.emit('message', {
        user: currentUser,
        text: text,
        encoded: encoded
    });

    input.value = '';
    socket.emit('stop-typing');
}

function toggleDecode() {
    showDecoded = !showDecoded;
    const btn = document.getElementById('decode-toggle');
    btn.textContent = showDecoded ? 'Show Encoded' : 'Show Decoded';
    btn.classList.toggle('active', showDecoded);

    document.querySelectorAll('.message-row .message').forEach(msg => {
        msg.classList.toggle('revealed', showDecoded);
    });
}

// Socket events
socket.on('history', (messages) => {
    messages.forEach(msg => {
        if (msg.type === 'announcement') {
            addAnnouncement(msg);
        } else {
            addMessage(msg);
        }
    });
});

socket.on('message', (msg) => {
    addMessage(msg);
});

socket.on('announcement', (announcement) => {
    addAnnouncement(announcement);
});

socket.on('user-list', (users) => {
    updateUserList(users);
});

socket.on('typing', (user) => {
    if (user !== currentUser) {
        document.getElementById('status-text').innerHTML =
            '<span class="typing-indicator">' + user + ' is typing...</span>';
    }
});

socket.on('stop-typing', () => {
    document.getElementById('status-text').textContent = 'Online';
});

socket.on('auth-error', (msg) => {
    alert(msg);
    // Reset UI to selection screen
    document.getElementById('user-select').style.display = 'flex';
    document.getElementById('chat-screen').style.display = 'none';
    currentUser = null;
});

// Input handling
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    } else {
        socket.emit('typing', currentUser);
    }
});

// Stop typing after pause
let typingTimeout;
document.getElementById('message-input').addEventListener('input', () => {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop-typing');
    }, 1000);
});