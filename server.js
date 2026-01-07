const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Admin Route to push new updates
app.post('/api/update', (req, res) => {
    const { type, subject, fileName, name } = req.body;

    if (type === 'material') {
        // Emit to all connected clients
        io.emit('new_material', { subject, type: req.body.materialType, fileName });
        return res.json({ success: true, message: "Material update pushed!" });
    }

    if (type === 'tool') {
        io.emit('new_tool', { name });
        return res.json({ success: true, message: "Tool update pushed!" });
    }

    res.status(400).json({ success: false, message: "Invalid update type" });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 CyberHub Real-Time Server running on http://localhost:${PORT}`);
    console.log(`---------------------------------------------------------`);
    console.log(`To simulate an update, send a POST request to:`);
    console.log(`http://localhost:${PORT}/api/update`);
    console.log(`Example Body for New PDF:`);
    console.log(JSON.stringify({
        type: "material",
        materialType: "pdf",
        subject: "cyber",
        fileName: "Advanced_PenTesting.pdf"
    }, null, 2));
    console.log(`---------------------------------------------------------`);
});
