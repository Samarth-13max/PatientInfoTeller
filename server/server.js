const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://patientadmin:patient_isadmin@patientinfoteller.ow5rtgj.mongodb.net/?appName=PatientInfoTeller';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.log('MongoDB error:', err));

// Patient schema
const patientSchema = new mongoose.Schema({
  name: String,
  dob: String,
  age: Number,
  blood_group: String,
  address: String,
  contact1: String,
  emergency1: String,
  emergency2: String,
  emergency3: String,
  doctor_name: String,
  doctor_contact: String,
  health_condition: String,
  prescription: String,
  fingerprint_id: { type: String, unique: true }
});

const Patient = mongoose.model('Patient', patientSchema);

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
app.post('/api/patients', async (req, res) => {
  try {
    const existing = await Patient.findOne({ fingerprint_id: req.body.fingerprint_id });
    if (existing) {
      res.json({ success: false, error: 'Fingerprint already stored' });
      return;
    }
    const patient = new Patient(req.body);
    await patient.save();
    res.json({ success: true, id: patient._id });
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
});

// Get all patients
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await Patient.find();
    res.json(patients);
  } catch(err) {
    res.json([]);
  }
});

// Get patient by fingerprint
app.get('/api/patients/fingerprint/:fid', async (req, res) => {
  try {
    const patient = await Patient.findOne({ fingerprint_id: req.params.fid });
    if (patient) res.json({ success: true, patient });
    else res.json({ success: false, message: 'Fingerprint not stored' });
  } catch(err) {
    res.json({ success: false, message: err.message });
  }
});

// Update patient
app.put('/api/patients/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined') {
      res.json({ success: false, error: 'Invalid patient ID' });
      return;
    }
    await Patient.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true });
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/api/patients/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || id === 'undefined') {
      res.json({ success: false, error: 'Invalid patient ID' });
      return;
    }
    await Patient.findByIdAndDelete(id);
    res.json({ success: true });
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});