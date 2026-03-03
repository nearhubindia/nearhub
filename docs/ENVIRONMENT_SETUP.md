# Environment Configuration Guide

This project uses separate environment files for each package: **app** (mobile), **web** (admin portal), and **server** (backend).

## Directory Structure

```
nearhub/
├── app/                      # React Native/Expo mobile app
│   ├── .env.example         # Template for app environment variables
│   └── .env.local           # Local config (NOT committed to git)
├── web/                      # React + Vite admin portal
│   ├── .env.example         # Template for web environment variables
│   └── .env.local           # Local config (NOT committed to git)
├── server/                   # Express backend
│   ├── .env.example         # Template for server environment variables
│   └── .env.local           # Local config (NOT committed to git)
└── .env.example             # Root level template (for reference only)
```

## Quick Start

### 1. Set up Environment Variables

For each package (app, web, server):

```bash
# Copy the example file
cp .env.example .env.local

# Edit the .env.local file with your actual values
nano .env.local
```

### 2. Mobile App (app/)

**Key Variables:**
- `EXPO_PUBLIC_API_URL` - Backend API URL (e.g., `http://localhost:5000`)
- `EXPO_PUBLIC_DOMAIN` - Alternative domain format (e.g., `192.168.x.x:5000`)
- `EXPO_PUBLIC_DEBUG` - Enable debug logging (true/false)

**Development:**
```bash
cd app
npm install
EXPO_PUBLIC_DOMAIN=localhost:5000 npm run dev
```

**Build APK locally:**
```bash
cd app
eas build --platform android --local --profile local-apk
```

### 3. Web Admin Portal (web/)

**Key Variables:**
- `VITE_API_URL` - Backend API URL
- `VITE_DEBUG` - Enable debug mode
- `VITE_MIN_PRICE_FOR_PAID_LISTING` - Pricing threshold (e.g., 3000)

**Development:**
```bash
cd web
npm install
npm run dev
```

The web portal will be available at `http://localhost:5173`

### 4. Backend Server (server/)

**Key Variables:**
- `NODE_ENV` - Environment (development, production, test)
- `SERVER_PORT` - Server port (default: 5000)
- `DATABASE_URL` - PostgreSQL connection string
- `BSNL_DLT_ENABLED` / `MSG91_ENABLED` - SMS gateway configuration
- `ADMIN_JWT_SECRET` - JWT secret for admin authentication

**Development:**
```bash
cd server
npm install
npm run dev
```

## Environment Variable Reference

