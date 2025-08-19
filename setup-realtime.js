require('dotenv').config();

const log = {
    info: (msg) => console.log(`ℹ️ ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    warn: (msg) => console.log(`⚠️ ${msg}`)
};

console.log(`
🚀 EMA(5) Alert System - Configuration Setup
============================================

This script will help you set up real-time Nifty 50 data integration.
`);

// Check current configuration
const checkConfig = () => {
    log.info('Checking current configuration...\n');
    
    const upstoxToken = process.env.UPSTOX_ACCESS_TOKEN;
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    
    console.log('📊 Available Data Sources:');
    console.log(`   1. Upstox API: ${upstoxToken ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   2. Alpha Vantage: ${alphaVantageKey ? '✅ Configured' : '❌ Not configured'}`);
    console.log('');
    
    console.log('📱 Telegram Configuration:');
    console.log(`   Bot Token: ${telegramToken ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   Chat ID: ${telegramChatId ? '✅ Configured' : '❌ Not configured'}`);
    console.log('');
    
    // Provide recommendations
    if (upstoxToken && telegramToken && telegramChatId) {
        log.success('RECOMMENDED: Use Upstox for real-time data');
        console.log(`   Run: npm start (uses bot.js)
   Features: WebSocket real-time updates, sub-second latency
   Best for: Professional trading, Indian markets
`);
    } else if (alphaVantageKey && telegramToken && telegramChatId) {
        log.success('AVAILABLE: Use Alpha Vantage for real-time data');
        console.log(`   Run: node bot-alphavantage.js
   Features: Minute-by-minute updates, free tier
   Best for: Learning, testing, international coverage
`);
    } else {
        log.warn('SETUP REQUIRED: Missing configuration');
        console.log(`
   Required for any option:
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_CHAT_ID
   
   Choose one data source:
   - UPSTOX_ACCESS_TOKEN (for bot.js)
   - ALPHA_VANTAGE_API_KEY (for bot-alphavantage.js)
`);
    }
    
    return { upstoxToken, alphaVantageKey, telegramToken, telegramChatId };
};

// Test API connections
const testConnections = async () => {
    const axios = require('axios');
    const config = checkConfig();
    
    if (!config.telegramToken) {
        log.error('Cannot test connections without Telegram token');
        return;
    }
    
    log.info('Testing API connections...\n');
    
    // Test Telegram
    try {
        const telegramUrl = `https://api.telegram.org/bot${config.telegramToken}/getMe`;
        const telegramResponse = await axios.get(telegramUrl, { timeout: 5000 });
        
        if (telegramResponse.data.ok) {
            log.success(`Telegram: Connected as @${telegramResponse.data.result.username}`);
        } else {
            log.error('Telegram: Invalid bot token');
        }
    } catch (error) {
        log.error(`Telegram: Connection failed - ${error.message}`);
    }
    
    // Test Upstox if configured
    if (config.upstoxToken) {
        try {
            const upstoxUrl = 'https://api.upstox.com/v2/user/profile';
            const upstoxResponse = await axios.get(upstoxUrl, {
                headers: { 'Authorization': `Bearer ${config.upstoxToken}` },
                timeout: 10000
            });
            
            if (upstoxResponse.data.status === 'success') {
                log.success(`Upstox: Connected successfully`);
            } else {
                log.error('Upstox: Invalid access token');
            }
        } catch (error) {
            if (error.response?.status === 401) {
                log.error('Upstox: Authentication failed - Check access token');
            } else {
                log.error(`Upstox: Connection failed - ${error.message}`);
            }
        }
    }
    
    // Test Alpha Vantage if configured
    if (config.alphaVantageKey) {
        try {
            const alphaUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=NSEI&apikey=${config.alphaVantageKey}`;
            const alphaResponse = await axios.get(alphaUrl, { timeout: 10000 });
            
            if (alphaResponse.data['Global Quote']) {
                log.success('Alpha Vantage: Connected successfully');
                const quote = alphaResponse.data['Global Quote'];
                console.log(`   Current NSEI price: ${quote['05. price']}`);
            } else if (alphaResponse.data['Error Message']) {
                log.error(`Alpha Vantage: ${alphaResponse.data['Error Message']}`);
            } else if (alphaResponse.data['Note']) {
                log.warn(`Alpha Vantage: ${alphaResponse.data['Note']}`);
            } else {
                log.error('Alpha Vantage: Invalid response format');
            }
        } catch (error) {
            log.error(`Alpha Vantage: Connection failed - ${error.message}`);
        }
    }
    
    console.log('');
};

// Market hours check
const checkMarketHours = () => {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    const isMarketOpen = currentTime >= 915 && currentTime <= 1530;
    
    console.log('📅 Market Status:');
    console.log(`   Current IST Time: ${istTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Market Status: ${isMarketOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
    console.log(`   Market Hours: 9:15 AM - 3:30 PM IST`);
    console.log('');
    
    if (!isMarketOpen) {
        log.warn('Market is currently closed. Testing with limited data.');
    }
};

// Show setup instructions
const showSetupInstructions = () => {
    console.log(`
🛠️ Setup Instructions:
======================

1. Copy .env.example to .env:
   cp .env.example .env

2. Edit .env file with your API keys:
   
   For Upstox (Recommended):
   UPSTOX_ACCESS_TOKEN=your_upstox_token
   
   For Alpha Vantage (Free):
   ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
   
   Required for both:
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id

3. Install dependencies:
   npm install

4. Run the appropriate bot:
   - Upstox: npm start
   - Alpha Vantage: node bot-alphavantage.js

📚 For detailed instructions, see:
   - REALTIME_INTEGRATION.md
   - README.md
`);
};

// Main execution
const main = async () => {
    try {
        const config = checkConfig();
        
        checkMarketHours();
        
        if (config.telegramToken) {
            await testConnections();
        }
        
        // Provide next steps
        if (!config.telegramToken || (!config.upstoxToken && !config.alphaVantageKey)) {
            showSetupInstructions();
        } else {
            log.success('Configuration looks good! You can start the bot now.');
            
            if (config.upstoxToken) {
                console.log(`
🚀 Start Upstox Bot:
   npm start
   
📊 Features: Real-time WebSocket, sub-second updates
`);
            }
            
            if (config.alphaVantageKey) {
                console.log(`
🚀 Start Alpha Vantage Bot:
   node bot-alphavantage.js
   
📊 Features: Minute updates, free tier available
`);
            }
        }
        
    } catch (error) {
        log.error(`Setup check failed: ${error.message}`);
    }
};

// Run the setup check
main();
