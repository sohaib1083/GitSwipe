# GitHub Issues App - Production Deployment Checklist ✅

## OAuth Configuration

### GitHub OAuth App Settings

- [ ] **Development URI**: `exp://localhost:8081/--/auth` ✅ (Already added)
- [ ] **Production URI**: `gitswipe://auth` (Add before building standalone app)

### Environment Variables

- [ ] Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in production environment
- [ ] Consider using different GitHub OAuth apps for dev/staging/prod

## App Configuration

### App.json / Expo Config

- [ ] Update `scheme` in app.json to match `APP_CONFIG.SCHEME` ("gitswipe")
- [ ] Configure proper bundle identifier for iOS
- [ ] Configure proper package name for Android
- [ ] Update `APP_CONFIG.PRODUCTION` values in constants

### Deep Linking

- [ ] Test deep linking with production URLs
- [ ] Verify Universal Links (iOS) / App Links (Android) configuration
- [ ] Add intent filters for Android

## Security

### Secrets Management

- [ ] Use Expo Secrets or secure environment variable management
- [ ] Never commit secrets to version control
- [ ] Consider rotating OAuth secrets for production

### App Store Security

- [ ] Code obfuscation for sensitive parts
- [ ] Certificate pinning for API calls (optional)
- [ ] Review Firebase security rules

## Firebase Configuration

### Production Firebase Project

- [ ] Create separate Firebase project for production
- [ ] Update firebase.config.ts with production config
- [ ] Configure Firebase App Check for API protection

### Authentication

- [ ] ✅ AsyncStorage persistence configured
- [ ] Test auth state persistence across app restarts
- [ ] Configure proper error handling

## Build & Deployment

### Expo Application Services (EAS)

- [ ] Configure eas.json for production builds
- [ ] Set up proper build profiles (development, preview, production)
- [ ] Configure code signing certificates

### App Stores

- [ ] iOS App Store Connect configuration
- [ ] Google Play Console configuration
- [ ] App store assets (icons, screenshots, descriptions)

## Testing

### Pre-Production Testing

- [ ] Test OAuth flow in production build environment
- [ ] Verify deep linking works correctly
- [ ] Test offline/online auth state handling
- [ ] Performance testing on various devices

### Monitoring

- [ ] Set up crash reporting (Sentry, Bugsnag, etc.)
- [ ] Analytics integration
- [ ] Firebase Analytics/Crashlytics

## Documentation

- [ ] Update README with production setup instructions
- [ ] Document deployment process
- [ ] API documentation for any backend services

---

## Next Steps

1. Update your app.json with proper scheme configuration
2. Create production Firebase project
3. Set up EAS build configuration
4. Test the production OAuth flow in a standalone build