### Mobile App (.env.local in app/)

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_DOMAIN=localhost:5000
EXPO_PUBLIC_DEBUG=true
EXPO_PUBLIC_OFFLINE_MODE=false
EXPO_PUBLIC_CACHE_STALE_TIME=300000
EXPO_PUBLIC_DEFAULT_GEO_RADIUS_KM=10
EXPO_PUBLIC_MAX_IMAGE_SIZE_MB=10
EXPO_PUBLIC_MAX_VIDEO_SIZE_MB=500
EXPO_PUBLIC_IMAGE_COMPRESSION_QUALITY=0.8
EXPO_PUBLIC_VIDEO_COMPRESSION_TARGET_MB=100
EXPO_PUBLIC_LISTINGS_PAGE_SIZE=20
EXPO_PUBLIC_SEARCH_PAGE_SIZE=20
EXPO_PUBLIC_INFINITE_SCROLL_THRESHOLD=500
```

### Web Admin Portal (.env.local in web/)

```dotenv
VITE_API_URL=http://localhost:5000
VITE_DEBUG=true
VITE_API_TIMEOUT=30000
VITE_ADMIN_LISTINGS_PAGE_SIZE=20
VITE_ADMIN_USERS_PAGE_SIZE=20
VITE_ADMIN_COUPONS_PAGE_SIZE=20
VITE_ADMIN_SPAM_REPORTS_PAGE_SIZE=20
VITE_MIN_PRICE_FOR_PAID_LISTING=3000
VITE_CURRENCY_SYMBOL=₹
VITE_CURRENCY_CODE=INR
```

### Backend Server (.env.local in server/)

```dotenv
NODE_ENV=development
SERVER_PORT=5000
SERVER_HOST=localhost
DATABASE_URL=postgresql://postgres:password@localhost:5432/nearhub
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
BSNL_DLT_ENABLED=false
MSG91_ENABLED=true
MSG91_API_KEY=your_api_key
OTP_VALIDITY_MINUTES=5
DEFAULT_GEO_RADIUS_KM=10
ADMIN_JWT_SECRET=your_very_secure_admin_jwt_secret_key
LISTING_EXPIRATION_DAYS=60
```

## Important Notes

### 🔐 Security

1. **Never commit `.env.local` files** to version control
2. **Use `.env.example`** as a template with placeholder values
3. **Change default credentials** in production:
   - `ADMIN_DEFAULT_PASSWORD`
   - `ADMIN_JWT_SECRET`
   - Database passwords
4. **Use HTTPS** in production (set protocol in `EXPO_PUBLIC_DOMAIN`)
5. **Rotate API keys** regularly

### 🚀 Production Deployment

When deploying to production:

1. **Set appropriate environment variables** on your hosting platform:
   - Heroku: Use Config Vars
   - Docker/K8s: Use environment secrets
   - Cloud Run/Functions: Use environment variables UI

2. **Use production values**:
   ```bash
   # Example for server
   NODE_ENV=production
   SERVER_PORT=8080
   ADMIN_JWT_SECRET=<generate-secure-random-string>
   DATABASE_URL=<production-database-url>
   ```

3. **Enable HTTPS**:
   - Set `VITE_API_URL=https://api.example.com` in web
   - Use HTTPS domain in `EXPO_PUBLIC_DOMAIN` for mobile

### 💻 Local Development Tips

**Different network IP?**
```bash
# Instead of localhost, use your machine's IP
EXPO_PUBLIC_DOMAIN=192.168.1.100:5000
```

**Testing with Expo Go?**
```bash
# Run the app server with your local IP
cd app
EXPO_PUBLIC_DOMAIN=192.168.1.100:5000 npm run dev
```

**Quick reset to defaults?**
```bash
# Just delete and recreate from template
rm .env.local
cp .env.example .env.local
# Edit with your values
```

## Configuration Files

All configuration is driven exclusively from environment variables. There are NO hardcoded API URLs, credentials, or other configuration values in the source code.

### Config Utilities

- **Mobile App**: `app/lib/config.ts`
  - Functions: `getBackendURL()`, `getDebug()`, `getCacheStaleTime()`, etc.
  
- **Web Portal**: `web/src/lib/config.ts`
  - Functions: `getApiUrl()`, `getDebug()`, `getAdminPageSize()`, etc.
  
- **Server**: `server/lib/config.ts`
  - Exported: `SERVER_CONFIG` object with all configuration
  - Functions: `isDevelopment()`, `isProduction()`, `validateConfig()`

Use these utilities instead of accessing `process.env` or `import.meta.env` directly across your codebase for consistency.

## Troubleshooting

### Mobile App can't connect to backend

Check:
1. Backend is running on the correct port
2. `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_DOMAIN` is correctly set
3. For Android Emulator: Use `10.0.2.2` instead of `localhost`
4. For physical device on local network: Use your machine's IP (e.g., `192.168.x.x`)

### Web portal shows 404 for API calls

Check:
1. `VITE_API_URL` matches backend URL
2. Backend CORS is configured to allow web portal origin
3. Backend is running and responding to requests

### Database connection fails

Check:
1. PostgreSQL is running
2. `DATABASE_URL` is correctly formatted
3. Database user has required permissions
4. Database name exists (`nearhub` by default)

## See Also

- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) - System architecture overview
- [docs/DEPENDENCIES.md](../docs/DEPENDENCIES.md) - Project dependencies
- [docs/DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md) - Deployment instructions
