const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user's vault
router.get('/', authenticateToken, async (req, res) => {
  try {
    // For now, return empty vault - you can add database logic later
    res.json({
      message: 'No vault found',
      encryptedData: null,
      clientSalt: null
    });
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ error: 'Failed to retrieve vault' });
  }
});

// Save vault
router.post('/', authenticateToken, [
  body('encryptedData').notEmpty().withMessage('Encrypted data required'),
  body('clientSalt').notEmpty().withMessage('Client salt required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // For now, just return success - you can add database logic later
    res.json({
      message: 'Vault saved successfully',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Save vault error:', error);
    res.status(500).json({ error: 'Failed to save vault' });
  }
});

module.exports = router;
