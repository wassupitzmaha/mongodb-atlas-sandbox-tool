// Atlas Authentication Middleware
import atlasAuth from '../services/atlasAuth.js';

const atlasAuthMiddleware = async (req, res, next) => {
    try {
        // Ensure we have a valid Atlas token
        const token = await atlasAuth.getValidToken();
        
        if (!token) {
            return res.status(401).json({
                error: 'Atlas authentication failed',
                message: 'Unable to obtain valid Atlas API token',
                code: 'ATLAS_AUTH_FAILED'
            });
        }
        
        // Add token to request context for debugging
        req.atlasToken = token;
        next();
        
    } catch (error) {
        console.error('❌ Atlas authentication middleware failed:', error.message);
        
        res.status(401).json({
            error: 'Atlas authentication error',
            message: error.message,
            code: 'ATLAS_AUTH_ERROR'
        });
    }
};

export default atlasAuthMiddleware;