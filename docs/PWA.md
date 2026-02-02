# PWA Implementation Guide

## Overview

Tappka has been converted into a Progressive Web App (PWA) that can be installed on users' devices like a native app.

## What's Included

### Files Created

- **`public/manifest.json`** - Web app manifest with TAP branding
- **`public/icon.svg`** - Primary app icon (SVG format)
- **`public/icons/icon-192.png`** - App icon 192x192 (PNG)
- **`public/icons/icon-512.png`** - App icon 512x512 (PNG)
- **`public/icons/icon-maskable-192.png`** - Maskable icon 192x192
- **`public/icons/icon-maskable-512.png`** - Maskable icon 512x512
- **`public/apple-touch-icon.png`** - iOS home screen icon
- **`public/sw.js`** - Service worker (auto-generated on build)

### Files Modified

- **`next.config.ts`** - Added PWA plugin configuration
- **`app/layout.tsx`** - Added manifest link, PWA meta tags, and viewport configuration
- **`package.json`** - Added `@ducanh2912/next-pwa` dependency, updated build/dev scripts to use webpack
- **`lib/supabase/proxy.ts`** - Added PWA file bypass for authentication middleware
- **`proxy.ts`** - Updated middleware matcher to exclude PWA files
- **`.gitignore`** - Added service worker files to ignore list
- **`scripts/generate-pwa-icons.js`** - Icon generation helper script

## Features

### Current Implementation (No Offline Support)

✅ **Installable** - Users can install the app from their browser  
✅ **Standalone Mode** - Runs in its own window without browser UI  
✅ **Custom Icons** - TAP-branded red icon with "T" logo  
✅ **Splash Screen** - Shows on app launch (iOS/Android)  
✅ **Fast Loading** - Caches static assets (JS, CSS, fonts, images)  
✅ **Theme Color** - TAP Red (#b31b1b) for browser UI  

❌ **No Offline Functionality** - App requires internet connection  
❌ **No Background Sync** - No queuing of offline actions  
❌ **No IndexedDB Caching** - No local data storage  

## Installation Instructions

### For End Users

#### Desktop (Chrome, Edge, Brave)
1. Visit https://tiimi.cz
2. Look for the install icon (➕) in the address bar
3. Click "Install" in the prompt
4. App appears in your applications menu

#### iOS (Safari)
1. Visit https://tiimi.cz in Safari
2. Tap the Share button (box with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

#### Android (Chrome, Edge)
1. Visit https://tiimi.cz
2. Tap the menu (⋮) in the top right
3. Tap "Install app" or "Add to Home Screen"
4. Tap "Install"

## Development

### Building the App

```bash
# Build for production (generates service worker)
pnpm build

# Start production server
pnpm start
```

**Important:** The PWA build uses **webpack** instead of Turbopack because `@ducanh2912/next-pwa` doesn't support Turbopack yet. This is configured in `package.json`:

```json
"dev:next": "next dev --webpack",
"build": "next build --webpack"
```

Both development and production builds will use webpack to ensure the service worker is generated correctly.

### Testing PWA Locally

1. Build the app: `pnpm build`
2. Start production server: `pnpm start`
3. Open Chrome DevTools → Application → Service Workers
4. Verify service worker is registered
5. Check manifest in Application → Manifest

### Updating Icons

If you want to change the app icon:

1. Edit `public/icon.svg` with your new design
2. Run the icon generation script:
   ```bash
   node scripts/generate-pwa-icons.js
   ```
3. Follow the instructions to regenerate PNG icons
4. Rebuild the app

## Configuration

### Manifest Settings

Located in `public/manifest.json`:

- **App Name:** "Tappka - Tiimiakatemia"
- **Short Name:** "Tappka"
- **Theme Color:** #b31b1b (TAP Red)
- **Background Color:** #fcfff7 (TAP White)
- **Display:** standalone (no browser UI)
- **Scope:** / (entire app)

### Service Worker Caching

The service worker automatically caches:

- Static assets (JS, CSS, fonts) - Cache First
- Images - Stale While Revalidate
- Google Fonts - Cache First
- API routes - Network First
- Pages - Network First

## Future Enhancements

If offline support is needed later, consider:

1. **IndexedDB** - Store user data locally
2. **Background Sync** - Queue failed requests
3. **Periodic Sync** - Refresh data when online
4. **Conflict Resolution** - Handle offline reservations
5. **Offline Fallback Pages** - Show when offline

Estimated effort: 2-3 weeks for full offline support.

## Troubleshooting

### Service Worker Not Updating

```bash
# Clear service worker cache
# In Chrome DevTools → Application → Service Workers → Unregister
# Then hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
```

### Icons Not Showing

1. Check `public/manifest.json` icon paths
2. Verify icons exist in `public/icons/`
3. Clear browser cache and reinstall

### Build Failing

Make sure you're using webpack (not Turbopack):
```bash
pnpm build --webpack
```

## Resources

- [PWA Plugin Docs](https://ducanh-next-pwa.vercel.app/)
- [Next.js PWA Guide](https://nextjs.org/docs/app/building-your-application/configuring/progressive-web-apps)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN PWA Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
