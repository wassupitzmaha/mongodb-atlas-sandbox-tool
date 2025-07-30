import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testUrlOnly() {
    const authUrl = process.env.ATLAS_AUTH_URL;
    const clientId = process.env.ATLAS_CLIENT_ID;
    const clientSecret = process.env.ATLAS_CLIENT_SECRET;
    
    console.log('🔍 URL Test:');
    console.log('Auth URL:', authUrl);
    console.log('Valid URL format:', /^https:\/\//.test(authUrl));
    
    if (!authUrl || !authUrl.startsWith('https://')) {
        console.error('❌ Invalid or missing auth URL');
        return;
    }
    
    try {
        console.log('🔄 Testing axios request to:', authUrl);
        
        const response = await axios.post(
            authUrl,
            'grant_type=client_credentials',
            {
                auth: {
                    username: clientId,
                    password: clientSecret
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log('✅ Success! Response status:', response.status);
        console.log('Token received:', !!response.data.access_token);
        
    } catch (error) {
        console.error('❌ Request failed:');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Request config URL:', error.config?.url);
    }
}

testUrlOnly();