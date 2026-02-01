require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

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

// Verified Piston Public Mirrors
const PISTON_ENDPOINTS = [
    'https://emmet.vps.realt.ws/piston/api/v2/execute',
    'https://piston.rtex.dev/api/v2/execute',
    'https://piston.codes/api/v2/execute',
    'https://piston.engineer/api/v2/execute'
];

const JUDGE0_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com/submissions';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;

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

    // --- DEMO / OFFLINE MODE ---
    if (code.toLowerCase().includes("cyberhub demo")) {
        return res.json({
            stdout: `Welcome to CyberHub ${language.toUpperCase()} Demo Mode!\n--------------------\nCode received: OK\nCompiler: Cloud Simulated\nStatus: Success`,
            stderr: "",
            compile_output: "",
            status: { id: 3, description: "Accepted" }
        });
    }

    const languageId = LANGUAGE_IDS[language];
    if (!languageId) return res.status(400).json({ error: "Unsupported language" });

    try {
        // Step 1: Create Submission
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

        // Step 2: Poll for results
        let result = null;
        const maxPolls = 10;
        for (let i = 0; i < maxPolls; i++) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s

            const pollResponse = await axios.get(`${JUDGE0_URL}/${token}?base64_encoded=false`, {
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': RAPIDAPI_HOST
                }
            });

            const status = pollResponse.data.status.id;
            if (status !== 1 && status !== 2) { // 1: In Queue, 2: Processing
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
