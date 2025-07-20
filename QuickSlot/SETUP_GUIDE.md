# QuickSlot Chrome Extension Setup Guide

## Prerequisites
- Google Cloud Console account
- Chrome browser with Developer Mode enabled
- Gmail account with Google Calendar access

## Step 1: Google Cloud Console Setup

### 1.1 Create a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 1.2 Enable Calendar API
1. In the Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on "Google Calendar API" and click **Enable**

### 1.3 Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (unless you have a Google Workspace account)
3. Fill in the required fields:
   - **App name**: QuickSlot
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes**
6. Find and select: `https://www.googleapis.com/auth/calendar.readonly`
7. Click **Save and Continue**
8. On **Test users**, add your Gmail address as a test user
9. Click **Save and Continue**

### 1.4 Create OAuth2 Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Chrome extension** as the application type
4. **Name**: QuickSlot Extension
5. **Application ID**: Leave empty for now (we'll fill this after loading the extension)
6. Click **Create**
7. **Important**: Copy the Client ID - you'll need to update the manifest.json

## Step 2: Chrome Extension Setup

### 2.1 Setup Environment Variables (IMPORTANT)
For security reasons, the OAuth client ID is not hardcoded in the extension files.

1. **Copy the environment file**:
   ```bash
   # In the QuickSlot folder
   copy .env.example .env
   ```

2. **Edit the .env file**:
   - Open `.env` in a text editor
   - Replace `your-client-id-here.apps.googleusercontent.com` with your actual OAuth2 Client ID from Step 1.4
   - Example:
   ```
   CLIENT_ID=801787498788-abc123def456.apps.googleusercontent.com
   ```

3. **Build the extension**:
   ```bash
   # Run the build script to generate manifest.json
   node build.js
   ```
   
   You should see: ✅ Build completed successfully!

### 2.2 Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select your QuickSlot folder
5. Note the **Extension ID** (e.g., `abcdefghijklmnopqrstuvwxyz`)

### 2.3 Update Google Cloud Console with Extension ID
1. Go back to Google Cloud Console > **APIs & Services** > **Credentials**
2. Click on your OAuth2 Client ID
3. In **Application ID**, enter your extension ID from Step 2.2
4. Click **Save**

## Step 3: Testing

### 3.1 Test Authentication
1. Click the QuickSlot extension icon in Chrome
2. Click **Sign in with Google**
3. You should see a Google OAuth consent screen
4. Grant permission to access your calendar
5. Your email should appear in the extension

### 3.2 Debug Authentication Issues
If you get a 401 error:

1. **Check Chrome Developer Console**:
   - Right-click on the extension popup
   - Select "Inspect"
   - Look for error messages in the Console tab

2. **Common Issues**:
   - **Wrong Client ID**: Ensure the client_id in manifest.json matches Google Cloud Console
   - **Extension ID mismatch**: Make sure the Application ID in Google Cloud Console matches your extension ID
   - **API not enabled**: Ensure Google Calendar API is enabled in Cloud Console
   - **Scopes issue**: Verify the OAuth consent screen has the correct scope

3. **Reset Authentication**:
   - Click "Sign Out" in the extension
   - Go to Chrome Settings > Privacy > Clear browsing data > Advanced > Cookies
   - Or use an incognito window for testing

### 3.3 Test Calendar Access
1. After successful authentication, your email should be pre-filled
2. Add additional attendee emails in the textarea
3. Click "Find Available Times"
4. You should see available time slots

## Step 4: Publishing (Optional)

### 4.1 Chrome Web Store
If you plan to publish to the Chrome Web Store:

1. **Update OAuth consent screen** to "In production"
2. **Add privacy policy** and terms of service
3. **Complete store listing** with screenshots and descriptions
4. **Submit for review**

### 4.2 Internal Distribution
For internal company use:
1. Keep the extension in "Developer mode"
2. Share the extension folder with team members
3. Each user needs to load it as an unpacked extension

## Troubleshooting

### Error: "This app is blocked"
- Your OAuth consent screen is not properly configured
- Make sure you've added yourself as a test user
- Ensure the app is configured for "External" users

### Error: "redirect_uri_mismatch"
- The extension ID doesn't match the Application ID in Google Cloud Console
- Reload the extension to get a new ID, then update Google Cloud Console

### Error: "invalid_client"
- The client_id in manifest.json doesn't match Google Cloud Console
- Double-check the client ID and ensure it's correctly copied

### Error: "insufficient_scope"
- The Calendar API scope is not properly configured
- Check the OAuth consent screen scopes

## Security Notes

- Never commit your client_id to public repositories
- Use environment variables or build scripts for client_id in production
- Regularly rotate OAuth2 client secrets if using client secrets
- Monitor API usage in Google Cloud Console

## Support

If you continue to experience issues:
1. Check the Chrome extension console for detailed error messages
2. Verify all steps in Google Cloud Console are completed
3. Test with a fresh incognito window
4. Ensure your Google account has Calendar access
