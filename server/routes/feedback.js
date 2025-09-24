// server/routes/feedback.js
const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback'); // <-- make sure you have this model

// @route   POST /api/feedback
// @desc    Submit feedback
// @access  Public (or protect with auth if you want)
router.post('/', async (req, res) => {
  try {
    const { message, email } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Feedback message is required' });
    }

    // Extract IP (prefer cf-connecting-ip, then x-forwarded-for, then req.ip)
    const ip =
      req.headers['cf-connecting-ip'] ||
      (req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : null) ||
      req.ip;

    const feedback = new Feedback({
      email: email || null,
      message,
      ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      createdAt: new Date(),
    });

    await feedback.save();

    res.status(201).json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
