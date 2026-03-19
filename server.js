const express = require('express');
const http = require('http'); // نحتاج http عشان دمج السوكيت
const { Server } = require('socket.io'); // مكتبة الاتصال الفوري
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const DB_PATH = './heiba_connect_db.json';
const TELEGRAM_TOKEN = '7543475859:AAENXZxHPQZafOlvBwFr6EatUFD31iYq-ks';
const MY_CHAT_ID = '5042495708';

// --- إعدادات الواجهة ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- قاعدة البيانات ---
let db = { users: [], messages: [] };
if (fs.existsSync(DB_PATH)) {
    try { db = JSON.parse(fs.readFileSync(DB_PATH)); } 
    catch (e) { console.error("Error reading DB"); }
}

const saveDB = () => {
    try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } 
    catch (e) { console.error("DB Save Error:", e); }
};

// --- إشعارات الإدارة ---
async function notifyAdmin(msg) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: MY_CHAT_ID,
            text: `👑 *Heiba Royal System:*\n${msg}`,
            parse_mode: 'Markdown'
        });
    } catch (e) {}
}

// --- نظام تسجيل الدخول (API العادي) ---
app.post('/api/auth', (req, res) => {
    const { name, password, action } = req.body;
    let user = db.users.find(u => u.name === name);

    if (action === 'login') {
        if (user) {
            if (user.password === password) return res.json(user);
            return res.status(403).json({ error: "كلمة المرور خطأ" });
        }
        // تسجيل جديد
        user = { 
            id: 'U' + Math.random().toString(36).substr(2, 9), 
            name, password, isOnline: false 
        };
        db.users.push(user);
        saveDB();
        notifyAdmin(`عضو جديد انضم: ${name}`);
        return res.json(user);
    }
});

// ==========================================
// 🚀 نظام الاتصال الفوري (Socket.io) الخرافي
// ==========================================

// تخزين معرفات الجلسات النشطة لمعرفة من المتصل حالياً
const activeSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log(`⚡ مستخدم متصل جديد: ${socket.id}`);

    // 1. تسجيل دخول المستخدم في السوكيت (تحديث حالته لـ "متصل")
    socket.on('user_connected', (userId) => {
        activeSockets.set(userId, socket.id);
        
        // إبلاغ جميع المستخدمين أن هذا الشخص أصبح متصل
        io.emit('update_users_status', { userId, status: 'online' });
    });

    // 2. إرسال رسالة فورية
    socket.on('send_message', (data) => {
        const { from, to, text } = data;
        const messageObj = { from, to, text, time: new Date() };
        
        db.messages.push(messageObj);
        if(db.messages.length > 200) db.messages.shift(); // حفظ آخر 200 رسالة
        saveDB();

        // إرسال الرسالة للمستلم فوراً إذا كان متصل
        const recipientSocket = activeSockets.get(to);
        if (recipientSocket) {
            io.to(recipientSocket).emit('receive_message', messageObj);
        }
    });

    // 3. نظام المكالمات المتكامل (طلب مكالمة)
    socket.on('call_user', (data) => {
        const { userToCall, signalData, from, name } = data;
        const recipientSocket = activeSockets.get(userToCall);
        
        if (recipientSocket) {
            // يرن عند الطرف الثاني فوراً
            io.to(recipientSocket).emit('incoming_call', { signal: signalData, from, name });
        } else {
            // إذا كان غير متصل، نرد على المتصل بأنه غير متاح
            socket.emit('call_failed', { reason: 'المستخدم غير متصل حالياً' });
        }
    });

    // 4. الرد على المكالمة (قبول)
    socket.on('answer_call', (data) => {
        const recipientSocket = activeSockets.get(data.to);
        if(recipientSocket) {
            io.to(recipientSocket).emit('call_accepted', data.signal);
        }
    });

    // 5. رفض المكالمة أو إنهاؤها
    socket.on('reject_call', (data) => {
        const recipientSocket = activeSockets.get(data.to);
        if(recipientSocket) {
            io.to(recipientSocket).emit('call_rejected');
        }
    });

    // 6. عند انقطاع الاتصال (خروج المستخدم)
    socket.on('disconnect', () => {
        // البحث عن المستخدم الذي خرج وتحديث حالته لـ "غير متصل"
        for (let [userId, socketId] of activeSockets.entries()) {
            if (socketId === socket.id) {
                activeSockets.delete(userId);
                io.emit('update_users_status', { userId, status: 'offline' });
                break;
            }
        }
        console.log(`❌ مستخدم غادر: ${socket.id}`);
    });
});

// --- تشغيل السيرفر ---
server.listen(PORT, () => {
    console.log(`====================================`);
    console.log(`🚀 HEIBA ROYAL PLATFORM IS LIVE`);
    console.log(`📡 PORT: ${PORT} | REAL-TIME ENABLED`);
    console.log(`====================================`);
});