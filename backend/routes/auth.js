// Authentication and Token Management Routes
import express from 'express';
import atlasAuth from '../services/atlasAuth.js';

const router = express.Router();

// Test Atlas authentication
router.get('/test', async (req, res, next) => {
    try {
        console.log(' Testing Atlas authentication...');
        
        // Force token refresh to test connectivity
        const token = await atlasAuth.refreshToken();
        
        res.json({
            status: 'success',
            message: 'Atlas authentication successful',
            tokenAcquired: !!token,
            timestamp: new Date().toISOString(),
            clientId: process.env.ATLAS_CLIENT_ID.substring(0, 10) + '...'
        });
        
    } catch (error) {
        next(error);
    }
});

// Get current token status
router.get('/status', async (req, res, next) => {
    try {
        const isValid = atlasAuth.isTokenValid();
        
        res.json({
            status: 'success',
            tokenValid: isValid,
            tokenExpiry: atlasAuth.tokenExpiry,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

// Force token refresh
router.post('/refresh', async (req, res, next) => {
    try {
        console.log('🔄 Forcing Atlas token refresh...');
        
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