const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./patients.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dob TEXT,
      age INTEGER,
      blood_group TEXT,
      address TEXT,
      contact1 TEXT,
      emergency1 TEXT,
      emergency2 TEXT,
      emergency3 TEXT,
      doctor_name TEXT,
      doctor_contact TEXT,
      health_condition TEXT,
      prescription TEXT,
      fingerprint_id TEXT UNIQUE
    )
  `);
});

let pendingSession = null;

io.on('connection', (socket) => {
  console.log('Device connected:', socket.id);

  socket.on('request_fingerprint', (data) => {
    pendingSession = { pcSocketId: socket.id, action: data.action };
    io.emit('scan_fingerprint', { action: data.action });
  });

  socket.on('fingerprint_result', (data) => {
    if (pendingSession) {
      io.to(pendingSession.pcSocketId).emit('fingerprint_done', {
        success: data.success,
        fingerprintId: data.fingerprintId,
        action: pendingSession.action
      });
      pendingSession = null;
    }
  });

  socket.on('disconnect', () => {
    console.log('Device disconnected:', socket.id);
  });
});

// Create patient
app.post('/api/patients', (req, res) => {
  const p = req.body;
  const sql = `
    INSERT INTO patients (name, dob, age, blood_group, address, contact1,
      emergency1, emergency2, emergency3, doctor_name, doctor_contact,
      health_condition, prescription, fingerprint_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(sql, [
    p.name, p.dob, p.age, p.blood_group, p.address, p.contact1,
    p.emergency1, p.emergency2, p.emergency3, p.doctor_name,
    p.doctor_contact, p.health_condition, p.prescription, p.fingerprint_id
  ], function(err) {
    if (err) res.json({ success: false, error: err.message });
    else res.json({ success: true, id: this.lastID });
  });
});

// Get all patients
app.get('/api/patients', (req, res) => {
  db.all('SELECT * FROM patients', [], (err, rows) => {
    if (err) res.json({ success: false, error: err.message });
    else res.json(rows);
  });
});

// Get patient by fingerprint
app.get('/api/patients/fingerprint/:fid', (req, res) => {
  db.get('SELECT * FROM patients WHERE fingerprint_id = ?', [req.params.fid], (err, row) => {
    if (err) res.json({ success: false, error: err.message });
    else if (row) res.json({ success: true, patient: row });
    else res.json({ success: false, message: 'Fingerprint not stored' });
  });
});

// Update patient
app.put('/api/patients/:id', (req, res) => {
  const p = req.body;
  const sql = `
    UPDATE patients SET name=?, dob=?, age=?, blood_group=?, address=?,
      contact1=?, emergency1=?, emergency2=?, emergency3=?,
      doctor_name=?, doctor_contact=?, health_condition=?, prescription=?
    WHERE id=?
  `;
  db.run(sql, [
    p.name, p.dob, p.age, p.blood_group, p.address, p.contact1,
    p.emergency1, p.emergency2, p.emergency3, p.doctor_name,
    p.doctor_contact, p.health_condition, p.prescription, req.params.id
  ], function(err) {
    if (err) res.json({ success: false, error: err.message });
    else res.json({ success: true });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});