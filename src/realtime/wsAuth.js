const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyWsAuth = async (req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
    const user = await User.findById(decoded.userId).lean();
    if (!user) return null;
    return { userId: user._id.toString(), name: user.name };
  } catch (err) {
    return null;
  }
};

module.exports = verifyWsAuth;
