const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const roomRoutes = require('./routes/rooms.routes');
const authHttp = require('./middleware/authHttp');

const app = express();

app.use(express.json());
app.use(cors());

app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);

app.get('/me', authHttp, (req, res) => {
  res.json({ user: { id: req.user.userId, name: req.user.name, email: req.user.email } });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(500).json({ error: 'Server error' });
});

module.exports = app;
