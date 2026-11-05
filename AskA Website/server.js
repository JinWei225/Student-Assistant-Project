require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./chatDb');
const mysqlDb = require('./departmentDB');

// Configure Multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET is not set. Add it to your .env file before starting the server.');
    process.exit(1);
}

app.use(cors());
app.use(express.json());

// Serve frontend static files and uploaded files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Auth token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// ─── AUTH ENDPOINTS ───────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.execute(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const [rows] = await db.execute(`SELECT * FROM users WHERE username = ?`, [username]);
        const user = rows[0];
        if (!user) return res.status(400).json({ error: 'Invalid username or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CHAT HISTORY ENDPOINTS ───────────────────────────────────────

// Get all chat sessions for the logged-in user
app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.execute(`SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY timestamp DESC`, [req.user.id]);

        // Parse messages back to array
        const sessions = rows.map(r => ({
            ...r,
            messages: r.messages ? JSON.parse(r.messages) : []
        }));

        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new empty chat session
app.post('/api/history', authenticateToken, async (req, res) => {
    const { id, title, timestamp, messages } = req.body;
    const msgStr = JSON.stringify(messages || []);

    try {
        await db.execute(
            `INSERT INTO chat_sessions (id, user_id, title, timestamp, messages) VALUES (?, ?, ?, ?, ?)`,
            [id, req.user.id, title || 'New Chat', timestamp || new Date().toISOString(), msgStr]
        );
        res.status(201).json({ message: 'Session created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an existing chat session (title or messages)
app.put('/api/history/:id', authenticateToken, async (req, res) => {
    const sessionId = req.params.id;
    const { title, messages } = req.body;

    // Build dynamic query
    let query = 'UPDATE chat_sessions SET ';
    const params = [];
    if (title !== undefined) {
        query += 'title = ?, ';
        params.push(title);
    }
    if (messages !== undefined) {
        query += 'messages = ?, ';
        params.push(JSON.stringify(messages));
    }

    if (params.length === 0) {
        return res.json({ message: 'Nothing to update' });
    }

    // remove last comma
    query = query.slice(0, -2);
    query += ' WHERE id = ? AND user_id = ?';
    params.push(sessionId, req.user.id);

    try {
        const [result] = await db.execute(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Session not found or unauthorized' });
        res.json({ message: 'Session updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a chat session
app.delete('/api/history/:id', authenticateToken, async (req, res) => {
    const sessionId = req.params.id;

    try {
        const [result] = await db.execute(`DELETE FROM chat_sessions WHERE id = ? AND user_id = ?`, [sessionId, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Session not found or unauthorized' });
        res.json({ message: 'Session deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── FORM SUBMISSION ENDPOINT ───────────────────────────────────────

const TICKET_WEBHOOK_URL = 'http://localhost:5678/webhook/a2adbab1-d7f0-47d6-b88c-8785eea6be7f';

app.post('/api/forms', authenticateToken, upload.single('attachment'), async (req, res) => {
    const { department, category, blockRoom, campusId, question, name, email, telephone } = req.body;
    const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
    const timestamp = new Date().toISOString();

    try {
        const [result] = await db.execute(
            `INSERT INTO submitted_forms (
                user_id, department, category, block_room, campus_id, 
                question, name, email, attachment_path, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, department, category, blockRoom, campusId, question, name, email, attachmentPath, timestamp]
        );

        const localFormId = result.insertId;

        // ── Push to MySQL (company_reports.tickets) ──
        let mysqlTicketId = null;
        try {
            const [mysqlResult] = await mysqlDb.execute(
                `INSERT INTO tickets (department, block_room_no, student_id, student_name, student_email, student_telephone, issue_category, description, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
                [department, blockRoom || null, campusId, name, email, telephone || null, category || 'General', question]
            );
            mysqlTicketId = mysqlResult.insertId;
            console.log(`✅ Ticket inserted into MySQL (id: ${mysqlTicketId})`);
        } catch (mysqlErr) {
            console.error('❌ Failed to insert ticket into MySQL:', mysqlErr.message);
        }

        // ── Call webhook ──
        try {
            const webhookPayload = {
                formId: localFormId,
                mysqlTicketId,
                student_id: campusId,
                department,
                category,
                blockRoom,
                question,
                name,
                email,
                telephone,
                attachmentPath,
                timestamp
            };

            const webhookRes = await fetch(TICKET_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            });
            console.log(`✅ Webhook called (status: ${webhookRes.status})`);
        } catch (webhookErr) {
            console.error('❌ Failed to call webhook:', webhookErr.message);
        }

        res.status(201).json({ message: 'Form submitted successfully', formId: localFormId, mysqlTicketId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── START SERVER ─────────────────────────────────────────────────

app.listen(PORT,() => {
    console.log(`Server is running on http://localhost:${PORT}`);
});