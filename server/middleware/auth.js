const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    if (user.isLocked) {
      return res.status(423).json({ 
        error: 'Account is locked due to too many failed attempts',
        lockUntil: user.lockUntil
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const logActivity = (action) => {
  return async (req, res, next) => {
    try {
      const log = new AuditLog({
        userId: req.user?._id,
        email: req.user?.email || req.body?.email || 'unknown',
        action,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        details: {
          method: req.method,
          url: req.originalUrl,
          timestamp: new Date()
        }
      });
      
      await log.save();
      next();
    } catch (error) {
      console.error('Audit log error:', error);
      next(); // Don't block request if logging fails
    }
  };
};

module.exports = {
  authenticateToken,
  logActivity
};