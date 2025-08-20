// Comprehensive Server Diagnostic - Check All Endpoints
const axios = require('axios');

const BASE_URL = 'https://ema5-alert-system.onrender.com';

async function comprehensiveServerCheck() {
    console.log('🔍 COMPREHENSIVE SERVER DIAGNOSTIC');
    console.log('=' .repeat(50));
    console.log(`🌐 Testing: ${BASE_URL}`);
    console.log(`⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log('');
    
    const endpoints = [
        { name: 'Health Check', url: '/health', timeout: 10000 },
        { name: 'Token Status', url: '/token-status', timeout: 15000 },
        { name: 'Home Page', url: '/', timeout: 10000 },
        { name: 'Auth Page', url: '/auth', timeout: 10000 }
    ];
    
    let serverResponding = false;
    
    for (const endpoint of endpoints) {
        console.log(`\n🔍 Testing: ${endpoint.name}`);
        console.log(`📍 URL: ${BASE_URL}${endpoint.url}`);
        
        try {
            const startTime = Date.now();
            
            const response = await axios.get(`${BASE_URL}${endpoint.url}`, {
                timeout: endpoint.timeout,
                validateStatus: () => true // Accept any status code
            });
            
            const duration = Date.now() - startTime;
            
            if (response.status === 200) {
                console.log(`✅ Status: ${response.status} OK (${duration}ms)`);
                serverResponding = true;
                
                // Parse response for additional info
                if (endpoint.name === 'Health Check' && response.data) {
                    console.log(`📊 Uptime: ${response.data.uptime?.toFixed(1)}s`);
                    console.log(`📈 Market: ${response.data.isMarketOpen ? '🟢 Open' : '🔴 Closed'}`);
                    console.log(`🔗 Connected: ${response.data.isConnected ? '🟢 WebSocket' : '🔴 Disconnected'}`);
                    console.log(`🔄 Fallback: ${response.data.useRestFallback ? '🟡 REST API' : '❌ None'}`);
                    console.log(`📊 Candles: ${response.data.candlesGenerated || 0}`);
                }
                
                if (endpoint.name === 'Token Status' && response.data) {
                    console.log(`🔑 Token: ${response.data.tokenInfo?.status || 'Unknown'}`);
                    console.log(`⏰ Expires: ${response.data.tokenInfo?.timeUntilExpiry || 'Unknown'}`);
                }
                
            } else if (response.status === 503) {
                console.log(`⚠️  Status: ${response.status} - Service Unavailable (${duration}ms)`);
                console.log(`💭 Reason: Server is starting up or redeploying`);
            } else {
                console.log(`❌ Status: ${response.status} - ${response.statusText} (${duration}ms)`);
            }
            
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log(`❌ Connection Refused - Server is down`);
            } else if (error.code === 'ETIMEDOUT') {
                console.log(`⏱️  Timeout - Server is not responding`);
            } else if (error.response) {
                console.log(`❌ HTTP ${error.response.status}: ${error.response.statusText}`);
            } else {
                console.log(`❌ Error: ${error.message}`);
            }
        }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('=' .repeat(50));
    
    if (serverResponding) {
        console.log('✅ SERVER STATUS: ONLINE');
        console.log('🎯 System is responding to requests');
        console.log('📊 Health endpoints are accessible');
        console.log('🚀 EMA Alert System is operational');
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('• System appears to be working correctly');
        console.log('• Monitor for consistent uptime');
        console.log('• Check if alerts are being generated');
        
    } else {
        console.log('❌ SERVER STATUS: OFFLINE OR ISSUES');
        console.log('🔧 Possible causes:');
        console.log('• Render service is redeploying');
        console.log('• Application crashed and restarting');
        console.log('• Network connectivity issues');
        console.log('• Server overloaded or rate limited');
        
        console.log('\n🔧 TROUBLESHOOTING STEPS:');
        console.log('1. Wait 2-3 minutes for Render redeploy');
        console.log('2. Check Render dashboard for logs');
        console.log('3. Verify environment variables are set');
        console.log('4. Check for any code errors in logs');
    }
    
    console.log('\n📍 NEXT STEPS:');
    console.log('• Run this diagnostic again in 2-3 minutes');
    console.log('• Check Render logs for specific errors');
    console.log('• Monitor system stability over time');
    
    console.log('\n' + '=' .repeat(50));
}

// Run diagnostic
comprehensiveServerCheck().catch(console.error);
