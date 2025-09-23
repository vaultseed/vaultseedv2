const express = require('express');
const { body, validationResult } = require('express-validator');
const Vault = require('../models/Vault');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Import models with error handling
let Vault;
try {
  Vault = require('../models/Vault');
} catch (error) {
  console.error('Error loading Vault model:', error.message);
}

let serverEncryption;
try {
  serverEncryption = require('../utils/encryption');
} catch (error) {
  console.error('Error loading server encryption:', error.message);
}

// Validation rules
const vaultValidation = [
  body('encryptedData').notEmpty().withMessage('Encrypted data required'),
  body('clientSalt').notEmpty().withMessage('Client salt required')
];

// Get user's vault
router.get('/', authenticateToken, logActivity('VAULT_ACCESSED'), async (req, res) => {
  try {
    if (!Vault) {
      return res.status(500).json({ error: 'Vault model not available' });
    }
    
    const vault = await Vault.findOne({ userId: req.user._id });
    
    if (!vault) {
      return res.json({ message: 'No vault found', encryptedData: null });
    }

    // Update last accessed time
    await vault.updateLastAccessed();

    res.json({
      encryptedData: vault.encryptedData,
      serverSalt: vault.serverSalt,
      clientSalt: vault.clientSalt,
      version: vault.version,
      lastAccessed: vault.lastAccessed,
      updatedAt: vault.updatedAt
    });

  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ error: 'Failed to retrieve vault' });
  }
});

// Create or update vault
router.post('/', authenticateToken, vaultValidation, logActivity('VAULT_UPDATED'), async (req, res) => {
  try {
    if (!Vault || !serverEncryption) {
      return res.status(500).json({ error: 'Required modules not available' });
    }
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { encryptedData, clientSalt } = req.body;

    // Generate server-side salt for additional encryption layer
    const serverSalt = serverEncryption.generateSalt().toString('hex');

    // Add server-side encryption layer (optional but recommended)
    const serverPassword = req.user._id.toString() + process.env.SERVER_ENCRYPTION_KEY;
    const serverEncrypted = serverEncryption.encrypt(encryptedData, serverPassword);

    // Find existing vault or create new one
    let vault = await Vault.findOne({ userId: req.user._id });
    
    if (vault) {
      // Update existing vault
      vault.encryptedData = serverEncrypted;
      vault.serverSalt = serverSalt;
      vault.clientSalt = clientSalt;
      vault.lastAccessed = new Date();
    } else {
      // Create new vault
      vault = new Vault({
        userId: req.user._id,
        encryptedData: serverEncrypted,
        serverSalt,
        clientSalt
      });
      
      await logActivity('VAULT_CREATED')(req, res, () => {});
    }

    await vault.save();

    res.json({
      message: vault.isNew ? 'Vault created successfully' : 'Vault updated successfully',
      vaultId: vault._id,
      updatedAt: vault.updatedAt
    });

  } catch (error) {
    console.error('Save vault error:', error);
    res.status(500).json({ error: 'Failed to save vault' });
  }
});

// Export vault (for backup)
router.get('/export', authenticateToken, logActivity('VAULT_EXPORTED'), async (req, res) => {
  try {
    if (!Vault || !serverEncryption) {
      return res.status(500).json({ error: 'Required modules not available' });
    }
    
    const vault = await Vault.findOne({ userId: req.user._id });
    
    if (!vault) {
      return res.json({ message: 'No vault found', encryptedData: null });
    }

    // Decrypt server-side encryption to return original client-encrypted data  
    const serverPassword = req.user._id.toString() + process.env.SERVER_ENCRYPTION_KEY;
    const decrypted = serverEncryption.decrypt(vault.encryptedData, serverPassword);

    const exportData = {
      version: vault.version,
      timestamp: new Date().toISOString(),
      clientSalt: vault.clientSalt,
      encryptedData: decrypted, // Client-encrypted data only
      exportedBy: req.user.email,
      exportedAt: new Date().toISOString()
    };

    res.json(exportData);

  } catch (error) {
    console.error('Export vault error:', error);
    res.status(500).json({ error: 'Failed to export vault' });
  }
});

// Delete vault
router.delete('/', authenticateToken, logActivity('VAULT_DELETED'), async (req, res) => {
  try {
    if (!Vault) {
      return res.status(500).json({ error: 'Vault model not available' });
    }
    
    const result = await Vault.deleteOne({ userId: req.user._id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    res.json({ message: 'Vault deleted successfully' });

  } catch (error) {
    console.error('Delete vault error:', error);
    res.status(500).json({ error: 'Failed to delete vault' });
  }
});

module.exports = router;
