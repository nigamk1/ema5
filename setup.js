const fs = require('fs');
const path = require('path');

console.log('🚀 EMA(5) Alert System Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
        // Copy .env.example to .env
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ Created .env file from .env.example');
    } else {
        // Create basic .env file
        const envContent = `# Upstox API Configuration
UPSTOX_ACCESS_TOKEN=your_upstox_access_token_here

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Instrument Configuration
INSTRUMENT_KEY=NSE_FO|NIFTY24AUGFUT

# Optional: Logging Level (info, debug, error)
LOG_LEVEL=info

# Optional: Alert cooldown in minutes (prevents spam alerts)
ALERT_COOLDOWN_MINUTES=5`;

        fs.writeFileSync(envPath, envContent);
        console.log('✅ Created .env file with default configuration');
    }
} else {
    console.log('✅ .env file already exists');
}

console.log('\n📋 Next Steps:');
console.log('1. Edit the .env file with your actual credentials:');
console.log('   - Get Upstox API access token from https://api.upstox.com/');
console.log('   - Create Telegram bot via @BotFather');
console.log('   - Get your Telegram chat ID');
console.log('');
console.log('2. Test your configuration:');
console.log('   npm run test-config');
console.log('');
console.log('3. Start the application:');
console.log('   npm start');
console.log('');
console.log('4. Optional - See EMA calculation example:');
console.log('   node ema-example.js');

console.log('\n🔗 Helpful Links:');
console.log('• Upstox Developer Console: https://api.upstox.com/');
console.log('• Telegram BotFather: https://t.me/botfather');
console.log('• Get Telegram Chat ID: https://t.me/userinfobot');
console.log('• Project Documentation: README.md');

console.log('\n⚠️ Important:');
console.log('• Never share your .env file or commit it to version control');
console.log('• This tool is for educational purposes only');
console.log('• Always use proper risk management when trading');

console.log('\n🎯 Setup completed! Edit your .env file and run the tests.');
