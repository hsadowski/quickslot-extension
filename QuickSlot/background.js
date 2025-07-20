// QuickSlot Extension - Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
    console.log('QuickSlot extension installed');
    
    // Set default settings
    chrome.storage.sync.set({
        defaultDuration: '30',
        defaultSearchRange: '3',
        defaultStartHour: '9',
        defaultEndHour: '17'
    });
});

// Handle extension icon click
chrome.action.onClicked.addListener(() => {
    // This will open the popup (handled by manifest.json)
    console.log('Extension icon clicked');
});

// Handle authentication token management with enhanced security
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Validate sender origin for security
    if (!sender.tab && sender.id !== chrome.runtime.id) {
        console.error('Invalid sender:', sender);
        sendResponse({ success: false, error: 'Unauthorized request' });
        return true;
    }

    // Rate limiting for security
    const now = Date.now();
    const rateLimitWindow = 60000; // 1 minute
    const maxRequests = 10;
    
    if (!chrome.runtime.rateLimitCache) {
        chrome.runtime.rateLimitCache = new Map();
    }
    
    const senderKey = sender.id || 'unknown';
    const requests = chrome.runtime.rateLimitCache.get(senderKey) || [];
    const recentRequests = requests.filter(time => now - time < rateLimitWindow);
    
    if (recentRequests.length >= maxRequests) {
        console.error('Rate limit exceeded for sender:', senderKey);
        sendResponse({ success: false, error: 'Rate limit exceeded' });
        return true;
    }
    
    recentRequests.push(now);
    chrome.runtime.rateLimitCache.set(senderKey, recentRequests);

    if (request.action === 'clearAuthToken') {
        // Enhanced token validation
        if (!request.token || typeof request.token !== 'string') {
            console.error('Valid token string required for clearAuthToken action');
            sendResponse({ success: false, error: 'Valid token required' });
            return true;
        }

        // Additional security checks on token format
        if (request.token.length < 20 || request.token.length > 2048) {
            console.error('Invalid token format - suspicious length:', request.token.length);
            sendResponse({ success: false, error: 'Invalid token format' });
            return true;
        }

        // Check for potentially malicious token content
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /data:/i,
            /vbscript:/i,
            /<iframe/i,
            /eval\(/i,
            /setTimeout\(/i,
            /setInterval\(/i
        ];

        if (suspiciousPatterns.some(pattern => pattern.test(request.token))) {
            console.error('Suspicious token content detected');
            sendResponse({ success: false, error: 'Invalid token content' });
            return true;
        }

        console.log('Clearing auth token:', request.token.substring(0, 20) + '...');

        // Use the correct API method with specific token
        chrome.identity.removeCachedAuthToken({ token: request.token }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing auth token:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log('Auth token cleared successfully');
                sendResponse({ success: true });
            }
        });
        return true; // Indicates we will send a response asynchronously
    }

    // Handle unknown actions
    console.error('Unknown action requested:', request.action);
    sendResponse({ success: false, error: 'Unknown action' });
    return true;
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('QuickSlot extension started');
});
