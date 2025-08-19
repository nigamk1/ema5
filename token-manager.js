require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Upstox Token Manager
 * Handles automatic token refresh using OAuth 2.0 flow
 * 
 * Setup Instructions:
 * 1. Get your app credentials from Upstox Developer Console
 * 2. Add UPSTOX_CLIENT_ID, UPSTOX_CLIENT_SECRET, and UPSTOX_REDIRECT_URI to .env
 * 3. Run the initial authorization flow once
 * 4. The system will automatically refresh tokens thereafter
 */

class UpstoxTokenManager {
    constructor() {
        this.clientId = process.env.UPSTOX_CLIENT_ID;
        this.clientSecret = process.env.UPSTOX_CLIENT_SECRET;
        this.redirectUri = process.env.UPSTOX_REDIRECT_URI || 'http://localhost:3000/callback';
        this.tokenFile = path.join(__dirname, 'upstox-tokens.json');
        this.envFile = path.join(__dirname, '.env');
        
        // Upstox API endpoints
        this.authUrl = 'https://api.upstox.com/v2/login/authorization/dialog';
        this.tokenUrl = 'https://api.upstox.com/v2/login/authorization/token';
    }

    /**
     * Generate authorization URL for initial setup
     */
    getAuthorizationUrl() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state: 'upstox_auth_' + Date.now()
        });

        return `${this.authUrl}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(authCode) {
        try {
            const response = await axios.post(this.tokenUrl, {
                code: authCode,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
                grant_type: 'authorization_code'
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const tokens = response.data;
            await this.saveTokens(tokens);
            await this.updateEnvFile(tokens.access_token);
            
            console.log('✅ Tokens obtained and saved successfully!');
            return tokens;
        } catch (error) {
            console.error('❌ Error exchanging code for tokens:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken() {
        try {
            const tokens = await this.loadTokens();
            if (!tokens || !tokens.refresh_token) {
                throw new Error('No refresh token available. Please re-authorize.');
            }

            const response = await axios.post(this.tokenUrl, {
                refresh_token: tokens.refresh_token,
                grant_type: 'refresh_token',
                client_id: this.clientId,
                client_secret: this.clientSecret
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const newTokens = {
                ...tokens,
                ...response.data,
                refreshed_at: new Date().toISOString()
            };

            await this.saveTokens(newTokens);
            await this.updateEnvFile(newTokens.access_token);
            
            console.log('✅ Access token refreshed successfully!');
            return newTokens;
        } catch (error) {
            console.error('❌ Error refreshing token:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Check if current token is expired or will expire soon
     */
    async checkTokenExpiry() {
        try {
            const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
            if (!accessToken) {
                return { expired: true, needsRefresh: true };
            }

            // Decode JWT token
            const parts = accessToken.split('.');
            if (parts.length !== 3) {
                return { expired: true, needsRefresh: true };
            }

            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = payload.exp;
            const timeUntilExpiry = expiresAt - now;

            // Refresh if expires within 30 minutes
            const needsRefresh = timeUntilExpiry < 1800; // 30 minutes
            const expired = timeUntilExpiry <= 0;

            return {
                expired,
                needsRefresh,
                expiresAt: new Date(expiresAt * 1000),
                timeUntilExpiry: Math.max(0, timeUntilExpiry)
            };
        } catch (error) {
            console.error('❌ Error checking token expiry:', error.message);
            return { expired: true, needsRefresh: true };
        }
    }

    /**
     * Auto-refresh token if needed
     */
    async autoRefreshIfNeeded() {
        const status = await this.checkTokenExpiry();
        
        if (status.expired) {
            console.log('🔄 Token expired, attempting refresh...');
            await this.refreshAccessToken();
            return true;
        } else if (status.needsRefresh) {
            console.log('🔄 Token expires soon, refreshing proactively...');
            await this.refreshAccessToken();
            return true;
        } else {
            const hours = Math.floor(status.timeUntilExpiry / 3600);
            const minutes = Math.floor((status.timeUntilExpiry % 3600) / 60);
            console.log(`✅ Token is valid for ${hours}h ${minutes}m`);
            return false;
        }
    }

    /**
     * Save tokens to file
     */
    async saveTokens(tokens) {
        const tokenData = {
            ...tokens,
            saved_at: new Date().toISOString()
        };
        
        fs.writeFileSync(this.tokenFile, JSON.stringify(tokenData, null, 2));
    }

    /**
     * Load tokens from file
     */
    async loadTokens() {
        try {
            if (fs.existsSync(this.tokenFile)) {
                const data = fs.readFileSync(this.tokenFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('❌ Error loading tokens:', error.message);
        }
        return null;
    }

    /**
     * Update .env file with new access token
     */
    async updateEnvFile(newAccessToken) {
        try {
            let envContent = '';
            if (fs.existsSync(this.envFile)) {
                envContent = fs.readFileSync(this.envFile, 'utf8');
            }

            // Replace or add UPSTOX_ACCESS_TOKEN
            const tokenRegex = /^UPSTOX_ACCESS_TOKEN=.*$/m;
            const newTokenLine = `UPSTOX_ACCESS_TOKEN=${newAccessToken}`;

            if (tokenRegex.test(envContent)) {
                envContent = envContent.replace(tokenRegex, newTokenLine);
            } else {
                envContent += `\n${newTokenLine}\n`;
            }

            fs.writeFileSync(this.envFile, envContent);
            
            // Update process.env as well
            process.env.UPSTOX_ACCESS_TOKEN = newAccessToken;
            
            console.log('✅ Updated .env file with new access token');
        } catch (error) {
            console.error('❌ Error updating .env file:', error.message);
        }
    }

    /**
     * Setup auto-refresh scheduler
     */
    startAutoRefreshScheduler(intervalMinutes = 30) {
        console.log(`🕐 Starting token auto-refresh scheduler (every ${intervalMinutes} minutes)`);
        
        // Check immediately
        this.autoRefreshIfNeeded().catch(console.error);
        
        // Then check periodically
        setInterval(async () => {
            try {
                await this.autoRefreshIfNeeded();
            } catch (error) {
                console.error('❌ Auto-refresh failed:', error.message);
            }
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        const required = ['UPSTOX_CLIENT_ID', 'UPSTOX_CLIENT_SECRET'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        
        return true;
    }
}

module.exports = UpstoxTokenManager;

// CLI usage when run directly
if (require.main === module) {
    const tokenManager = new UpstoxTokenManager();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'init':
            console.log('🚀 Upstox Token Manager - Initial Setup');
            console.log('\n1. Visit the following URL to authorize the application:');
            console.log(tokenManager.getAuthorizationUrl());
            console.log('\n2. After authorization, you will be redirected to your redirect URI with a code parameter');
            console.log('3. Run: node token-manager.js exchange YOUR_AUTH_CODE');
            break;
            
        case 'exchange':
            const authCode = process.argv[3];
            if (!authCode) {
                console.error('❌ Please provide the authorization code');
                console.log('Usage: node token-manager.js exchange YOUR_AUTH_CODE');
                process.exit(1);
            }
            tokenManager.exchangeCodeForTokens(authCode).catch(console.error);
            break;
            
        case 'refresh':
            tokenManager.refreshAccessToken().catch(console.error);
            break;
            
        case 'check':
            tokenManager.checkTokenExpiry().then(status => {
                console.log('Token Status:', status);
            }).catch(console.error);
            break;
            
        case 'auto':
            tokenManager.autoRefreshIfNeeded().catch(console.error);
            break;
            
        default:
            console.log('🔧 Upstox Token Manager Commands:');
            console.log('  init     - Get authorization URL for initial setup');
            console.log('  exchange - Exchange auth code for tokens');
            console.log('  refresh  - Refresh access token');
            console.log('  check    - Check token expiry status');
            console.log('  auto     - Auto-refresh if needed');
    }
}
