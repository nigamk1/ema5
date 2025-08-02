require('dotenv').config();
const axios = require('axios');

// Test configuration
const testConfig = async () => {
    console.log('🧪 Testing EMA(5) Two-Stage Alert System Configuration...\n');
    
    // Check environment variables
    const requiredVars = ['UPSTOX_ACCESS_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.log('❌ Missing environment variables:', missing.join(', '));
        console.log('📝 Please check your .env file\n');
        return false;
    }
    
    console.log('✅ Environment variables loaded');
    
    // Display configuration
    const config = {
        instrument: process.env.INSTRUMENT_KEY || 'NSE_INDEX|NIFTY 50',
        timeframe: process.env.TIMEFRAME || '5minute',
        emaPeriod: process.env.EMA_PERIOD || '5',
        cooldown: process.env.ALERT_COOLDOWN_MINUTES || '2'
    };
    
    console.log('📋 Current Configuration:');
    console.log(`   Instrument: ${config.instrument}`);
    console.log(`   Timeframe: ${config.timeframe}`);
    console.log(`   EMA Period: ${config.emaPeriod}`);
    console.log(`   Alert Cooldown: ${config.cooldown} minutes`);
    
    // Test Telegram Bot
    try {
        const botUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`;
        const botResponse = await axios.get(botUrl, { timeout: 5000 });
        
        if (botResponse.data.ok) {
            console.log(`✅ Telegram bot connected: @${botResponse.data.result.username}`);
        } else {
            console.log('❌ Invalid Telegram bot token');
            return false;
        }
    } catch (error) {
        console.log('❌ Telegram bot test failed:', error.message);
        return false;
    }
    
    // Test Upstox API
    try {
        const instrument = encodeURIComponent(config.instrument);
        const today = new Date().toISOString().split('T')[0];
        const upstoxUrl = `https://api.upstox.com/v2/historical-candle/${instrument}/${config.timeframe}/${today}/${today}`;
        
        const upstoxResponse = await axios.get(upstoxUrl, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`
            },
            timeout: 10000
        });
        
        if (upstoxResponse.data.status === 'success') {
            const candles = upstoxResponse.data.data.candles;
            console.log(`✅ Upstox API connected - Retrieved ${candles?.length || 0} ${config.timeframe} candles`);
            
            if (candles && candles.length >= 6) {
                console.log('✅ Sufficient data available for two-stage strategy');
            } else {
                console.log('⚠️ Insufficient candle data (need minimum 6 candles)');
                console.log('   This is normal outside market hours or for new instruments');
            }
        } else {
            console.log('❌ Upstox API returned error status');
            return false;
        }
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('❌ Upstox authentication failed - check your access token');
        } else if (error.response?.status === 429) {
            console.log('❌ Upstox rate limit exceeded');
        } else {
            console.log('❌ Upstox API test failed:', error.message);
        }
        return false;
    }
    
    // Test sending a test message
    try {
        const testMessage = `🧪 EMA(5) Two-Stage Alert System Test
        
Configuration test completed successfully!
Time: ${new Date().toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    hour12: false 
})}

📊 Monitoring: ${config.instrument} (${config.timeframe})
📈 Strategy: Two-Stage EMA(${config.emaPeriod}) Alert System

✅ All systems operational  
🚀 Ready to monitor Alert Candles and PUT signals

⚠️ This is a test message`;

        const messageUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(messageUrl, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: testMessage
        }, { timeout: 5000 });
        
        console.log('✅ Test alert sent to Telegram successfully');
    } catch (error) {
        console.log('❌ Failed to send test alert:', error.message);
        return false;
    }
    
    console.log('\n🎉 All tests passed! Two-Stage Alert System is ready to run.');
    console.log('\n📋 Strategy Summary:');
    console.log('   Stage 1: Alert Candle Detection (all OHLC > EMA)');
    console.log('   Stage 2: PUT Signal on breakdown below Alert Candle low');
    console.log('\n🚀 Run "npm start" to begin monitoring.');
    
    return true;
};

// Run tests
testConfig().catch(error => {
    console.log('\n❌ Test failed:', error.message);
    process.exit(1);
});
