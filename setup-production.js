require('dotenv').config();
const UpstoxTokenManager = require('./token-manager');

/**
 * Production Token Setup for Render Deployment
 * 
 * This script handles the one-time OAuth setup for production environment.
 * Once completed, your app will automatically refresh tokens forever.
 */

async function setupProductionTokens() {
    console.log('🚀 Production Token Setup for Render Deployment\n');
    
    const tokenManager = new UpstoxTokenManager();
    
    try {
        // Validate OAuth credentials
        tokenManager.validateConfig();
        console.log('✅ OAuth credentials validated');
        
        // Check if already configured
        const existingTokens = await tokenManager.loadTokens();
        if (existingTokens && existingTokens.refresh_token) {
            console.log('✅ Refresh tokens already configured!');
            
            // Try to refresh to verify everything works
            try {
                await tokenManager.autoRefreshIfNeeded();
                console.log('✅ Token refresh system is working correctly');
                console.log('🎉 Your app is ready for lifetime operation!');
                return;
            } catch (error) {
                console.log('⚠️ Existing tokens need renewal, proceeding with setup...');
            }
        }
        
        // Generate authorization URL for production
        const authUrl = tokenManager.getAuthorizationUrl();
        
        console.log('📋 PRODUCTION SETUP INSTRUCTIONS:');
        console.log('='.repeat(60));
        console.log('');
        console.log('🔗 STEP 1: Visit this authorization URL:');
        console.log(`${authUrl}`);
        console.log('');
        console.log('🔄 STEP 2: After authorization, you will be redirected to:');
        console.log(`https://ema5-alert-system.onrender.com/callback?code=XXXX...`);
        console.log('');
        console.log('✅ STEP 3: Your app will automatically:');
        console.log('   • Capture the authorization code');
        console.log('   • Exchange it for tokens');
        console.log('   • Start automatic refresh');
        console.log('   • Run forever without manual intervention');
        console.log('');
        console.log('⚡ IMPORTANT: Do this ONLY ONCE during initial setup!');
        console.log('After this, your app will handle everything automatically.');
        console.log('');
        console.log('='.repeat(60));
        
        // If authorization code is provided via environment variable (for automated setup)
        if (process.env.UPSTOX_AUTH_CODE) {
            console.log('🔄 Found authorization code in environment, proceeding with automatic setup...');
            await tokenManager.exchangeCodeForTokens(process.env.UPSTOX_AUTH_CODE);
            console.log('🎉 Production tokens configured successfully!');
            
            // Clean up the auth code from environment
            delete process.env.UPSTOX_AUTH_CODE;
        }
        
    } catch (error) {
        console.error('❌ Production setup failed:', error.message);
        
        if (error.message.includes('Missing required environment variables')) {
            console.log('\n📋 Required Environment Variables for Production:');
            console.log('UPSTOX_CLIENT_ID=your_client_id');
            console.log('UPSTOX_CLIENT_SECRET=your_client_secret');
            console.log('UPSTOX_REDIRECT_URI=https://ema5-alert-system.onrender.com/callback');
            console.log('\nAdd these to your Render environment variables.');
        }
    }
}

// Enhanced token manager with production-specific features
class ProductionTokenManager extends UpstoxTokenManager {
    constructor() {
        super();
        this.isProduction = process.env.NODE_ENV === 'production' || 
                          process.env.RENDER || 
                          process.env.UPSTOX_REDIRECT_URI?.includes('render.com');
    }
    
    /**
     * Production-safe token refresh with error handling
     */
    async autoRefreshWithFallback() {
        try {
            const refreshed = await this.autoRefreshIfNeeded();
            
            if (refreshed) {
                console.log('🔄 Production token refresh completed successfully');
                
                // Notify via environment or logging service if available
                if (process.env.WEBHOOK_URL) {
                    await this.notifyTokenRefresh();
                }
            }
            
            return refreshed;
        } catch (error) {
            console.error('❌ Production token refresh failed:', error.message);
            
            // In production, log the error but don't crash the app
            if (this.isProduction) {
                console.log('⚠️ Continuing with existing token, will retry next cycle');
                return false;
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Notify external systems about token refresh (optional webhook)
     */
    async notifyTokenRefresh() {
        if (!process.env.WEBHOOK_URL) return;
        
        try {
            const axios = require('axios');
            await axios.post(process.env.WEBHOOK_URL, {
                event: 'token_refreshed',
                timestamp: new Date().toISOString(),
                service: 'ema5-alert-system'
            }, { timeout: 5000 });
        } catch (error) {
            console.log('⚠️ Webhook notification failed (non-critical)');
        }
    }
    
    /**
     * Start production-optimized scheduler
     */
    startProductionScheduler() {
        console.log('🕐 Starting production token scheduler...');
        
        // Check immediately on startup
        this.autoRefreshWithFallback().catch(console.error);
        
        // Check every 20 minutes in production (more frequent)
        const intervalMinutes = this.isProduction ? 20 : 30;
        
        setInterval(async () => {
            try {
                await this.autoRefreshWithFallback();
            } catch (error) {
                console.error('❌ Scheduled token refresh failed:', error.message);
            }
        }, intervalMinutes * 60 * 1000);
        
        console.log(`✅ Production scheduler active (checking every ${intervalMinutes} minutes)`);
    }
}

// Export for use in main app
module.exports = { setupProductionTokens, ProductionTokenManager };

// Run setup when called directly
if (require.main === module) {
    setupProductionTokens().catch(console.error);
}
