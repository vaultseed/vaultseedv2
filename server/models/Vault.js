const mongoose = require('mongoose');

const vaultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  encryptedData: {
    type: String,
    required: true
  },
  serverSalt: {
    type: String,
    required: true
  },
  clientSalt: {
    type: String,
    required: true
  },
  version: {
    type: String,
    default: '1.0'
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
vaultSchema.index({ userId: 1, updatedAt: -1 });

// Update last accessed time
vaultSchema.methods.updateLastAccessed = function() {
  this.lastAccessed = new Date();
  return this.save();
};

module.exports = mongoose.model('Vault', vaultSchema);