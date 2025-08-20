// Render Environment Verification Script
// Run this after setting up environment variables on Render

require('dotenv').config();

console.log('🔍 RENDER ENVIRONMENT VERIFICATION');
console.log('=' .repeat(50));

// Required environment variables
const requiredVars = {
    'UPSTOX_CLIENT_ID': process.env.UPSTOX_CLIENT_ID,
    'UPSTOX_CLIENT_SECRET': process.env.UPSTOX_CLIENT_SECRET, 
    'UPSTOX_REDIRECT_URI': process.env.UPSTOX_REDIRECT_URI,
    'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN,
    'TELEGRAM_CHAT_ID': process.env.TELEGRAM_CHAT_ID,
    'INSTRUMENT_KEY': process.env.INSTRUMENT_KEY,
    'TIMEFRAME': process.env.TIMEFRAME,
    'EMA_PERIOD': process.env.EMA_PERIOD
};

// Optional variables
const optionalVars = {
    'LOG_LEVEL': process.env.LOG_LEVEL || 'info',
    'ALERT_COOLDOWN_MINUTES': process.env.ALERT_COOLDOWN_MINUTES || '2',
    'NODE_ENV': process.env.NODE_ENV || 'development'
};

console.log('\n📋 REQUIRED VARIABLES:');
let allRequired = true;

Object.entries(requiredVars).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    const displayValue = value ? 
        (key.includes('SECRET') || key.includes('TOKEN') ? 
            value.substring(0, 8) + '...' : value) : 
        'NOT SET';
    
    console.log(`${status} ${key}: ${displayValue}`);
    if (!value) allRequired = false;
});

console.log('\n⚙️ OPTIONAL VARIABLES:');
Object.entries(optionalVars).forEach(([key, value]) => {
    console.log(`✅ ${key}: ${value}`);
});

console.log('\n🎯 VERIFICATION RESULT:');
if (allRequired) {
    console.log('🎉 ALL REQUIRED VARIABLES SET!');
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Deploy to Render');
    console.log('2. Visit: https://ema5-alert-system.onrender.com/auth');
    console.log('3. Authorize once to setup token auto-refresh');
    console.log('4. System will run automatically!');
} else {
    console.log('⚠️  MISSING REQUIRED VARIABLES!');
    console.log('\n🔧 ACTION NEEDED:');
    console.log('1. Go to Render Dashboard');
    console.log('2. Open your service');
    console.log('3. Go to Environment tab');
    console.log('4. Add missing variables');
    console.log('5. Save and redeploy');
}

console.log('\n🌐 PRODUCTION URLs:');
console.log('Health Check: https://ema5-alert-system.onrender.com/health');
console.log('Auth Setup: https://ema5-alert-system.onrender.com/auth');
console.log('Token Status: https://ema5-alert-system.onrender.com/token-status');

console.log('\n' + '=' .repeat(50));
