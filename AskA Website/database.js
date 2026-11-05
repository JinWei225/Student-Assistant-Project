const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT,
                timestamp TEXT,
                messages TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS submitted_forms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                department TEXT,
                category TEXT,
                block_room TEXT,
                campus_id TEXT,
                question TEXT,
                name TEXT,
                email TEXT,
                attachment_path TEXT,
                timestamp TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            )`);
        });
    }
});

module.exports = db;
