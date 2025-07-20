# QuickSlot Extension - Build System

## Overview
QuickSlot uses a secure environment-based build system to manage sensitive OAuth2 client IDs.

## Quick Start

### First Time Setup
```bash
# 1. Copy environment template
copy .env.example .env

# 2. Edit .env with your Google OAuth2 Client ID
# CLIENT_ID=your-client-id-here.apps.googleusercontent.com

# 3. Build the extension
node build.js
# or
npm run build
```

### Daily Development
```bash
# Build the extension
npm run build

# Clean generated files
npm run clean
```

## File Structure

### Source Files (Safe to commit)
- `manifest.template.json` - Template with placeholders
- `.env.example` - Example environment file
- `build.js` - Build script
- `package.json` - Node.js project configuration
- `.gitignore` - Git ignore rules

### Generated Files (DO NOT commit)
- `manifest.json` - Generated from template
- `.env` - Contains sensitive client ID

## Security Features

### ✅ What's Protected
- OAuth2 client IDs are never hardcoded
- Sensitive files are excluded from version control
- Environment variables are validated before build
- Build script includes security checks

### ⚠️ Important Rules
1. **Never commit `.env`** - Contains sensitive client ID
2. **Never commit `manifest.json`** - Generated file with embedded secrets
3. **Always use the template** - Edit `manifest.template.json`, not `manifest.json`
4. **Run build before testing** - Extension won't work without built manifest

## Build Script Features

The `build.js` script:
- ✅ Loads environment variables from `.env`
- ✅ Validates client ID format
- ✅ Replaces placeholders in template
- ✅ Validates generated JSON
- ✅ Provides clear success/error messages
- ✅ Supports both `.env` files and system environment variables

## NPM Scripts

```bash
npm run build    # Build the extension
npm run dev      # Same as build (for development)
npm run setup    # Create .env from template
npm run clean    # Remove generated manifest.json
```

## Troubleshooting

### "CLIENT_ID is required but not set"
- Check that `.env` file exists
- Ensure CLIENT_ID is set in `.env`
- Make sure there are no spaces around the `=`

### "Generated manifest.json is not valid JSON"
- Check template syntax in `manifest.template.json`
- Ensure client ID doesn't contain special characters

### Extension not loading in Chrome
- Run `npm run build` to regenerate manifest
- Check Chrome Developer Console for errors
- Verify client ID matches Google Cloud Console

## Version Control

### Safe to commit:
- `manifest.template.json`
- `.env.example`
- `build.js`
- `package.json`
- All source code files

### Never commit:
- `.env` (contains secrets)
- `manifest.json` (generated file)
- `node_modules/` (dependencies)
