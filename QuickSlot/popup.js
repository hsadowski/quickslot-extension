// QuickSlot Extension - Popup JavaScript (API-First Version)
class QuickSlotApp {
    constructor() {
        this.token = null;
        this.userInfo = null;
        this.availableSlots = [];
        this.selectedDates = [];
        this.currentMonth = new Date();
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadUserSettings();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Authentication
        document.getElementById('authBtn').addEventListener('click', () => this.authenticate());
        document.getElementById('signOutBtn').addEventListener('click', () => this.signOut());
        
        // Form submission
        document.getElementById('scheduleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.findAvailableTimes();
        });
        
        // Action buttons
        document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('newSearchBtn').addEventListener('click', () => this.resetToForm());
        document.getElementById('retryBtn').addEventListener('click', () => this.resetToForm());
        
        // Calendar events
        document.getElementById('calendarToggle').addEventListener('click', () => this.toggleCalendar());
        document.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));
        document.getElementById('clearDates').addEventListener('click', () => this.clearSelectedDates());
        document.getElementById('confirmDates').addEventListener('click', () => this.confirmDateSelection());
        
        // Close calendar when clicking outside
        document.addEventListener('click', (e) => {
            const calendarContainer = document.querySelector('.calendar-container');
            const calendarPopup = document.getElementById('calendarPopup');
            
            // Only close if clicking outside AND calendar is open AND not clicking on calendar elements
            if (calendarPopup.style.display === 'block' && 
                !calendarContainer.contains(e.target)) {
                this.hideCalendar();
            }
        });
    }

    async checkAuthStatus() {
        try {
            const token = await this.getAuthToken(true);
            if (token) {
                this.token = token;
                await this.getUserInfo();
                this.showMainInterface();
            } else {
                this.showAuthInterface();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showAuthInterface();
        }
    }

    async authenticate() {
        try {
            const token = await this.getAuthToken(false);
            if (token) {
                this.token = token;
                await this.getUserInfo();
                this.showMainInterface();
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            this.showError('Authentication failed. Please try again.');
        }
    }

    async getAuthToken(silent = false) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: !silent }, (token) => {
                if (chrome.runtime.lastError) {
                    console.error('Auth token error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else if (!token) {
                    console.error('No token received');
                    reject(new Error('No token received'));
                } else {
                    console.log('Token received:', token.substring(0, 20) + '...');
                    resolve(token);
                }
            });
        });
    }

    async validateToken(token) {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token);
            if (response.ok) {
                const tokenInfo = await response.json();
                
                // Validate token scopes - ensure we have required permissions
                const requiredScopes = [
                    'https://www.googleapis.com/auth/calendar.readonly',
                    'https://www.googleapis.com/auth/userinfo.email'
                ];
                
                const tokenScopes = tokenInfo.scope ? tokenInfo.scope.split(' ') : [];
                const missingScopes = requiredScopes.filter(scope => !tokenScopes.includes(scope));
                
                if (missingScopes.length > 0) {
                    console.error('Token missing required scopes:', missingScopes);
                    return {
                        valid: false,
                        error: 'INSUFFICIENT_SCOPE',
                        missingScopes: missingScopes
                    };
                }
                
                // Additional scope validation - ensure no unexpected scopes
                const allowedScopes = [
                    'https://www.googleapis.com/auth/calendar.readonly',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'openid',
                    'email',
                    'profile'
                ];
                
                const unauthorizedScopes = tokenScopes.filter(scope => !allowedScopes.includes(scope));
                if (unauthorizedScopes.length > 0) {
                    console.warn('Token contains unexpected scopes:', unauthorizedScopes);
                }
                
                // Mask sensitive information in logs
                console.log('Token validation successful:', {
                    issued_to: tokenInfo.issued_to?.substring(0, 20) + '...',
                    scope: tokenInfo.scope,
                    expires_in: tokenInfo.expires_in,
                    email: tokenInfo.email ? '***@' + tokenInfo.email.split('@')[1] : undefined,
                    scopeValidation: 'PASSED'
                });
                
                return {
                    valid: true,
                    expiresIn: parseInt(tokenInfo.expires_in) || 0,
                    email: tokenInfo.email,
                    scopes: tokenScopes
                };
            } else {
                console.error('Token validation failed:', response.status);
                return { valid: false, error: response.status };
            }
        } catch (error) {
            console.error('Token validation error:', error.message);
            return { valid: false, error: error.message };
        }
    }

    async validateAndRefreshToken() {
        if (!this.token) {
            console.log('No token to validate');
            return false;
        }

        console.log('Validating token before API call...');
        const validation = await this.validateToken(this.token);
        
        if (!validation.valid) {
            console.log('Token invalid, attempting refresh...');
            return await this.refreshToken();
        }
        
        // If token expires within 5 minutes, preemptively refresh
        if (validation.expiresIn && validation.expiresIn < 300) {
            console.log('Token expires soon, preemptively refreshing...');
            return await this.refreshToken();
        }
        
        console.log('Token validation passed');
        return true;
    }

    async refreshToken() {
        try {
            // Remove the cached token
            if (this.token) {
                await new Promise((resolve) => {
                    chrome.identity.removeCachedAuthToken({ token: this.token }, resolve);
                });
            }
            
            // Get a new token
            const newToken = await this.getAuthToken(false);
            if (newToken) {
                this.token = newToken;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        }
    }

    async getUserInfo() {
        try {
            console.log('Getting user info...');
            
            // Validate token and scopes before making API call
            const tokenValidation = await this.validateToken(this.token);
            if (!tokenValidation.valid) {
                console.error('Token validation failed before getUserInfo:', tokenValidation.error);
                if (tokenValidation.error === 'INSUFFICIENT_SCOPE') {
                    this.setEmailError('Insufficient permissions. Please re-authenticate.');
                    this.showAuthInterface();
                    return;
                } else {
                    // Try to refresh token
                    const refreshed = await this.refreshToken();
                    if (!refreshed) {
                        this.setEmailError('Authentication failed');
                        this.showAuthInterface();
                        return;
                    }
                }
            }
            
            let response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            // If we get a 401, try to refresh the token and retry
            if (response.status === 401) {
                console.log('Got 401 on user info, attempting token refresh...');
                const refreshed = await this.refreshToken();
                
                if (refreshed) {
                    console.log('Token refreshed, retrying user info...');
                    response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                        headers: {
                            'Authorization': `Bearer ${this.token}`
                        }
                    });
                }
            }
            
            if (response.ok) {
                this.userInfo = await response.json();
                
                // Validate user info response
                if (!this.userInfo || !this.userInfo.email) {
                    console.error('Invalid user info response:', this.userInfo);
                    this.setEmailError('Failed to retrieve user information');
                    return;
                }
                
                // Additional security check - verify email matches token validation
                if (tokenValidation.valid && tokenValidation.email && 
                    tokenValidation.email !== this.userInfo.email) {
                    console.error('Email mismatch between token and userinfo API');
                    this.setEmailError('Authentication error. Please sign out and try again.');
                    return;
                }
                
                console.log('User info received:', {
                    email: this.maskEmail(this.userInfo.email),
                    verified_email: this.userInfo.verified_email
                });
                
                // Check if email is verified
                if (this.userInfo.verified_email === false) {
                    console.warn('User email is not verified');
                    this.setEmailError('Email address is not verified');
                    return;
                }
                
                // Update user email display with sanitized content
                const userEmailDisplay = document.getElementById('userEmail');
                if (userEmailDisplay) {
                    userEmailDisplay.textContent = this.sanitizeInput(this.userInfo.email);
                }
                
                // Auto-populate the email input field with validation
                const userEmailInput = document.getElementById('userEmailInput');
                if (userEmailInput && this.userInfo.email) {
                    const sanitizedEmail = this.sanitizeInput(this.userInfo.email);
                    if (this.validateEmail(sanitizedEmail)) {
                        userEmailInput.value = sanitizedEmail;
                        userEmailInput.placeholder = '';
                        console.log('Email populated:', this.maskEmail(sanitizedEmail));
                    } else {
                        console.error('Email failed validation after sanitization:', this.maskEmail(sanitizedEmail));
                        this.setEmailError('Invalid email format');
                    }
                } else {
                    console.error('Failed to populate email:', {
                        userEmailInput: !!userEmailInput,
                        hasEmail: !!this.userInfo.email
                    });
                    this.setEmailError('Failed to load email');
                }
            } else {
                console.error('Failed to get user info:', response.status);
                this.setEmailError('Authentication failed');
                if (response.status === 401 || response.status === 403) {
                    this.showAuthInterface();
                }
            }
        } catch (error) {
            console.error('Failed to get user info:', error);
            this.setEmailError('Connection error');
        }
    }

    setEmailError(message) {
        const userEmailInput = document.getElementById('userEmailInput');
        if (userEmailInput) {
            userEmailInput.placeholder = message;
            userEmailInput.style.borderColor = '#dc3545';
        }
    }

    async signOut() {
        try {
            if (this.token) {
                await new Promise((resolve, reject) => {
                    chrome.identity.removeCachedAuthToken({ token: this.token }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Error removing cached token:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            console.log('Token removed successfully during sign out');
                            resolve();
                        }
                    });
                });
            }
            
            this.token = null;
            this.userInfo = null;
            this.showAuthInterface();
        } catch (error) {
            console.error('Sign out failed:', error);
            // Still proceed with sign out even if token removal fails
            this.token = null;
            this.userInfo = null;
            this.showAuthInterface();
        }
    }

    showAuthInterface() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('mainSection').style.display = 'none';
        document.getElementById('userInfo').style.display = 'none';
    }

    showMainInterface() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
        document.getElementById('userInfo').style.display = 'flex';
        this.hideAllSections();
        document.getElementById('scheduleForm').style.display = 'block';
        
        // Ensure email is populated after interface is shown
        if (this.userInfo && this.userInfo.email) {
            const userEmailInput = document.getElementById('userEmailInput');
            if (userEmailInput) {
                userEmailInput.value = this.userInfo.email;
            }
        }
    }

    hideAllSections() {
        document.getElementById('loadingSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
    }

    showLoading() {
        this.hideAllSections();
        document.getElementById('loadingSection').style.display = 'block';
    }

    showResults() {
        this.hideAllSections();
        document.getElementById('resultsSection').style.display = 'block';
    }

    showError(message) {
        this.hideAllSections();
        document.getElementById('errorText').textContent = message;
        document.getElementById('errorSection').style.display = 'block';
    }

    resetToForm() {
        this.hideAllSections();
        document.getElementById('scheduleForm').style.display = 'block';
    }

    getAttendeeEmails() {
        const attendees = [];
        
        // Get user's email (always included)
        const userEmail = document.getElementById('userEmailInput').value.trim();
        if (userEmail) {
            attendees.push(userEmail);
        }
        
        // Get additional attendees
        const additionalEmails = document.getElementById('attendeeEmails').value.trim();
        if (additionalEmails) {
            const emails = additionalEmails.split(/[\n,;]/).map(email => email.trim()).filter(email => email);
            attendees.push(...emails);
        }
        
        return attendees;
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }
        
        // Remove potentially dangerous characters and patterns
        return input
            .replace(/[<>'"]/g, '') // Remove HTML/script injection chars
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/data:/gi, '') // Remove data: protocol
            .replace(/vbscript:/gi, '') // Remove vbscript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
    }

    validateEmail(email) {
        // First sanitize the input
        const sanitized = this.sanitizeInput(email);
        
        // Enhanced email validation with stricter rules
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        // Additional security checks
        if (sanitized !== email) {
            console.warn('Email input was sanitized, potential injection attempt:', { original: email, sanitized });
            return false;
        }
        
        if (sanitized.length > 320) { // RFC 5321 limit
            console.warn('Email too long:', sanitized.length);
            return false;
        }
        
        if (sanitized.includes('..')) { // Consecutive dots not allowed
            return false;
        }
        
        if (sanitized.startsWith('.') || sanitized.endsWith('.')) { // Cannot start/end with dot
            return false;
        }
        
        return emailRegex.test(sanitized);
    }

    validateAttendeeEmails(emails) {
        const errors = [];
        const seenEmails = new Set();
        
        if (emails.length === 0) {
            errors.push('Please enter at least your email address.');
            return errors;
        }
        
        if (emails.length > 50) { // Prevent abuse
            errors.push('Too many attendees. Maximum 50 allowed.');
            return errors;
        }
        
        emails.forEach((email, index) => {
            const sanitized = this.sanitizeInput(email);
            
            // Check for injection attempts
            if (sanitized !== email) {
                errors.push(`Attendee ${index + 1}: Invalid characters detected in email address.`);
                return;
            }
            
            if (!this.validateEmail(sanitized)) {
                errors.push(`Attendee ${index + 1}: Invalid email format - ${this.maskEmail(sanitized)}`);
                return;
            }
            
            // Check for duplicates
            const normalized = sanitized.toLowerCase();
            if (seenEmails.has(normalized)) {
                errors.push(`Attendee ${index + 1}: Duplicate email address - ${this.maskEmail(sanitized)}`);
                return;
            }
            seenEmails.add(normalized);
            
            // Validate domain isn't suspicious
            if (this.isSuspiciousDomain(sanitized)) {
                errors.push(`Attendee ${index + 1}: Suspicious domain detected - ${this.maskEmail(sanitized)}`);
                return;
            }
        });
        
        return errors;
    }

    maskEmail(email) {
        if (!email || !email.includes('@')) return email;
        const [local, domain] = email.split('@');
        const maskedLocal = local.length > 3 ? local.substring(0, 2) + '***' : '***';
        return `${maskedLocal}@${domain}`;
    }

    isSuspiciousDomain(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) return true;
        
        // Check for suspicious patterns
        const suspiciousPatterns = [
            /^\d+\.\d+\.\d+\.\d+$/, // IP addresses
            /localhost/,
            /127\.0\.0\.1/,
            /0\.0\.0\.0/,
            /.*\.onion$/, // Tor domains
            /.*\.bit$/, // Namecoin domains
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(domain));
    }


    getDateRange(days) {
        // Start from tomorrow
        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        
        // For "next week", use calendar days
        if (days === 7) {
            const end = new Date(start);
            end.setDate(start.getDate() + days - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        
        // For business days, count only business days to find end date
        const end = new Date(start);
        let businessDaysFound = 0;
        let currentDate = new Date(start);
        
        while (businessDaysFound < days) {
            if (this.isBusinessDay(currentDate)) {
                businessDaysFound++;
                if (businessDaysFound === days) {
                    end.setTime(currentDate.getTime());
                    break;
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    async getBusyTimes(attendees, dateRange) {
        // Validate token before making API call
        const tokenValid = await this.validateAndRefreshToken();
        if (!tokenValid) {
            throw new Error('Authentication failed. Please sign in again.');
        }

        const url = 'https://www.googleapis.com/calendar/v3/freeBusy';
        const requestBody = {
            timeMin: dateRange.start.toISOString(),
            timeMax: dateRange.end.toISOString(),
            items: attendees.map(email => ({ id: email }))
        };

        console.log('Making API call to:', url);
        console.log('Request body:', requestBody);
        console.log('Using token:', this.token ? this.token.substring(0, 20) + '...' : 'No token');

        return await this.retryWithExponentialBackoff(async (attempt) => {
            console.log(`API attempt ${attempt}...`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            // Handle authentication errors
            if (response.status === 401) {
                if (attempt === 1) {
                    console.log('Got 401, attempting token refresh...');
                    const refreshed = await this.refreshToken();
                    
                    if (!refreshed) {
                        throw new Error('Authentication failed. Please sign in again.');
                    }
                    
                    // Retry with new token
                    throw new Error('TOKEN_REFRESH_RETRY');
                } else {
                    throw new Error('Authentication failed after token refresh. Please sign out and sign in again.');
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                
                if (response.status === 403) {
                    throw new Error('Access denied. Please check your Calendar permissions.');
                } else if (response.status >= 500) {
                    // Server error - retry
                    throw new Error(`Server error ${response.status}: ${errorText}`);
                } else if (response.status === 429) {
                    // Rate limit - retry with backoff
                    throw new Error(`Rate limited: ${errorText}`);
                } else {
                    // Client error - don't retry
                    const error = new Error(`Calendar API error: ${response.status} - ${errorText}`);
                    error.noRetry = true;
                    throw error;
                }
            }

            const data = await response.json();
            console.log('API response received successfully');
            return data.calendars;
        });
    }

    async retryWithExponentialBackoff(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation(attempt);
            } catch (error) {
                lastError = error;
                
                // Don't retry certain errors
                if (error.noRetry) {
                    throw error;
                }
                
                // Special case for token refresh retry
                if (error.message === 'TOKEN_REFRESH_RETRY' && attempt < maxRetries) {
                    console.log('Retrying with refreshed token...');
                    continue;
                }
                
                // Don't retry on final attempt
                if (attempt === maxRetries) {
                    break;
                }
                
                // Calculate exponential backoff delay
                const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                console.log(`Attempt ${attempt} failed, retrying in ${delay.toFixed(0)}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    findAvailableSlots(busyTimes, duration, startHour, endHour, dateRange) {
        const slots = [];
        const durationMs = duration * 60 * 1000;
        
        const allBusyTimes = [];
        Object.values(busyTimes).forEach(calendar => {
            if (calendar.busy) {
                calendar.busy.forEach(busy => {
                    allBusyTimes.push({
                        start: new Date(busy.start),
                        end: new Date(busy.end)
                    });
                });
            }
        });

        allBusyTimes.sort((a, b) => a.start - b.start);

        const current = new Date(dateRange.start);
        while (current <= dateRange.end) {
            if (this.isBusinessDay(current)) {
                const daySlots = this.findDaySlots(current, startHour, endHour, durationMs, allBusyTimes);
                slots.push(...daySlots);
            }
            current.setDate(current.getDate() + 1);
        }

        // Group and limit: Combine suggestions #1 and #3
        const slotsByDay = {};
        slots.forEach(slot => {
            const dayKey = slot.start.toDateString();
            if (!slotsByDay[dayKey]) slotsByDay[dayKey] = [];
            slotsByDay[dayKey].push(slot);
        });

        // Sort and limit each day to top 3 slots (earliest first)
        Object.keys(slotsByDay).forEach(day => {
            slotsByDay[day].sort((a, b) => a.start - b.start); // Earliest first
            slotsByDay[day] = slotsByDay[day].slice(0, 3); // Limit to top 3 per day
        });

        // Store for display and return original for other uses
        this.slotsByDay = slotsByDay;
        return slots;
    }

    isBusinessDay(date) {
        const day = date.getDay();
        
        // Check if it's weekend
        if (day === 0 || day === 6) {
            return false;
        }
        
        // Check if it's a holiday
        if (this.isHoliday(date)) {
            return false;
        }
        
        return true;
    }

    isHoliday(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // JavaScript months are 0-based
        const day = date.getDate();
        
        // Common US federal holidays (basic set)
        const holidays = [
            // New Year's Day
            { month: 1, day: 1 },
            // Independence Day
            { month: 7, day: 4 },
            // Christmas Day
            { month: 12, day: 25 },
            // Veterans Day
            { month: 11, day: 11 },
        ];
        
        // Check fixed holidays
        for (const holiday of holidays) {
            if (month === holiday.month && day === holiday.day) {
                console.log(`Skipping holiday: ${date.toDateString()}`);
                return true;
            }
        }
        
        // Check floating holidays
        // Martin Luther King Jr. Day (3rd Monday in January)
        if (month === 1 && this.isNthWeekdayOfMonth(date, 1, 3)) {
            console.log(`Skipping Martin Luther King Jr. Day: ${date.toDateString()}`);
            return true;
        }
        
        // Presidents Day (3rd Monday in February)
        if (month === 2 && this.isNthWeekdayOfMonth(date, 1, 3)) {
            console.log(`Skipping Presidents Day: ${date.toDateString()}`);
            return true;
        }
        
        // Memorial Day (Last Monday in May)
        if (month === 5 && this.isLastWeekdayOfMonth(date, 1)) {
            console.log(`Skipping Memorial Day: ${date.toDateString()}`);
            return true;
        }
        
        // Labor Day (1st Monday in September)
        if (month === 9 && this.isNthWeekdayOfMonth(date, 1, 1)) {
            console.log(`Skipping Labor Day: ${date.toDateString()}`);
            return true;
        }
        
        // Columbus Day (2nd Monday in October)
        if (month === 10 && this.isNthWeekdayOfMonth(date, 1, 2)) {
            console.log(`Skipping Columbus Day: ${date.toDateString()}`);
            return true;
        }
        
        // Thanksgiving (4th Thursday in November)
        if (month === 11 && this.isNthWeekdayOfMonth(date, 4, 4)) {
            console.log(`Skipping Thanksgiving: ${date.toDateString()}`);
            return true;
        }
        
        return false;
    }

    isNthWeekdayOfMonth(date, weekday, nth) {
        const month = date.getMonth();
        const year = date.getFullYear();
        const day = date.getDay();
        
        if (day !== weekday) return false;
        
        const firstOfMonth = new Date(year, month, 1);
        const firstWeekday = new Date(firstOfMonth);
        
        // Find the first occurrence of the weekday in the month
        while (firstWeekday.getDay() !== weekday) {
            firstWeekday.setDate(firstWeekday.getDate() + 1);
        }
        
        // Calculate the nth occurrence
        const nthWeekday = new Date(firstWeekday);
        nthWeekday.setDate(firstWeekday.getDate() + (nth - 1) * 7);
        
        return date.getTime() === nthWeekday.getTime();
    }

    isLastWeekdayOfMonth(date, weekday) {
        const month = date.getMonth();
        const year = date.getFullYear();
        const day = date.getDay();
        
        if (day !== weekday) return false;
        
        // Find the last day of the month
        const lastOfMonth = new Date(year, month + 1, 0);
        const lastWeekday = new Date(lastOfMonth);
        
        // Find the last occurrence of the weekday in the month
        while (lastWeekday.getDay() !== weekday) {
            lastWeekday.setDate(lastWeekday.getDate() - 1);
        }
        
        return date.getTime() === lastWeekday.getTime();
    }

    findDaySlots(date, startHour, endHour, durationMs, allBusyTimes) {
        const slots = [];
        let effectiveStartHour = startHour;
        let effectiveEndHour = endHour;
        
        // Check if user wants to avoid early/late times (30-minute buffer)
        const avoidEarlyLate = document.getElementById('avoidEarlyLate')?.checked;
        if (avoidEarlyLate) {
            effectiveStartHour = startHour + 0.5; // Add 30-minute buffer
            effectiveEndHour = endHour - 0.5;     // Remove 30-minute buffer from end
            
            // Ensure we still have a valid time range
            if (effectiveEndHour <= effectiveStartHour) {
                return slots; // Return empty if no valid time range
            }
        }
        
        const dayStart = new Date(date);
        dayStart.setHours(Math.floor(effectiveStartHour), (effectiveStartHour % 1) * 60, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(Math.floor(effectiveEndHour), (effectiveEndHour % 1) * 60, 0, 0);

        // Filter and sort busy times for the day
        const dayBusyTimes = allBusyTimes.filter(busy => busy.start < dayEnd && busy.end > dayStart);
        dayBusyTimes.sort((a, b) => a.start - b.start);

        // Merge busy times to find free gaps
        const freeGaps = [];
        let lastEnd = dayStart;
        dayBusyTimes.forEach(busy => {
            if (lastEnd < busy.start) {
                freeGaps.push({ start: new Date(lastEnd), end: new Date(busy.start) });
            }
            lastEnd = new Date(Math.max(lastEnd.getTime(), busy.end.getTime()));
        });
        if (lastEnd < dayEnd) {
            freeGaps.push({ start: new Date(lastEnd), end: new Date(dayEnd) });
        }

        // Define day segments for strategic spacing (morning, midday, afternoon)
        // Use effective hours that account for the buffer
        const segments = [
            { start: effectiveStartHour, end: Math.min(12, effectiveEndHour) },    // Morning
            { start: Math.max(12, effectiveStartHour), end: Math.min(15, effectiveEndHour) }, // Midday
            { start: Math.max(15, effectiveStartHour), end: effectiveEndHour }     // Afternoon
        ];

        // For each segment, find the earliest free slot that fits duration
        segments.forEach(seg => {
            if (seg.start >= seg.end) return; // Skip invalid segments
            
            const segStart = new Date(date);
            segStart.setHours(seg.start, 0, 0, 0);
            const segEnd = new Date(date);
            segEnd.setHours(seg.end, 0, 0, 0);

            // Find gaps overlapping this segment
            for (const gap of freeGaps) {
                const effectiveStart = new Date(Math.max(gap.start.getTime(), segStart.getTime()));
                const effectiveEnd = new Date(Math.min(gap.end.getTime(), segEnd.getTime()));

                if (effectiveEnd.getTime() - effectiveStart.getTime() >= durationMs) {
                    // Round to next 15-minute boundary for professional scheduling
                    const minutes = effectiveStart.getMinutes();
                    const roundedMinutes = Math.ceil(minutes / 15) * 15;
                    effectiveStart.setMinutes(roundedMinutes, 0, 0);
                    
                    // Ensure the rounded time still fits
                    if (effectiveStart.getTime() + durationMs <= effectiveEnd.getTime()) {
                        const slotStart = new Date(effectiveStart);
                        const slotEnd = new Date(slotStart.getTime() + durationMs);
                        slots.push({ start: slotStart, end: slotEnd });
                        break; // Only one slot per segment
                    }
                }
            }
        });

        return slots; // Will return up to 3 slots, strategically spaced
    }

    mergeOverlappingIntervals(intervals) {
        if (intervals.length === 0) return [];
        
        // Sort intervals by start time
        const sortedIntervals = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
        const merged = [sortedIntervals[0]];
        
        for (let i = 1; i < sortedIntervals.length; i++) {
            const current = sortedIntervals[i];
            const lastMerged = merged[merged.length - 1];
            
            // If current interval overlaps with or touches the last merged interval
            if (current.start.getTime() <= lastMerged.end.getTime()) {
                // Merge by extending the end time
                lastMerged.end = new Date(Math.max(lastMerged.end.getTime(), current.end.getTime()));
            } else {
                // No overlap, add as new interval
                merged.push(current);
            }
        }
        
        return merged;
    }

    findFreeIntervals(dayStart, dayEnd, mergedBusyTimes) {
        const freeIntervals = [];
        let currentTime = new Date(dayStart);
        
        for (const busyInterval of mergedBusyTimes) {
            // If there's a gap before this busy time
            if (currentTime.getTime() < busyInterval.start.getTime()) {
                freeIntervals.push({
                    start: new Date(currentTime),
                    end: new Date(busyInterval.start)
                });
            }
            
            // Move current time to after this busy interval
            currentTime = new Date(Math.max(currentTime.getTime(), busyInterval.end.getTime()));
        }
        
        // If there's time left after the last busy interval
        if (currentTime.getTime() < dayEnd.getTime()) {
            freeIntervals.push({
                start: new Date(currentTime),
                end: new Date(dayEnd)
            });
        }
        
        return freeIntervals;
    }

    generateSlotsFromInterval(interval, durationMs) {
        const slots = [];
        const intervalDuration = interval.end.getTime() - interval.start.getTime();
        
        // Skip intervals that are too short for the requested duration
        if (intervalDuration < durationMs) {
            return slots;
        }
        
        // Use 15-minute increments for more flexibility (instead of fixed 30-minute)
        const incrementMs = 15 * 60 * 1000; // 15 minutes
        let currentTime = new Date(interval.start);
        
        // Round up to next 15-minute boundary for cleaner scheduling
        const minutes = currentTime.getMinutes();
        const roundedMinutes = Math.ceil(minutes / 15) * 15;
        currentTime.setMinutes(roundedMinutes, 0, 0);
        
        // Generate slots within this free interval
        while (currentTime.getTime() + durationMs <= interval.end.getTime()) {
            const slotEnd = new Date(currentTime.getTime() + durationMs);
            
            slots.push({
                start: new Date(currentTime),
                end: slotEnd
            });
            
            currentTime = new Date(currentTime.getTime() + incrementMs);
        }
        
        return slots;
    }

    displayResults() {
        const timeSlotsContainer = document.getElementById('timeSlots');
        timeSlotsContainer.innerHTML = '';

        // Use the new grouped and limited slots from slotsByDay
        if (!this.slotsByDay || Object.keys(this.slotsByDay).length === 0) {
            timeSlotsContainer.innerHTML = '<div class="empty-state"><h4>No available times found</h4><p>Try selecting different dates or adjusting your search criteria.</p></div>';
            return;
        }

        // Display grouped and limited results with day headers
        Object.entries(this.slotsByDay).forEach(([day, daySlots]) => {
            if (daySlots.length > 0) {
                const dayElement = document.createElement('div');
                dayElement.className = 'day-group';

                const dayHeader = document.createElement('h4');
                dayHeader.className = 'day-header';
                // Format the day key back to readable format
                const date = new Date(day);
                dayHeader.textContent = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                });
                dayElement.appendChild(dayHeader);

                const slotsList = document.createElement('div');
                slotsList.className = 'time-slots-list';
                
                // Show the limited slots (already top 3 from findAvailableSlots)
                daySlots.forEach(slot => {
                    const slotElement = document.createElement('div');
                    slotElement.className = 'time-slot';
                    slotElement.textContent = `${slot.start.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                    })} - ${slot.end.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                    })}`;
                    
                    // Add click handler for time slot selection
                    slotElement.addEventListener('click', () => {
                        // Remove selection from other slots
                        document.querySelectorAll('.time-slot.selected').forEach(el => 
                            el.classList.remove('selected'));
                        // Select this slot
                        slotElement.classList.add('selected');
                    });
                    
                    slotsList.appendChild(slotElement);
                });

                dayElement.appendChild(slotsList);
                timeSlotsContainer.appendChild(dayElement);
            }
        });
    }

    mergeConsecutiveSlots(slots) {
        if (slots.length === 0) return [];

        // Sort slots by start time
        const sortedSlots = [...slots].sort((a, b) => a.start - b.start);
        const mergedSlots = [];
        let currentSlot = { ...sortedSlots[0] };

        for (let i = 1; i < sortedSlots.length; i++) {
            const nextSlot = sortedSlots[i];
            
            // Check if current slot ends exactly when next slot starts
            if (currentSlot.end.getTime() === nextSlot.start.getTime()) {
                // Merge slots by extending the end time
                currentSlot.end = new Date(nextSlot.end);
            } else {
                // Gap found, save current slot and start a new one
                mergedSlots.push(currentSlot);
                currentSlot = { ...nextSlot };
            }
        }

        // Add the last slot
        mergedSlots.push(currentSlot);

        return mergedSlots;
    }

    groupSlotsByDay() {
        const grouped = {};
        this.availableSlots.forEach(slot => {
            const day = slot.start.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            });
            if (!grouped[day]) {
                grouped[day] = [];
            }
            grouped[day].push(slot);
        });
        return grouped;
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    async copyToClipboard() {
        // Use the curated slotsByDay instead of all availableSlots
        let formattedString = "Here are a few times that work on my end:\n\n";

        // Use the same curated data that's displayed in the UI
        Object.entries(this.slotsByDay).forEach(([dayKey, daySlots]) => {
            if (daySlots.length > 0) {
                // Format the day header
                const date = new Date(dayKey);
                const dayHeader = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                });
                formattedString += `${dayHeader}\n`;

                // Format the strategically spaced slots (max 3 per day)
                daySlots.forEach(slot => {
                    const startStr = slot.start.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                    });
                    const endStr = slot.end.toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                    });
                    formattedString += `  • ${startStr} - ${endStr}\n`;
                });
                formattedString += '\n';
            }
        });

        const textToCopy = formattedString;

        try {
            await navigator.clipboard.writeText(textToCopy);
            
            const copyBtn = document.getElementById('copyBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.background = '#48bb78';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showError('Failed to copy to clipboard. Please try again.');
        }
    }

    loadUserSettings() {
        chrome.storage.sync.get(['defaultDuration', 'defaultStartHour', 'defaultEndHour'], (result) => {
            if (result.defaultDuration) {
                document.getElementById('duration').value = result.defaultDuration;
            }
            if (result.defaultStartHour) {
                document.getElementById('startHour').value = result.defaultStartHour;
            }
            if (result.defaultEndHour) {
                document.getElementById('endHour').value = result.defaultEndHour;
            }
        });
    }

    // Calendar Methods
    toggleCalendar() {
        const popup = document.getElementById('calendarPopup');
        if (popup.style.display === 'none' || !popup.style.display) {
            this.showCalendar();
        } else {
            this.hideCalendar();
        }
    }

    showCalendar() {
        // Initialize to current month if not set
        if (!this.currentMonth) {
            this.currentMonth = new Date();
        }
        
        document.getElementById('calendarPopup').style.display = 'block';
        this.renderCalendar();
    }

    hideCalendar() {
        document.getElementById('calendarPopup').style.display = 'none';
    }

    renderCalendar() {
        const monthYear = document.getElementById('currentMonthYear');
        const calendarDays = document.getElementById('calendarDays');
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        
        monthYear.textContent = `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
        
        // Clear previous days
        calendarDays.innerHTML = '';
        
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Get days from previous month
        const prevMonth = new Date(year, month - 1, 0);
        const daysInPrevMonth = prevMonth.getDate();
        
        // Today's date for highlighting
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        const todayDate = today.getDate();
        
        // Add days from previous month
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const dayElement = this.createDayElement(
                daysInPrevMonth - i, 
                new Date(year, month - 1, daysInPrevMonth - i),
                true // other month
            );
            calendarDays.appendChild(dayElement);
        }
        
        // Add days of current month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dayElement = this.createDayElement(
                day,
                currentDate,
                false, // not other month
                isCurrentMonth && day === todayDate // is today
            );
            calendarDays.appendChild(dayElement);
        }
        
        // Add days from next month to fill the grid
        const totalCells = Math.ceil((startingDayOfWeek + daysInMonth) / 7) * 7;
        const remainingCells = totalCells - (startingDayOfWeek + daysInMonth);
        
        for (let day = 1; day <= remainingCells; day++) {
            const dayElement = this.createDayElement(
                day,
                new Date(year, month + 1, day),
                true // other month
            );
            calendarDays.appendChild(dayElement);
        }
    }

    createDayElement(dayNumber, date, isOtherMonth = false, isToday = false) {
        const dayElement = document.createElement('button');
        dayElement.className = 'calendar-day';
        dayElement.textContent = dayNumber;
        dayElement.type = 'button';
        
        // Add classes based on state
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }
        
        if (isToday) {
            dayElement.classList.add('today');
        }
        
        // Check if date is in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) {
            dayElement.classList.add('disabled');
            dayElement.disabled = true;
        }
        
        // Check if date is selected
        const dateString = this.formatDateString(date);
        if (this.selectedDates.includes(dateString)) {
            dayElement.classList.add('selected');
        }
        
        // Add click handler for selectable dates
        if (!isOtherMonth && !dayElement.disabled) {
            dayElement.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent calendar from closing
                this.selectDate(date);
            });
        }
        
        return dayElement;
    }

    selectDate(date) {
        const dateString = this.formatDateString(date);
        const index = this.selectedDates.indexOf(dateString);
        
        if (index > -1) {
            // Date is already selected, remove it
            this.selectedDates.splice(index, 1);
        } else {
            // Date is not selected, add it
            this.selectedDates.push(dateString);
        }
        
        // Re-render calendar to update selection state
        this.renderCalendar();
        this.updateSelectedDatesDisplay();
        
        // Keep calendar open for multiple selections - don't auto-close!
    }

    formatDateString(date) {
        // Use local timezone instead of UTC to avoid off-by-one errors
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`; // YYYY-MM-DD format in local timezone
    }

    navigateMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.renderCalendar();
    }

    clearSelectedDates() {
        this.selectedDates = [];
        this.renderCalendar();
        this.updateSelectedDatesDisplay();
    }

    confirmDateSelection() {
        this.hideCalendar();
        this.updateSelectedDatesDisplay();
    }

    updateSelectedDatesDisplay() {
        const display = document.getElementById('selectedDatesDisplay');
        
        if (this.selectedDates.length === 0) {
            display.textContent = 'Click to select dates';
        } else if (this.selectedDates.length === 1) {
            const date = new Date(this.selectedDates[0]);
            display.textContent = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        } else {
            display.textContent = `${this.selectedDates.length} days selected`;
        }
    }

    // Update the findAvailableTimes method to use selected dates
    async findAvailableTimes() {
        const attendees = this.getAttendeeEmails();
        
        // Validate email addresses
        const validationErrors = this.validateAttendeeEmails(attendees);
        if (validationErrors.length > 0) {
            this.showError(validationErrors.join('\n'));
            return;
        }

        // Check if dates are selected
        if (this.selectedDates.length === 0) {
            this.showError('Please select at least one date to search.');
            return;
        }

        const duration = parseInt(document.getElementById('duration').value);
        const startHour = parseInt(document.getElementById('startHour').value);
        const endHour = parseInt(document.getElementById('endHour').value);

        this.showLoading();

        try {
            const dateRange = this.getSelectedDateRange();
            const busyTimes = await this.getBusyTimes(attendees, dateRange);
            this.availableSlots = this.findAvailableSlotsFromSelectedDates(busyTimes, duration, startHour, endHour);
            
            if (this.availableSlots.length === 0) {
                this.showError('No available time slots found. Try selecting different dates or adjusting the meeting duration.');
            } else {
                this.displayResults();
                this.showResults();
            }
        } catch (error) {
            console.error('Error finding available times:', error);
            this.showError('Failed to find available times. Please check your internet connection and try again.');
        }
    }

    getSelectedDateRange() {
        const dates = this.selectedDates.map(dateStr => {
            // Parse date string in local timezone to avoid UTC offset issues
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day); // month is 0-indexed
        });
        dates.sort((a, b) => a.getTime() - b.getTime());
        
        const start = new Date(dates[0]);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(dates[dates.length - 1]);
        end.setHours(23, 59, 59, 999);
        
        return { start, end };
    }

    findAvailableSlotsFromSelectedDates(busyTimes, duration, startHour, endHour) {
        const slots = [];
        const durationMs = duration * 60 * 1000;
        
        const allBusyTimes = [];
        Object.values(busyTimes).forEach(calendar => {
            if (calendar.busy) {
                calendar.busy.forEach(busy => {
                    allBusyTimes.push({
                        start: new Date(busy.start),
                        end: new Date(busy.end)
                    });
                });
            }
        });

        allBusyTimes.sort((a, b) => a.start - b.start);

        // Process each selected date with timezone-aware parsing
        this.selectedDates.forEach(dateStr => {
            // Parse date string in local timezone to avoid UTC offset issues
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day); // month is 0-indexed
            const daySlots = this.findDaySlots(date, startHour, endHour, durationMs, allBusyTimes);
            slots.push(...daySlots);
        });

        // Group and limit: Apply the same logic as findAvailableSlots
        const slotsByDay = {};
        slots.forEach(slot => {
            const dayKey = slot.start.toDateString();
            if (!slotsByDay[dayKey]) slotsByDay[dayKey] = [];
            slotsByDay[dayKey].push(slot);
        });

        // Sort and limit each day to top 3 slots (earliest first)
        Object.keys(slotsByDay).forEach(day => {
            slotsByDay[day].sort((a, b) => a.start - b.start); // Earliest first
            slotsByDay[day] = slotsByDay[day].slice(0, 3); // Limit to top 3 per day
        });

        // Store for display - THIS WAS MISSING!
        this.slotsByDay = slotsByDay;
        
        return slots;
    }

    saveUserSettings() {
        const settings = {
            defaultDuration: document.getElementById('duration').value,
            defaultStartHour: document.getElementById('startHour').value,
            defaultEndHour: document.getElementById('endHour').value
        };

        chrome.storage.sync.set(settings);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuickSlotApp();
});
