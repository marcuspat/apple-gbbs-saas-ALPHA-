# RetroBBS SaaS - Vercel Deployment Guide

## 🚀 Quick Deploy to Vercel

### Prerequisites
- Vercel account (free): https://vercel.com
- Git repository (GitHub, GitLab, or Bitbucket)

### Method 1: One-Click Deploy (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will auto-detect the configuration
   - Click "Deploy"

### Method 2: Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Method 3: Manual GitHub Connection

1. **Create Repository** on GitHub with these files
2. **Connect to Vercel**:
   - Go to https://vercel.com/dashboard
   - Click "Add New" → "Project"
   - Import from GitHub
   - Select your repository
   - Deploy

## 📁 Deployment Files Prepared

The following files have been configured for Vercel:

- ✅ `vercel.json` - Vercel configuration
- ✅ `api/server.js` - Serverless API functions
- ✅ `package.json` - Updated for production
- ✅ `.gitignore` - Excludes unnecessary files

## 🔧 Configuration

### Environment Variables (Optional)

For full functionality, add these in Vercel dashboard:

```bash
# AI Features (OpenRouter)
OPENROUTER_API_KEY=your-key-here

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_live_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-secret

# Security
JWT_SECRET=your-strong-secret-here
```

### Domain Setup

After deployment:
1. Get your Vercel URL (e.g., `retrobbs-saas.vercel.app`)
2. Optionally add custom domain in Vercel dashboard
3. Configure DNS if using custom domain

## 🌐 Expected URLs

After deployment, your BBS will be available at:

- **Main BBS**: `https://your-app.vercel.app`
- **API Status**: `https://your-app.vercel.app/api/status`
- **System Stats**: `https://your-app.vercel.app/api/stats`

## 🎯 Features Available on Vercel

### ✅ Working Features
- Complete retro BBS interface
- All frontend functionality
- Mock API endpoints
- User authentication (demo)
- Message boards (demo data)
- File areas (demo data)
- System statistics
- AI endpoints (fallback responses)
- Payment plans display

### ⚠️ Limitations on Free Tier
- No persistent database (use external DB for production)
- No WebSocket support (use external service)
- No file uploads (use external storage)
- Function timeout limits

## 🔄 Updates and Maintenance

### To Update Your Deployment:
```bash
git add .
git commit -m "Update RetroBBS"
git push origin main
# Vercel auto-deploys from main branch
```

### To Add Real Database:
1. Set up external database (PlanetScale, Supabase, etc.)
2. Update connection strings in environment variables
3. Redeploy

### To Add Real-time Features:
1. Set up WebSocket service (Pusher, Ably, etc.)
2. Update frontend to use external service
3. Configure API keys in Vercel

## 🎉 Success Indicators

Your deployment is successful when:
- ✅ Build completes without errors
- ✅ Main URL shows retro BBS interface
- ✅ API endpoints return JSON responses
- ✅ Terminal interface is interactive
- ✅ Green phosphor styling displays correctly

## 🆘 Troubleshooting

### Common Issues:

1. **Build Fails**:
   - Check `package.json` syntax
   - Ensure all dependencies are listed
   - Check `vercel.json` configuration

2. **API Not Working**:
   - Verify `api/server.js` exports correctly
   - Check function routes in `vercel.json`

3. **Frontend Issues**:
   - Ensure `frontend/` directory structure is correct
   - Check file paths in HTML/CSS

4. **Environment Variables**:
   - Add in Vercel dashboard under Settings → Environment Variables
   - Redeploy after adding variables

## 📞 Support

- **Vercel Docs**: https://vercel.com/docs
- **RetroBBS Issues**: See project README
- **Community**: Message boards in the deployed BBS!

---

Ready to deploy your retro BBS to the cloud! 🚀✨