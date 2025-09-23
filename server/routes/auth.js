const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { authLimiter } = require('../middleware/security');
const { logActivity } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('securityQuestions').isArray({ min: 2, max: 2 }).withMessage('Exactly 2 security questions required'),
  body('securityQuestions.*.question').notEmpty().withMessage('Security question cannot be empty'),
  body('securityQuestions.*.answer').isLength({ min: 1 }).withMessage('Security answer cannot be empty')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
];

// Register new user
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, securityQuestions, salt } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await logActivity('REGISTRATION_FAILED')(req, res, () => {});
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash security question answers
    const hashedSecurityQuestions = await Promise.all(
      securityQuestions.map(async (sq) => ({
        question: sq.question,
        answerHash: await bcrypt.hash(sq.answer.toLowerCase().trim(), 12)
      }))
    );

    // Create new user
    const user = new User({
      email,
      passwordHash: password, // Will be hashed by pre-save middleware
      salt,
      securityQuestions: hashedSecurityQuestions
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log successful registration
    await logActivity('REGISTRATION_SUCCESS')(req, res, () => {});

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      await logActivity('LOGIN_FAILED')(req, res, () => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.isLocked) {
      await logActivity('LOGIN_FAILED_LOCKED')(req, res, () => {});
      return res.status(423).json({ 
        error: 'Account is locked due to too many failed attempts',
        lockUntil: user.lockUntil
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      await user.incFailedAttempts();
      await logActivity('LOGIN_FAILED')(req, res, () => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts on successful login
    await user.resetFailedAttempts();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log successful login
    await logActivity('LOGIN_SUCCESS')(req, res, () => {});

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

// Verify security questions
router.post('/verify-security', authLimiter, [
  body('answers').isArray({ min: 2, max: 2 }).withMessage('Exactly 2 security answers required'),
  body('answers.*').notEmpty().withMessage('Security answers cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, answers } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify security question answers
    const isValid = await Promise.all(
      answers.map(async (answer, index) => {
        const hashedAnswer = user.securityQuestions[index].answerHash;
        return bcrypt.compare(answer.toLowerCase().trim(), hashedAnswer);
      })
    );

    if (!isValid.every(Boolean)) {
      await logActivity('SECURITY_VERIFICATION_FAILED')(req, res, () => {});
      return res.status(401).json({ error: 'Security verification failed' });
    }

    await logActivity('SECURITY_VERIFICATION_SUCCESS')(req, res, () => {});

    res.json({ message: 'Security verification successful' });

  } catch (error) {
    console.error('Security verification error:', error);
    res.status(500).json({ error: 'Security verification failed' });
  }
});

module.exports = router;