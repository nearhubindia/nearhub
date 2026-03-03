# Mobile App Development Guide

## Running the App on Your Physical Device

### First Time Setup (Already Done)
```bash
cd /home/pavanprasad/Downloads/nearhub/app
npm run android:dev  # Builds and installs the app on your device
```

### Daily Development Workflow

#### Step 1: Start Metro Bundler (Keep this running)
```bash
cd /home/pavanprasad/Downloads/nearhub/app
npm run dev
```

This will:
- Start Metro bundler on your local network
- Display a QR code and connection URL
- Show: `Metro waiting on http://192.168.29.58:8081`

**Keep this terminal open and running!**

#### Step 2: Open the App
- The NearHub app is already installed on your device
- Just tap the app icon to open it
- The app will automatically connect to Metro bundler at `192.168.29.58:8081`

#### Step 3: Reload When Making Changes
When you edit code:
- Press **`r`** in the Metro terminal to reload
- OR shake your device and select "Reload"

---

## Troubleshooting

### App shows white screen or "Unable to connect"
1. **Check Metro is running**: Look for `Metro waiting on http://192.168.29.58:8081` in terminal
2. **Check same WiFi**: Ensure your phone and computer are on the same WiFi network
3. **Check IP address**: Your current IP is `192.168.29.58` - if it changes, update `.env.local`
4. **Reload the app**: Press `r` in Metro terminal or shake device → Reload

### Metro bundler won't start
```bash
# Kill any stuck processes
pkill -f "expo start"
pkill -f metro

# Clear cache and restart
npm run dev
```

### Need to rebuild the app
```bash
# Only needed if you change native code or dependencies
npm run android:dev
```

---

## Quick Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Metro bundler (run daily) |
| `npm run android:dev` | Build and install app (first time or after native changes) |
| `npm run type-check` | Check TypeScript errors |
| `npm run lint` | Check code quality |

---

## Environment Variables

Your app is configured to connect to:
- **Backend API**: `http://192.168.29.58:5000`
- **Metro Bundler**: `http://192.168.29.58:8081`

These are set in `/home/pavanprasad/Downloads/nearhub/app/.env.local`

If your IP address changes:
1. Find new IP: `hostname -I | awk '{print $1}'`
2. Update `.env.local` with new IP
3. Restart Metro bundler

---

## Current Setup

✅ Server running on: `http://192.168.29.58:5000`  
✅ Cleartext HTTP enabled in Android manifest  
✅ CORS configured for local network  
✅ Development build installed on device  

**You're all set! Just run `npm run dev` and open the app.**
