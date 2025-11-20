// Authentication and Token Management Routes
import express from 'express';

//import the atlasAuth module where all the atlas authentication logic lives
import atlasAuth from '../services/atlasAuth.js';

//create new express router object so routes are organized in a modular way
const router = express.Router();

// route to Test Atlas authentication

//regiser a /GET route as '/test' to check if Atlas Authentication works
router.get('/test', async (req, res, next) => {
    try {
        console.log(' Testing Atlas authentication...');
        
        // calls the aync function that attempts to refresh and get a new atlas auth token and then wait for that auth token
        const token = await atlasAuth.refreshToken();
        
        res.json({
            status: 'success',
            message: 'Atlas authentication successful',
            tokenAcquired: !!token, //message that I can read
            timestamp: new Date().toISOString(),
            clientId: process.env.ATLAS_CLIENT_ID.substring(0, 10) + '...' //shwo first 10 chars then periods for security
        });
        
    } catch (error) {
        next(error);
    }
});

// Get current token status
//GET route at '/status' to check if the current atlas token is valid
router.get('/status', async (req, res, next) => {
    try {
        //calls function to check if the currently held token is valid or not
        const isValid = atlasAuth.isTokenValid();
        
        res.json({
            status: 'success',
            tokenValid: isValid,//boolean is the token valid
            tokenExpiry: atlasAuth.tokenExpiry,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

// Force token refresh
//POST route at '/refresh' to maually force a token refresh
router.post('/refresh', async (req, res, next) => {
    try {
        console.log(' Forcing Atlas token refresh...');
        //refresh the token by calling the async function
        const token = await atlasAuth.refreshToken();
        
        res.json({
            status: 'success',
            message: 'Token refreshed successfully',
            tokenAcquired: !!token,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;