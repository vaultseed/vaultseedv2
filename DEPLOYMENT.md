# 🚀 VaultSeed Full-Stack Deployment Guide

## 📋 Prerequisites

1. **MongoDB Atlas Account** (free tier available)
2. **Railway Account** (for backend deployment)
3. **Netlify Account** (for frontend deployment)
4. **GitHub Repository**

## 🗄️ Step 1: Set Up MongoDB Atlas

1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free account and cluster
3. Create database user
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/vaultseed`

## 🚂 Step 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repo
3. Deploy the `server` folder
4. Add environment variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters
   JWT_EXPIRES_IN=7d
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-frontend-domain.netlify.app
   BCRYPT_ROUNDS=12
   MAX_LOGIN_ATTEMPTS=5
   LOCKOUT_TIME_MINUTES=15
   SERVER_ENCRYPTION_KEY=another_super_secure_key_for_encryption
   ```
5. Get your Railway backend URL (e.g., `https://vaultseed-api.railway.app`)

## 🌐 Step 3: Update Frontend API Configuration

Update `src/config/api.ts` with your Railway backend URL:

```typescript
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-app-name.railway.app/api'  // Your actual Railway URL
  : 'http://localhost:3001/api';
```

## 🚀 Step 4: Deploy Frontend to Netlify

1. Push updated code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Connect your GitHub repo
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `18`
5. Deploy!

## 🔧 Step 5: Update CORS Settings

Update your Railway environment variables:
```
ALLOWED_ORIGINS=https://your-netlify-domain.netlify.app,https://your-custom-domain.com
```

## ✅ Verification

1. **Backend Health Check**: Visit `https://your-railway-url.railway.app/health`
2. **Frontend**: Visit your Netlify URL
3. **Test Registration**: Create a new account
4. **Test Login**: Login with your account
5. **Test Vault**: Add and retrieve seed phrases

## 🔐 Security Notes

- All seed phrases are encrypted client-side before being sent to the server
- Server adds an additional encryption layer
- JWT tokens expire after 7 days
- Rate limiting prevents brute force attacks
- Account lockout after failed attempts

## 🆘 Troubleshooting

### Backend Issues:
- Check Railway logs for errors
- Verify MongoDB connection string
- Ensure all environment variables are set

### Frontend Issues:
- Check browser console for API errors
- Verify API_BASE_URL points to your Railway backend
- Check CORS settings

### Database Issues:
- Verify MongoDB Atlas IP whitelist (allow all: 0.0.0.0/0)
- Check database user permissions
- Test connection string manually

## 📞 Support

If you encounter issues:
1. Check the logs in Railway dashboard
2. Verify all environment variables
3. Test API endpoints manually
4. Check MongoDB Atlas connection

Your VaultSeed app will now work universally with secure server-side storage!