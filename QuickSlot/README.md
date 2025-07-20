# QuickSlot - Chrome Extension

A context-aware Chrome extension that helps Sales Development Representatives (SDRs) quickly find and share available meeting times by automatically detecting active calendars in Google Calendar.

## Features

- **Context-Aware Calendar Detection**: Automatically detects which calendars are active in your Google Calendar tab
- **No Manual Input Required**: No need to type email addresses - the extension reads your calendar view
- **Multi-Calendar Support**: Checks availability across all your visible calendars (yours, your AE's, team calendars)
- **Business Hours Filtering**: Respects configurable business hours (9 AM - 5 PM default)
- **Quick Copy**: One-click copy of formatted time slots for emails
- **Lightweight**: Built with vanilla JavaScript for fast performance

## How It Works

1. **Open Google Calendar** in a browser tab and make sure the calendars you want to check are visible (checked)
2. **Click the QuickSlot extension icon** - it will automatically detect your active calendars
3. **Set your preferences** (meeting duration, search range, business hours)
4. **Click "Find Available Times"** - the extension finds when everyone is free
5. **Copy the results** to paste into your email to the prospect

## Setup Instructions

### 1. Google Cloud Console Setup

Before you can use this extension, you need to set up a Google Cloud project and enable the Calendar API:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Select "Chrome extension" as application type
   - Add your extension ID (you'll get this after loading the extension)

5. Update the `manifest.json` file:
   - Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID

### 2. Extension Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the QuickSlot folder
4. Note the Extension ID that appears
5. Go back to Google Cloud Console and update your OAuth credentials with this Extension ID

### 3. Required Files

Make sure you have these icon files in the `images/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create these from any calendar-related icons or use placeholder images.

## Usage Workflow

### Perfect for SDRs:
1. **In Google Calendar**: View your calendar alongside your AE's calendar (both should be checked/visible)
2. **Click QuickSlot**: The extension automatically detects both calendars
3. **Adjust settings**: Set meeting duration and search timeframe
4. **Get results**: Extension finds times when both you and your AE are free
5. **Copy & send**: Copy the formatted list and paste into your email to the prospect

### Example Output:
```
Here are a few times that work on my end:

• Monday, July 14, 2:00 PM - 2:30 PM
• Tuesday, July 15, 10:30 AM - 11:00 AM
• Wednesday, July 16, 3:00 PM - 3:30 PM
```

## Technical Details

### Security
- Uses Manifest V3 for enhanced security
- Implements strict Content Security Policy
- Uses Chrome's identity API for secure OAuth
- Only requests read-only calendar access
- No backend server or remote data storage

### Architecture
- **Content Script**: Runs on calendar.google.com to detect active calendars
- **Popup**: Clean interface for settings and results
- **Background Script**: Manages extension lifecycle
- **OAuth Integration**: Secure Google Calendar API access

## File Structure

```
QuickSlot/
├── manifest.json          # Extension configuration
├── content.js            # Calendar detection script
├── popup.html            # Main UI
├── popup.css             # Styling
├── popup.js              # Main functionality
├── background.js         # Service worker
├── images/               # Icon files
├── README.md             # This file
└── setup.md              # Setup checklist
```

## Troubleshooting

### Common Issues

**"Please open Google Calendar in another tab":**
- Open calendar.google.com in a new tab
- Make sure you're signed in to the same Google account

**"No active calendars found":**
- Check that some calendars are visible (checked) in Google Calendar
- Refresh the Google Calendar page
- Try clicking the extension icon again

**Authentication fails:**
- Check Client ID in manifest.json
- Verify Extension ID in Google Cloud Console
- Ensure Calendar API is enabled

**No results found:**
- Try expanding your search range
- Check if the calendars have conflicting events
- Adjust business hours if needed

## Development

The extension is built with vanilla JavaScript, HTML, and CSS. No build process is required.

To modify:
1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon for QuickSlot
4. Test your changes

## Privacy & Security

- Only reads calendar availability (not event details)
- Does not store or transmit calendar data
- Works entirely client-side
- No tracking or analytics

## License

This extension is for internal use. Please review Google's API Terms of Service before deployment.
