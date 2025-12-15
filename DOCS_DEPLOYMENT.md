# ParleyJS Documentation Deployment Guide

This guide explains how to set up and deploy the ParleyJS documentation site
using VitePress and GitHub Pages.

## Overview

The documentation is built with VitePress and automatically deployed to GitHub
Pages via GitHub Actions. The site is generated from markdown files in the
`docs/` directory.

## Prerequisites

- Node.js 20 or higher
- npm (comes with Node.js)
- Git
- GitHub repository with push access

## Local Setup

### 1. Install Dependencies

First, install VitePress and related dependencies:

```bash
npm install
```

This installs VitePress (defined in package.json devDependencies).

### 2. Start Development Server

Run the local development server:

```bash
npm run docs:dev
```

The documentation site will be available at `http://localhost:5173/parley-js/`

Features in dev mode:

- Hot Module Replacement (instant updates as you edit)
- Fast navigation and page loads
- Full search functionality
- Dark mode toggle

### 3. Build Documentation Locally

Test the production build:

```bash
npm run docs:build
```

This creates optimized static files in `docs/.vitepress/dist/`.

### 4. Preview Production Build

Preview the built documentation:

```bash
npm run docs:preview
```

The production preview will be available at `http://localhost:4173/parley-js/`

## GitHub Pages Deployment

### Step 1: Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/WebDev-Guy/parley-js`
2. Click **Settings** (repository settings, not profile)
3. Scroll to **Pages** section (left sidebar under "Code and automation")
4. Under **Source**, select:
    - Source: **GitHub Actions** (not "Deploy from a branch")
5. Click **Save**

### Step 2: Verify Workflow Permissions

Ensure GitHub Actions has the correct permissions:

1. In repository **Settings**
2. Go to **Actions** → **General** (left sidebar)
3. Scroll to **Workflow permissions**
4. Select **Read and write permissions**
5. Check **Allow GitHub Actions to create and approve pull requests**
6. Click **Save**

### Step 3: Trigger First Deployment

The documentation will automatically deploy when you:

**Option A: Push to main branch**

```bash
git add .
git commit -m "docs: setup VitePress documentation site"
git push origin main
```

**Option B: Manual workflow dispatch**

1. Go to **Actions** tab in GitHub
2. Click **Deploy Documentation** workflow
3. Click **Run workflow**
4. Select branch: `main`
5. Click **Run workflow**

### Step 4: Monitor Deployment

1. Go to **Actions** tab
2. Click on the running workflow
3. Watch the build and deploy jobs
4. Deployment takes 2-3 minutes

### Step 5: Verify Deployment

Once deployed, your documentation will be live at:

```
https://webdev-guy.github.io/parley-js/
```

Check that:

- Site loads correctly
- Navigation works
- Search functionality works
- Dark mode toggle works
- All pages render properly

## Configuration

### Base URL Configuration

The site is configured for GitHub Pages in `docs/.vitepress/config.ts`:

```typescript
export default defineConfig({
    base: '/parley-js/', // Repository name
    // ...
});
```

**If using a custom domain**, change this to:

```typescript
base: '/',  // Root path for custom domain
```

### Custom Domain Setup (Optional)

To use a custom domain (e.g., `docs.parley.dev`):

1. Add CNAME file in `docs/public/CNAME`:

    ```
    docs.parley.dev
    ```

2. Update DNS records at your domain registrar:
    - Type: `CNAME`
    - Name: `docs` (or `@` for apex domain)
    - Value: `webdev-guy.github.io`

3. Update `base` in `docs/.vitepress/config.ts`:

    ```typescript
    base: '/',
    ```

4. In GitHub repository Settings → Pages:
    - Custom domain: `docs.parley.dev`
    - Check **Enforce HTTPS**

## File Structure

```
parley-js/
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts           # VitePress configuration
│   │   ├── dist/               # Build output (gitignored)
│   │   └── cache/              # Build cache (gitignored)
│   ├── index.md                # Home page
│   ├── getting-started/        # Getting started guides
│   ├── guides/                 # How-to guides
│   ├── patterns/               # Code patterns
│   ├── api-reference/          # API documentation
│   ├── security/               # Security guides
│   ├── troubleshooting/        # Troubleshooting
│   ├── examples/               # Code examples
│   └── [other markdown files]
├── .github/
│   └── workflows/
│       └── deploy-docs.yml     # GitHub Actions workflow
└── package.json                # npm scripts for docs
```

## npm Scripts

```bash
# Development
npm run docs:dev        # Start dev server (http://localhost:5173)

# Production
npm run docs:build      # Build static site
npm run docs:preview    # Preview production build
```

## Automatic Deployment

The GitHub Actions workflow (`.github/workflows/deploy-docs.yml`) automatically:

1. Triggers on:
    - Push to `main` branch (only if `docs/**` changed)
    - Manual workflow dispatch

