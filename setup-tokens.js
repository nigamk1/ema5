require('dotenv').config();
const UpstoxTokenManager = require('./token-manager');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setupAutomaticTokenRefresh() {
    console.log('🚀 Upstox Automatic Token Refresh Setup\n');
    
    console.log('This setup will enable automatic token refresh so you never have to manually update tokens again!\n');
    
    // Check if already configured
    if (process.env.UPSTOX_CLIENT_ID && process.env.UPSTOX_CLIENT_SECRET) {
        console.log('✅ OAuth credentials already configured!');
        const proceed = await question('Do you want to reconfigure? (y/N): ');
        if (proceed.toLowerCase() !== 'y') {
            rl.close();
            return;
        }
    }
    
    console.log('📋 You need the following from your Upstox Developer Console:');
    console.log('1. Client ID (API Key)');
    console.log('2. Client Secret');
    console.log('3. Redirect URI (use: http://localhost:3000/callback)\n');
    
    console.log('🔗 Get these from: https://api.upstox.com/developer-console\n');
    
    const proceed = await question('Do you have these credentials ready? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
        console.log('\n📖 Instructions to get credentials:');
        console.log('1. Go to https://api.upstox.com/developer-console');
        console.log('2. Create a new app or use existing one');
        console.log('3. Set Redirect URI as: http://localhost:3000/callback');
        console.log('4. Copy Client ID and Client Secret');
        console.log('5. Run this setup again with: npm run setup-tokens\n');
        rl.close();
        return;
    }
    
    // Get credentials
    const clientId = await question('Enter your Upstox Client ID: ');
    const clientSecret = await question('Enter your Upstox Client Secret: ');
    const redirectUri = await question('Enter Redirect URI (press Enter for default): ') || 'http://localhost:3000/callback';
    
    // Update .env file
    const fs = require('fs');
    const path = require('path');
    const envFile = path.join(__dirname, '.env');
    
    let envContent = '';
    if (fs.existsSync(envFile)) {
        envContent = fs.readFileSync(envFile, 'utf8');
    }
    
    // Update or add OAuth credentials
    const updateEnvVar = (content, key, value) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${value}`;
        
        if (regex.test(content)) {
            return content.replace(regex, newLine);
        } else {
            return content + `\n${newLine}`;
        }
    };
    
    envContent = updateEnvVar(envContent, 'UPSTOX_CLIENT_ID', clientId);
    envContent = updateEnvVar(envContent, 'UPSTOX_CLIENT_SECRET', clientSecret);
    envContent = updateEnvVar(envContent, 'UPSTOX_REDIRECT_URI', redirectUri);
    
    fs.writeFileSync(envFile, envContent);
    
    // Reload environment variables
    require('dotenv').config();
    
    console.log('\n✅ OAuth credentials saved to .env file');
    
    // Now initiate authorization flow
    console.log('\n🔐 Starting authorization flow...');
    
    const tokenManager = new UpstoxTokenManager();
    const authUrl = tokenManager.getAuthorizationUrl();
    
    console.log('\n📌 STEP 1: Open this URL in your browser:');
    console.log(`🔗 ${authUrl}\n`);
    
    console.log('📌 STEP 2: After authorization, you\'ll be redirected to:');
    console.log(`${redirectUri}?code=AUTHORIZATION_CODE&state=...`);
    console.log('\n📌 STEP 3: Copy the "code" parameter from the redirected URL');
    
    const authCode = await question('\nEnter the authorization code from the redirect URL: ');
    
    try {
        console.log('\n🔄 Exchanging authorization code for tokens...');
        await tokenManager.exchangeCodeForTokens(authCode);
        
        console.log('\n🎉 SUCCESS! Automatic token refresh is now configured!');
        console.log('\n✅ Your bot will now automatically refresh tokens every day');
        console.log('✅ No more manual token updates required');
        console.log('✅ Tokens are checked every 30 minutes and refreshed when needed');
        
        console.log('\n🚀 You can now start your bot with: npm start');
        
    } catch (error) {
        console.error('\n❌ Failed to exchange authorization code:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Make sure the authorization code is correct');
        console.log('2. Check that your Client ID and Secret are correct');
        console.log('3. Ensure the Redirect URI matches exactly');
        console.log('4. Try the authorization flow again');
    }
    
    rl.close();
}

// CLI interface
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            await setupAutomaticTokenRefresh();
            break;
            
        case 'check':
            const tokenManager = new UpstoxTokenManager();
            const status = await tokenManager.checkTokenExpiry();
            console.log('🔍 Current Token Status:');
            console.log(`Expired: ${status.expired ? '❌ YES' : '✅ NO'}`);
            console.log(`Needs Refresh: ${status.needsRefresh ? '⚠️ YES' : '✅ NO'}`);
            if (status.expiresAt) {
                console.log(`Expires At: ${status.expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                const hours = Math.floor(status.timeUntilExpiry / 3600);
                const minutes = Math.floor((status.timeUntilExpiry % 3600) / 60);
                console.log(`Time Until Expiry: ${hours}h ${minutes}m`);
            }
            break;
            
        case 'refresh':
            console.log('🔄 Manually refreshing token...');
            const tm = new UpstoxTokenManager();
            await tm.refreshAccessToken();
            break;
            
        case 'auto':
            console.log('🔄 Auto-refreshing token if needed...');
            const atmgr = new UpstoxTokenManager();
            const refreshed = await atmgr.autoRefreshIfNeeded();
            if (!refreshed) {
                console.log('✅ Token is still valid, no refresh needed');
            }
            break;
            
        default:
            console.log('🔧 Upstox Token Setup Commands:');
            console.log('  setup   - Complete setup for automatic token refresh');
            console.log('  check   - Check current token status');
            console.log('  refresh - Manually refresh the access token');
            console.log('  auto    - Auto-refresh token if needed');
            console.log('\nTo start setup: npm run setup-tokens');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { setupAutomaticTokenRefresh };
