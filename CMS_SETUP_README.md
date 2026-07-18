# The Funders - CMS Setup Guide

## What You Just Got

A complete Decap CMS (formerly Netlify CMS) setup that lets you edit:
- Every word on your homepage
- All button text and links
- Testimonials, FAQs, process steps
- Blog posts with images, tags, SEO fields
- Footer links and descriptions

## File Structure

```
thefounders.ca/
├── index.html              ← Your homepage (the file you have)
├── admin/
│   ├── index.html          ← CMS login page
│   └── config.yml          ← CMS configuration
├── content/                ← Created automatically by CMS
│   ├── homepage/
│   │   ├── hero.md
│   │   ├── marquee.md
│   │   ├── all-clients.md
│   │   ├── who-we-help.md
│   │   ├── calculator.md
│   │   ├── process.md
│   │   ├── testimonials.md
│   │   ├── faq.md
│   │   ├── cta.md
│   │   └── footer.md
│   └── blog/
│       └── [your-posts].md
├── assets/
│   └── uploads/            ← Images uploaded through CMS
└── blog/
    └── index.html          ← Blog listing page (to be created)
```

## Setup Steps (10 minutes)

### Step 1: Create a GitHub Repository
1. Go to github.com and create a new repository (e.g., `the-funders-website`)
2. Make it public or private (your choice)
3. Upload your `index.html`, `admin/` folder, and create empty `content/` and `assets/uploads/` folders

### Step 2: Connect Netlify to GitHub
1. Go to app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose GitHub and select your repo
4. Build settings: leave empty (static site)
5. Deploy!

### Step 3: Enable Netlify Identity
1. In your Netlify site dashboard, go to **Identity**
2. Click **Enable Identity**
3. Go to **Settings** → **Registration** → Set to **Invite only** (recommended for security)
4. Go to **Services** → **Git Gateway** → Click **Enable Git Gateway**
5. This creates a secure API between the CMS and your repo

### Step 4: Add Yourself as a User
1. In Identity tab, click **Invite users**
2. Enter your email
3. You'll get an invite email — accept it and set a password

### Step 5: Add the Identity Widget to Your Site
Add this snippet just before the closing `</body>` tag in your `index.html`:

```html
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
<script>
  if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => {
      if (!user) {
        window.netlifyIdentity.on("login", () => {
          document.location.href = "/admin/";
        });
      }
    });
  }
</script>
```

### Step 6: Access the CMS
1. Go to `https://thefounders.ca/admin/`
2. Log in with your Netlify Identity credentials
3. Start editing!

## How the CMS Works

### Editing Homepage Content
1. Log into `/admin/`
2. Click "Homepage" in the left sidebar
3. You'll see sections: Hero, Marquee, Who We Help, Calculator, Process, Testimonials, FAQ, CTA, Footer
4. Click any section, edit the text, hit **Publish**
5. Netlify automatically rebuilds your site in ~30 seconds

### Adding a Blog Post
1. Click "Blog Posts" in the left sidebar
2. Click **New Blog Post**
3. Fill in: Title, Date, Featured Image, Excerpt, Tags, Author, Body
4. SEO fields are optional but recommended
5. Hit **Publish** — your post goes live instantly

### Changing Button Links
Every CTA button has two fields:
- **Button Text**: What users see
- **Button URL**: Where it goes (e.g., `https://calendly.com/thefunders`, `#contact`, `/blog`)

Just change the URL field and publish.

## Important Notes

### What You CAN Edit in CMS:
- All text content
- All links and URLs
- Testimonials (add/remove/reorder)
- FAQ questions and answers
- Blog posts (full CRUD)
- Images (upload through CMS)

### What You CANNOT Edit in CMS (requires code):
- Colors and fonts
- Layout and spacing
- Animations and effects
- Adding new section types
- The mortgage calculator logic

### Images:
- Upload images through the CMS editor
- They get saved to `assets/uploads/`
- Use the same image URL in your content

### SEO for Blog Posts:
Each blog post has optional SEO fields:
- **SEO Title**: Custom `<title>` tag (defaults to post title)
- **SEO Description**: Custom meta description
- **Canonical URL**: For republished content

## Troubleshooting

**CMS shows "Login" button but doesn't work:**
→ Make sure Git Gateway is enabled in Netlify Identity settings

**Changes don't appear on site:**
→ Check Netlify deploy logs. The CMS commits to your repo, Netlify builds from there.

**Want to edit locally before going live:**
→ Uncomment the `backend: name: test-repo` line in `admin/config.yml` for local development

## Next Steps

1. Set up the repo and Netlify connection
2. Add the Identity widget to your `index.html`
3. Invite yourself as a user
4. Start editing content!

When you're ready, I can also build:
- A blog listing page (`/blog/index.html`)
- Individual blog post template
- RSS feed
- Sitemap.xml

Just ask!
