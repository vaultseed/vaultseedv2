# 🔐 VaultSeed - Secure Seed Phrase Manager

**VaultSeed** is a secure, client-side seed phrase manager with enterprise-grade encryption. Your crypto seed phrases are encrypted locally before ever leaving your device.

## 🚨 Security Notice

- **Official Domain:** VaultSeed only operates from **vaultseed.io**
- **Never Trust Imposters:** VaultSeed will NEVER contact you asking for passwords or seed phrases
- **Verify Source:** Always use our official repository: https://github.com/vaultseed-io/vaultseed.io

## 🚀 Features

- **Zero-Knowledge Architecture**: Your master password never leaves your device
- **AES-GCM Encryption**: 256-bit keys with 500,000 PBKDF2 iterations
- **Multi-Factor Authentication**: Security questions for additional protection
- **Responsive Design**: Works on all devices
- **Dark/Light Mode**: Automatic theme switching
- **Secure Clipboard**: Auto-clearing clipboard for privacy

## 🔧 Development

```bash
npm install
npm run dev
```

## 🚀 Deploy the app locally

### Frontend
1. Connect your GitHub repo to Netlify
2. Build settings: `npm run build`, publish directory: `dist`
3. Deploy!

### Backend
1. Create MongoDB Atlas database
2. Deploy server folder to Railway
3. Set environment variables in Railway dashboard (NOT in code!)
4. Update API_BASE_URL in src/config/api.ts

### Environment Variables (Railway Dashboard Only!)
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secure_jwt_secret
NODE_ENV=production
ALLOWED_ORIGINS=https://your-netlify-domain.netlify.app
```

## 🔐 Security

- All encryption happens client-side
- No data is sent to servers in plaintext
- Uses Web Crypto API for secure operations
- Implements secure random generation

## 📄 License

MIT License - see LICENSE file for details.
