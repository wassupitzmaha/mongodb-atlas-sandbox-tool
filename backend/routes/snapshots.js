import dotenv from 'dotenv;'

dotenv.config()

// Global Error Handler for Atlas API Operations
const errorHandler = (err, req, res, next) => {
    console.error('🚨 Error occurred:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Handle specific Atlas API errors (from your Postman collection responses)
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
                
            case 409:
                return res.status(409).json({
                    error: 'Conflict',
                    message: data.detail || 'Resource already exists or conflicting operation',
                    code: 'ATLAS_CONFLICT',
                    timestamp: new Date().toISOString()
                });
                
            case 429:
                return res.status(429).json({
                    error: 'Rate Limited',
                    message: 'Too many requests to Atlas API - please wait before retrying',
                    code: 'ATLAS_RATE_LIMITED',
                    retryAfter: err.response.headers['retry-after'] || '60',
                    timestamp: new Date().toISOString()
                });
                
            case 503:
                return res.status(503).json({
                    error: 'Service Unavailable',
                    message: 'Atlas API is temporarily unavailable',
                    code: 'ATLAS_SERVICE_UNAVAILABLE',
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

    // Handle network/timeout errors
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Cannot connect to Atlas API - check network connectivity',
            code: 'ATLAS_CONNECTION_ERROR',
            timestamp: new Date().toISOString()
        });
    }

    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        return res.status(408).json({
            error: 'Request Timeout',
            message: 'Atlas API request timed out - operation may still be in progress',
            code: 'ATLAS_TIMEOUT',
            timestamp: new Date().toISOString()
        });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message,
            code: 'VALIDATION_ERROR',
            timestamp: new Date().toISOString()
        });
    }

    // Handle specific application errors
    if (err.message.includes('No snapshots found')) {
        return res.status(404).json({
            error: 'No Snapshots Available',
            message: 'No snapshots found for the production cluster',
            code: 'NO_SNAPSHOTS_AVAILABLE',
            recommendation: 'Ensure your production cluster has backup enabled and wait for first snapshot',
            timestamp: new Date().toISOString()
        });
    }

    if (err.message.includes('Cluster already exists')) {
        return res.status(409).json({
            error: 'Cluster Exists',
            message: 'A cluster with this name already exists',
            code: 'CLUSTER_NAME_CONFLICT',
            recommendation: 'Use a different cluster name or delete the existing cluster',
            timestamp: new Date().toISOString()
        });
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