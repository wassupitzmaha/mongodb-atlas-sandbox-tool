// Debug Authentication Script - Fixed Version
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function debugAuth() {
    console.log(' Debugging Atlas Authentication...\n');
    
    // Check environment variables
    console.log(' Environment Variables:');
    console.log('ATLAS_CLIENT_ID:', process.env.ATLAS_CLIENT_ID ? 'Set' : 'Missing');
    console.log('ATLAS_CLIENT_SECRET:', process.env.ATLAS_CLIENT_SECRET ? 'Set' : 'Missing');
    console.log('ATLAS_AUTH_URL:', process.env.ATLAS_AUTH_URL);
    console.log('');
    
    if (!process.env.ATLAS_CLIENT_ID || !process.env.ATLAS_CLIENT_SECRET) {
        console.error(' Missing required environment variables!');
        return;
    }
    
    // Try Method 1: URLSearchParams (your Postman format)
    console.log(' Method 1: Using URLSearchParams...');
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', process.env.ATLAS_CLIENT_ID);
        params.append('client_secret', process.env.ATLAS_CLIENT_SECRET);
        
        const response = await axios.post(
            process.env.ATLAS_AUTH_URL,
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log('Method 1 successful!');
        console.log('Token type:', response.data.token_type);
        console.log('Expires in:', response.data.expires_in, 'seconds');
        console.log('Token preview:', response.data.access_token.substring(0, 20) + '...');
        return; // Success, exit here
        
    } catch (error) {
        console.log(' Method 1 failed:', error.response?.status, error.response?.data);
    }
    
    // Try Method 2: Basic Auth (alternative approach)
    console.log('\n Method 2: Using Basic Auth...');
    try {
        const response = await axios.post(
            process.env.ATLAS_AUTH_URL,
            'grant_type=client_credentials',
            {
                auth: {
                    username: process.env.ATLAS_CLIENT_ID,
                    password: process.env.ATLAS_CLIENT_SECRET
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log('Method 2 successful!');
        console.log('Token type:', response.data.token_type);
        console.log('Expires in:', response.data.expires_in, 'seconds');
        console.log('Token preview:', response.data.access_token.substring(0, 20) + '...');
        return; // Success, exit here
        
    } catch (error) {
        console.log(' Method 2 failed:', error.response?.status, error.response?.data);
    }
    
    // Try Method 3: Manual string building
    console.log('\n Method 3: Manual string building...');
    try {
        const data = `grant_type=client_credentials&client_id=${encodeURIComponent(process.env.ATLAS_CLIENT_ID)}&client_secret=${encodeURIComponent(process.env.ATLAS_CLIENT_SECRET)}`;
        
        const response = await axios.post(
            process.env.ATLAS_AUTH_URL,
            data,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log(' Method 3 successful!');
        console.log('Token type:', response.data.token_type);
        console.log('Expires in:', response.data.expires_in, 'seconds');
        console.log('Token preview:', response.data.access_token.substring(0, 20) + '...');
        return; // Success, exit here
        
    } catch (error) {
        console.log(' Method 3 failed:', error.response?.status, error.response?.data);
    }
    
    console.log('\n All methods failed!');
    console.log('\n Next steps:');
    console.log('1. Double-check your Client ID and Secret in MongoDB Atlas');
    console.log('2. Verify the service account is enabled');
    console.log('3. Try the request in Postman with exact same credentials');
    console.log('4. Check if your Atlas organization/project settings changed');
}

debugAuth();