server.jsconst express = require('express');
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

const db = new Database('patients.db');
db.exec(`
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

app.post('/api/patients', (req, res) => {
  const p = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO patients (name, dob, age, blood_group, address, contact1,
        emergency1, emergency2, emergency3, doctor_name, doctor_contact,
        health_condition, prescription, fingerprint_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(p.name, p.dob, p.age, p.blood_group, p.address, p.contact1,
        p.emergency1, p.emergency2, p.emergency3, p.doctor_name,
        p.doctor_contact, p.health_condition, p.prescription, p.fingerprint_id);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/api/patients', (req, res) => {
  res.json(db.prepare('SELECT * FROM patients').all());
});

app.get('/api/patients/fingerprint/:fid', (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE fingerprint_id = ?').get(req.params.fid);
  if (patient) res.json({ success: true, patient });
  else res.json({ success: false, message: 'Fingerprint not stored' });
});

app.put('/api/patients/:id', (req, res) => {
  const p = req.body;
  try {
    db.prepare(`
      UPDATE patients SET name=?, dob=?, age=?, blood_group=?, address=?,
        contact1=?, emergency1=?, emergency2=?, emergency3=?,
        doctor_name=?, doctor_contact=?, health_condition=?, prescription=?
      WHERE id=?
    `).run(p.name, p.dob, p.age, p.blood_group, p.address, p.contact1,
        p.emergency1, p.emergency2, p.emergency3, p.doctor_name,
        p.doctor_contact, p.health_condition, p.prescription, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
});