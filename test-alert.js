require('dotenv').config();

// Simulate the alert system for testing purposes
const sendTestAlert = async () => {
    const axios = require('axios');
    
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    const message = `🚨 *TEST ALERT - EMA(5) SYSTEM*
    
📈 *Nifty 50 - 1MINUTE Chart*
🕐 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📊 OHLC: 24350.50 | 24365.75 | 24340.25 | 24360.00
📉 EMA(5): 24345.30

✅ *All OHLC values are above EMA(5)*
🎯 *Watching for breakdown below: 24340.25*

💡 Strong bullish momentum detected!
🔻 Monitoring for PUT entry signal...

⚠️ This is a TEST alert - Update your Upstox token to get real data!`;

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
        
        if (response.data.ok) {
            console.log('✅ Test alert sent successfully!');
            console.log('📱 Check your Telegram for the test message.');
        }
        
    } catch (error) {
        console.error('❌ Failed to send test alert:', error.message);
    }
};

console.log('🧪 Sending test alert to verify Telegram connection...');
sendTestAlert();
