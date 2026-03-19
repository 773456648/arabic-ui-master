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

// إعدادات التلجرام الخاصة بك
const TELEGRAM_TOKEN = '7543475859:AAENXZxHPQZafOlvBwFr6EatUFD31iYq-ks';
const MY_CHAT_ID = '5042495708';

// --- إعدادات الواجهة والبيانات ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- إدارة قاعدة البيانات ---
let db = { users: [], messages: [] };
if (fs.existsSync(DB_PATH)) {
    try { 
        db = JSON.parse(fs.readFileSync(DB_PATH)); 
    } catch (e) { 
        console.error("خطأ في قراءة قاعدة البيانات"); 
    }
}

const saveDB = () => {
    try { 
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); 
    } catch (e) { 
        console.error("خطأ في حفظ البيانات:", e); 
    }
};

// --- إشعارات الإدارة عبر تلجرام ---
async function notifyAdmin(msg) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: MY_CHAT_ID,
            text: `👑 *Heiba Royal System:*\n${msg}`,
            parse_mode: 'Markdown'
        });
    } catch (e) {}
}

// ==========================================
// 🔄 نظام مزامنة المستخدمين والرسائل (API)
// ==========================================

// مسار لجلب المستخدمين وتحديد المتصلين منهم (هذا اللي كان ناقصك!)
app.get('/api/sync', (req, res) => {
    // نرسل قائمة المستخدمين ونحدد من منهم متصل حالياً عبر السوكيت
    const usersWithStatus = db.users.map(u => ({
        ...u,
        isOnline: activeSockets.has(u.id)
    }));
    res.json({ users: usersWithStatus });
});

// نظام تسجيل الدخول (API)
app.post('/api/auth', (req, res) => {
    const { name, password, action } = req.body;
    let user = db.users.find(u => u.name === name);

    if (action === 'login') {
        if (user) {
            if (user.password === password) return res.json(user);
            return res.status(403).json({ error: "كلمة المرور خطأ" });
        }
        // تسجيل جديد تلقائي
        user = { 
            id: 'U' + Math.random().toString(36).substr(2, 9), 
            name, 
            password, 
            isOnline: false 
        };
        db.users.push(user);
        saveDB();
        notifyAdmin(`عضو جديد انضم للمنصة: ${name}`);
        return res.json(user);
    }
});

// ==========================================
// 🚀 نظام الاتصال الفوري (Socket.io)
// ==========================================

const activeSockets = new Map();

io.on('connection', (socket) => {
    console.log(`⚡ متصل جديد: ${socket.id}`);

    // إبلاغ السيرفر بهوية المستخدم المتصل
    socket.on('user_connected', (userId) => {
        activeSockets.set(userId, socket.id);
        // تحديث حالة المستخدم في قاعدة البيانات (اختياري، نعتمد على activeSockets حالياً)
        io.emit('update_users_status', { userId, status: 'online' });
    });

    // إرسال رسالة فورية
    socket.on('send_message', (data) => {
        const { from, to, text } = data;
        const messageObj = { from, to, text, time: new Date() };
        
        db.messages.push(messageObj);
        if(db.messages.length > 200) db.messages.shift();
        saveDB();

        // إرسال الرسالة للمستلم فوراً إذا كان متصل
        const recipientSocket = activeSockets.get(to);
        if (recipientSocket) {
            io.to(recipientSocket).emit('receive_message', messageObj);
        }
    });

    // نظام المكالمات
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
        if(recipientSocket) {
            io.to(recipientSocket).emit('call_accepted', data.signal);
        }
    });

    socket.on('reject_call', (data) => {
        const recipientSocket = activeSockets.get(data.to);
        if(recipientSocket) {
            io.to(recipientSocket).emit('call_rejected');
        }
    });

    // عند انقطاع الاتصال
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

server.listen(PORT, () => {
    console.log(`====================================`);
    console.log(`🚀 HEIBA ROYAL PLATFORM IS LIVE ON PORT ${PORT}`);
    console.log(`====================================`);
});