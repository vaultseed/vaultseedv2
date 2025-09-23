const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://vaultseed.io'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
} else {
  console.log('⚠️ No MongoDB URI provided - running without database');
}

// Simple User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  salt: { type: String, required: true },
  securityQuestions: [{
    question: String,
    answerHash: String
  }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Simple Vault Schema
const vaultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedData: { type: String, required: true },
  clientSalt: { type: String, required: true }
}, { timestamps: true });

const Vault = mongoose.model('Vault', vaultSchema);

// Simple auth middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, securityQuestions, salt } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedSecurityQuestions = await Promise.all(
      securityQuestions.map(async (sq) => ({
        question: sq.question,
        answerHash: await bcrypt.hash(sq.answer.toLowerCase().trim(), 12)
      }))
    );

    const user = new User({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      salt,
      securityQuestions: hashedSecurityQuestions
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, email: user.email }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        securityQuestions: user.securityQuestions.map(sq => ({
          question: sq.question
        }))
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/verify-security', async (req, res) => {
  try {
    const { email, answers } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isValid = await Promise.all(
      answers.map(async (answer, index) => {
        const hashedAnswer = user.securityQuestions[index].answerHash;
        return bcrypt.compare(answer.toLowerCase().trim(), hashedAnswer);
      })
    );

    if (!isValid.every(Boolean)) {
      return res.status(401).json({ error: 'Security verification failed' });
    }

    res.json({ message: 'Security verification successful' });

  } catch (error) {
    console.error('Security verification error:', error);
    res.status(500).json({ error: 'Security verification failed' });
  }
});

// Vault routes
app.get('/api/vault', authenticateToken, async (req, res) => {
  try {
    const vault = await Vault.findOne({ userId: req.user._id });
    
    if (!vault) {
      return res.json({ 
        message: 'No vault found', 
        encryptedData: null,
        clientSalt: null 
      });
    }

    res.json({
      encryptedData: vault.encryptedData,
      clientSalt: vault.clientSalt,
      updatedAt: vault.updatedAt
    });

  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ error: 'Failed to retrieve vault' });
  }
});

app.post('/api/vault', authenticateToken, async (req, res) => {
  try {
    const { encryptedData, clientSalt } = req.body;

    let vault = await Vault.findOne({ userId: req.user._id });
    
    if (vault) {
      vault.encryptedData = encryptedData;
      vault.clientSalt = clientSalt;
    } else {
      vault = new Vault({
        userId: req.user._id,
        encryptedData,
        clientSalt
      });
    }

    await vault.save();

    res.json({
      message: 'Vault saved successfully',
      updatedAt: vault.updatedAt
    });

  } catch (error) {
    console.error('Save vault error:', error);
    res.status(500).json({ error: 'Failed to save vault' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
