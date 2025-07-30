// Atlas OAuth Authentication Service - Fixed Environment Loading
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables in the service file
dotenv.config();

class AtlasAuthService {
    constructor() {
        // Load environment variables at construction time
        this.clientId = process.env.ATLAS_CLIENT_ID;
        this.clientSecret = process.env.ATLAS_CLIENT_SECRET;
        this.authUrl = process.env.ATLAS_AUTH_URL;
        
        console.log('🔍 AtlasAuthService constructor debug:');
        console.log('  - Auth URL from env:', process.env.ATLAS_AUTH_URL);
        console.log('  - Auth URL in class:', this.authUrl);
        console.log('  - Client ID set:', !!this.clientId);
        console.log('  - Client Secret set:', !!this.clientSecret);
        
        // Validate required variables
        if (!this.clientId) {
            throw new Error('ATLAS_CLIENT_ID environment variable is required');
        }
        if (!this.clientSecret) {
            throw new Error('ATLAS_CLIENT_SECRET environment variable is required');
        }
        if (!this.authUrl) {
            throw new Error('ATLAS_AUTH_URL environment variable is required');
        }
        
        // Token management
        this.accessToken = null;
        this.tokenExpiry = null;
        
        console.log('✅ AtlasAuthService initialized successfully');
    }

    async getAuthToken() {
        try {
            console.log('🔑 Requesting Atlas OAuth token...');
            console.log('🔍 Using URL:', this.authUrl);
            
            const response = await axios.post(
                this.authUrl,
                'grant_type=client_credentials',
                {
                    auth: {
                        username: this.clientId,
                        password: this.clientSecret
                    },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
            
            console.log('✅ Atlas OAuth token acquired successfully');
            return this.accessToken;
            
        } catch (error) {
            console.error('❌ Atlas OAuth failed:', error.message);
            
            if (error.response) {
                const { status, data } = error.response;
                throw new Error(`Atlas API error (${status}): ${data.error_description || data.error}`);
            }
            
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    isTokenValid() {
        return this.accessToken && Date.now() < this.tokenExpiry;
    }

    async getValidToken() {
        if (!this.isTokenValid()) {
            await this.getAuthToken();
        }
        return this.accessToken;
    }

    async refreshToken() {
        this.accessToken = null;
        this.tokenExpiry = null;
        return await this.getAuthToken();
    }

    async getAuthHeader() {
        const token = await this.getValidToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.atlas.2024-11-13+json',
            'Content-Type': 'application/json'
        };
    }
}

export default new AtlasAuthService();