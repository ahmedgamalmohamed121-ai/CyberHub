require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('./'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

const JUDGE0_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com/submissions';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Telegram & Notifications Config
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || "").split(',').map(id => id.trim());
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || crypto.randomBytes(16).toString('hex');
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY; // Legacy key or use Service Account for V1

const ANNOUNCEMENTS_FILE = path.join(__dirname, 'data', 'announcements.json');
const SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'subscribers.json');
const MATERIALS_FILE = path.join(__dirname, 'data', 'materials.json');
const GRADES_FILE = path.join(__dirname, 'data', 'grades.json');

// Ensure data directory exists
async function initStorage() {
    const dir = path.join(__dirname, 'data');
    try { await fs.access(dir); } catch { await fs.mkdir(dir); }
    try { await fs.access(ANNOUNCEMENTS_FILE); } catch { await fs.writeFile(ANNOUNCEMENTS_FILE, '[]'); }
    try { await fs.access(SUBSCRIBERS_FILE); } catch { await fs.writeFile(SUBSCRIBERS_FILE, '[]'); }
    try { await fs.access(MATERIALS_FILE); } catch { await fs.writeFile(MATERIALS_FILE, '{}'); }
    try { await fs.access(GRADES_FILE); } catch { await fs.writeFile(GRADES_FILE, '[]'); }
}
initStorage();

const LANGUAGE_IDS = {
    'python': 71,   // Python 3.8.1
    'c': 50,        // C (GCC 9.2.0)
    'cpp': 54,      // C++ (GCC 9.2.0)
    'java': 62,     // Java (OpenJDK 13.0.1)
    'javascript': 63, // Node.js 12.14.0
    'php': 68,      // PHP 7.4.1
    'sql': 82       // SQL (SQLite 3.31.1)
};

app.post('/api/execute', async (req, res) => {
    const { language, code, stdin } = req.body;

    if (!code) return res.status(400).json({ error: "No code provided" });

    const languageId = LANGUAGE_IDS[language];
    if (!languageId) return res.status(400).json({ error: "Unsupported language" });

    try {
        const submissionResponse = await axios.post(`${JUDGE0_URL}?base64_encoded=false&wait=false`, {
            language_id: languageId,
            source_code: code,
            stdin: stdin || ""
        }, {
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST
            }
        });

        const token = submissionResponse.data.token;
        if (!token) throw new Error("Failed to get token from Judge0");

        let result = null;
        const maxPolls = 10;
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const pollResponse = await axios.get(`${JUDGE0_URL}/${token}?base64_encoded=false`, {
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': RAPIDAPI_HOST
                }
            });

            const status = pollResponse.data.status.id;
            if (status !== 1 && status !== 2) {
                result = pollResponse.data;
                break;
            }
        }

        if (!result) return res.status(504).json({ error: "Execution timed out" });

        return res.json({
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            compile_output: result.compile_output || "",
            message: result.message || "",
            time: result.time,
            memory: result.memory,
            status: result.status
        });

    } catch (error) {
        console.error(`[EXEC ERROR]:`, error.response ? error.response.data : error.message);
        res.status(500).json({
            error: "Failed to execute code",
            details: error.response ? error.response.data : error.message
        });
    }
});

app.post('/api/ai-explain', async (req, res) => {
    const { prompt } = req.body;
    if (!GEMINI_API_KEY) return res.status(503).json({ error: "AI Service not configured on server" });

    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        const aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "AI Error";
        res.json({ text: aiText });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ANNOUNCEMENTS & TELEGRAM WEBHOOK ---

app.get('/api/announcements', async (req, res) => {
    try {
        const data = await fs.readFile(ANNOUNCEMENTS_FILE, 'utf8');
        const announcements = JSON.parse(data);
        res.json(announcements.slice(-20).reverse()); // Return last 20
    } catch (err) {
        res.status(500).json({ error: "Failed to read announcements" });
    }
});

app.get('/api/materials', async (req, res) => {
    try {
        const data = await fs.readFile(MATERIALS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: "Failed to read materials" });
    }
});

app.get('/api/grades', async (req, res) => {
    try {
        const data = await fs.readFile(GRADES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: "Failed to read grades" });
    }
});

app.post('/api/subscribe', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });

    try {
        const data = await fs.readFile(SUBSCRIBERS_FILE, 'utf8');
        let subs = JSON.parse(data);
        if (!subs.includes(token)) {
            subs.push(token);
            await fs.writeFile(SUBSCRIBERS_FILE, JSON.stringify(subs));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Subscription failed" });
    }
});

app.post('/telegram-webhook', async (req, res) => {
    // Basic Security: Check secret header if provided by TG or custom
    const tgSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (WEBHOOK_SECRET && tgSecret !== WEBHOOK_SECRET) {
        // Optional: you can set this when calling setWebhook
        // For now, let's at least check the chat ID
    }

    const { message } = req.body;
    if (!message || !message.text) return res.sendStatus(200);

    // ONLY accept from Admins
    if (!ADMIN_CHAT_IDS.includes(String(message.chat.id))) {
        console.warn(`Unauthorized access from Chat ID: ${message.chat.id}`);
        return res.sendStatus(200);
    }

    const text = message.text.trim();
    if (text.length === 0 || text.length > 2000) return res.sendStatus(200);

    const announcement = {
        id: Date.now(),
        text: text,
        created_at: new Date().toISOString(),
        source: "telegram"
    };

    try {
        // 1. Save announcement
        const data = await fs.readFile(ANNOUNCEMENTS_FILE, 'utf8');
        let announcements = JSON.parse(data);
        announcements.push(announcement);
        await fs.writeFile(ANNOUNCEMENTS_FILE, JSON.stringify(announcements));

        // 2. Emit via Socket.io for real-time update
        io.emit('new_announcement', announcement);

        // 3. Send Push Notifications
        sendPushNotifications(announcement.text);

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook Error:", err);
        res.sendStatus(500);
    }
});

