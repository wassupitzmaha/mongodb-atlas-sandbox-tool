// Atlas OAuth Authentication Service - Fixed Environment Loading
import axios from 'axios';

//import our atuhtentication service 
import dotenv from 'dotenv';

// Load environment variables in the service file
dotenv.config();

//a class to encapsulate all atlas oauth authentication logic
class AtlasAuthService {
    constructor() {
        // Load environment variables at construction time
        this.clientId = process.env.ATLAS_CLIENT_ID;
        this.clientSecret = process.env.ATLAS_CLIENT_SECRET;
        this.authUrl = process.env.ATLAS_AUTH_URL;

        console.log(' AtlasAuthService constructor debug:');
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
        
        //internal storage for the oauth access token (initially null)
        this.accessToken = null;
        //internal storage for token expiry timestamp (milliseconds), initially null
        this.tokenExpiry = null; 
        
        console.log(' AtlasAuthService initialized successfully');
    }

    //method to request  a new oauth token using the client cred grant type
    async getAuthToken() {
        try {
            console.log(' Requesting Atlas OAuth token...');
            console.log(' Using URL:', this.authUrl);
            
            //make POST req to the OAuth token endpoint
            const response = await axios.post(
                this.authUrl,
                'grant_type=client_credentials',
                {
                    auth: {
                        username: this.clientId,
                        password: this.clientSecret
                    },
                    //set content type to indicate URL-ecoded form data
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000
                }
            );

            //afetr success, store the access token in memory for future use
            this.accessToken = response.data.access_token;

            //calculate token expiry time:
            //current time + (token lifetime returned by server - 5 mins), thsi will also get converetd to milliseconds
            //5 min buffer helps avoid edge cases where token could expire during use
            this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
            
            console.log(' Atlas OAuth token acquired successfully');

            //return the acquired token to the caller
            return this.accessToken;
            
        } catch (error) {
            console.error(' Atlas OAuth failed:', error.message);
            
            if (error.response) {
                const { status, data } = error.response;
                throw new Error(`Atlas API error (${status}): ${data.error_description || data.error}`);
            }
            
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    //method to check if the current token exists and has not expired
    isTokenValid() {
        //token is valid id accessToken is not null and current time is before expiry
        return this.accessToken && Date.now() < this.tokenExpiry;
    }

    //mehtod to get a token that is gurranteed valid
    //returns existing token if valid
    async getValidToken() {
        if (!this.isTokenValid()) { //if no valid token, then return a new one and store it
            await this.getAuthToken();
        }
        return this.accessToken;
    }

    //method to forcibly refresh the token, orgnoring the current otken status
    async refreshToken() {
        //clear stored token and expiry info
        this.accessToken = null;
        this.tokenExpiry = null;
        // req to get a fresh token and return it
        return await this.getAuthToken();
    }

    //helper method to produce the authorization headers required for atlas api calls
    async getAuthHeader() {
        //ensure a valid token is available (refresh if needed)
        const token = await this.getValidToken();
        //return an object with the appropriate headers
        return {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.atlas.2024-11-13+json',
            'Content-Type': 'application/json'
        };
    }
}

export default new AtlasAuthService();