// Atlas Authentication Middleware
import dotenv from 'dotenv';

//import the atlas authentication service 
import atlasAuth from '../services/atlasAuth.js';

//load env variables
dotenv.config();

//middelware function that ensures we have a valid atlas token before processing requests
const atlasAuthMiddleware = async (req, res, next) => {
    try {
        //tries to get a valid Atlas token
        const token = await atlasAuth.getValidToken();
        //if no token is avaibale then return a 401 code
        if (!token) {
            return res.status(401).json({
                error: 'Atlas authentication failed',
                message: 'Unable to obtain valid Atlas API token',
                code: 'ATLAS_AUTH_FAILED'
            });
        }
        
        //store the token in the request object for debugging purposes
        req.atlasToken = token;
        //calling next to go to the next middleware
        next();
        
    } catch (error) {
        console.error(' Atlas authentication middleware failed:', error.message);
        
        res.status(401).json({
            error: 'Atlas authentication error',
            message: error.message,
            code: 'ATLAS_AUTH_ERROR'
        });
    }
};

export default atlasAuthMiddleware;