2. Build process:
    - Checks out repository
    - Sets up Node.js 20
    - Installs dependencies (`npm ci`)
    - Builds documentation (`npm run docs:build`)
    - Uploads build artifact

3. Deployment:
    - Deploys to GitHub Pages
    - Updates live site

## Search Configuration

VitePress local search is already configured in `docs/.vitepress/config.ts`:

```typescript
search: {
    provider: 'local',
    options: {
        detailedView: true,
    },
},
```

Features:

- Indexes all markdown content automatically
- No external service required (free)
- Fast client-side search
- Works offline after first load
- Keyboard shortcut: `/` or `Ctrl+K`

### Alternative: Algolia DocSearch (Optional)

For larger documentation sites, you can request free Algolia DocSearch:

1. Apply at: https://docsearch.algolia.com/apply/
2. Once approved, update `docs/.vitepress/config.ts`:

```typescript
search: {
    provider: 'algolia',
    options: {
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_API_KEY',
        indexName: 'parley-js',
    },
},
```

## Troubleshooting

### Build Fails

**Problem**: `npm run docs:build` fails

**Solutions**:

1. Check Node.js version: `node --version` (should be 20+)
2. Clear cache and reinstall:
    ```bash
    rm -rf node_modules package-lock.json
    npm install
    ```
3. Clear VitePress cache:
    ```bash
    rm -rf docs/.vitepress/cache docs/.vitepress/dist
    ```

### Deployment Fails

**Problem**: GitHub Actions workflow fails

**Solutions**:

1. Check workflow permissions (see Step 2 above)
2. Verify GitHub Pages is enabled
3. Check build logs in Actions tab
4. Ensure `base` path in config.ts matches repository name

### 404 Errors on GitHub Pages

**Problem**: Site loads but all pages show 404

**Solutions**:

1. Verify `base: '/parley-js/'` in config.ts
2. Check that build output exists in workflow artifact
3. Ensure GitHub Pages source is "GitHub Actions"

### Search Not Working

**Problem**: Search bar appears but returns no results

**Solutions**:

1. Rebuild documentation: `npm run docs:build`
2. Clear browser cache
3. Verify search is enabled in config.ts
4. Check browser console for errors

### Styles Not Loading

**Problem**: Site loads but appears unstyled

**Solutions**:

1. Check `base` path in config.ts
2. Hard refresh browser (Ctrl+Shift+R)
3. Check browser console for 404 errors on CSS files

## Updating Documentation

### Making Changes

1. Edit markdown files in `docs/` directory
2. Test locally: `npm run docs:dev`
3. Commit and push to main:
    ```bash
    git add docs/
    git commit -m "docs: update [what you changed]"
    git push origin main
    ```
4. GitHub Actions automatically rebuilds and deploys

### Adding New Pages

1. Create markdown file in appropriate directory:

    ```bash
    touch docs/guides/new-guide.md
    ```

2. Add to sidebar in `docs/.vitepress/config.ts`:

    ```typescript
    '/guides/': [
        {
            text: 'Guides',
            items: [
                { text: 'New Guide', link: '/guides/new-guide' },
                // ...
            ],
        },
    ],
    ```

3. Test locally, then commit and push

## Maintenance

### Regular Tasks

1. **Update VitePress**:

    ```bash
    npm update vitepress
    npm run docs:build  # Test build
    ```

2. **Check for broken links** (periodically):
    - Use link checker tool or browser extension
    - Verify cross-references between pages

3. **Monitor build times**:
    - Check GitHub Actions workflow durations
    - Optimize if builds take longer than 5 minutes

### Performance Tips

1. **Optimize images**:
    - Place images in `docs/public/images/`
    - Use WebP format for smaller file sizes
    - Reference as `/parley-js/images/example.webp`

2. **Code splitting**:
    - VitePress automatically code-splits per page
    - Keep pages focused and not too large

3. **Caching**:
    - VitePress caches markdown processing
    - GitHub Pages CDN caches static assets

## Analytics (Optional)

### Google Analytics

Add to `docs/.vitepress/config.ts`:

```typescript
head: [
    // ... existing head tags
    [
        'script',
        { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX' }
    ],
    [
        'script',
        {},
        `window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-XXXXXXXXXX');`
    ],
],
```

### Plausible Analytics

Add to `docs/.vitepress/config.ts`:

```typescript
head: [
    // ... existing head tags
    [
        'script',
        {
            defer: '',
            'data-domain': 'webdev-guy.github.io',
            src: 'https://plausible.io/js/script.js'
        }
    ],
],
```

## Support

For VitePress-specific questions:

- VitePress Documentation: https://vitepress.dev/
- VitePress GitHub: https://github.com/vuejs/vitepress

For GitHub Pages questions:

- GitHub Pages Documentation: https://docs.github.com/en/pages

For ParleyJS documentation questions:

- Open an issue: https://github.com/WebDev-Guy/parley-js/issues
