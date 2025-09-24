const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (needed for correct IP when behind Cloudflare / Railway)
app.set('trust proxy', true);

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  salt: { type: String, required: true },
  securityQuestions: [{ question: String, answerHash: String }],
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Vault Schema
const vaultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedData: { type: String, required: true },
  serverSalt: String,
  clientSalt: { type: String, required: true },
  version: { type: String, default: '1.0' },
  lastAccessed: { type: Date, default: Date.now }
}, { timestamps: true });

const Vault = mongoose.model('Vault', vaultSchema);

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  rating: { type: Number, min: 1, max: 5, required: true },
  message: { type: String, required: true, maxLength: 2000 },
  email: String,
  userAgent: String,
  ipAddress: String,
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);

// Auth middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid or inactive user' });

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, securityQuestions, salt } = req.body;
    if (!email || !password || !securityQuestions || !salt) return res.status(400).json({ error: 'All fields are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(409).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const hashedSecurityQuestions = await Promise.all(
      securityQuestions.map(async (sq) => ({
        question: sq.question,
        answerHash: await bcrypt.hash(sq.answer.toLowerCase().trim(), 12)
      }))
    );

    const user = new User({ email: normalizedEmail, passwordHash, salt, securityQuestions: hashedSecurityQuestions });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, email: user.email, createdAt: user.createdAt }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({ error: 'Account locked', lockUntil: user.lockUntil });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        securityQuestions: user.securityQuestions.map(sq => ({ question: sq.question }))
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify security questions
app.post('/api/auth/verify-security', async (req, res) => {
  try {
    const { email, answers } = req.body;
    if (!email || !answers || answers.length !== 2) {
      return res.status(400).json({ error: 'Email and 2 answers required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const isValid = await Promise.all(
      answers.map(async (answer, i) => bcrypt.compare(answer.toLowerCase().trim(), user.securityQuestions[i].answerHash))
    );
    if (!isValid.every(Boolean)) return res.status(401).json({ error: 'Security verification failed' });

    res.json({ message: 'Security verification successful' });
  } catch (error) {
    console.error('Security verification error:', error);
    res.status(500).json({ error: 'Security verification failed' });
  }
});

// Vault endpoints
app.get('/api/vault', authenticateToken, async (req, res) => {
  try {
    const vault = await Vault.findOne({ userId: req.user._id });
    if (!vault) return res.json({ message: 'No vault found', encryptedData: null, clientSalt: null });

    vault.lastAccessed = new Date();
    await vault.save();

    res.json({ encryptedData: vault.encryptedData, clientSalt: vault.clientSalt, lastAccessed: vault.lastAccessed });
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ error: 'Failed to retrieve vault' });
  }
});

app.post('/api/vault', authenticateToken, async (req, res) => {
  try {
    const { encryptedData, clientSalt } = req.body;
    if (!encryptedData || !clientSalt) return res.status(400).json({ error: 'Encrypted data and client salt required' });

    let vault = await Vault.findOne({ userId: req.user._id });
    if (vault) {
      vault.encryptedData = encryptedData;
      vault.clientSalt = clientSalt;
      vault.lastAccessed = new Date();
    } else {
      vault = new Vault({ userId: req.user._id, encryptedData, clientSalt, lastAccessed: new Date() });
    }
    await vault.save();

    res.json({ message: 'Vault saved successfully', updatedAt: vault.updatedAt });
  } catch (error) {
    console.error('Save vault error:', error);
    res.status(500).json({ error: 'Failed to save vault' });
  }
});

// Feedback endpoints
app.post('/api/feedback', async (req, res) => {
  try {
    const { rating, message, email } = req.body;
    if (!rating || !message) return res.status(400).json({ error: 'Rating and message are required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

    // Get real client IP
    const ip =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip;

    const feedback = new Feedback({
      rating,
      message,
      email: email || null,
      userAgent: req.get('User-Agent'),
      ipAddress: ip
    });

    await feedback.save();
    res.status(201).json({ message: 'Feedback submitted successfully', id: feedback._id });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

app.get('/api/feedback', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const feedback = await Feedback.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Feedback.countDocuments();

    res.json({ feedback, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to retrieve feedback' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
