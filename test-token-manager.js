require('dotenv').config();
const UpstoxTokenManager = require('./token-manager');

async function testTokenManager() {
    console.log('🧪 Testing Token Manager...\n');
    
    try {
        const tokenManager = new UpstoxTokenManager();
        
        // Test 1: Check configuration
        console.log('1️⃣ Testing configuration validation...');
        if (process.env.UPSTOX_CLIENT_ID && process.env.UPSTOX_CLIENT_SECRET) {
            tokenManager.validateConfig();
            console.log('✅ OAuth credentials found');
        } else {
            console.log('⚠️ OAuth credentials not configured');
            console.log('   Run: npm run setup-tokens');
        }
        
        // Test 2: Check current token status
        console.log('\n2️⃣ Testing token status check...');
        const status = await tokenManager.checkTokenExpiry();
        
        console.log('Token Status:');
        console.log(`  Expired: ${status.expired ? '❌ YES' : '✅ NO'}`);
        console.log(`  Needs Refresh: ${status.needsRefresh ? '⚠️ YES' : '✅ NO'}`);
        
        if (status.expiresAt) {
            console.log(`  Expires At: ${status.expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            const hours = Math.floor(status.timeUntilExpiry / 3600);
            const minutes = Math.floor((status.timeUntilExpiry % 3600) / 60);
            console.log(`  Time Until Expiry: ${hours}h ${minutes}m`);
        }
        
        // Test 3: Check if tokens file exists
        console.log('\n3️⃣ Testing token storage...');
        const tokens = await tokenManager.loadTokens();
        if (tokens) {
            console.log('✅ Token storage file exists');
            console.log(`   Saved at: ${tokens.saved_at}`);
            if (tokens.refreshed_at) {
                console.log(`   Last refreshed: ${tokens.refreshed_at}`);
            }
        } else {
            console.log('⚠️ No token storage found');
            console.log('   Run initial setup if needed');
        }
        
        // Test 4: Test auto-refresh logic (without actual refresh)
        console.log('\n4️⃣ Testing auto-refresh decision...');
        if (status.expired) {
            console.log('🔄 Token expired - would trigger immediate refresh');
        } else if (status.needsRefresh) {
            console.log('🔄 Token expires soon - would trigger proactive refresh');
        } else {
            console.log('✅ Token is healthy - no refresh needed');
        }
        
        console.log('\n✅ Token Manager test completed successfully!');
        
        if (!process.env.UPSTOX_CLIENT_ID) {
            console.log('\n💡 To enable automatic token refresh:');
            console.log('   1. Run: npm run setup-tokens');
            console.log('   2. Follow the setup instructions');
            console.log('   3. Your tokens will refresh automatically');
        }
        
    } catch (error) {
        console.error('\n❌ Token Manager test failed:');
        console.error(`   Error: ${error.message}`);
        
        if (error.message.includes('Missing required environment variables')) {
            console.log('\n💡 Setup OAuth credentials:');
            console.log('   npm run setup-tokens');
        }
    }
}

// Test basic environment setup
console.log('🔍 Environment Check:');
console.log(`✅ UPSTOX_ACCESS_TOKEN: ${process.env.UPSTOX_ACCESS_TOKEN ? '***CONFIGURED***' : '❌ MISSING'}`);
console.log(`✅ UPSTOX_CLIENT_ID: ${process.env.UPSTOX_CLIENT_ID ? '***CONFIGURED***' : '❌ MISSING'}`);
console.log(`✅ UPSTOX_CLIENT_SECRET: ${process.env.UPSTOX_CLIENT_SECRET ? '***CONFIGURED***' : '❌ MISSING'}`);
console.log(`✅ TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '***CONFIGURED***' : '❌ MISSING'}`);
console.log(`✅ TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? '***CONFIGURED***' : '❌ MISSING'}`);
console.log('');

testTokenManager().catch(console.error);
