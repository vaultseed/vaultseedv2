#!/bin/bash

# VaultSeed Automated Deployment Script
echo "🚀 Starting VaultSeed deployment..."

# Build the application
echo "📦 Building application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Deploy to Netlify (if netlify-cli is installed)
    if command -v netlify &> /dev/null; then
        echo "🌐 Deploying to Netlify..."
        netlify deploy --prod --dir=dist
    else
        echo "⚠️  Netlify CLI not found. Install with: npm install -g netlify-cli"
    fi
    
    # Deploy to Vercel (if vercel-cli is installed)
    if command -v vercel &> /dev/null; then
        echo "🌐 Deploying to Vercel..."
        vercel --prod
    fi
    
else
    echo "❌ Build failed!"
    exit 1
fi

echo "🎉 Deployment complete!"