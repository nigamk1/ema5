require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;
const INSTRUMENT_KEY = encodeURIComponent(process.env.INSTRUMENT_KEY || 'NSE_INDEX|NIFTY 50');
const TIMEFRAME = process.env.TIMEFRAME || '5minute';

const debugUpstoxAPI = async () => {
    console.log('🔍 Debugging Upstox API Connection...');
    console.log(`📊 Instrument: ${decodeURIComponent(INSTRUMENT_KEY)}`);
    console.log(`⏰ Timeframe: ${TIMEFRAME}`);
    console.log(`🔑 Token (first 20 chars): ${ACCESS_TOKEN?.substring(0, 20)}...`);
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const url = `https://api.upstox.com/v2/historical-candle/${INSTRUMENT_KEY}/${TIMEFRAME}/${today}/${today}`;
        
        console.log(`🌐 API URL: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            timeout: 10000
        });

        console.log('✅ API Response Status:', response.status);
        console.log('📊 Candles received:', response.data.data.candles?.length || 0);
        
        if (response.data.data.candles && response.data.data.candles.length > 0) {
            const latest = response.data.data.candles[0];
            console.log('📈 Latest candle:', {
                timestamp: new Date(latest[0]).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                open: latest[1],
                high: latest[2], 
                low: latest[3],
                close: latest[4]
            });
        }

    } catch (error) {
        console.error('❌ API Error Details:');
        console.error('Status:', error.response?.status);
        console.error('Message:', error.response?.data?.message || error.message);
        console.error('Full error:', error.response?.data);
        
        if (error.response?.status === 400) {
            console.log('\n💡 Possible fixes for 400 error:');
            console.log('1. Check if Upstox token is valid and not expired');
            console.log('2. Verify instrument key format');
            console.log('3. Check if market is open (required for historical data)');
            console.log('4. Try different date range');
        }
    }
};

// Test current market time
const checkMarketHours = () => {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    console.log('\n🕐 Current IST Time:', istTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    console.log('🏪 Market Hours: 9:15 AM - 3:30 PM IST');
    console.log('📊 Market Status:', (currentTime >= 915 && currentTime <= 1530) ? '🟢 OPEN' : '🔴 CLOSED');
};

// Test Telegram connection
const testTelegram = async () => {
    try {
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
        const response = await axios.get(url);
        
        if (response.data.ok) {
            console.log('\n✅ Telegram Bot Connected:', response.data.result.username);
        }
    } catch (error) {
        console.error('\n❌ Telegram Error:', error.message);
    }
};

const main = async () => {
    checkMarketHours();
    await testTelegram();
    await debugUpstoxAPI();
};

main();