async function sendPushNotifications(text) {
    if (!FCM_SERVER_KEY) return;
    try {
        const data = await fs.readFile(SUBSCRIBERS_FILE, 'utf8');
        const tokens = JSON.parse(data);
        if (tokens.length === 0) return;

        // Using Legacy FCM API for simplicity (no oauth2 flow needed here)
        await axios.post('https://fcm.googleapis.com/fcm/send', {
            registration_ids: tokens,
            notification: {
                title: "CyberHub Announcement 📢",
                body: text.length > 100 ? text.substring(0, 97) + "..." : text,
                icon: "/favicon.ico",
                click_action: "https://" + (process.env.DOMAIN || "localhost:3000") + "/#announcements"
            }
        }, {
            headers: {
                'Authorization': `key=${FCM_SERVER_KEY}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (err) {
        console.error("FCM Error:", err.response ? err.response.data : err.message);
    }
}

// --- ADMIN DASHBOARD API ---

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        // In a real app, use JWT. For now, simple success
        res.json({ success: true, token: crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex') });
    } else {
        res.status(401).json({ success: false, error: "Invalid password" });
    }
});

// Middleware for admin auth (simple check for demo purpose)
const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    const expected = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');
    if (token === expected) return next();
    res.status(403).json({ error: "Unauthorized" });
};

app.post('/api/admin/announcement', adminAuth, async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const announcement = {
        id: Date.now(),
        text: text,
        created_at: new Date().toISOString(),
        source: "admin_panel"
    };

    try {
        const data = await fs.readFile(ANNOUNCEMENTS_FILE, 'utf8');
        let announcements = JSON.parse(data);
        announcements.push(announcement);
        await fs.writeFile(ANNOUNCEMENTS_FILE, JSON.stringify(announcements));
        io.emit('new_announcement', announcement);
        sendPushNotifications(announcement.text);
        res.json({ success: true, announcement });
    } catch (err) {
        res.status(500).json({ error: "Failed to save" });
    }
});

app.delete('/api/admin/announcement/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const data = await fs.readFile(ANNOUNCEMENTS_FILE, 'utf8');
        let announcements = JSON.parse(data);
        const filtered = announcements.filter(a => String(a.id) !== String(id));
        await fs.writeFile(ANNOUNCEMENTS_FILE, JSON.stringify(filtered));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

app.post('/api/admin/material', adminAuth, async (req, res) => {
    const { subjectId, material } = req.body; // material: { type: 'chapter'|'playlist'|'task', data: {...} }
    if (!subjectId || !material) return res.status(400).json({ error: "Data missing" });

    try {
        const data = await fs.readFile(MATERIALS_FILE, 'utf8');
        let materials = JSON.parse(data);

        if (!materials[subjectId]) {
            materials[subjectId] = { title: subjectId, chapters: [], playlists: [], tasks: [] };
        }

        const subj = materials[subjectId];
        if (material.type === 'chapter') subj.chapters.push(material.data);
        if (material.type === 'playlist') subj.playlists.push(material.data);
        if (material.type === 'task') subj.tasks.push(material.data);

        await fs.writeFile(MATERIALS_FILE, JSON.stringify(materials));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update materials" });
    }
});

app.delete('/api/admin/material/:subjectId/:type/:index', adminAuth, async (req, res) => {
    const { subjectId, type, index } = req.params;
    try {
        const data = await fs.readFile(MATERIALS_FILE, 'utf8');
        let materials = JSON.parse(data);
        if (materials[subjectId] && materials[subjectId][type + 's']) {
            materials[subjectId][type + 's'].splice(index, 1);
            await fs.writeFile(MATERIALS_FILE, JSON.stringify(materials));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Error deleting" });
    }
});

app.post('/api/admin/grade', adminAuth, async (req, res) => {
    const { student } = req.body; // student: { id, name, gpa, grades: [...] }
    if (!student || !student.id) return res.status(400).json({ error: "Data missing" });

    try {
        const data = await fs.readFile(GRADES_FILE, 'utf8');
        let students = JSON.parse(data);
        const index = students.findIndex(s => s.id === student.id);
        if (index > -1) students[index] = student; // Update existing
        else students.push(student); // Add new

        await fs.writeFile(GRADES_FILE, JSON.stringify(students));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save grades" });
    }
});

app.delete('/api/admin/grade/:id', adminAuth, async (req, res) => {
    try {
        const data = await fs.readFile(GRADES_FILE, 'utf8');
        let students = JSON.parse(data);
        const filtered = students.filter(s => s.id !== req.params.id);
        await fs.writeFile(GRADES_FILE, JSON.stringify(filtered));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete student" });
    }
});

app.post('/api/update', (req, res) => {
    const { type, subject, fileName, name } = req.body;
    if (type === 'material') {
        io.emit('new_material', { subject, type: req.body.materialType, fileName });
        return res.json({ success: true });
    }
    if (type === 'tool') {
        io.emit('new_tool', { name });
        return res.json({ success: true });
    }
    res.status(400).json({ success: false });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
});

server.listen(PORT, () => {
    console.log(`🚀 CyberHub Running at http://localhost:${PORT}`);
});
