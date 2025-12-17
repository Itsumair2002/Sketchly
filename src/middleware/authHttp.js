const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authHttp = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change_me');
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { userId: user._id.toString(), name: user.name, email: user.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = authHttp;
