const express = require('express');
const fs = require('fs');
const axios = require('axios');
const path = require('path'); // مكتبة أساسية للتعامل مع المسارات
const app = express();

const PORT = process.env.PORT || 3000;
const DB_PATH = './heiba_connect_db.json';

// إعدادات التلجرام
const TELEGRAM_TOKEN = '7543475859:AAENXZxHPQZafOlvBwFr6EatUFD31iYq-ks';
const MY_CHAT_ID = '5042495708';

// --- السطر الأهم لتشغيل الواجهة من مجلد public ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// قاعدة بيانات بسيطة
let db = { users: [], messages: [], activeCalls: [] };
if (fs.existsSync(DB_PATH)) {
    try { 
        db = JSON.parse(fs.readFileSync(DB_PATH)); 
    } catch (e) {
        console.log("Error reading DB, starting fresh.");
    }
}

const saveDB = () => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Failed to save DB:", e);
    }
};

// التفاعل مع تلجرام لإبلاغك بالتحركات
async function notifyAdmin(msg) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: MY_CHAT_ID,
            text: `👑 *نظام هيبة للاتصالات:*\n${msg}`,
            parse_mode: 'Markdown'
        });
    } catch (e) {
        console.error("Telegram notification failed");
    }
}

// --- المسارات البرمجية (APIs) ---

// مسار الترحيب (اختياري للتأكد من عمل السيرفر)
app.get('/status', (req, res) => {
    res.json({ status: "running", server: "Heiba Connect Pro" });
});

app.post('/api/auth', (req, res) => {
    const { name, password, action } = req.body;
    const user = db.users.find(u => u.name === name);

    if (action === 'login') {
        if (user) {
            if (user.password === password) return res.json(user);
            return res.status(403).json({ error: "كلمة المرور خطأ" });
        }
        // تسجيل تلقائي
        const newUser = { 
            id: 'U' + Math.random().toString(36).substr(2, 5), 
            name, password, verified: false 
        };
        db.users.push(