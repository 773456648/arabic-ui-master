const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// --- المفتاح الملكي الذي أرسلته أنت ---
const METERED_SECRET_KEY = "xBc7kqmoqffdBdq2uwhxMFmC4rSCc4bVvzfwsNWkXEU5OEOd"; 
const METERED_APP_NAME = "heiba-royal-2024";

// --- بيانات التلجرام الخاصة بك ---
const TELEGRAM_TOKEN = '7543475859:AAENXZxHPQZafOlvBwFr6EatUFD31iYq-ks';
const MY_CHAT_ID = '5042495708';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// دالة جلب سيرفرات TURN لتأمين الاتصال في اليمن
async function getTurnServers() {
    try {
        const response = await axios.get(`https://${METERED_APP_NAME}.metered.ca/api/v1/turn/credentials?apiKey=${METERED_SECRET_KEY}`);
        return response.data;
    } catch (e) {
        return [{ urls: "stun:stun.l.google.com:19302" }];
    }
}

app.get('/api/sync', async (req, res) => {
    const turnServers = await getTurnServers();
    res.json({ iceServers: turnServers });
});

app.post('/api/auth', async (req, res) => {
    const { name } = req.body;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: MY_CHAT_ID,
            text: `👑 *FADI CONNECT:*\nتم دخول النظام بواسطة: ${name}`,
            parse_mode: 'Markdown'
        });
    } catch (e) {}
    res.json({ name, status: "success" });
});

server.listen(PORT, () => console.log(`🚀 HEIBA ROYAL LIVE ON ${PORT}`));