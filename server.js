const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" } 
});

const PORT = process.env.PORT || 3000;
const DB_PATH = './heiba_connect_db.json';

const TELEGRAM_TOKEN = '7543475859:AAENXZxHPQZafOlvBwFr6EatUFD31iYq-ks';
const MY_CHAT_ID = '5042495708';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let db = { users: [], messages: [] };
if (fs.existsSync(DB_PATH)) {
    try { db = JSON.parse(fs.readFileSync(DB_PATH)); } catch (e) {}
}

const saveDB = () => {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } catch (e) {}
};

async function notifyAdmin(msg) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: MY_CHAT_ID,
            text: `👑 *Heiba Royal System:*\n${msg}`,
            parse_mode: 'Markdown'
        });
    } catch (e) {}
}

app.get('/api/sync', (req, res) => {
    const usersWithStatus = db.users.map(u => ({
        ...u,
        isOnline: activeSockets.has(u.id)
    }));
    res.json({ users: usersWithStatus });
});

app.post('/api/auth', (req, res) => {
    const { name, password, action } = req.body;
    let user = db.users.find(u => u.name === name);
    if (action === 'login') {
        if (user) {
            if (user.password === password) return res.json(user);
            return res.status(403).json({ error: "كلمة المرور خطأ" });
        }
        user = { id: 'U' + Math.random().toString(36).substr(2, 9), name, password, isOnline: false };
        db.users.push(user);
        saveDB();
        notifyAdmin(`عضو جديد انضم: ${name}`);
        return res.json(user);
    }
});

const activeSockets = new Map();

io.on('connection', (socket) => {
    socket.on('user_connected', (userId) => {
        activeSockets.set(userId, socket.id);
        io.emit('update_users_status', { userId, status: 'online' });
    });

    socket.on('send_message', (data) => {
        const { from, to, text } = data;
        const messageObj = { from, to, text, time: new Date() };
        db.messages.push(messageObj);
        if(db.messages.length > 200) db.messages.shift();
        saveDB();
        const recipientSocket = activeSockets.get(to);
        if (recipientSocket) io.to(recipientSocket).emit('receive_message', messageObj);
    });

    // --- نظام التمرير الإجباري للمكالمات (هنا التعديل القوي) ---
    socket.on('call_user', (data) => {
        const recipientSocket = activeSockets.get(data.userToCall);
        if (recipientSocket) {
            io.to(recipientSocket).emit('incoming_call', { 
                signal: data.signalData, 
                from: data.from, 
                name: data.name 
            });
        }
    });

    socket.on('answer_call', (data) => {
        const recipientSocket = activeSockets.get(data.to);
        if(recipientSocket) io.to(recipientSocket).emit('call_accepted', data.signal);
    });

    // تمرير بيانات العبور (ICE Candidates) غصب عبر السيرفر
    socket.on('ice_candidate', (data) => {
        const recipientSocket = activeSockets.get(data.to);
        if (recipientSocket) {
            io.to(recipientSocket).emit('ice_candidate', {
                candidate: data.candidate,
                from: data.from
            });
        }
    });

    socket.on('reject_call', (data) => {
        const recipientSocket = activeSockets.get(data.to);
        if(recipientSocket) io.to(recipientSocket).emit('call_rejected');
    });

    socket.on('disconnect', () => {
        for (let [userId, socketId] of activeSockets.entries()) {
            if (socketId === socket.id) {
                activeSockets.delete(userId);
                io.emit('update_users_status', { userId, status: 'offline' });
                break;
            }
        }
    });
});

server.listen(PORT, () => console.log(`🚀 HEIBA ROYAL LIVE ON ${PORT}`));