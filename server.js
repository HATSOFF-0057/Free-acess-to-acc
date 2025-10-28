// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(bodyParser.json());
app.use(cors()); // adjust origins in production
app.use(express.static(path.join(__dirname, 'public')));

// open (or create) database
const db = new Database(path.join(__dirname, 'db.sqlite'));
db.pragma('journal_mode = WAL');

// create table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  heading REAL,
  speed REAL,
  ts INTEGER NOT NULL
);
`);

// insert prepared statement
const insertStmt = db.prepare(`
  INSERT INTO locations (device_id, latitude, longitude, accuracy, heading, speed, ts)
  VALUES (@device_id, @latitude, @longitude, @accuracy, @heading, @speed, @ts)
`);

// endpoint to receive location
app.post('/api/locations', (req, res) => {
  try {
    const { device_id, latitude, longitude, accuracy = null, heading = null, speed = null, ts } = req.body;
    if (!device_id || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof ts !== 'number') {
      return res.status(400).json({ ok: false, error: 'missing required fields' });
    }
    insertStmt.run({ device_id, latitude, longitude, accuracy, heading, speed, ts });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Insert error', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

// get recent points (optionally limit and device_id)
app.get('/api/locations', (req, res) => {
  const device_id = req.query.device_id;
  const limit = Math.min(parseInt(req.query.limit || '100'), 1000);
  let rows;
  if (device_id) {
    rows = db.prepare('SELECT * FROM locations WHERE device_id = ? ORDER BY ts DESC LIMIT ?').all(device_id, limit);
  } else {
    rows = db.prepare('SELECT * FROM locations ORDER BY ts DESC LIMIT ?').all(limit);
  }
  res.json(rows);
});

// serve index by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
