# QuickSlot Setup Checklist

## Pre-Installation Requirements

### 1. Google Cloud Console Configuration
- [ ] Create or select a Google Cloud project
- [ ] Enable Google Calendar API
- [ ] Create OAuth 2.0 credentials (Chrome extension type)
- [ ] Note down the Client ID

### 2. Extension Files
- [ ] Verify all files are present:
  - `manifest.json`
  - `content.js` (new - for calendar detection)
  - `popup.html`
  - `popup.css` 
  - `popup.js`
  - `background.js`
  - `README.md`

### 3. Icon Files (Required)
Create these icon files in the `images/` folder:
- [ ] `icon16.png` (16x16 pixels)
- [ ] `icon48.png` (48x48 pixels)  
- [ ] `icon128.png` (128x128 pixels)

**Quick Icon Creation:**
You can use any online icon generator or:
1. Use a simple calendar icon from free icon sites (flaticon, iconify)
2. Resize to required dimensions
3. Save as PNG files

### 4. Configuration Steps

1. **Update manifest.json:**
   ```json
   "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com"
   ```

2. **Load extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the QuickSlot folder

3. **Update Google Cloud Console:**
   - Copy the Extension ID from Chrome
   - Add it to your OAuth 2.0 credentials

### 5. Testing Checklist

#### Basic Functionality
- [ ] Extension icon appears in Chrome toolbar
- [ ] Popup opens when clicking the icon
- [ ] Google sign-in works successfully

#### Context-Aware Features
- [ ] Open Google Calendar in a new tab
- [ ] Check multiple calendars (yours + AE's)
- [ ] Click QuickSlot extension icon
- [ ] Verify it detects the active calendars
- [ ] Calendar names appear in the extension popup

#### End-to-End Workflow
- [ ] Set meeting duration and search range
- [ ] Click "Find Available Times"
- [ ] Results display properly
- [ ] Copy to clipboard functions correctly
- [ ] Pasted text is properly formatted

## New Context-Aware Workflow

### For SDRs:
1. **Open Google Calendar** (`calendar.google.com`)
2. **Check calendars** - Make sure both your calendar and your AE's calendar are visible (checked)
3. **Click QuickSlot** - The extension automatically detects active calendars
4. **Verify detection** - You should see both calendars listed in the popup
5. **Set preferences** - Meeting duration, search range, business hours
6. **Get results** - Click "Find Available Times"
7. **Copy & send** - Copy the formatted list for your email

### No More Manual Input!
- ✅ No typing email addresses
- ✅ No manual calendar selection
- ✅ Automatic detection of visible calendars
- ✅ Context-aware operation

## Common Issues & Solutions

### Calendar Detection Issues

**"Please open Google Calendar in another tab":**
- Open a new tab and go to `calendar.google.com`
- Make sure you're signed in to the same Google account

**"No active calendars found":**
- Go to Google Calendar and check that calendars are visible (checked in sidebar)
- Refresh the Google Calendar page
- Try clicking the extension icon again

**"Unable to detect calendars":**
- Make sure the Google Calendar page is fully loaded
- Check that you're on the main calendar view (not settings or other pages)
- Try refreshing both Google Calendar and the extension

### Authentication Issues

**Authentication fails:**
- Check Client ID in manifest.json
- Verify Extension ID in Google Cloud Console
- Ensure Calendar API is enabled
- Try signing out and back in

### API Issues

**"Failed to find available times":**
- Check Google Cloud Console quotas
- Verify calendar API is enabled
- Check network connectivity
- Try with fewer calendars first

**No results found:**
- Expand search range (try "Next 5 business days")
- Check if calendars have many conflicts
- Adjust business hours if needed
- Try shorter meeting duration

## Advanced Testing

### Test with Different Scenarios:
- [ ] Single calendar (just yours)
- [ ] Multiple calendars (yours + AE's)
- [ ] Different time zones
- [ ] Busy vs. free periods
- [ ] Weekend vs. weekday searches
- [ ] Different meeting durations

### Browser Compatibility:
- [ ] Test in different Chrome profiles
- [ ] Verify with different Google accounts
- [ ] Check with multiple Google Calendar tabs

## Performance Optimization

### For Best Results:
- Keep Google Calendar tab active and refreshed
- Use the extension regularly to maintain authentication
- Clear browser cache if experiencing issues
- Restart Chrome if content script stops working

## Support & Debugging

### If you encounter issues:
1. **Check Chrome Developer Console** (F12 in extension popup)
2. **Review Google Cloud Console logs**
3. **Verify all setup steps were completed**
4. **Test with a simple 1-calendar search first**
5. **Check network connectivity**

### Debug Mode:
- Open Google Calendar
- Press F12 to open Developer Tools
- In Console, type: `window.quickSlotCalendarDetector.getCalendars()`
- This will show what calendars the extension can detect

## Success Indicators

✅ **Extension is working properly when:**
- Google Calendar tab shows checked calendars
- Extension popup shows "Active calendars detected"
- Calendar names appear in the extension
- Search returns relevant time slots
- Copy function works smoothly

🎉 **Ready for production use!**
