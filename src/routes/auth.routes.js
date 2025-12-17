const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authHttp = require('../middleware/authHttp');

const router = express.Router();

const issueToken = (user) => {
  return jwt.sign({ userId: user._id.toString(), name: user.name }, process.env.JWT_SECRET || 'change_me', { expiresIn: '7d' });
};

router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password too short' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash });
    const token = issueToken(user);
    return res.status(201).json({ token, user: { id: user._id.toString(), name: user.name, email: user.email } });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(user);
    return res.status(200).json({ token, user: { id: user._id.toString(), name: user.name, email: user.email } });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authHttp, async (req, res) => {
  return res.json({ user: { id: req.user.userId, name: req.user.name, email: req.user.email } });
});

module.exports = router;
