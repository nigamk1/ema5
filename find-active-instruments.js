require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;

const findActiveNiftyInstruments = async () => {
    console.log('🔍 Searching for active Nifty instruments...');
    
    // Try different Nifty futures and ETFs that should have candle data
    const testInstruments = [
        'NSE_EQ|NIFTYBEES',  // Nifty ETF
        'NSE_EQ|JUNIORBEES', // Junior Nifty ETF  
        'NSE_EQ|BANKBEES',   // Bank Nifty ETF
        'NSE_FO|NIFTY24AUG24000CE', // Nifty options (current month)
        'NSE_FO|NIFTY24SEP24000CE', // Nifty options (next month)
        'NSE_EQ|RELIANCE',   // Individual stock (should definitely work)
        'NSE_EQ|TCS',        // Another stock
        'NSE_EQ|INFY'        // Another stock
    ];
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    for (const instrument of testInstruments) {
        try {
            const encodedInstrument = encodeURIComponent(instrument);
            const url = `https://api.upstox.com/v2/historical-candle/${encodedInstrument}/1minute/${yesterdayStr}/${yesterdayStr}`;
            
            const response = await axios.get(url, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                },
                timeout: 5000
            });

            const candles = response.data.data.candles;
            console.log(`✅ ${instrument}: ${candles?.length || 0} candles`);
            
            if (candles && candles.length >= 10) {
                console.log(`   🎯 RECOMMENDED: This instrument has sufficient data!`);
                console.log(`   Latest candle: ${new Date(candles[0][0]).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log(`   OHLC: ${candles[0][1]}/${candles[0][2]}/${candles[0][3]}/${candles[0][4]}`);
                return { instrument, candles: candles.length };
            }

        } catch (error) {
            console.log(`❌ ${instrument}: ${error.response?.status || error.message}`);
        }
    }
    
    return null;
};

const main = async () => {
    const result = await findActiveNiftyInstruments();
    
    if (result) {
        console.log(`\n🎯 UPDATE YOUR .env FILE:`);
        console.log(`INSTRUMENT_KEY=${result.instrument}`);
        console.log(`TIMEFRAME=1minute`);
        console.log(`\nThis instrument has ${result.candles} candles available.`);
    } else {
        console.log('\n⚠️ No instruments found with sufficient data.');
        console.log('This might be because:');
        console.log('1. Markets are closed (weekend/holiday)');
        console.log('2. Access token might be expired');
        console.log('3. Need to check Upstox API documentation for correct instrument keys');
    }
};

main();
