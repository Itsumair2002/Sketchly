const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const User = require('../models/User');
const Otp = require('../models/Otp');
const authHttp = require('../middleware/authHttp');

const router = express.Router();

const sendOtpEmail = async (email, code) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM;
  if (!apiKey || !from) {
    throw new Error('SendGrid not configured');
  }
  sgMail.setApiKey(apiKey);
  const sendPromise = sgMail.send({
    to: email,
    from,
    subject: 'Your Sketchly verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 10000));
  await Promise.race([sendPromise, timeout]);
};

const createOtpForUser = async (user) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await Otp.deleteMany({ userId: user._id });
  await Otp.create({
    userId: user._id,
    email: user.email,
    codeHash,
    expiresAt
  });
  await sendOtpEmail(user.email, code);
};

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
      if (!existing.isVerified) {
        await createOtpForUser(existing);
        return res.status(200).json({ pending: true, email: existing.email });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash, isVerified: false });
    await createOtpForUser(user);
    return res.status(201).json({ pending: true, email: user.email });
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

    if (!user.isVerified) {
      await createOtpForUser(user);
      return res.status(403).json({ error: 'Email not verified', code: 'UNVERIFIED', pending: true, email: user.email });
    }

    const token = issueToken(user);
    return res.status(200).json({ token, user: { id: user._id.toString(), name: user.name, email: user.email } });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/verify', async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.isVerified) {
      const token = issueToken(user);
      return res.json({ token, user: { id: user._id.toString(), name: user.name, email: user.email } });
    }

    const record = await Otp.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP expired' });
    }
    const ok = await bcrypt.compare(String(otp).trim(), record.codeHash);
    if (!ok) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    user.isVerified = true;
    await user.save();
    await Otp.deleteMany({ userId: user._id });

    const token = issueToken(user);
    return res.json({ token, user: { id: user._id.toString(), name: user.name, email: user.email } });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/resend', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    await createOtpForUser(user);
    return res.json({ pending: true, email: user.email });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authHttp, async (req, res) => {
  return res.json({ user: { id: req.user.userId, name: req.user.name, email: req.user.email } });
});

module.exports = router;
