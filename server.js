const express = require('express');
const fs = require('fs');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const DB_PATH = './heiba_connect_db.json';

// إعدادات التلجرام (نفس بياناتك السابقة)
const TELEGRAM_TOKEN = '7543475859:AAENXZxHPQZafOlvBwFr6EatUFD31iYq-ks';
const MY_CHAT_ID = '5042495708';

app.use(express.json());

let db = { users: [], messages: [], activeCalls: [] };
if (fs.existsSync(DB_PATH)) {
    try { db = JSON.parse(fs.readFileSync(DB_PATH)); } catch (e) { }
}

const saveDB = () => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

// التفاعل مع تلجرام لإبلاغ الأدمن
async function notifyAdmin(msg) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: MY_CHAT_ID,
            text: `👑 *نظام هيبة للاتصالات:*\n${msg}`,
            parse_mode: 'Markdown'
        });
    } catch (e) {}
}

// APIs
app.post('/api/auth', (req, res) => {
    const { name, password, action } = req.body;
    const user = db.users.find(u => u.name === name);

    if (action === 'login') {
        if (user) {
            if (user.password === password) return res.json(user);
            return res.status(403).json({ error: "كلمة المرور خطأ" });
        }
        // تسجيل تلقائي إذا لم يوجد (للتسهيل)
        const newUser = { 
            id: 'U' + Math.random().toString(36).substr(2, 5), 
            name, password, verified: false 
        };
        db.users.push(newUser);
        saveDB();
        notifyAdmin(`عضو جديد انضم: ${name}`);
        return res.json(newUser);
    }
});

app.get('/api/sync', (req, res) => {
    const { userId } = req.query;
    const incomingCall = db.activeCalls.find(c => c.to === userId);
    
    res.json({
        users: db.users,
        messages: db.messages,
        incomingCall: incomingCall ? { ...incomingCall, fromName: db.users.find(u=>u.id===incomingCall.from)?.name } : null
    });
});

app.post('/api/messages', (req, res) => {
    const { from, to, text } = req.body;
    db.messages.push({ from, to, text, time: new Date() });
    // حفظ آخر 100 رسالة فقط لتوفير المساحة
    if(db.messages.length > 100) db.messages.shift();
    saveDB();
    res.json({ success: true });
});

app.post('/api/call/request', (req, res) => {
    const { from, to, type } = req.body;
    db.activeCalls.push({ from, to, type, status: 'pending' });
    setTimeout(() => {
        db.activeCalls = db.activeCalls.filter(c => !(c.from === from && c.to === to));
    }, 15000); // تنتهي صلاحية الطلب بعد 15 ثانية
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`HEIBA CONNECT RUNNING ON ${PORT}`));