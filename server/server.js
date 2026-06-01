const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// In-memory storage
let patients = [];
let nextId = 1;
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
  const existing = patients.find(pt => pt.fingerprint_id === p.fingerprint_id);
  if (existing) {
    res.json({ success: false, error: 'Fingerprint already stored' });
    return;
  }
  const patient = { id: nextId++, ...p };
  patients.push(patient);
  res.json({ success: true, id: patient.id });
});

app.get('/api/patients', (req, res) => {
  res.json(patients);
});

app.get('/api/patients/fingerprint/:fid', (req, res) => {
  const patient = patients.find(p => p.fingerprint_id === req.params.fid);
  if (patient) res.json({ success: true, patient });
  else res.json({ success: false, message: 'Fingerprint not stored' });
});

app.put('/api/patients/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = patients.findIndex(p => p.id === id);
  if (index !== -1) {
    patients[index] = { ...patients[index], ...req.body };
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'Patient not found' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});