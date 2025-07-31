// Simplified test script - let the service handle dotenv
import atlasAuth from './services/atlasAuth.js';

async function testAuthOnly() {
    try {
        console.log(' Testing authentication...');
        
        const token = await atlasAuth.getAuthToken();
        console.log(' Success! Token acquired:', token.substring(0, 30) + '...');
        
    } catch (error) {
        console.error(' Auth test failed:', error.message);
    }
}

testAuthOnly();