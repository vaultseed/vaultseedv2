const crypto = require('crypto');

/**
 * Advanced server-side encryption utilities
 * This adds an additional layer of encryption on top of client-side encryption
 */

// Enhanced encryption with multiple layers
class ServerEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 32; // 256 bits
  }

  /**
   * Generate a cryptographically secure random salt
   */
  generateSalt() {
    return crypto.randomBytes(this.saltLength);
  }

  /**
   * Derive encryption key using PBKDF2 with high iteration count
   */
  deriveKey(password, salt, iterations = 600000) {
    return crypto.pbkdf2Sync(password, salt, iterations, this.keyLength, 'sha512');
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  encrypt(plaintext, password) {
    try {
      const salt = this.generateSalt();
      const key = this.deriveKey(password, salt);
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(salt); // Additional authenticated data
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  decrypt(encryptedData, password) {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = combined.subarray(0, this.saltLength);
      const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
      const tag = combined.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.saltLength + this.ivLength + this.tagLength);
      
      const key = this.deriveKey(password, salt);
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(salt);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  /**
   * Hash sensitive data with Argon2id (simulated with scrypt for Node.js compatibility)
   */
  hashSensitiveData(data, salt = null) {
    const actualSalt = salt || this.generateSalt();
    const hash = crypto.scryptSync(data, actualSalt, 64, {
      cost: 32768,    // CPU/memory cost
      blockSize: 8,   // Block size
      parallelization: 1,
      maxmem: 64 * 1024 * 1024 // 64MB max memory
    });
    
    return {
      hash: hash.toString('hex'),
      salt: actualSalt.toString('hex')
    };
  }

  /**
   * Verify hashed data
   */
  verifyHash(data, hash, salt) {
    const saltBuffer = Buffer.from(salt, 'hex');
    const computed = this.hashSensitiveData(data, saltBuffer);
    return computed.hash === hash;
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Time-safe string comparison to prevent timing attacks
   */
  timeSafeEqual(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

module.exports = new ServerEncryption();