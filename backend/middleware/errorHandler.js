// Global Error Handler for Atlas API Operations
const errorHandler = (err, req, res, next) => {
    console.error('🚨 Error occurred:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Handle specific Atlas API errors
    if (err.response) {
        const { status, data } = err.response;
        
        switch (status) {
            case 400:
                return res.status(400).json({
                    error: 'Bad Request',
                    message: data.detail || data.error || 'Invalid request parameters',
                    code: 'ATLAS_BAD_REQUEST',
                    timestamp: new Date().toISOString()
                });
                
            case 401:
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Atlas authentication failed - token may be expired',
                    code: 'ATLAS_AUTH_FAILED',
                    timestamp: new Date().toISOString()
                });
                
            case 403:
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Insufficient permissions for Atlas operation',
                    code: 'ATLAS_FORBIDDEN',
                    timestamp: new Date().toISOString()
                });
                
            case 404:
                return res.status(404).json({
                    error: 'Not Found',
                    message: data.detail || 'Atlas resource not found',
                    code: 'ATLAS_NOT_FOUND',
                    timestamp: new Date().toISOString()
                });
                
            default:
                return res.status(status).json({
                    error: 'Atlas API Error',
                    message: data.detail || data.error || 'Unknown Atlas API error',
                    code: 'ATLAS_API_ERROR',
                    statusCode: status,
                    timestamp: new Date().toISOString()
                });
        }
    }

    // Default server error
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? 
            err.message : 
            'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
};

export default errorHandler;