# AnimeX — Deployment Guide

## WHY YOU GET 404
The #1 cause: NEXT_PUBLIC_API_URL is not set in Vercel, so frontend
calls localhost:5000 which doesn't exist in production.

---

## STEP 1 — Deploy Backend on Render.com

1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo (or upload zip)
3. Set:
   - Root Directory: `animex/backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add these Environment Variables in Render dashboard:
   ```
   NODE_ENV        = production
   PORT            = 10000
   MONGO_URI       = mongodb+srv://user:pass@cluster.mongodb.net/animex
   JWT_SECRET      = any_long_random_string_here
   FRONTEND_URL    = https://your-animex.vercel.app
   SITE_URL        = https://your-animex.vercel.app
   ```
5. Deploy. Copy your Render backend URL e.g. https://animex-backend.onrender.com

---

## STEP 2 — Deploy Frontend on Vercel

1. Go to https://vercel.com → New Project
2. Connect repo or upload. Set:
   - Root Directory: `animex/frontend`
   - Framework: Next.js
3. Add these Environment Variables in Vercel dashboard:
   ```
   NEXT_PUBLIC_API_URL           = https://animex-backend.onrender.com/api
   NEXT_PUBLIC_SITE_NAME         = AnimeX
   NEXT_PUBLIC_SITE_URL          = https://your-animex.vercel.app
   NEXT_PUBLIC_DISQUS_SHORTNAME  = your_disqus_shortname  (optional)
   ```
4. Deploy.

---

## STEP 3 — Update Backend FRONTEND_URL

Once you have your Vercel URL, go back to Render → Environment and update:
  FRONTEND_URL = https://your-actual-vercel-url.vercel.app

This fixes CORS errors.

---

## CHECKLIST (all must be YES before it works)

- [ ] Backend deployed on Render and showing healthy at /health
- [ ] MONGO_URI set in Render (Atlas connection string)
- [ ] JWT_SECRET set in Render
- [ ] FRONTEND_URL set in Render = your Vercel URL
- [ ] NEXT_PUBLIC_API_URL set in Vercel = your Render URL + /api
- [ ] Frontend deployed on Vercel with no build errors
