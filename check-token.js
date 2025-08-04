require('dotenv').config();

const checkTokenExpiry = () => {
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    
    try {
        // Decode JWT token (split by . and decode the payload)
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.log('❌ Invalid JWT token format');
            return;
        }
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        console.log('🔍 Token Details:');
        console.log('Subject:', payload.sub);
        console.log('Issued At:', new Date(payload.iat * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('Expires At:', new Date(payload.exp * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        
        const now = Math.floor(Date.now() / 1000);
        const isExpired = now > payload.exp;
        
        console.log('Current Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('Token Status:', isExpired ? '❌ EXPIRED' : '✅ VALID');
        
        if (isExpired) {
            console.log('\n🚨 YOUR TOKEN HAS EXPIRED!');
            console.log('You need to generate a new access token from Upstox.');
            console.log('Follow these steps:');
            console.log('1. Login to https://upstox.com/developer/');
            console.log('2. Go to your app');
            console.log('3. Generate a new access token');
            console.log('4. Update your .env file with the new token');
        } else {
            const hoursLeft = Math.floor((payload.exp - now) / 3600);
            console.log(`⏰ Token expires in ${hoursLeft} hours`);
        }
        
    } catch (error) {
        console.error('❌ Error decoding token:', error.message);
    }
};

checkTokenExpiry();
