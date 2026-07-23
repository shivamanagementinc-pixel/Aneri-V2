# The Funders - Blog Setup Guide

## What This Does
Converts your plain HTML site to use **Eleventy (11ty)** — a static site generator. This lets your CMS blog posts (Markdown files) automatically appear on your site.

## Step-by-Step Instructions

### Step 1: Download These Files
Download all files from this folder. You should have:
- `package.json`
- `.eleventy.js`
- `blog.njk`
- `index.njk`
- `_includes/layouts/base.njk`
- `_includes/layouts/post.njk`

### Step 2: Add Files to Your Repo

Go to your GitHub repo: https://github.com/shivamanagementinc-pixel/Aneri-V2

Add these files in the **root** of your repo (same level as your current `index.html`):

```
Aneri-V2/
├── package.json          ← NEW (add this)
├── .eleventy.js          ← NEW (add this)
├── blog.njk              ← NEW (add this)
├── index.njk             ← NEW (add this, replaces index.html)
├── _includes/            ← NEW FOLDER
│   └── layouts/          ← NEW FOLDER
│       ├── base.njk      ← NEW (add this)
│       └── post.njk      ← NEW (add this)
├── admin/                ← ALREADY EXISTS
├── assets/               ← ALREADY EXISTS
├── content/              ← ALREADY EXISTS
│   └── blog/             ← ALREADY EXISTS (your CMS posts)
├── netlify.toml          ← ALREADY EXISTS
└── _redirects            ← ALREADY EXISTS
```

### Step 3: Delete the Old index.html
After adding `index.njk`, **delete** your old `index.html` from the repo.
The new `index.njk` replaces it.

### Step 4: Update Netlify Build Settings

1. Go to your Netlify dashboard: https://app.netlify.com
2. Click your site (thefunders.ca)
3. Go to **Site Settings** → **Build & Deploy**
4. Find **Build Settings** and update:
   - **Build command:** `npm run build`
   - **Publish directory:** `_site`
5. Click **Save**

### Step 5: Deploy

1. In Netlify, go to **Deploys**
2. Click **Trigger deploy** → **Deploy site**
3. Wait for build to complete (2-3 minutes)

### Step 6: Test

- Visit `https://thefunders.ca/` — your homepage should work
- Visit `https://thefunders.ca/blog/` — your blog listing page
- Click on any blog post to see it rendered

## How It Works

| What You Do | What Happens |
|-------------|-------------|
| Write a blog post in CMS | Saves as `.md` file in `content/blog/` |
| Netlify auto-deploys | Eleventy reads `.md` files |
| Eleventy builds site | Converts Markdown → HTML, creates `/blog/` page |
| Site goes live | Blog tab shows all posts, each post has its own page |

## Troubleshooting

**Build fails?**
- Check Netlify deploy log for errors
- Make sure `package.json` is in the root

**Blog page 404?**
- Make sure `blog.njk` is in the root (not inside a folder)
- Check that `content/blog/` has `.md` files

**Styles look wrong?**
- The new `base.njk` includes all your original CSS
- Clear browser cache (Ctrl+Shift+R)

## Need Help?
If something breaks, you can always:
1. Revert to old `index.html`
2. Remove the new files
3. Your old site will work again immediately
