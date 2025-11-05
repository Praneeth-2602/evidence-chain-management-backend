const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ msg: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // contains at least user_id and role
    return next();
  } catch (err) {
    return res.status(401).json({ msg: 'Invalid token' });
  }
}

function authorize(roles = []) {
  // roles: array or single string
  if (typeof roles === 'string') roles = [roles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ msg: 'Not authenticated' });
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ msg: 'Forbidden' });
    return next();
  };
}

module.exports = { authenticate, authorize };
