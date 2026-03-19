const express = require('express');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const app = express();

// إعدادات المنفذ (ضروري لـ Render)
const PORT = process.env.PORT || 3000;
const DB_PATH = './heiba_connect_db.json';

// إعدادات التلجرام الخاصة بك
const TELEGRAM_TOKEN = '7543475859:AAENXZxHPQZafOlvBwFr6EatUFD31iYq-ks';
const MY_CHAT_ID = '5042495708';

// --- الربط البرمجي للواجهة ---
// هذا السطر يخبر السيرفر بعرض الملفات الموجودة في مجلد public تلقائياً
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- إدارة قاعدة البيانات (JSON) ---
let db = { users: [], messages: [], activeCalls: [] };
if (fs.existsSync(DB_PATH)) {
    try { 
        db = JSON.parse(fs.readFileSync(DB_PATH)); 
    } catch (e) {
        console.error("خطأ في قراءة قاعدة البيانات، سيتم بدء ملف جديد.");
    }
}

const saveDB = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("فشل في حفظ البيانات:", e);
    }
};

// --- إشعارات الإدارة عبر تلجرام ---
async function notifyAdmin(msg) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: MY_CHAT_ID,
            text: `👑 *نظام هيبة للاتصالات:*\n${msg}`,
            parse_mode: 'Markdown'
        });
    } catch (e) {
        console.error("فشل إرسال إشعار التلجرام");
    }
}

// --- المسارات البرمجية (APIs) ---

// 1. تسجيل الدخول والاشتراك
app.post('/api/auth', (req, res) => {
    const { name, password, action } = req.body;
    const user = db.users.find(u => u.name === name);

    if (action === 'login') {
        if (user) {
            if (user.password === password) return res.json(user);
            return res.status(403).json({ error: "كلمة المرور خطأ" });
        }
        // إنشاء حساب تلقائي إذا لم يوجد
        const newUser = { 
            id: 'U' + Math.random().toString(36).substr(2, 5), 
            name, 
            password, 
            verified: false,
            createdAt: new Date()
        };
        db.users.push(newUser);
        saveDB();
        notifyAdmin(`عضو جديد انضم للنظام: ${name}`);
        return res.json(newUser);
    }
});

// 2. مزامنة البيانات (الرسائل، المستخدمين، المكالمات الواردة)
app.get('/api/sync', (req, res) => {
    const { userId } = req.query;
    const incomingCall = db.activeCalls.find(c => c.to === userId);
    
    res.json({
        users: db.users.map(u => ({ id: u.id, name: u.name, verified: u.verified })), // إرسال البيانات العامة فقط
        messages: db.messages.filter(m => m.to === userId || m.from === userId),
        incomingCall: incomingCall ? { 
            ...incomingCall, 
            fromName: db.users.find(u => u.id === incomingCall.from)?.name 
        } : null
    });
});

// 3. إرسال الرسائل
app.post('/api/messages', (req, res) => {
    const { from, to, text } = req.body;
    if (!from || !to || !text) return res.status(400).json({ error: "بيانات ناقصة" });

    db.messages.push({ from, to, text, time: new Date() });
    
    // الحفاظ على حجم قاعدة البيانات (آخر 100 رسالة)
    if(db.messages.length > 100) db.messages.shift();
    
    saveDB();
    res.json({ success: true });
});

// 4. طلب مكالمة
app.post('/api/call/request', (req, res) => {
    const { from, to, type } = req.body;
    const callRequest = { from, to, type, status: 'pending', timestamp: Date.now() };
    
    db.activeCalls.push(callRequest);
    
    // تنتهي صلاحية طلب المكالمة تلقائياً بعد 20 ثانية إذا لم يتم الرد
    setTimeout(() => {
        db.activeCalls = db.activeCalls.filter(c => c.timestamp !== callRequest.timestamp);
    }, 20000); 

    res.json({ success: true });
});

// --- تشغيل السيرفر ---
app.listen(PORT, () => {
    console.log(`------------------------------------`);
    console.log(`🚀 HEIBA CONNECT SERVER IS RUNNING`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`------------------------------------`);
});